/**
 * Alquimia Contracts v1 - Contratos canónicos para Alquimia General y Alquimia del Alumno
 * 
 * Este módulo define los contratos formales que gobiernan:
 * - Catálogo de Alquimia (listas e items)
 * - Megalist por alumno (con seed)
 * - Operaciones de limpieza
 * - Historial de items
 * - Reportes (técnico + humano)
 * - Clasificaciones globales
 */

/**
 * Contract: AlquimiaCatalog v1
 * 
 * Define la estructura canónica del catálogo de alquimia:
 * - Listas de transmutaciones (status='active'|'archived')
 * - Items de transmutaciones (item_ref como identidad externa)
 * - Ordenamiento canónico: listas por (orden ASC, nombre ASC), items por (priority ASC, nivel ASC, created_at ASC)
 */
export const AlquimiaCatalogV1 = {
  contract_id: 'alquimia.catalog.v1',
  name: 'Alquimia Catalog Contract v1',
  version: '1.0.0',
  
  // Campos canónicos para listas
  lista_fields: {
    required: ['id', 'nombre', 'tipo', 'status'],
    optional: ['descripcion', 'orden', 'created_at', 'updated_at'],
    deprecated: ['activo'], // Legacy: usar status='active'|'archived'
    legacy_metadata: ['category_key', 'subtype_key', 'tags'] // Legacy: usar pde_classification_terms
  },
  
  // Campos canónicos para items
  item_fields: {
    required: ['id', 'lista_id', 'nombre', 'item_ref', 'nivel', 'status'],
    optional: ['descripcion', 'frecuencia_dias', 'veces_limpiar', 'prioridad', 'grupo', 'created_at', 'updated_at'],
    deprecated: ['activo', 'orden'], // Legacy: usar status y priority
    metadata_defaults: {
      critical_multiplier: 2.0 // No existe en schema, se usa como default
    }
  },
  
  // Ordenamiento canónico
  ordering: {
    listas: 'ORDER BY orden ASC, nombre ASC',
    items: 'ORDER BY priority ASC, nivel ASC NULLS LAST, created_at ASC'
  },
  
  // Validación de status
  status_values: {
    active: 'active',
    archived: 'archived'
  },
  
  // Validación de tipos de lista
  lista_tipo_values: {
    recurrente: 'recurrente',
    una_vez: 'una_vez'
  }
};

/**
 * Contract: AlquimiaAlumnoMegalist v2
 * 
 * Define la estructura de la megalist por alumno:
 * - Se construye desde catálogo (estructura) + cleaning_item_state (estado)
 * - Incluye seed automático de estados "NUNCA" para items aplicables
 * - Filtrado por nivel_efectivo del alumno
 */
export const AlquimiaAlumnoMegalistV2 = {
  contract_id: 'alquimia.alumno.megalist.v2',
  name: 'Alquimia Alumno Megalist Contract v2',
  version: '2.0.0',
  
  // Seed canónico
  seed: {
    required: true, // Siempre ejecutar antes de construir megalist
    filter_by_level: true, // Solo items con nivel <= nivel_efectivo
    idempotent: true, // ON CONFLICT DO NOTHING
    mass_insert: true // 1 query, no loops
  },
  
  // Estructura de respuesta
  response_structure: {
    student: {
      required: ['id', 'student_id', 'email', 'nivel_efectivo', 'level_cap']
    },
    summary: {
      required: ['total', 'never', 'important', 'pending', 'reviewed', 'percent_reviewed'],
      optional: ['reviewed_by_student', 'reviewed_by_master']
    },
    lists: {
      structure: {
        lista_id: 'number',
        lista_nombre: 'string',
        lista_tipo: 'recurrente|una_vez',
        never: 'array<item>',
        important: 'array<item>',
        pending: 'array<item>',
        reviewed_by_student: 'array<item>',
        reviewed_by_master: 'array<item>'
      },
      item_structure: {
        required: ['item_id', 'item_ref', 'item_nombre', 'item_nivel', 'lista_id', 'lista_nombre', 'state'],
        optional: ['shared_last_cleaned_at', 'shared_clean_count', 'shared_completed', 'shared_remaining', 'last_actor']
      }
    },
    context: {
      required: ['clean_layer', 'level_cap'],
      optional: ['levels_mode', 'level_cap_provided']
    }
  },
  
  // Estados de items
  item_states: {
    never: 'never', // Nunca limpiado
    important: 'important', // Requiere atención urgente
    pending: 'pending', // Requiere limpieza
    reviewed: 'reviewed' // Limpio recientemente
  }
};

