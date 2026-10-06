export function formatFraction(value: number): string {
  if (value === 0 || isNaN(value)) return '0';
  
  const whole = Math.floor(value);
  const decimal = Number((value - whole).toFixed(4));
  
  // Margen de tolerancia para punto flotante
  const tolerance = 0.02;
  
  let fractionString = '';
  
  if (Math.abs(decimal - 0.125) < tolerance) fractionString = '1/8';
  else if (Math.abs(decimal - 0.25) < tolerance) fractionString = '1/4';
  else if (Math.abs(decimal - 0.333) < tolerance || Math.abs(decimal - 0.33) < tolerance) fractionString = '1/3';
  else if (Math.abs(decimal - 0.375) < tolerance) fractionString = '3/8';
  else if (Math.abs(decimal - 0.5) < tolerance) fractionString = '1/2';
  else if (Math.abs(decimal - 0.625) < tolerance) fractionString = '5/8';
  else if (Math.abs(decimal - 0.666) < tolerance || Math.abs(decimal - 0.66) < tolerance) fractionString = '2/3';
  else if (Math.abs(decimal - 0.75) < tolerance) fractionString = '3/4';
  else if (Math.abs(decimal - 0.875) < tolerance) fractionString = '7/8';
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

export function parseFraction(input: string): number {
  if (!input || input.trim() === '') return NaN;
  
  const trimmed = input.trim();
  
  // Manejo de caracteres unicode especiales
  const unicodeFractions: Record<string, number> = {
    '¼': 0.25,
    '½': 0.5,
    '¾': 0.75,
    '⅓': 1/3,
    '⅔': 2/3
  };

  // Check si el string exacto es solo el caracter unicode
  if (unicodeFractions[trimmed] !== undefined) {
    return unicodeFractions[trimmed];
  }

  // Check si contiene un entero + caracter unicode (e.g. "2 ½")
  for (const [char, val] of Object.entries(unicodeFractions)) {
    if (trimmed.includes(char)) {
      const wholePart = trimmed.replace(char, '').trim();
      const wholeNum = parseFloat(wholePart || '0');
      if (!isNaN(wholeNum)) return wholeNum + val;
    }
  }

  // Manejo de texto con espacio: "2 1/2"
  if (trimmed.includes(' ') && trimmed.includes('/')) {
    const parts = trimmed.split(' ');
    let total = 0;
    for (const part of parts) {
      if (part.includes('/')) {
        const [num, den] = part.split('/');
        if (num && den) total += parseFloat(num) / parseFloat(den);
      } else {
        total += parseFloat(part);
      }
    }
    return total;
  }

  // Manejo de texto sin espacio: "1/2"
  if (trimmed.includes('/')) {
    const [num, den] = trimmed.split('/');
    if (num && den) return parseFloat(num) / parseFloat(den);
  }

  // Numero regular ("2", "2.5", "2,5")
  return parseFloat(trimmed.replace(',', '.'));
}
