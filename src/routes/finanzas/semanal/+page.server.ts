import { db } from '$lib/server/db';
import { cierresDia, cortesSemanales } from '$lib/server/schema';
import { sql, and, gte, lte, desc } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
    if (!locals.user || locals.user.rol !== 'jefe') {
        throw redirect(302, '/');
    }

    const ultimosCortes = await db.select()
        .from(cortesSemanales)
        .orderBy(desc(cortesSemanales.fechaCorte))
        .limit(10);

    return {
        ultimosCortes
    };
};

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
        const end = new Date(finStr + 'T23:59:59');
        const totalReal = parseFloat(totalRealStr);

        if (isNaN(start.getTime()) || isNaN(end.getTime()) || isNaN(totalReal)) {
            return fail(400, { error: 'Datos inválidos en las fechas o el monto.' });
        }

        try {
            // Sumar todo el efectivo físico ingresado en los turnos cerrados en ese rango de fechas
            const [sumaTurnos] = await db.select({
                total: sql<number>`COALESCE(SUM(CAST(${turnos.monto} AS NUMERIC)), 0)`
            })
            .from(turnos)
            .where(and(gte(turnos.fecha, start), lte(turnos.fecha, end)));

            const totalCalculado = Number(sumaTurnos?.total || 0);
            const diferencia = totalReal - totalCalculado;

            // Guardar el corte
            await db.insert(cortesSemanales).values({
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
        } catch (err: any) {
            console.error('Error corte semanal:', err);
            return fail(500, { error: `Error al procesar el corte: ${err?.message || err}` });
        }
    }
};
