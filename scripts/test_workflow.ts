import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { productos, turnos, movimientosInventario, cierresDia } from '../src/lib/server/schema';
import { eq } from 'drizzle-orm';
import 'dotenv/config';

// Conexión directa para scripts fuera de Svelte
const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

async function runTests() {
  console.log("=== INICIANDO PRUEBAS DE INYECCIÓN DE DATOS ===");

  try {
    console.log("1. Preparando entorno...");

    // 1. Bodega: Ingresar 10 masas nuevas
    console.log("2. Simulando ingreso de bodega (10 masas)...");
    let productoMasa = await db.select().from(productos).where(eq(productos.nombre, 'Masas')).limit(1);
    
    let masaId;
    if (productoMasa.length === 0) {
      const result = await db.insert(productos).values({
        nombre: 'Masas',
        categoriaId: null,
        precio: '0',
        stockActual: 10,
        stockMinimo: 5,
        unidadMedida: 'unidad'
      }).returning({ id: productos.id });
      masaId = result[0].id;
    } else {
      masaId = productoMasa[0].id;
      await db.update(productos)
        .set({ stockActual: productoMasa[0].stockActual + 10 })
        .where(eq(productos.id, masaId));
    }

    await db.insert(movimientosInventario).values({
      productoId: masaId,
      tipo: 'entrada',
      cantidad: 10,
      motivo: 'Compra de prueba automatizada',
      fecha: new Date(),
      usuarioId: null
    });
    console.log("✅ Bodega actualizada correctamente.");

    // 2. Obtener el stock actual antes del turno
    const stockAntes = await db.select().from(productos).where(eq(productos.id, masaId)).limit(1);
    const masasIniciales = stockAntes[0].stockActual;
    console.log(`Stock antes del turno: ${masasIniciales} masas.`);

    // 3. Simular Cierre de Turno
    console.log("3. Simulando Cierre de Turno...");
    const masasSobrantes = masasIniciales - 2; // Se gastaron 2 masas (16 porciones)
    const porcionesAyer = 0;
    const porcionesSobrantes = 2; // Quedaron 2 porciones en vitrina
    const precioPorcion = 7000;

    // Cálculo matemático del sistema
    const porcionesVendidas = ((masasIniciales - masasSobrantes) * 8) + porcionesAyer - porcionesSobrantes;
    const ventaEsperada = porcionesVendidas * precioPorcion;
    
    console.log(`Cálculo del sistema: Se gastaron 2 masas. Ventas esperadas: ${porcionesVendidas} porciones ($${ventaEsperada}).`);

    // El cajero declara tener exactamente lo esperado, más 5000 de gaseosa
    const montoDeclarado = ventaEsperada + 5000;

    const turnoInsertado = await db.insert(turnos).values({
      fecha: new Date(),
      usuarioId: null,
      monto: montoDeclarado.toString(),
      transferencias: '0',
      masasIniciales: masasIniciales,
      masasSobrantes: masasSobrantes,
      porcionesAyer: porcionesAyer,
      porcionesSobrantes: porcionesSobrantes,
      porcionesVendidasCalculado: porcionesVendidas,
    }).returning({ id: turnos.id });

    // Actualizar inventario por el turno
    await db.update(productos)
      .set({ stockActual: masasSobrantes })
      .where(eq(productos.id, masaId));

    console.log(`✅ Turno cerrado con éxito. Stock actual de masas en base de datos: ${masasSobrantes}.`);

    // 4. Simular Cierre de Día (Agrupación)
    console.log("4. Simulando Cierre de Día (Agrupación Financiera)...");
    await db.insert(cierresDia).values({
      fecha: new Date(),
      totalEfectivo: montoDeclarado.toString(),
      totalTransferencias: '0',
      totalGastos: '0'
    });
    console.log("✅ Cierre de día guardado.");

    console.log("=== TODAS LAS PRUEBAS PASARON CORRECTAMENTE ===");
    process.exit(0);

  } catch (error) {
    console.error("❌ ERROR EN LAS PRUEBAS:", error);
    process.exit(1);
  }
}

runTests();
