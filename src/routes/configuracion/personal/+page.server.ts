import { db } from '$lib/server/db';
import { usuarios } from '$lib/server/schema';
import { eq } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import * as argon2 from '@node-rs/argon2';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
    const list = await db.select({
        id: usuarios.id,
        nombre: usuarios.nombre,
        rol: usuarios.rol,
        createdAt: usuarios.createdAt
    }).from(usuarios).orderBy(usuarios.id);
    
    return { personal: list };
};

export const actions: Actions = {
    create: async ({ request }) => {
        const formData = await request.formData();
        const nombre = formData.get('nombre')?.toString();
        const rawPassword = formData.get('password')?.toString();
        const rol = formData.get('rol')?.toString();

        if (!nombre || !rawPassword || !rol) {
            return fail(400, { error: 'Todos los campos son requeridos' });
        }

        try {
            const passwordHash = await argon2.hash(rawPassword);
            await db.insert(usuarios).values({
                nombre,
                passwordHash,
                rol
            });
            return { success: true };
        } catch (err) {
            return fail(500, { error: 'Error al crear el usuario' });
        }
    },
    update: async ({ request }) => {
        const formData = await request.formData();
        const id = Number(formData.get('id'));
        const nombre = formData.get('nombre')?.toString();
        const rawPassword = formData.get('password')?.toString();
        const rol = formData.get('rol')?.toString();

        if (!id || !nombre || !rol) {
            return fail(400, { error: 'Faltan campos requeridos' });
        }

        try {
            const updates: any = { nombre, rol };
            if (rawPassword) {
                updates.passwordHash = await argon2.hash(rawPassword);
            }

            await db.update(usuarios).set(updates).where(eq(usuarios.id, id));
            return { success: true };
        } catch (err) {
            return fail(500, { error: 'Error al actualizar el usuario' });
        }
    },
    delete: async ({ request }) => {
        const formData = await request.formData();
        const id = Number(formData.get('id'));

        if (!id) return fail(400, { error: 'ID requerido' });

        try {
            // Check if it's the last jefe
            const allUsers = await db.select().from(usuarios);
            const userToDelete = allUsers.find(u => u.id === id);
            
            if (userToDelete?.rol === 'jefe') {
                const totalJefes = allUsers.filter(u => u.rol === 'jefe').length;
                if (totalJefes <= 1) {
                    return fail(400, { error: 'No puedes eliminar al último Jefe del sistema.' });
                }
            }

            await db.delete(usuarios).where(eq(usuarios.id, id));
            return { success: true };
        } catch (err) {
            return fail(500, { error: 'No se puede eliminar el usuario porque tiene registros asociados en la base de datos (ventas, cierres, etc).' });
        }
    }
};
