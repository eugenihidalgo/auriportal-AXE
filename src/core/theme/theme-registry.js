// theme-registry.js
// Theme Registry v1 - Registro canónico de temas del sistema
// 
// PRINCIPIOS:
// 1. Single source of truth: define qué temas existen y sus valores
// 2. Fail-open absoluto: si falla la carga, devuelve null (el resolver maneja fallback)
// 3. Cache en memoria: evita re-cálculos y logs repetidos
// 4. Observabilidad mínima: solo logs de errores críticos (una vez por boot)
// 5. Carga temas del sistema (síncrono) + temas de BD (async lazy)

import { LIGHT_CLASSIC_DEFINITION, DARK_CLASSIC_DEFINITION, AURI_CLASSIC_DEFINITION } from './system-themes.js';
import { getAllContractVariables } from './theme-contract.js';

/**
 * @typedef {import('./theme-types.js').ThemeDefinition} ThemeDefinition
 */

// Cache en memoria del registry (cargado una vez al inicio)
let registryCache = null;
let loadError = null;
let loadErrorLogged = false;

// Cache de temas de BD (lazy load)
let dbThemesCache = null;
let dbThemesLoadPromise = null;
let dbThemesLoadError = null;

/**
 * Carga el registry de temas del sistema
 * Fail-open: si falla, devuelve null y loguea error una sola vez
 * 
 * @returns {Object<string, ThemeDefinition>|null} Mapa de temas o null si falla
 */
