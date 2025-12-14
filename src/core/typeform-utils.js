// src/core/typeform-utils.js
// Utilidades para construir URLs de Typeform con hidden fields

/**
 * Construye una URL de Typeform con hidden fields para apodo, nivel y fase
 * @param {string} typeformId - ID del Typeform (ej: "Q1LgxtSu" o URL completa)
 * @param {Object} options - Opciones para construir la URL
 * @param {string} options.email - Email del estudiante (opcional, pero recomendado)
 * @param {string} options.apodo - Apodo del estudiante (opcional)
 * @param {number} options.nivel - Nivel del estudiante (opcional)
 * @param {string} options.fase - Fase del nivel del estudiante (opcional)
 * @returns {string} URL completa de Typeform con hidden fields
 */
export function buildTypeformUrl(typeformId, options = {}) {
  const { email, apodo, nivel, fase } = options;
  
  // Extraer el ID del Typeform si viene como URL completa
  let id = typeformId;
  if (typeformId.includes('typeform.com')) {
    // Extraer ID de URLs como "https://pdeeugenihidalgo.typeform.com/to/Q1LgxtSu"
    const match = typeformId.match(/\/to\/([^?#]+)/);
    if (match) {
      id = match[1];
    } else {
      // Si no se puede extraer, usar como está
      id = typeformId;
    }
  }
  
  // Construir URL base
  const baseUrl = `https://pdeeugenihidalgo.typeform.com/to/${id}`;
  
  // Construir parámetros como hidden fields
  const params = new URLSearchParams();
  
  if (email && email.trim() !== '') {
    params.append('email', email.trim());
  }
  
  if (apodo && apodo.trim() !== '') {
    params.append('apodo', apodo.trim());
  }
  
  if (nivel !== undefined && nivel !== null) {
    params.append('nivel', String(nivel));
  }
  
  if (fase && fase.trim() !== '') {
    params.append('fase', fase.trim());
  }
  
  // Construir URL final
  const queryString = params.toString();
  const finalUrl = queryString ? `${baseUrl}?${queryString}` : baseUrl;
  
  console.log(`🔗 URL Typeform construida: ${finalUrl}`);
  
  return finalUrl;
}

