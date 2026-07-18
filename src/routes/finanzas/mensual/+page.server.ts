import { db } from '$lib/server/db';
import { cortesSemanales } from '$lib/server/schema';
import { sql, and, gte, lt } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
    const mesParam = url.searchParams.get('mes');
    let dataCortes = [];
    let monthLabel = '';

    if (mesParam) {
        // mesParam formato: YYYY-MM
        const [yearStr, monthStr] = mesParam.split('-');
        const year = parseInt(yearStr);
        const month = parseInt(monthStr) - 1; // 0-indexed

        const start = new Date(year, month, 1);
        const end = new Date(year, month + 1, 1);
        
        monthLabel = start.toLocaleString('es-ES', { month: 'long', year: 'numeric' });

        dataCortes = await db.select()
            .from(cortesSemanales)
            .where(and(gte(cortesSemanales.fechaCorte, start), lt(cortesSemanales.fechaCorte, end)))
            .orderBy(cortesSemanales.fechaCorte);
    }

    return {
        cortes: dataCortes,
        monthLabel,
        selectedMonth: mesParam || ''
    };
};
