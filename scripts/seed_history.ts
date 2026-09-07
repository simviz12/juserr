import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { productos, turnos, movimientosInventario, cierresDia, gastos } from '../src/lib/server/schema';
import { eq } from 'drizzle-orm';
import 'dotenv/config';

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

async function seedHistory() {
  console.log("=== INICIANDO CARGA DE DATOS HISTÓRICOS ===");
  try {
    // Buscar el ID del producto Masas
    let masaId;
    let productoMasa = await db.select().from(productos).where(eq(productos.nombre, 'Masas')).limit(1);
    
    if (productoMasa.length === 0) {
      const result = await db.insert(productos).values({
        nombre: 'Masas',
        categoriaId: null,
        precio: '0',
        stockActual: 0,
        stockMinimo: 10,
        unidadMedida: 'unidad'
      }).returning({ id: productos.id });
      masaId = result[0].id;
    } else {
      masaId = productoMasa[0].id;
      // Reiniciar stock a 0 para el experimento
      await db.update(productos).set({ stockActual: 0 }).where(eq(productos.id, masaId));
    }

    // Funciones auxiliares
    const registrarBodega = async (cantidad: number, fechaStr: string) => {
      const fecha = new Date(fechaStr);
      await db.insert(movimientosInventario).values({
        productoId: masaId,
        tipo: 'entrada',
        cantidad,
        motivo: 'Compra a proveedor',
        fecha,
        usuarioId: null
      });
      // Actualizar stock virtualmente
      const prod = await db.select().from(productos).where(eq(productos.id, masaId)).limit(1);
      await db.update(productos).set({ stockActual: prod[0].stockActual + cantidad }).where(eq(productos.id, masaId));
    };

    const registrarTurno = async (masasGastadas: number, porcAyer: number, porcSobrantes: number, fechaStr: string, extras: number = 0, gastosTurno: number = 0) => {
      const fecha = new Date(fechaStr);
      const prod = await db.select().from(productos).where(eq(productos.id, masaId)).limit(1);
      const masasIniciales = prod[0].stockActual;
      const masasSobrantes = masasIniciales - masasGastadas;

      const porcionesVendidas = (masasGastadas * 8) + porcAyer - porcSobrantes;
      const ventaEsperada = porcionesVendidas * 7000;
      const efectivo = ventaEsperada + extras; // Efectivo declarado (puede incluir ventas de gaseosas si extras > 0)

      if (gastosTurno > 0) {
        await db.insert(gastos).values({
          monto: gastosTurno.toString(),
          descripcion: 'Gasto de turno',
          categoria: 'Operativo',
          fecha,
          usuarioId: null
        });
      }

      await db.insert(turnos).values({
        fecha,
        usuarioId: null,
        monto: (efectivo - gastosTurno).toString(), // Lo que queda físico en caja
        transferencias: '0',
        masasIniciales,
        masasSobrantes,
        porcionesAyer: porcAyer,
        porcionesSobrantes: porcSobrantes,
        porcionesVendidasCalculado: porcionesVendidas,
      });

      await db.update(productos).set({ stockActual: masasSobrantes }).where(eq(productos.id, masaId));
      return { efectivo: efectivo - gastosTurno, gastos: gastosTurno };
    };

    const registrarCierreDia = async (totalEfe: number, totalGas: number, fechaStr: string) => {
      const fecha = new Date(fechaStr);
      await db.insert(cierresDia).values({
        fecha,
        totalEfectivo: totalEfe.toString(),
        totalTransferencias: '0',
        totalGastos: totalGas.toString()
      });
    };

    // --- ESCENARIO DE DATOS ---

    // DÍA 1: Hace 3 días
    let d1 = new Date(); d1.setDate(d1.getDate() - 3); d1.setHours(10);
    console.log("Generando Día 1...");
    await registrarBodega(100, d1.toISOString()); // Llegan 100 masas
    
    d1.setHours(16); // Cierre turno tarde
    let t1 = await registrarTurno(30, 0, 4, d1.toISOString(), 15000, 20000); // gasta 30 masas, sobran 4 porc. Gaseosas: 15k. Gastos: 20k
    
    d1.setHours(23); // Cierre turno noche
    let t2 = await registrarTurno(40, 4, 2, d1.toISOString(), 25000, 0); // gasta 40 masas, sobran 2 porc. Gaseosas: 25k.
    
    d1.setHours(23, 59); // Cierre de día
    await registrarCierreDia(t1.efectivo + t2.efectivo, t1.gastos + t2.gastos, d1.toISOString());


    // DÍA 2: Hace 2 días
    let d2 = new Date(); d2.setDate(d2.getDate() - 2); d2.setHours(16);
    console.log("Generando Día 2...");
    // No hubo compra a proveedor. Usan lo que hay.
    let t3 = await registrarTurno(15, 2, 6, d2.toISOString(), 5000, 0); 
    
    d2.setHours(23);
    let t4 = await registrarTurno(10, 6, 0, d2.toISOString(), 10000, 50000); 
    
    d2.setHours(23, 59);
    await registrarCierreDia(t3.efectivo + t4.efectivo, t3.gastos + t4.gastos, d2.toISOString());


    // DÍA 3: Ayer
    let d3 = new Date(); d3.setDate(d3.getDate() - 1); d3.setHours(9);
    console.log("Generando Día 3...");
    await registrarBodega(50, d3.toISOString()); // Llegan 50 masas
    
    d3.setHours(23); // Solo hubo un turno largo
    let t5 = await registrarTurno(35, 0, 5, d3.toISOString(), 50000, 0);
    
    d3.setHours(23, 59);
    await registrarCierreDia(t5.efectivo, t5.gastos, d3.toISOString());


    // DÍA 4: HOY
    let d4 = new Date(); d4.setHours(15);
    console.log("Generando Día 4 (HOY)...");
    await registrarBodega(30, d4.toISOString()); // Llegaron 30 masas urgentes hoy
    
    d4.setHours(17);
    let t6 = await registrarTurno(20, 5, 2, d4.toISOString(), 0, 10000); // Cierre recién hecho.

    console.log("=== DATOS CARGADOS CON ÉXITO ===");
    process.exit(0);

  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

seedHistory();
