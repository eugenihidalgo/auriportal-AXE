# AuriPortal — Contrato Canónico de UI Admin v1

**Versión:** 1.0.0  
**Estado:** DRAFT  
**Fecha:** 2025-01-XX

---

## 1. Definición Ontológica de la UI Admin

### 1.1. Naturaleza y Rol

Una **UI Admin** en AuriPortal es un **nodo vivo del sistema** que materializa la capacidad de gobierno y observabilidad del sistema en una interfaz visual interactiva.

**No es:**
- Una pantalla estática o decorativa
- Un formulario aislado para "gestionar datos"
- Un dashboard de métricas pasivas
- Una herramienta de desarrollo o debugging

**Es:**
- Un **operador de estado** que permite inspeccionar y modificar el sistema vivo
- Un **punto de observabilidad** que expone el estado interno del sistema
- Un **canal de gobierno** que permite añadir, modificar y retirar elementos del sistema con versionado y auditoría
- Un **nodo contextual** que se adapta al estado del sistema (modos, feature flags, permisos)

### 1.2. Responsabilidades

Una UI Admin tiene las siguientes responsabilidades **obligatorias**:

#### 1.2.1. Gobierno del Sistema Vivo
- **Inspección:** Visualizar el estado actual de entidades del sistema (alumnos, señales, automatizaciones, catálogos, etc.)
- **Modificación:** Permitir cambios controlados y auditables sobre Source of Truth
- **Retiro:** Permitir deprecar o archivar elementos con versionado explícito
- **Añadir:** Permitir crear nuevos elementos del sistema siguiendo contratos canónicos

#### 1.2.2. Observabilidad
- **Diagnóstico:** Exponer errores correlados por `trace_id`
- **Estado del sistema:** Mostrar el modo actual (NORMAL, DEGRADED, BROKEN)
- **Trazabilidad:** Permitir rastrear mutaciones y sus consecuencias
- **Analíticas:** Exponer métricas agregadas del sistema

#### 1.2.3. Validación y Contratos
- **Validación de entrada:** Garantizar que toda modificación respeta los contratos del sistema
- **Errores explícitos:** Mostrar errores canónicos (Error Contract v1) con diagnóstico claro
- **Respeto de invariantes:** No permitir operaciones que violen invariantes del sistema

#### 1.2.4. Contextualización
- **Adaptación al estado:** Responder al modo del sistema (bloquear escrituras en BROKEN, vigilar en DEGRADED)
- **Feature flags:** Respetar y exponer el estado de feature flags
- **Permisos:** Validar acceso según contexto de usuario

### 1.3. Responsabilidades que NO tiene

Una UI Admin **NO es responsable de**:

#### 1.3.1. Lógica de Negocio
- **NO calcula:** No recalcula Source of Truth (niveles, XP, clasificaciones)
- **NO decide:** No toma decisiones de negocio (solo expone y permite modificar)
- **NO replica:** No duplica lógica que ya existe en servicios canónicos

#### 1.3.2. Persistencia Directa
- **NO escribe directamente:** No modifica PostgreSQL sin pasar por servicios canónicos
- **NO valida en UI:** La validación dura ocurre en servicios, no en la UI
- **NO es autoridad:** No es Source of Truth de ningún dato

#### 1.3.3. Comunicación Externa
- **NO envía emails:** No dispara comunicaciones directamente
- **NO ejecuta automatizaciones:** No dispara señales o automatizaciones manualmente (salvo herramientas de diagnóstico explícitas)

#### 1.3.4. Renderizado de Contenido Pedagógico
- **NO es cliente:** No muestra contenido pedagógico para alumnos
- **NO es editor visual:** No es un editor WYSIWYG de contenido (aunque puede contener herramientas de edición)

### 1.4. Diferenciación de Otros Componentes

#### 1.4.1. UI Admin vs API

| Aspecto | UI Admin | API |
|---------|----------|-----|
| **Propósito** | Interfaz visual para gobierno | Contrato programático |
| **Consumidor** | Humanos (administradores) | Código (frontend, integraciones) |
| **Formato de respuesta** | HTML renderizado | JSON canónico |
| **Contexto** | Requiere sesión/autenticación visual | Requiere tokens/headers |
| **Observabilidad** | Visual e interactiva | Logs y métricas |
| **Capacidad de gobierno** | Directa (botones, formularios) | Indirecta (endpoints específicos) |

**Regla:** Una ruta `/admin/api/*` es una API, no una UI Admin. Las APIs sirven a las UIs Admin, pero no son UIs Admin.

#### 1.4.2. UI Admin vs Widget Frontend

| Aspecto | UI Admin | Widget Frontend |
|---------|----------|-----------------|
| **Contexto de ejecución** | Servidor (SSR) | Cliente (browser) |
| **Acceso a Source of Truth** | Directo (servicios canónicos) | Indirecto (APIs) |
| **Propósito** | Gobierno del sistema | Experiencia del usuario final |
| **Observabilidad** | Estado del sistema completo | Estado local del widget |
| **Capacidad de mutación** | Mutaciones auditables del SOT | Mutaciones locales o vía API |

**Regla:** Un widget es un componente reutilizable que puede usarse en UI Admin, pero la UI Admin es el contenedor y contexto de gobierno.

#### 1.4.3. UI Admin vs Pantalla Pedagógica de Alumno

| Aspecto | UI Admin | Pantalla Pedagógica |
|---------|----------|---------------------|
| **Audiencia** | Administradores/Master | Alumnos |
| **Propósito** | Gobierno y observabilidad | Experiencia de aprendizaje |
| **Acceso a datos** | Estado completo del sistema | Estado personal del alumno |
| **Capacidad de mutación** | Mutaciones del sistema | Acciones del alumno (limitadas) |
| **Contexto** | Contexto de administración | Contexto de alumno |

**Regla:** Una pantalla pedagógica muestra contenido y permite acciones del alumno. Una UI Admin permite gobernar el sistema que genera ese contenido.

#### 1.4.4. UI Admin vs Editor Visual

| Aspecto | UI Admin | Editor Visual |
|---------|----------|---------------|
| **Propósito** | Gobierno del sistema | Creación/edición de contenido |
| **Alcance** | Todo el sistema | Contenido específico (temas, widgets, etc.) |
| **Naturaleza** | Nodo del sistema | Herramienta dentro de una UI Admin |
| **Persistencia** | A través de servicios canónicos | Puede ser temporal (drafts) |

**Regla:** Un editor visual puede ser una herramienta **dentro** de una UI Admin, pero la UI Admin es el contexto que lo contiene y gobierna su persistencia.

### 1.5. Por qué la UI Admin es un "Nodo Vivo"

Una UI Admin es un **nodo vivo** porque:

#### 1.5.1. Es Contextual
- **Se adapta al estado del sistema:** En modo BROKEN, bloquea escrituras. En modo DEGRADED, muestra advertencias.
- **Respeta feature flags:** Muestra u oculta funcionalidades según el estado de los flags.
- **Refleja el estado real:** No muestra datos cacheados o desactualizados, sino el estado actual del Source of Truth.

#### 1.5.2. Es Observable
- **Propaga trace_id:** Toda acción genera un trace_id que permite correlacionar eventos.
- **Emite señales:** Las acciones relevantes pueden convertirse en señales registradas.
- **Logging estructurado:** Todo evento se registra con contexto suficiente para diagnóstico.

#### 1.5.3. Es Versionable
- **Respeta versionado:** Los cambios en el sistema respetan versionado explícito (major/minor).
- **Auditoría:** Toda mutación queda auditada (quién, cuándo, qué, por qué).
- **Deprecación controlada:** Permite deprecar elementos con versionado y migración.

#### 1.5.4. Es Integrada al Sistema
- **No es externa:** No es un "panel separado" que consulta el sistema. Es parte del sistema.
- **Respeta contratos:** No puede violar contratos canónicos (Projection Contracts, Action Registry, etc.).
- **Participa en el flujo:** Las mutaciones desde UI Admin pasan por los mismos servicios canónicos que cualquier otra mutación.

#### 1.5.5. Es Gobernable
- **Puede modificarse a sí misma:** Una UI Admin puede contener herramientas para modificar otras UIs Admin (registro de rutas, capabilities, etc.).
- **No está cerrada:** El sistema permite añadir/modificar/retirar UIs Admin sin "cerrar" el sistema.

### 1.6. Implicaciones Arquitectónicas

La naturaleza de "nodo vivo" implica que:

1. **Una UI Admin no puede ser estática:** Debe poder adaptarse a cambios en el sistema sin requerir redeploy.

2. **Una UI Admin debe ser trazable:** Toda acción debe poder rastrearse hasta su origen (usuario, contexto, trace_id).

3. **Una UI Admin debe ser auditable:** Toda mutación debe quedar registrada con suficiente contexto para diagnóstico forense.

4. **Una UI Admin debe respetar contratos:** No puede "bypassear" servicios canónicos para "arreglar rápido" un problema.

5. **Una UI Admin debe ser observable:** Debe poder diagnosticarse a sí misma (errores, estado, dependencias).

### 1.7. Conclusión de la Definición

Una **UI Admin** en AuriPortal es:

> **Un nodo vivo del sistema que materializa la capacidad de gobierno y observabilidad mediante una interfaz visual interactiva, contextual, observable, versionable e integrada al sistema, que permite inspeccionar, modificar y retirar elementos del sistema respetando contratos canónicos, con auditoría y trazabilidad completas.**

Esta definición implica que la creación de una UI Admin requiere:
- Un sistema canónico que garantice su naturaleza de "nodo vivo"
- Contratos explícitos que definan su comportamiento
- Integración con el sistema de observabilidad
- Capacidad de versionado y auditoría
- Respeto de invariantes del sistema

Sin estos elementos, una "pantalla admin" no es una UI Admin canónica, sino una herramienta ad-hoc que viola la arquitectura del sistema.

---

**Fin de la Sección 1: Definición Ontológica de la UI Admin**

---

## 2. Capas del Sistema de UI Admin

### 2.1. Introducción

Una UI Admin **NO es autosuficiente**. Es un nodo sostenido por múltiples capas del sistema, cada una con responsabilidades específicas y jerarquía clara.

Esta sección define **todas las capas** que rodean y sostienen a una UI Admin, explicando:
- Qué es cada capa
- Qué autoridad tiene
- Cómo interactúa con la UI Admin
- Qué ocurre si esa capa falla (fail-open, fail-closed, degradación)

**Principio fundamental:** Si una capa falla, la UI Admin debe degradarse de forma controlada, nunca fallar silenciosamente ni romper el sistema.

### 2.2. Router & Router Registry

#### 2.2.1. Qué es

El **Router & Router Registry** es la capa que:
- **Registra** todas las rutas `/admin/*` en un registry canónico
- **Resuelve** qué handler debe ejecutarse para cada ruta
- **Valida** que las rutas cumplan invariantes (ej: `/admin/api/*` nunca es `type='island'`)
- **Diferencia** entre rutas API (JSON) y rutas Island (HTML)

#### 2.2.2. Autoridad

El Router Registry es **Source of Truth** de:
- Qué rutas existen en el sistema
- Qué tipo tiene cada ruta (`api`, `island`, `legacy`)
- Qué handler corresponde a cada ruta
- Qué método HTTP acepta cada ruta

**Regla absoluta:** Si una ruta no está en el registry, **NO puede funcionar**. No existe "ruta implícita" o "ruta por inferencia" para nuevas rutas.

#### 2.2.3. Interacción con UI Admin

1. **Registro:** Una UI Admin debe registrarse en el Router Registry antes de ser accesible
2. **Resolución:** El router resuelve la ruta y determina si es `type='island'` (UI Admin) o `type='api'` (API)
3. **Contexto:** El router establece el contexto necesario para que `renderAdminPage()` funcione
4. **Validación:** El router valida que la ruta cumpla invariantes antes de ejecutar el handler

#### 2.2.4. Fallo de la Capa

**Comportamiento:** **FAIL-CLOSED**

- **Si el registry es inválido:** El servidor **NO arranca** (fail-fast en boot)
- **Si una ruta no está registrada:** Devuelve 404 canónico (no intenta inferir)
- **Si el resolver falla:** Devuelve 500 con Error Contract v1 (no fallo silencioso)
- **Si hay conflicto de rutas:** El servidor **NO arranca** hasta resolver el conflicto

**Razón:** El router es la puerta de entrada. Si falla, no puede haber UI Admin funcional.

### 2.3. Assembly Check & Static Verification

#### 2.3.1. Qué es

El **Assembly Check** es un sistema de verificación estática que:
- **Verifica** que todas las rutas `/admin/api/*` tengan `type='api'`
- **Verifica** que todas las rutas `island` usen `renderAdminPage()`
- **Verifica** que los placeholders del template se reemplacen correctamente
- **Verifica** que los scripts globales no se dupliquen
- **Verifica** que las capabilities declaradas existan

#### 2.3.2. Autoridad

El Assembly Check es **autoridad de validación** de:
- Integridad estructural de las UIs Admin
- Cumplimiento de contratos de render
- Ausencia de errores de ensamblaje

**Regla:** Una UI Admin **NO se considera implementada** si no pasa el Assembly Check.

#### 2.3.3. Interacción con UI Admin

1. **Verificación pre-deploy:** El Assembly Check se ejecuta antes de considerar una UI Admin "completa"
2. **Detección de errores:** Identifica violaciones de contratos (ej: sidebar placeholder no reemplazado)
3. **Prevención de regresiones:** Detecta cuando una UI Admin rompe invariantes

#### 2.3.4. Fallo de la Capa

**Comportamiento:** **FAIL-OPEN con WARNINGS**

- **Si el check falla:** Emite warnings pero **NO bloquea** el arranque del servidor
- **Si hay errores críticos:** Se registran en logs estructurados para diagnóstico
- **En CI/CD:** Puede configurarse para bloquear merge si hay errores (fail-closed opcional)

**Razón:** El Assembly Check es una herramienta de diagnóstico, no un bloqueador crítico. El sistema debe poder arrancar aunque haya warnings.

### 2.4. Context System (Auth, Role, Env, Mode, Feature Flags)

#### 2.4.1. Qué es

El **Context System** es la capa que proporciona:
- **Autenticación:** Verificación de acceso (password, IPs permitidas)
- **Rol:** Identificación del usuario (admin, master, etc.)
- **Entorno:** Variables de entorno y configuración
- **Modo del sistema:** Estado global (NORMAL, DEGRADED, BROKEN)
- **Feature flags:** Estado de funcionalidades (on/off/beta)

#### 2.4.2. Autoridad

El Context System es **autoridad de**:
- Quién puede acceder a qué
- Qué funcionalidades están disponibles
- Qué operaciones están permitidas según el modo del sistema
- Qué valores de configuración usar

**Regla:** El Context System es **Source of Truth** del estado de acceso y disponibilidad.

#### 2.4.3. Interacción con UI Admin

1. **Autenticación:** La UI Admin consulta el Context System para validar acceso
2. **Adaptación:** La UI Admin se adapta según el modo del sistema (bloquea escrituras en BROKEN)
3. **Feature flags:** La UI Admin muestra/oculta funcionalidades según flags
4. **Permisos:** La UI Admin valida permisos antes de permitir acciones

#### 2.4.4. Fallo de la Capa

**Comportamiento:** **FAIL-CLOSED con DEGRADACIÓN**

- **Si la autenticación falla:** Acceso denegado (403) - **FAIL-CLOSED**
- **Si el modo del sistema es BROKEN:** Escrituras bloqueadas, solo lectura - **DEGRADACIÓN**
- **Si el modo es DEGRADED:** Escrituras permitidas con advertencias - **DEGRADACIÓN**
- **Si los feature flags no se pueden leer:** Asume estado conservador (off) - **FAIL-CLOSED**

**Razón:** La seguridad es prioritaria. Si no se puede verificar acceso, se deniega. Si el sistema está roto, se limita funcionalidad.

### 2.5. Source of Truth & Servicios Canónicos

#### 2.5.1. Qué es

El **Source of Truth (SOT) & Servicios Canónicos** es la capa que:
- **Almacena** datos en PostgreSQL como única autoridad
- **Expone** servicios canónicos para leer y modificar datos
- **Valida** todas las mutaciones según contratos
- **Audita** todas las operaciones

#### 2.5.2. Autoridad

El SOT es **autoridad absoluta** de:
- Estado de todas las entidades del sistema (alumnos, catálogos, señales, etc.)
- Reglas de negocio (niveles, XP, clasificaciones)
- Validaciones duras (invariantes)

**Regla:** La UI Admin **NUNCA** modifica PostgreSQL directamente. Siempre pasa por servicios canónicos.

#### 2.5.3. Interacción con UI Admin

1. **Lectura:** La UI Admin consulta servicios canónicos para leer datos
2. **Escritura:** La UI Admin llama servicios canónicos para modificar datos
3. **Validación:** Los servicios canónicos validan antes de persistir
4. **Auditoría:** Los servicios canónicos registran todas las mutaciones

