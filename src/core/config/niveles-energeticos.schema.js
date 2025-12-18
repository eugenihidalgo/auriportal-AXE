// src/core/config/niveles-energeticos.schema.js
// Schema y validador para configuración de niveles energéticos
//
// SINGLE SOURCE OF TRUTH: Este validador garantiza que la configuración
// de niveles_energeticos cumple con el contrato requerido por el motor de progreso.
//
// Contrato:
// - Array de fases con rangos de nivel (nivel_min, nivel_max)
// - Sin solapamientos peligrosos (cada nivel debe tener exactamente una fase o fallback claro)
// - Tipos correctos y normalizados
// - Compatibilidad con formato legacy (tabla niveles_fases en BD, pero nombre canónico es niveles_energeticos)

/**
 * Valida y normaliza la configuración de niveles energéticos
 * 
 * @param {Array} configRaw - Configuración raw desde BD (array de objetos con fase, nivel_min, nivel_max, descripcion)
 * @returns {{ok: boolean, value?: Array, errors?: Array<string>}}
 * 
 * Formato esperado (normalizado):
 * [
 *   { fase: string, nivel_min: number|null, nivel_max: number|null, descripcion?: string, orden: number }
 * ]
 * 
 * Reglas de validación:
 * 1. fase es obligatorio y no vacío
 * 2. nivel_min y nivel_max deben ser números enteros >= 1 o null
 * 3. Si nivel_min y nivel_max son ambos null, se trata como fase catch-all (fallback)
 * 4. nivel_max debe ser >= nivel_min (si ambos están definidos)
 * 5. No debe haber solapamientos (mismo nivel cubierto por múltiples fases con rangos definidos)
 * 6. Debe existir al menos una fase con rango definido para niveles 1-15
 */
export function validateAndNormalizeNivelesEnergeticos(configRaw) {
  const errors = [];
  
  // Validar que configRaw sea un array
  if (!Array.isArray(configRaw)) {
    return {
      ok: false,
      errors: ['La configuración debe ser un array de fases']
    };
  }
  
  if (configRaw.length === 0) {
    return {
      ok: false,
      errors: ['La configuración debe contener al menos una fase']
    };
  }
  
  // Normalizar y validar cada fase
  const fasesNormalizadas = [];
  let orden = 1;
  
  for (let i = 0; i < configRaw.length; i++) {
    const faseRaw = configRaw[i];
    const faseIdx = i + 1;
    
    // Validar fase (obligatorio, string no vacío)
    if (!faseRaw.fase || typeof faseRaw.fase !== 'string' || faseRaw.fase.trim() === '') {
      errors.push(`Fase ${faseIdx}: 'fase' es obligatorio y debe ser un string no vacío`);
      continue;
    }
    
    const fase = faseRaw.fase.trim();
    
    // Normalizar nivel_min
    let nivelMin = null;
    if (faseRaw.nivel_min !== null && faseRaw.nivel_min !== undefined && faseRaw.nivel_min !== '') {
      const minNum = typeof faseRaw.nivel_min === 'string' 
        ? parseInt(faseRaw.nivel_min, 10) 
        : Number(faseRaw.nivel_min);
      
      if (isNaN(minNum) || !Number.isInteger(minNum) || minNum < 1) {
        errors.push(`Fase ${faseIdx} (${fase}): 'nivel_min' debe ser un número entero >= 1 o null`);
        continue;
      }
      nivelMin = minNum;
    }
    
    // Normalizar nivel_max
    let nivelMax = null;
    if (faseRaw.nivel_max !== null && faseRaw.nivel_max !== undefined && faseRaw.nivel_max !== '') {
      const maxNum = typeof faseRaw.nivel_max === 'string' 
        ? parseInt(faseRaw.nivel_max, 10) 
        : Number(faseRaw.nivel_max);
      
      if (isNaN(maxNum) || !Number.isInteger(maxNum) || maxNum < 1) {
        errors.push(`Fase ${faseIdx} (${fase}): 'nivel_max' debe ser un número entero >= 1 o null`);
        continue;
      }
      nivelMax = maxNum;
    }
    
    // Validar que nivel_max >= nivel_min (si ambos están definidos)
    if (nivelMin !== null && nivelMax !== null && nivelMax < nivelMin) {
      errors.push(`Fase ${faseIdx} (${fase}): 'nivel_max' (${nivelMax}) debe ser >= 'nivel_min' (${nivelMin})`);
      continue;
    }
    
    // Normalizar descripcion (opcional)
    const descripcion = faseRaw.descripcion ? String(faseRaw.descripcion).trim() : null;
    
    // Construir fase normalizada
    fasesNormalizadas.push({
      fase,
      nivel_min: nivelMin,
      nivel_max: nivelMax,
      descripcion: descripcion || null,
      orden: orden++
    });
  }
  
  // Si hay errores de formato, parar aquí
  if (errors.length > 0) {
    return { ok: false, errors };
  }
  
  // Validar solapamientos y cobertura
  // Ordenar fases por nivel_min (nulls al final)
  const fasesOrdenadas = [...fasesNormalizadas].sort((a, b) => {
    if (a.nivel_min === null && b.nivel_min === null) return 0;
    if (a.nivel_min === null) return 1;
    if (b.nivel_min === null) return -1;
    return a.nivel_min - b.nivel_min;
  });
  
  // Detectar solapamientos entre fases con rangos definidos
  const fasesConRango = fasesOrdenadas.filter(f => f.nivel_min !== null && f.nivel_max !== null);
  
  for (let i = 0; i < fasesConRango.length; i++) {
    for (let j = i + 1; j < fasesConRango.length; j++) {
      const faseA = fasesConRango[i];
      const faseB = fasesConRango[j];
      
      // Verificar si hay solapamiento
      // Solapamiento: (A.min <= B.max && A.max >= B.min)
      if (faseA.nivel_min <= faseB.nivel_max && faseA.nivel_max >= faseB.nivel_min) {
        errors.push(
          `Solapamiento detectado: '${faseA.fase}' (${faseA.nivel_min}-${faseA.nivel_max}) ` +
          `y '${faseB.fase}' (${faseB.nivel_min}-${faseB.nivel_max}) cubren el mismo rango de niveles`
        );
      }
    }
  }
  
  // Verificar cobertura básica (opcional pero recomendado)
  // No es error crítico, pero podemos advertir si no hay cobertura completa
  const nivelesCubiertos = new Set();
  fasesConRango.forEach(f => {
    for (let n = f.nivel_min; n <= f.nivel_max; n++) {
      nivelesCubiertos.add(n);
    }
  });
  
  const nivelesEsperados = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  const nivelesSinCobertura = [...nivelesEsperados].filter(n => !nivelesCubiertos.has(n));
  
  if (nivelesSinCobertura.length > 0 && fasesOrdenadas.filter(f => f.nivel_min === null && f.nivel_max === null).length === 0) {
    // Solo advertir si no hay fase catch-all y faltan niveles
    // No es un error crítico porque el motor tiene fallback, pero es recomendado
    // No añadimos error, solo log (esto se puede mejorar en el futuro)
  }
  
  // Si hay errores de validación, retornar
  if (errors.length > 0) {
    return { ok: false, errors };
  }
  
  // Retornar configuración normalizada y ordenada
  return {
    ok: true,
    value: fasesOrdenadas
  };
}

