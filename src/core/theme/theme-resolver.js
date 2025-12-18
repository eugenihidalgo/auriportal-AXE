// theme-resolver.js
// Theme Resolver v1 - Motor único, puro y determinista de resolución de temas
// PRINCIPIOS:
// 1. Single source of truth: solo el resolver decide el tema
// 2. Función pura: mismo input → mismo output
// 3. Fail-open absoluto: el cliente nunca se rompe
// 4. Implementación mínima e incremental
// 5. Usa Theme Registry v1 para obtener definiciones canónicas

import { CONTRACT_DEFAULT, SYSTEM_DEFAULT, LEGACY_THEME_MAP } from './theme-defaults.js';
import { validateThemeValues, fillMissingVariables } from './theme-contract.js';
import { getThemeDefinition, getThemeDefinitionAsync } from './theme-registry.js';

/**
 * @typedef {import('./theme-types.js').ThemeEffective} ThemeEffective
 */

/**
 * Tipo: ThemeResolverInput
 * Parámetros de entrada para el resolver
 * @typedef {Object} ThemeResolverInput
 * @property {Object|null} student - Objeto estudiante con tema_preferido (opcional)
 * @property {Object|null} session - Datos de sesión (opcional, reservado para futuro)
 * @property {Object|null} systemState - Estado del sistema (opcional, reservado para futuro)
 * @property {string|null} theme_id - ID del tema a resolver directamente (opcional, v1.1)
 */

/**
 * Resuelve el tema efectivo a partir del contexto del estudiante y sistema
 * 
 * LÓGICA DE RESOLUCIÓN (en orden de prioridad):
 * 1. Si theme_id está especificado → usarlo directamente (v1.1)
 * 2. Si student.tema_preferido existe y es válido → usarlo (mapeando legacy si es necesario)
 * 3. Si no → usar system_default ('dark-classic')
 * 4. Intentar obtener tema del Theme Registry v1 (sistema + BD async)
 * 5. Si registry falla o tema no existe → fallback a SYSTEM_DEFAULT (compatibilidad)
 * 6. Validar que el tema tiene TODAS las variables
 * 7. Si faltan → rellenar desde contract_default
 * 8. Si algo falla → fallback completo a contract_default
 * 
 * @param {ThemeResolverInput} input - Contexto de resolución
 * @returns {ThemeEffective} Objeto completo con todas las variables del contrato + metadata de trazabilidad
 */
