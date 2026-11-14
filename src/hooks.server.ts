import { validateSessionToken } from '$lib/server/auth';
import { PLATFORM_COOKIE, validarSesionPlataforma } from '$lib/server/platform-auth';
import { derechosDe } from '$lib/server/tenancy';
import { canAccess, homeFor, isPublicPath } from '$lib/auth/access';
import { evaluarAcceso } from '$lib/modules/registry';
import { redirect } from '@sveltejs/kit';
import type { Handle, RequestEvent } from '@sveltejs/kit';

const LECTURA = new Set(['GET', 'HEAD', 'OPTIONS']);
const PLATAFORMA_PUBLICA = ['/plataforma/login'];

function encabezados(response: Response): Response {
	response.headers.set('X-Frame-Options', 'SAMEORIGIN');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	return response;
}

/** Consola del dueño de la plataforma: sesión propia, sin restaurante. */
async function manejarPlataforma(event: RequestEvent, resolve: Parameters<Handle>[0]['resolve']) {
	event.locals.platformAdmin = await validarSesionPlataforma(event.cookies.get(PLATFORM_COOKIE));
	const publica = PLATAFORMA_PUBLICA.includes(event.url.pathname);
	if (!event.locals.platformAdmin && !publica) redirect(303, '/plataforma/login');
	return encabezados(await resolve(event));
}

export const handle: Handle = async ({ event, resolve }) => {
	const path = event.url.pathname;
	event.locals.user = null;
	event.locals.session = null;
	event.locals.tenant = null;
	event.locals.entitlements = null;
	event.locals.platformAdmin = null;

	// URLs antiguas
	if (path.startsWith('/inventory')) redirect(302, '/');
	if (path === '/saas/suscripcion' || path.startsWith('/saas/')) redirect(302, '/facturacion');

	if (path === '/plataforma' || path.startsWith('/plataforma/'))
		return manejarPlataforma(event, resolve);

	const sessionToken = event.cookies.get('session');
	if (sessionToken) {
		const { session, user } = await validateSessionToken(sessionToken);
		if (session) {
			event.cookies.set('session', sessionToken, {
				path: '/',
				httpOnly: true,
				secure: import.meta.env.PROD,
				sameSite: 'lax',
				maxAge: 60 * 60 * 24 * 30
			});
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
	if (gate.tipo === 'modulo-no-contratado')
		redirect(303, `/modulos?bloqueado=${encodeURIComponent(gate.modulo.codigo)}`);
	if (gate.tipo === 'solo-lectura') redirect(303, '/facturacion?motivo=solo-lectura');
	if (gate.tipo === 'suspendido') redirect(303, '/facturacion?motivo=suspendido');

	return encabezados(await resolve(event));
};
