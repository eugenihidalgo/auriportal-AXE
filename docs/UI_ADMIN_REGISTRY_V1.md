# AuriPortal — UI Admin Registry v1

**Versión:** 1.0.0  
**Estado:** DRAFT  
**Fecha:** 2025-01-XX

---

## 1. Definición Ontológica del UI Admin Registry

### 1.1. Naturaleza y Rol

El **UI Admin Registry** es el **Source of Truth canónico** para todas las pantallas Admin de AuriPortal. Es el sistema de gobierno que declara, valida y controla el ciclo de vida de las UIs Admin.

**No es:**
- Un simple listado de rutas
- Un archivo de configuración estático
- Un sistema de routing
- Un generador de código

**Es:**
- Un **registry canónico** que declara qué UIs Admin existen y en qué estado están
- Un **sistema de validación** que garantiza que todas las UIs Admin cumplen el Contrato Canónico v1
- Un **gobierno centralizado** que controla visibilidad, activación y deprecación de pantallas
- Un **punto de integración** que conecta Router Registry, Sidebar Registry, Assembly Check y Editor de Pantallas
- Un **sistema de estados** que gestiona el ciclo de vida de las UIs Admin (draft → active → deprecated → hidden)

### 1.2. Responsabilidades

El UI Admin Registry tiene las siguientes responsabilidades **obligatorias**:

#### 1.2.1. Declaración Canónica
- **Registro:** Declarar todas las UIs Admin existentes con metadata completa
- **Identificación:** Asignar IDs canónicos únicos e inmutables
- **Versionado:** Gestionar versiones de UIs Admin
- **Estado:** Gestionar estados del ciclo de vida (draft, active, deprecated, hidden)

#### 1.2.2. Validación y Cumplimiento
- **Validación de Schema:** Verificar que cada UI Admin cumple el UI Admin Schema v1
- **Validación de Contrato:** Garantizar cumplimiento del Contrato Canónico v1
- **Validación de Invariantes:** Prevenir violaciones de invariantes (INV-001 a INV-028)
- **Validación de Garantías:** Asegurar que las garantías (GAR-001 a GAR-029) se cumplen

#### 1.2.3. Gobierno y Control
- **Visibilidad:** Controlar qué UIs Admin aparecen en el sidebar
- **Activación:** Controlar qué UIs Admin están activas y accesibles
- **Deprecación:** Gestionar el retiro controlado de UIs Admin obsoletas
- **Flags:** Gestionar flags de activación (feature flags, permisos, modos del sistema)

#### 1.2.4. Integración con Sistemas
- **Router Registry:** Proporcionar información de routing para resolución de rutas
- **Sidebar Registry:** Proporcionar información de navegación para generación de sidebar
- **Assembly Check:** Proporcionar metadata para validación en build-time y runtime
- **Editor de Pantallas:** Proporcionar contratos y metadata para creación/edición de UIs Admin

### 1.3. Responsabilidades que NO tiene

El UI Admin Registry **NO es responsable de**:

#### 1.3.1. Routing
- **NO resuelve rutas:** El Router Registry y Router Resolver se encargan de la resolución
- **NO maneja requests:** No procesa requests HTTP directamente
- **NO renderiza:** No renderiza HTML ni ejecuta handlers

#### 1.3.2. Validación de Runtime
- **NO valida en runtime:** La validación de runtime es responsabilidad de los guards y garantías
- **NO valida permisos:** La validación de permisos es responsabilidad del sistema de seguridad
- **NO valida contexto:** La validación de contexto es responsabilidad del Context System

#### 1.3.3. Persistencia de UIs Admin
- **NO almacena UIs Admin:** Las UIs Admin se almacenan en archivos o base de datos, no en el registry
- **NO versiona código:** El versionado de código es responsabilidad del sistema de control de versiones
- **NO gestiona handlers:** La gestión de handlers es responsabilidad del sistema de routing

### 1.4. Diferenciación de Otros Registries

#### 1.4.1. UI Admin Registry vs Router Registry

| Aspecto | UI Admin Registry | Router Registry |
|---------|-------------------|-----------------|
| **Propósito** | Gobierno de UIs Admin | Resolución de rutas |
| **Alcance** | Solo UIs Admin (type='island') | Todas las rutas (api, island, legacy) |
| **Contenido** | Metadata completa de UI Admin | Información mínima de routing |
| **Validación** | Schema completo + Contrato | Estructura de ruta básica |
| **Estados** | draft, active, deprecated, hidden | No tiene estados |

