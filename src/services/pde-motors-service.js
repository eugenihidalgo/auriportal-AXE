// src/services/pde-motors-service.js
// Servicio de negocio para Motores PDE
//
// Responsabilidades:
// - Validar definición del motor
// - Gestionar versionado
// - Impedir editar motores published (solo duplicar)
// - Preparar motores para consumo futuro por AXE

import { getDefaultPdeMotorsRepo } from '../infra/repos/pde-motors-repo-pg.js';
import { isValidCatalogForMotors, getCatalogByKey } from './pde-catalog-registry-service.js';

/**
 * Valida la estructura de la definición de un motor
 * 
 * @param {Object} definition - Definición a validar
 * @returns {Promise<Object>} { valid: boolean, error: string|null }
 */
export async function validateMotorDefinition(definition) {
  if (!definition || typeof definition !== 'object') {
    return { valid: false, error: 'La definición debe ser un objeto' };
  }

  // Validar inputs
  if (!Array.isArray(definition.inputs)) {
    return { valid: false, error: 'La definición debe tener un array "inputs"' };
  }

  // Validar cada input
  for (const input of definition.inputs) {
    if (!input.key || typeof input.key !== 'string' || input.key.trim() === '') {
      return { valid: false, error: 'Cada input debe tener un "key" de tipo string no vacío' };
    }
    // Validar formato de key: ^[a-z][a-z0-9_]*$
    const keyRegex = /^[a-z][a-z0-9_]*$/;
    if (!keyRegex.test(input.key.trim())) {
      return { valid: false, error: `Input "${input.key}": la key debe empezar con letra minúscula y contener solo letras minúsculas, números y guiones bajos` };
    }
    if (!input.type || typeof input.type !== 'string') {
      return { valid: false, error: 'Cada input debe tener un "type" de tipo string' };
    }
    const validTypes = ['enum', 'number', 'string', 'boolean', 'pde_catalog'];
    if (!validTypes.includes(input.type)) {
      return { valid: false, error: `El tipo de input debe ser uno de: ${validTypes.join(', ')}` };
    }
    if (input.type === 'enum' && (!Array.isArray(input.options) || input.options.length === 0)) {
      return { valid: false, error: 'Los inputs de tipo "enum" deben tener un array "options" no vacío' };
    }
    // Validar pde_catalog
    if (input.type === 'pde_catalog') {
      if (!input.catalog_key || typeof input.catalog_key !== 'string') {
        return { valid: false, error: `Input "${input.key}": los inputs de tipo "pde_catalog" deben tener un "catalog_key"` };
      }
      // Validar que el catálogo existe y es usable_for_motors
      const isValid = await isValidCatalogForMotors(input.catalog_key);
      if (!isValid) {
        return { valid: false, error: `Input "${input.key}": el catálogo "${input.catalog_key}" no existe o no es usable para motores` };
      }
      // Obtener el catálogo para copiar capabilities si no están presentes
      const catalog = await getCatalogByKey(input.catalog_key);
      if (catalog) {
        // Autocompletar capabilities si no están presentes
        if (!input.capabilities) {
          input.capabilities = {
            supports_level: catalog.supports_level || false,
            supports_priority: catalog.supports_priority || false,
            supports_obligatory: catalog.supports_obligatory || false,
            supports_duration: catalog.supports_duration || false
          };
        }
      }
    }
  }

  // Validar rules (opcional pero debe ser objeto si existe)
  if (definition.rules !== undefined && typeof definition.rules !== 'object') {
    return { valid: false, error: 'Las "rules" deben ser un objeto' };
  }

  // Validar outputs
  if (!definition.outputs || typeof definition.outputs !== 'object') {
    return { valid: false, error: 'La definición debe tener un objeto "outputs"' };
  }

  // Validar estructura de outputs (steps, edges, captures)
  if (!Array.isArray(definition.outputs.steps)) {
    return { valid: false, error: 'Los outputs deben tener un array "steps"' };
  }
  if (!Array.isArray(definition.outputs.edges)) {
    return { valid: false, error: 'Los outputs deben tener un array "edges"' };
  }
  if (!Array.isArray(definition.outputs.captures)) {
    return { valid: false, error: 'Los outputs deben tener un array "captures"' };
  }

  return { valid: true, error: null };
}

/**
 * Lista todos los motores
 * 
 * @param {Object} options - Opciones de filtrado
 * @returns {Promise<Array>} Array de motores
 */
export async function listMotors(options = {}) {
  const repo = getDefaultPdeMotorsRepo();
  return await repo.listMotors(options);
}

/**
 * Obtiene un motor por ID
 * 
 * @param {string} id - UUID del motor
 * @returns {Promise<Object|null>} Motor o null si no existe
 */
export async function getMotorById(id) {
  const repo = getDefaultPdeMotorsRepo();
  return await repo.getMotorById(id);
}

/**
 * Obtiene un motor por motor_key
 * 
 * @param {string} motorKey - Clave canónica del motor
 * @returns {Promise<Object|null>} Motor o null si no existe
 */
export async function getMotorByKey(motorKey) {
  const repo = getDefaultPdeMotorsRepo();
  return await repo.getMotorByKey(motorKey);
}

