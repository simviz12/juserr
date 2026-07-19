export function getTodayRange() {
    // Vercel usa UTC por defecto. Ajustamos a la hora de Colombia (UTC-5)
    const now = new Date();
    const offset = -5; 
    
    // Calculamos la hora local en Colombia
    const localTime = new Date(now.getTime() + offset * 3600 * 1000);
    
    // Inicio del día en Colombia (00:00:00)
    const startLocal = new Date(localTime);
    startLocal.setUTCHours(0, 0, 0, 0);
    // Convertimos de vuelta a UTC para consultar la base de datos
    const start = new Date(startLocal.getTime() - offset * 3600 * 1000);

    // Fin del día en Colombia (23:59:59)
    const endLocal = new Date(localTime);
    endLocal.setUTCHours(23, 59, 59, 999);
    const end = new Date(endLocal.getTime() - offset * 3600 * 1000);

    return { start, end };
}