export function resolveTheme({ student = null, session = null, systemState = null, theme_id = null } = {}) {
  try {
    const warnings = [];
    
    // PASO 1: Determinar qué themeKey usar
    let requestedKey = null;
    let resolvedKey = null;
    let resolvedFrom = 'contract-default';
    
    // Prioridad 1: theme_id explícito (v1.1 - nuevo)
    if (theme_id && typeof theme_id === 'string' && theme_id.trim() !== '') {
      resolvedKey = theme_id.trim();
      resolvedFrom = 'theme-id';
      requestedKey = resolvedKey;
    }
    // Prioridad 2: student.tema_preferido (si existe y es válido)
    else if (student?.tema_preferido) {
      const preferido = String(student.tema_preferido).trim().toLowerCase();
      requestedKey = preferido;
      
      // Mapear temas legacy ('dark'/'light') a temas del sistema
      if (LEGACY_THEME_MAP[preferido]) {
        resolvedKey = LEGACY_THEME_MAP[preferido];
        resolvedFrom = 'legacy-map';
      } else {
        // Si ya es un tema del sistema válido, usarlo directamente
        resolvedKey = preferido;
        resolvedFrom = 'student-preference';
      }
    } else {
      // Prioridad 3: system_default
      resolvedKey = 'dark-classic';
      resolvedFrom = 'system-default';
    }
    
    // PASO 2: Intentar obtener tema del Theme Registry v1 (preferido)
    // Primero buscar en temas del sistema (síncrono)
    let themeDefinition = getThemeDefinition(resolvedKey);
    let themeValues = null;
    
    // #region agent log
    fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'theme-resolver.js:72',message:'resolveTheme: buscando tema en registry sistema',data:{requestedKey,resolvedKey,found:themeDefinition!==null,hasValues:themeDefinition?.values!==undefined},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    
    // Si no se encuentra en temas del sistema, intentar BD (async, pero no bloqueamos)
    // NOTA: Esta es una limitación v1 - el resolver es síncrono pero BD es async
    // En v2 se puede hacer el resolver async, pero por ahora mantenemos compatibilidad
    // v1.1: Si theme_id está especificado, intentar cargar de BD en background (cache para próxima vez)
    if ((!themeDefinition || !themeDefinition.values) && resolvedFrom === 'theme-id') {
      // Intentar cargar de BD de forma async (no bloquea, pero puede cachear para próxima vez)
      // Usar resolveThemeAsync() si se necesita esperar la carga de BD
      loadThemeFromDb(resolvedKey).catch(() => {
        // Silenciar errores, el fallback se maneja abajo
      });
    }
    
    if (themeDefinition && themeDefinition.values) {
      // Registry funcionó y tema existe - usar valores del registry
      themeValues = { ...themeDefinition.values };
      resolvedFrom = 'registry';
    } else {
      // Registry falló o tema no existe - fallback a SYSTEM_DEFAULT (compatibilidad)
      if (SYSTEM_DEFAULT[resolvedKey]) {
        themeValues = { ...SYSTEM_DEFAULT[resolvedKey] };
        resolvedFrom = 'system-default-fallback';
        if (!themeDefinition) {
          warnings.push(`Registry no disponible, usando SYSTEM_DEFAULT para '${resolvedKey}'`);
        } else {
          warnings.push(`Tema '${resolvedKey}' no encontrado en registry, usando SYSTEM_DEFAULT`);
        }
      } else {
        // Tema no existe en ningún lado, usar contract_default
        themeValues = { ...CONTRACT_DEFAULT };
        resolvedFrom = 'contract-default';
        warnings.push(`Tema '${resolvedKey}' no existe, usando CONTRACT_DEFAULT`);
      }
    }
    
    // PASO 3: Validar que el tema tiene TODAS las variables
    const validation = validateThemeValues(themeValues);
    
    // PASO 4: Si faltan variables, rellenar desde contract_default
    if (!validation.valid) {
      themeValues = fillMissingVariables(themeValues);
      if (validation.missing.length > 0) {
        warnings.push(`Variables faltantes rellenadas desde CONTRACT_DEFAULT: ${validation.missing.join(', ')}`);
      }
    }
    
    // PASO 5: Validación final (debería pasar siempre después de fillMissingVariables)
    const finalValidation = validateThemeValues(themeValues);
    if (!finalValidation.valid) {
      // Si aún falla, usar contract_default completo (fail-open absoluto)
      console.warn('[ThemeResolver] Tema incompleto después de rellenar, usando contract_default');
      themeValues = { ...CONTRACT_DEFAULT };
      resolvedFrom = 'contract-default';
      resolvedKey = null;
      warnings.push('Fallback completo a CONTRACT_DEFAULT debido a validación fallida');
    }
    
    // PASO 6: Construir ThemeEffective con metadata de trazabilidad
    // Por compatibilidad con código existente, devolvemos un objeto plano con todas las variables
    // Si en el futuro queremos metadata completa, puede extenderse sin romper compatibilidad
    const effective = { ...themeValues };
    
    // Añadir metadata opcional (no rompe compatibilidad porque son propiedades adicionales)
    // El código existente que solo espera variables CSS seguirá funcionando
    Object.defineProperty(effective, '_resolvedKey', { value: resolvedKey, enumerable: false });
    Object.defineProperty(effective, '_resolvedFrom', { value: resolvedFrom, enumerable: false });
    Object.defineProperty(effective, '_contractVersion', { value: 'v1', enumerable: false });
    Object.defineProperty(effective, '_warnings', { value: warnings.length > 0 ? warnings : undefined, enumerable: false });
    
    return effective;
    
  } catch (error) {
    // Fail-open absoluto: si TODO falla, devolver contract_default
    console.error('[ThemeResolver] Error crítico en resolución de tema:', error);
    const fallback = { ...CONTRACT_DEFAULT };
    Object.defineProperty(fallback, '_resolvedKey', { value: null, enumerable: false });
    Object.defineProperty(fallback, '_resolvedFrom', { value: 'contract-default', enumerable: false });
    Object.defineProperty(fallback, '_contractVersion', { value: 'v1', enumerable: false });
    Object.defineProperty(fallback, '_warnings', { value: ['Error crítico en resolver, usando CONTRACT_DEFAULT'], enumerable: false });
    return fallback;
  }
}