**Regla:** El Router Registry declara **qué rutas existen**. El UI Admin Registry declara **qué UIs Admin existen y cómo se gobiernan**.

#### 1.4.2. UI Admin Registry vs Sidebar Registry

| Aspecto | UI Admin Registry | Sidebar Registry |
|---------|-------------------|------------------|
| **Propósito** | Gobierno de UIs Admin | Generación de sidebar |
| **Alcance** | Todas las UIs Admin (independiente de sidebar) | Solo UIs Admin visibles en sidebar |
| **Contenido** | Metadata completa + estado + flags | Información de navegación (jerarquía, orden) |
| **Visibilidad** | Controla si aparece en sidebar | Define cómo aparece en sidebar |

**Regla:** El UI Admin Registry controla **si** una UI Admin aparece en el sidebar. El Sidebar Registry controla **cómo** aparece.

#### 1.4.3. UI Admin Registry vs Assembly Check

| Aspecto | UI Admin Registry | Assembly Check |
|---------|-------------------|----------------|
| **Propósito** | Gobierno y declaración | Validación y verificación |
| **Alcance** | Registry de UIs Admin | Validación de todo el sistema |
| **Momento** | Declarativo (siempre presente) | Verificativo (build-time, boot-time) |
| **Acción** | Declara qué existe | Verifica que cumple contratos |

**Regla:** El UI Admin Registry **declara** qué UIs Admin existen. El Assembly Check **verifica** que cumplen contratos.

---

## 2. Entidad: UIAdminScreenRegistryEntry

### 2.1. Definición

Una **UIAdminScreenRegistryEntry** es una entrada en el UI Admin Registry que declara y gobierna una UI Admin. Cada entrada es inmutable en su ID pero mutable en su estado y metadata.

### 2.2. Estructura de la Entidad

#### 2.2.1. Identificación Canónica

**id** (string, requerido, inmutable)
- Identificador único canónico de la UI Admin
- Formato: `kebab-case` (ej: `admin-dashboard`, `student-list`, `automation-editor`)
- Debe ser único en todo el registry
- **Inmutable:** Una vez asignado, no puede cambiarse
- **Justificación:** Permite referencias estables desde otros sistemas (Router Registry, Sidebar Registry, Assembly Check)

**routeKey** (string, requerido, inmutable)
- Clave de ruta que coincide con Router Registry
- Debe existir en Router Registry con `type='island'`
- **Inmutable:** Una vez asignado, no puede cambiarse
- **Justificación:** Garantiza coherencia entre UI Admin Registry y Router Registry (INV-001)

#### 2.2.2. Estado del Ciclo de Vida

**status** (enum, requerido, mutable)
- Estados posibles: `draft`, `active`, `deprecated`, `hidden`
- **draft:** UI Admin en desarrollo, no accesible públicamente
- **active:** UI Admin activa y accesible
- **deprecated:** UI Admin obsoleta, accesible pero marcada para retiro
- **hidden:** UI Admin oculta, no accesible ni visible en sidebar
- **Justificación:** Permite gestión del ciclo de vida sin eliminar entradas (auditoría, rollback)

#### 2.2.3. Routing

**route** (object, requerido, mutable)
- **path** (string): Ruta de la UI Admin (debe coincidir con Router Registry)
- **type** (string, const: "island"): Tipo de ruta (solo "island" para UIs Admin)
- **Justificación:** Garantiza separación API/UI (INV-002)

#### 2.2.4. Referencia al Schema

**schemaVersion** (string, requerido, mutable)
- Versión del UI Admin Schema que valida esta UI Admin
- Formato: semántico (ej: "1.0.0")
- **Justificación:** Permite evolución del schema sin romper UIs Admin existentes

**schemaValidation** (object, requerido, mutable)
- **validated** (boolean): Si la UI Admin ha sido validada contra el schema
- **validatedAt** (string, ISO 8601): Fecha de última validación
- **errors** (array): Errores de validación encontrados (vacío si válida)
- **Justificación:** Garantiza que todas las UIs Admin cumplen el schema (GAR-003, GAR-004)

