// context-precedence.js
// Precedencia canónica para resolución de contextos
//
// Implementa los 7 niveles de precedencia según CONTEXT_RESOLVER_V1.md:
// 1. Inputs explícitos
// 2. Package defaults
// 3. PDE Contexts persistentes
// 4. Snapshot fields
// 5. Derived contexts
// 6. Registry defaults
// 7. Fail-open seguro

import { getContext } from '../../services/pde-contexts-service.js';
import { getDefaultValueForContext } from '../contexts/context-registry.js';
import { getFailOpenValue } from './context-validation.js';
import {
  createInputProvenance,
  createPackageDefaultProvenance,
  createPdeContextProvenance,
  createSnapshotProvenance,
  createRegistryDefaultProvenance,
  createFailOpenProvenance
} from './context-provenance.js';

/**
 * Resuelve un contexto aplicando precedencia canónica
 * 
 * @param {Object} options - Opciones de resolución
 * @param {string} options.context_key - Clave del contexto a resolver
 * @param {Object} options.executionContext - ExecutionContext completo
 * @param {Object} options.contextRequest - ContextRequest
 * @returns {Promise<Object>} { value: any, provenance: Object }
 */
export async function resolveContextWithPrecedence({
  context_key,
  executionContext,
  contextRequest
}) {
  const { inputs, snapshot, target } = executionContext;
  const provenance = {};

  // Nivel 1: Inputs explícitos de la ejecución
  if (inputs && inputs[context_key] !== undefined) {
    return {
      value: inputs[context_key],
      provenance: createInputProvenance(
        `executionContext.inputs.${context_key}`,
        null,
        []
      )
    };
  }

  // Nivel 2: Package defaults (solo para paquetes)
  if (target && target.type === 'package' && target.definition) {
    const packageDefaults = getPackageDefaults(target.definition, context_key);
    if (packageDefaults !== null && packageDefaults !== undefined) {
      return {
        value: packageDefaults,
        provenance: createPackageDefaultProvenance(
          context_key,
          null,
          []
        )
      };
    }
  }

  // Nivel 3: PDE Contexts persistentes (desde PostgreSQL)
  // NOTA: Por ahora, los contextos en pde_contexts no tienen valores persistentes almacenados,
  // solo definiciones. Este nivel se implementará en fases futuras cuando se añada
  // la capacidad de almacenar valores persistentes por contexto.
  // Por ahora, skip este nivel.

  // Nivel 4: Snapshot fields
  const snapshotValue = getSnapshotValue(context_key, snapshot);
  if (snapshotValue !== null && snapshotValue !== undefined) {
    const snapshotPath = getSnapshotPath(context_key);
    return {
      value: snapshotValue,
      provenance: createSnapshotProvenance(
        snapshotPath,
        null,
        []
      )
    };
  }

  // Nivel 5: Derived contexts (no implementado en esta fase, se implementará en futuro)
  // Por ahora, skip

  // Nivel 6: Registry default value
  try {
    const contextDef = await getContext(context_key);
    if (contextDef) {
      const defaultValue = getDefaultValueForContext(contextDef.definition || contextDef);
      if (defaultValue !== null && defaultValue !== undefined) {
        return {
          value: defaultValue,
          provenance: createRegistryDefaultProvenance(
            context_key,
            null,
            []
          )
        };
      }
    }
  } catch (error) {
    // Silenciar errores, continuar con fail-open
  }

  // Nivel 7: Fail-open seguro
  let failOpenType = 'string';
  let failOpenAllowedValues = null;

  try {
    const contextDef = await getContext(context_key);
    if (contextDef) {
      failOpenType = (contextDef.definition || contextDef).type || 'string';
      failOpenAllowedValues = (contextDef.definition || contextDef).allowed_values || null;
    }
  } catch (error) {
    // Usar defaults seguros
  }

  const failOpenValue = getFailOpenValue(failOpenType, failOpenAllowedValues);

  return {
    value: failOpenValue,
    provenance: createFailOpenProvenance(
      context_key,
      failOpenType,
      null,
      [`Using fail-open default for context '${context_key}'`]
    )
  };
}

/**
 * Obtiene defaults del paquete para un contexto
 * 
 * @param {Object} packageDefinition - Definición del paquete
 * @param {string} context_key - Clave del contexto
 * @returns {any|null} Default del paquete o null si no existe
 */
