import { validateSessionToken, SESSION_COOKIE_OPTS } from '$lib/server/auth';
import { PLATFORM_COOKIE, validarSesionPlataforma } from '$lib/server/platform-auth';
import { derechosDe } from '$lib/server/tenancy';
import { canAccess, homeFor, isPublicPath, rutaCanonica } from '$lib/auth/access';
import { evaluarAcceso } from '$lib/modules/registry';
import { log } from '$lib/server/log';
import { error, redirect } from '@sveltejs/kit';
import type { Handle, HandleServerError, RequestEvent } from '@sveltejs/kit';

const LECTURA = new Set(['GET', 'HEAD', 'OPTIONS']);
const PLATAFORMA_PUBLICA = ['/plataforma/login'];

function encabezados(response: Response): Response {
	const h = response.headers;
	h.set('X-Frame-Options', 'DENY');
	h.set('X-Content-Type-Options', 'nosniff');
	h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	h.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
	h.set('Cross-Origin-Opener-Policy', 'same-origin');
	if (import.meta.env.PROD)
		h.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
	return response;
}

const esPlataforma = (path: string, routeId: string | null) =>
	path === '/plataforma' ||
	path.startsWith('/plataforma/') ||
	routeId === '/plataforma' ||
	!!routeId?.startsWith('/plataforma/');

/** Consola del dueño de la plataforma: sesión propia, sin restaurante. */
async function manejarPlataforma(
	event: RequestEvent,
	path: string,
	resolve: Parameters<Handle>[0]['resolve']
) {
	event.locals.platformAdmin = await validarSesionPlataforma(event.cookies.get(PLATFORM_COOKIE));
	const publica = PLATAFORMA_PUBLICA.includes(path);
	if (!event.locals.platformAdmin && !publica) redirect(303, '/plataforma/login');
	return encabezados(await resolve(event));
}

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.user = null;
	event.locals.session = null;
	event.locals.tenant = null;
	event.locals.entitlements = null;
	event.locals.platformAdmin = null;

	// Todas las decisiones se toman sobre la ruta DECODIFICADA, que es la que
	// enruta SvelteKit (ver rutaCanonica).
	const path = rutaCanonica(event.url.pathname);
	if (path === null) error(400, 'Ruta inválida');

	// URLs antiguas
	if (path.startsWith('/inventory')) redirect(302, '/');
	if (path === '/saas/suscripcion' || path.startsWith('/saas/')) redirect(302, '/facturacion');

	if (esPlataforma(path, event.route.id)) return manejarPlataforma(event, path, resolve);

	const sessionToken = event.cookies.get('session');
	if (sessionToken) {
		const { session, user } = await validateSessionToken(sessionToken);
		if (session) {
			event.cookies.set('session', sessionToken, SESSION_COOKIE_OPTS);
		} else {
			event.cookies.delete('session', { path: '/' });
		}
		event.locals.user = user;
		event.locals.session = session;
	}

	if (isPublicPath(path)) return encabezados(await resolve(event));

	const user = event.locals.user;
	if (!user) redirect(302, '/login');

	// 1. Rol: cubre load() Y form actions (comparten ruta).
	if (!canAccess(user.rol, path)) redirect(302, homeFor(user.rol));

	// 2. Plan y módulos pagados del restaurante.
	const derechos = await derechosDe(user.tenantId);
	if (!derechos) {
		event.cookies.delete('session', { path: '/' });
		redirect(302, '/login');
	}
	event.locals.tenant = derechos.info;
	event.locals.entitlements = derechos.ent;

	const gate = evaluarAcceso(path, derechos.ent, !LECTURA.has(event.request.method));
	// Exclusivo de otro restaurante: para este no existe (no se revela nada).
	if (gate.tipo === 'no-encontrado') error(404, 'Not found');
	if (gate.tipo === 'modulo-no-contratado') {
		// Un exclusivo vencido no está en el catálogo: su dueño va a Facturación a renovarlo.
		if (gate.modulo.exclusivoDe)
			redirect(303, `/facturacion?motivo=modulo&modulo=${encodeURIComponent(gate.modulo.codigo)}`);
		redirect(303, `/modulos?bloqueado=${encodeURIComponent(gate.modulo.codigo)}`);
	}
	if (gate.tipo === 'solo-lectura') redirect(303, '/facturacion?motivo=solo-lectura');
	if (gate.tipo === 'suspendido') redirect(303, '/facturacion?motivo=suspendido');

	return encabezados(await resolve(event));
};

/**
 * Errores inesperados: se registran con un id de correlación y contexto
 * (restaurante, usuario, ruta). Al usuario solo le llega el id, nunca detalles.
 */
export const handleError: HandleServerError = ({ error: err, event, status, message }) => {
	const errorId = crypto.randomUUID();
	log.error('error no controlado', {
		errorId,
		status,
		method: event.request.method,
		route: event.route.id,
		path: event.url.pathname,
		tenantId: event.locals.user?.tenantId ?? null,
		userId: event.locals.user?.id ?? null,
		platformAdminId: event.locals.platformAdmin?.id ?? null,
		err
	});
	return {
		message: status === 404 ? message : 'Ocurrió un error inesperado. Intenta de nuevo.',
		errorId
	};
};
