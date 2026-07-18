import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { usuarios } from '$lib/server/schema';
import { eq } from 'drizzle-orm';
import { verify } from '@node-rs/argon2';
import { createSession, generateSessionToken } from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
    if (event.locals.user) {
        throw redirect(302, '/');
    }
    return {};
};

export const actions: Actions = {
    default: async (event) => {
        const formData = await event.request.formData();
        const username = formData.get('username');
        const password = formData.get('password');

        if (typeof username !== 'string' || typeof password !== 'string') {
            return fail(400, { message: 'Datos invalidos' });
        }

        const results = await db.select().from(usuarios).where(eq(usuarios.nombre, username));
        if (results.length === 0) {
            return fail(400, { message: 'Usuario o contraseña incorrectos' });
        }

        const user = results[0];
        const validPassword = await verify(user.passwordHash, password);

        if (!validPassword) {
            return fail(400, { message: 'Usuario o contraseña incorrectos' });
        }

        const token = generateSessionToken();
        const session = await createSession(token, user.id);

        event.cookies.set('session', token, {
            path: '/',
            httpOnly: true,
            secure: import.meta.env.PROD,
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 30 // 30 days
        });

        throw redirect(302, '/');
    }
};