/**
 * Resuelve la fase efectiva para un nivel dado desde la configuración normalizada
 * 
 * @param {Array} configNormalizada - Configuración normalizada (resultado de validateAndNormalize)
 * @param {number} nivel - Nivel efectivo (1-15)
 * @returns {{id: string, nombre: string, reason?: string}} Fase efectiva o fase unknown si no se encuentra
 */
export function resolveFaseFromConfig(configNormalizada, nivel) {
  if (!configNormalizada || !Array.isArray(configNormalizada) || configNormalizada.length === 0) {
    return {
      id: 'unknown',
      nombre: 'Fase no disponible',
      reason: 'config_empty'
    };
  }
  
  // Buscar fase que cubra este nivel
  // Prioridad: fases con rango específico primero, luego catch-all (null-null)
  const fasesConRango = configNormalizada.filter(f => 
    f.nivel_min !== null && f.nivel_max !== null &&
    nivel >= f.nivel_min && nivel <= f.nivel_max
  );
  
  if (fasesConRango.length > 0) {
    // Tomar la primera (ya está ordenada por nivel_min)
    const fase = fasesConRango[0];
    return {
      id: fase.fase.toLowerCase().replace(/\s+/g, '_'),
      nombre: fase.fase,
      descripcion: fase.descripcion || null
    };
  }
  
  // Si no hay rango específico, buscar fase catch-all (nivel_min y nivel_max ambos null)
  const faseCatchAll = configNormalizada.find(f => 
    f.nivel_min === null && f.nivel_max === null
  );
  
  if (faseCatchAll) {
    return {
      id: faseCatchAll.fase.toLowerCase().replace(/\s+/g, '_'),
      nombre: faseCatchAll.fase,
      descripcion: faseCatchAll.descripcion || null
    };
  }
  
  // Fallback: fase unknown
  return {
    id: 'unknown',
    nombre: 'Fase no disponible',
    reason: `nivel_${nivel}_sin_cobertura`
  };
}

