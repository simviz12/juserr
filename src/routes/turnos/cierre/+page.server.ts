import { db } from '$lib/server/db';
import { turnos, gastos } from '$lib/server/schema';
import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
    default: async ({ request, locals }) => {
        if (!locals.user) return fail(401, { error: 'No autorizado' });

        const formData = await request.formData();
        const montoStr = formData.get('monto')?.toString();
        const descripcionTurno = formData.get('descripcion')?.toString() || '';
        
        const monto = parseFloat(montoStr || '0');
        if (isNaN(monto) || monto < 0) {
            return fail(400, { error: 'Monto de efectivo en caja inválido.' });
        }

        // Recuperar los gastos dinámicos
        const descripciones = formData.getAll('gasto_descripcion') as string[];
        const montos = formData.getAll('gasto_monto') as string[];

        const gastosParsed = [];
        for (let i = 0; i < descripciones.length; i++) {
            const desc = descripciones[i].trim();
            const val = parseFloat(montos[i]);
            if (desc && !isNaN(val) && val > 0) {
                gastosParsed.push({ descripcion: desc, monto: val.toString() });
            }
        }

        try {
            return await db.transaction(async (tx) => {
                // 1. Crear el turno
                const [nuevoTurno] = await tx.insert(turnos).values({
                    monto: monto.toString(),
                    descripcion: descripcionTurno,
                }).returning({ id: turnos.id });

                // 2. Si hay gastos, insertarlos amarrados al turno
                if (gastosParsed.length > 0) {
                    const insertData = gastosParsed.map(g => ({
                        turnoId: nuevoTurno.id,
                        descripcion: g.descripcion,
                        monto: g.monto
                    }));
                    await tx.insert(gastos).values(insertData);
                }

                return { success: true, message: 'Turno y gastos registrados correctamente.' };
            });
        } catch (err) {
            console.error(err);
            return fail(500, { error: 'Error interno al registrar el cierre de turno.' });
        }
    }
};
