import { validateSessionToken } from '$lib/server/auth';
import { canAccess, homeFor, isPublicPath } from '$lib/auth/access';
import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	const sessionToken = event.cookies.get('session');

	if (!sessionToken) {
		event.locals.user = null;
		event.locals.session = null;
	} else {
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

	const path = event.url.pathname;

	// URLs antiguas
	if (path.startsWith('/inventory')) redirect(302, '/');

	if (isPublicPath(path)) return resolve(event);

	const user = event.locals.user;
	if (!user) redirect(302, '/login');

	// Guard central: cubre load() Y form actions (comparten ruta), así ninguna
	// acción sensible (crear usuarios, cambiar plan SaaS...) queda expuesta.
	if (!canAccess(user.rol, path)) {
		redirect(302, homeFor(user.rol));
	}

	const response = await resolve(event);
	response.headers.set('X-Frame-Options', 'SAMEORIGIN');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	return response;
};