#### 2.2.5. Capacidades Declaradas

**capabilities** (array, requerido, mutable)
- Lista de IDs de capacidades declaradas por la UI Admin
- Formato: `PREFIJO-NNN` (ej: `CTX-001`, `OBS-002`, `ACT-001`)
- Solo capacidades [CORE] y [READY] del Contrato Canónico v1
- **Justificación:** Permite verificación de dependencias y cumplimiento de capacidades

#### 2.2.6. Flags de Activación

**flags** (object, requerido, mutable)
- **featureFlags** (array): Feature flags requeridos para activación
- **permissions** (array): Permisos requeridos para acceso
- **systemModes** (array): Modos del sistema permitidos (NORMAL, DEGRADED, BROKEN)
- **Justificación:** Permite control granular de activación según contexto (INV-005, INV-007)

#### 2.2.7. Visibilidad en Sidebar

**sidebar** (object, requerido, mutable)
- **visible** (boolean): Si aparece en el sidebar
- **section** (string, opcional): Sección del sidebar
- **subsection** (string, opcional): Subsección del sidebar
- **order** (number, opcional): Orden dentro de la sección/subsección
- **Justificación:** Permite control de visibilidad independiente del estado (INV-019, INV-020)

#### 2.2.8. Metadata Extensible

**metadata** (object, opcional, mutable)
- Metadata adicional extensible
- **tags** (array): Etiquetas para categorización
- **owner** (string): Propietario/responsable de la UI Admin
- **createdAt** (string, ISO 8601): Fecha de creación
- **updatedAt** (string, ISO 8601): Fecha de última actualización
- **deprecatedAt** (string, ISO 8601, opcional): Fecha de deprecación
- **deprecatedReason** (string, opcional): Razón de deprecación
- **Justificación:** Permite extensibilidad sin romper el schema base

### 2.3. Inmutabilidad y Mutabilidad

**Inmutables (una vez asignados, no pueden cambiarse):**
- `id`: Identificador canónico único
- `routeKey`: Clave de ruta (garantiza coherencia con Router Registry)

**Mutables (pueden cambiar durante el ciclo de vida):**
- `status`: Estado del ciclo de vida
- `route.path`: Ruta (puede cambiar si se refactoriza)
- `schemaVersion`: Versión del schema (puede actualizarse)
- `schemaValidation`: Resultado de validación (se actualiza en cada validación)
- `capabilities`: Capacidades declaradas (pueden añadirse/eliminarse)
- `flags`: Flags de activación (pueden cambiar según necesidades)
- `sidebar`: Configuración de sidebar (puede cambiar)
- `metadata`: Metadata extensible (siempre mutable)

**Justificación:** La inmutabilidad de `id` y `routeKey` garantiza referencias estables. La mutabilidad del resto permite evolución sin romper referencias.

---

## 3. Estados y Transiciones del Ciclo de Vida

### 3.1. Estados Posibles

#### 3.1.1. draft
**Descripción:** UI Admin en desarrollo, no accesible públicamente.

**Características:**
- No es accesible vía routing (Router Resolver la ignora)
- No aparece en sidebar
- Puede tener errores de validación
- Puede estar incompleta

**Uso:** Desarrollo inicial, pruebas, iteración.

#### 3.1.2. active
**Descripción:** UI Admin activa y accesible.

**Características:**
- Es accesible vía routing
- Puede aparecer en sidebar (según `sidebar.visible`)
- Debe cumplir el schema (validación exitosa)
- Debe cumplir el Contrato Canónico v1

**Uso:** UIs Admin en producción, funcionales y validadas.

#### 3.1.3. deprecated
**Descripción:** UI Admin obsoleta, accesible pero marcada para retiro.

**Características:**
- Es accesible vía routing (para compatibilidad)
- Puede aparecer en sidebar (pero marcada como deprecated)
- Debe cumplir el schema (validación exitosa)
- Tiene fecha de deprecación y razón

**Uso:** UIs Admin que se retiran gradualmente, migración a nuevas versiones.

#### 3.1.4. hidden
**Descripción:** UI Admin oculta, no accesible ni visible.

**Características:**
- No es accesible vía routing (Router Resolver la ignora)
- No aparece en sidebar
- Puede tener errores de validación
- Se mantiene en el registry para auditoría