#### 2.5.4. Fallo de la Capa

**Comportamiento:** **FAIL-CLOSED con ERROR EXPLÍCITO**

- **Si PostgreSQL no está disponible:** La UI Admin muestra error canónico (Error Contract v1) - **FAIL-CLOSED**
- **Si un servicio canónico falla:** La UI Admin muestra el error del servicio (no lo oculta) - **FAIL-CLOSED**
- **Si la validación falla:** La UI Admin muestra el error de validación explícito - **FAIL-CLOSED**

**Razón:** El SOT es crítico. Si no está disponible o falla, la UI Admin no puede funcionar. Debe fallar explícitamente, nunca silenciosamente.

### 2.6. Señales & Observabilidad

#### 2.6.1. Qué es

El sistema de **Señales & Observabilidad** es la capa que:
- **Registra** señales canónicas (eventos del sistema)
- **Propaga** `trace_id` para correlación de eventos
- **Registra** logs estructurados
- **Expone** métricas y diagnósticos

#### 2.6.2. Autoridad

El sistema de Señales es **autoridad de**:
- Qué señales están registradas y disponibles
- Cómo se correlacionan eventos por `trace_id`
- Qué información se registra en logs

**Regla:** Solo se pueden emitir señales **registradas**. No hay señales ad-hoc.

#### 2.6.3. Interacción con UI Admin

1. **Emisión de señales:** La UI Admin puede emitir señales registradas cuando ocurren eventos relevantes
2. **Propagación de trace_id:** La UI Admin propaga `trace_id` en todas las operaciones
3. **Logging:** La UI Admin registra eventos con logging estructurado
4. **Diagnóstico:** La UI Admin expone diagnósticos correlados por `trace_id`

#### 2.6.4. Fallo de la Capa

**Comportamiento:** **FAIL-OPEN con DEGRADACIÓN**

- **Si el sistema de señales falla:** La UI Admin continúa funcionando pero **NO emite señales** - **DEGRADACIÓN**
- **Si el logging falla:** La UI Admin continúa pero los eventos no se registran - **DEGRADACIÓN**
- **Si no se puede propagar trace_id:** La UI Admin funciona pero sin correlación - **DEGRADACIÓN**

**Razón:** La observabilidad es importante pero no crítica. Si falla, la UI Admin debe seguir funcionando, aunque sin observabilidad completa.

### 2.7. Automatizaciones (Sistema Separado)

#### 2.7.1. Qué es

El sistema de **Automatizaciones** es una capa separada que:
- **Ejecuta** automatizaciones registradas cuando ocurren señales
- **Gestiona** el ciclo de vida de automatizaciones (draft, active, archived)
- **Registra** ejecuciones y resultados

#### 2.7.2. Autoridad

El sistema de Automatizaciones es **autoridad de**:
- Qué automatizaciones están activas
- Cómo se ejecutan las automatizaciones
- Qué acciones se disparan por señales

**Regla:** Las automatizaciones son **independientes** de la UI Admin. La UI Admin puede inspeccionarlas y modificarlas, pero no las ejecuta directamente.

#### 2.7.3. Interacción con UI Admin

1. **Inspección:** La UI Admin puede visualizar automatizaciones y su estado
2. **Modificación:** La UI Admin puede crear/modificar/archivar automatizaciones
3. **Ejecución manual (diagnóstico):** La UI Admin puede disparar ejecuciones manuales para diagnóstico (herramienta explícita)
4. **Observabilidad:** La UI Admin puede ver historial de ejecuciones

#### 2.7.4. Fallo de la Capa

**Comportamiento:** **FAIL-OPEN con DEGRADACIÓN**

- **Si el sistema de automatizaciones falla:** La UI Admin puede seguir inspeccionando y modificando, pero las automatizaciones no se ejecutan - **DEGRADACIÓN**
- **Si no se pueden leer automatizaciones:** La UI Admin muestra error pero sigue funcionando para otras funcionalidades - **DEGRADACIÓN**

**Razón:** Las automatizaciones son importantes pero no críticas para el funcionamiento básico de la UI Admin. Si fallan, la UI Admin debe seguir funcionando.

### 2.8. Sidebar & Navigation Registry

#### 2.8.1. Qué es

El **Sidebar & Navigation Registry** es la capa que:
- **Registra** elementos de navegación del sidebar
- **Genera** HTML del sidebar según ruta activa
- **Resuelve** visibilidad según feature flags y permisos
- **Mantiene** estado de navegación (scroll, secciones expandidas)

#### 2.8.2. Autoridad

El Sidebar Registry es **autoridad de**:
- Qué elementos aparecen en el sidebar
- Cómo se estructura la navegación
- Qué elementos son visibles según contexto

**Regla:** El sidebar es **gobernado**, no hardcodeado. No hay lógica de sidebar por pantalla.

#### 2.8.3. Interacción con UI Admin

1. **Generación:** El sidebar se genera automáticamente al renderizar una UI Admin
2. **Contexto:** El sidebar recibe el contexto (ruta activa, permisos, feature flags)
3. **Persistencia:** El sidebar mantiene estado de navegación en el cliente
4. **Inyección:** El sidebar se inyecta en el template base mediante placeholder

#### 2.8.4. Fallo de la Capa

**Comportamiento:** **FAIL-OPEN con DEGRADACIÓN**

- **Si el sidebar no se puede generar:** La UI Admin se renderiza sin sidebar (placeholder visible) - **DEGRADACIÓN**
- **Si el registry falla:** La UI Admin funciona pero sin navegación - **DEGRADACIÓN**
- **Si el cliente del sidebar falla:** La UI Admin funciona pero sin persistencia de estado - **DEGRADACIÓN**

**Razón:** El sidebar es importante para UX pero no crítico. Si falla, la UI Admin debe seguir funcionando, aunque sin navegación.

### 2.9. Themes & UI Appearance System

#### 2.9.1. Qué es

El sistema de **Themes & UI Appearance** es la capa que:
- **Gestiona** temas visuales (dark, light, custom)
- **Resuelve** capabilities semánticas a tokens visuales
- **Aplica** estilos según tema activo
- **Mantiene** consistencia visual entre UIs Admin

#### 2.9.2. Autoridad

El sistema de Themes es **autoridad de**:
- Qué temas están disponibles
- Cómo se mapean capabilities a tokens visuales
- Qué estilos se aplican

**Regla:** La UI Admin es **capability-first**, no hardcodea estilos. Los estilos vienen del Theme Resolver.

#### 2.9.3. Interacción con UI Admin

1. **Declaración:** La UI Admin declara capabilities semánticas (ej: "primary-action", "warning-badge")
2. **Resolución:** El Theme Resolver mapea capabilities a tokens visuales según tema activo
3. **Aplicación:** Los estilos se aplican automáticamente
4. **Consistencia:** Todas las UIs Admin comparten el mismo sistema de temas

#### 2.9.4. Fallo de la Capa

**Comportamiento:** **FAIL-OPEN con FALLBACK**

- **Si el Theme Resolver falla:** La UI Admin usa tema por defecto (fallback) - **FALLBACK**
- **Si no se puede cargar el tema:** La UI Admin funciona con estilos mínimos - **FALLBACK**
- **Si las capabilities no se resuelven:** La UI Admin funciona pero sin estilos personalizados - **FALLBACK**

**Razón:** Los temas son importantes para UX pero no críticos. Si fallan, la UI Admin debe funcionar con estilos básicos.

### 2.10. Runtime UI (Render, Lifecycle)

#### 2.10.1. Qué es

El **Runtime UI** es la capa que:
- **Renderiza** HTML de la UI Admin usando `renderAdminPage()`
- **Gestiona** el ciclo de vida (carga, render, cleanup)
- **Inyecta** scripts y estilos adicionales
- **Maneja** el template base y placeholders

#### 2.10.2. Autoridad

El Runtime UI es **autoridad de**:
- Cómo se renderiza una UI Admin
- Qué template base se usa
- Cómo se inyectan scripts y estilos
- Cómo se reemplazan placeholders

**Regla:** Toda UI Admin debe usar `renderAdminPage()`. No hay renderizado manual de HTML completo.

#### 2.10.3. Interacción con UI Admin

1. **Renderizado:** El Runtime UI renderiza la UI Admin usando el template base
2. **Inyección:** El Runtime UI inyecta el contenido de la UI Admin en el placeholder `{{CONTENT}}`
3. **Scripts:** El Runtime UI carga scripts adicionales declarados por la UI Admin
4. **Lifecycle:** El Runtime UI gestiona el ciclo de vida completo

#### 2.10.4. Fallo de la Capa

**Comportamiento:** **FAIL-CLOSED con ERROR EXPLÍCITO**

- **Si `renderAdminPage()` falla:** Devuelve error canónico (Error Contract v1) - **FAIL-CLOSED**
- **Si el template base no existe:** Devuelve error explícito - **FAIL-CLOSED**
- **Si los placeholders no se reemplazan:** Devuelve error (no renderiza HTML incompleto) - **FAIL-CLOSED**

**Razón:** El Runtime UI es crítico. Si falla, no puede haber UI Admin funcional. Debe fallar explícitamente.

### 2.11. Logs, Auditoría y Diagnóstico

#### 2.11.1. Qué es

El sistema de **Logs, Auditoría y Diagnóstico** es la capa que:
- **Registra** todas las operaciones con contexto completo
- **Audita** mutaciones (quién, cuándo, qué, por qué)
- **Correla** eventos por `trace_id`
- **Expone** diagnósticos para inspección

#### 2.11.2. Autoridad

El sistema de Auditoría es **autoridad de**:
- Historial completo de mutaciones
- Trazabilidad de operaciones
- Diagnóstico de errores

**Regla:** Toda mutación debe quedar auditada. No hay mutaciones "silenciosas".

#### 2.11.3. Interacción con UI Admin

1. **Registro:** La UI Admin registra todas las operaciones con logging estructurado
2. **Auditoría:** Las mutaciones desde UI Admin quedan auditadas automáticamente
3. **Diagnóstico:** La UI Admin expone diagnósticos correlados por `trace_id`
4. **Inspección:** La UI Admin permite inspeccionar logs y auditoría

#### 2.11.4. Fallo de la Capa

**Comportamiento:** **FAIL-OPEN con DEGRADACIÓN**

- **Si el sistema de auditoría falla:** La UI Admin funciona pero **NO audita** mutaciones - **DEGRADACIÓN**
- **Si los logs no se pueden escribir:** La UI Admin funciona pero sin registro - **DEGRADACIÓN**
- **Si no se pueden leer diagnósticos:** La UI Admin funciona pero sin capacidad de diagnóstico - **DEGRADACIÓN**

**Razón:** La auditoría es importante pero no crítica. Si falla, la UI Admin debe seguir funcionando, aunque sin auditoría.

### 2.12. Seguridad y Permisos

#### 2.12.1. Qué es

El sistema de **Seguridad y Permisos** es la capa que:
- **Valida** autenticación (password, IPs)
- **Verifica** permisos según rol
- **Protege** endpoints sensibles
- **Gestiona** sesiones y tokens

#### 2.12.2. Autoridad

El sistema de Seguridad es **autoridad de**:
- Quién puede acceder
- Qué operaciones están permitidas
- Cómo se gestionan sesiones

**Regla:** La seguridad es **obligatoria**. No hay "modo inseguro" en producción.

#### 2.12.3. Interacción con UI Admin

1. **Validación:** La UI Admin valida acceso antes de renderizar
2. **Permisos:** La UI Admin verifica permisos antes de permitir acciones
3. **Protección:** La UI Admin protege endpoints sensibles
4. **Sesión:** La UI Admin gestiona sesión del usuario

#### 2.12.4. Fallo de la Capa

**Comportamiento:** **FAIL-CLOSED**

- **Si la autenticación falla:** Acceso denegado (403) - **FAIL-CLOSED**
- **Si no se pueden verificar permisos:** Acceso denegado (403) - **FAIL-CLOSED**
- **Si la sesión es inválida:** Acceso denegado (401) - **FAIL-CLOSED**

**Razón:** La seguridad es crítica. Si no se puede verificar, se deniega acceso. No hay "fallo abierto" en seguridad.

### 2.13. Mobile & Multi-dispositivo (Conceptual)

#### 2.13.1. Qué es

El sistema de **Mobile & Multi-dispositivo** es la capa conceptual que:
- **Adapta** la UI Admin a diferentes tamaños de pantalla
- **Optimiza** para dispositivos móviles
- **Gestiona** interacciones táctiles
- **Mantiene** funcionalidad completa en todos los dispositivos

#### 2.13.2. Autoridad

El sistema Multi-dispositivo es **autoridad de**:
- Cómo se adapta la UI Admin a diferentes dispositivos
- Qué interacciones están disponibles según dispositivo
- Cómo se optimiza el rendimiento

**Regla:** La UI Admin debe ser **responsive** y funcional en todos los dispositivos.

#### 2.13.3. Interacción con UI Admin

1. **Adaptación:** La UI Admin se adapta automáticamente según tamaño de pantalla
2. **Optimización:** La UI Admin optimiza carga y rendimiento según dispositivo
3. **Interacciones:** La UI Admin adapta interacciones (táctil vs mouse)
4. **Funcionalidad:** La UI Admin mantiene funcionalidad completa en todos los dispositivos

#### 2.13.4. Fallo de la Capa

**Comportamiento:** **FAIL-OPEN con DEGRADACIÓN**

- **Si la adaptación falla:** La UI Admin funciona pero con UX degradada en móvil - **DEGRADACIÓN**
- **Si las optimizaciones fallan:** La UI Admin funciona pero con rendimiento degradado - **DEGRADACIÓN**
- **Si las interacciones táctiles fallan:** La UI Admin funciona pero requiere mouse - **DEGRADACIÓN**

**Razón:** La adaptación multi-dispositivo es importante pero no crítica. Si falla, la UI Admin debe seguir funcionando, aunque con UX degradada.

### 2.14. Editor de Pantallas (Consumidor Futuro)

#### 2.14.1. Qué es

El **Editor de Pantallas** es una capa conceptual futura que:
- **Permite** crear/modificar UIs Admin visualmente
- **Consume** el contrato de UI Admin para generar código
- **Valida** que las UIs Admin generadas cumplan el contrato
- **Gestiona** versionado de UIs Admin creadas visualmente

#### 2.14.2. Autoridad

El Editor de Pantallas será **autoridad de**:
- Cómo se crean UIs Admin visualmente
- Qué validaciones se aplican
- Cómo se versionan las UIs Admin generadas

**Regla:** El Editor de Pantallas **debe consumir** el contrato de UI Admin, no crear un sistema paralelo.

#### 2.14.3. Interacción con UI Admin

1. **Generación:** El Editor genera código de UI Admin que cumple el contrato
2. **Validación:** El Editor valida que las UIs Admin generadas pasen Assembly Check
3. **Versionado:** El Editor gestiona versionado de UIs Admin generadas
4. **Consumo:** El Editor consume el contrato para saber qué puede crear

#### 2.14.4. Fallo de la Capa

**Comportamiento:** **NO APLICA (Futuro)**

- **Estado actual:** El Editor de Pantallas no existe todavía
- **Cuando exista:** Debe seguir las mismas reglas de fallo que otras capas (fail-closed para validaciones, fail-open para UX)

**Razón:** El Editor es una herramienta de creación, no crítica para el funcionamiento de UIs Admin existentes.

### 2.15. Jerarquía y Dependencias

#### 2.15.1. Orden de Dependencias

Las capas tienen una jerarquía clara:

1. **Router & Router Registry** (crítica, fail-closed)
2. **Context System** (crítica, fail-closed)
3. **Source of Truth & Servicios Canónicos** (crítica, fail-closed)
4. **Seguridad y Permisos** (crítica, fail-closed)
5. **Runtime UI** (crítica, fail-closed)
6. **Assembly Check** (verificación, fail-open con warnings)
7. **Señales & Observabilidad** (importante, fail-open con degradación)
8. **Automatizaciones** (importante, fail-open con degradación)
9. **Sidebar & Navigation** (importante, fail-open con degradación)
10. **Themes & UI Appearance** (importante, fail-open con fallback)
11. **Logs, Auditoría y Diagnóstico** (importante, fail-open con degradación)
12. **Mobile & Multi-dispositivo** (importante, fail-open con degradación)
13. **Editor de Pantallas** (futuro, no aplica)

#### 2.15.2. Principio de Degradación Controlada

Si una capa no crítica falla:
- La UI Admin **debe seguir funcionando**
- La funcionalidad afectada **debe degradarse** de forma controlada
- El usuario **debe ser informado** de la degradación
- Los errores **deben quedar registrados** para diagnóstico

