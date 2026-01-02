/**
 * UI MASTER REGISTRY RUNTIME v1 - AuriPortal Master
 * 
 * Registry runtime de UIs Master existentes.
 * 
 * IMPORTANTE:
 * - Estas entradas DESCRIBEN pantallas existentes, no las reemplazan
 * - Todas empiezan en status='draft' para migración gradual
 * - En shadow mode, solo validan y registran warnings
 * - En enforced mode, bloquean si no cumplen contratos
 * 
 * ESTRUCTURA:
 * - Cada entrada debe cumplir UI Master Registry Schema v1
 * - screenDef es opcional (se añadirá gradualmente)
 * - flags y sidebar se configuran según necesidades
 */

export const UI_MASTER_REGISTRY_RUNTIME = {
  version: '1.0.0',
  entries: [
    {
      id: 'master-dashboard',
      routeKey: 'master-dashboard',
      status: 'draft',
      route: {
        path: '/master',
        type: 'island'
      },
      schemaVersion: '1.0.0',
      schemaValidation: {
        validated: false,
        validatedAt: null,
        errors: []
      },
      capabilities: [
        'CTX-001',
        'CTX-002',
        'OBS-002',
        'ACT-001',
        'NAV-001',
        'LAY-001'
      ],
      flags: {
        featureFlags: [],
        permissions: [
          'master:read'
        ],
        systemModes: [
          'NORMAL',
          'DEGRADED'
        ]
      },
      sidebar: {
        visible: true,
        section: null,
        order: 1
      },
      metadata: {
        tags: [
          'dashboard',
          'overview'
        ],
        owner: 'system',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    },
    {
      id: 'master-limpiezas',
      routeKey: 'master-limpiezas',
      status: 'draft',
      route: {
        path: '/master/limpiezas',
        type: 'island'
      },
      schemaVersion: '1.0.0',
      schemaValidation: {
        validated: false,
        validatedAt: null,
        errors: []
      },
      capabilities: [
        'CTX-001',
        'OBS-002',
        'ACT-001'
      ],
      flags: {
        featureFlags: [],
        permissions: [
          'master:read'
        ],
        systemModes: [
          'NORMAL',
          'DEGRADED'
        ]
      },
      sidebar: {
        visible: true,
        section: 'Limpiezas Energéticas',
        order: 1
      },
      metadata: {
        tags: [
          'limpiezas',
          'energeticas'
        ],
        owner: 'system',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    },
    {
      id: 'master-alumnos',
      routeKey: 'master-alumnos',
      status: 'draft',
      route: {
        path: '/master/alumnos',
        type: 'island'
      },
      schemaVersion: '1.0.0',
      schemaValidation: {
        validated: false,
        validatedAt: null,
        errors: []
      },
      capabilities: [
        'CTX-001',
        'OBS-002',
        'ACT-001'
      ],
      flags: {
        featureFlags: [],
        permissions: [
          'master:read'
        ],
        systemModes: [
          'NORMAL',
          'DEGRADED'
        ]
      },
      sidebar: {
        visible: true,
        section: 'Alumnos',
        order: 1
      },
      metadata: {
        tags: [
          'alumnos',
          'students'
        ],
        owner: 'system',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    },
    {
      id: 'master-systema',
      routeKey: 'master-systema',
      status: 'draft',
      route: {
        path: '/master/systema',
        type: 'island'
      },
      schemaVersion: '1.0.0',
      schemaValidation: {
        validated: false,
        validatedAt: null,
        errors: []
      },
      capabilities: [
        'CTX-001',
        'OBS-002',
        'ACT-001'
      ],
      flags: {
        featureFlags: [],
        permissions: [
          'master:read'
        ],
        systemModes: [
          'NORMAL',
          'DEGRADED'
        ]
      },
      sidebar: {
        visible: true,
        section: 'Systema',
        order: 1
      },
      metadata: {
        tags: [
          'systema',
          'system'
        ],
        owner: 'system',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    }
  ]
};

/**
 * Encuentra una entrada por routeKey
 * @param {string} routeKey - Key de la ruta
 * @returns {Object|null} Entrada del registry o null
 */
export function findEntryByRouteKey(routeKey) {
  return UI_MASTER_REGISTRY_RUNTIME.entries.find(entry => entry.routeKey === routeKey) || null;
}

/**
 * Encuentra todas las entradas activas
 * @returns {Array} Entradas con status='active'
 */
export function findActiveEntries() {
  return UI_MASTER_REGISTRY_RUNTIME.entries.filter(entry => entry.status === 'active');
}


