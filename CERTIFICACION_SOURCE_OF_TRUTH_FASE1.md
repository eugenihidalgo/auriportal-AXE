# CERTIFICACIÓN SOURCE OF TRUTH - FASE 1
## Declaración Constitucional del Sistema AuriPortal

**Versión**: 1.0.0  
**Fecha de Certificación**: 2025-01-XX  
**Estado**: VIGENTE  
**Alcance**: Todo el sistema AuriPortal

---

## 1. INTRODUCCIÓN

Este documento certifica y declara de forma explícita, inequívoca y vinculante la arquitectura del Source of Truth (SOT) en AuriPortal tras la Fase 1 de Robustización Constitucional.

Este documento es:
- Referencia obligatoria para todo desarrollo futuro
- Base para enforcement mediante Project Rules (alwaysApply=true)
- Fundamento para la Fase 2 de Certificación Operativa

Nada en este documento es opinable. Todas las declaraciones son vinculantes.

---

## 2. PRINCIPIOS CONSTITUCIONALES DEL SOURCE OF TRUTH

### 2.1 Definición de Source of Truth

Un Source of Truth es una entidad que:
- Tiene autoridad soberana sobre un dominio de datos
- No puede ser contradicha por otras entidades
- Tiene estados explícitos (draft/active/archived o equivalentes)
- Tiene auditoría completa de cambios
- Tiene validaciones duras (CHECK constraints, validación en código)
- Está preparado para emitir señales en cambios de estado

### 2.2 Clasificación de Entidades

Todas las entidades del sistema se clasifican en una de estas categorías:

1. **Source of Truth**: Autoridad soberana, única fuente de verdad
2. **Mirror**: Copia sincronizada de un SOT, sin autoridad propia
3. **Cache**: Caché temporal para rendimiento, puede invalidarse
4. **Legacy**: Sistema histórico, aislado, no participa en runtime

### 2.3 Principio de Soberanía Única

Para cada dominio de datos, existe exactamente UN Source of Truth. No puede haber múltiples fuentes de verdad para el mismo dominio.

### 2.4 Principio de Inmutabilidad de Decisiones

Las decisiones constitucionales declaradas en este documento no pueden ser revertidas sin un proceso explícito de modificación constitucional.

---

## 3. DECLARACIÓN DE SOBERANÍAS

### 3.1 Source of Truth del Alumno

**PostgreSQL es el ÚNICO Source of Truth soberano del Alumno.**

La tabla `alumnos` en PostgreSQL contiene la autoridad soberana sobre:
- Identidad del alumno (email, nombre, apodo)
- Estado de suscripción
- Nivel actual
- Racha actual
- Fecha de última práctica
- Fecha de inscripción
- Todos los datos operativos del alumno

**ClickUp:**
- NO es fuente de verdad
- Actúa como sistema externo / operativo / CRM
- Nunca decide estado
- Puede recibir actualizaciones desde PostgreSQL como mirror
- No se consulta en runtime para decisiones de negocio

**Kajabi:**
- NO es fuente de verdad
- NO participa en runtime
- Puede, como máximo, emitir eventos externos históricos
- No bloquea acceso
- No participa en decisiones de negocio

**SQLite:**
- NO es fuente de verdad
- Es legacy
- No se lee en runtime
- Existe solo para referencia histórica

**Cualquier sistema que no sea PostgreSQL o listas canónicas explícitas:**
- Queda fuera del dominio soberano
- No tiene autoridad para decidir estado

### 3.2 Source of Truth de Reglas de Progresión

**Las reglas de progresión son Source of Truth en PostgreSQL.**

Esto incluye:
- Umbrales de niveles (días desde inscripción → nivel)
- Hitos de racha (milestones)
- Categorías de niveles (Sanación, Canalización)
- Cualquier regla que determine progreso

**Requisitos obligatorios:**
- Estados explícitos (draft/active/archived)
- Versionado completo
- Auditoría de cambios
- Preparación para emitir señales

**Prohibiciones:**
- NO puede existir lógica hardcoded como autoridad
- NO puede calcularse en runtime sin consultar el SOT
- NO puede modificarse sin pasar por UI de gobierno

**El motor de progreso:**
- Solo consume reglas desde PostgreSQL
- Nunca decide reglas
- Nunca recalcula reglas
- Siempre lee del SOT

**Gobierno:**
- Debe existir UI en AuriPortal Admin para gestionar reglas
- El Master puede modificar reglas con versionado y auditoría