Si una capa crítica falla:
- La UI Admin **debe fallar explícitamente** (no silenciosamente)
- El error **debe ser canónico** (Error Contract v1)
- El diagnóstico **debe ser claro**

### 2.16. Conclusión de las Capas

Una UI Admin es un **nodo sostenido por múltiples capas** con jerarquía clara:

- **Capas críticas** (Router, Context, SOT, Seguridad, Runtime): Si fallan, la UI Admin no puede funcionar. Deben fallar explícitamente.
- **Capas importantes** (Observabilidad, Automatizaciones, Sidebar, Themes, Auditoría, Mobile): Si fallan, la UI Admin debe degradarse de forma controlada, no fallar completamente.

**Principio fundamental:** Una UI Admin **NO es autosuficiente**. Depende de todas estas capas. Si una capa crítica falla, la UI Admin falla explícitamente. Si una capa no crítica falla, la UI Admin se degrada pero sigue funcionando.

---

**Fin de la Sección 2: Capas del Sistema de UI Admin**

---

## 3. Capacidades del Sistema de UI Admin

### 3.1. Introducción

Esta sección enumera **todas las capacidades posibles** que una UI Admin puede tener en AuriPortal. Una capacidad es una funcionalidad específica que la UI Admin puede declarar, consumir o ejercer.

**Principio:** Esta lista es **exhaustiva y explícita**. Si mañana quisiéramos crear una UI Admin desde un editor visual, todas las capacidades necesarias deberían estar aquí.

**Clasificación:** Las capacidades se dividen en dos categorías:
- **Constitucionales:** Necesarias para que una UI sea canónica (contratos, routing, contextos, señales, seguridad, render, diagnóstico). Definen la ontología de una UI Admin.
- **Producto/UX:** Mejoras de experiencia que hacen la vida mejor, pero no definen ontología. Son opcionales y mejoran usabilidad.

**Identificación:** Cada capacidad tiene un **ID estable** con formato `PREFIJO-NNN` (ej: `CTX-001`, `OBS-003`, `ACT-007`). Estos IDs permiten:
- Referenciar capacidades desde el editor visual
- Indexar capacidades en el registry futuro
- Referenciar desde el "Contrato de Contratos"

**Nota:** Esta sección NO clasifica capacidades en CORE/READY/FUTURE, ni define dependencias, ni describe implementación. Solo enumera y describe qué es posible.

### 3.2. Capacidades Constitucionales

Las capacidades constitucionales son **necesarias** para que una UI sea canónica. Sin ellas, una "pantalla admin" no es una UI Admin según la ontología definida en la Sección 1.

#### 3.2.1. Contextos y Estado

**CTX-001. Acceso a Contexto de Usuario**  
Permite a la UI Admin conocer quién es el usuario actual (rol, permisos, identidad). Existe para adaptar la UI según el usuario y validar permisos antes de acciones. Resuelve el problema de personalización y seguridad basada en roles.

**CTX-002. Acceso a Modo del Sistema**  
Permite a la UI Admin conocer el modo actual del sistema (NORMAL, DEGRADED, BROKEN). Existe para adaptar funcionalidad según el estado del sistema (bloquear escrituras en BROKEN). Resuelve el problema de degradación controlada y prevención de operaciones en estados críticos.

**CTX-003. Acceso a Feature Flags**  
Permite a la UI Admin leer el estado de feature flags (on/off/beta). Existe para mostrar/ocultar funcionalidades según flags. Resuelve el problema de rollout gradual y control de disponibilidad de features.

**CTX-004. Acceso a Variables de Entorno**  
Permite a la UI Admin leer variables de entorno relevantes (configuración, URLs, límites). Existe para adaptar comportamiento según configuración del entorno. Resuelve el problema de configuración por entorno sin hardcodear valores.

#### 3.2.2. Observabilidad y Señales

**OBS-001. Emisión de Señales Registradas**  
Permite a la UI Admin emitir señales canónicas cuando ocurren eventos relevantes. Existe para integrar acciones de UI Admin con el sistema de automatizaciones. Resuelve el problema de trazabilidad y disparo de automatizaciones desde acciones manuales.

**OBS-002. Propagación de Trace ID**  
Permite a la UI Admin propagar `trace_id` en todas las operaciones para correlación. Existe para rastrear flujos completos de operaciones a través del sistema. Resuelve el problema de diagnóstico y correlación de eventos distribuidos.

**OBS-003. Logging Estructurado**  
Permite a la UI Admin registrar eventos con logging estructurado (nivel, contexto, metadata). Existe para diagnóstico y análisis de comportamiento. Resuelve el problema de observabilidad y debugging de operaciones complejas.

**OBS-004. Correlación de Eventos por Trace ID**  
Permite a la UI Admin buscar y visualizar todos los eventos correlados por un `trace_id`. Existe para diagnóstico forense de operaciones complejas. Resuelve el problema de rastreo de flujos completos a través de múltiples sistemas.

#### 3.2.3. Acciones y Mutaciones

**ACT-001. Lectura de Source of Truth**  
Permite a la UI Admin leer datos desde servicios canónicos (alumnos, catálogos, entidades). Existe para mostrar estado actual del sistema. Resuelve el problema de visualización de datos autoritativos.

**ACT-002. Escritura en Source of Truth**  
Permite a la UI Admin modificar datos a través de servicios canónicos. Existe para permitir gobierno del sistema desde la UI. Resuelve el problema de mutaciones controladas y auditables.

**ACT-003. Validación de Mutaciones**  
Permite a la UI Admin validar mutaciones antes de enviarlas (validación en cliente y servidor). Existe para prevenir errores y mejorar UX. Resuelve el problema de validación temprana y feedback inmediato.

**ACT-004. Confirmación de Acciones Destructivas**  
Permite a la UI Admin solicitar confirmación antes de acciones destructivas (eliminar, archivar). Existe para prevenir errores accidentales. Resuelve el problema de seguridad y prevención de pérdida de datos.

#### 3.2.4. Automatizaciones

**AUT-001. Visualización de Automatizaciones**  
Permite a la UI Admin listar y visualizar automatizaciones registradas (estado, configuración, historial). Existe para inspección y gobierno del sistema de automatizaciones. Resuelve el problema de visibilidad y gestión de automatizaciones.

**AUT-002. Creación de Automatizaciones**  
Permite a la UI Admin crear nuevas automatizaciones mediante formularios o editores. Existe para permitir gobierno del sistema de automatizaciones desde la UI. Resuelve el problema de creación accesible de automatizaciones.

**AUT-003. Modificación de Automatizaciones**  
Permite a la UI Admin editar automatizaciones existentes (cambiar triggers, acciones, condiciones). Existe para evolución y mantenimiento de automatizaciones. Resuelve el problema de actualización de automatizaciones sin código.

**AUT-004. Activación/Desactivación de Automatizaciones**  
Permite a la UI Admin activar o desactivar automatizaciones sin eliminarlas. Existe para control temporal sin perder configuración. Resuelve el problema de pausa y reanudación de automatizaciones.

**AUT-005. Archivo de Automatizaciones**  
Permite a la UI Admin archivar automatizaciones obsoletas con versionado. Existe para limpieza y mantenimiento del sistema. Resuelve el problema de deprecación controlada de automatizaciones.

#### 3.2.5. Navegación y Sidebar

**NAV-001. Generación Automática de Sidebar**  
Permite a la UI Admin tener sidebar generado automáticamente según registry. Existe para consistencia y mantenibilidad. Resuelve el problema de navegación unificada sin duplicación.

**NAV-002. Resaltado de Ruta Activa**  
Permite a la UI Admin resaltar automáticamente la ruta activa en el sidebar. Existe para orientación del usuario. Resuelve el problema de indicación clara de ubicación actual.

**NAV-003. Navegación Jerárquica**  
Permite a la UI Admin tener navegación con estructura jerárquica (secciones, subsecciones). Existe para organización de funcionalidades complejas. Resuelve el problema de escalabilidad de navegación.

**NAV-004. Filtrado de Navegación por Permisos**  
Permite a la UI Admin ocultar elementos de navegación según permisos del usuario. Existe para seguridad y simplificación de UI. Resuelve el problema de personalización de navegación según rol.

**NAV-005. Filtrado de Navegación por Feature Flags**  
Permite a la UI Admin ocultar elementos de navegación según feature flags. Existe para rollout gradual de funcionalidades. Resuelve el problema de control de visibilidad de features.

#### 3.2.6. Layout y Render

**LAY-001. Renderizado con Template Base**  
Permite a la UI Admin usar template base canónico para consistencia. Existe para mantener estructura común y reducir duplicación. Resuelve el problema de consistencia visual y mantenibilidad.

**LAY-002. Inyección de Contenido en Placeholders**  
Permite a la UI Admin inyectar contenido en placeholders del template (TITLE, CONTENT, SIDEBAR). Existe para composición flexible manteniendo estructura. Resuelve el problema de personalización sin romper estructura.

**LAY-003. Inyección de Scripts Adicionales**  
Permite a la UI Admin cargar scripts JavaScript adicionales específicos de la página. Existe para funcionalidad interactiva personalizada. Resuelve el problema de extensibilidad sin modificar template base.

**LAY-004. Inyección de Estilos Adicionales**  
Permite a la UI Admin cargar estilos CSS adicionales específicos de la página. Existe para estilos personalizados sin afectar otras páginas. Resuelve el problema de estilos específicos sin contaminación global.

#### 3.2.7. Themes y Apariencia

**THM-001. Declaración de Capabilities Semánticas**  
Permite a la UI Admin declarar capabilities semánticas (primary-action, warning-badge, etc.). Existe para desacoplar significado de apariencia. Resuelve el problema de temas intercambiables sin cambiar código.

**THM-002. Resolución de Themes**  
Permite a la UI Admin resolver tema activo y aplicar tokens visuales. Existe para consistencia visual y personalización. Resuelve el problema de apariencia unificada y temas personalizables.

**THM-003. Aplicación de Tokens Visuales**  
Permite a la UI Admin aplicar tokens visuales (colores, espaciados, tipografías) desde el tema. Existe para consistencia y mantenibilidad de estilos. Resuelve el problema de estilos centralizados y actualizables.

#### 3.2.8. Seguridad y Permisos

**SEC-001. Validación de Autenticación**  
Permite a la UI Admin validar que el usuario está autenticado antes de renderizar. Existe para seguridad y control de acceso. Resuelve el problema de acceso no autorizado.

**SEC-002. Validación de Permisos por Acción**  
Permite a la UI Admin validar permisos específicos antes de permitir acciones. Existe para control granular de acceso. Resuelve el problema de permisos diferenciados por funcionalidad.

**SEC-003. Ocultación de Elementos según Permisos**  
Permite a la UI Admin ocultar elementos UI según permisos del usuario. Existe para simplificación y seguridad. Resuelve el problema de UI confusa con elementos no accesibles.

**SEC-004. Validación de Permisos en Cliente y Servidor**  
Permite a la UI Admin validar permisos tanto en cliente (UX) como servidor (seguridad). Existe para UX fluida y seguridad real. Resuelve el problema de feedback inmediato sin comprometer seguridad.

**SEC-005. Gestión de Sesiones**  
Permite a la UI Admin gestionar sesiones de usuario (inicio, renovación, cierre). Existe para seguridad y experiencia de usuario. Resuelve el problema de autenticación persistente y expiración.

**SEC-006. Protección CSRF**  
Permite a la UI Admin proteger contra ataques CSRF en mutaciones. Existe para seguridad contra ataques. Resuelve el problema de vulnerabilidades de seguridad.

**SEC-007. Auditoría de Accesos**  
Permite a la UI Admin registrar accesos y acciones para auditoría. Existe para trazabilidad y seguridad. Resuelve el problema de rastreo de accesos y acciones.

### 3.10. Mobile y Multi-dispositivo

#### 3.10.1. Adaptación Responsive Automática
Permite a la UI Admin adaptarse automáticamente a diferentes tamaños de pantalla. Existe para funcionalidad en todos los dispositivos. Resuelve el problema de usabilidad en móviles y tablets.

#### 3.10.2. Optimización de Carga para Móvil
Permite a la UI Admin optimizar carga de recursos según dispositivo. Existe para rendimiento en conexiones lentas. Resuelve el problema de tiempos de carga largos en móvil.

#### 3.10.3. Interacciones Táctiles
Permite a la UI Admin optimizar interacciones para dispositivos táctiles. Existe para usabilidad en móviles. Resuelve el problema de interacciones difíciles en pantallas táctiles.

#### 3.10.4. Gestos y Navegación por Swipe
Permite a la UI Admin soportar gestos comunes (swipe, pinch, etc.). Existe para experiencia nativa en móviles. Resuelve el problema de navegación incómoda en móviles.

#### 3.10.5. Viewport y Zoom Controlado
Permite a la UI Admin controlar viewport y prevenir zoom no deseado. Existe para consistencia visual. Resuelve el problema de layouts rotos por zoom.

#### 3.10.6. Offline Básico
Permite a la UI Admin funcionar parcialmente sin conexión (caché, queue de acciones). Existe para resiliencia y productividad. Resuelve el problema de interrupciones por pérdida de conexión.

#### 3.10.7. Sincronización al Reconectar
Permite a la UI Admin sincronizar cambios pendientes al recuperar conexión. Existe para no perder trabajo. Resuelve el problema de pérdida de datos por desconexión.

#### 3.2.9. Auditoría y Versionado

**AUD-001. Registro Automático de Mutaciones**  
Permite a la UI Admin registrar automáticamente todas las mutaciones (quién, cuándo, qué). Existe para trazabilidad completa. Resuelve el problema de auditoría y cumplimiento.

**AUD-002. Historial de Cambios**  
Permite a la UI Admin visualizar historial de cambios de entidades. Existe para trazabilidad y recuperación. Resuelve el problema de rastreo de evolución de datos.

**AUD-003. Versionado de Entidades**  
Permite a la UI Admin versionar entidades con números de versión explícitos. Existe para control de cambios y rollback. Resuelve el problema de gestión de versiones de datos.

#### 3.2.10. Diagnóstico y Recuperación

**DIA-001. Visualización de Errores Canónicos**  
Permite a la UI Admin mostrar errores usando Error Contract v1 con diagnóstico claro. Existe para debugging y recuperación. Resuelve el problema de errores crípticos y falta de diagnóstico.

**DIA-002. Búsqueda de Errores por Trace ID**  
Permite a la UI Admin buscar y visualizar todos los errores correlados por `trace_id`. Existe para diagnóstico de flujos complejos. Resuelve el problema de rastreo de errores en sistemas distribuidos.

**DIA-003. Health Dashboard**  
Permite a la UI Admin mostrar dashboard de salud del sistema (servicios, dependencias, métricas). Existe para monitoreo proactivo. Resuelve el problema de visibilidad del estado del sistema.

#### 3.2.11. Preparación para Editor de Pantallas

**EDI-001. Declaración de Estructura de UI**  
Permite a la UI Admin declarar su estructura de forma declarativa (componentes, layout, flujos). Existe para que el editor visual pueda entender y modificar la UI. Resuelve el problema de creación visual de UIs Admin.

**EDI-002. Metadata de Componentes**  
Permite a la UI Admin incluir metadata de componentes (nombre, descripción, propiedades, validaciones). Existe para que el editor visual pueda mostrar y configurar componentes. Resuelve el problema de configuración visual de componentes.

**EDI-003. Contratos de Datos**  
Permite a la UI Admin declarar contratos de datos que consume (schemas, validaciones). Existe para que el editor visual pueda validar y sugerir conexiones. Resuelve el problema de validación y autocompletado en editor.

**EDI-004. Contratos de Acciones**  
Permite a la UI Admin declarar acciones disponibles (mutaciones, navegación, señales). Existe para que el editor visual pueda conectar acciones a eventos. Resuelve el problema de configuración visual de flujos.

**EDI-005. Validación de Contrato**  
Permite a la UI Admin validar que cumple el contrato canónico de UI Admin. Existe para garantizar que UIs generadas son válidas. Resuelve el problema de generación de UIs inválidas.

**EDI-006. Serialización y Deserialización**  
Permite a la UI Admin serializarse y deserializarse para persistencia y edición. Existe para que el editor visual pueda guardar y cargar UIs. Resuelve el problema de persistencia de UIs creadas visualmente.

### 3.3. Capacidades Producto/UX

Las capacidades Producto/UX son **mejoras de experiencia** que hacen la vida mejor, pero no definen la ontología de una UI Admin. Una UI Admin canónica puede existir sin ellas, aunque son deseables para una buena experiencia de usuario.

#### 3.3.1. Contextos y Estado (Producto/UX)

**CTX-005. Gestión de Estado Local**  
Permite a la UI Admin mantener estado local en el cliente (formularios, filtros, selecciones). Existe para mejorar UX sin requerir round-trips al servidor. Resuelve el problema de interactividad fluida y persistencia de preferencias del usuario.

