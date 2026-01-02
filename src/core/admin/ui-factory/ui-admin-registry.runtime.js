/**
 * UI ADMIN REGISTRY RUNTIME v1 - AuriPortal Admin
 * 
 * Registry runtime de UIs Admin existentes.
 * 
 * IMPORTANTE:
 * - Estas entradas DESCRIBEN pantallas existentes, no las reemplazan
 * - Todas empiezan en status='draft' para migración gradual
 * - En shadow mode, solo validan y registran warnings
 * - En enforced mode, bloquean si no cumplen contratos
 * 
 * GENERADO AUTOMÁTICAMENTE por: scripts/discover-admin-screens.js
 * FECHA: 2025-12-29T20:33:20.118Z
 * 
 * ESTRUCTURA:
 * - Cada entrada debe cumplir UI Admin Registry Schema v1
 * - screenDef es opcional (se añadirá gradualmente)
 * - flags y sidebar se configuran según necesidades
 */

export const UI_ADMIN_REGISTRY_RUNTIME = {
  version: '1.0.0',
  entries: [
  {
    "id": "admin-dashboard",
    "routeKey": "admin-dashboard",
    "status": "active",
    "route": {
      "path": "/admin",
      "type": "island"
    },
    "schemaVersion": "1.0.0",
    "schemaValidation": {
      "validated": true,
      "validatedAt": "2025-12-29T20:40:00.000Z",
      "errors": []
    },
    "capabilities": [
      "CTX-001",
      "CTX-002",
      "OBS-002",
      "ACT-001",
      "NAV-001",
      "LAY-001"
    ],
    "flags": {
      "featureFlags": [],
      "permissions": [
        "admin:read"
      ],
      "systemModes": [
        "NORMAL",
        "DEGRADED"
      ]
    },
    "sidebar": {
      "visible": true,
      "section": "Dashboard",
      "order": 1
    },
    "metadata": {
      "tags": [
        "dashboard",
        "overview"
      ],
      "owner": "system",
      "createdAt": "2025-12-29T20:29:49.501Z",
      "updatedAt": "2025-12-29T20:40:00.000Z"
    },
    "screenDef": {
      "meta": {
        "id": "admin-dashboard",
        "name": "Admin Dashboard",
        "description": "Pantalla principal de administración de AuriPortal",
        "status": "active",
        "version": "1.0.0",
        "createdAt": "2025-12-29T20:29:49.501Z",
        "updatedAt": "2025-12-29T20:40:00.000Z",
        "owner": "system"
      },
      "route": {
        "key": "admin-dashboard",
        "path": "/admin",
        "type": "island"
      },
      "context": {
        "user": {
          "required": true
        },
        "systemMode": {
          "required": true,
          "blockWritesInBroken": true,
          "allowedModes": ["NORMAL", "DEGRADED"]
        },
        "featureFlags": {
          "required": true
        }
      },
      "permissions": {
        "read": ["admin:read"],
        "write": []
      },
      "capabilities": {
        "declared": ["CTX-001", "CTX-002", "OBS-002", "ACT-001", "NAV-001", "LAY-001"],
        "required": ["CTX-001", "LAY-001"]
      },
      "data": {
        "contracts": []
      },
      "actions": {
        "mutations": [],
        "queries": [
          {
            "id": "get-dashboard-stats",
            "entity": "system",
            "permission": "admin:read"
          }
        ],
        "navigation": []
      },
      "layout": {
        "template": "base",
        "placeholders": {
          "title": "Admin Dashboard",
          "content": "<div class=\"p-6\"><h1 class=\"text-2xl font-bold text-white mb-4\">Admin Dashboard</h1><p class=\"text-slate-300\">Panel de administración de AuriPortal</p></div>",
          "sidebar": "auto"
        },
        "capabilities": ["dashboard-layout", "welcome-message"],
        "theme": {
          "resolve": true
        }
      },
      "navigation": {
        "sidebar": {
          "source": "registry"
        },
        "filterByPermissions": true
      },
      "observability": {
        "traceId": {
          "propagate": true,
          "required": true
        },
        "logging": {
          "structured": true,
          "level": "info",
          "includeMetadata": true
        },
        "signals": {
          "onlyRegistered": true,
          "emitted": []
        }
      },
      "diagnostics": {
        "errorContract": {
          "version": "v1",
          "includeDiagnosis": true
        },
        "correlation": {
          "byTraceId": true
        }
      },
      "lifecycle": {
        "render": {
          "method": "renderAdminPage",
          "contextRequired": true
        }
      }
    }
  },
  {
    "id": "theme-studio-canon",
    "routeKey": "theme-studio-canon",
    "status": "draft",
    "route": {
      "path": "/admin/theme-studio-canon",
      "type": "island"
    },
    "schemaVersion": "1.0.0",
    "schemaValidation": {
      "validated": false,
      "validatedAt": null,
      "errors": []
    },
    "capabilities": [
      "CTX-001",
      "CTX-002",
      "CTX-003",
      "OBS-002",
      "ACT-001",
      "ACT-002",
      "NAV-001",
      "LAY-001",
      "THM-001",
      "THM-002"
    ],
    "flags": {
      "featureFlags": [],
      "permissions": [
        "admin:read",
        "admin:write"
      ],
      "systemModes": [
        "NORMAL",
        "DEGRADED"
      ]
    },
    "sidebar": {
      "visible": true,
      "section": "✨ El brillo de AuriPortal",
      "subsection": null,
      "order": 1
    },
    "metadata": {
      "tags": [
        "themes",
        "studio",
        "editor"
      ],
      "owner": "system",
      "createdAt": "2025-12-29T20:29:49.501Z",
      "updatedAt": "2025-12-29T20:33:20.115Z"
    }
  },
  {
    "id": "contexts-manager",
    "routeKey": "contexts-manager",
    "status": "draft",
    "route": {
      "path": "/admin/contexts",
      "type": "island"
    },
    "schemaVersion": "1.0.0",
    "schemaValidation": {
      "validated": false,
      "validatedAt": null,
      "errors": []
    },
    "capabilities": [
      "CTX-001",
      "CTX-002",
      "OBS-002",
      "ACT-001",
      "ACT-002",
      "NAV-001",
      "LAY-001",
      "SEC-002"
    ],
    "flags": {
      "featureFlags": [],
      "permissions": [
        "admin:read",
        "admin:write"
      ],
      "systemModes": [
        "NORMAL",
        "DEGRADED"
      ]
    },
    "sidebar": {
      "visible": true,
      "section": "✏️ EDITOR PDE",
      "subsection": null,
      "order": 1.5
    },
    "metadata": {
      "tags": [
        "contexts",
        "system",
        "management"
      ],
      "owner": "system",
      "createdAt": "2025-12-29T20:29:49.501Z",
      "updatedAt": "2025-12-29T20:33:20.115Z"
    }
  },
  {
    "id": "assembly-check",
    "routeKey": "assembly-check-page",
    "status": "active",
    "route": {
      "path": "/admin/system/assembly",
      "type": "island"
    },
    "schemaVersion": "1.0.0",
    "schemaValidation": {
      "validated": true,
      "validatedAt": "2025-12-29T20:45:00.000Z",
      "errors": []
    },
    "capabilities": [
      "CTX-001",
      "CTX-002",
      "OBS-002",
      "OBS-003",
      "ACT-001",
      "NAV-001",
      "LAY-001",
      "DIA-001"
    ],
    "flags": {
      "featureFlags": [],
      "permissions": [
        "admin:read"
      ],
      "systemModes": [
        "NORMAL",
        "DEGRADED"
      ]
    },
    "sidebar": {
      "visible": true,
      "section": "⚙️ System / Configuración",
      "subsection": null,
      "order": 6.5
    },
    "metadata": {
      "tags": [
        "assembly",
        "system",
        "validation"
      ],
      "owner": "system",
      "createdAt": "2025-12-29T20:29:49.501Z",
      "updatedAt": "2025-12-29T20:45:00.000Z"
    },
    "screenDef": {
      "meta": {
        "id": "assembly-check",
        "name": "Assembly Check",
        "description": "Sistema de validación de ensamblaje del sistema",
        "status": "active",
        "version": "1.0.0",
        "createdAt": "2025-12-29T20:29:49.501Z",
        "updatedAt": "2025-12-29T20:45:00.000Z",
        "owner": "system"
      },
      "route": {
        "key": "assembly-check-page",
        "path": "/admin/system/assembly",
        "type": "island"
      },
      "context": {
        "user": {
          "required": true
        },
        "systemMode": {
          "required": true,
          "blockWritesInBroken": true,
          "allowedModes": ["NORMAL", "DEGRADED"]
        },
        "featureFlags": {
          "required": true
        }
      },
      "permissions": {
        "read": ["admin:read"],
        "write": []
      },
      "capabilities": {
        "declared": ["CTX-001", "CTX-002", "OBS-002", "OBS-003", "ACT-001", "NAV-001", "LAY-001", "DIA-001"],
        "required": ["CTX-001", "LAY-001", "DIA-001"]
      },
      "data": {
        "contracts": []
      },
      "actions": {
        "mutations": [],
        "queries": [
          {
            "id": "get-assembly-status",
            "entity": "assembly",
            "permission": "admin:read"
          }
        ],
        "navigation": []
      },
      "layout": {
        "template": "base",
        "placeholders": {
          "title": "Assembly Check",
          "content": "<div class=\"p-6\"><h1 class=\"text-2xl font-bold text-white mb-4\">Assembly Check</h1><p class=\"text-slate-300\">Sistema de validación de ensamblaje del sistema</p></div>",
          "sidebar": "auto"
        },
        "capabilities": ["content-layout", "diagnostics-view"],
        "theme": {
          "resolve": true
        }
      },
      "navigation": {
        "sidebar": {
          "source": "registry"
        },
        "filterByPermissions": true
      },
      "observability": {
        "traceId": {
          "propagate": true,
          "required": true
        },
        "logging": {
          "structured": true,
          "level": "info",
          "includeMetadata": true
        },
        "signals": {
          "onlyRegistered": true,
          "emitted": []
        }
      },
      "diagnostics": {
        "errorContract": {
          "version": "v1",
          "includeDiagnosis": true
        },
        "correlation": {
          "byTraceId": true
        }
      },
      "lifecycle": {
        "render": {
          "method": "renderAdminPage",
          "contextRequired": true
        }
      }
    }
  },
  {
    "id": "admin-dashboard",
    "routeKey": "admin-dashboard-alias",
    "status": "draft",
    "route": {
      "path": "/admin/dashboard",
      "type": "island"
    },
    "schemaVersion": "1.0.0",
    "schemaValidation": {
      "validated": false,
      "validatedAt": null,
      "errors": []
    },
    "capabilities": [
      "CTX-001",
      "OBS-002",
      "ACT-001",
      "NAV-001",
      "LAY-001"
    ],
    "flags": {
      "featureFlags": [],
      "permissions": [
        "admin:read"
      ],
      "systemModes": [
        "NORMAL",
        "DEGRADED"
      ]
    },
    "sidebar": {
      "visible": true,
      "section": null,
      "subsection": null,
      "order": 1
    },
    "metadata": {
      "tags": [],
      "owner": "system",
      "createdAt": "2025-12-29T20:29:49.502Z",
      "updatedAt": "2025-12-29T20:33:20.115Z"
    }
  },
  {
    "id": "admin-pde-transmutaciones-energeticas",
    "routeKey": "transmutaciones-energeticas",
    "status": "active",
    "route": {
      "path": "/admin/pde/transmutaciones-energeticas",
      "type": "island"
    },
    "schemaVersion": "1.0.0",
    "schemaValidation": {
      "validated": true,
      "validatedAt": "2025-12-29T20:45:00.000Z",
      "errors": []
    },
    "capabilities": [
      "CTX-001",
      "OBS-002",
      "ACT-001",
      "NAV-001",
      "LAY-001"
    ],
    "flags": {
      "featureFlags": [],
      "permissions": [
        "admin:read"
      ],
      "systemModes": [
        "NORMAL",
        "DEGRADED"
      ]
    },
    "sidebar": {
      "visible": true,
      "section": "🌟 Transmutación energética de la PDE",
      "subsection": null,
      "order": 4
    },
    "metadata": {
      "tags": [],
      "owner": "system",
      "createdAt": "2025-12-29T20:29:49.502Z",
      "updatedAt": "2025-12-29T20:45:00.000Z"
    },
    "screenDef": {
      "meta": {
        "id": "admin-pde-transmutaciones-energeticas",
        "name": "Transmutaciones Energéticas",
        "description": "Gestión de transmutaciones energéticas de la PDE",
        "status": "active",
        "version": "1.0.0",
        "createdAt": "2025-12-29T20:29:49.502Z",
        "updatedAt": "2025-12-29T20:45:00.000Z",
        "owner": "system"
      },
      "route": {
        "key": "transmutaciones-energeticas",
        "path": "/admin/pde/transmutaciones-energeticas",
        "type": "island"
      },
      "context": {
        "user": {
          "required": true
        },
        "systemMode": {
          "required": true,
          "blockWritesInBroken": true,
          "allowedModes": ["NORMAL", "DEGRADED"]
        },
        "featureFlags": {
          "required": true
        }
      },
      "permissions": {
        "read": ["admin:read"],
        "write": []
      },
      "capabilities": {
        "declared": ["CTX-001", "OBS-002", "ACT-001", "NAV-001", "LAY-001"],
        "required": ["CTX-001", "LAY-001"]
      },
      "data": {
        "contracts": []
      },
      "actions": {
        "mutations": [],
        "queries": [
          {
            "id": "get-transmutaciones",
            "entity": "transmutaciones",
            "permission": "admin:read"
          }
        ],
        "navigation": []
      },
      "layout": {
        "template": "base",
        "placeholders": {
          "title": "Transmutaciones Energéticas",
          "content": "<div class=\"p-6\"><h1 class=\"text-2xl font-bold text-white mb-4\">Transmutaciones Energéticas</h1><p class=\"text-slate-300\">Gestión de transmutaciones energéticas de la PDE</p></div>",
          "sidebar": "auto"
        },
        "capabilities": ["content-layout", "list-view"],
        "theme": {
          "resolve": true
        }
      },
      "navigation": {
        "sidebar": {
          "source": "registry"
        },
        "filterByPermissions": true
      },
      "observability": {
        "traceId": {
          "propagate": true,
          "required": true
        },
        "logging": {
          "structured": true,
          "level": "info",
          "includeMetadata": true
        },
        "signals": {
          "onlyRegistered": true,
          "emitted": []
        }
      },
      "diagnostics": {
        "errorContract": {
          "version": "v1",
          "includeDiagnosis": true
        },
        "correlation": {
          "byTraceId": true
        }
      },
      "lifecycle": {
        "render": {
          "method": "renderAdminPage",
          "contextRequired": true
        }
      }
    }
  },
  {
    "id": "admin-tecnicas-limpieza",
    "routeKey": "tecnicas-limpieza",
    "status": "active",
    "route": {
      "path": "/admin/tecnicas-limpieza",
      "type": "island"
    },
    "schemaVersion": "1.0.0",
    "schemaValidation": {
      "validated": true,
      "validatedAt": "2025-12-29T20:45:00.000Z",
      "errors": []
    },
    "capabilities": [
      "CTX-001",
      "OBS-002",
      "ACT-001",
      "NAV-001",
      "LAY-001"
    ],
    "flags": {
      "featureFlags": [],
      "permissions": [
        "admin:read"
      ],
      "systemModes": [
        "NORMAL",
        "DEGRADED"
      ]
    },
    "sidebar": {
      "visible": true,
      "section": "📚 Contenido PDE",
      "subsection": null,
      "order": 1
    },
    "metadata": {
      "tags": [],
      "owner": "system",
      "createdAt": "2025-12-29T20:29:49.502Z",
      "updatedAt": "2025-12-29T20:45:00.000Z"
    },
    "screenDef": {
      "meta": {
        "id": "admin-tecnicas-limpieza",
        "name": "Técnicas de Limpieza",
        "description": "Gestión de técnicas de limpieza",
        "status": "active",
        "version": "1.0.0",
        "createdAt": "2025-12-29T20:29:49.502Z",
        "updatedAt": "2025-12-29T20:45:00.000Z",
        "owner": "system"
      },
      "route": {
        "key": "tecnicas-limpieza",
        "path": "/admin/tecnicas-limpieza",
        "type": "island"
      },
      "context": {
        "user": {
          "required": true
        },
        "systemMode": {
          "required": true,
          "blockWritesInBroken": true,
          "allowedModes": ["NORMAL", "DEGRADED"]
        },
        "featureFlags": {
          "required": true
        }
      },
      "permissions": {
        "read": ["admin:read"],
        "write": []
      },
      "capabilities": {
        "declared": ["CTX-001", "OBS-002", "ACT-001", "NAV-001", "LAY-001"],
        "required": ["CTX-001", "LAY-001"]
      },
      "data": {
        "contracts": []
      },
      "actions": {
        "mutations": [],
        "queries": [
          {
            "id": "get-tecnicas-limpieza",
            "entity": "tecnicas-limpieza",
            "permission": "admin:read"
          }
        ],
        "navigation": []
      },
      "layout": {
        "template": "base",
        "placeholders": {
          "title": "Técnicas de Limpieza",
          "content": "<div class=\"p-6\"><h1 class=\"text-2xl font-bold text-white mb-4\">Técnicas de Limpieza</h1><p class=\"text-slate-300\">Gestión de técnicas de limpieza</p></div>",
          "sidebar": "auto"
        },
        "capabilities": ["content-layout", "list-view"],
        "theme": {
          "resolve": true
        }
      },
      "navigation": {
        "sidebar": {
          "source": "registry"
        },
        "filterByPermissions": true
      },
      "observability": {
        "traceId": {
          "propagate": true,
          "required": true
        },
        "logging": {
          "structured": true,
          "level": "info",
          "includeMetadata": true
        },
        "signals": {
          "onlyRegistered": true,
          "emitted": []
        }
      },
      "diagnostics": {
        "errorContract": {
          "version": "v1",
          "includeDiagnosis": true
        },
        "correlation": {
          "byTraceId": true
        }
      },
      "lifecycle": {
        "render": {
          "method": "renderAdminPage",
          "contextRequired": true
        }
      }
    }
  },
  {
    "id": "admin-pde-catalog-registry",
    "routeKey": "catalog-registry",
    "status": "active",
    "route": {
      "path": "/admin/pde/catalog-registry",
      "type": "island"
    },
    "schemaVersion": "1.0.0",
    "schemaValidation": {
      "validated": true,
      "validatedAt": "2025-12-29T20:45:00.000Z",
      "errors": []
    },
    "capabilities": [
      "CTX-001",
      "OBS-002",
      "ACT-001",
      "NAV-001",
      "LAY-001"
    ],
    "flags": {
      "featureFlags": [],
      "permissions": [
        "admin:read"
      ],
      "systemModes": [
        "NORMAL",
        "DEGRADED"
      ]
    },
    "sidebar": {
      "visible": true,
      "section": "✏️ EDITOR PDE",
      "subsection": null,
      "order": 0.5
    },
    "metadata": {
      "tags": [],
      "owner": "system",
      "createdAt": "2025-12-29T20:29:49.502Z",
      "updatedAt": "2025-12-29T20:45:00.000Z"
    },
    "screenDef": {
      "meta": {
        "id": "admin-pde-catalog-registry",
        "name": "Catálogo Registry",
        "description": "Registry de catálogos de la PDE",
        "status": "active",
        "version": "1.0.0",
        "createdAt": "2025-12-29T20:29:49.502Z",
        "updatedAt": "2025-12-29T20:45:00.000Z",
        "owner": "system"
      },
      "route": {
        "key": "catalog-registry",
        "path": "/admin/pde/catalog-registry",
        "type": "island"
      },
      "context": {
        "user": {
          "required": true
        },
        "systemMode": {
          "required": true,
          "blockWritesInBroken": true,
          "allowedModes": ["NORMAL", "DEGRADED"]
        },
        "featureFlags": {
          "required": true
        }
      },
      "permissions": {
        "read": ["admin:read"],
        "write": []
      },
      "capabilities": {
        "declared": ["CTX-001", "OBS-002", "ACT-001", "NAV-001", "LAY-001"],
        "required": ["CTX-001", "LAY-001"]
      },
      "data": {
        "contracts": []
      },
      "actions": {
        "mutations": [],
        "queries": [
          {
            "id": "get-catalog-registry",
            "entity": "catalog-registry",
            "permission": "admin:read"
          }
        ],
        "navigation": []
      },
      "layout": {
        "template": "base",
        "placeholders": {
          "title": "Catálogo Registry",
          "content": "<div class=\"p-6\"><h1 class=\"text-2xl font-bold text-white mb-4\">Catálogo Registry</h1><p class=\"text-slate-300\">Registry de catálogos de la PDE</p></div>",
          "sidebar": "auto"
        },
        "capabilities": ["content-layout", "registry-view"],
        "theme": {
          "resolve": true
        }
      },
      "navigation": {
        "sidebar": {
          "source": "registry"
        },
        "filterByPermissions": true
      },
      "observability": {
        "traceId": {
          "propagate": true,
          "required": true
        },
        "logging": {
          "structured": true,
          "level": "info",
          "includeMetadata": true
        },
        "signals": {
          "onlyRegistered": true,
          "emitted": []
        }
      },
      "diagnostics": {
        "errorContract": {
          "version": "v1",
          "includeDiagnosis": true
        },
        "correlation": {
          "byTraceId": true
        }
      },
      "lifecycle": {
        "render": {
          "method": "renderAdminPage",
          "contextRequired": true
        }
      }
    }
  },
  {
    "id": "admin-packages",
    "routeKey": "packages-creator",
    "status": "draft",
    "route": {
      "path": "/admin/packages",
      "type": "island"
    },
    "schemaVersion": "1.0.0",
    "schemaValidation": {
      "validated": false,
      "validatedAt": null,
      "errors": []
    },
    "capabilities": [
      "CTX-001",
      "OBS-002",
      "ACT-001",
      "NAV-001",
      "LAY-001"
    ],
    "flags": {
      "featureFlags": [],
      "permissions": [
        "admin:read"
      ],
      "systemModes": [
        "NORMAL",
        "DEGRADED"
      ]
    },
    "sidebar": {
      "visible": true,
      "section": "✏️ EDITOR PDE",
      "subsection": null,
      "order": 1.6
    },
    "metadata": {
      "tags": [],
      "owner": "system",
      "createdAt": "2025-12-29T20:29:49.502Z",
      "updatedAt": "2025-12-29T20:33:20.115Z"
    }
  },
  {
    "id": "admin-resolvers",
    "routeKey": "resolvers-studio",
    "status": "draft",
    "route": {
      "path": "/admin/resolvers",
      "type": "island"
    },
    "schemaVersion": "1.0.0",
    "schemaValidation": {
      "validated": false,
      "validatedAt": null,
      "errors": []
    },
    "capabilities": [
      "CTX-001",
      "OBS-002",
      "ACT-001",
      "NAV-001",
      "LAY-001"
    ],
    "flags": {
      "featureFlags": [],
      "permissions": [
        "admin:read"
      ],
      "systemModes": [
        "NORMAL",
        "DEGRADED"
      ]
    },
    "sidebar": {
      "visible": true,
      "section": "✏️ EDITOR PDE",
      "subsection": null,
      "order": 1.7
    },
    "metadata": {
      "tags": [],
      "owner": "system",
      "createdAt": "2025-12-29T20:29:49.502Z",
      "updatedAt": "2025-12-29T20:33:20.115Z"
    }
  },
  {
    "id": "admin-pde-widgets-v2",
    "routeKey": "widgets-creator-v2",
    "status": "draft",
    "route": {
      "path": "/admin/pde/widgets-v2",
      "type": "island"
    },
    "schemaVersion": "1.0.0",
    "schemaValidation": {
      "validated": false,
      "validatedAt": null,
      "errors": []
    },
    "capabilities": [
      "CTX-001",
      "OBS-002",
      "ACT-001",
      "NAV-001",
      "LAY-001"
    ],
    "flags": {
      "featureFlags": [],
      "permissions": [
        "admin:read"
      ],
      "systemModes": [
        "NORMAL",
        "DEGRADED"
      ]
    },
    "sidebar": {
      "visible": true,
      "section": "✏️ EDITOR PDE",
      "subsection": null,
      "order": 2
    },
    "metadata": {
      "tags": [],
      "owner": "system",
      "createdAt": "2025-12-29T20:29:49.502Z",
      "updatedAt": "2025-12-29T20:33:20.115Z"
    }
  },
  {
    "id": "admin-senales",
    "routeKey": "senales-manager",
    "status": "draft",
    "route": {
      "path": "/admin/senales",
      "type": "island"
    },
    "schemaVersion": "1.0.0",
    "schemaValidation": {
      "validated": false,
      "validatedAt": null,
      "errors": []
    },
    "capabilities": [
      "CTX-001",
      "OBS-002",
      "ACT-001",
      "NAV-001",
      "LAY-001"
    ],
    "flags": {
      "featureFlags": [],
      "permissions": [
        "admin:read"
      ],
      "systemModes": [
        "NORMAL",
        "DEGRADED"
      ]
    },
    "sidebar": {
      "visible": true,
      "section": "✏️ EDITOR PDE",
      "subsection": null,
      "order": 4
    },
    "metadata": {
      "tags": [],
      "owner": "system",
      "createdAt": "2025-12-29T20:29:49.502Z",
      "updatedAt": "2025-12-29T20:33:20.115Z"
    }
  },
  {
    "id": "admin-automations",
    "routeKey": "automation-definitions-list",
    "status": "draft",
    "route": {
      "path": "/admin/automations",
      "type": "island"
    },
    "schemaVersion": "1.0.0",
    "schemaValidation": {
      "validated": false,
      "validatedAt": null,
      "errors": []
    },
    "capabilities": [
      "CTX-001",
      "OBS-002",
      "ACT-001",
      "NAV-001",
      "LAY-001"
    ],
    "flags": {
      "featureFlags": [],
      "permissions": [
        "admin:read"
      ],
      "systemModes": [
        "NORMAL",
        "DEGRADED"
      ]
    },
    "sidebar": {
      "visible": true,
      "section": "✏️ EDITOR PDE",
      "subsection": null,
      "order": 5
    },
    "metadata": {
      "tags": [],
      "owner": "system",
      "createdAt": "2025-12-29T20:29:49.502Z",
      "updatedAt": "2025-12-29T20:33:20.115Z"
    }
  },
  {
    "id": "admin-automations-runs",
    "routeKey": "automation-runs-list",
    "status": "draft",
    "route": {
      "path": "/admin/automations/runs",
      "type": "island"
    },
    "schemaVersion": "1.0.0",
    "schemaValidation": {
      "validated": false,
      "validatedAt": null,
      "errors": []
    },
    "capabilities": [
      "CTX-001",
      "OBS-002",
      "ACT-001",
      "NAV-001",
      "LAY-001"
    ],
    "flags": {
      "featureFlags": [],
      "permissions": [
        "admin:read"
      ],
      "systemModes": [
        "NORMAL",
        "DEGRADED"
      ]
    },
    "sidebar": {
      "visible": true,
      "section": "⚙️ Automatizaciones",
      "subsection": null,
      "order": 2
    },
    "metadata": {
      "tags": [],
      "owner": "system",
      "createdAt": "2025-12-29T20:29:49.502Z",
      "updatedAt": "2025-12-29T20:33:20.115Z"
    }
  },
  {
    "id": "admin-navigation",
    "routeKey": "navigation-pages",
    "status": "draft",
    "route": {
      "path": "/admin/navigation",
      "type": "island"
    },
    "schemaVersion": "1.0.0",
    "schemaValidation": {
      "validated": false,
      "validatedAt": null,
      "errors": []
    },
    "capabilities": [
      "CTX-001",
      "OBS-002",
      "ACT-001",
      "NAV-001",
      "LAY-001"
    ],
    "flags": {
      "featureFlags": [],
      "permissions": [
        "admin:read"
      ],
      "systemModes": [
        "NORMAL",
        "DEGRADED"
      ]
    },
    "sidebar": {
      "visible": true,
      "section": "🧭 Navegaciones",
      "subsection": null,
      "order": 1
    },
    "metadata": {
      "tags": [],
      "owner": "system",
      "createdAt": "2025-12-29T20:29:49.502Z",
      "updatedAt": "2025-12-29T20:33:20.115Z"
    }
  },
  {
    "id": "admin-navigation-new",
    "routeKey": "navigation-new",
    "status": "draft",
    "route": {
      "path": "/admin/navigation/new",
      "type": "island"
    },
    "schemaVersion": "1.0.0",
    "schemaValidation": {
      "validated": false,
      "validatedAt": null,
      "errors": []
    },
    "capabilities": [
      "CTX-001",
      "OBS-002",
      "ACT-001",
      "NAV-001",
      "LAY-001"
    ],
    "flags": {
      "featureFlags": [],
      "permissions": [
        "admin:read"
      ],
      "systemModes": [
        "NORMAL",
        "DEGRADED"
      ]
    },
    "sidebar": {
      "visible": true,
      "section": "🧭 Navegaciones",
      "subsection": null,
      "order": 2
    },
    "metadata": {
      "tags": [],
      "owner": "system",
      "createdAt": "2025-12-29T20:29:49.502Z",
      "updatedAt": "2025-12-29T20:33:20.115Z"
    }
  },
  {
    "id": "admin-theme-bindings",
    "routeKey": "theme-bindings-ui",
    "status": "draft",
    "route": {
      "path": "/admin/theme-bindings",
      "type": "island"
    },
    "schemaVersion": "1.0.0",
    "schemaValidation": {
      "validated": false,
      "validatedAt": null,
      "errors": []
    },
    "capabilities": [
      "CTX-001",
      "OBS-002",
      "ACT-001",
      "NAV-001",
      "LAY-001"
    ],
    "flags": {
      "featureFlags": [],
      "permissions": [
        "admin:read"
      ],
      "systemModes": [
        "NORMAL",
        "DEGRADED"
      ]
    },
    "sidebar": {
      "visible": true,
      "section": "✨ El brillo de AuriPortal",
      "subsection": null,
      "order": 2
    },
    "metadata": {
      "tags": [],
      "owner": "system",
      "createdAt": "2025-12-29T20:29:49.502Z",
      "updatedAt": "2025-12-29T20:33:20.115Z"
    }
  },
  {
    "id": "admin-theme-diagnostics",
    "routeKey": "theme-diagnostics-ui",
    "status": "draft",
    "route": {
      "path": "/admin/theme-diagnostics",
      "type": "island"
    },
    "schemaVersion": "1.0.0",
    "schemaValidation": {
      "validated": false,
      "validatedAt": null,
      "errors": []
    },
    "capabilities": [
      "CTX-001",
      "OBS-002",
      "ACT-001",
      "NAV-001",
      "LAY-001"
    ],
    "flags": {
      "featureFlags": [],
      "permissions": [
        "admin:read"
      ],
      "systemModes": [
        "NORMAL",
        "DEGRADED"
      ]
    },
    "sidebar": {
      "visible": true,
      "section": "✨ El brillo de AuriPortal",
      "subsection": null,
      "order": 3
    },
    "metadata": {
      "tags": [],
      "owner": "system",
      "createdAt": "2025-12-29T20:29:49.502Z",
      "updatedAt": "2025-12-29T20:33:20.115Z"
    }
  },
  {
    "id": "admin-theme-docs",
    "routeKey": "theme-docs",
    "status": "draft",
    "route": {
      "path": "/admin/theme-docs",
      "type": "island"
    },
    "schemaVersion": "1.0.0",
    "schemaValidation": {
      "validated": false,
      "validatedAt": null,
      "errors": []
    },
    "capabilities": [
      "CTX-001",
      "OBS-002",
      "ACT-001",
      "NAV-001",
      "LAY-001"
    ],
    "flags": {
      "featureFlags": [],
      "permissions": [
        "admin:read"
      ],
      "systemModes": [
        "NORMAL",
        "DEGRADED"
      ]
    },
    "sidebar": {
      "visible": true,
      "section": "✨ El brillo de AuriPortal",
      "subsection": null,
      "order": 4
    },
    "metadata": {
      "tags": [],
      "owner": "system",
      "createdAt": "2025-12-29T20:29:49.502Z",
      "updatedAt": "2025-12-29T20:33:20.115Z"
    }
  },
  {
    "id": "admin-themes-studio-v3",
    "routeKey": "theme-studio-v3",
    "status": "draft",
    "route": {
      "path": "/admin/themes/studio-v3",
      "type": "island"
    },
    "schemaVersion": "1.0.0",
    "schemaValidation": {
      "validated": false,
      "validatedAt": null,
      "errors": []
    },
    "capabilities": [
      "CTX-001",
      "OBS-002",
      "ACT-001",
      "NAV-001",
      "LAY-001"
    ],
    "flags": {
      "featureFlags": [],
      "permissions": [
        "admin:read"
      ],
      "systemModes": [
        "NORMAL",
        "DEGRADED"
      ]
    },
    "sidebar": {
      "visible": true,
      "section": "🎨 Apariencia",
      "subsection": null,
      "order": 5
    },
    "metadata": {
      "tags": [],
      "owner": "system",
      "createdAt": "2025-12-29T20:29:49.502Z",
      "updatedAt": "2025-12-29T20:33:20.115Z"
    }
  },
  {
    "id": "admin-feature-flags",
    "routeKey": "feature-flags-ui",
    "status": "active",
    "route": {
      "path": "/admin/feature-flags",
      "type": "island"
    },
    "schemaVersion": "1.0.0",
    "schemaValidation": {
      "validated": true,
      "validatedAt": "2025-12-29T20:45:00.000Z",
      "errors": []
    },
    "capabilities": [
      "CTX-001",
      "OBS-002",
      "ACT-001",
      "NAV-001",
      "LAY-001"
    ],
    "flags": {
      "featureFlags": [],
      "permissions": [
        "admin:read"
      ],
      "systemModes": [
        "NORMAL",
        "DEGRADED"
      ]
    },
    "sidebar": {
      "visible": true,
      "section": "⚙️ System / Configuración",
      "subsection": null,
      "order": 7
    },
    "metadata": {
      "tags": [],
      "owner": "system",
      "createdAt": "2025-12-29T20:29:49.502Z",
      "updatedAt": "2025-12-29T20:45:00.000Z"
    },
    "screenDef": {
      "meta": {
        "id": "admin-feature-flags",
        "name": "Feature Flags",
        "description": "Gestión de feature flags del sistema",
        "status": "active",
        "version": "1.0.0",
        "createdAt": "2025-12-29T20:29:49.502Z",
        "updatedAt": "2025-12-29T20:45:00.000Z",
        "owner": "system"
      },
      "route": {
        "key": "feature-flags-ui",
        "path": "/admin/feature-flags",
        "type": "island"
      },
      "context": {
        "user": {
          "required": true
        },
        "systemMode": {
          "required": true,
          "blockWritesInBroken": true,
          "allowedModes": ["NORMAL", "DEGRADED"]
        },
        "featureFlags": {
          "required": true
        }
      },
      "permissions": {
        "read": ["admin:read"],
        "write": []
      },
      "capabilities": {
        "declared": ["CTX-001", "OBS-002", "ACT-001", "NAV-001", "LAY-001"],
        "required": ["CTX-001", "LAY-001"]
      },
      "data": {
        "contracts": []
      },
      "actions": {
        "mutations": [],
        "queries": [
          {
            "id": "get-feature-flags",
            "entity": "feature-flags",
            "permission": "admin:read"
          }
        ],
        "navigation": []
      },
      "layout": {
        "template": "base",
        "placeholders": {
          "title": "Feature Flags",
          "content": "<div class=\"p-6\"><h1 class=\"text-2xl font-bold text-white mb-4\">Feature Flags</h1><p class=\"text-slate-300\">Gestión de feature flags del sistema</p></div>",
          "sidebar": "auto"
        },
        "capabilities": ["content-layout", "flags-view"],
        "theme": {
          "resolve": true
        }
      },
      "navigation": {
        "sidebar": {
          "source": "registry"
        },
        "filterByPermissions": true
      },
      "observability": {
        "traceId": {
          "propagate": true,
          "required": true
        },
        "logging": {
          "structured": true,
          "level": "info",
          "includeMetadata": true
        },
        "signals": {
          "onlyRegistered": true,
          "emitted": []
        }
      },
      "diagnostics": {
        "errorContract": {
          "version": "v1",
          "includeDiagnosis": true
        },
        "correlation": {
          "byTraceId": true
        }
      },
      "lifecycle": {
        "render": {
          "method": "renderAdminPage",
          "contextRequired": true
        }
      }
    }
  }
]
};

/**
 * Busca una entrada por routeKey
 * @param {string} routeKey - Clave de ruta
 * @returns {Object|null} Entrada del registry o null
 */
export function findEntryByRouteKey(routeKey) {
  return UI_ADMIN_REGISTRY_RUNTIME.entries.find(entry => entry.routeKey === routeKey) || null;
}

/**
 * Busca una entrada por id
 * @param {string} id - ID de la entrada
 * @returns {Object|null} Entrada del registry o null
 */
export function findEntryById(id) {
  return UI_ADMIN_REGISTRY_RUNTIME.entries.find(entry => entry.id === id) || null;
}

/**
 * Obtiene todas las entradas activas
 * @returns {Array} Entradas con status='active'
 */
export function getActiveEntries() {
  return UI_ADMIN_REGISTRY_RUNTIME.entries.filter(entry => entry.status === 'active');
}

/**
 * Obtiene todas las entradas visibles en sidebar
 * @returns {Array} Entradas con sidebar.visible=true y status IN ('active', 'deprecated')
 */
export function getSidebarVisibleEntries() {
  return UI_ADMIN_REGISTRY_RUNTIME.entries.filter(entry => 
    entry.sidebar.visible && 
    (entry.status === 'active' || entry.status === 'deprecated')
  );
}
