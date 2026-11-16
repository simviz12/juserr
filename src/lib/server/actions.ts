/**
 * Envoltorio de form actions: un error inesperado (base caída, timeout, bug)
 * se registra con contexto y vuelve como `fail()` con un mensaje claro, en vez
 * de una página 500 genérica que hace perder lo escrito en el formulario.
 *
 * Los redirect() y error() de SvelteKit se dejan pasar intactos.
 */
import { fail, isHttpError, isRedirect, type Action, type RequestEvent } from '@sveltejs/kit';
import { log } from './log';

const ES_CONEXION = /fetch failed|timeout|aborted|ECONNRESET|ECONNREFUSED|ENOTFOUND|socket/i;

function esErrorDeConexion(err: unknown): boolean {
	let e: unknown = err;
	for (let i = 0; i < 5 && e; i++) {
		const x = e as { name?: string; message?: string; cause?: unknown };
		if (x.name === 'TimeoutError' || x.name === 'AbortError') return true;
		if (typeof x.message === 'string' && ES_CONEXION.test(x.message)) return true;
		e = x.cause;
	}
	return false;
}

export function protegerAcciones<A extends Record<string, Action>>(nombre: string, actions: A): A {
	const out: Record<string, Action> = {};
	for (const [clave, accion] of Object.entries(actions)) {
		out[clave] = async (event: RequestEvent) => {
			try {
				return await accion(event as never);
			} catch (err) {
				if (isRedirect(err) || isHttpError(err)) throw err;
				const errorId = crypto.randomUUID();
				const conexion = esErrorDeConexion(err);
				log.error('error en acción', {
					errorId,
					accion: `${nombre}/${clave}`,
					tenantId: event.locals.user?.tenantId ?? null,
					userId: event.locals.user?.id ?? null,
					err
				});
				return fail(conexion ? 503 : 500, {
					error: conexion
						? 'No hay conexión con la base de datos. Intenta de nuevo en un momento; no se guardó nada.'
						: `No se pudo completar la acción (código ${errorId.slice(0, 8)}). Intenta de nuevo.`
				});
			}
		};
	}
	return out as A;
}