**Uso:** UIs Admin deshabilitadas temporalmente, mantenimiento, rollback.

### 3.2. Transiciones Válidas

#### 3.2.1. Transiciones Permitidas

```
draft → active
  - Requisito: schemaValidation.validated = true
  - Requisito: schemaValidation.errors = []
  - Acción: UI Admin se vuelve accesible

active → deprecated
  - Requisito: metadata.deprecatedReason debe estar presente
  - Acción: UI Admin se marca como deprecated pero sigue accesible

deprecated → hidden
  - Requisito: Ninguno
  - Acción: UI Admin se oculta completamente

hidden → active
  - Requisito: schemaValidation.validated = true
  - Requisito: schemaValidation.errors = []
  - Acción: UI Admin se reactiva

active → hidden
  - Requisito: Ninguno
  - Acción: UI Admin se oculta (rollback rápido)

draft → hidden
  - Requisito: Ninguno
  - Acción: UI Admin se oculta sin activarse

hidden → draft
  - Requisito: Ninguno
  - Acción: UI Admin vuelve a estado de desarrollo
```

#### 3.2.2. Transiciones Prohibidas

**Prohibidas explícitamente:**
- `active → draft` (no se puede "desactivar" una UI Admin activa, usar `hidden` o `deprecated`)
- `deprecated → active` (no se puede "reactivar" una UI Admin deprecated, crear nueva versión)
- `deprecated → draft` (no tiene sentido semántico)

**Justificación:** Las transiciones prohibidas previenen estados inconsistentes y garantizan un ciclo de vida claro.

### 3.3. Validaciones por Estado

#### 3.3.1. Estado: draft
- **Validación de schema:** Opcional (puede tener errores)
- **Validación de contrato:** Opcional
- **Accesibilidad:** No accesible
- **Sidebar:** No visible

#### 3.3.2. Estado: active
- **Validación de schema:** Obligatoria (debe pasar)
- **Validación de contrato:** Obligatoria (debe cumplir todos los invariantes)
- **Accesibilidad:** Accesible (si flags lo permiten)
- **Sidebar:** Visible (si `sidebar.visible = true`)

#### 3.3.3. Estado: deprecated
- **Validación de schema:** Obligatoria (debe pasar)
- **Validación de contrato:** Obligatoria
- **Accesibilidad:** Accesible (para compatibilidad)
- **Sidebar:** Visible pero marcada (si `sidebar.visible = true`)

#### 3.3.4. Estado: hidden
- **Validación de schema:** Opcional
- **Validación de contrato:** Opcional
- **Accesibilidad:** No accesible
- **Sidebar:** No visible

---

## 4. Invariantes del UI Admin Registry

### 4.1. Invariantes de Identificación

#### REG-INV-001. ID Canónico Único
**Enunciado:** Cada entrada en el UI Admin Registry **DEBE** tener un `id` único e inmutable. No puede haber dos entradas con el mismo `id`.

**Qué protege:** Referencias estables desde otros sistemas, prevención de ambigüedades.

**Qué ocurre si se viola:** Referencias rotas, ambigüedades en resolución, violación de integridad del registry.

#### REG-INV-002. Coherencia con Router Registry
**Enunciado:** El `routeKey` de una entrada **DEBE** existir en el Router Registry con `type='island'`. No puede haber entradas con `routeKey` inexistente o con `type` diferente a `'island'`.

**Qué protege:** Coherencia entre registries, prevención de rutas huérfanas.

**Qué ocurre si se viola:** Rutas que no resuelven, UIs Admin inaccesibles, violación de INV-001 (Router Registry).

### 4.2. Invariantes de Estado

#### REG-INV-003. Validación Obligatoria para Active
**Enunciado:** Una entrada con `status='active'` **DEBE** tener `schemaValidation.validated = true` y `schemaValidation.errors = []`. No puede estar activa sin validación exitosa.

**Qué protege:** UIs Admin activas cumplen el schema y contrato.

**Qué ocurre si se viola:** UIs Admin inválidas en producción, violación de garantías (GAR-003, GAR-004).

#### REG-INV-004. Deprecation con Razón
**Enunciado:** Una entrada con `status='deprecated'` **DEBE** tener `metadata.deprecatedReason` presente. No puede estar deprecated sin razón explícita.

