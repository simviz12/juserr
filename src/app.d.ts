// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			/** Usuario del restaurante en sesión (incluye su tenantId). */
			user: import('$lib/server/schema').usuarios.$inferSelect | null;
			session: import('$lib/server/schema').sesiones.$inferSelect | null;
			/** Restaurante del usuario en sesión. */
			tenant: import('$lib/server/tenancy').TenantInfo | null;
			/** Plan y módulos utilizables hoy por el restaurante. */
			entitlements: import('$lib/modules/registry').Entitlements | null;
			/** Operador de la consola /plataforma (sesión independiente). */
			platformAdmin: import('$lib/server/platform-auth').PlatformAdmin | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