/**
 * Obtiene el ID del tema (legacy) a partir del ThemeEffective
 * Útil para compatibilidad con código existente que espera 'dark' o 'light'
 * 
 * @param {ThemeEffective} themeEffective - Tema efectivo resuelto
 * @returns {string} ID del tema ('dark' o 'light')
 */
export function getThemeId(themeEffective) {
  // Determinar si es tema oscuro o claro basándose en --bg-main
  const bgMain = themeEffective['--bg-main'] || '';
  
  // Si el fondo es oscuro (hex que empieza con #0, #1, o rgba/rgb oscuro), es dark
  if (bgMain.startsWith('#0') || bgMain.startsWith('#1') || 
      bgMain.includes('rgba(0') || bgMain.includes('rgb(0')) {
    return 'dark';
  }
  
  // Por defecto, asumir light
  return 'light';
}

/**
 * Obtiene el nombre del tema del sistema a partir del ThemeEffective
 * Útil para identificar qué tema base se está usando
 * 
 * @param {ThemeEffective} themeEffective - Tema efectivo resuelto
 * @returns {string} Nombre del tema del sistema ('dark-classic', 'light-classic', etc.)
 */
export function getSystemThemeName(themeEffective) {
  // Primero intentar usar metadata interna si está disponible
  if (themeEffective._resolvedKey) {
    return themeEffective._resolvedKey;
  }
  
  // Fallback: comparar con temas conocidos del registry
  const themeDefinition = getThemeDefinition('dark-classic');
  if (themeDefinition) {
    if (themeEffective['--bg-main'] === themeDefinition.values['--bg-main'] &&
        themeEffective['--text-primary'] === themeDefinition.values['--text-primary']) {
      return 'dark-classic';
    }
  }
  
  const lightDefinition = getThemeDefinition('light-classic');
  if (lightDefinition) {
    if (themeEffective['--bg-main'] === lightDefinition.values['--bg-main'] &&
        themeEffective['--text-primary'] === lightDefinition.values['--text-primary']) {
      return 'light-classic';
    }
  }
  
  // Último fallback: comparar con SYSTEM_DEFAULT (compatibilidad)
  for (const [themeName, themeValues] of Object.entries(SYSTEM_DEFAULT)) {
    if (themeEffective['--bg-main'] === themeValues['--bg-main'] &&
        themeEffective['--text-primary'] === themeValues['--text-primary']) {
      return themeName;
    }
  }
  
  // Si no coincide con ningún tema conocido, es un tema personalizado o fallback
  return 'custom';
}

/**
 * Carga un tema desde BD de forma async (helper interno)
 * No bloquea, solo intenta cargar y cachear para próxima vez
 * 
 * @param {string} theme_id - ID del tema a cargar
 * @returns {Promise<void>}
 */
async function loadThemeFromDb(theme_id) {
  try {
    const { getDefaultThemeVersionRepo } = await import('../../infra/repos/theme-version-repo-pg.js');
    const versionRepo = getDefaultThemeVersionRepo();
    const version = await versionRepo.getLatestVersion(theme_id);
    
    if (version && version.definition_json) {
      // Cachear en el registry para próxima vez (si el registry soporta cache de BD)
      // Por ahora solo logueamos, el registry ya tiene su propio sistema de cache
      console.log(`[ThemeResolver] Tema '${theme_id}' cargado desde BD (v${version.version})`);
    }
  } catch (error) {
    // Silenciar errores, no afecta el resolver síncrono
  }
}

/**
 * Versión async del resolver que puede esperar carga de BD
 * Útil cuando se necesita resolver un theme_id que puede estar solo en BD
 * 
 * @param {ThemeResolverInput} input - Contexto de resolución
 * @returns {Promise<ThemeEffective>} Objeto completo con todas las variables del contrato + metadata
 */
