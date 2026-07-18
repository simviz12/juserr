export function formatFraction(value: number): string {
  if (value === 0) return '0';
  
  const whole = Math.floor(value);
  const decimal = value - whole;
  
  // Margen de tolerancia para punto flotante
  const tolerance = 0.01;
  
  let fractionString = '';
  
  if (Math.abs(decimal - 0.25) < tolerance) fractionString = '¼';
  else if (Math.abs(decimal - 0.5) < tolerance) fractionString = '½';
  else if (Math.abs(decimal - 0.75) < tolerance) fractionString = '¾';
  else if (Math.abs(decimal - 0.33) < tolerance) fractionString = '⅓';
  else if (Math.abs(decimal - 0.66) < tolerance) fractionString = '⅔';
  else if (decimal > tolerance) {
      // Si no es una fracción conocida, lo dejamos con hasta 2 decimales
      return value.toLocaleString('es-CO', { maximumFractionDigits: 2 });
  }

  if (whole === 0) {
      return fractionString || '0';
  }

  return fractionString ? `${whole} ${fractionString}` : whole.toString();
}

export function displayStock(value: number | null, type: string): string {
  if (value === null || value === undefined) return '0';
  if (type === 'fraccion') {
      return formatFraction(value);
  }
  return value.toLocaleString('es-CO', { maximumFractionDigits: 2 });
}