function loadRegistry() {
  // Si ya está cacheado, devolverlo
  if (registryCache !== null) {
    return registryCache;
  }
  
  // Si ya intentamos cargar y falló, devolver null sin loguear de nuevo
  if (loadError !== null) {
    return null;
  }
  
  try {
    const registry = {};
    
    // Registrar light-classic
    registry[LIGHT_CLASSIC_DEFINITION.key] = { ...LIGHT_CLASSIC_DEFINITION };
    
    // Registrar dark-classic
    registry[DARK_CLASSIC_DEFINITION.key] = { ...DARK_CLASSIC_DEFINITION };
    
    // Registrar auri-classic (tema visual actual extraído de pantalla1.html)
    registry[AURI_CLASSIC_DEFINITION.key] = { ...AURI_CLASSIC_DEFINITION };
    
    // #region agent log
    fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'theme-registry.js:49',message:'Registry cargando temas del sistema',data:{systemThemes:Object.keys(registry).length,keys:Object.keys(registry)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    // Validar que cada tema tenga todas las variables del contrato
    const contractVars = getAllContractVariables();
    const missingVarsByTheme = {};
    
    for (const [key, definition] of Object.entries(registry)) {
      const missing = [];
      for (const varName of contractVars) {
        if (!definition.values || !(varName in definition.values)) {
          missing.push(varName);
        }
      }
      if (missing.length > 0) {
        missingVarsByTheme[key] = missing;
      }
    }
    
    if (Object.keys(missingVarsByTheme).length > 0) {
      const error = new Error(`[ThemeRegistry] Temas con variables faltantes: ${JSON.stringify(missingVarsByTheme)}`);
      loadError = error;
      if (!loadErrorLogged) {
        console.warn('[ThemeRegistry] Error al cargar registry:', error.message);
        loadErrorLogged = true;
      }
      return null;
    }
    
    // Cachear y devolver
    registryCache = registry;
    return registry;
    
  } catch (error) {
    loadError = error;
    if (!loadErrorLogged) {
      console.warn('[ThemeRegistry] Error crítico al cargar registry:', error.message);
      loadErrorLogged = true;
    }
    return null;
  }
}

/**
 * Carga temas de BD de forma lazy (solo una vez, cacheado)
 * Fail-open: si falla, devuelve objeto vacío
 * 
 * @returns {Promise<Object<string, ThemeDefinition>>} Mapa de temas de BD
 */
async function loadDbThemes() {
  // Si ya está cacheado, devolverlo
  if (dbThemesCache !== null) {
    return dbThemesCache;
  }
  
  // Si ya hay una carga en progreso, esperarla
  if (dbThemesLoadPromise) {
    return dbThemesLoadPromise;
  }
  
  // Si ya intentamos cargar y falló, devolver objeto vacío
  if (dbThemesLoadError !== null) {
    return {};
  }
  
  // Iniciar carga async
  dbThemesLoadPromise = (async () => {
    try {
      // Importar dinámicamente para evitar dependencia circular
      const { themeRepository } = await import('../../../database/theme-repository.js');
      
      // Cargar solo temas activos
      const dbThemes = await themeRepository.findAll({ status: 'active' });
      
      const dbRegistry = {};
      
      for (const dbTheme of dbThemes) {
        // Parsear JSONB fields
        const values = typeof dbTheme.values === 'string' 
          ? JSON.parse(dbTheme.values) 
          : dbTheme.values;
        const meta = typeof dbTheme.meta === 'string' 
          ? JSON.parse(dbTheme.meta) 
          : dbTheme.meta;
        
        // Convertir a formato ThemeDefinition
        dbRegistry[dbTheme.key] = {
          key: dbTheme.key,
          name: dbTheme.name,
          contractVersion: dbTheme.contract_version || 'v1',
          values: values || {},
          meta: meta || {}
        };
      }
      
      // Cachear y devolver
      dbThemesCache = dbRegistry;
      return dbRegistry;
      
    } catch (error) {
      dbThemesLoadError = error;
      console.warn('[ThemeRegistry] Error cargando temas de BD:', error.message);
      return {}; // Fail-open: devolver objeto vacío
    } finally {
      dbThemesLoadPromise = null;
    }
  })();
  
  return dbThemesLoadPromise;
}

/**
 * Obtiene la definición de un tema por su clave
 * Busca primero en temas del sistema (síncrono), luego en BD (async)
 * 
 * @param {string} themeKey - Clave del tema (ej: 'dark-classic', 'light-classic')
 * @returns {ThemeDefinition|null} Definición del tema o null si no existe o falla el registry
 */
export function getThemeDefinition(themeKey) {
  if (!themeKey || typeof themeKey !== 'string') {
    // #region agent log
    fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'theme-registry.js:98',message:'getThemeDefinition: themeKey inválido',data:{themeKey,type:typeof themeKey},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    return null;
  }
  
  const registry = loadRegistry();
  if (!registry) {
    // #region agent log
    fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'theme-registry.js:105',message:'getThemeDefinition: registry falló',data:{themeKey},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    // Registry falló, devolver null (el resolver manejará el fallback)
    return null;
  }
  
  // Buscar primero en temas del sistema (síncrono)
  const found = registry[themeKey] || null;
  
  // #region agent log
  fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'theme-registry.js:108',message:'getThemeDefinition: resultado búsqueda sistema',data:{themeKey,found:found!==null,availableKeys:Object.keys(registry),registrySize:Object.keys(registry).length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  
  // Si no se encuentra en temas del sistema, buscar en cache de BD (si ya está cargado)
  if (!found && dbThemesCache !== null) {
    const dbFound = dbThemesCache[themeKey] || null;
    if (dbFound) {
      // #region agent log
      fetch('http://localhost:7242/ingest/a630ca16-542f-4dbf-9bac-2114a2a30cf8',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'theme-registry.js:140',message:'getThemeDefinition: tema encontrado en cache BD',data:{themeKey,dbKeys:Object.keys(dbThemesCache)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      return dbFound;
    }
  }
  
  // Si no está en cache de BD, iniciar carga async en background (no bloquea, pero cachea para próxima vez)
  if (!found && dbThemesCache === null && dbThemesLoadPromise === null) {
    loadDbThemes().catch(() => {});
  }
  
  return found;
}

/**
 * Versión async de getThemeDefinition que también busca en BD
 * Usar esta función cuando se necesite buscar en BD también
 * 
 * @param {string} themeKey - Clave del tema
 * @returns {Promise<ThemeDefinition|null>} Definición del tema o null
 */
export async function getThemeDefinitionAsync(themeKey) {
  if (!themeKey || typeof themeKey !== 'string') {
    return null;
  }
  
  // Buscar primero en temas del sistema (síncrono)
  const systemRegistry = loadRegistry();
  if (systemRegistry && systemRegistry[themeKey]) {
    return systemRegistry[themeKey];
  }
  
  // Si no está en sistema, buscar en BD (async)
  const dbRegistry = await loadDbThemes();
  return dbRegistry[themeKey] || null;
}

/**
 * Lista todos los temas del sistema disponibles
 * 
 * @returns {ThemeDefinition[]} Array de definiciones de temas
 */
export function listSystemThemes() {
  const registry = loadRegistry();
  if (!registry) {
    // Registry falló, devolver array vacío
    return [];
  }
  
  return Object.values(registry);
}

/**
 * Obtiene solo las claves de los temas disponibles
 * Útil para validación y listados simples
 * 
 * @returns {string[]} Array de claves de temas
 */
export function listSystemThemeKeys() {
  const registry = loadRegistry();
  if (!registry) {
    return [];
  }
  
  return Object.keys(registry);
}

/**
 * Verifica si un tema existe en el registry
 * 
 * @param {string} themeKey - Clave del tema a verificar
 * @returns {boolean} true si el tema existe, false en caso contrario
 */
export function hasTheme(themeKey) {
  return getThemeDefinition(themeKey) !== null;
}



