/**
 * MASTER REFRESH ENGINE v1 - AuriPortal Master
 * 
 * Engine canónico que garantiza: 1 mutación = 1 refresh = 1 render
 * 
 * PRINCIPIO CONSTITUCIONAL:
 * - Backend es Source of Truth
 * - Frontend NO calcula estados
 * - Loaders NO renderizan por efecto colateral
 * - Render final lo hace Refresh Engine después de mutación
 * 
 * RESPONSABILIDAD ÚNICA:
 * - Orquestar invalidación + refetch + render después de mutaciones
 * - Prevenir doble render con guard de token
 * - Logs forenses estructurados
 * - No conocer DOM ni state concreto (usa adapters)
 * 
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║ ⚠️  MASTER RULE: no HTML in JS strings (constitutional)                     ║
 * ║                                                                              ║
 * ║ PROHIBIDO:                                                                   ║
 * ║ ❌ innerHTML                                                                 ║
 * ║ ❌ DOM manipulation directa                                                  ║
 * ║                                                                              ║
 * ║ OBLIGATORIO:                                                                 ║
 * ║ ✅ Delegar a adapters (invalidate/refetch/render)                           ║
 * ║ ✅ Logging estructurado                                                      ║
 * ║ ✅ Guard de token para prevenir doble render                                 ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

// Guard idempotente
if (window.__AP_MASTER_REFRESH_ENGINE_V1_LOADED__) {
  console.warn('[MasterRefreshEngineV1] Ya cargado, ignorando carga duplicada');
} else {
  window.__AP_MASTER_REFRESH_ENGINE_V1_LOADED__ = true;

  /**
   * Crea una instancia del Refresh Engine
   * @param {Object} options - Opciones
   * @param {string} [options.logPrefix='[REFRESH_ENGINE]'] - Prefijo para logs
   * @returns {Object} Instancia del engine
   */
  function createMasterRefreshEngine({ logPrefix = '[REFRESH_ENGINE]' } = {}) {
    let renderTokenCounter = 0;
    let lastRenderToken = null;
    const modules = new Map();

    /**
     * Registra un módulo con su adapter
     * @param {string} moduleName - Nombre del módulo (ej: 'alquimia_general')
     * @param {Object} moduleAdapter - Adapter con funciones invalidate, refetch, render, refreshModal (opcional)
     */
    function registerModule(moduleName, moduleAdapter) {
      if (modules.has(moduleName)) {
        console.warn(`${logPrefix} Módulo ${moduleName} ya registrado, sobrescribiendo`);
      }

      // Validar que el adapter tiene las funciones requeridas
      if (typeof moduleAdapter.invalidate !== 'function') {
        throw new Error(`${logPrefix} Adapter de ${moduleName} debe tener función invalidate()`);
      }
      if (typeof moduleAdapter.refetch !== 'function') {
        throw new Error(`${logPrefix} Adapter de ${moduleName} debe tener función refetch()`);
      }
      if (typeof moduleAdapter.render !== 'function') {
        throw new Error(`${logPrefix} Adapter de ${moduleName} debe tener función render()`);
      }

      modules.set(moduleName, moduleAdapter);
      console.log(`${logPrefix} Módulo ${moduleName} registrado`);
    }

    /**
     * Ejecuta refresh después de una mutación
     * @param {Object} mutation - Objeto de mutación
     * @param {string} mutation.module - Nombre del módulo (debe estar registrado)
     * @param {string} mutation.mutation_type - Tipo de mutación (ej: 'alquimia.clean.student')
     * @param {Object} [mutation.scope] - Scope de la mutación (ej: { view_mode: 'proyeccion', view_layer: 'shared' })
     * @param {Object} [mutation.context] - Contexto adicional (item_ref, student_uuid, list_id, etc.)
     * @returns {Promise<void>}
     */
    async function afterMutation(mutation) {
      const { module, mutation_type, scope = {}, context = {} } = mutation;

      if (!module) {
        console.error(`${logPrefix} afterMutation requiere module`);
        return;
      }

      if (!mutation_type) {
        console.error(`${logPrefix} afterMutation requiere mutation_type`);
        return;
      }

      const moduleAdapter = modules.get(module);
      if (!moduleAdapter) {
        console.error(`${logPrefix} Módulo ${module} no registrado`);
        return;
      }

      // Generar token único para esta mutación
      renderTokenCounter++;
      const currentToken = renderTokenCounter;
      lastRenderToken = currentToken;

      // Log forense inicial
      console.log(`${logPrefix}[AFTER_MUTATION]`, {
        module,
        mutation_type,
        token: currentToken,
        scope,
        context,
        timestamp: new Date().toISOString()
      });

      try {
        // PASO 1: Invalidar
        console.log(`${logPrefix}[INVALIDATE]`, { module, mutation_type, token: currentToken });
        moduleAdapter.invalidate(mutation);

        // PASO 2: Refetch
        console.log(`${logPrefix}[REFETCH]`, { module, mutation_type, token: currentToken });
        await moduleAdapter.refetch(mutation);

        // PASO 3: Refresh modal (opcional, solo si el adapter lo soporta)
        if (typeof moduleAdapter.refreshModal === 'function' && context.item_ref) {
          console.log(`${logPrefix}[REFRESH_MODAL]`, { module, mutation_type, token: currentToken, item_ref: context.item_ref });
          await moduleAdapter.refreshModal(mutation);
        }

        // PASO 4: Render (con guard de token)
        if (lastRenderToken === currentToken) {
          console.log(`${logPrefix}[RENDER]`, { module, mutation_type, token: currentToken });
          moduleAdapter.render(mutation);
        } else {
          console.warn(`${logPrefix}[RENDER_SKIPPED]`, {
            module,
            mutation_type,
            token: currentToken,
            reason: 'Token desactualizado (otra mutación ya renderizó)',
            lastRenderToken
          });
        }

        // Log forense final
        console.log(`${logPrefix}[AFTER_MUTATION_COMPLETE]`, {
          module,
          mutation_type,
          token: currentToken,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error(`${logPrefix}[AFTER_MUTATION_ERROR]`, {
          module,
          mutation_type,
          token: currentToken,
          error: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString()
        });
        throw error;
      }
    }

    /**
     * Obtiene el último token de render (útil para correlación en logs)
     * @returns {number|null}
     */
    function getLastRenderToken() {
      return lastRenderToken;
    }

    /**
     * Obtiene información del engine (útil para debugging)
     * @returns {Object}
     */
    function getEngineInfo() {
      return {
        registeredModules: Array.from(modules.keys()),
        lastRenderToken,
        renderTokenCounter
      };
    }

    return {
      registerModule,
      afterMutation,
      getLastRenderToken,
      getEngineInfo
    };
  }

  // Crear instancia global única
  if (!window.MasterRefreshEngineV1) {
    window.MasterRefreshEngineV1 = createMasterRefreshEngine({
      logPrefix: '[REFRESH_ENGINE][MASTER]'
    });
    console.log('[MasterRefreshEngineV1] ✅ Engine creado y disponible en window.MasterRefreshEngineV1');
  } else {
    console.warn('[MasterRefreshEngineV1] Engine ya existe, reutilizando instancia existente');
  }

  // Exportar para módulos ES6 (si se usa import)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createMasterRefreshEngine };
  }
}