### 3.3 Source of Truth de Estado de Suscripción

**El estado de suscripción es Source of Truth en PostgreSQL.**

La tabla `alumnos.estado_suscripcion` contiene la autoridad soberana sobre:
- Estado actual (active/paused/canceled)
- Fecha de cambio de estado
- Razón del cambio

**Kajabi queda completamente desbancado:**
- No se consulta en runtime
- No bloquea acceso
- No participa en decisiones
- No se sincroniza automáticamente

**El sistema debe funcionar incluso si Kajabi no existe.**

**Actualización del estado:**
- Solo se actualiza desde UI Admin
- O desde automatizaciones registradas
- Con auditoría completa
- Con emisión de señales

---

## 4. CLASIFICACIÓN EXPLÍCITA DE ENTIDADES

### 4.1 Sources of Truth (Soberanos)

#### 4.1.1 Datos de Alumno
- **Ubicación**: PostgreSQL tabla `alumnos`
- **Dominio**: Identidad, estado, progreso del alumno
- **Estados**: El Alumno es un agregado vivo; su estado se expresa mediante sub-estados (suscripción, progreso, pausas, etc.), no mediante un ciclo de vida draft/archived.
- **Auditoría**: Tabla `audit_log` (si aplica)

#### 4.1.2 Reglas de Progresión
- **Ubicación**: PostgreSQL tablas `niveles_fases`, `racha_fases`, `frases_nivel`
- **Dominio**: Reglas que determinan progreso (niveles, hitos, categorías)
- **Estados**: `draft`, `active`, `archived` (requerido)
- **Auditoría**: Tabla de audit correspondiente (requerido)

#### 4.1.3 Estado de Suscripción
- **Ubicación**: PostgreSQL tabla `alumnos.estado_suscripcion`
- **Dominio**: Estado de suscripción del alumno
- **Estados**: `active`, `paused`, `canceled`
- **Auditoría**: Tabla `audit_log` o tabla dedicada

#### 4.1.4 Catálogos PDE
- **Ubicación**: PostgreSQL tablas de catálogos (ej: `transmutaciones_energeticas`, `tecnicas_limpieza`, `decretos`, etc.)
- **Dominio**: Contenido PDE catalogado
- **Estados**: `active`, `archived` (requerido por estatuto común)
- **Auditoría**: Tabla de audit correspondiente (requerido)

#### 4.1.5 Registro de Catálogos PDE
- **Ubicación**: PostgreSQL tabla `pde_catalog_registry`
- **Dominio**: Metadata de catálogos PDE disponibles
- **Estados**: `active`, `archived`
- **Auditoría**: Implícita en migraciones

#### 4.1.6 Contextos PDE
- **Ubicación**: PostgreSQL tabla `pde_contexts`
- **Dominio**: Definiciones de contextos PDE
- **Estados**: `active`, `archived`
- **Auditoría**: Tabla `pde_context_audit_log`

#### 4.1.7 Paquetes PDE
- **Ubicación**: PostgreSQL tabla `pde_packages` (con versiones)
- **Dominio**: Paquetes de contenido PDE
- **Estados**: `draft`, `published`, `archived` (en versiones)
- **Auditoría**: Tabla `pde_package_audit_log`

#### 4.1.8 Señales PDE
- **Ubicación**: PostgreSQL tabla `pde_signals`
- **Dominio**: Definiciones de señales del dominio PDE
- **Estados**: `active`, `archived`
- **Auditoría**: Tabla `pde_signal_audit_log`

#### 4.1.9 Automatizaciones PDE
- **Ubicación**: PostgreSQL tabla `pde_automations`
- **Dominio**: Reglas de automatización
- **Estados**: `active`, `paused`, `archived`
- **Auditoría**: Tabla `pde_automation_audit_log`

#### 4.1.10 Recorridos
- **Ubicación**: PostgreSQL tabla `recorridos` (con versiones)
- **Dominio**: Flujos de recorridos
- **Estados**: `draft`, `published`, `archived` (en versiones)
- **Auditoría**: Tabla `recorrido_audit_log`

#### 4.1.11 Motores PDE
- **Ubicación**: PostgreSQL tabla `pde_motors`
- **Dominio**: Configuración de motores
- **Estados**: `draft`, `published`, `archived`
- **Auditoría**: Tabla de audit correspondiente

