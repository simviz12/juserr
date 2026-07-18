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
                '/pizzas/mostrador',
                '/bebidas/venta',
                '/turnos/cierre'
            ];
            
            if (!allowedForCajero.includes(p)) {
                throw redirect(302, '/pizzas/mostrador');
            }
        } else if (user.rol === 'bodeguero') {
            const allowedForBodeguero = [
                '/inventory/conteo',
                '/inventory/compra'
            ];

            if (!allowedForBodeguero.includes(p)) {
                throw redirect(302, '/inventory/conteo');
            }
        }
    }

    return resolve(event);
};