**CTX-006. Sincronización de Estado con Servidor**  
Permite a la UI Admin sincronizar estado local con el servidor (auto-save, validación en tiempo real). Existe para mantener consistencia y prevenir pérdida de datos. Resuelve el problema de sincronización bidireccional y recuperación de estado.

#### 3.3.2. Observabilidad y Señales (Producto/UX)

**OBS-005. Visualización de Métricas en Tiempo Real**  
Permite a la UI Admin mostrar métricas agregadas del sistema (contadores, promedios, tendencias). Existe para dar visibilidad del estado del sistema. Resuelve el problema de monitoreo y toma de decisiones basada en datos.

**OBS-006. Visualización de Estado de Señales**  
Permite a la UI Admin mostrar qué señales se han emitido recientemente y su estado. Existe para diagnóstico y verificación de flujos. Resuelve el problema de visibilidad del sistema de señales.

**OBS-007. Visualización de Health Checks**  
Permite a la UI Admin mostrar el estado de health checks del sistema (servicios, dependencias). Existe para monitoreo proactivo y detección temprana de problemas. Resuelve el problema de visibilidad del estado de salud del sistema.

#### 3.3.3. Acciones y Mutaciones (Producto/UX)

**ACT-005. Operaciones en Lote**  
Permite a la UI Admin ejecutar operaciones sobre múltiples entidades simultáneamente. Existe para eficiencia y productividad. Resuelve el problema de gestión masiva de entidades.

**ACT-006. Operaciones Asíncronas con Feedback**  
Permite a la UI Admin ejecutar operaciones largas con feedback de progreso. Existe para mejorar UX en operaciones largas. Resuelve el problema de visibilidad de progreso y cancelación de operaciones.

**ACT-007. Rollback de Mutaciones**  
Permite a la UI Admin revertir mutaciones recientes si es posible. Existe para recuperación de errores. Resuelve el problema de corrección rápida de errores.

**ACT-008. Preview de Cambios**  
Permite a la UI Admin mostrar preview de cambios antes de aplicarlos. Existe para validación visual antes de confirmar. Resuelve el problema de verificación antes de mutaciones irreversibles.

**ACT-009. Drafts y Guardado Temporal**  
Permite a la UI Admin guardar cambios como drafts antes de confirmarlos. Existe para permitir trabajo incremental sin perder progreso. Resuelve el problema de persistencia de trabajo en progreso.

#### 3.3.4. Automatizaciones (Producto/UX)

**AUT-006. Visualización de Historial de Ejecuciones**  
Permite a la UI Admin ver historial de ejecuciones de automatizaciones (éxitos, fallos, tiempos). Existe para diagnóstico y análisis de comportamiento. Resuelve el problema de observabilidad de automatizaciones.

**AUT-007. Ejecución Manual de Automatizaciones**  
Permite a la UI Admin disparar ejecuciones manuales de automatizaciones para diagnóstico. Existe para testing y debugging de automatizaciones. Resuelve el problema de verificación y diagnóstico de automatizaciones.

**AUT-008. Visualización de Dependencias entre Automatizaciones**  
Permite a la UI Admin visualizar cómo se relacionan automatizaciones (qué señales disparan qué). Existe para comprensión del sistema y prevención de ciclos. Resuelve el problema de visibilidad de arquitectura de automatizaciones.

#### 3.3.5. Navegación y Sidebar (Producto/UX)

**NAV-006. Persistencia de Estado de Navegación**  
Permite a la UI Admin recordar estado de navegación (scroll, secciones expandidas). Existe para mejorar UX y productividad. Resuelve el problema de pérdida de contexto al navegar.

**NAV-007. Breadcrumbs**  
Permite a la UI Admin mostrar breadcrumbs para indicar ubicación en jerarquía. Existe para orientación en estructuras profundas. Resuelve el problema de navegación en jerarquías complejas.

**NAV-008. Búsqueda en Navegación**  
Permite a la UI Admin buscar elementos de navegación rápidamente. Existe para eficiencia en sistemas con muchas opciones. Resuelve el problema de descubribilidad en navegación extensa.

#### 3.3.6. Layout y Render (Producto/UX)

**LAY-005. Layouts Responsive**  
Permite a la UI Admin adaptarse automáticamente a diferentes tamaños de pantalla. Existe para funcionalidad en todos los dispositivos. Resuelve el problema de usabilidad multi-dispositivo.

**LAY-006. Grids y Sistemas de Layout**  
Permite a la UI Admin usar sistemas de grid para organización de contenido. Existe para organización visual estructurada. Resuelve el problema de alineación y distribución de elementos.

**LAY-007. Componentes Reutilizables**  
Permite a la UI Admin usar componentes reutilizables (botones, cards, modals, etc.). Existe para consistencia y productividad. Resuelve el problema de duplicación y mantenimiento de UI.

**LAY-008. Lazy Loading de Contenido**  
Permite a la UI Admin cargar contenido pesado de forma diferida. Existe para rendimiento y experiencia de carga. Resuelve el problema de tiempos de carga largos.

**LAY-009. Paginación y Virtualización**  
Permite a la UI Admin paginar o virtualizar listas largas. Existe para rendimiento con grandes volúmenes de datos. Resuelve el problema de renderizado eficiente de listas extensas.

**LAY-010. Skeleton Screens y Loading States**  
Permite a la UI Admin mostrar estados de carga (skeletons, spinners). Existe para feedback visual durante operaciones asíncronas. Resuelve el problema de percepción de rendimiento y feedback.

#### 3.3.7. Themes y Apariencia (Producto/UX)

**THM-004. Modos de Tema (Dark/Light)**  
Permite a la UI Admin soportar múltiples modos de tema (dark, light, custom). Existe para preferencias de usuario y accesibilidad. Resuelve el problema de comodidad visual y preferencias personales.

**THM-005. Personalización de Tema por Usuario**  
Permite a la UI Admin permitir que usuarios personalicen tema (si está habilitado). Existe para personalización y preferencias. Resuelve el problema de adaptación a preferencias individuales.

**THM-006. Iconografía Consistente**  
Permite a la UI Admin usar iconografía consistente desde sistema de iconos. Existe para coherencia visual y comunicación clara. Resuelve el problema de iconos inconsistentes y mantenimiento.

**THM-007. Tipografía Escalable**  
Permite a la UI Admin usar tipografía escalable según tema y dispositivo. Existe para legibilidad y accesibilidad. Resuelve el problema de texto ilegible en diferentes dispositivos.

**THM-008. Animaciones y Transiciones**  
Permite a la UI Admin usar animaciones y transiciones consistentes. Existe para feedback visual y experiencia fluida. Resuelve el problema de transiciones abruptas y falta de feedback.

#### 3.3.8. Seguridad y Permisos (Producto/UX)

**SEC-008. Rate Limiting Visual**  
Permite a la UI Admin mostrar advertencias cuando se acerca a límites de rate. Existe para prevención de abuso y feedback. Resuelve el problema de bloqueos inesperados por rate limiting.

#### 3.3.9. Mobile y Multi-dispositivo

**MOB-001. Adaptación Responsive Automática**  
Permite a la UI Admin adaptarse automáticamente a diferentes tamaños de pantalla. Existe para funcionalidad en todos los dispositivos. Resuelve el problema de usabilidad en móviles y tablets.

**MOB-002. Optimización de Carga para Móvil**  
Permite a la UI Admin optimizar carga de recursos según dispositivo. Existe para rendimiento en conexiones lentas. Resuelve el problema de tiempos de carga largos en móvil.

**MOB-003. Interacciones Táctiles**  
Permite a la UI Admin optimizar interacciones para dispositivos táctiles. Existe para usabilidad en móviles. Resuelve el problema de interacciones difíciles en pantallas táctiles.

**MOB-004. Gestos y Navegación por Swipe**  
Permite a la UI Admin soportar gestos comunes (swipe, pinch, etc.). Existe para experiencia nativa en móviles. Resuelve el problema de navegación incómoda en móviles.

**MOB-005. Viewport y Zoom Controlado**  
Permite a la UI Admin controlar viewport y prevenir zoom no deseado. Existe para consistencia visual. Resuelve el problema de layouts rotos por zoom.

**MOB-006. Offline Básico**  
Permite a la UI Admin funcionar parcialmente sin conexión (caché, queue de acciones). Existe para resiliencia y productividad. Resuelve el problema de interrupciones por pérdida de conexión.

**MOB-007. Sincronización al Reconectar**  
Permite a la UI Admin sincronizar cambios pendientes al recuperar conexión. Existe para no perder trabajo. Resuelve el problema de pérdida de datos por desconexión.

#### 3.3.10. Auditoría y Versionado (Producto/UX)

**AUD-004. Comparación de Versiones**  
Permite a la UI Admin comparar diferentes versiones de entidades. Existe para análisis de cambios. Resuelve el problema de comprensión de diferencias entre versiones.

**AUD-005. Restauración de Versiones**  
Permite a la UI Admin restaurar versiones anteriores de entidades. Existe para recuperación de errores. Resuelve el problema de corrección de cambios incorrectos.

**AUD-006. Etiquetado y Anotaciones**  
Permite a la UI Admin etiquetar y anotar cambios con metadata (razón, ticket, etc.). Existe para contexto y trazabilidad. Resuelve el problema de comprensión de motivos de cambios.

**AUD-007. Exportación de Auditoría**  
Permite a la UI Admin exportar registros de auditoría para análisis externo. Existe para cumplimiento y análisis. Resuelve el problema de análisis de auditoría fuera del sistema.

#### 3.3.11. Diagnóstico y Recuperación (Producto/UX)

**DIA-004. Visualización de Stack Traces**  
Permite a la UI Admin mostrar stack traces de errores (si está habilitado). Existe para debugging técnico. Resuelve el problema de diagnóstico de errores de código.

**DIA-005. Alertas y Notificaciones**  
Permite a la UI Admin mostrar alertas y notificaciones de eventos importantes. Existe para visibilidad de problemas y cambios. Resuelve el problema de falta de awareness de eventos críticos.

**DIA-006. Recuperación Automática**  
Permite a la UI Admin intentar recuperación automática de errores recuperables. Existe para resiliencia y mejor UX. Resuelve el problema de fallos innecesarios por errores temporales.

**DIA-007. Modo de Diagnóstico**  
Permite a la UI Admin activar modo de diagnóstico con información adicional. Existe para debugging y troubleshooting. Resuelve el problema de falta de información para diagnóstico.

**DIA-008. Exportación de Logs**  
Permite a la UI Admin exportar logs relevantes para análisis externo. Existe para debugging y cumplimiento. Resuelve el problema de análisis de logs fuera del sistema.

#### 3.3.12. Preparación para Editor de Pantallas (Producto/UX)

**EDI-007. Preview en Tiempo Real**  
Permite a la UI Admin renderizarse en modo preview para el editor visual. Existe para que el editor pueda mostrar resultado mientras se edita. Resuelve el problema de feedback visual durante edición.

**EDI-008. Hot Reload de Cambios**  
Permite a la UI Admin recargar cambios sin perder estado. Existe para iteración rápida en el editor. Resuelve el problema de productividad en creación visual.

#### 3.3.13. Capacidades Adicionales

**PRD-001. Búsqueda Global**  
Permite a la UI Admin tener búsqueda global que atraviesa múltiples entidades. Existe para eficiencia en sistemas grandes. Resuelve el problema de encontrar información rápidamente.

**PRD-002. Filtros Avanzados**  
Permite a la UI Admin aplicar filtros complejos sobre datos (rangos, múltiples criterios, combinaciones). Existe para análisis y exploración de datos. Resuelve el problema de encontrar datos específicos en grandes volúmenes.

**PRD-003. Ordenamiento y Agrupación**  
Permite a la UI Admin ordenar y agrupar datos por múltiples criterios. Existe para organización y análisis. Resuelve el problema de visualización de datos de forma útil.

**PRD-004. Exportación de Datos**  
Permite a la UI Admin exportar datos en múltiples formatos (CSV, JSON, Excel). Existe para análisis externo y reportes. Resuelve el problema de uso de datos fuera del sistema.

**PRD-005. Importación de Datos**  
Permite a la UI Admin importar datos desde archivos (CSV, JSON, Excel) con validación. Existe para carga masiva y migración. Resuelve el problema de entrada de datos en volumen.

**PRD-006. Notificaciones en Tiempo Real**  
Permite a la UI Admin recibir notificaciones de eventos en tiempo real (WebSockets, Server-Sent Events). Existe para actualización automática sin refresh. Resuelve el problema de datos desactualizados y falta de awareness.

**PRD-007. Colaboración en Tiempo Real**  
Permite a la UI Admin mostrar actividad de otros usuarios en tiempo real. Existe para coordinación y prevención de conflictos. Resuelve el problema de ediciones simultáneas y conflictos.

**PRD-008. Comentarios y Anotaciones**  
Permite a la UI Admin añadir comentarios y anotaciones a entidades. Existe para comunicación y documentación. Resuelve el problema de contexto y colaboración.

**PRD-009. Favoritos y Marcadores**  
Permite a la UI Admin marcar elementos como favoritos para acceso rápido. Existe para productividad y personalización. Resuelve el problema de acceso rápido a elementos frecuentes.

**PRD-010. Historial de Navegación**  
Permite a la UI Admin mantener historial de navegación para retroceso. Existe para UX familiar y productividad. Resuelve el problema de pérdida de contexto al navegar.

**PRD-011. Atajos de Teclado**  
Permite a la UI Admin soportar atajos de teclado para acciones comunes. Existe para productividad de usuarios avanzados. Resuelve el problema de eficiencia en operaciones repetitivas.

**PRD-012. Personalización de UI**  
Permite a la UI Admin permitir que usuarios personalicen layout y preferencias. Existe para adaptación a preferencias individuales. Resuelve el problema de productividad personal.

**PRD-013. Modo de Accesibilidad**  
Permite a la UI Admin activar modo de accesibilidad (alto contraste, texto grande, navegación por teclado). Existe para inclusión y cumplimiento. Resuelve el problema de accesibilidad para usuarios con necesidades especiales.

**PRD-014. Internacionalización**  
Permite a la UI Admin soportar múltiples idiomas y localizaciones. Existe para usuarios globales. Resuelve el problema de barrera de idioma.

**PRD-015. Help y Documentación Contextual**  
Permite a la UI Admin mostrar ayuda y documentación contextual según ubicación. Existe para onboarding y descubribilidad. Resuelve el problema de falta de conocimiento sobre funcionalidades.

### 3.4. Conclusión de Capacidades

Esta lista enumera **todas las capacidades posibles** que una UI Admin puede tener en AuriPortal, organizadas en dos categorías:

- **Capacidades Constitucionales (3.2):** Necesarias para que una UI sea canónica. Sin ellas, una "pantalla admin" no es una UI Admin según la ontología definida en la Sección 1. Total: **47 capacidades** con IDs estables.

- **Capacidades Producto/UX (3.3):** Mejoras de experiencia que hacen la vida mejor, pero no definen ontología. Una UI Admin canónica puede existir sin ellas. Total: **64 capacidades** con IDs estables.

**Total de capacidades:** **111 capacidades** identificadas con IDs estables (formato `PREFIJO-NNN`).

**Principio fundamental:** Una capacidad es una funcionalidad que la UI Admin puede **declarar** (indicar que la necesita), **consumir** (usar cuando está disponible), o **ejercer** (activar cuando corresponde). El sistema canónico debe soportar todas estas capacidades de forma que puedan ser verificadas, observadas y gobernadas.

**Uso de IDs estables:** Los IDs (ej: `CTX-001`, `OBS-003`, `ACT-007`) permiten:
- Referenciar capacidades desde el editor visual
- Indexar capacidades en el registry futuro
- Referenciar desde el "Contrato de Contratos"
- Mantener trazabilidad y versionado de capacidades

**Nota para implementación futura:** Esta lista será la base para:
- Clasificación en CORE/READY/FUTURE
- Definición de dependencias entre capacidades
- Especificación de contratos de implementación
- Validación de cumplimiento de capacidades declaradas

---

**Fin de la Sección 3: Capacidades del Sistema de UI Admin**

---

## 4. Clasificación de Capacidades (CORE / READY / FUTURE / PRODUCT)

### 4.1. Reglas Estructurales de Clasificación

Antes de clasificar, se establecen las siguientes reglas estructurales:

- **[CORE]:** Imprescindible para que una UI Admin sea canónica. Sin estas capacidades, una "pantalla admin" no cumple la ontología definida en la Sección 1. Deben implementarse en v1.

- **[READY]:** No imprescindible hoy, pero el sistema debe estar preparado por contrato (hooks/metadata/slots) para activarlo sin refactor futuro. El contrato debe existir aunque la implementación completa pueda esperar.

- **[FUTURE]:** Declarado, no exigido y no preparado aún. Son capacidades reconocidas pero que pueden implementarse más adelante sin romper contratos existentes.