#### 4.1.12 Resolvers PDE
- **Ubicación**: PostgreSQL tabla `pde_resolvers`
- **Dominio**: Configuración de resolvers
- **Estados**: `active`, `archived`
- **Auditoría**: Tabla de audit correspondiente

#### 4.1.13 Contract Registry
- **Ubicación**: `src/core/contracts/contract-registry.js`
- **Dominio**: Registro canónico de todos los contratos del sistema
- **Estados**: `active`, `degraded`, `broken`
- **Auditoría**: Coherence Engine

#### 4.1.14 Admin Route Registry
- **Ubicación**: `src/core/admin/admin-route-registry.js`
- **Dominio**: Registro canónico de rutas `/admin/*`
- **Estados**: Rutas activas (sin estados explícitos de ciclo de vida)
- **Auditoría**: Validación en arranque

#### 4.1.15 Sidebar Contract
- **Ubicación**: `src/core/admin/sidebar/sidebar-contract.js`
- **Dominio**: Estructura del sidebar del Admin
- **Estados**: Estructura activa (sin estados explícitos de ciclo de vida)
- **Auditoría**: Implícita en código

#### 4.1.16 Aspectos Energéticos
- **Ubicación**: PostgreSQL tabla `aspectos_energeticos`
- **Dominio**: Catálogo de aspectos energéticos a limpiar
- **Estados**: `activo` (boolean)
- **Auditoría**: Tabla de audit correspondiente

#### 4.1.17 Estado de Aspectos por Alumno
- **Ubicación**: PostgreSQL tabla `aspectos_energeticos_alumnos`
- **Dominio**: Estado de limpieza de aspectos por alumno
- **Estados**: `pendiente`, `al_dia`, `muy_pendiente`
- **Auditoría**: Tabla `aspectos_energeticos_registros`

### 4.2 Mirrors (Copias Sincronizadas)

#### 4.2.1 ClickUp
- **Tipo**: Mirror de datos de alumno
- **Propósito**: Sistema operativo / CRM externo
- **Autoridad**: Ninguna
- **Sincronización**: Unidireccional desde PostgreSQL hacia ClickUp
- **Uso en runtime**: No se consulta para decisiones de negocio

### 4.3 Caches (Temporales)

#### 4.3.1 Cache de Lecturas Rápidas
- **Tipo**: Cache en memoria o Redis (si existe)
- **Propósito**: Mejorar rendimiento de lecturas frecuentes
- **Autoridad**: Ninguna
- **Invalidación**: Automática cuando el SOT cambia
- **Uso en runtime**: Solo para lecturas, nunca para decisiones

### 4.4 Legacy (Aislado)

#### 4.4.1 SQLite
- **Tipo**: Legacy
- **Estado**: Aislado, no se lee en runtime
- **Propósito**: Referencia histórica, migraciones explícitas
- **Autoridad**: Ninguna
- **Uso en runtime**: Prohibido

#### 4.4.2 ClickUp como Fuente de Verdad (v3.1)
- **Tipo**: Legacy conceptual
- **Estado**: Desbancado por PostgreSQL
- **Propósito**: Referencia histórica de arquitectura anterior
- **Autoridad**: Ninguna
- **Uso en runtime**: Prohibido

#### 4.4.3 Kajabi como Fuente de Verdad
- **Tipo**: Legacy conceptual
- **Estado**: Desbancado por PostgreSQL
- **Propósito**: Referencia histórica
- **Autoridad**: Ninguna
- **Uso en runtime**: Prohibido

---

## 5. ESTATUTO DEL LEGACY Y MIGRACIONES

### 5.1 Principio de Aislamiento

Todo legacy:
- Queda aislado y silenciado
- No se lee en runtime
- No actúa como fallback
- No participa en decisiones de negocio

### 5.2 Propósito del Legacy

El legacy existe solo para:
- Referencia histórica
- Migraciones explícitas, auditadas y conscientes
- Análisis de datos históricos

### 5.3 Proceso de Migración

Antes de retirar cualquier legacy:
1. Todo lo útil debe migrarse a PostgreSQL
2. La migración debe ser explícita y auditada
3. Debe existir validación de completitud
4. Debe documentarse el proceso

### 5.4 Prohibición de Fallback a Legacy

Ningún sistema en runtime puede usar legacy como fallback. Si PostgreSQL no está disponible, el sistema debe fallar explícitamente, no degradarse a legacy.

---

## 6. ESTATUTO DE CATÁLOGOS PDE

### 6.1 Estatuto Canónico Común