**Qué protege:** Trazabilidad de decisiones de deprecación, auditoría.

**Qué ocurre si se viola:** Deprecaciones sin justificación, pérdida de trazabilidad.

### 4.3. Invariantes de Routing

#### REG-INV-005. Separación API / UI
**Enunciado:** El `route.path` de una entrada **NO PUEDE** empezar con `/admin/api/`. Las rutas `/admin/api/*` son APIs, no UIs Admin.

**Qué protege:** Separación arquitectónica API/UI (INV-002).

**Qué ocurre si se viola:** Violación de INV-002, confusión de contratos.

#### REG-INV-006. Tipo Island Obligatorio
**Enunciado:** El `route.type` de una entrada **DEBE** ser `"island"`. No puede ser otro tipo.

**Qué protege:** Solo UIs Admin en el registry (INV-002).

**Qué ocurre si se viola:** APIs en el registry de UIs Admin, violación de INV-002.

### 4.4. Invariantes de Capacidades

#### REG-INV-007. Capacidades Válidas
**Enunciado:** Todas las capacidades en `capabilities` **DEBEN** ser IDs válidos del formato `PREFIJO-NNN` y corresponder a capacidades [CORE] o [READY] del Contrato Canónico v1.

**Qué protege:** Solo capacidades reconocidas, prevención de capacidades inválidas.

**Qué ocurre si se viola:** Referencias a capacidades inexistentes, violación de dependencias.

### 4.5. Invariantes de Integridad

#### REG-INV-008. Schema Version Válida
**Enunciado:** El `schemaVersion` **DEBE** ser una versión semántica válida y existente del UI Admin Schema.

**Qué protege:** Validación con schema correcto, prevención de validaciones con schemas inexistentes.

**Qué ocurre si se viola:** Validaciones incorrectas, errores de validación falsos.

#### REG-INV-009. Metadata Consistente
**Enunciado:** Si `status='deprecated'`, `metadata.deprecatedAt` **DEBE** estar presente. Si `status='active'`, `metadata.updatedAt` **DEBE** estar presente.

**Qué protege:** Metadata consistente con el estado, auditoría completa.

**Qué ocurre si se viola:** Metadata inconsistente, pérdida de trazabilidad.

---

## 5. Integración con Otros Sistemas

### 5.1. Integración con Router Registry

#### 5.1.1. Relación
El UI Admin Registry **consulta** el Router Registry para validar que `routeKey` existe y tiene `type='island'`.

#### 5.1.2. Flujo
1. UI Admin Registry valida `routeKey` contra Router Registry (REG-INV-002)
2. Router Registry usa `routeKey` para resolver rutas (opcional, puede usar `route.path` directamente)
3. Router Resolver consulta UI Admin Registry para obtener metadata de UI Admin (opcional)

#### 5.1.3. Garantías
- **REG-INV-002:** Coherencia entre registries
- **INV-001:** Router Registry como Source of Truth de rutas
- **INV-003:** Resolución única de rutas

### 5.2. Integración con Sidebar & Navigation Registry

#### 5.2.1. Relación
El Sidebar Registry **consulta** el UI Admin Registry para determinar qué UIs Admin aparecen en el sidebar.

#### 5.2.2. Flujo
1. Sidebar Registry filtra entradas con `status IN ('active', 'deprecated')` y `sidebar.visible = true`
2. Sidebar Registry usa `sidebar.section`, `sidebar.subsection`, `sidebar.order` para organizar
3. Sidebar Registry respeta `flags.featureFlags`, `flags.permissions`, `flags.systemModes`

#### 5.2.3. Garantías
- **INV-019:** Sidebar gobernado, no hardcodeado
- **INV-020:** Filtrado por permisos
- **NAV-004:** Filtrado de navegación por permisos
- **NAV-005:** Filtrado de navegación por feature flags

### 5.3. Integración con Assembly Check

#### 5.3.1. Relación
El Assembly Check **consulta** el UI Admin Registry para validar todas las UIs Admin declaradas.

#### 5.3.2. Flujo
1. Assembly Check lee todas las entradas del UI Admin Registry
2. Assembly Check valida cada entrada contra UI Admin Schema v1
3. Assembly Check verifica cumplimiento del Contrato Canónico v1
4. Assembly Check actualiza `schemaValidation` en cada entrada