- **[PRODUCT]:** Capacidades de calidad de vida (buscador, favoritos, colaboración, i18n, help, etc.) que no definen ontología ni ensamblaje canónico. Son opcionales y mejoran la experiencia de usuario.

**Nota sobre dependencias:** Solo para capacidades [CORE] y [READY] se especifican dependencias mínimas (máximo 1-3 dependencias obvias). Las dependencias indican qué otras capacidades o sistemas deben estar disponibles para que esta capacidad funcione.

### 4.2. Clasificación por Dominio

#### 4.2.1. Contextos y Estado

**CTX-001. Acceso a Contexto de Usuario** [CORE]  
Dependencias mínimas: Sistema de autenticación, Context System

**CTX-002. Acceso a Modo del Sistema** [CORE]  
Dependencias mínimas: System Mode Manager, Context System

**CTX-003. Acceso a Feature Flags** [CORE]  
Dependencias mínimas: Feature Flags Registry (SOT), Context System

**CTX-004. Acceso a Variables de Entorno** [CORE]  
Dependencias mínimas: Environment Config, Context System

**CTX-005. Gestión de Estado Local** [PRODUCT]  
Sin dependencias mínimas (es opcional)

**CTX-006. Sincronización de Estado con Servidor** [PRODUCT]  
Sin dependencias mínimas (es opcional)

#### 4.2.2. Observabilidad y Señales

**OBS-001. Emisión de Señales Registradas** [CORE]  
Dependencias mínimas: Signal Registry, OBS-002 (Trace ID)

**OBS-002. Propagación de Trace ID** [CORE]  
Dependencias mínimas: Context System, Request Context

**OBS-003. Logging Estructurado** [CORE]  
Dependencias mínimas: Logging System, OBS-002 (Trace ID)

**OBS-004. Correlación de Eventos por Trace ID** [READY]  
Dependencias mínimas: OBS-002 (Trace ID), Event Store, Query System

**OBS-005. Visualización de Métricas en Tiempo Real** [PRODUCT]  
Sin dependencias mínimas (es opcional)

**OBS-006. Visualización de Estado de Señales** [PRODUCT]  
Sin dependencias mínimas (es opcional)

**OBS-007. Visualización de Health Checks** [PRODUCT]  
Sin dependencias mínimas (es opcional)

#### 4.2.3. Acciones y Mutaciones

**ACT-001. Lectura de Source of Truth** [CORE]  
Dependencias mínimas: Servicios Canónicos, PostgreSQL SOT, CTX-001 (Contexto Usuario)

**ACT-002. Escritura en Source of Truth** [CORE]  
Dependencias mínimas: Servicios Canónicos, PostgreSQL SOT, SEC-002 (Permisos), AUD-001 (Auditoría)

**ACT-003. Validación de Mutaciones** [CORE]  
Dependencias mínimas: Validation Contracts, ACT-002 (Escritura SOT)

**ACT-004. Confirmación de Acciones Destructivas** [CORE]  
Dependencias mínimas: ACT-002 (Escritura SOT), UI Components

**ACT-005. Operaciones en Lote** [PRODUCT]  
Sin dependencias mínimas (es opcional)

**ACT-006. Operaciones Asíncronas con Feedback** [PRODUCT]  
Sin dependencias mínimas (es opcional)

**ACT-007. Rollback de Mutaciones** [PRODUCT]  
Sin dependencias mínimas (es opcional)

**ACT-008. Preview de Cambios** [PRODUCT]  
Sin dependencias mínimas (es opcional)

**ACT-009. Drafts y Guardado Temporal** [PRODUCT]  
Sin dependencias mínimas (es opcional)

#### 4.2.4. Automatizaciones

**AUT-001. Visualización de Automatizaciones** [CORE]  
Dependencias mínimas: Automation Registry, ACT-001 (Lectura SOT)

**AUT-002. Creación de Automatizaciones** [READY]  
Dependencias mínimas: Automation Engine, Validation Contracts, EDI-003 (Contratos de Datos)

**AUT-003. Modificación de Automatizaciones** [READY]  
Dependencias mínimas: Automation Engine, AUT-001 (Visualización), Versioning System

**AUT-004. Activación/Desactivación de Automatizaciones** [CORE]  
Dependencias mínimas: Automation Engine, AUT-001 (Visualización)

**AUT-005. Archivo de Automatizaciones** [READY]  
Dependencias mínimas: AUT-001 (Visualización), Versioning System, Deprecation System

**AUT-006. Visualización de Historial de Ejecuciones** [PRODUCT]  
Sin dependencias mínimas (es opcional)

**AUT-007. Ejecución Manual de Automatizaciones** [PRODUCT]  
Sin dependencias mínimas (es opcional)

**AUT-008. Visualización de Dependencias entre Automatizaciones** [PRODUCT]  
Sin dependencias mínimas (es opcional)

#### 4.2.5. Navegación y Sidebar

**NAV-001. Generación Automática de Sidebar** [CORE]  
Dependencias mínimas: Router Registry, Sidebar Registry, LAY-001 (Template Base)

**NAV-002. Resaltado de Ruta Activa** [CORE]  
Dependencias mínimas: NAV-001 (Sidebar), Router Context

**NAV-003. Navegación Jerárquica** [CORE]  
Dependencias mínimas: NAV-001 (Sidebar), Navigation Registry

**NAV-004. Filtrado de Navegación por Permisos** [CORE]  
Dependencias mínimas: NAV-001 (Sidebar), SEC-002 (Permisos), CTX-001 (Contexto Usuario)

**NAV-005. Filtrado de Navegación por Feature Flags** [CORE]  
Dependencias mínimas: NAV-001 (Sidebar), CTX-003 (Feature Flags)

**NAV-006. Persistencia de Estado de Navegación** [PRODUCT]  
Sin dependencias mínimas (es opcional)

**NAV-007. Breadcrumbs** [PRODUCT]  
Sin dependencias mínimas (es opcional)

**NAV-008. Búsqueda en Navegación** [PRODUCT]  
Sin dependencias mínimas (es opcional)

#### 4.2.6. Layout y Render

**LAY-001. Renderizado con Template Base** [CORE]  
Dependencias mínimas: Template System, Admin Page Renderer, Router Resolver

**LAY-002. Inyección de Contenido en Placeholders** [CORE]  
Dependencias mínimas: LAY-001 (Template Base), Placeholder System

**LAY-003. Inyección de Scripts Adicionales** [CORE]  
Dependencias mínimas: LAY-001 (Template Base), Script Loader

**LAY-004. Inyección de Estilos Adicionales** [CORE]  
Dependencias mínimas: LAY-001 (Template Base), Style Loader

**LAY-005. Layouts Responsive** [PRODUCT]  
Sin dependencias mínimas (es opcional)

**LAY-006. Grids y Sistemas de Layout** [PRODUCT]  
Sin dependencias mínimas (es opcional)

**LAY-007. Componentes Reutilizables** [PRODUCT]  
Sin dependencias mínimas (es opcional)

**LAY-008. Lazy Loading de Contenido** [PRODUCT]  
Sin dependencias mínimas (es opcional)

**LAY-009. Paginación y Virtualización** [PRODUCT]  
Sin dependencias mínimas (es opcional)

**LAY-010. Skeleton Screens y Loading States** [PRODUCT]  
Sin dependencias mínimas (es opcional)

#### 4.2.7. Themes y Apariencia

**THM-001. Declaración de Capabilities Semánticas** [CORE]  
Dependencias mínimas: Capability Registry, Theme System

**THM-002. Resolución de Themes** [CORE]  
Dependencias mínimas: Theme Registry, Theme Resolver, THM-001 (Capabilities Semánticas)

**THM-003. Aplicación de Tokens Visuales** [CORE]  
Dependencias mínimas: THM-002 (Resolución Themes), Token System, CSS Variables

**THM-004. Modos de Tema (Dark/Light)** [PRODUCT]  
Sin dependencias mínimas (es opcional)

**THM-005. Personalización de Tema por Usuario** [PRODUCT]  
Sin dependencias mínimas (es opcional)

**THM-006. Iconografía Consistente** [PRODUCT]  
Sin dependencias mínimas (es opcional)

**THM-007. Tipografía Escalable** [PRODUCT]  
Sin dependencias mínimas (es opcional)

**THM-008. Animaciones y Transiciones** [PRODUCT]  
Sin dependencias mínimas (es opcional)

#### 4.2.8. Seguridad y Permisos

**SEC-001. Validación de Autenticación** [CORE]  
Dependencias mínimas: Authentication System, Context System

**SEC-002. Validación de Permisos por Acción** [CORE]  
Dependencias mínimas: Permission System, CTX-001 (Contexto Usuario), SEC-001 (Autenticación)

**SEC-003. Ocultación de Elementos según Permisos** [CORE]  
Dependencias mínimas: SEC-002 (Permisos), UI Component System

**SEC-004. Validación de Permisos en Cliente y Servidor** [CORE]  
Dependencias mínimas: SEC-002 (Permisos), Client-Server Permission Sync

**SEC-005. Gestión de Sesiones** [CORE]  
Dependencias mínimas: Session Manager, SEC-001 (Autenticación)

**SEC-006. Protección CSRF** [CORE]  
Dependencias mínimas: CSRF Token System, Request Validation

**SEC-007. Auditoría de Accesos** [CORE]  
Dependencias mínimas: Audit System, SEC-001 (Autenticación), OBS-002 (Trace ID)

**SEC-008. Rate Limiting Visual** [PRODUCT]  
Sin dependencias mínimas (es opcional)

#### 4.2.9. Mobile y Multi-dispositivo

**MOB-001. Adaptación Responsive Automática** [PRODUCT]  
Sin dependencias mínimas (es opcional)

**MOB-002. Optimización de Carga para Móvil** [PRODUCT]  
Sin dependencias mínimas (es opcional)

**MOB-003. Interacciones Táctiles** [PRODUCT]  
Sin dependencias mínimas (es opcional)

**MOB-004. Gestos y Navegación por Swipe** [PRODUCT]  
Sin dependencias mínimas (es opcional)

**MOB-005. Viewport y Zoom Controlado** [PRODUCT]  
Sin dependencias mínimas (es opcional)

**MOB-006. Offline Básico** [PRODUCT]  
Sin dependencias mínimas (es opcional)

**MOB-007. Sincronización al Reconectar** [PRODUCT]  
Sin dependencias mínimas (es opcional)

#### 4.2.10. Auditoría y Versionado

**AUD-001. Registro Automático de Mutaciones** [CORE]  
Dependencias mínimas: Audit System, OBS-002 (Trace ID), CTX-001 (Contexto Usuario)

**AUD-002. Historial de Cambios** [READY]  
Dependencias mínimas: AUD-001 (Registro Mutaciones), Event Store, Query System

**AUD-003. Versionado de Entidades** [READY]  
Dependencias mínimas: Versioning System, AUD-001 (Registro Mutaciones), Entity Schema

**AUD-004. Comparación de Versiones** [PRODUCT]  
Sin dependencias mínimas (es opcional)

**AUD-005. Restauración de Versiones** [PRODUCT]  
Sin dependencias mínimas (es opcional)

**AUD-006. Etiquetado y Anotaciones** [PRODUCT]  
Sin dependencias mínimas (es opcional)

**AUD-007. Exportación de Auditoría** [PRODUCT]  
Sin dependencias mínimas (es opcional)

#### 4.2.11. Diagnóstico y Recuperación

**DIA-001. Visualización de Errores Canónicos** [CORE]  
Dependencias mínimas: Error Contract v1, OBS-002 (Trace ID), Error Renderer

**DIA-002. Búsqueda de Errores por Trace ID** [CORE]  
Dependencias mínimas: OBS-004 (Correlación), Error Store, Query System

**DIA-003. Health Dashboard** [READY]  
Dependencias mínimas: Health Check System, Metrics System, Dashboard Components

**DIA-004. Visualización de Stack Traces** [PRODUCT]  
Sin dependencias mínimas (es opcional)

**DIA-005. Alertas y Notificaciones** [PRODUCT]  
Sin dependencias mínimas (es opcional)

**DIA-006. Recuperación Automática** [PRODUCT]  
Sin dependencias mínimas (es opcional)

**DIA-007. Modo de Diagnóstico** [PRODUCT]  
Sin dependencias mínimas (es opcional)

**DIA-008. Exportación de Logs** [PRODUCT]  
Sin dependencias mínimas (es opcional)

#### 4.2.12. Preparación para Editor de Pantallas

**EDI-001. Declaración de Estructura de UI** [FUTURE]  
Sin dependencias mínimas (futuro)

**EDI-002. Metadata de Componentes** [FUTURE]  
Sin dependencias mínimas (futuro)

**EDI-003. Contratos de Datos** [READY]  
Dependencias mínimas: Schema System, Validation Contracts, Data Contract Registry

**EDI-004. Contratos de Acciones** [READY]  
Dependencias mínimas: Action Registry, EDI-003 (Contratos de Datos), Signal Registry

**EDI-005. Validación de Contrato** [READY]  
Dependencias mínimas: Contract Validator, EDI-001 (Estructura UI), Assembly Check System

**EDI-006. Serialización y Deserialización** [FUTURE]  
Sin dependencias mínimas (futuro)

**EDI-007. Preview en Tiempo Real** [FUTURE]  
Sin dependencias mínimas (futuro)

**EDI-008. Hot Reload de Cambios** [FUTURE]  
Sin dependencias mínimas (futuro)

#### 4.2.13. Capacidades Adicionales (Producto/UX)

**PRD-001. Búsqueda Global** [PRODUCT]  
Sin dependencias mínimas (es opcional)

**PRD-002. Filtros Avanzados** [PRODUCT]  
Sin dependencias mínimas (es opcional)

**PRD-003. Ordenamiento y Agrupación** [PRODUCT]  
Sin dependencias mínimas (es opcional)

**PRD-004. Exportación de Datos** [PRODUCT]  
Sin dependencias mínimas (es opcional)

**PRD-005. Importación de Datos** [PRODUCT]  
Sin dependencias mínimas (es opcional)

**PRD-006. Notificaciones en Tiempo Real** [PRODUCT]  
Sin dependencias mínimas (es opcional)

**PRD-007. Colaboración en Tiempo Real** [PRODUCT]  
Sin dependencias mínimas (es opcional)

**PRD-008. Comentarios y Anotaciones** [PRODUCT]  
Sin dependencias mínimas (es opcional)

**PRD-009. Favoritos y Marcadores** [PRODUCT]  
Sin dependencias mínimas (es opcional)

**PRD-010. Historial de Navegación** [PRODUCT]  
Sin dependencias mínimas (es opcional)

**PRD-011. Atajos de Teclado** [PRODUCT]  
Sin dependencias mínimas (es opcional)

**PRD-012. Personalización de UI** [PRODUCT]  
Sin dependencias mínimas (es opcional)

**PRD-013. Modo de Accesibilidad** [PRODUCT]  
Sin dependencias mínimas (es opcional)

**PRD-014. Internacionalización** [PRODUCT]  
Sin dependencias mínimas (es opcional)

**PRD-015. Help y Documentación Contextual** [PRODUCT]  
Sin dependencias mínimas (es opcional)

### 4.3. Resumen de Clasificación

#### 4.3.1. Capacidades [CORE] - Imprescindibles para v1

**Total: 35 capacidades CORE**

Estas capacidades deben implementarse en v1 para que una UI Admin sea canónica:

- **Contextos (4):** CTX-001, CTX-002, CTX-003, CTX-004
- **Observabilidad (3):** OBS-001, OBS-002, OBS-003
- **Acciones (4):** ACT-001, ACT-002, ACT-003, ACT-004
- **Automatizaciones (2):** AUT-001, AUT-004
- **Navegación (5):** NAV-001, NAV-002, NAV-003, NAV-004, NAV-005
- **Layout (4):** LAY-001, LAY-002, LAY-003, LAY-004
- **Themes (3):** THM-001, THM-002, THM-003
- **Seguridad (7):** SEC-001, SEC-002, SEC-003, SEC-004, SEC-005, SEC-006, SEC-007
- **Auditoría (1):** AUD-001
- **Diagnóstico (2):** DIA-001, DIA-002

#### 4.3.2. Capacidades [READY] - Preparadas por contrato

**Total: 8 capacidades READY**

El sistema debe estar preparado (hooks/metadata/slots) para estas capacidades:

- **Observabilidad (1):** OBS-004
- **Automatizaciones (3):** AUT-002, AUT-003, AUT-005
- **Auditoría (2):** AUD-002, AUD-003
- **Diagnóstico (1):** DIA-003
- **Editor (3):** EDI-003, EDI-004, EDI-005

#### 4.3.3. Capacidades [FUTURE] - Declaradas, no preparadas

**Total: 5 capacidades FUTURE**

Reconocidas pero pueden implementarse más adelante:

