// context-provenance.js
// Provenance tracking para Context Resolver v1
//
// Responsabilidades:
// - Registrar de dónde vino cada valor resuelto
// - Rastrear precedence_level usado
// - Registrar warnings y notes

/**
 * Crea una entrada de provenance para un contexto resuelto
 * 
 * @param {Object} options - Opciones de provenance
 * @param {string} options.source - Fuente del valor ('input' | 'package_default' | 'pde_context' | 'snapshot' | 'derived' | 'registry_default' | 'fail_open')
 * @param {number} options.precedence_level - Nivel de precedencia usado (0-7)
 * @param {string} [options.path] - Path específico (ej: 'snapshot.student.nivelEfectivo')
 * @param {any} [options.value_before] - Valor antes de aplicar esta fuente (para debug)
 * @param {string[]} [options.notes] - Notas adicionales
 * @param {string[]} [options.warnings] - Warnings
 * @returns {Object} Entrada de provenance
 */
export function createProvenanceEntry({
  source,
  precedence_level,
  path = null,
  value_before = null,
  notes = [],
  warnings = []
}) {
  const entry = {
    source,
    precedence_level,
    ...(path && { path }),
    ...(value_before !== null && { value_before }),
    ...(notes.length > 0 && { notes }),
    ...(warnings.length > 0 && { warnings })
  };

  return entry;
}

/**
 * Crea una entrada de provenance para input explícito
 */
export function createInputProvenance(path, value_before = null, notes = []) {
  return createProvenanceEntry({
    source: 'input',
    precedence_level: 1,
    path,
    value_before,
    notes: [...notes, 'Explicit input from execution context']
  });
}

/**
 * Crea una entrada de provenance para default de paquete
 */
export function createPackageDefaultProvenance(context_key, value_before = null, notes = []) {
  return createProvenanceEntry({
    source: 'package_default',
    precedence_level: 2,
    path: `package.definition.context_contract.inputs[${context_key}].default`,
    value_before,
    notes: [...notes, 'Default value from package contract']
  });
}

/**
 * Crea una entrada de provenance para PDE context persistente
 */
export function createPdeContextProvenance(context_key, path = null, value_before = null, notes = []) {
  return createProvenanceEntry({
    source: 'pde_context',
    precedence_level: 3,
    path: path || `pde_contexts.${context_key}.value`,
    value_before,
    notes: [...notes, 'Persistent value from pde_contexts table']
  });
}

/**
 * Crea una entrada de provenance para snapshot
 */
export function createSnapshotProvenance(snapshot_path, value_before = null, notes = []) {
  return createProvenanceEntry({
    source: 'snapshot',
    precedence_level: 4,
    path: `snapshot.${snapshot_path}`,
    value_before,
    notes: [...notes, `Mapped from snapshot.${snapshot_path}`]
  });
}

/**
 * Crea una entrada de provenance para contexto derivado
 */
export function createDerivedProvenance(context_key, calculation_function, dependencies = [], value_before = null, notes = []) {
  return createProvenanceEntry({
    source: 'derived',
    precedence_level: 5,
    path: `derived.${context_key}`,
    value_before,
    notes: [
      ...notes,
      `Calculated using ${calculation_function}`,
      ...(dependencies.length > 0 ? [`Depends on: ${dependencies.join(', ')}`] : [])
    ]
  });
}

/**
 * Crea una entrada de provenance para default del registry
 */
export function createRegistryDefaultProvenance(context_key, value_before = null, notes = []) {
  return createProvenanceEntry({
    source: 'registry_default',
    precedence_level: 6,
    path: `registry.${context_key}.default_value`,
    value_before,
    notes: [...notes, 'Default value from Context Registry']
  });
}

/**
 * Crea una entrada de provenance para fail-open
 */
export function createFailOpenProvenance(context_key, type, value_before = null, warnings = []) {
  return createProvenanceEntry({
    source: 'fail_open',
    precedence_level: 7,
    path: null,
    value_before,
    warnings: [
      ...warnings,
      `Context '${context_key}' resolved using fail-open default (type: ${type})`
    ],
    notes: ['Fail-open safe default applied']
  });
}

