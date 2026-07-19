export function getTodayRange() {
    return getRange('diario');
}

export function getRange(type: 'diario' | 'semanal' | 'mensual') {
    const now = new Date();
    const offset = -5; // Hora de Colombia
    
    // Calculamos la hora local en Colombia
    const localTime = new Date(now.getTime() + offset * 3600 * 1000);
    
    // Ajuste de jornada (Business Day): Si son antes de las 4 AM, sigue siendo el día anterior
    const businessTime = new Date(localTime.getTime() - 4 * 3600 * 1000);
    
    const startLocal = new Date(businessTime);
    startLocal.setUTCHours(4, 0, 0, 0); // El día de negocio empieza a las 4 AM

    if (type === 'semanal') {
        const day = startLocal.getUTCDay();
        const diff = startLocal.getUTCDate() - day + (day === 0 ? -6 : 1);
        startLocal.setUTCDate(diff);
    } else if (type === 'mensual') {
        startLocal.setUTCDate(1);
    }

    const start = new Date(startLocal.getTime() - offset * 3600 * 1000);

    const endLocal = new Date(startLocal);
    if (type === 'diario') {
        endLocal.setUTCDate(endLocal.getUTCDate() + 1);
    } else if (type === 'semanal') {
        endLocal.setUTCDate(endLocal.getUTCDate() + 7);
    } else if (type === 'mensual') {
        endLocal.setUTCMonth(endLocal.getUTCMonth() + 1);
    }

    const end = new Date(endLocal.getTime() - offset * 3600 * 1000);

    return { start, end };
}