- **Editor (5):** EDI-001, EDI-002, EDI-006, EDI-007, EDI-008

#### 4.3.4. Capacidades [PRODUCT] - Calidad de vida

**Total: 64 capacidades PRODUCT**

Mejoras de experiencia opcionales:

- **Contextos (2):** CTX-005, CTX-006
- **Observabilidad (3):** OBS-005, OBS-006, OBS-007
- **Acciones (5):** ACT-005, ACT-006, ACT-007, ACT-008, ACT-009
- **Automatizaciones (3):** AUT-006, AUT-007, AUT-008
- **Navegación (3):** NAV-006, NAV-007, NAV-008
- **Layout (6):** LAY-005, LAY-006, LAY-007, LAY-008, LAY-009, LAY-010
- **Themes (5):** THM-004, THM-005, THM-006, THM-007, THM-008
- **Seguridad (1):** SEC-008
- **Mobile (7):** MOB-001 a MOB-007
- **Auditoría (4):** AUD-004, AUD-005, AUD-006, AUD-007
- **Diagnóstico (5):** DIA-004, DIA-005, DIA-006, DIA-007, DIA-008
- **Adicionales (15):** PRD-001 a PRD-015

### 4.4. Conclusión de Clasificación

**Total de capacidades clasificadas: 111**

- **[CORE]: 35 capacidades** - Deben implementarse en v1
- **[READY]: 8 capacidades** - Sistema preparado por contrato
- **[FUTURE]: 5 capacidades** - Declaradas, no preparadas aún
- **[PRODUCT]: 63 capacidades** - Opcionales, calidad de vida

**Principio de implementación:**

1. **v1 debe incluir todas las capacidades [CORE]** para que una UI Admin sea canónica según la ontología.

2. **El sistema debe estar preparado (hooks/metadata/slots) para capacidades [READY]** aunque la implementación completa pueda esperar.

3. **Las capacidades [FUTURE] pueden implementarse más adelante** sin romper contratos existentes.

4. **Las capacidades [PRODUCT] son opcionales** y pueden añadirse según necesidades de producto y recursos disponibles.

**Dependencias:** Las dependencias mínimas especificadas para [CORE] y [READY] indican qué sistemas o capacidades deben estar disponibles. Esto guía el orden de implementación y la arquitectura del sistema canónico.

---

**Fin de la Sección 4: Clasificación de Capacidades**

---

## 5. Invariantes Constitucionales del Sistema UI Admin

### 5.1. Introducción

Un **invariante constitucional** es una regla que **NO puede romperse** bajo ninguna circunstancia, independientemente de implementación, editor, UI concreta o feature. Si un invariante se viola, el sistema se considera **arquitectónicamente roto**.

**Principio:** Los invariantes protegen la ontología y la integridad del sistema. No son sugerencias ni buenas prácticas: son **leyes constitucionales** que deben cumplirse siempre.

**Alcance:** Estos invariantes cubren únicamente capacidades [CORE] y [READY]. Las capacidades [PRODUCT] y [FUTURE] no tienen invariantes constitucionales porque no definen la ontología del sistema.

### 5.2. Invariantes de Enrutado

#### INV-001. Registry como Source of Truth Único de Rutas

**Enunciado:** Toda ruta `/admin/*` debe estar registrada en el Router Registry antes de ser accesible. No existe "ruta implícita" o "ruta por inferencia" para nuevas rutas.

**Qué protege:** La integridad del sistema de enrutado y la capacidad de verificar todas las rutas existentes.

**Qué errores previene:** Rutas huérfanas, rutas duplicadas, rutas no documentadas, errores silenciosos de routing.

**Qué ocurre si se viola:** El sistema no puede garantizar que todas las rutas están documentadas y validadas. Una ruta puede funcionar sin estar registrada, violando la capacidad de auditoría y gobierno del sistema.

#### INV-002. Separación Absoluta API / UI

**Enunciado:** Una ruta `/admin/api/*` **NUNCA** puede resolverse como `type='island'` (UI Admin). Una ruta que no empiece con `/admin/api/` **NUNCA** puede ser `type='api'`.

**Qué protege:** La separación arquitectónica entre APIs (JSON) y UIs Admin (HTML), y la capacidad de diferenciar contratos.

**Qué errores previene:** APIs que renderizan HTML, UIs Admin que devuelven JSON incorrectamente, confusión de contratos, violación de separación de responsabilidades.

**Qué ocurre si se viola:** El sistema no puede garantizar qué tipo de respuesta esperar de una ruta. Los consumidores (humanos o código) no pueden confiar en el contrato de respuesta.

#### INV-003. Resolución Única de Rutas

**Enunciado:** Para cualquier path `/admin/*`, el Router Resolver debe encontrar **exactamente una** ruta registrada, o devolver 404 canónico. No puede haber ambigüedad ni múltiples coincidencias válidas.

**Qué protege:** La determinística del routing y la capacidad de predecir qué handler se ejecutará.

**Qué errores previene:** Rutas que resuelven a handlers incorrectos, ambigüedad en matching, comportamiento no determinístico.

**Qué ocurre si se viola:** El sistema no puede garantizar qué handler se ejecutará para una ruta. El comportamiento se vuelve impredecible y no auditable.

#### INV-004. Contexto Obligatorio para renderAdminPage

**Enunciado:** `renderAdminPage()` **SOLO** puede llamarse desde un handler que fue resuelto por el Router Resolver y que tiene `type='island'`. No puede llamarse directamente desde código arbitrario.

**Qué protege:** La integridad del pipeline de renderizado y la capacidad de garantizar que todas las UIs Admin pasan por el sistema canónico.

**Qué errores previene:** Renderizado fuera de contexto, bypass del sistema de routing, UIs Admin que no cumplen contratos.

**Qué ocurre si se viola:** El sistema no puede garantizar que todas las UIs Admin cumplen contratos (sidebar, placeholders, scripts). Se pueden crear UIs Admin que violan la arquitectura.

### 5.3. Invariantes de Contexto y Permisos

#### INV-005. Contexto de Usuario Obligatorio

**Enunciado:** Toda UI Admin debe tener acceso al contexto de usuario (rol, permisos, identidad) antes de renderizar. No puede renderizarse sin contexto de usuario válido.

**Qué protege:** La seguridad y la capacidad de personalizar la UI según el usuario.

**Qué errores previene:** UIs Admin sin autenticación, personalización incorrecta, violación de seguridad.

**Qué ocurre si se viola:** El sistema no puede garantizar que solo usuarios autorizados acceden a UIs Admin. La seguridad se compromete.

#### INV-006. Validación de Permisos en Servidor

**Enunciado:** Toda validación de permisos en cliente (UX) debe tener una validación correspondiente en servidor (seguridad). La validación en cliente es solo para UX, nunca para seguridad.

**Qué protege:** La seguridad real del sistema y la prevención de bypass de permisos.

**Qué errores previene:** Bypass de permisos manipulando cliente, falsos positivos de permisos, violación de seguridad.

**Qué ocurre si se viola:** Un atacante puede manipular el cliente para acceder a funcionalidades no autorizadas. La seguridad se compromete completamente.

#### INV-007. Modo del Sistema Respeta Escrituras

**Enunciado:** En modo BROKEN, **NINGUNA** UI Admin puede permitir escrituras en Source of Truth. En modo DEGRADED, todas las escrituras deben mostrar advertencias explícitas.

**Qué protege:** La integridad del sistema en estados críticos y la prevención de mutaciones cuando el sistema está roto.

**Qué errores previene:** Mutaciones en sistema roto, corrupción de datos, pérdida de integridad.

**Qué ocurre si se viola:** El sistema puede permitir mutaciones cuando está en estado crítico, causando corrupción de datos o pérdida de integridad del Source of Truth.

### 5.4. Invariantes de Mutaciones y Source of Truth

#### INV-008. Servicios Canónicos como Único Camino de Escritura

**Enunciado:** Toda escritura en Source of Truth **DEBE** pasar por servicios canónicos. Una UI Admin **NUNCA** puede escribir directamente en PostgreSQL o modificar SOT sin servicios canónicos.

**Qué protege:** La integridad del Source of Truth, la validación centralizada, y la auditoría de todas las mutaciones.

**Qué errores previene:** Mutaciones sin validación, mutaciones sin auditoría, bypass de reglas de negocio, corrupción de datos.

**Qué ocurre si se viola:** El sistema no puede garantizar que todas las mutaciones están validadas y auditadas. Se pueden introducir datos inválidos o inconsistentes.

#### INV-009. Auditoría Obligatoria de Mutaciones

**Enunciado:** Toda mutación en Source of Truth **DEBE** quedar auditada automáticamente (quién, cuándo, qué, trace_id). No puede haber mutaciones "silenciosas" o sin auditoría.

**Qué protege:** La trazabilidad completa de cambios y la capacidad de diagnóstico forense.

**Qué errores previene:** Mutaciones sin rastro, imposibilidad de diagnóstico, pérdida de trazabilidad.

**Qué ocurre si se viola:** El sistema no puede rastrear quién hizo qué cambios y cuándo. La auditoría y el cumplimiento se comprometen.

#### INV-010. Validación en Servidor Obligatoria

**Enunciado:** Toda mutación **DEBE** ser validada en servidor según contratos canónicos, independientemente de validación en cliente. La validación en cliente es solo para UX.

**Qué protege:** La integridad de datos y la prevención de datos inválidos en Source of Truth.

**Qué errores previene:** Datos inválidos en SOT, bypass de validaciones, violación de contratos.

**Qué ocurre si se viola:** Se pueden introducir datos inválidos o inconsistentes en Source of Truth, rompiendo invariantes de negocio y corrompiendo el sistema.

### 5.5. Invariantes de Observabilidad

#### INV-011. Trace ID Obligatorio en Operaciones

**Enunciado:** Toda operación que toque Source of Truth, emita señales, o genere errores **DEBE** propagar `trace_id`. No puede haber operaciones sin `trace_id`.

**Qué protege:** La capacidad de correlacionar eventos y diagnosticar flujos completos.

**Qué errores previene:** Eventos no correlacionables, diagnóstico imposible, pérdida de trazabilidad.

**Qué ocurre si se viola:** El sistema no puede correlacionar eventos relacionados. El diagnóstico de problemas complejos se vuelve imposible.

#### INV-012. Señales Solo Registradas

**Enunciado:** El runtime **SOLO** puede emitir señales que están registradas en el Signal Registry. No puede emitir señales ad-hoc o no registradas.

**Qué protege:** La integridad del sistema de señales y la capacidad de gobernar qué señales existen.

**Qué errores previene:** Señales no documentadas, señales duplicadas, automatizaciones que se disparan por señales no gobernadas.

**Qué ocurre si se viola:** El sistema no puede gobernar qué señales existen. Las automatizaciones pueden dispararse por señales no documentadas, rompiendo la capacidad de gobierno.

#### INV-013. Logging Estructurado Obligatorio

**Enunciado:** Toda operación relevante (mutaciones, errores, eventos críticos) **DEBE** registrarse con logging estructurado (nivel, contexto, metadata, trace_id). No puede haber eventos críticos sin logging.

**Qué protege:** La capacidad de diagnóstico y observabilidad del sistema.

**Qué errores previene:** Eventos sin rastro, diagnóstico imposible, pérdida de observabilidad.

**Qué ocurre si se viola:** El sistema no puede diagnosticar problemas. Los eventos críticos se pierden sin rastro, comprometiendo la observabilidad.

### 5.6. Invariantes de Render y Runtime

#### INV-014. Template Base Obligatorio

**Enunciado:** Toda UI Admin **DEBE** usar el template base canónico. No puede renderizar HTML completo manualmente sin pasar por el template base.

**Qué protege:** La consistencia estructural de todas las UIs Admin y la capacidad de garantizar que todas tienen sidebar, scripts, y estructura común.

**Qué errores previene:** UIs Admin sin sidebar, UIs Admin sin scripts canónicos, inconsistencia estructural.

**Qué ocurre si se viola:** Se pueden crear UIs Admin que no cumplen la estructura canónica (sin sidebar, sin scripts, etc.), rompiendo la consistencia y la capacidad de gobierno.

#### INV-015. Placeholders Obligatorios Reemplazados

**Enunciado:** Todos los placeholders del template base (`{{TITLE}}`, `{{CONTENT}}`, `{{SIDEBAR_MENU}}`) **DEBEN** ser reemplazados antes de enviar HTML al cliente. No puede enviarse HTML con placeholders literales.

**Qué protege:** La integridad del HTML renderizado y la capacidad de garantizar que el cliente recibe HTML completo.

**Qué errores previene:** HTML con placeholders visibles, sidebar no renderizado, contenido faltante.

**Qué ocurre si se viola:** El cliente recibe HTML incompleto o con placeholders visibles. La UI Admin no se renderiza correctamente.

#### INV-016. Scripts Globales Únicos

**Enunciado:** Cualquier script global del Admin (ej: `sidebar-client.js`) **DEBE** cargarse exactamente una vez por página. No puede haber scripts duplicados.

**Qué protege:** La integridad del JavaScript y la prevención de errores por redeclaración de variables.

**Qué errores previene:** Scripts duplicados, errores de redeclaración, listeners duplicados, comportamiento errático.

**Qué ocurre si se viola:** El JavaScript puede fallar por redeclaración de variables o listeners duplicados. El comportamiento de la UI se vuelve errático.

### 5.7. Invariantes de Degradación Controlada

#### INV-017. Fail-Closed en Capas Críticas

**Enunciado:** Si una capa crítica (Router, Context, SOT, Seguridad, Runtime) falla, la UI Admin **DEBE** fallar explícitamente con Error Contract v1. No puede degradarse silenciosamente.

**Qué protege:** La capacidad de detectar fallos críticos y prevenir operaciones en estados inválidos.

**Qué errores previene:** Fallos silenciosos, operaciones en estados inválidos, pérdida de integridad.

**Qué ocurre si se viola:** El sistema puede continuar operando en estados inválidos sin que se detecte el problema. La integridad se compromete.

#### INV-018. Fail-Open con Degradación en Capas No Críticas

**Enunciado:** Si una capa no crítica (Observabilidad, Automatizaciones, Sidebar, Themes, Auditoría) falla, la UI Admin **DEBE** continuar funcionando pero degradarse de forma controlada (sin la funcionalidad afectada).

**Qué protege:** La resiliencia del sistema y la capacidad de funcionar parcialmente cuando componentes no críticos fallan.

**Qué errores previene:** Fallos en cascada, pérdida completa de funcionalidad por fallos menores.

**Qué ocurre si se viola:** Un fallo menor puede causar que toda la UI Admin deje de funcionar, reduciendo la resiliencia del sistema.

### 5.8. Invariantes de Sidebar y Navegación

#### INV-019. Sidebar Gobernado, No Hardcodeado

**Enunciado:** El sidebar **DEBE** generarse desde el Sidebar Registry. No puede haber lógica de sidebar hardcodeada por pantalla o por UI Admin.

**Qué protege:** La capacidad de gobernar la navegación centralmente y la consistencia del sidebar.

**Qué errores previene:** Sidebars inconsistentes, navegación no gobernable, duplicación de lógica.

**Qué ocurre si se viola:** El sidebar no puede gobernarse centralmente. Cada UI Admin puede tener su propia lógica de sidebar, rompiendo la consistencia y la capacidad de gobierno.

#### INV-020. Filtrado de Navegación por Permisos Obligatorio

**Enunciado:** El sidebar **DEBE** ocultar elementos de navegación según permisos del usuario. No puede mostrar elementos a los que el usuario no tiene acceso.

**Qué protege:** La seguridad y la simplificación de la UI según permisos.

**Qué errores previene:** Navegación a rutas no autorizadas, confusión de UI, violación de seguridad.

**Qué ocurre si se viola:** El usuario puede ver y acceder a rutas no autorizadas, comprometiendo la seguridad.

### 5.9. Invariantes de Themes y Apariencia

#### INV-021. Capability-First, No Hardcodeo Visual

**Enunciado:** Toda UI Admin **DEBE** declarar capabilities semánticas (ej: "primary-action", "warning-badge"). No puede hardcodear estilos visuales (colores, espaciados) directamente.

**Qué protege:** La capacidad de cambiar temas sin modificar código y la separación entre significado y apariencia.

**Qué errores previene:** Temas no intercambiables, estilos hardcodeados, imposibilidad de cambiar apariencia.

**Qué ocurre si se viola:** Los temas no pueden intercambiarse sin modificar código. La apariencia queda acoplada al código, rompiendo la capacidad de personalización.

#### INV-022. Resolución de Themes Obligatoria

**Enunciado:** Toda UI Admin **DEBE** resolver el tema activo y aplicar tokens visuales desde el Theme Resolver. No puede aplicar estilos directamente sin pasar por el Theme Resolver.

**Qué protege:** La consistencia visual y la capacidad de gobernar temas centralmente.

