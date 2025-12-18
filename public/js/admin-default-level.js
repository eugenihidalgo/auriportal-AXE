// public/js/admin-default-level.js
// Helper reutilizable para manejar nivel por defecto persistente por sección del Admin
// Usa sessionStorage para persistir el último nivel usado en cada sección

/**
 * Obtiene el nivel por defecto guardado para una sección
 * @param {string} sectionKey - Clave única de la sección (ej: 'tecnicas_limpieza')
 * @param {number} fallbackLevel - Nivel por defecto si no hay valor guardado (default: 9)
 * @returns {number} Nivel por defecto
 */
function getDefaultLevel(sectionKey, fallbackLevel = 9) {
  try {
    const storageKey = `admin_default_level_${sectionKey}`;
    const stored = sessionStorage.getItem(storageKey);
    if (stored !== null) {
      const level = parseInt(stored, 10);
      if (!isNaN(level) && level >= 1) {
        return level;
      }
    }
  } catch (error) {
    console.warn('[admin-default-level] Error leyendo sessionStorage:', error);
  }
  return fallbackLevel;
}

/**
 * Guarda el nivel por defecto para una sección
 * @param {string} sectionKey - Clave única de la sección
 * @param {number} level - Nivel a guardar
 */
function setDefaultLevel(sectionKey, level) {
  try {
    const storageKey = `admin_default_level_${sectionKey}`;
    const levelNum = parseInt(level, 10);
    if (!isNaN(levelNum) && levelNum >= 1) {
      sessionStorage.setItem(storageKey, levelNum.toString());
    }
  } catch (error) {
    console.warn('[admin-default-level] Error escribiendo sessionStorage:', error);
  }
}

/**
 * Inicializa un input/select de nivel con el valor por defecto guardado
 * @param {string} sectionKey - Clave única de la sección
 * @param {string|HTMLElement} elementSelector - Selector CSS o elemento DOM del input/select de nivel
 * @param {number} fallbackLevel - Nivel por defecto si no hay valor guardado (default: 9)
 */
function initDefaultLevel(sectionKey, elementSelector, fallbackLevel = 9) {
  try {
    const element = typeof elementSelector === 'string' 
      ? document.querySelector(elementSelector)
      : elementSelector;
    
    if (!element) {
      console.warn(`[admin-default-level] Elemento no encontrado: ${elementSelector}`);
      return;
    }
    
    const defaultLevel = getDefaultLevel(sectionKey, fallbackLevel);
    element.value = defaultLevel;
    
    // Guardar cuando cambie el valor
    element.addEventListener('change', function() {
      const newLevel = parseInt(this.value, 10);
      if (!isNaN(newLevel) && newLevel >= 1) {
        setDefaultLevel(sectionKey, newLevel);
      }
    });
  } catch (error) {
    console.warn('[admin-default-level] Error inicializando nivel:', error);
  }
}

