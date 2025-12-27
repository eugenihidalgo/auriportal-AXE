// theme-layers-v1.js
// Resolución de temas por capas v1
// Implementa resolución del tema efectivo con precedencia:
// 1) user override (opcional v1, pero dejar el hueco)
// 2) screen override (pantalla concreta)
// 3) editor override (p.ej. "nav-editor", "recorridos-editor")
// 4) environment override (admin/student)
// 5) global default

/**
 * Tipos de scope/capa
 */
export const SCOPE_TYPES = {
  GLOBAL: 'global',
  ENVIRONMENT: 'environment',
  EDITOR: 'editor',
  SCREEN: 'screen',
  USER: 'user'
};

/**
 * Prioridades de resolución (menor = mayor prioridad)
 */
export const SCOPE_PRIORITIES = {
  [SCOPE_TYPES.USER]: 1,
  [SCOPE_TYPES.SCREEN]: 2,
  [SCOPE_TYPES.EDITOR]: 3,
  [SCOPE_TYPES.ENVIRONMENT]: 4,
  [SCOPE_TYPES.GLOBAL]: 5
};

/**
 * Resuelve el tema efectivo por capas
 * 
 * @param {Object} ctx - Contexto de resolución
 * @param {Object} [ctx.student] - Objeto estudiante (para user override)
 * @param {string} [ctx.screen] - Pantalla actual (ej: 'admin/tecnicas-limpieza')
 * @param {string} [ctx.editor] - Editor actual (ej: 'nav-editor')
 * @param {string} [ctx.environment] - Entorno ('admin' | 'student')
 * @param {Object} [opts] - Opciones
 * @param {Function} [opts.getBinding] - Función async para obtener binding (scope_type, scope_key) -> {theme_key, mode_pref}
 * @returns {Promise<{theme_key: string, mode: 'light'|'dark'|'auto', resolved_from: string}>}
 */
export async function resolveThemeByLayers(ctx = {}, opts = {}) {
  const { getBinding } = opts;
  
  // Si no hay función de binding, usar default
  if (!getBinding || typeof getBinding !== 'function') {
    return {
      theme_key: 'admin-classic',
      mode: 'auto',
      resolved_from: 'default'
    };
  }
  
  const { student, screen, editor, environment = 'admin' } = ctx;
  
  // Resolver en orden de prioridad (menor = mayor prioridad)
  const scopes = [
    // 1. User override (si hay student)
    student ? { type: SCOPE_TYPES.USER, key: student.email || student.id } : null,
    
    // 2. Screen override
    screen ? { type: SCOPE_TYPES.SCREEN, key: screen } : null,
    
    // 3. Editor override
    editor ? { type: SCOPE_TYPES.EDITOR, key: editor } : null,
    
    // 4. Environment override
    environment ? { type: SCOPE_TYPES.ENVIRONMENT, key: environment } : null,
    
    // 5. Global default
    { type: SCOPE_TYPES.GLOBAL, key: 'global' }
  ].filter(Boolean);
  
  // Intentar resolver desde la capa más específica a la más general
  for (const scope of scopes) {
    try {
      const binding = await getBinding(scope.type, scope.key);
      
      if (binding && binding.theme_key && binding.active !== false) {
        // Determinar modo efectivo
        let mode = binding.mode_pref || 'auto';
        
        // Si es 'auto', detectar preferencia del sistema/navegador
        if (mode === 'auto') {
          // Por ahora, usar 'dark' como default para auto
          // En el futuro, se puede detectar desde headers o preferencias del navegador
          mode = 'dark';
        }
        
        return {
          theme_key: binding.theme_key,
          mode: mode,
          resolved_from: `${scope.type}:${scope.key}`
        };
      }
    } catch (error) {
      // Continuar con la siguiente capa si esta falla
      console.warn(`[ThemeLayers] Error resolviendo capa ${scope.type}:${scope.key}:`, error.message);
    }
  }
  
  // Fallback absoluto
  return {
    theme_key: 'admin-classic',
    mode: 'dark',
    resolved_from: 'fallback'
  };
}

/**
 * Resuelve el modo (light/dark) desde preferencias
 * 
 * @param {string} modePref - Preferencia ('auto', 'light', 'dark')
 * @param {Object} [ctx] - Contexto adicional (para detectar preferencia del sistema)
 * @returns {'light'|'dark'}
 */
export function resolveMode(modePref = 'auto', ctx = {}) {
  if (modePref === 'light') return 'light';
  if (modePref === 'dark') return 'dark';
  
  // Auto: por defecto dark (se puede mejorar detectando preferencia del sistema)
  return 'dark';
}

