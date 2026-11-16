/**
 * Logger estructurado mínimo: una línea JSON por evento (lo que esperan
 * CloudWatch, Vercel y cualquier agregador). Sin dependencias.
 *
 *   log.info('pago registrado', { tenantId, cents })
 *   log.error('fallo al cerrar turno', { tenantId, err })
 */
type Nivel = 'debug' | 'info' | 'warn' | 'error';
type Contexto = Record<string, unknown>;

const ORDEN: Record<Nivel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const minimo: Nivel = (() => {
	const v = (typeof process !== 'undefined' ? process.env.LOG_LEVEL : '')?.toLowerCase();
	return v && v in ORDEN ? (v as Nivel) : 'info';
})();

function serializar(v: unknown): unknown {
	if (v instanceof Error) {
		const extra = v as Error & { code?: unknown; cause?: unknown };
		return {
			name: v.name,
			message: v.message,
			code: extra.code,
			stack: v.stack,
			cause: extra.cause ? serializar(extra.cause) : undefined
		};
	}
	return v;
}

function emitir(nivel: Nivel, msg: string, ctx: Contexto = {}) {
	if (ORDEN[nivel] < ORDEN[minimo]) return;
	const campos: Contexto = {};
	for (const [k, v] of Object.entries(ctx)) campos[k] = serializar(v);
	const linea = JSON.stringify({ t: new Date().toISOString(), nivel, msg, ...campos });
	if (nivel === 'error') console.error(linea);
	else if (nivel === 'warn') console.warn(linea);
	else console.log(linea);
}

export const log = {
	debug: (msg: string, ctx?: Contexto) => emitir('debug', msg, ctx),
	info: (msg: string, ctx?: Contexto) => emitir('info', msg, ctx),
	warn: (msg: string, ctx?: Contexto) => emitir('warn', msg, ctx),
	error: (msg: string, ctx?: Contexto) => emitir('error', msg, ctx)
};
