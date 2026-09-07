// tests/turnos.cierre.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { actions } from '../src/routes/turnos/cierre/+page.server';
import { db } from '../src/lib/server/db';
import { turnos, transacciones_turno as transaccionesTurno, gastos, productos } from '../src/lib/server/schema';
import { eq } from 'drizzle-orm';

const cleanDb = async () => {
  await db.delete(transaccionesTurno).execute();
  await db.delete(gastos).execute();
  await db.delete(turnos).execute();
  await db.update(productos).set({ stock_actual: 100 }).where(eq(productos.id, 1)).execute();
};

beforeEach(async () => {
  await cleanDb();
});

describe('Acción de cierre de turno', () => {
  it('Guarda una transacción completa', async () => {
    const form = new FormData();
    form.set('masas_iniciales', '120');
    form.set('masas_sobrantes', '15');
    form.set('porciones_sobrantes', '30');
    form.set('porciones_mermadas', '5');
    form.set('efectivo', '600000');
    form.set('nequi', '200000');
    form.set('daviplata', '150000');
    form.set('bold', '50000');
    form.set('ref_nequi', 'TXN-NEQ-001');
    form.set('ref_daviplata', '');
    form.set('ref_bold', 'TXN-CARD-123');
    form.append('gasto_descripcion', 'Alquiler');
    form.append('gasto_monto', '300000');
    form.append('gasto_descripcion', 'Limpieza');
    form.append('gasto_monto', '50000');

    const request = { formData: () => Promise.resolve(form) } as unknown as Request;
    const result = await actions.default({ request });
    expect(result.success).toBe(true);
    const turno = await db.select().from(turnos).where(eq(turnos.id, result.data?.turnoId)).get();
    expect(turno?.masas_iniciales).toBe(120);
    expect(turno?.efectivo).toBe(600_000);
    expect(turno?.transferencias).toBe(200_000 + 150_000 + 50_000);
    const trans = await db.select().from(transaccionesTurno).where(eq(transaccionesTurno.turno_id, turno?.id)).all();
    expect(trans).toHaveLength(3);
    const nequiRow = trans.find(t => t.plataforma === 'nequi');
    expect(nequiRow?.monto).toBe(200_000);
    const gastosGuardados = await db.select().from(gastos).where(eq(gastos.turno_id, turno?.id)).all();
    expect(gastosGuardados).toHaveLength(2);
  });

  it('Falla si la suma no coincide con la venta esperada', async () => {
    const form = new FormData();
    form.set('masas_iniciales', '100');
    form.set('masas_sobrantes', '10');
    form.set('porciones_sobrantes', '0');
    form.set('porciones_mermadas', '0');
    form.set('efectivo', '500000');
    form.set('nequi', '0');
    form.set('daviplata', '0');
    form.set('bold', '0');

    const request = { formData: () => Promise.resolve(form) } as unknown as Request;
    const result = await actions.default({ request });
    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('La suma de efectivo + transferencias no coincide');
  });
});