/**
 * Crea un nuevo motor
 * 
 * @param {Object} motorData - Datos del motor
 * @returns {Promise<Object>} Motor creado
 * @throws {Error} Si la validación falla
 */
export async function createMotor(motorData) {
  // Validar definición
  const validation = await validateMotorDefinition(motorData.definition);
  if (!validation.valid) {
    throw new Error(`Definición inválida: ${validation.error}`);
  }

  // Validar motor_key único
  const repo = getDefaultPdeMotorsRepo();
  const existing = await repo.getMotorByKey(motorData.motor_key);
  if (existing) {
    throw new Error(`Ya existe un motor con la clave "${motorData.motor_key}"`);
  }

  return await repo.createMotor(motorData);
}

/**
 * Actualiza un motor existente
 * 
 * @param {string} id - UUID del motor
 * @param {Object} patch - Campos a actualizar
 * @returns {Promise<Object|null>} Motor actualizado o null si no existe
 * @throws {Error} Si el motor está published o si la validación falla
 */
export async function updateMotor(id, patch) {
  const repo = getDefaultPdeMotorsRepo();
  const existing = await repo.getMotorById(id);

  if (!existing) {
    return null;
  }

  // No permitir editar motores published (solo duplicar)
  if (existing.status === 'published') {
    throw new Error('No se puede editar un motor publicado. Usa "duplicar" para crear una nueva versión.');
  }

  // Si se actualiza la definición, validarla
  if (patch.definition) {
    const validation = await validateMotorDefinition(patch.definition);
    if (!validation.valid) {
      throw new Error(`Definición inválida: ${validation.error}`);
    }
  }

  // Si se actualiza motor_key, verificar que sea único
  if (patch.motor_key && patch.motor_key !== existing.motor_key) {
    const existingWithKey = await repo.getMotorByKey(patch.motor_key);
    if (existingWithKey) {
      throw new Error(`Ya existe un motor con la clave "${patch.motor_key}"`);
    }
  }

  // Incrementar versión si se actualiza la definición
  if (patch.definition) {
    patch.version = existing.version + 1;
  }

  return await repo.updateMotor(id, patch);
}

/**
 * Elimina un motor (soft delete)
 * 
 * @param {string} id - UUID del motor
 * @returns {Promise<boolean>} true si se eliminó correctamente
 */
export async function softDeleteMotor(id) {
  const repo = getDefaultPdeMotorsRepo();
  return await repo.softDeleteMotor(id);
}

/**
 * Duplica un motor (crea una nueva versión)
 * 
 * @param {string} id - UUID del motor a duplicar
 * @returns {Promise<Object|null>} Motor duplicado o null si no existe el original
 */
export async function duplicateMotor(id) {
  const repo = getDefaultPdeMotorsRepo();
  return await repo.duplicateMotor(id);
}

/**
 * Publica un motor (cambia status a 'published')
 * 
 * @param {string} id - UUID del motor
 * @returns {Promise<Object|null>} Motor publicado o null si no existe
 * @throws {Error} Si la definición es inválida
 */
export async function publishMotor(id) {
  const repo = getDefaultPdeMotorsRepo();
  const motor = await repo.getMotorById(id);

  if (!motor) {
    return null;
  }

  // Validar definición antes de publicar
  const validation = await validateMotorDefinition(motor.definition);
  if (!validation.valid) {
    throw new Error(`No se puede publicar un motor con definición inválida: ${validation.error}`);
  }

  return await repo.updateMotor(id, { status: 'published' });
}

/**
 * Archiva un motor (cambia status a 'archived')
 * 
 * @param {string} id - UUID del motor
 * @returns {Promise<Object|null>} Motor archivado o null si no existe
 */
export async function archiveMotor(id) {
  const repo = getDefaultPdeMotorsRepo();
  return await repo.updateMotor(id, { status: 'archived' });
}

/**
 * Genera la estructura AXE que produce un motor con inputs dados
 * (Preparado para consumo futuro por el Editor de Recorridos)
 * 
 * @param {string} motorId - UUID del motor
 * @param {Object} inputs - Valores de inputs para el motor
 * @returns {Promise<Object>} Estructura AXE generada { steps, edges, captures }
 * @throws {Error} Si el motor no existe o los inputs son inválidos
 */
export async function generateAxeStructure(motorId, inputs = {}) {
  const motor = await getMotorById(motorId);
  if (!motor) {
    throw new Error(`Motor con ID ${motorId} no encontrado`);
  }

  // Validar inputs proporcionados
  const definition = motor.definition;
  for (const inputDef of definition.inputs) {
    if (inputDef.required && inputs[inputDef.key] === undefined) {
      throw new Error(`Input requerido "${inputDef.key}" no proporcionado`);
    }
    if (inputDef.type === 'enum' && inputs[inputDef.key] !== undefined) {
      if (!inputDef.options.includes(inputs[inputDef.key])) {
        throw new Error(`Valor "${inputs[inputDef.key]}" no es válido para input "${inputDef.key}". Opciones: ${inputDef.options.join(', ')}`);
      }
    }
  }

  // Por ahora, retornar la estructura base del motor
  // En el futuro, aquí se aplicaría la lógica de las rules para generar la estructura dinámica
  return {
    steps: definition.outputs.steps || [],
    edges: definition.outputs.edges || [],
    captures: definition.outputs.captures || []
  };
}

