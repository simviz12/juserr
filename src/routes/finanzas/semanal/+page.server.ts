import { db } from '$lib/server/db';
import { cierresDia, cortesSemanales } from '$lib/server/schema';
import { sql, and, gte, lte } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
    default: async ({ request, locals }) => {
        if (!locals.user || locals.user.rol !== 'jefe') {
            return fail(401, { error: 'No autorizado. Solo el jefe puede realizar cortes semanales.' });
        }

        const formData = await request.formData();
        const inicioStr = formData.get('rangoInicio')?.toString();
        const finStr = formData.get('rangoFin')?.toString();
        const totalRealStr = formData.get('totalReal')?.toString();

        if (!inicioStr || !finStr || !totalRealStr) {
            return fail(400, { error: 'Todos los campos son obligatorios.' });
        }

        const start = new Date(inicioStr + 'T00:00:00');
        const end = new Date(finStr + 'T23:59:59'); // Hasta el final del día
        const totalReal = parseFloat(totalRealStr);

        if (isNaN(start.getTime()) || isNaN(end.getTime()) || isNaN(totalReal)) {
            return fail(400, { error: 'Datos inválidos.' });
        }

        try {
            return await db.transaction(async (tx) => {
                // Sumar todos los cierres diarios en el rango
                const [sumaCierres] = await tx.select({
                    total: sql<number>`SUM(CAST(${cierresDia.totalEfectivo} AS NUMERIC))`
                })
                .from(cierresDia)
                .where(and(gte(cierresDia.fecha, start), lte(cierresDia.fecha, end)));

                const totalCalculado = Number(sumaCierres?.total || 0);
                const diferencia = totalReal - totalCalculado;

                // Guardar el corte
                await tx.insert(cortesSemanales).values({
                    rangoInicio: start,
                    rangoFin: end,
                    totalCalculado: totalCalculado.toString(),
                    totalReal: totalReal.toString(),
                    diferencia: diferencia.toString()
                });

                return { 
                    success: true, 
                    totalCalculado,
                    totalReal,
                    diferencia,
                    message: 'Corte semanal registrado con éxito.'
                };
            });
        } catch (err) {
            console.error(err);
            return fail(500, { error: 'Error al procesar el corte semanal.' });
        }
    }
};