**Qué errores previene:** Estilos inconsistentes, temas no gobernables, duplicación de estilos.

**Qué ocurre si se viola:** Los estilos no pueden gobernarse centralmente. Cada UI Admin puede tener estilos propios, rompiendo la consistencia visual.

### 5.10. Invariantes de Automatizaciones

#### INV-023. Automatizaciones Solo desde Registry

**Enunciado:** Toda automatización **DEBE** estar registrada en el Automation Registry antes de ejecutarse. No puede ejecutarse una automatización no registrada.

**Qué protege:** La capacidad de gobernar automatizaciones y la prevención de automatizaciones no gobernadas.

**Qué errores previene:** Automatizaciones no documentadas, automatizaciones no gobernables, ejecuciones no autorizadas.

**Qué ocurre si se viola:** El sistema no puede gobernar qué automatizaciones existen. Se pueden ejecutar automatizaciones no documentadas, rompiendo la capacidad de gobierno.

#### INV-024. Automatizaciones No Ejecutables desde UI Admin

**Enunciado:** Una UI Admin **NO PUEDE** ejecutar automatizaciones directamente. Solo puede visualizarlas, crearlas, modificarlas, activarlas/desactivarlas. La ejecución es responsabilidad del Automation Engine.

**Qué protege:** La separación de responsabilidades y la prevención de ejecuciones manuales no gobernadas.

**Qué errores previene:** Ejecuciones manuales no auditadas, bypass del Automation Engine, violación de separación de responsabilidades.

**Qué ocurre si se viola:** Las automatizaciones pueden ejecutarse fuera del Automation Engine, perdiendo auditoría y gobierno. La separación de responsabilidades se rompe.

### 5.11. Invariantes de Diagnóstico

#### INV-025. Error Contract v1 Obligatorio

**Enunciado:** Toda UI Admin **DEBE** mostrar errores usando Error Contract v1 con diagnóstico claro. No puede mostrar errores genéricos o sin diagnóstico.

**Qué protege:** La capacidad de diagnosticar problemas y la consistencia en el manejo de errores.

**Qué errores previene:** Errores crípticos, diagnóstico imposible, inconsistencia en manejo de errores.

**Qué ocurre si se viola:** Los errores no pueden diagnosticarse. El usuario ve errores crípticos sin información útil, comprometiendo la capacidad de resolver problemas.

#### INV-026. Correlación por Trace ID Obligatoria

**Enunciado:** Toda búsqueda de errores o eventos **DEBE** poder correlacionarse por `trace_id`. No puede haber eventos no correlacionables.

**Qué protege:** La capacidad de diagnosticar flujos completos y rastrear operaciones complejas.

**Qué errores previene:** Eventos aislados, diagnóstico fragmentado, imposibilidad de rastrear flujos.

**Qué ocurre si se viola:** Los eventos no pueden correlacionarse. El diagnóstico de problemas complejos se vuelve imposible.

### 5.12. Invariantes de Editor de Pantallas (READY)

#### INV-027. Contratos de Datos Declarativos

**Enunciado:** Toda UI Admin que declare capacidades [READY] relacionadas con Editor **DEBE** declarar contratos de datos (schemas, validaciones) de forma declarativa. No puede tener contratos implícitos.

**Qué protege:** La capacidad del editor visual de validar y sugerir conexiones de datos.

**Qué errores previene:** Contratos implícitos, validación imposible en editor, conexiones incorrectas.

**Qué ocurre si se viola:** El editor visual no puede validar ni sugerir conexiones de datos. Las UIs generadas pueden tener contratos incorrectos.

#### INV-028. Contratos de Acciones Declarativos

**Enunciado:** Toda UI Admin que declare capacidades [READY] relacionadas con Editor **DEBE** declarar acciones disponibles (mutaciones, navegación, señales) de forma declarativa. No puede tener acciones implícitas.

**Qué protege:** La capacidad del editor visual de conectar acciones a eventos.

**Qué errores previene:** Acciones implícitas, conexiones incorrectas, flujos no validables.

**Qué ocurre si se viola:** El editor visual no puede conectar acciones a eventos correctamente. Las UIs generadas pueden tener flujos incorrectos.

### 5.13. Conclusión de Invariantes

**Total de invariantes constitucionales: 28**

Estos 28 invariantes protegen la ontología y la integridad del Sistema de UI Admin. Su violación implica que el sistema está **arquitectónicamente roto**.

**Principio de cumplimiento:**

1. **Ningún invariante puede violarse** bajo ninguna circunstancia, independientemente de implementación, editor, UI concreta o feature.

2. **La violación de un invariante** debe detectarse y prevenirse mediante:
   - Validación en tiempo de desarrollo (Assembly Check)
   - Validación en tiempo de ejecución (Runtime Guards)
   - Verificación en tests (Guardian Tests)

3. **Si un invariante se viola en producción**, el sistema debe:
   - Detectar la violación
   - Registrar el error con Error Contract v1
   - Degradarse o fallar según la capa afectada (fail-closed para críticas, fail-open para no críticas)

4. **Los invariantes son inmutables** salvo evolución constitucional explícita con versionado (major version del contrato).

**Relación con capacidades:** Los invariantes protegen las capacidades [CORE] y [READY]. Las capacidades [PRODUCT] y [FUTURE] no tienen invariantes porque no definen la ontología del sistema.

---

**Fin de la Sección 5: Invariantes Constitucionales del Sistema UI Admin**

---

## 6. Garantías del Sistema para Creación de UI Admin

### 6.1. Introducción

Las **garantías del sistema** son mecanismos que aseguran que **TODA UI Admin futura** (creada a mano, por editor visual o por IA) cumple el contrato canónico. Estas garantías hacen **imposible** crear una UI Admin inválida sin que el sistema la bloquee, degrade o rechace explícitamente.

**Principio fundamental:** El sistema debe **prevenir** violaciones de invariantes, no solo detectarlas después. Las garantías actúan como **guardianes constitucionales** que impiden la creación de UIs Admin que violen la ontología.

**Alcance:** Las garantías cubren únicamente capacidades [CORE] y [READY]. Las capacidades [PRODUCT] y [FUTURE] no tienen garantías porque no definen la ontología del sistema.

### 6.2. Garantías de Router Registry

#### GAR-001. Validación de Registry en Boot

**Qué valida:**
- Todas las rutas registradas cumplen invariantes de estructura (INV-001)
- No hay rutas duplicadas
- No hay rutas `/admin/api/*` con `type='island'` (INV-002)
- Todas las rutas tienen handlers válidos o son inferibles
- El orden de matching no genera ambigüedades (INV-003)

**Cuándo se valida:** En boot del servidor (antes de aceptar requests).

**Qué ocurre si falla:** El servidor **NO arranca** (fail-fast). Se muestra error explícito indicando qué rutas violan qué invariantes.

**Qué errores previene:** Rutas inválidas en producción, ambigüedades de routing, violación de separación API/UI, rutas sin handlers.

**Invariantes protegidos:** INV-001, INV-002, INV-003

#### GAR-002. Validación de Resolución de Rutas en Runtime

**Qué valida:**
- Toda request a `/admin/*` pasa por el Router Resolver
- El resolver encuentra exactamente una ruta o devuelve 404 canónico (INV-003)
- Las rutas `/admin/api/*` resuelven como `type='api'` (INV-002)
- Las rutas `island` tienen contexto válido para `renderAdminPage()` (INV-004)

**Cuándo se valida:** En cada request a `/admin/*` (runtime).

**Qué ocurre si falla:** 
- Si no se encuentra ruta: 404 canónico con Error Contract v1
- Si hay ambigüedad: 500 con Error Contract v1 indicando ambigüedad
- Si ruta API resuelve como island: 500 con Error Contract v1 (INV-002 violado)
- Si `renderAdminPage()` se llama sin contexto: 500 con Error Contract v1 (INV-004 violado)

**Qué errores previene:** Rutas que resuelven incorrectamente, ambigüedades en runtime, violación de separación API/UI, renderizado fuera de contexto.

**Invariantes protegidos:** INV-002, INV-003, INV-004

### 6.3. Garantías de Assembly Check

#### GAR-003. Assembly Check en Modo Normal

**Qué valida:**
- Todas las rutas `/admin/api/*` tienen `type='api'` (INV-002)
- Todas las rutas `island` usan `renderAdminPage()` (INV-004)
- Los placeholders del template se reemplazan correctamente (INV-015)
- Los scripts globales no se duplican (INV-016)
- Las capabilities declaradas existen en el registry

**Cuándo se valida:** 
- En desarrollo: antes de commit (pre-commit hook opcional)
- En CI/CD: en cada build
- Manualmente: ejecutable on-demand

**Qué ocurre si falla:** 
- **Warnings** registrados en logs estructurados
- **NO bloquea** el build ni el despliegue
- Reporte detallado de violaciones encontradas
- Sugerencias de corrección

**Qué errores previene:** Violaciones estructurales que no rompen el sistema pero violan contratos, scripts duplicados, placeholders no reemplazados.

**Invariantes protegidos:** INV-002, INV-004, INV-015, INV-016

#### GAR-004. Assembly Check en Modo Estricto

**Qué valida:**
- Todo lo que valida el modo normal (GAR-003)
- Además: todas las rutas `island` tienen sidebar generado (INV-019)
- Todas las UIs Admin usan template base (INV-014)
- Todas las capabilities declaradas están implementadas
- Todas las dependencias entre capacidades se cumplen

**Cuándo se valida:**
- En CI/CD: en builds de producción (obligatorio)
- En despliegue: antes de activar nueva versión (obligatorio)
- Manualmente: ejecutable on-demand con flag `--strict`

**Qué ocurre si falla:**
- **BLOQUEA** el build o despliegue
- Error explícito con lista de violaciones
- El sistema **NO puede desplegarse** hasta corregir violaciones
- Reporte detallado con referencias a invariantes violados

**Qué errores previene:** UIs Admin inválidas en producción, violaciones de contratos canónicos, sistemas arquitectónicamente rotos.

**Invariantes protegidos:** INV-014, INV-015, INV-016, INV-019

### 6.4. Garantías de Runtime UI

#### GAR-005. Guard de renderAdminPage

**Qué valida:**
- `renderAdminPage()` solo se llama desde contexto de Router Resolver (INV-004)
- El contexto contiene información válida (routeKey, routePath, type)
- El handler que llama tiene `type='island'` (INV-004)

**Cuándo se valida:** En cada llamada a `renderAdminPage()` (runtime).

**Qué ocurre si falla:**
- **BLOQUEA** la ejecución de `renderAdminPage()`
- Devuelve 500 con Error Contract v1 indicando "renderAdminPage() fuera de contexto"
- Registra el error con trace_id para diagnóstico
- **NO renderiza** HTML (previene HTML inválido)

**Qué errores previene:** Renderizado fuera de contexto, bypass del sistema de routing, UIs Admin que no cumplen contratos.

**Invariantes protegidos:** INV-004

#### GAR-006. Validación de Template Base

**Qué valida:**
- El template base existe y es válido (INV-014)
- Todos los placeholders obligatorios están presentes (`{{TITLE}}`, `{{CONTENT}}`, `{{SIDEBAR_MENU}}`)
- El template base carga scripts canónicos requeridos

**Cuándo se valida:** 
- En boot: verificación de existencia del template
- En runtime: antes de renderizar cada UI Admin

**Qué ocurre si falla:**
- En boot: servidor **NO arranca** si el template base no existe
- En runtime: 500 con Error Contract v1 si el template no puede cargarse
- Si faltan placeholders: 500 con Error Contract v1 indicando placeholders faltantes

**Qué errores previene:** UIs Admin sin template base, templates inválidos, placeholders faltantes.

**Invariantes protegidos:** INV-014

#### GAR-007. Validación de Reemplazo de Placeholders

**Qué valida:**
- Todos los placeholders obligatorios son reemplazados antes de enviar HTML (INV-015)
- No quedan placeholders literales en el HTML final
- El sidebar se genera correctamente desde el registry (INV-019)

**Cuándo se valida:** Antes de enviar HTML al cliente (runtime, en `renderAdminPage()`).

**Qué ocurre si falla:**
- **BLOQUEA** el envío de HTML con placeholders literales
- Devuelve 500 con Error Contract v1 indicando placeholders no reemplazados
- **NO envía** HTML incompleto al cliente
- Registra el error con trace_id

**Qué errores previene:** HTML con placeholders visibles, sidebar no renderizado, contenido faltante en cliente.

**Invariantes protegidos:** INV-015, INV-019

#### GAR-008. Validación de Scripts Únicos

**Qué valida:**
- Los scripts globales (ej: `sidebar-client.js`) se cargan exactamente una vez (INV-016)
- No hay scripts duplicados en el HTML final
- Los scripts tienen guards idempotentes si es necesario

**Cuándo se valida:** 
- En Assembly Check: verificación estática de scripts duplicados
- En runtime: verificación antes de inyectar scripts en template

**Qué ocurre si falla:**
- En Assembly Check: warning (modo normal) o bloqueo (modo estricto)
- En runtime: el sistema intenta prevenir duplicación (guards idempotentes)
- Si se detecta duplicación: warning en logs, pero no bloquea (degradación controlada)

**Qué errores previene:** Scripts duplicados, errores de redeclaración de variables, listeners duplicados.

**Invariantes protegidos:** INV-016

### 6.5. Garantías de Contexto y Permisos

#### GAR-009. Validación de Contexto de Usuario

**Qué valida:**
- Toda UI Admin tiene contexto de usuario válido antes de renderizar (INV-005)
- El contexto contiene rol, permisos e identidad
- El usuario está autenticado (INV-005)

**Cuándo se valida:** Antes de renderizar cada UI Admin (runtime, en el handler).

**Qué ocurre si falla:**
- **BLOQUEA** el renderizado
- Devuelve 401 (no autenticado) o 403 (sin permisos) con Error Contract v1
- **NO renderiza** la UI Admin
- Registra el intento de acceso no autorizado

**Qué errores previene:** Acceso no autorizado, UIs Admin sin autenticación, violación de seguridad.

**Invariantes protegidos:** INV-005

#### GAR-010. Validación de Permisos en Servidor

**Qué valida:**
- Toda acción que requiere permisos se valida en servidor (INV-006)
- La validación en cliente es solo para UX, nunca para seguridad
- Los permisos se verifican antes de ejecutar la acción

**Cuándo se valida:** 
- En cada request que requiere permisos (runtime)
- Antes de ejecutar mutaciones (ACT-002)
- Antes de mostrar/ocultar elementos según permisos (INV-020)

**Qué ocurre si falla:**
- **BLOQUEA** la acción
- Devuelve 403 con Error Contract v1 indicando permisos insuficientes
- **NO ejecuta** la acción solicitada
- Registra el intento de acción no autorizada

**Qué errores previene:** Bypass de permisos, acciones no autorizadas, violación de seguridad.

**Invariantes protegidos:** INV-006, INV-020

#### GAR-011. Validación de Modo del Sistema

**Qué valida:**
- En modo BROKEN, ninguna UI Admin permite escrituras (INV-007)
- En modo DEGRADED, todas las escrituras muestran advertencias explícitas (INV-007)
- El modo del sistema se respeta en todas las operaciones

**Cuándo se valida:** 
- Antes de permitir cualquier escritura (runtime)
- En cada mutación (ACT-002)

**Qué ocurre si falla:**
- En modo BROKEN: **BLOQUEA** la escritura, devuelve 503 con Error Contract v1 indicando "sistema en modo BROKEN, escrituras bloqueadas"
- En modo DEGRADED: **PERMITE** la escritura pero muestra advertencia explícita y registra el evento
- **NO ejecuta** escrituras en modo BROKEN

**Qué errores previene:** Mutaciones en sistema roto, corrupción de datos, pérdida de integridad.

**Invariantes protegidos:** INV-007

### 6.6. Garantías de Mutaciones y Source of Truth

#### GAR-012. Validación de Servicios Canónicos

**Qué valida:**
- Toda escritura en Source of Truth pasa por servicios canónicos (INV-008)
- No hay escrituras directas en PostgreSQL desde UI Admin
- Todas las mutaciones usan los servicios canónicos correspondientes

**Cuándo se valida:** 
- En desarrollo: análisis estático de código (si es posible)
- En runtime: los servicios canónicos son el único punto de entrada para escrituras

**Qué ocurre si falla:**
- Si se detecta escritura directa: **BLOQUEA** la operación, devuelve 500 con Error Contract v1 indicando "escritura directa no permitida, use servicios canónicos"
- El sistema **NO permite** conexiones directas a PostgreSQL desde handlers de UI Admin
- Los servicios canónicos son el único punto de entrada validado

**Qué errores previene:** Mutaciones sin validación, mutaciones sin auditoría, bypass de reglas de negocio, corrupción de datos.

**Invariantes protegidos:** INV-008