#### 5.3.3. Garantías
- **GAR-003:** Assembly Check en modo normal (warnings)
- **GAR-004:** Assembly Check en modo estricto (bloquea)
- **REG-INV-003:** Validación obligatoria para active

### 5.4. Integración con Editor de Pantallas (FUTURE)

#### 5.4.1. Relación
El Editor de Pantallas **consulta y modifica** el UI Admin Registry para crear/editar UIs Admin.

#### 5.4.2. Flujo
1. Editor consulta UI Admin Registry para listar UIs Admin existentes
2. Editor crea nuevas entradas con `status='draft'`
3. Editor valida contra UI Admin Schema v1 en tiempo real
4. Editor actualiza entradas existentes
5. Editor cambia estados (draft → active, etc.)

#### 5.4.3. Garantías
- **GAR-024:** Validación de contratos de datos declarativos
- **GAR-025:** Validación de contratos de acciones declarativos
- **EDI-003:** Contratos de datos declarativos (READY)
- **EDI-004:** Contratos de acciones declarativos (READY)

---

## 6. Migración de Pantallas Admin Existentes

### 6.1. Principios de Migración

#### 6.1.1. No Romper Nada
- Las UIs Admin existentes **deben seguir funcionando** durante la migración
- La migración es **aditiva**, no destructiva
- Se migra gradualmente, no todo a la vez

#### 6.1.2. Validación Gradual
- Las UIs Admin existentes pueden empezar con `status='draft'` o `status='active'` según validación
- Si no cumplen el schema, se marcan como `status='draft'` hasta corregir
- Si cumplen el schema, se marcan como `status='active'`

#### 6.1.3. Auditoría Completa
- Todas las UIs Admin existentes se registran en el UI Admin Registry
- Se documenta el estado inicial y las correcciones necesarias
- Se mantiene trazabilidad de la migración

### 6.2. Proceso de Migración

#### 6.2.1. Fase 1: Inventario
1. Identificar todas las UIs Admin existentes (consultar Router Registry con `type='island'`)
2. Para cada UI Admin:
   - Extraer `routeKey` y `route.path` del Router Registry
   - Identificar handler correspondiente
   - Analizar código para extraer capacidades, permisos, flags

#### 6.2.2. Fase 2: Creación de Entradas
1. Para cada UI Admin identificada:
   - Crear entrada en UI Admin Registry con `id` canónico
   - Asignar `routeKey` del Router Registry
   - Establecer `status='draft'` inicialmente
   - Extraer `capabilities` del código (análisis estático o manual)
   - Extraer `flags` del código (análisis estático o manual)
   - Establecer `sidebar.visible = false` inicialmente (se activa después)

#### 6.2.3. Fase 3: Validación
1. Ejecutar Assembly Check en modo normal sobre todas las entradas
2. Para cada entrada:
   - Si pasa validación: `status='draft'` → `status='active'`, `schemaValidation.validated = true`
   - Si falla validación: mantener `status='draft'`, registrar errores en `schemaValidation.errors`

#### 6.2.4. Fase 4: Corrección
1. Para entradas con errores de validación:
   - Corregir código de la UI Admin para cumplir schema
   - Re-ejecutar validación
   - Actualizar `schemaValidation`

#### 6.2.5. Fase 5: Activación
1. Para entradas validadas:
   - Cambiar `status='draft'` → `status='active'`
   - Activar `sidebar.visible = true` si corresponde
   - Verificar que Router Registry y Sidebar Registry están sincronizados

### 6.3. Ejemplo de Migración

**UI Admin existente:**
- Router Registry: `{ key: 'admin-dashboard', path: '/admin/dashboard', type: 'island' }`
- Handler: `src/endpoints/admin-dashboard.js`
- Sidebar: Aparece en sección "Dashboard"

**Entrada en UI Admin Registry:**
```json
{
  "id": "admin-dashboard",
  "routeKey": "admin-dashboard",
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
  "capabilities": ["CTX-001", "OBS-002", "ACT-001", "NAV-001", "LAY-001"],
  "flags": {
    "featureFlags": [],
    "permissions": ["admin:read"],
    "systemModes": ["NORMAL", "DEGRADED"]
  },
  "sidebar": {
    "visible": false,
    "section": "Dashboard",
    "order": 1
  },
  "metadata": {
    "tags": ["dashboard", "overview"],
    "owner": "system",
    "createdAt": "2025-01-XX",
    "updatedAt": "2025-01-XX"
  }
}
```

