# AuriPortal — UI Admin Factory v1

**Versión:** 1.0.0  
**Estado:** DRAFT  
**Fecha:** 2025-01-XX

---

## 1. Definición Ontológica del UI Admin Factory

### 1.1. Naturaleza y Rol

El **UI Admin Factory v1** es el único camino canónico para crear/renderizar UIs Admin en AuriPortal. Convierte una entrada del UI Admin Registry (`UIAdminScreenRegistryEntry`) en una UI SSR operativa, usando `renderAdminPage()` y aplicando wiring estándar (contexto, permisos, observabilidad, sidebar, mobile).

**No es:**
- Un framework nuevo
- Un generador de código
- Un sistema de templates alternativo
- Un reemplazo de `renderAdminPage()`

**Es:**
- Una **capa de validación y wiring** que garantiza cumplimiento del Contrato Canónico v1
- Un **puente** entre el UI Admin Registry y el sistema de renderizado existente
- Un **sistema de enforcement** que previene violaciones de invariantes
- Un **orquestador** que aplica wiring estándar (contexto, permisos, observabilidad, sidebar, mobile)

### 1.2. Responsabilidades

El UI Admin Factory tiene las siguientes responsabilidades **obligatorias**:

#### 1.2.1. Validación
- **Validación de Registry Entry:** Verificar que la entrada cumple el UI Admin Registry Schema v1
- **Validación de UI Screen Definition:** Verificar que la definición de UI cumple el UI Admin Schema v1 (si existe)
- **Validación de Estado:** Verificar que el estado permite renderizado (active, deprecated)
- **Validación de Flags:** Verificar que los flags de activación se cumplen (feature flags, permisos, modos del sistema)

#### 1.2.2. Wiring Estándar
- **Contexto:** Preparar contexto de usuario, sistema y feature flags
- **Permisos:** Validar permisos requeridos antes de renderizar
- **Observabilidad:** Preparar trace_id, logging estructurado y señales
- **Sidebar:** Preparar sidebar desde Sidebar Registry según configuración
- **Mobile:** Asegurar defaults mobile-safe (viewport, responsive, táctil)

#### 1.2.3. Renderizado Canónico
- **renderAdminPage():** Llamar a `renderAdminPage()` con parámetros correctos
- **Placeholders:** Asegurar que todos los placeholders se reemplazan
- **Scripts y Estilos:** Inyectar scripts y estilos según configuración
- **Metadata:** Añadir metadata diagnóstica (trace_id, factory mode, etc.)

#### 1.2.4. Enforcement
- **Modo Shadow:** Validar y registrar warnings sin bloquear
- **Modo Enforced:** Bloquear renderizado si no cumple contratos
- **Logging Estructurado:** Registrar todos los eventos con trace_id

### 1.3. Responsabilidades que NO tiene

El UI Admin Factory **NO es responsable de**:

#### 1.3.1. Lógica de Negocio
- **NO ejecuta lógica de negocio:** Solo cablea, valida y delega a handlers/servicios existentes
- **NO calcula datos:** No calcula Source of Truth, solo consume servicios canónicos
- **NO toma decisiones:** No toma decisiones de negocio, solo valida y cablea

#### 1.3.2. Renderizado de Contenido
- **NO renderiza HTML:** El HTML se genera en los handlers, la Factory solo orquesta
- **NO genera contenido:** No genera contenido específico de la UI, solo wiring estándar
- **NO modifica UI:** No modifica la UI de producto, solo garantiza cumplimiento

#### 1.3.3. Routing
- **NO resuelve rutas:** El Router Resolver se encarga de la resolución
- **NO maneja requests:** No procesa requests HTTP directamente
- **NO decide handlers:** No decide qué handler ejecutar, solo valida y cablea

---

## 2. Inputs y Outputs

### 2.1. Inputs

#### 2.1.1. Registry Entry (Requerido)
- **Tipo:** `UIAdminScreenRegistryEntry` (validado contra UI Admin Registry Schema v1)
- **Origen:** UI Admin Registry Runtime
- **Validación:** Debe cumplir REG-INV-001 a REG-INV-009

#### 2.1.2. Contexto (Requerido)
- **Tipo:** `Object` con información de request y contexto del sistema
- **Propiedades:**
  - `request`: Request object (para extraer path, headers, etc.)
  - `env`: Environment variables
  - `ctx`: Contexto del sistema (modo, feature flags, etc.)
  - `userContext`: Contexto del usuario (rol, permisos, identidad)

