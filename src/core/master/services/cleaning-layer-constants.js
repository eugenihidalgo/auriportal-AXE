// src/core/master/services/cleaning-layer-constants.js
// CONSTANTES CANÓNICAS - Cleaning Engine v1
//
// REGLAS ABSOLUTAS:
// 1. clean_layer decide ESCRITURA. Nunca se infiere.
// 2. view_layer decide CÁLCULO DE ESTADO y COLUMNA UI.
// 3. combo es SOLO view_layer. Nunca clean_layer.
// 4. No se permite inferencia implícita en frontend ni backend.
// 5. Fallar explícitamente es mejor que actuar mal (HTTP 400).

/**
 * Capas de limpieza permitidas (clean_layer)
 * Decide QUÉ COLUMNAS se escriben en cleaning_item_state
 */
export const ALLOWED_CLEAN_LAYERS = ['shared', 'pde'];
// Preparar para futuro: 'group', 'pair' (sin activar todavía)

/**
 * Capas de vista permitidas (view_layer)
 * Decide QUÉ ESTADO se calcula y QUÉ COLUMNA UI se muestra
 */
export const ALLOWED_VIEW_LAYERS = ['shared', 'pde', 'combo'];

/**
 * Valida clean_layer
 * @param {string} cleanLayer - Capa de limpieza a validar
 * @returns {boolean} true si es válido
 */
export function isValidCleanLayer(cleanLayer) {
  return cleanLayer && ALLOWED_CLEAN_LAYERS.includes(cleanLayer);
}

/**
 * Valida view_layer
 * @param {string} viewLayer - Capa de vista a validar
 * @returns {boolean} true si es válido
 */
export function isValidViewLayer(viewLayer) {
  return viewLayer && ALLOWED_VIEW_LAYERS.includes(viewLayer);
}

/**
 * Valida que clean_layer NO sea 'combo'
 * combo es SOLO view_layer, nunca clean_layer
 * @param {string} cleanLayer - Capa de limpieza a validar
 * @throws {Error} Si clean_layer es 'combo'
 */
export function validateCleanLayerNotCombo(cleanLayer) {
  if (cleanLayer === 'combo') {
    throw new Error('clean_layer cannot be "combo". combo is only valid as view_layer.');
  }
}

/**
 * Valida que view_layer sea conocido
 * @param {string} viewLayer - Capa de vista a validar
 * @throws {Error} Si view_layer no es válido
 */
export function validateViewLayer(viewLayer) {
  if (!isValidViewLayer(viewLayer)) {
    throw new Error(`view_layer must be one of: ${ALLOWED_VIEW_LAYERS.join(', ')}. Got: ${viewLayer}`);
  }
}

/**
 * Valida que clean_layer sea válido
 * @param {string} cleanLayer - Capa de limpieza a validar
 * @throws {Error} Si clean_layer no es válido
 */
export function validateCleanLayer(cleanLayer) {
  if (!isValidCleanLayer(cleanLayer)) {
    throw new Error(`clean_layer must be one of: ${ALLOWED_CLEAN_LAYERS.join(', ')}. Got: ${cleanLayer}`);
  }
}