**Después de validación exitosa:**
```json
{
  "id": "admin-dashboard",
  "status": "active",
  "schemaValidation": {
    "validated": true,
    "validatedAt": "2025-01-XX",
    "errors": []
  },
  "sidebar": {
    "visible": true
  }
}
```

---

## 7. Ejemplos de Entradas del Registry

### 7.1. Entrada en Estado Draft

```json
{
  "id": "admin-dashboard",
  "routeKey": "admin-dashboard",
  "status": "draft",
  "route": {
    "path": "/admin/dashboard",
    "type": "island"
  },
  "schemaVersion": "1.0.0",
  "schemaValidation": {
    "validated": false,
    "validatedAt": null,
    "errors": [
      {
        "path": "/layout/template",
        "message": "Template debe ser 'base'",
        "code": "INV-014"
      }
    ]
  },
  "capabilities": ["CTX-001", "OBS-002", "ACT-001", "NAV-001", "LAY-001"],
  "flags": {
    "featureFlags": [],
    "permissions": ["admin:read"],
    "systemModes": ["NORMAL", "DEGRADED"]
  },
  "sidebar": {
    "visible": false,
    "section": "Dashboard",
    "order": 1
  },
  "metadata": {
    "tags": ["dashboard", "overview"],
    "owner": "system",
    "createdAt": "2025-01-XXT00:00:00Z",
    "updatedAt": "2025-01-XXT00:00:00Z"
  }
}
```

### 7.2. Entrada en Estado Active

```json
{
  "id": "student-list",
  "routeKey": "student-list",
  "status": "active",
  "route": {
    "path": "/admin/students",
    "type": "island"
  },
  "schemaVersion": "1.0.0",
  "schemaValidation": {
    "validated": true,
    "validatedAt": "2025-01-XXT10:00:00Z",
    "errors": []
  },
  "capabilities": [
    "CTX-001",
    "CTX-002",
    "OBS-002",
    "ACT-001",
    "ACT-002",
    "NAV-001",
    "NAV-004",
    "LAY-001",
    "SEC-002"
  ],
  "flags": {
    "featureFlags": ["students-v2"],
    "permissions": ["admin:read", "admin:write"],
    "systemModes": ["NORMAL", "DEGRADED"]
  },
  "sidebar": {
    "visible": true,
    "section": "Students",
    "subsection": "Management",
    "order": 1
  },
  "metadata": {
    "tags": ["students", "management", "crud"],
    "owner": "admin-team",
    "createdAt": "2025-01-XXT00:00:00Z",
    "updatedAt": "2025-01-XXT10:00:00Z"
  }
}
```

### 7.3. Entrada en Estado Deprecated

```json
{
  "id": "legacy-admin-panel",
  "routeKey": "legacy-admin-panel",
  "status": "deprecated",
  "route": {
    "path": "/admin/legacy",
    "type": "island"
  },
  "schemaVersion": "1.0.0",
  "schemaValidation": {
    "validated": true,
    "validatedAt": "2025-01-XXT08:00:00Z",
    "errors": []
  },
  "capabilities": ["CTX-001", "ACT-001", "NAV-001", "LAY-001"],
  "flags": {
    "featureFlags": [],
    "permissions": ["admin:read"],
    "systemModes": ["NORMAL"]
  },
  "sidebar": {
    "visible": true,
    "section": "Legacy",
    "order": 99
  },
  "metadata": {
    "tags": ["legacy", "deprecated"],
    "owner": "system",
    "createdAt": "2024-12-01T00:00:00Z",
    "updatedAt": "2025-01-XXT08:00:00Z",
    "deprecatedAt": "2025-01-XXT08:00:00Z",
    "deprecatedReason": "Reemplazado por admin-dashboard v2. Se mantiene para compatibilidad hasta 2025-03-01"
  }
}
```

### 7.4. Entrada en Estado Hidden

