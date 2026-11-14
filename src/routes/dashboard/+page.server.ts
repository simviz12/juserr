import type { PageServerLoad } from './$types';
import { getFinanceDashboard } from '$lib/features/finance/server/dashboard.service';
import { isValidDateKey, parseRangeType } from '$lib/features/finance/domain/period';
import { tenantDe } from '$lib/server/tenancy';

// El acceso (solo jefe) lo garantiza el guard central de hooks.server.ts.
export const load: PageServerLoad = async ({ url, locals }) => {
	const type = parseRangeType(url.searchParams.get('rango'));
	const fecha = url.searchParams.get('fecha');
	return getFinanceDashboard(tenantDe(locals), type, isValidDateKey(fecha) ? fecha : undefined);
};