#### 2.1.3. Request Info (Opcional)
- **Tipo:** `Object` con información adicional del request
- **Propiedades:**
  - `traceId`: Trace ID del request
  - `method`: Método HTTP
  - `path`: Ruta del request

### 2.2. Outputs

#### 2.2.1. HTML Response (Principal)
- **Tipo:** `Response` con HTML renderizado
- **Formato:** HTML completo con template base, sidebar, contenido y scripts
- **Metadata:** Headers diagnósticos (X-UI-FACTORY, X-Trace-ID, etc.)

#### 2.2.2. Metadata (Opcional)
- **Tipo:** `Object` con metadata de la operación
- **Propiedades:**
  - `factoryMode`: Modo de la factory (shadow, enforced)
  - `validated`: Si pasó validación
  - `warnings`: Array de warnings (si modo shadow)
  - `errors`: Array de errores (si modo enforced y falló)

---

## 3. Pipeline Canónico

### 3.1. Flujo General

```
1. Resolver routeKey (Router Registry)
   ↓
2. Buscar entry en UI Admin Registry Runtime
   ↓
3. Validar entry contra Registry Schema
   ↓
4. Si entry.status=active → Validar screenDef contra UI Admin Schema
   ↓
5. Validar flags de activación (feature flags, permisos, modos)
   ↓
6. Construir contexto UI (ctx + permisos)
   ↓
7. Preparar sidebar desde Sidebar Registry
   ↓
8. Preparar observabilidad (trace_id, signals declaradas)
   ↓
9. Llamar renderAdminPage() con parámetros correctos
   ↓
10. Añadir metadata diagnóstica (headers, meta tags)
   ↓
11. Devolver Response con HTML renderizado
```

### 3.2. Pasos Detallados

#### Paso 1: Resolver routeKey
- **Input:** Ruta del request (`/admin/dashboard`)
- **Proceso:** Consultar Router Registry para obtener `routeKey`
- **Validación:** Verificar que la ruta existe y es `type='island'`
- **Error:** Si no existe o no es island → Error canónico (modo enforced) o warning (modo shadow)

#### Paso 2: Buscar Entry en Registry
- **Input:** `routeKey` del paso anterior
- **Proceso:** Buscar entrada en UI Admin Registry Runtime
- **Validación:** Verificar que la entrada existe
- **Error:** Si no existe → Error canónico (modo enforced) o warning (modo shadow)

#### Paso 3: Validar Entry contra Registry Schema
- **Input:** Entrada del registry
- **Proceso:** Validar contra UI Admin Registry Schema v1 usando AJV
- **Validación:** Verificar REG-INV-001 a REG-INV-009
- **Error:** Si falla → Error canónico (modo enforced) o warning (modo shadow)

#### Paso 4: Validar Screen Definition (si active)
- **Input:** `screenDef` de la entrada (si existe y `status='active'`)
- **Proceso:** Validar contra UI Admin Schema v1 usando AJV
- **Validación:** Verificar todos los bloques obligatorios
- **Error:** Si falla → Error canónico (modo enforced) o warning (modo shadow)

#### Paso 5: Validar Flags de Activación
- **Input:** Flags de la entrada (`featureFlags`, `permissions`, `systemModes`)
- **Proceso:** Verificar que se cumplen todos los flags requeridos
- **Validación:**
  - Feature flags: Consultar Feature Flags Service
  - Permisos: Consultar Permission System
  - Modos del sistema: Consultar System Mode Manager
- **Error:** Si no se cumplen → Error canónico (modo enforced) o warning (modo shadow)

#### Paso 6: Construir Contexto UI
- **Input:** Contexto del request y entrada del registry
- **Proceso:** Construir contexto enriquecido con:
  - Contexto de usuario (rol, permisos, identidad)
  - Modo del sistema (NORMAL, DEGRADED, BROKEN)
  - Feature flags activos
  - Variables de entorno relevantes
- **Output:** Contexto UI completo

#### Paso 7: Preparar Sidebar
- **Input:** Configuración de sidebar de la entrada
- **Proceso:** Generar sidebar desde Sidebar Registry según configuración
- **Validación:** Verificar que el sidebar se genera correctamente
- **Error:** Si falla → Sidebar vacío (fail-open) o error (modo enforced)

#### Paso 8: Preparar Observabilidad
- **Input:** Configuración de observabilidad de la entrada
- **Proceso:** Preparar:
  - Trace ID (propagado desde request o generado)
  - Logging estructurado (nivel, contexto, metadata)
  - Señales declaradas (validar que están registradas)