```json
{
  "id": "experimental-feature",
  "routeKey": "experimental-feature",
  "status": "hidden",
  "route": {
    "path": "/admin/experimental",
    "type": "island"
  },
  "schemaVersion": "1.0.0",
  "schemaValidation": {
    "validated": false,
    "validatedAt": null,
    "errors": []
  },
  "capabilities": ["CTX-001", "ACT-001"],
  "flags": {
    "featureFlags": ["experimental"],
    "permissions": ["admin:read"],
    "systemModes": ["NORMAL"]
  },
  "sidebar": {
    "visible": false
  },
  "metadata": {
    "tags": ["experimental", "hidden"],
    "owner": "dev-team",
    "createdAt": "2025-01-XXT00:00:00Z",
    "updatedAt": "2025-01-XXT00:00:00Z"
  }
}
```

### 7.5. Registry Completo (Ejemplo)

```json
{
  "version": "1.0.0",
  "entries": [
    {
      "id": "admin-dashboard",
      "routeKey": "admin-dashboard",
      "status": "active",
      "route": {
        "path": "/admin/dashboard",
        "type": "island"
      },
      "schemaVersion": "1.0.0",
      "schemaValidation": {
        "validated": true,
        "validatedAt": "2025-01-XXT10:00:00Z",
        "errors": []
      },
      "capabilities": ["CTX-001", "OBS-002", "ACT-001", "NAV-001", "LAY-001"],
      "flags": {
        "featureFlags": [],
        "permissions": ["admin:read"],
        "systemModes": ["NORMAL", "DEGRADED"]
      },
      "sidebar": {
        "visible": true,
        "section": "Dashboard",
        "order": 1
      },
      "metadata": {
        "tags": ["dashboard"],
        "owner": "system",
        "createdAt": "2025-01-XXT00:00:00Z",
        "updatedAt": "2025-01-XXT10:00:00Z"
      }
    }
  ]
}
```

---

## 8. Notas de Validación

### 8.1. Validación de Unicidad de IDs

El JSON Schema no puede validar directamente la unicidad de `id` en un array. Esta validación debe realizarse en la implementación del registry:

```javascript
// Pseudocódigo de validación
function validateRegistry(registry) {
  const ids = new Set();
  for (const entry of registry.entries) {
    if (ids.has(entry.id)) {
      throw new Error(`REG-INV-001 violado: ID duplicado: ${entry.id}`);
    }
    ids.add(entry.id);
  }
}
```

### 8.2. Validación de Coherencia con Router Registry

El JSON Schema no puede validar que `routeKey` existe en el Router Registry. Esta validación debe realizarse en la implementación:

```javascript
// Pseudocódigo de validación
function validateRouteKeyCoherence(entry, routerRegistry) {
  const route = routerRegistry.find(r => r.key === entry.routeKey);
  if (!route) {
    throw new Error(`REG-INV-002 violado: routeKey no existe en Router Registry: ${entry.routeKey}`);
  }
  if (route.type !== 'island') {
    throw new Error(`REG-INV-002 violado: routeKey no es type='island': ${entry.routeKey}`);
  }
}
```

### 8.3. Validación de Schema Version

El JSON Schema valida el formato de `schemaVersion` pero no puede verificar que la versión existe. Esta validación debe realizarse en la implementación:

```javascript
// Pseudocódigo de validación
const VALID_SCHEMA_VERSIONS = ['1.0.0']; // Lista de versiones válidas

function validateSchemaVersion(entry) {
  if (!VALID_SCHEMA_VERSIONS.includes(entry.schemaVersion)) {
    throw new Error(`REG-INV-008 violado: schemaVersion no válida: ${entry.schemaVersion}`);
  }
}
```

---

## 9. Conclusión

El **UI Admin Registry v1** es el sistema canónico de gobierno de pantallas Admin de AuriPortal. Proporciona:

1. **Declaración canónica** de todas las UIs Admin
2. **Validación** contra schema y contrato
3. **Gobierno** del ciclo de vida (estados y transiciones)
4. **Integración** con Router Registry, Sidebar Registry, Assembly Check y Editor de Pantallas
5. **Migración** gradual de UIs Admin existentes

**Principio fundamental:** El UI Admin Registry es el **Source of Truth** para el gobierno de UIs Admin. Todas las decisiones sobre visibilidad, activación y deprecación pasan por el registry.

---

**Fin del documento: UI Admin Registry v1**