Todos los Catálogos PDE deben cumplir con un estatuto canónico común que incluye:

1. **Estados explícitos**: `active`, `archived` (mínimo)
2. **Auditoría**: Tabla de audit log correspondiente
3. **Validaciones duras**: CHECK constraints en SQL, validación en código
4. **Preparación para señales**: Capacidad de emitir señales en cambios de estado

### 6.2 Heterogeneidad de Capacidades

**NO se homogeneizan funcionalidades.**

Cada catálogo puede tener capacidades propias:
- Vídeo
- Render de pantallas
- Solo datos
- Limpiezas dinámicas
- Filtrado por nivel
- Filtrado por prioridad
- Duración
- Obligatoriedad

El estatuto común solo exige estados, auditoría, validaciones y señales. Las capacidades funcionales son específicas de cada catálogo.

### 6.3 Registro de Catálogos

El registro `pde_catalog_registry` es el Source of Truth para metadata de catálogos:
- Define qué catálogos existen
- Define capacidades de cada catálogo
- Define si son usables para motores
- Define endpoints y tablas fuente

### 6.4 Gobierno de Catálogos

La gestión de catálogos se hace desde UI Admin:
- Creación de nuevos catálogos
- Modificación de metadata
- Archivado de catálogos
- Con versionado y auditoría

---

## 7. ESTATUTO DE SEÑALES Y ANALÍTICAS

### 7.1 Obligatoriedad por Contrato

Señales y analíticas son obligatorias por contrato. Se implementan de forma diseñada, incremental y gobernable, no caótica.

### 7.2 División en Dos Carriles

El sistema de señales se divide en DOS carriles:

#### 7.2.1 Señales de Dominio (Mundo PDE)
- **Ubicación**: PostgreSQL tabla `pde_signals`
- **Dominio**: Eventos del negocio PDE
- **Contrato**: Definido en `pde_signals` con payload canónico
- **UI**: Admin dedicada para gestión

#### 7.2.2 Señales de Observabilidad (Telemetría del Sistema)
- **Ubicación**: Sistema de observabilidad (logs, traces, métricas) Las señales de observabilidad no son Source of Truth de dominio, pero sí Source of Truth de comportamiento del sistema.
- **Dominio**: Eventos del sistema (errores, performance, uso)
- **Ejemplos**: Error en endpoint, tiempo de respuesta, uso de memoria
- **Contrato**: Error Contract v1, trace_id, logging estructurado
- **UI**: System Diagnostics, Error Buffer

### 7.3 Gobierno de Señales

Todas las señales deben existir en un Registry canónico:
- Con contrato de payload explícito
- Con versionado
- Con deprecación controlada

El runtime NO puede emitir señales no registradas.

La gestión de señales se hace desde UI Admin dedicada:
- Creación de nuevas señales
- Modificación de contratos
- Deprecación de señales
- Con versionado y auditoría

### 7.4 Emisiones de Señales

Las emisiones de señales se registran en:
- PostgreSQL tabla `pde_signal_emissions` (señales de dominio)
- Sistema de observabilidad (señales de observabilidad)

Todas las emisiones son trazables mediante trace_id.

---

## 8. GOBIERNO DEL SISTEMA DESDE ADMIN

### 8.1 Panel de Gobierno del Sistema Vivo

El Admin de AuriPortal es un panel de gobierno del sistema vivo. Debe permitir:

1. **Inspección profunda de señales**:
   - Ver todas las señales emitidas
   - Filtrar por tipo, fecha, alumno
   - Correlar con trace_id

2. **Estados de SOT**:
   - Ver estado actual de todos los SOT
   - Ver historial de cambios
   - Ver auditoría completa

3. **Automatizaciones**:
   - Ver todas las automatizaciones activas
   - Ver ejecuciones recientes
   - Ver logs de ejecución

4. **Errores correlados por trace_id**:
   - Ver errores agrupados por trace_id
   - Ver stack traces completos
   - Ver contexto de request

### 8.2 Capacidades del Master

El Master puede, desde UI Admin:

1. **Añadir, modificar y retirar**:
   - Señales (con contrato, versionado, deprecación)
   - Reglas de progresión (con versionado, auditoría)
   - Automatizaciones (con versionado, auditoría)

2. **Gestionar SOT**:
   - Ver estado de todos los SOT
   - Modificar datos cuando sea necesario
   - Con auditoría completa

3. **Gestionar catálogos**:
   - Crear nuevos catálogos
   - Modificar metadata
   - Archivarlos