- **Output:** Configuración de observabilidad lista

#### Paso 9: Llamar renderAdminPage()
- **Input:** Parámetros preparados en pasos anteriores
- **Proceso:** Llamar a `renderAdminPage()` con:
  - `title`: Título de la UI Admin
  - `contentHtml`: HTML del contenido (generado por handler)
  - `activePath`: Ruta activa para sidebar
  - `extraScripts`: Scripts adicionales según configuración
  - `extraStyles`: Estilos adicionales según configuración
  - `userContext`: Contexto de usuario enriquecido
- **Output:** Response con HTML renderizado

#### Paso 10: Añadir Metadata Diagnóstica
- **Input:** Response del paso anterior y metadata de la factory
- **Proceso:** Añadir headers y meta tags:
  - `X-UI-FACTORY: shadow|enforced`
  - `X-Trace-ID: <trace_id>`
  - `X-UI-Factory-Entry-Id: <entry_id>`
  - Meta tags en HTML (trace_id, factory mode, etc.)
- **Output:** Response con metadata diagnóstica

#### Paso 11: Devolver Response
- **Input:** Response con HTML y metadata
- **Proceso:** Devolver Response final
- **Output:** Response listo para enviar al cliente

---

## 4. Modo Shadow vs Modo Enforced

### 4.1. Modo Shadow (Por Defecto)

**Propósito:** Validar y registrar warnings sin bloquear renderizado.

**Comportamiento:**
- Si la ruta **NO está registrada:** Renderiza normalmente, registra warning estructurado
- Si la entrada **falla validación:** Renderiza normalmente, registra warning estructurado
- Si los flags **no se cumplen:** Renderiza normalmente, registra warning estructurado
- Si el screenDef **falla validación:** Renderiza normalmente, registra warning estructurado

**Logging:**
```javascript
[UI_FACTORY] code=SHADOW_WARNING trace_id=... routeKey=... screen_id=... message=...
```

**Headers:**
- `X-UI-FACTORY: shadow`
- `X-UI-Factory-Warnings: <count>`

**Uso:** Migración gradual, desarrollo, pruebas.

### 4.2. Modo Enforced

**Propósito:** Bloquear renderizado si no cumple contratos.

**Comportamiento:**
- Si la ruta **NO está registrada:** Error canónico (500), no renderiza
- Si la entrada **falla validación:** Error canónico (500), no renderiza
- Si los flags **no se cumplen:** Error canónico (403), no renderiza
- Si el screenDef **falla validación:** Error canónico (500), no renderiza

**Logging:**
```javascript
[UI_FACTORY] code=ENFORCED_ERROR trace_id=... routeKey=... screen_id=... error=...
```

**Headers:**
- `X-UI-FACTORY: enforced`
- `X-UI-Factory-Error: <error_code>`

**Uso:** Producción (cuando todas las UIs estén migradas).

### 4.3. Activación del Modo

**Por defecto:** Modo Shadow

**Activación de Modo Enforced:**
- Variable de entorno: `UI_FACTORY_MODE=enforced`
- Feature flag: `ui-factory-enforced` (si existe sistema de feature flags)
- Configuración: `process.env.UI_FACTORY_MODE || 'shadow'`

---

## 5. Integración con Otros Sistemas

### 5.1. Integración con Router Registry

**Relación:** La Factory consulta el Router Registry para validar que `routeKey` existe y es `type='island'`.

**Flujo:**
1. Router Resolver resuelve ruta y obtiene `routeKey`
2. Factory busca entrada en UI Admin Registry usando `routeKey`
3. Factory valida que `routeKey` coincide con Router Registry

**Garantías:**
- REG-INV-002: Coherencia con Router Registry
- INV-001: Router Registry como Source of Truth de rutas

### 5.2. Integración con Sidebar Registry

**Relación:** La Factory consulta el Sidebar Registry para generar sidebar según configuración.

**Flujo:**
1. Factory lee configuración de sidebar de la entrada
2. Factory llama a `generateSidebarHTML()` del Sidebar Registry
3. Factory pasa sidebar a `renderAdminPage()`

**Garantías:**
- INV-019: Sidebar gobernado, no hardcodeado
- INV-020: Filtrado de navegación por permisos

### 5.3. Integración con Assembly Check

**Relación:** El Assembly Check valida que todas las entradas del registry cumplen schemas.