/**
 * Contract: CleaningSeed v1
 * 
 * Define el contrato del servicio de seed de estados "NUNCA"
 */
export const CleaningSeedV1 = {
  contract_id: 'cleaning.seed.v1',
  name: 'Cleaning Seed Contract v1',
  version: '1.0.0',
  
  // Requisitos
  requirements: {
    idempotent: true, // ON CONFLICT DO NOTHING
    mass_insert: true, // 1 query INSERT...SELECT, no loops
    filter_by_level: true, // Solo items con nivel <= nivel_efectivo
    exclude_paused: true // Excluir estudiantes en pausa (si aplica)
  },
  
  // Estado "NUNCA" canónico
  never_state: {
    shared_last_cleaned_at: null,
    pde_last_cleaned_at: null,
    shared_clean_count: 0,
    pde_clean_count: 0,
    shared_completed: 0,
    shared_remaining: 0, // Para una_vez: se actualiza después según veces_limpiar
    pde_completed: 0,
    meta: {}
  },
  
  // Respuesta
  response_structure: {
    required: ['inserted', 'skipped', 'total_applicable', 'total_existing']
  }
};

/**
 * Contract: CleanItem v1
 * 
 * Define el contrato para la operación de limpiar un item
 */
export const CleanItemV1 = {
  contract_id: 'cleaning.clean.item.v1',
  name: 'Clean Item Contract v1',
  version: '1.0.0',
  
  // Validación
  validation: {
    required_params: ['student_id', 'item_ref', 'product_key', 'domain_type'],
    optional_params: ['actor_ref', 'surface_key', 'level_cap'],
    validate_state_exists: true, // Debe existir en cleaning_item_state (seed si falta)
    validate_item_applicable: true // Item debe existir y nivel <= nivel_efectivo
  },
  
  // Operación
  operation: {
    event_append_only: true, // cleaning_events (idempotente por execution_key)
    projection_update: true, // cleaning_item_state
    sync_shared: true // Sincronizar a student_item_state si clean_layer='shared'
  },
  
  // Respuesta
  response_structure: {
    success: {
      required: ['ok', 'data', 'trace_id'],
      data_required: ['applied', 'state']
    },
    error_codes: {
      'STATE_NOT_FOUND': 400,
      'ITEM_NOT_APPLICABLE': 400,
      'ITEM_NOT_FOUND': 404,
      'DUPLICATE_EXECUTION': 409,
      'STUDENT_PAUSED': 400
    }
  }
};

/**
 * Contract: ItemHistory v1
 * 
 * Define el contrato para el historial de un item (dos paneles: técnico + humano)
 */
export const ItemHistoryV1 = {
  contract_id: 'alquimia.item.history.v1',
  name: 'Item History Contract v1',
  version: '1.0.0',
  
  // Estructura de respuesta (dos paneles)
  response_structure: {
    technical_panel: {
      visible: false, // Colapsado por defecto en UI
      structure: {
        events: 'array<event>',
        event_structure: {
          required: ['id', 'created_at', 'item_ref', 'action_type', 'clean_layer', 'actor_type', 'execution_key'],
          optional: ['actor_ref', 'surface_key', 'meta', 'delta_completed', 'set_remaining']
        }
      }
    },
    human_panel: {
      visible: true, // Visible por defecto en UI
      structure: {
        item: {
          required: ['item_ref', 'item_nombre', 'lista_id', 'lista_nombre'],
          optional: ['descripcion', 'nivel', 'clasificaciones']
        },
        events: 'array<resolved_event>',
        resolved_event_structure: {
          required: ['id', 'created_at', 'item_nombre', 'lista_nombre', 'action_type', 'actor_type'],
          optional: ['actor_ref', 'surface_key', 'clasificaciones']
        },
        grouping: {
          by_lista: true, // Agrupar por lista
          by_classification: true, // Agrupar por clasificaciones (category/subcategory/tags)
          by_date: true // Agrupar por fecha
        }
      }
    }
  },
  
  // Batch resolution
  batch_resolution: {
    catalog_items: true, // Resolver items desde catálogo (batch)
    listas: true, // Resolver listas desde catálogo (batch)
    classifications: true // Resolver clasificaciones desde pde_classification_terms (batch)
  }
};

