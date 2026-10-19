import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import { saasSuscripciones, usuarios } from '$lib/server/schema';
import { eq } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async () => {
    // 1. Obtener o inicializar la suscripción SaaS activa
    let [sub] = await db.select().from(saasSuscripciones).limit(1);
    if (!sub) {
        const fechaRenovacion = new Date();
        fechaRenovacion.setDate(fechaRenovacion.getDate() + 30);

        const [nueva] = await db.insert(saasSuscripciones).values({
            planCodigo: 'pro',
            planNombre: 'Pro Gastronómico',
            montoMensual: '69000',
            cicloFacturacion: 'mensual',
            estado: 'activo',
            diasRestantes: 30,
            fechaRenovacion,
            limiteUsuarios: 3,
            soporteWhatsApp: true,
            antiFraudeActivo: true
        }).returning();
        sub = nueva;
    }

    // 2. Conteo de usuarios activos vs límite del plan
    const usuariosActuales = await db.select({ id: usuarios.id }).from(usuarios);

    // 3. Catálogo de planes comerciales SENOVA
    const planesDisponibles = [
        {
            codigo: 'basico',
            nombre: 'Chuzo Básico',
            precioMes: 39000,
            precioDia: 1300,
            badge: 'Puestos y Carretas',
            caracteristicas: [
                'Arqueo de turno en 1 clic',
                'Efectivo vs Nequi / Daviplata',
                'Registro de gastos de turno',
                'Hasta 15 insumos de inventario',
                '1 usuario operador'
            ],
            limiteUsuarios: 1,
            whatsapp: false,
            antifraude: false
        },
        {
            codigo: 'pro',
            nombre: 'Pro Gastronómico',
            precioMes: 69000,
            precioDia: 2300,
            badge: 'Plan Estrella ⭐',
            destacado: true,
            caracteristicas: [
                'Todo lo del Plan Básico',
                'Motor de fracciones (1/4, 1/2, 1/8)',
                'Auditoría estricta de parrilla y vitrina',
                'Insumos y recetas ilimitadas',
                'Alertas automáticas de agotamiento',
                'Reportes PDF y Excel descargables',
                'Hasta 3 usuarios con roles'
            ],
            limiteUsuarios: 3,
            whatsapp: true,
            antifraude: true
        },
        {
            codigo: 'restobar',
            nombre: 'Resto-Bar / Empresarial',
            precioMes: 119000,
            precioDia: 3967,
            badge: 'Alto Volumen',
            caracteristicas: [
                'Todo lo del Plan Pro',
                'Motor antifraude de comprobantes Nequi duplicados',
                'Resumen nocturno directo al WhatsApp del dueño',
                'Múltiples cajeros y turnos simultáneos',
                'Usuarios y roles ilimitados',
                'Soporte técnico prioritario 24/7'
            ],
            limiteUsuarios: 99,
            whatsapp: true,
            antifraude: true
        },
        {
            codigo: 'franquicia',
            nombre: 'Franquicia / Multi-Sede',
            precioMes: 189000,
            precioDia: 6300,
            badge: 'Multi-Sucursales',
            caracteristicas: [
                'Todo lo del Plan Resto-Bar',
                'Hasta 2 sedes incluidas (+ $70k por sede adicional)',
                'Dashboard centralizado consolidado',
                'Traslado de insumos entre bodega y sedes',
                'Auditoría comparativa entre puntos de venta'
            ],
            limiteUsuarios: 999,
            whatsapp: true,
            antifraude: true
        }
    ];

    return {
        suscripcion: sub,
        conteoUsuarios: usuariosActuales.length,
        planes: planesDisponibles
    };
};

export const actions: Actions = {
    cambiarPlan: async ({ request, locals }) => {
        if (!locals.user) return fail(401, { error: 'No autorizado' });

        const formData = await request.formData();
        const planCodigo = formData.get('plan_codigo')?.toString() || 'pro';
        const ciclo = formData.get('ciclo')?.toString() || 'mensual';

        const precios: Record<string, { nombre: string; monto: number; usuarios: number }> = {
            basico: { nombre: 'Chuzo Básico', monto: 39000, usuarios: 1 },
            pro: { nombre: 'Pro Gastronómico', monto: 69000, usuarios: 3 },
            restobar: { nombre: 'Resto-Bar / Empresarial', monto: 119000, usuarios: 99 },
            franquicia: { nombre: 'Franquicia / Multi-Sede', monto: 189000, usuarios: 999 },
        };

        const planElegido = precios[planCodigo] || precios['pro'];
        let factorDescuento = 1;
        let dias = 30;

        if (ciclo === 'trimestral') {
            factorDescuento = 0.91; // ~9% dto
            dias = 90;
        } else if (ciclo === 'anual') {
            factorDescuento = 0.833; // Paga 10 meses, recibe 12
            dias = 365;
        }

        const montoFinal = Math.round(planElegido.monto * factorDescuento);
        const fechaRenovacion = new Date();
        fechaRenovacion.setDate(fechaRenovacion.getDate() + dias);

        const [existe] = await db.select().from(saasSuscripciones).limit(1);
        if (existe) {
            await db.update(saasSuscripciones).set({
                planCodigo,
                planNombre: planElegido.nombre,
                montoMensual: montoFinal.toString(),
                cicloFacturacion: ciclo,
                estado: 'activo',
                diasRestantes: dias,
                fechaRenovacion,
                limiteUsuarios: planElegido.usuarios,
                actualizadoEn: new Date()
            }).where(eq(saasSuscripciones.id, existe.id));
        }

        return {
            success: true,
            message: `Plan actualizado exitosamente a ${planElegido.nombre} (${ciclo.toUpperCase()}). Facturación: $${montoFinal.toLocaleString('es-CO')} COP.`
        };
    }
};