export async function resolveThemeAsync({ student = null, session = null, systemState = null, theme_id = null } = {}) {
  try {
    const warnings = [];
    
    // PASO 1: Determinar qué themeKey usar (misma lógica que síncrono)
    let requestedKey = null;
    let resolvedKey = null;
    let resolvedFrom = 'contract-default';
    
    // Prioridad 1: theme_id explícito
    if (theme_id && typeof theme_id === 'string' && theme_id.trim() !== '') {
      resolvedKey = theme_id.trim();
      resolvedFrom = 'theme-id';
      requestedKey = resolvedKey;
    }
    // Prioridad 2: student.tema_preferido
    else if (student?.tema_preferido) {
      const preferido = String(student.tema_preferido).trim().toLowerCase();
      requestedKey = preferido;
      
      if (LEGACY_THEME_MAP[preferido]) {
        resolvedKey = LEGACY_THEME_MAP[preferido];
        resolvedFrom = 'legacy-map';
      } else {
        resolvedKey = preferido;
        resolvedFrom = 'student-preference';
      }
    } else {
      resolvedKey = 'dark-classic';
      resolvedFrom = 'system-default';
    }
    
    // PASO 2: Intentar obtener tema (sistema + BD async)
    let themeDefinition = getThemeDefinition(resolvedKey);
    let themeValues = null;
    
    // Si no está en sistema y es theme_id, intentar BD
    if ((!themeDefinition || !themeDefinition.values) && resolvedFrom === 'theme-id') {
      try {
        const { getDefaultThemeVersionRepo } = await import('../../infra/repos/theme-version-repo-pg.js');
        const versionRepo = getDefaultThemeVersionRepo();
        const version = await versionRepo.getLatestVersion(resolvedKey);
        
        if (version && version.definition_json && version.definition_json.tokens) {
          // Convertir ThemeDefinition de BD a formato del registry
          themeDefinition = {
            key: version.definition_json.id,
            name: version.definition_json.name,
            contractVersion: 'v1',
            values: version.definition_json.tokens,
            meta: version.definition_json.meta || {}
          };
          resolvedFrom = 'theme-db';
        }
      } catch (error) {
        warnings.push(`Error cargando tema '${resolvedKey}' desde BD: ${error.message}`);
      }
    }
    
    // Si aún no está, intentar async del registry
    if (!themeDefinition || !themeDefinition.values) {
      themeDefinition = await getThemeDefinitionAsync(resolvedKey);
      if (themeDefinition && themeDefinition.values) {
        resolvedFrom = 'registry-async';
      }
    }
    
    // Continuar con la misma lógica de validación y fallback que la versión síncrona
    if (themeDefinition && themeDefinition.values) {
      themeValues = { ...themeDefinition.values };
    } else {
      if (SYSTEM_DEFAULT[resolvedKey]) {
        themeValues = { ...SYSTEM_DEFAULT[resolvedKey] };
        resolvedFrom = 'system-default-fallback';
        warnings.push(`Tema '${resolvedKey}' no encontrado, usando SYSTEM_DEFAULT`);
      } else {
        themeValues = { ...CONTRACT_DEFAULT };
        resolvedFrom = 'contract-default';
        warnings.push(`Tema '${resolvedKey}' no existe, usando CONTRACT_DEFAULT`);
      }
    }
    
    // Validar y rellenar faltantes
    const validation = validateThemeValues(themeValues);
    if (!validation.valid) {
      themeValues = fillMissingVariables(themeValues);
      if (validation.missing.length > 0) {
        warnings.push(`Variables faltantes rellenadas: ${validation.missing.join(', ')}`);
      }
    }
    
    const finalValidation = validateThemeValues(themeValues);
    if (!finalValidation.valid) {
      console.warn('[ThemeResolver] Tema incompleto después de rellenar, usando contract_default');
      themeValues = { ...CONTRACT_DEFAULT };
      resolvedFrom = 'contract-default';
      resolvedKey = null;
      warnings.push('Fallback completo a CONTRACT_DEFAULT debido a validación fallida');
    }
    
    // Construir ThemeEffective
    const effective = { ...themeValues };
    Object.defineProperty(effective, '_resolvedKey', { value: resolvedKey, enumerable: false });
    Object.defineProperty(effective, '_resolvedFrom', { value: resolvedFrom, enumerable: false });
    Object.defineProperty(effective, '_contractVersion', { value: 'v1', enumerable: false });
    Object.defineProperty(effective, '_warnings', { value: warnings.length > 0 ? warnings : undefined, enumerable: false });
    
    return effective;
    
  } catch (error) {
    console.error('[ThemeResolver] Error crítico en resolución async de tema:', error);
    const fallback = { ...CONTRACT_DEFAULT };
    Object.defineProperty(fallback, '_resolvedKey', { value: null, enumerable: false });
    Object.defineProperty(fallback, '_resolvedFrom', { value: 'contract-default', enumerable: false });
    Object.defineProperty(fallback, '_contractVersion', { value: 'v1', enumerable: false });
    Object.defineProperty(fallback, '_warnings', { value: ['Error crítico en resolver async, usando CONTRACT_DEFAULT'], enumerable: false });
    return fallback;
  }
}

