import { validateSessionToken } from '$lib/server/auth';
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

    // Redirigir URLs viejas para evitar que el usuario se quede atrapado
    if (event.url.pathname.startsWith('/inventory')) {
        throw redirect(302, '/');
    }

    // Proteger todas las rutas excepto /login
    if (event.url.pathname !== '/login') {
        if (!event.locals.user) {
            throw redirect(302, '/login');
        }

        // Restricciones de rutas por rol
        const user = event.locals.user;
        const p = event.url.pathname;
        
        if (p === '/logout') {
            return resolve(event);
        }
        
        if (user.rol === 'empleado' || user.rol === 'cajero') {
            const allowedForCajero = [
                '/turnos/cierre'
            ];
            
            if (!allowedForCajero.includes(p) && p !== '/') {
                throw redirect(302, '/turnos/cierre');
            }
        } else if (user.rol === 'bodeguero') {
            const allowedForBodeguero = [
                '/bodega',
                '/turnos/cierre'
            ];

            if (!allowedForBodeguero.includes(p) && p !== '/') {
                throw redirect(302, '/bodega');
            }
        }
    }

    return resolve(event);
};
