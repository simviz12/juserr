import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { 
  usuarios, pizzaSabores, bebidas, categorias, productos, 
  movimientosInventario, movimientosBebidas, pizzaRuedas, pizzaSobras, 
  pizzaVentas, turnos, transaccionesTurno, gastos, cierresDia, cortesSemanales, sesiones 
} from './schema';
import * as dotenv from 'dotenv';
import * as argon2 from '@node-rs/argon2';
dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

const sql = neon(process.env.DATABASE_URL);
const db = drizzle(sql);

async function simular4DiasFlujoCompleto() {
  console.log('🚀 Iniciando inyección y simulación de 4 días de operación real en JuanchoPizza...');

  // 1. Limpieza total previa
  await db.delete(cortesSemanales);
  await db.delete(cierresDia);
  await db.delete(gastos);
  await db.delete(transaccionesTurno);
  await db.delete(pizzaVentas);
  await db.delete(pizzaSobras);
  await db.delete(pizzaRuedas);
  await db.delete(turnos);
  await db.delete(movimientosBebidas);
  await db.delete(movimientosInventario);
  await db.delete(sesiones);
  await db.delete(productos);
  await db.delete(categorias);
  await db.delete(bebidas);
  await db.delete(pizzaSabores);
  await db.delete(usuarios);

  // 2. Usuarios del sistema
  const defaultPassword = await argon2.hash('password123');
  const [jefe] = await db.insert(usuarios).values([
    { nombre: 'Gabo', rol: 'jefe', passwordHash: defaultPassword }
  ]).returning();
  const [emp1] = await db.insert(usuarios).values([
    { nombre: 'Carlos Empleado', rol: 'empleado', passwordHash: defaultPassword }
  ]).returning();

  // 3. Sabores de pizza
  const [sabHaw] = await db.insert(pizzaSabores).values([
    { nombre: 'Hawaiana', precioPorcion: '5000', precioRueda: '38000', activo: true }
  ]).returning();
  const [sabPep] = await db.insert(pizzaSabores).values([
    { nombre: 'Pepperoni', precioPorcion: '5000', precioRueda: '38000', activo: true }
  ]).returning();
  const [sabPol] = await db.insert(pizzaSabores).values([
    { nombre: 'Pollo Champiñones', precioPorcion: '5500', precioRueda: '42000', activo: true }
  ]).returning();

  // 4. Bebidas
  const [coca] = await db.insert(bebidas).values([
    { nombre: 'Coca Cola 400ml', precio: '3500', stockActual: 18 }
  ]).returning();
  const [jugo] = await db.insert(bebidas).values([
    { nombre: 'Jugo Hit Mora', precio: '3000', stockActual: 12 }
  ]).returning();
  const [agua] = await db.insert(bebidas).values([
    { nombre: 'Agua Cristal 600ml', precio: '2500', stockActual: 14 }
  ]).returning();

  // 5. Categorías
  const [catLacteos] = await db.insert(categorias).values([{ nombre: 'Lácteos' }]).returning();
  const [catCarnicos] = await db.insert(categorias).values([{ nombre: 'Cárnicos' }]).returning();
  const [catVegetales] = await db.insert(categorias).values([{ nombre: 'Vegetales y Frutas' }]).returning();
  const [catMasa] = await db.insert(categorias).values([{ nombre: 'Bases y Panadería' }]).returning();

  // 6. Productos / Insumos
  const [pMasa] = await db.insert(productos).values([
    { nombre: 'Masa', categoriaId: catMasa.id, unidadMedida: 'unidad', stockActual: 10, precio: '0', precioCosto: '4500' }
  ]).returning();
  const [pPizzaPorc] = await db.insert(productos).values([
    { nombre: 'Pizza (Porciones)', categoriaId: catMasa.id, unidadMedida: 'porcion', stockActual: 6, precio: '5000', precioCosto: '1500' }
  ]).returning();
  const [pQueso] = await db.insert(productos).values([
    { nombre: 'Queso Mozzarella', categoriaId: catLacteos.id, unidadMedida: 'fraccion', stockActual: 3.5, precio: '0', precioCosto: '28000' }
  ]).returning();
  const [pPina] = await db.insert(productos).values([
    { nombre: 'Tarro Piña Calada', categoriaId: catVegetales.id, unidadMedida: 'fraccion', stockActual: 2.25, precio: '0', precioCosto: '16000' }
  ]).returning();
  const [pPollo] = await db.insert(productos).values([
    { nombre: 'Pechuga Desmechada', categoriaId: catCarnicos.id, unidadMedida: 'pechuga', stockActual: 4, precio: '0', precioCosto: '14000' }
  ]).returning();
  const [pMaiz] = await db.insert(productos).values([
    { nombre: 'Maíz Dulce', categoriaId: catVegetales.id, unidadMedida: 'fraccion', stockActual: 1.125, precio: '0', precioCosto: '9500' }
  ]).returning();

  // -------------------------------------------------------------
  // FECHAS DE LOS 4 DÍAS DE TRABAJO (Oct 08, 09, 10, 11)
  // -------------------------------------------------------------
  const d1 = new Date('2026-10-08T22:30:00Z');
  const d2 = new Date('2026-10-09T22:45:00Z');
  const d3 = new Date('2026-10-10T23:00:00Z');
  const d4 = new Date('2026-10-11T22:15:00Z');

  // REGISTROS DE COMPRAS EN BODEGA DURANTE ESTOS DÍAS
  // Día 1 compra inicial
  await db.insert(movimientosInventario).values([
    { productoId: pMasa.id, usuarioId: jefe.id, tipo: 'entrada', cantidad: 30, costoUnitario: '4500', costoTotal: '135000', fecha: new Date('2026-10-08T10:00:00Z') },
    { productoId: pQueso.id, usuarioId: jefe.id, tipo: 'entrada', cantidad: 8, costoUnitario: '28000', costoTotal: '224000', fecha: new Date('2026-10-08T10:15:00Z') },
    { productoId: pPina.id, usuarioId: jefe.id, tipo: 'entrada', cantidad: 5, costoUnitario: '16000', costoTotal: '80000', fecha: new Date('2026-10-08T10:20:00Z') },
    { productoId: pPollo.id, usuarioId: jefe.id, tipo: 'entrada', cantidad: 10, costoUnitario: '14000', costoTotal: '140000', fecha: new Date('2026-10-08T10:30:00Z') },
    { productoId: pMaiz.id, usuarioId: jefe.id, tipo: 'entrada', cantidad: 4, costoUnitario: '9500', costoTotal: '38000', fecha: new Date('2026-10-08T10:40:00Z') }
  ]);

  // Día 3 reposición de insumos
  await db.insert(movimientosInventario).values([
    { productoId: pMasa.id, usuarioId: jefe.id, tipo: 'entrada', cantidad: 20, costoUnitario: '4500', costoTotal: '90000', fecha: new Date('2026-10-10T09:30:00Z') },
    { productoId: pQueso.id, usuarioId: jefe.id, tipo: 'entrada', cantidad: 4, costoUnitario: '28000', costoTotal: '112000', fecha: new Date('2026-10-10T09:45:00Z') }
  ]);

  // Movimientos de bebidas (llegaron cajas)
  await db.insert(movimientosBebidas).values([
    { bebidaId: coca.id, usuarioId: jefe.id, tipo: 'entrada', cantidad: 30, fecha: new Date('2026-10-08T11:00:00Z') },
    { bebidaId: jugo.id, usuarioId: jefe.id, tipo: 'entrada', cantidad: 20, fecha: new Date('2026-10-08T11:00:00Z') },
    { bebidaId: agua.id, usuarioId: jefe.id, tipo: 'entrada', cantidad: 20, fecha: new Date('2026-10-08T11:00:00Z') },
    // Ventas acumuladas de bebidas
    { bebidaId: coca.id, usuarioId: emp1.id, tipo: 'venta', cantidad: 12, fecha: d1 },
    { bebidaId: jugo.id, usuarioId: emp1.id, tipo: 'venta', cantidad: 8, fecha: d2 },
    { bebidaId: agua.id, usuarioId: emp1.id, tipo: 'venta', cantidad: 6, fecha: d3 }
  ]);

  // -------------------------------------------------------------
  // DÍA 1: Jueves 08 de Octubre
  // Masas iniciales: 20, Masas sobrantes: 12 (Se hornearon 8 masas = 64 porciones)
  // Porciones de ayer en vitrina: 0
  // Porciones que sobraron hoy en vitrina: 6
  // Mermas: 0
  // Porciones vendidas: (0 + 64) - 6 = 58 porciones
  // Efectivo: $220.000 | Nequi: $90.000 | Total Bruto: $310.000 | Gasto turno: $15.000 (servilletas y hielo)
  // -------------------------------------------------------------
  const [t1] = await db.insert(turnos).values([
    {
      monto: '220000',
      transferencias: '90000',
      descripcion: 'Turno Día 1 Jueves - Arranque exitoso',
      fecha: d1,
      masasIniciales: 20,
      masasSobrantes: 12,
      porcionesAyer: 0,
      porcionesSobrantes: 6,
      porcionesMermadas: 0,
      porcionesVendidasCalculado: 58
    }
  ]).returning();

  await db.insert(transaccionesTurno).values([
    { turnoId: t1.id, plataforma: 'nequi', monto: '65000', referencias: 'M12948', fecha: d1 },
    { turnoId: t1.id, plataforma: 'daviplata', monto: '25000', referencias: 'D8841', fecha: d1 }
  ]);
  await db.insert(gastos).values([
    { turnoId: t1.id, descripcion: 'Hielo bolsa grande y servilletas', monto: '15000', fecha: d1 }
  ]);
  await db.insert(cierresDia).values([
    {
      fecha: d1,
      totalEfectivo: '220000',
      totalTransferencias: '90000',
      totalTurnos: '310000',
      totalGastos: '15000'
    }
  ]);

  // -------------------------------------------------------------
  // DÍA 2: Viernes 09 de Octubre (Mayor movimiento)
  // Masas iniciales: 25, Masas sobrantes: 14 (Se hornearon 11 masas = 88 porciones)
  // Porciones de ayer (del Día 1): 6
  // Porciones sobrantes hoy en vitrina: 8
  // Mermas: 1
  // Porciones vendidas: (6 + 88) - 8 - 1 = 85 porciones
  // Efectivo: $310.000 | Nequi: $140.000 | Total Bruto: $450.000 | Gasto turno: $22.000 (gas pimienta y bolsas)
  // -------------------------------------------------------------
  const [t2] = await db.insert(turnos).values([
    {
      monto: '310000',
      transferencias: '140000',
      descripcion: 'Turno Día 2 Viernes - Excelente flujo nocturno',
      fecha: d2,
      masasIniciales: 25,
      masasSobrantes: 14,
      porcionesAyer: 6,
      porcionesSobrantes: 8,
      porcionesMermadas: 1,
      porcionesVendidasCalculado: 85
    }
  ]).returning();

  await db.insert(transaccionesTurno).values([
    { turnoId: t2.id, plataforma: 'nequi', monto: '100000', referencias: 'N38192, N99120', fecha: d2 },
    { turnoId: t2.id, plataforma: 'bold', monto: '40000', referencias: 'Tarjeta Bold B-102', fecha: d2 }
  ]);
  await db.insert(gastos).values([
    { turnoId: t2.id, descripcion: 'Bolsas para llevar y gaseosa personal', monto: '22000', fecha: d2 }
  ]);
  await db.insert(cierresDia).values([
    {
      fecha: d2,
      totalEfectivo: '310000',
      totalTransferencias: '140000',
      totalTurnos: '450000',
      totalGastos: '22000'
    }
  ]);

  // -------------------------------------------------------------
  // DÍA 3: Sábado 10 de Octubre (Día pico)
  // Masas iniciales: 28, Masas sobrantes: 13 (Se hornearon 15 masas = 120 porciones)
  // Porciones de ayer (del Día 2): 8
  // Porciones sobrantes hoy en vitrina: 10
  // Mermas: 2
  // Porciones vendidas: (8 + 120) - 10 - 2 = 116 porciones
  // Efectivo: $425.000 | Nequi: $215.000 | Total Bruto: $640.000 | Gasto turno: $30.000 (Domicilios y empaques)
  // -------------------------------------------------------------
  const [t3] = await db.insert(turnos).values([
    {
      monto: '425000',
      transferencias: '215000',
      descripcion: 'Turno Día 3 Sábado - Día pico con promociones',
      fecha: d3,
      masasIniciales: 28,
      masasSobrantes: 13,
      porcionesAyer: 8,
      porcionesSobrantes: 10,
      porcionesMermadas: 2,
      porcionesVendidasCalculado: 116
    }
  ]).returning();

  await db.insert(transaccionesTurno).values([
    { turnoId: t3.id, plataforma: 'nequi', monto: '160000', referencias: 'NQ8721, NQ9920, NQ1123', fecha: d3 },
    { turnoId: t3.id, plataforma: 'daviplata', monto: '55000', referencias: 'DP-4401', fecha: d3 }
  ]);
  await db.insert(gastos).values([
    { turnoId: t3.id, descripcion: 'Pago apoyo domiciliario y desinfectante', monto: '30000', fecha: d3 }
  ]);
  await db.insert(cierresDia).values([
    {
      fecha: d3,
      totalEfectivo: '425000',
      totalTransferencias: '215000',
      totalTurnos: '640000',
      totalGastos: '30000'
    }
  ]);

  // -------------------------------------------------------------
  // DÍA 4: Domingo 11 de Octubre (Cierre de semana)
  // Masas iniciales: 22, Masas sobrantes: 10 (Se hornearon 12 masas = 96 porciones)
  // Porciones de ayer (del Día 3): 10
  // Porciones sobrantes hoy en vitrina: 6
  // Mermas: 1
  // Porciones vendidas: (10 + 96) - 6 - 1 = 99 porciones
  // Efectivo: $360.000 | Nequi: $170.000 | Total Bruto: $530.000 | Gasto turno: $18.000 (Cajas pizza y esponjas)
  // -------------------------------------------------------------
  const [t4] = await db.insert(turnos).values([
    {
      monto: '360000',
      transferencias: '170000',
      descripcion: 'Turno Día 4 Domingo - Cierre semanal con balance positivo',
      fecha: d4,
      masasIniciales: 22,
      masasSobrantes: 10,
      porcionesAyer: 10,
      porcionesSobrantes: 6,
      porcionesMermadas: 1,
      porcionesVendidasCalculado: 99
    }
  ]).returning();

  await db.insert(transaccionesTurno).values([
    { turnoId: t4.id, plataforma: 'nequi', monto: '120000', referencias: 'NQ-3091', fecha: d4 },
    { turnoId: t4.id, plataforma: 'bold', monto: '50000', referencias: 'TB-9921', fecha: d4 }
  ]);
  await db.insert(gastos).values([
    { turnoId: t4.id, descripcion: 'Cajas de pizza para llevar y esponjas', monto: '18000', fecha: d4 }
  ]);
  await db.insert(cierresDia).values([
    {
      fecha: d4,
      totalEfectivo: '360000',
      totalTransferencias: '170000',
      totalTurnos: '530000',
      totalGastos: '18000'
    }
  ]);

  // CORTE SEMANAL REGISTRADO (Consolidado de los 4 días)
  // Total Bruto: 310.000 + 450.000 + 640.000 + 530.000 = $1.930.000
  // Total Gastos: 15.000 + 22.000 + 30.000 + 18.000 = $85.000
  // Utilidad Neta: $1.845.000
  // Efectivo Real en caja: $1.315.000 | Nequi/Transferencias: $615.000
  await db.insert(cortesSemanales).values([
    {
      fechaCorte: d4,
      totalCalculado: '1930000',
      totalReal: '1930000',
      efectivoReal: '1315000',
      transferenciasReales: '615000',
      diferencia: '0',
      rangoInicio: new Date('2026-10-08T00:00:00Z'),
      rangoFin: d4
    }
  ]);

  console.log('✅ Simulación completada con éxito. 4 días de trabajo inyectados con coherencia total.');
}

simular4DiasFlujoCompleto().catch((e) => {
  console.error('Error inyectando simulación:', e);
  process.exit(1);
});