#### GAR-013. Validación de Auditoría Obligatoria

**Qué valida:**
- Toda mutación queda auditada automáticamente (INV-009)
- La auditoría incluye: quién, cuándo, qué, trace_id
- No hay mutaciones "silenciosas" o sin auditoría

**Cuándo se valida:** 
- En cada mutación (runtime, en los servicios canónicos)
- Los servicios canónicos garantizan auditoría automática

**Qué ocurre si falla:**
- Si la auditoría falla: la mutación **NO se ejecuta** (fail-closed)
- Devuelve 500 con Error Contract v1 indicando "auditoría no disponible, mutación bloqueada"
- **NO permite** mutaciones sin auditoría

**Qué errores previene:** Mutaciones sin rastro, pérdida de trazabilidad, imposibilidad de diagnóstico.

**Invariantes protegidos:** INV-009

#### GAR-014. Validación en Servidor Obligatoria

**Qué valida:**
- Toda mutación es validada en servidor según contratos canónicos (INV-010)
- La validación en cliente es solo para UX
- Los servicios canónicos validan todas las mutaciones

**Cuándo se valida:** 
- En cada mutación (runtime, en los servicios canónicos)
- Antes de persistir en Source of Truth

**Qué ocurre si falla:**
- Si la validación falla: la mutación **NO se ejecuta**
- Devuelve 400 con Error Contract v1 indicando errores de validación específicos
- **NO persiste** datos inválidos en Source of Truth

**Qué errores previene:** Datos inválidos en SOT, bypass de validaciones, violación de contratos.

**Invariantes protegidos:** INV-010

### 6.7. Garantías de Observabilidad

#### GAR-015. Validación de Trace ID

**Qué valida:**
- Toda operación que toque Source of Truth, emita señales o genere errores propaga `trace_id` (INV-011)
- No hay operaciones sin `trace_id`
- El `trace_id` se propaga correctamente a través de todas las capas

**Cuándo se valida:** 
- En cada operación relevante (runtime)
- Los servicios canónicos garantizan propagación de `trace_id`

**Qué ocurre si falla:**
- Si no hay `trace_id`: la operación **continúa** pero se registra warning en logs
- El sistema intenta generar `trace_id` si falta (degradación controlada)
- Se registra el evento sin `trace_id` para diagnóstico

**Qué errores previene:** Eventos no correlacionables, diagnóstico imposible, pérdida de trazabilidad.

**Invariantes protegidos:** INV-011

#### GAR-016. Validación de Señales Registradas

**Qué valida:**
- Solo se emiten señales registradas en el Signal Registry (INV-012)
- No se emiten señales ad-hoc o no registradas
- Las señales tienen contrato válido

**Cuándo se valida:** 
- En cada emisión de señal (runtime, en el Signal Dispatcher)
- El Signal Dispatcher valida que la señal esté registrada

**Qué ocurre si falla:**
- Si se intenta emitir señal no registrada: **BLOQUEA** la emisión
- Devuelve error explícito indicando "señal no registrada: [nombre]"
- **NO emite** la señal
- Registra el intento de emisión de señal inválida

**Qué errores previene:** Señales no documentadas, señales no gobernables, automatizaciones que se disparan por señales inválidas.

**Invariantes protegidos:** INV-012

#### GAR-017. Validación de Logging Estructurado

**Qué valida:**
- Toda operación relevante se registra con logging estructurado (INV-013)
- Los logs incluyen: nivel, contexto, metadata, trace_id
- No hay eventos críticos sin logging

**Cuándo se valida:** 
- En cada operación relevante (runtime)
- Los servicios canónicos garantizan logging estructurado

**Qué ocurre si falla:**
- Si el logging falla: la operación **continúa** pero se registra warning
- El sistema intenta logging alternativo si el principal falla (degradación controlada)
- Se registra el evento de fallo de logging para diagnóstico

**Qué errores previene:** Eventos sin rastro, diagnóstico imposible, pérdida de observabilidad.

**Invariantes protegidos:** INV-013

### 6.8. Garantías de Sidebar y Navegación

#### GAR-018. Validación de Sidebar Gobernado

**Qué valida:**
- El sidebar se genera desde el Sidebar Registry (INV-019)
- No hay lógica de sidebar hardcodeada por pantalla
- El sidebar respeta permisos y feature flags (INV-020)

**Cuándo se valida:** 
- En Assembly Check: verificación de que no hay lógica de sidebar hardcodeada
- En runtime: el sidebar se genera desde el registry

**Qué ocurre si falla:**
- En Assembly Check: warning (modo normal) o bloqueo (modo estricto)
- En runtime: si el sidebar no se puede generar, la UI Admin se renderiza sin sidebar (degradación controlada)
- Se registra el evento para diagnóstico

**Qué errores previene:** Sidebars inconsistentes, navegación no gobernable, duplicación de lógica.

**Invariantes protegidos:** INV-019, INV-020

### 6.9. Garantías de Themes y Apariencia

#### GAR-019. Validación de Capability-First

**Qué valida:**
- Toda UI Admin declara capabilities semánticas (INV-021)
- No hay estilos visuales hardcodeados (colores, espaciados) directamente
- Las capabilities se resuelven a tokens visuales (INV-022)

**Cuándo se valida:** 
- En Assembly Check: verificación de que no hay estilos hardcodeados
- En runtime: las capabilities se resuelven a tokens visuales

**Qué ocurre si falla:**
- En Assembly Check: warning (modo normal) o bloqueo (modo estricto)
- En runtime: si las capabilities no se resuelven, se usan tokens por defecto (degradación controlada)

**Qué errores previene:** Temas no intercambiables, estilos hardcodeados, imposibilidad de cambiar apariencia.

**Invariantes protegidos:** INV-021, INV-022

### 6.10. Garantías de Automatizaciones

#### GAR-020. Validación de Automatizaciones Registradas

**Qué valida:**
- Solo se ejecutan automatizaciones registradas en el Automation Registry (INV-023)
- No se ejecutan automatizaciones no registradas
- Las automatizaciones tienen contrato válido

**Cuándo se valida:** 
- En cada ejecución de automatización (runtime, en el Automation Engine)
- El Automation Engine valida que la automatización esté registrada

**Qué ocurre si falla:**
- Si se intenta ejecutar automatización no registrada: **BLOQUEA** la ejecución
- Devuelve error explícito indicando "automatización no registrada: [id]"
- **NO ejecuta** la automatización
- Registra el intento de ejecución de automatización inválida

**Qué errores previene:** Automatizaciones no documentadas, automatizaciones no gobernables, ejecuciones no autorizadas.

**Invariantes protegidos:** INV-023

#### GAR-021. Validación de Separación de Ejecución

**Qué valida:**
- Las UI Admin no ejecutan automatizaciones directamente (INV-024)
- Solo el Automation Engine ejecuta automatizaciones
- Las UI Admin solo pueden visualizar, crear, modificar, activar/desactivar

**Cuándo se valida:** 
- En desarrollo: análisis estático de código (si es posible)
- En runtime: el Automation Engine es el único punto de entrada para ejecuciones

**Qué ocurre si falla:**
- Si se detecta ejecución directa desde UI Admin: **BLOQUEA** la ejecución
- Devuelve 500 con Error Contract v1 indicando "ejecución de automatización no permitida desde UI Admin"
- **NO ejecuta** la automatización
- Registra el intento de ejecución no autorizada

**Qué errores previene:** Ejecuciones manuales no auditadas, bypass del Automation Engine, violación de separación de responsabilidades.

**Invariantes protegidos:** INV-024

### 6.11. Garantías de Diagnóstico

#### GAR-022. Validación de Error Contract v1

**Qué valida:**
- Todos los errores se muestran usando Error Contract v1 (INV-025)
- Los errores incluyen diagnóstico claro
- No hay errores genéricos o sin diagnóstico

**Cuándo se valida:** 
- En cada error (runtime)
- Los handlers y servicios garantizan Error Contract v1

**Qué ocurre si falla:**
- Si un error no cumple Error Contract v1: se envuelve en Error Contract v1 antes de enviar
- El sistema **SIEMPRE** devuelve errores canónicos
- Se registra el error original para diagnóstico interno

**Qué errores previene:** Errores crípticos, diagnóstico imposible, inconsistencia en manejo de errores.

**Invariantes protegidos:** INV-025

#### GAR-023. Validación de Correlación por Trace ID

**Qué valida:**
- Toda búsqueda de errores o eventos puede correlacionarse por `trace_id` (INV-026)
- No hay eventos no correlacionables
- El sistema de correlación funciona correctamente

**Cuándo se valida:** 
- En cada búsqueda de eventos (runtime)
- El sistema de correlación garantiza que todos los eventos tienen `trace_id`

**Qué ocurre si falla:**
- Si un evento no tiene `trace_id`: se registra warning pero **NO bloquea** la búsqueda
- El sistema intenta correlacionar eventos sin `trace_id` si es posible (degradación controlada)
- Se registra el evento sin `trace_id` para diagnóstico

**Qué errores previene:** Eventos aislados, diagnóstico fragmentado, imposibilidad de rastrear flujos.

**Invariantes protegidos:** INV-026

### 6.12. Garantías de Editor de Pantallas (READY)

#### GAR-024. Validación de Contratos de Datos Declarativos

**Qué valida:**
- Toda UI Admin con capacidades [READY] relacionadas con Editor declara contratos de datos (INV-027)
- Los contratos son declarativos y validables
- No hay contratos implícitos

**Cuándo se valida:** 
- En editor-time: cuando el editor visual valida una UI Admin
- En Assembly Check: verificación de que los contratos están declarados

**Qué ocurre si falla:**
- En editor-time: **BLOQUEA** la generación/guardado de la UI Admin
- Muestra error explícito indicando contratos de datos faltantes o inválidos
- **NO permite** guardar UI Admin sin contratos válidos
- En Assembly Check: warning (modo normal) o bloqueo (modo estricto)

**Qué errores previene:** Contratos implícitos, validación imposible en editor, conexiones incorrectas.

**Invariantes protegidos:** INV-027

#### GAR-025. Validación de Contratos de Acciones Declarativos

**Qué valida:**
- Toda UI Admin con capacidades [READY] relacionadas con Editor declara acciones disponibles (INV-028)
- Las acciones son declarativas y validables
- No hay acciones implícitas

**Cuándo se valida:** 
- En editor-time: cuando el editor visual valida una UI Admin
- En Assembly Check: verificación de que las acciones están declaradas

**Qué ocurre si falla:**
- En editor-time: **BLOQUEA** la generación/guardado de la UI Admin
- Muestra error explícito indicando contratos de acciones faltantes o inválidos
- **NO permite** guardar UI Admin sin contratos válidos
- En Assembly Check: warning (modo normal) o bloqueo (modo estricto)

**Qué errores previene:** Acciones implícitas, conexiones incorrectas, flujos no validables.

**Invariantes protegidos:** INV-028

### 6.13. Garantías de CI/CD y Despliegue

#### GAR-026. Validación Pre-Despliegue

**Qué valida:**
- Assembly Check en modo estricto pasa (GAR-004)
- Todas las rutas registradas tienen handlers válidos
- Todas las dependencias entre capacidades se cumplen
- No hay violaciones de invariantes detectables estáticamente

**Cuándo se valida:** 
- En CI/CD: antes de cada despliegue (obligatorio)
- En builds de producción: obligatorio
- Manualmente: ejecutable on-demand

**Qué ocurre si falla:**
- **BLOQUEA** el despliegue
- El sistema **NO puede desplegarse** hasta corregir violaciones
- Reporte detallado con referencias a invariantes violados
- Sugerencias de corrección

**Qué errores previene:** UIs Admin inválidas en producción, violaciones de contratos canónicos, sistemas arquitectónicamente rotos.

**Invariantes protegidos:** Todos los invariantes detectables estáticamente

#### GAR-027. Validación Post-Despliegue

**Qué valida:**
- El sistema arranca correctamente
- Todas las rutas registradas son accesibles
- El template base se carga correctamente
- Los servicios canónicos están disponibles

**Cuándo se valida:** 
- Después de cada despliegue (post-deployment checks)
- Health checks periódicos

**Qué ocurre si falla:**
- **ALERTA** inmediata al equipo
- El sistema puede degradarse o entrar en modo DEGRADED
- Reporte de errores con Error Contract v1
- Rollback automático si es crítico

**Qué errores previene:** Despliegues rotos, sistemas no funcionales en producción, pérdida de servicio.

**Invariantes protegidos:** INV-014, INV-015, GAR-001, GAR-002

### 6.14. Garantías de Degradación Controlada

#### GAR-028. Fail-Closed en Capas Críticas

**Qué valida:**
- Si una capa crítica (Router, Context, SOT, Seguridad, Runtime) falla, el sistema falla explícitamente (INV-017)
- No hay degradación silenciosa en capas críticas
- Los errores se reportan con Error Contract v1

**Cuándo se valida:** 
- En cada operación que toca capas críticas (runtime)
- Los guards de capas críticas garantizan fail-closed

**Qué ocurre si falla:**
- **BLOQUEA** la operación
- Devuelve error explícito con Error Contract v1
- **NO permite** operaciones en estados inválidos
- Registra el fallo para diagnóstico

**Qué errores previene:** Fallos silenciosos, operaciones en estados inválidos, pérdida de integridad.

**Invariantes protegidos:** INV-017

#### GAR-029. Fail-Open con Degradación en Capas No Críticas

**Qué valida:**
- Si una capa no crítica (Observabilidad, Automatizaciones, Sidebar, Themes, Auditoría) falla, el sistema continúa pero se degrada (INV-018)
- La degradación es controlada y explícita
- Los errores se registran pero no bloquean

**Cuándo se valida:** 
- En cada operación que toca capas no críticas (runtime)
- Los guards de capas no críticas garantizan fail-open con degradación

**Qué ocurre si falla:**
- **PERMITE** la operación pero sin la funcionalidad afectada
- Registra warning en logs estructurados
- Muestra advertencia al usuario si es relevante
- **NO bloquea** la operación principal

**Qué errores previene:** Fallos en cascada, pérdida completa de funcionalidad por fallos menores.

**Invariantes protegidos:** INV-018

### 6.15. Resumen de Garantías

**Total de garantías del sistema: 29**

Estas 29 garantías aseguran que **TODA UI Admin futura** (creada a mano, por editor visual o por IA) cumple el contrato canónico. Hacen **imposible** crear una UI Admin inválida sin que el sistema la bloquee, degrade o rechace explícitamente.

**Distribución por mecanismo:**
- **Router Registry:** 2 garantías (GAR-001, GAR-002)
- **Assembly Check:** 2 garantías (GAR-003, GAR-004)
- **Runtime UI:** 4 garantías (GAR-005, GAR-006, GAR-007, GAR-008)
- **Contexto y Permisos:** 3 garantías (GAR-009, GAR-010, GAR-011)
- **Mutaciones y SOT:** 3 garantías (GAR-012, GAR-013, GAR-014)
- **Observabilidad:** 3 garantías (GAR-015, GAR-016, GAR-017)
- **Sidebar y Navegación:** 1 garantía (GAR-018)
- **Themes y Apariencia:** 1 garantía (GAR-019)
- **Automatizaciones:** 2 garantías (GAR-020, GAR-021)
- **Diagnóstico:** 2 garantías (GAR-022, GAR-023)
- **Editor de Pantallas:** 2 garantías (GAR-024, GAR-025)
- **CI/CD y Despliegue:** 2 garantías (GAR-026, GAR-027)
- **Degradación Controlada:** 2 garantías (GAR-028, GAR-029)

**Principio de enforcement:**

1. **Prevención sobre detección:** Las garantías **previenen** violaciones de invariantes, no solo las detectan después.

2. **Múltiples capas de validación:** 
   - **Build-time:** Assembly Check, análisis estático
   - **Boot-time:** Validación de registry, templates, configuraciones
   - **Runtime:** Guards, validaciones en cada operación
   - **Editor-time:** Validación en editor visual

3. **Fail-fast en crítico:** Las garantías de capas críticas **bloquean** operaciones inválidas. Las garantías de capas no críticas **degradan** pero permiten continuar.

4. **Trazabilidad completa:** Todas las violaciones se registran con Error Contract v1 y trace_id para diagnóstico.

5. **Imposibilidad de bypass:** El sistema está diseñado para hacer **imposible** crear una UI Admin inválida sin que sea detectada y bloqueada/degradada.

**Relación con invariantes:** Cada garantía protege uno o más invariantes específicos. Las garantías son los mecanismos de enforcement que aseguran que los invariantes se cumplen.

**Relación con capacidades:** Las garantías cubren únicamente capacidades [CORE] y [READY]. Las capacidades [PRODUCT] y [FUTURE] no tienen garantías porque no definen la ontología del sistema.

---

**Fin de la Sección 6: Garantías del Sistema para Creación de UI Admin**

