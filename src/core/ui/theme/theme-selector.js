// src/core/ui/theme/theme-selector.js
// Helper reutilizable para selector de temas en editores
//
// PRINCIPIOS:
// 1. Reutilizable: puede usarse en cualquier editor
// 2. Persistencia localStorage
// 3. Fail-open: si catalog falla, mostrar solo system/classic
// 4. Storage key configurable

/**
 * Obtiene el catálogo de temas desde el endpoint
 * 
 * @param {Object} options - Opciones
 * @param {boolean} options.includeDrafts - Incluir drafts (default: false)
 * @returns {Promise<Array>} Array de items del catálogo
 */
export async function fetchThemeCatalog({ includeDrafts = false } = {}) {
  try {
    const url = new URL('/admin/api/themes/catalog', window.location.origin);
    if (includeDrafts) {
      url.searchParams.set('include_drafts', '1');
    }
    
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    if (!data.ok || !Array.isArray(data.items)) {
      throw new Error('Respuesta inválida del catálogo');
    }
    
    return data.items;
    
  } catch (error) {
    console.warn('[ThemeSelector] Error obteniendo catálogo, usando fallback', error);
    
    // Fail-open: devolver items básicos del sistema
    return [
      { key: 'auto', label: 'Auto', kind: 'system', source: 'resolver', status: 'published' },
      { key: 'light-classic', label: 'Light Classic', kind: 'classic', source: 'resolver', status: 'published' },
      { key: 'dark-classic', label: 'Dark Classic', kind: 'classic', source: 'resolver', status: 'published' }
    ];
  }
}

/**
 * Obtiene preferencia de tema desde localStorage
 * 
 * @param {string} storageKey - Key de localStorage
 * @returns {string|null} Key del tema preferido o null
 */
export function getThemePreference(storageKey) {
  try {
    return localStorage.getItem(storageKey);
  } catch (e) {
    return null;
  }
}

/**
 * Guarda preferencia de tema en localStorage
 * 
 * @param {string} storageKey - Key de localStorage
 * @param {string} themeKey - Key del tema
 */
export function setThemePreference(storageKey, themeKey) {
  try {
    localStorage.setItem(storageKey, themeKey);
  } catch (e) {
    console.warn('[ThemeSelector] Error guardando preferencia', e);
  }
}

/**
 * Renderiza un selector de temas en un contenedor
 * 
 * @param {HTMLElement} container - Contenedor donde renderizar
 * @param {Object} options - Opciones
 * @param {string} options.storageKey - Key de localStorage (default: 'ap_theme_pref')
 * @param {Function} options.onChange - Callback cuando cambia el tema
 * @param {boolean} options.includeDrafts - Incluir drafts (default: false)
 * @returns {Promise<HTMLElement>} Elemento select creado
 */
export async function renderThemeSelect(container, { 
  storageKey = 'ap_theme_pref', 
  onChange = null,
  includeDrafts = false 
} = {}) {
  try {
    // Obtener catálogo
    const items = await fetchThemeCatalog({ includeDrafts });
    
    // Crear select
    const select = document.createElement('select');
    select.id = 'theme-selector';
    select.className = 'px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500';
    
    // Añadir opciones
    for (const item of items) {
      const option = document.createElement('option');
      option.value = item.key;
      option.textContent = item.label;
      select.appendChild(option);
    }
    
    // Restaurar preferencia guardada
    const savedPref = getThemePreference(storageKey);
    if (savedPref) {
      const option = Array.from(select.options).find(opt => opt.value === savedPref);
      if (option) {
        select.value = savedPref;
      }
    }
    
    // Listener de cambio
    if (onChange) {
      select.addEventListener('change', (e) => {
        const themeKey = e.target.value;
        setThemePreference(storageKey, themeKey);
        onChange(themeKey, items.find(item => item.key === themeKey));
      });
    } else {
      // Default: solo guardar preferencia
      select.addEventListener('change', (e) => {
        setThemePreference(storageKey, e.target.value);
      });
    }
    
    // Añadir al contenedor
    container.innerHTML = '';
    container.appendChild(select);
    
    return select;
    
  } catch (error) {
    console.error('[ThemeSelector] Error renderizando selector', error);
    
    // Fail-open: crear select básico
    const select = document.createElement('select');
    select.id = 'theme-selector';
    select.className = 'px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded border border-slate-600';
    
    const options = [
      { value: 'auto', label: 'Auto' },
      { value: 'light-classic', label: 'Light Classic' },
      { value: 'dark-classic', label: 'Dark Classic' }
    ];
    
    for (const opt of options) {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      select.appendChild(option);
    }
    
    container.innerHTML = '';
    container.appendChild(select);
    
    return select;
  }
}




