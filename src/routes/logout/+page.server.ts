import { redirect } from '@sveltejs/kit';
import { invalidateSession } from '$lib/server/auth';
import type { Actions } from './$types';

export const actions: Actions = {
    default: async (event) => {
        if (!event.locals.session) {
            throw redirect(302, '/login');
        }
        await invalidateSession(event.locals.session.id);
        event.cookies.delete('session', { path: '/' });
        throw redirect(302, '/login');
    }
};