/**
 * Contract: AlquimiaAlumnoReport v1
 * 
 * Define el contrato para el reporte de alquimia del alumno (dos paneles: técnico + humano)
 */
export const AlquimiaAlumnoReportV1 = {
  contract_id: 'alquimia.alumno.report.v1',
  name: 'Alquimia Alumno Report Contract v1',
  version: '1.0.0',
  
  // Parámetros
  params: {
    required: ['student_id'],
    optional: ['days', 'range_days'] // Default: 30 días
  },
  
  // Estructura de respuesta (dos paneles)
  response_structure: {
    technical_panel: {
      visible: false, // Colapsado por defecto en UI
      structure: {
        totals: {
          required: ['total_events', 'master_events', 'student_events'],
          optional: ['events_by_day', 'top_items_by_events']
        },
        dataset: {
          events: 'array<raw_event>', // Eventos raw desde cleaning_events
          execution_keys: 'array<string>'
        }
      }
    },
    human_panel: {
      visible: true, // Visible por defecto en UI
      structure: {
        grouped_by_lista: {
          lista_id: 'number',
          lista_nombre: 'string',
          items: 'array<item_with_events>',
          item_structure: {
            required: ['item_ref', 'item_nombre', 'events_count'],
            optional: ['descripcion', 'nivel', 'last_cleaned_at']
          }
        },
        grouped_by_classification: {
          category: 'string|null',
          subcategory: 'string|null',
          tags: 'array<string>',
          items: 'array<item_with_events>'
        },
        filters: {
          category: 'string|null', // Filtro opcional por categoría
          date_range: 'date_range' // Filtro opcional por rango de fechas
        }
      }
    },
    metadata: {
      required: ['days', 'since_date', 'student_id'],
      optional: ['total_items', 'total_listas']
    }
  },
  
  // Batch resolution
  batch_resolution: {
    catalog_items: true,
    listas: true,
    classifications: true,
    event_aggregation: true // Agregar eventos por item_ref
  }
};

/**
 * Contract: ClassificationGlobal v1
 * 
 * Define el contrato para el consumo de clasificaciones globales
 */
export const ClassificationGlobalV1 = {
  contract_id: 'classification.global.v1',
  name: 'Classification Global Contract v1',
  version: '1.0.0',
  
  // Source of Truth
  source_of_truth: {
    terms: 'pde_classification_terms', // Tabla SOT para términos (key/subkey/tag)
    relationships: 'transmutacion_lista_classifications' // Tabla de relación many-to-many
  },
  
  // Tipos de términos
  term_types: {
    key: 'key', // Categoría principal (max 1 por lista)
    subkey: 'subkey', // Subcategoría (max 1 por lista)
    tag: 'tag' // Tags (múltiples por lista)
  },
  
  // Consumo en Alquimia
  consumption: {
    alquimia_general: {
      ui_management: true, // Permitir gestionar category/subcategory/tags en UI
      api_endpoints: ['/master/api/alquimia-general/listas/:id/classification', '/master/api/classifications', '/master/api/tags']
    },
    alquimia_alumno: {
      report_human_panel: true, // Usar clasificaciones para agrupación en report
      optional_filters: true // Permitir filtrar por category/subcategory/tags
    }
  },
  
  // Normalización
  normalization: {
    function: 'normalize_classification_term', // Función PostgreSQL para normalizar
    rules: {
      lowercase: true,
      no_accents: true,
      trim: true
    }
  }
};

// Exportar todos los contratos
export const ALQUIMIA_CONTRACTS = {
  AlquimiaCatalogV1,
  AlquimiaAlumnoMegalistV2,
  CleaningSeedV1,
  CleanItemV1,
  ItemHistoryV1,
  AlquimiaAlumnoReportV1,
  ClassificationGlobalV1
};