function getPackageDefaults(packageDefinition, context_key) {
  if (!packageDefinition || !packageDefinition.context_contract) {
    return null;
  }

  const { inputs = [] } = packageDefinition.context_contract;

  // Buscar input que coincida con context_key
  const input = inputs.find(inp => inp.key === context_key || inp.context_key === context_key);
  if (input && input.default !== undefined && input.default !== null) {
    return input.default;
  }

  return null;
}

/**
 * Mapea context_key a valor del snapshot
 * 
 * @param {string} context_key - Clave del contexto
 * @param {Object} snapshot - Context Snapshot v1
 * @returns {any|null} Valor del snapshot o null si no existe
 */
function getSnapshotValue(context_key, snapshot) {
  if (!snapshot) {
    return null;
  }

  // Mapeo de context_keys comunes a paths del snapshot
  const snapshotMappings = {
    // Identity
    'actor_type': snapshot.identity?.actorType,
    'actor_id': snapshot.identity?.actorId,
    'alumno_id': snapshot.identity?.actorType === 'student' ? snapshot.identity?.actorId : null,
    'alumno_email': snapshot.identity?.actorType === 'student' ? snapshot.identity?.email : null,
    'is_authenticated': snapshot.identity?.isAuthenticated,

    // Environment
    'app_env': snapshot.environment?.env,
    'environment': snapshot.environment?.context,
    'screen': snapshot.environment?.screen,
    'editor': snapshot.environment?.editor,
    'sidebar_context': snapshot.environment?.sidebarContext,
    'navigation_zone': snapshot.environment?.navigationZone,

    // Time
    'time_now': snapshot.time?.now,
    'day_key': snapshot.time?.dayKey,
    'timestamp': snapshot.time?.timestamp,

    // Student (solo si existe)
    'nivel_efectivo': snapshot.student?.nivelEfectivo,
    'nivel_base': snapshot.student?.nivelBase,
    'fase_efectiva': snapshot.student?.faseEfectiva?.id,
    'nombre_nivel': snapshot.student?.nombreNivel,
    'tiene_overrides': snapshot.student?.tieneOverrides,
    'streak': snapshot.student?.streak,
    'today_practiced': snapshot.student?.todayPracticed,
    'ultimo_dia_con_practica': snapshot.student?.ultimoDiaConPractica,
    'congelada_por_pausa': snapshot.student?.congeladaPorPausa,
    'dias_congelados': snapshot.student?.diasCongelados,
    'suscripcion_pausada': snapshot.student?.suscripcionPausada,
    'puede_practicar': snapshot.student?.puedePracticar,

    // Flags (con prefijo flag_)
    ...(snapshot.flags ? Object.keys(snapshot.flags).reduce((acc, flagName) => {
      acc[`flag_${flagName}`] = snapshot.flags[flagName];
      return acc;
    }, {}) : {})
  };

  return snapshotMappings[context_key] !== undefined ? snapshotMappings[context_key] : null;
}

/**
 * Obtiene el path del snapshot para un context_key
 * 
 * @param {string} context_key - Clave del contexto
 * @returns {string} Path en el snapshot
 */
function getSnapshotPath(context_key) {
  // Mapeo de context_keys a paths del snapshot
  const pathMappings = {
    'actor_type': 'identity.actorType',
    'actor_id': 'identity.actorId',
    'alumno_id': 'identity.actorId',
    'alumno_email': 'identity.email',
    'is_authenticated': 'identity.isAuthenticated',
    'app_env': 'environment.env',
    'environment': 'environment.context',
    'screen': 'environment.screen',
    'editor': 'environment.editor',
    'sidebar_context': 'environment.sidebarContext',
    'navigation_zone': 'environment.navigationZone',
    'time_now': 'time.now',
    'day_key': 'time.dayKey',
    'timestamp': 'time.timestamp',
    'nivel_efectivo': 'student.nivelEfectivo',
    'nivel_base': 'student.nivelBase',
    'fase_efectiva': 'student.faseEfectiva.id',
    'nombre_nivel': 'student.nombreNivel',
    'tiene_overrides': 'student.tieneOverrides',
    'streak': 'student.streak',
    'today_practiced': 'student.todayPracticed',
    'ultimo_dia_con_practica': 'student.ultimoDiaConPractica',
    'congelada_por_pausa': 'student.congeladaPorPausa',
    'dias_congelados': 'student.diasCongelados',
    'suscripcion_pausada': 'student.suscripcionPausada',
    'puede_practicar': 'student.puedePracticar'
  };

  // Si es un flag, usar path dinámico
  if (context_key.startsWith('flag_')) {
    const flagName = context_key.substring(5);
    return `flags.${flagName}`;
  }

  return pathMappings[context_key] || `snapshot.${context_key}`;
}
