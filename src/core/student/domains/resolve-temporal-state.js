// src/core/student/domains/resolve-temporal-state.js
// Función canónica para resolver estado temporal de ítems de dominio
//
// REGLA OBLIGATORIA:
// D = días desde last_cleaned_at
// R = recurrence_days
// - D ≤ R → 'clean'
// - R < D ≤ 2R → 'pending'
// - D > 2R → 'critical'
//
// Esta función:
// - NO vive en UI
// - NO se duplica
// - Se usa en TODOS los dominios

/**
 * Resuelve el estado temporal de un ítem de dominio
 * 
 * @param {Object} params - Parámetros
 * @param {Date|string|null} params.last_cleaned_at - Fecha de última limpieza (ISO string o Date)
 * @param {number|null} params.recurrence_days - Días de recurrencia recomendados
 * @param {Date} [params.now] - Fecha actual (default: new Date())
 * @returns {'clean' | 'pending' | 'critical'} Estado temporal
 */
export function resolveTemporalState({ last_cleaned_at, recurrence_days, now = new Date() }) {
  // Si nunca se ha limpiado, es critical
  if (!last_cleaned_at) {
    return 'critical';
  }

  // Si no hay recurrencia definida, asumir que está clean (no hay criterio)
  if (!recurrence_days || recurrence_days <= 0) {
    return 'clean';
  }

  // Calcular días desde última limpieza
  const lastCleaned = typeof last_cleaned_at === 'string' 
    ? new Date(last_cleaned_at) 
    : last_cleaned_at;
  
  const nowDate = typeof now === 'string' ? new Date(now) : now;
  
  // Calcular diferencia en días (redondeo hacia abajo)
  const diffMs = nowDate.getTime() - lastCleaned.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Aplicar regla canónica
  if (diffDays <= recurrence_days) {
    return 'clean';
  } else if (diffDays <= 2 * recurrence_days) {
    return 'pending';
  } else {
    return 'critical';
  }
}

/**
 * Formatea "Hace X días" de forma humana
 * 
 * @param {Date|string|null} lastCleanedAt - Fecha de última limpieza
 * @param {Date} [now] - Fecha actual (default: new Date())
 * @returns {string} Texto formateado ("Hoy", "Hace 3 días", etc.)
 */
export function formatDaysAgo(lastCleanedAt, now = new Date()) {
  if (!lastCleanedAt) {
    return 'Nunca';
  }

  const lastCleaned = typeof lastCleanedAt === 'string' 
    ? new Date(lastCleanedAt) 
    : lastCleanedAt;
  
  const nowDate = typeof now === 'string' ? new Date(now) : now;
  
  const diffMs = nowDate.getTime() - lastCleaned.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'Hoy';
  } else if (diffDays === 1) {
    return 'Hace 1 día';
  } else {
    return `Hace ${diffDays} días`;
  }
}


