import { redirect } from '@sveltejs/kit';
import { homeFor } from '$lib/auth/access';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(302, '/login');
	redirect(302, homeFor(locals.user.rol));
};