4. **Gestionar contratos**:
   - Ver estado de contratos (active/degraded/broken)
   - Ver dependencias entre contratos
   - Ver coherencia del sistema

### 8.3 Requisitos de Gobierno

Todas las operaciones de gobierno requieren:
- Versionado completo
- Auditoría de cambios
- Deprecación controlada (cuando aplica)
- Emisión de señales (cuando aplica)

---

## 9. QUÉ INCLUYE FASE 2 Y QUÉ NO INCLUYE

### 9.1 Qué Incluye Fase 2

La Fase 2 de Certificación Operativa incluye:

1. **Implementación de migraciones**:
   - Migrar datos de ClickUp a PostgreSQL (si aplica)
   - Migrar datos de SQLite a PostgreSQL
   - Migrar reglas hardcoded a PostgreSQL

2. **Implementación de UI de gobierno**:
   - UI para gestionar reglas de progresión
   - UI para gestionar señales
   - UI para gestionar automatizaciones
   - UI para inspección de SOT

3. **Robustecimiento de SOT**:
   - Añadir estados explícitos donde falten
   - Añadir auditoría donde falte
   - Añadir validaciones duras donde falten
   - Preparar para señales donde falte

4. **Eliminación de dependencias externas**:
   - Eliminar consultas a Kajabi en runtime
   - Eliminar consultas a ClickUp para decisiones
   - Eliminar lectura de SQLite en runtime

5. **Implementación de sincronización robusta**:
   - Sincronización unidireccional PostgreSQL → ClickUp (si aplica)
   - Invalidación de caches cuando SOT cambia

### 9.2 Qué NO Incluye Fase 2

La Fase 2 NO incluye:

1. **Nuevas features**:
   - No se añaden funcionalidades nuevas
   - No se optimiza rendimiento (excepto eliminación de consultas redundantes)
   - No se refactoriza código existente (excepto migraciones)

2. **Cambios arquitectónicos**:
   - No se cambia la arquitectura de contratos
   - No se cambia el sistema de versionado
   - No se cambia el sistema de señales

3. **Eliminación de legacy**:
   - No se elimina código legacy (solo se aísla)
   - No se eliminan tablas legacy (solo se dejan de leer)
   - La eliminación física es Fase 3 o posterior

---

## 10. REGLAS DE NO-REGRESIÓN

### 10.1 Prohibición de Múltiples Fuentes de Verdad

Nunca se puede crear una nueva entidad que actúe como fuente de verdad para un dominio ya cubierto por un SOT existente.

### 10.2 Prohibición de Hardcoded como Autoridad

Nunca se puede hardcodear lógica de negocio que deba estar en PostgreSQL. Toda regla de negocio debe ser consultable desde el SOT.

### 10.3 Prohibición de Consultas a Legacy

Nunca se puede consultar legacy en runtime. Si se necesita un dato, debe migrarse primero a PostgreSQL.

### 10.4 Prohibición de Dependencias Externas en Runtime

Nunca se puede depender de sistemas externos (Kajabi, ClickUp) para decisiones de negocio en runtime. El sistema debe funcionar independientemente.

### 10.5 Prohibición de Señales No Registradas

Nunca se puede emitir una señal que no esté registrada en el Registry canónico.

### 10.6 Prohibición de Modificaciones sin Auditoría

Nunca se puede modificar un SOT sin pasar por el sistema de auditoría.

### 10.7 Prohibición de Estados Implícitos

Nunca se puede crear un SOT sin estados explícitos (draft/active/archived o equivalentes).

### 10.8 Prohibición de Validaciones Blandas

Nunca se puede crear un SOT sin validaciones duras (CHECK constraints, validación en código).

---

## 11. VIGENCIA Y MODIFICACIÓN

### 11.1 Vigencia

Este documento entra en vigor inmediatamente tras su certificación y permanece vigente hasta su modificación explícita.

### 11.2 Modificación

Cualquier modificación de este documento requiere:
1. Proceso explícito de modificación constitucional
2. Documentación de la razón del cambio
3. Actualización de versiones
4. Comunicación a todo el equipo

### 11.3 Referencias Obligatorias

Este documento debe ser referenciado en:
- Project Rules (alwaysApply=true)
- Documentación de arquitectura
- Guías de desarrollo
- Procesos de code review

---

**FIN DE LA CERTIFICACIÓN**

Este documento es ley operativa del proyecto AuriPortal. Todas las declaraciones son vinculantes.






