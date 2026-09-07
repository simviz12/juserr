import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
    const user = event.locals.user;
    
    if (!user) {
        throw redirect(302, '/login');
    }

    if (user.rol === 'jefe') {
        throw redirect(302, '/dashboard');
    } else if (user.rol === 'bodeguero') {
        throw redirect(302, '/bodega');
    } else {
        throw redirect(302, '/turnos/cierre');
    }
};
