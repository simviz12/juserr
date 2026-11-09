import type { PageServerLoad } from './$types';
import { getFinanceDashboard } from '$lib/features/finance/server/dashboard.service';
import { isValidDateKey, parseRangeType } from '$lib/features/finance/domain/period';

// El acceso (solo jefe) lo garantiza el guard central de hooks.server.ts.
export const load: PageServerLoad = async ({ url }) => {
	const type = parseRangeType(url.searchParams.get('rango'));
	const fecha = url.searchParams.get('fecha');
	return getFinanceDashboard(type, isValidDateKey(fecha) ? fecha : undefined);
};
