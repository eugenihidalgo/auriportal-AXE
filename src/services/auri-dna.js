// src/services/auri-dna.js
// Servicio para generar AURI-DNA (código numerológico interno)

/**
 * Genera el código AURI-DNA basado en datos del alumno
 * @param {Object} datosAlumno - Datos del alumno
 * @returns {Promise<string>}
 */
export async function generarCodigoAURI(datosAlumno) {
  try {
    const { 
      nombre_completo, 
      fecha_nacimiento, 
      lugar_nacimiento,
      email 
    } = datosAlumno;

    // Extraer componentes numéricos
    const fecha = fecha_nacimiento ? new Date(fecha_nacimiento) : new Date();
    const año = fecha.getFullYear();
    const mes = fecha.getMonth() + 1;
    const dia = fecha.getDate();

    // Calcular suma de fecha
    const sumaFecha = año + mes + dia;
    
    // Calcular suma de nombre (valor numérico de letras)
    let sumaNombre = 0;
    if (nombre_completo) {
      const nombreLimpio = nombre_completo.toUpperCase().replace(/[^A-Z]/g, '');
      for (let i = 0; i < nombreLimpio.length; i++) {
        sumaNombre += nombreLimpio.charCodeAt(i) - 64; // A=1, B=2, etc.
      }
    } else if (email) {
      // Usar email si no hay nombre
      const emailLimpio = email.split('@')[0].toUpperCase().replace(/[^A-Z]/g, '');
      for (let i = 0; i < emailLimpio.length; i++) {
        sumaNombre += emailLimpio.charCodeAt(i) - 64;
      }
    }

    // Reducir a un solo dígito (numerología)
    const reducir = (num) => {
      while (num > 9 && num !== 11 && num !== 22 && num !== 33) {
        num = num.toString().split('').reduce((sum, digit) => sum + parseInt(digit), 0);
      }
      return num;
    };

    const fechaReducida = reducir(sumaFecha);
    const nombreReducido = reducir(sumaNombre);
    
    // Código final: AURI-[FECHA]-[NOMBRE]-[HASH]
    const hash = Math.abs((sumaFecha + sumaNombre) % 10000).toString().padStart(4, '0');
    const codigo = `AURI-${fechaReducida}-${nombreReducido}-${hash}`;

    return codigo;
  } catch (error) {
    console.error('Error generando código AURI:', error);
    // Código por defecto basado en timestamp
    return `AURI-${Date.now().toString().slice(-8)}`;
  }
}

/**
 * Valida si un código AURI es válido
 * @param {string} codigo 
 * @returns {boolean}
 */
export function validarCodigoAURI(codigo) {
  if (!codigo) return false;
  const pattern = /^AURI-\d+-\d+-\d{4}$/;
  return pattern.test(codigo);
}



