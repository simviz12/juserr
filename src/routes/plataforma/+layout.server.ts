import type { LayoutServerLoad } from './$types';

// hooks.server.ts ya exige la sesión de plataforma en todas las rutas salvo /plataforma/login.
export const load: LayoutServerLoad = async ({ locals }) => ({ admin: locals.platformAdmin });