**Flujo:**
1. Assembly Check lee todas las entradas del UI Admin Registry Runtime
2. Assembly Check valida cada entrada contra Registry Schema
3. Assembly Check valida screenDef contra UI Admin Schema (si existe)
4. Assembly Check reporta warnings (modo normal) o errores (modo estricto)

**Garantías:**
- GAR-003: Assembly Check en modo normal
- GAR-004: Assembly Check en modo estricto

### 5.4. Integración con Observabilidad

**Relación:** La Factory prepara observabilidad (trace_id, logging, señales) antes de renderizar.

**Flujo:**
1. Factory obtiene trace_id del request context
2. Factory prepara logging estructurado
3. Factory valida señales declaradas contra Signal Registry
4. Factory propaga trace_id a `renderAdminPage()`

**Garantías:**
- INV-011: Trace ID obligatorio en operaciones
- INV-012: Señales solo registradas
- INV-013: Logging estructurado obligatorio

---

## 6. Estrategia de Migración

### 6.1. Fase 1: Shadow Mode (Actual)

**Objetivo:** Crear entradas en registry sin romper producción.

**Acciones:**
1. Crear UI Admin Registry Runtime con entradas para UIs existentes
2. Todas las entradas en `status='draft'` inicialmente
3. Integrar Factory en flujo de renderizado (shadow mode)
4. Validar que no rompe nada (warnings solo en logs)

**UIs a migrar:**
- `/admin` (dashboard) → `admin-dashboard`
- `/admin/themes` o Theme Studio → `admin-theme-studio`
- `/admin/contextos` (si existe) → `admin-contexts`
- `/admin/resolvers` (si existe) → `admin-resolvers`
- Cualquier otra visible en sidebar audit

### 6.2. Fase 2: Validación y Corrección

**Objetivo:** Corregir errores de validación y activar entradas.

**Acciones:**
1. Ejecutar Assembly Check con `--ui-factory` en modo normal
2. Corregir errores de validación encontrados
3. Cambiar `status='draft'` → `status='active'` una a una
4. Verificar que cada UI funciona correctamente

### 6.3. Fase 3: Enforcement Opcional

**Objetivo:** Activar enforcement para nuevas UIs.

**Acciones:**
1. Activar enforcement solo para nuevas UIs (feature flag por UI)
2. Mantener shadow mode para UIs legacy
3. Migrar UIs legacy gradualmente

### 6.4. Fase 4: Enforcement Completo

**Objetivo:** Activar enforcement para todas las UIs.

**Acciones:**
1. Verificar que todas las UIs están migradas y validadas
2. Activar `UI_FACTORY_MODE=enforced` globalmente
3. Verificar que no hay errores en producción

---

## 7. Mobile Defaults

### 7.1. Viewport Meta Tag

**Requisito:** `renderAdminPage()` debe incluir viewport meta tag si no existe.

**Implementación:**
- Verificar que `base.html` incluye: `<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">`
- Si no existe, añadirlo automáticamente

### 7.2. CSS Responsive

**Requisito:** Clases/variables CSS base que soporten responsive.

**Implementación:**
- Verificar que `base.html` incluye clases responsive (Tailwind CSS o similar)
- Asegurar que el layout base es responsive por defecto

### 7.3. Sidebar Colapsable

**Requisito:** Sidebar colapsable en width pequeño.

**Implementación:**
- Verificar que `sidebar-client.js` soporta colapso en móvil
- Si ya existe, solo habilitar default
- Si no existe, añadir funcionalidad mínima

### 7.4. Controles Táctiles

**Requisito:** Controles táctiles OK (sin rediseños, solo defaults).

**Implementación:**
- Verificar que botones tienen `touch-action: manipulation`
- Verificar que inputs tienen `font-size: 16px` (evita zoom en iOS)
- Asegurar que áreas táctiles son suficientemente grandes (min 44x44px)

---

## 8. Conclusión

El **UI Admin Factory v1** es el único camino canónico para crear/renderizar UIs Admin en AuriPortal. Proporciona:

1. **Validación** contra Registry Schema y UI Admin Schema
2. **Wiring estándar** (contexto, permisos, observabilidad, sidebar, mobile)
3. **Enforcement** gradual (shadow → enforced)
4. **Integración** con Router Registry, Sidebar Registry, Assembly Check y Observabilidad
5. **Migración** gradual de UIs existentes sin romper producción

**Principio fundamental:** La Factory NO ejecuta lógica de negocio, solo valida, cablea y delega a handlers/servicios existentes.

---

**Fin del documento: UI Admin Factory v1**




