import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
    const user = event.locals.user;
    
    if (!user) {
        throw redirect(302, '/login');
    }

    // Redirección inteligente basada en el rol
    if (user.rol === 'jefe') {
        throw redirect(302, '/dashboard');
    } else {
        throw redirect(302, '/inventory');
    }
};
