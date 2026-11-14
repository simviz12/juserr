import { redirect } from '@sveltejs/kit';
import { cerrarSesionPlataforma } from '$lib/server/platform-auth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => redirect(303, '/plataforma');

export const actions: Actions = {
	default: async ({ cookies }) => {
		await cerrarSesionPlataforma(cookies);
		redirect(303, '/plataforma/login');
	}
};
