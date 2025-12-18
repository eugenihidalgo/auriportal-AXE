// theme-types.js
// Tipos y definiciones de TypeScript/JSDoc para Theme Definitions v1
// Define las estructuras de datos para temas del sistema

/**
 * Definición completa de un tema del sistema
 * Representa un tema versionable con todas sus variables y metadata
 * 
 * @typedef {Object} ThemeDefinition
 * @property {string} key - Identificador único del tema (ej: 'dark-classic', 'light-classic')
 * @property {string} name - Nombre legible del tema (ej: 'Dark Classic', 'Light Classic')
 * @property {string} contractVersion - Versión del Theme Contract que usa (ej: 'v1')
 * @property {Object<string, string>} values - Mapa completo de variables CSS del contrato
 * @property {Object<string, any>} [meta] - Metadata opcional (descripción, autor, fecha, etc.)
 */

/**
 * Tema efectivo resuelto por el Theme Resolver
 * Contiene el tema aplicado con información de trazabilidad
 * 
 * @typedef {Object} ThemeEffective
 * @property {string} [key] - Clave del tema original solicitado (si aplica)
 * @property {string} resolvedKey - Clave del tema finalmente resuelto (ej: 'dark-classic')
 * @property {Object<string, string>} values - Valores completos de todas las variables del contrato
 * @property {string} resolvedFrom - Origen de resolución ('registry', 'legacy-map', 'contract-default')
 * @property {string} contractVersion - Versión del contrato usado (ej: 'v1')
 * @property {string[]} [warnings] - Advertencias generadas durante la resolución (opcional)
 */







