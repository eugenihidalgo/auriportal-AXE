# 🔍 AURIPORTAL — DIAGNÓSTICO SOURCE OF TRUTH (FASE 1)

**Fecha**: 2025-01-XX  
**Tipo**: Análisis Diagnóstico (Solo Lectura)  
**Objetivo**: Mapear y entender EXACTAMENTE el estado actual del Source of Truth de AuriPortal

---

## 📋 RESUMEN EJECUTIVO

Este diagnóstico identifica **TODAS** las entidades que actúan como Source of Truth (SOT) en AuriPortal, evalúa su robustez actual, mapea dependencias y acoplamientos, y documenta zonas estables que deben preservarse.

**Total de Sources of Truth identificados**: 25+ entidades principales

---

## 1️⃣ IDENTIFICACIÓN DE SOURCES OF TRUTH

### 1.1 CATÁLOGOS PDE (Source of Truth para Contenido)

#### 1.1.1 Registro de Catálogos PDE (`pde_catalog_registry`)
- **Ubicación**: `database/migrations/v5.12.0-create-pde-catalog-registry.sql`
- **Tabla**: `pde_catalog_registry` (PostgreSQL)
- **Tipo**: Catálogo / Metadata Registry
- **Estados posibles**: `active`, `archived`
- **Quién escribe**: Admin Panel (gestión manual)
- **Quién lee**: 
  - Diseñador de Motores
  - Package Engine
  - Resolvers
- **Contrato explícito**: ✅ Sí (`PDE_CATALOG_REGISTRY_V1.md`)
- **Descripción**: Registro canónico de metadata de todos los catálogos PDE. Define qué catálogos existen, sus capacidades (level, priority, duration, etc.) y si son usables para motores.

#### 1.1.2 Catálogos Individuales (Tablas de Contenido)
- **Ubicación**: Múltiples tablas PostgreSQL (ej: `transmutaciones_energeticas`, `tecnicas_limpieza`, `decretos`, `preparaciones_practica`, etc.)
- **Tipo**: Catálogo / Contenido
- **Estados posibles**: Depende del catálogo (algunos tienen `activo`, otros no)
- **Quién escribe**: Admin Panel, APIs de gestión
- **Quién lee**: 
  - Package Engine
  - Motores
  - Resolvers
  - UI de estudiantes
- **Contrato explícito**: ⚠️ Parcial (algunos tienen documentación, otros no)
- **Catálogos identificados**:
  - `transmutaciones_energeticas`
  - `tecnicas_limpieza`
  - `decretos`
  - `preparaciones_practica`
  - `practicas_post`
  - `recursos_tecnicos_musica`
  - `recursos_tecnicos_tonos`

### 1.2 CLASIFICACIONES Y SISTEMAS DE PROGRESO

#### 1.2.1 Sistema de Niveles (`NIVEL_THRESHOLDS`)
- **Ubicación**: `src/modules/nivel.js` (hardcoded array)
- **Tipo**: Clasificación / Regla de Negocio
- **Estados posibles**: Niveles 1-15 (Sanación 1-9, Canalización 10-15)
- **Quién escribe**: Código (hardcoded)
- **Quién lee**: 
  - `calcularNivelAutomatico()` - Calcula nivel basado en días desde inscripción
  - `actualizarNivelSiNecesario()` - Actualiza nivel en ClickUp
  - UI de estudiantes
- **Contrato explícito**: ❌ No (solo comentarios en código)
- **Descripción**: Define los umbrales de días desde inscripción para cada nivel. Es la regla canónica para calcular niveles automáticos.

#### 1.2.2 Nivel Actual del Estudiante
- **Ubicación**: 
  - ClickUp: Campo `CF_NIVEL_AURELIN` (fuente de verdad declarada)
  - PostgreSQL: Tabla `alumnos.nivel` (caché)
  - SQLite: Tabla `students.nivel` (caché legacy)
- **Tipo**: Estado de Estudiante
- **Estados posibles**: 1-15 (números enteros)
- **Quién escribe**: 
  - `actualizarNivelSiNecesario()` - Actualiza automáticamente si nivel calculado > nivel actual
  - Admin manual en ClickUp
- **Quién lee**: 
  - UI de estudiantes
  - Cálculo de progreso
  - Filtrado de contenido
- **Contrato explícito**: ⚠️ Implícito (documentado en comentarios: "ClickUp es la fuente de verdad")
- **Problema identificado**: ⚠️ Hay 3 lugares donde se almacena (ClickUp, PostgreSQL, SQLite) - riesgo de inconsistencia

#### 1.2.3 Rachas (Streaks)
- **Ubicación**: 
  - ClickUp: Campo `CF_STREAK_GENERAL` (fuente de verdad declarada)
  - ClickUp: Campo `CF_LAST_PRACTICE_DATE` (fecha última práctica)
  - PostgreSQL: Tabla `alumnos.racha_actual` (caché)
  - SQLite: Tabla `students.racha_actual` (caché legacy)
- **Tipo**: Estado de Estudiante / Métrica
- **Estados posibles**: Entero >= 0 (días consecutivos)
- **Quién escribe**: 
  - `checkDailyStreak()` - Calcula y actualiza racha
  - Lógica en `src/modules/streak.js`
- **Quién lee**: 
  - UI de estudiantes (pantallas de práctica)
  - Sistema de hitos (milestones)
  - Analytics
- **Contrato explícito**: ⚠️ Implícito (documentado en comentarios)
- **Problema identificado**: ⚠️ Múltiples fuentes de verdad (ClickUp, PostgreSQL, SQLite)

#### 1.2.4 Hitos de Racha (`MILESTONES`)
- **Ubicación**: `src/config/milestones.js` (hardcoded array)
- **Tipo**: Clasificación / Regla de Negocio
- **Estados posibles**: Array de números (ej: [25, 50, 75, 100, 150, 200, 365])
- **Quién escribe**: Código (hardcoded)
- **Quién lee**: 
  - `detectMilestone()` en `streak.js`
  - UI para mostrar mensajes especiales
- **Contrato explícito**: ❌ No

### 1.3 ESTADOS DE SUSCRIPCIÓN

#### 1.3.1 Estado de Suscripción
- **Ubicación**: 
  - Kajabi: API (fuente de verdad externa)
  - PostgreSQL: Tabla `kajabi_contacts.estado_suscripcion`, `kajabi_contacts.suscripcion_activa`, `kajabi_contacts.suscripcion_pausada`
  - ClickUp: Campo `CF_SUSCRIPCION_PAUSADA` (sincronizado)
  - SQLite: Tabla `students.suscripcion_pausada` (caché legacy)
- **Tipo**: Estado de Sistema / Autorización
- **Estados posibles**: `active`, `paused`, `canceled` (en Kajabi)
- **Quién escribe**: 
  - Kajabi (fuente externa)
  - Sincronización automática desde Kajabi
- **Quién lee**: 
  - `gestionarEstadoSuscripcion()` - Pausa/reactiva rachas
  - `puedePracticarHoy()` - Valida si puede practicar
  - UI de estudiantes
- **Contrato explícito**: ⚠️ Implícito
- **Problema identificado**: ⚠️ Múltiples lugares de almacenamiento, riesgo de desincronización

### 1.4 DATOS DE ESTUDIANTES

#### 1.4.1 Datos de Estudiante (Alumno)
- **Ubicación**: 
  - ClickUp: Tarea (fuente de verdad declarada en documentación v3.1)
  - PostgreSQL: Tabla `alumnos` (fuente de verdad v4+)
  - SQLite: Tabla `students` (caché legacy)
- **Tipo**: Entidad de Negocio
- **Estados posibles**: N/A (entidad activa)
- **Quién escribe**: 
  - Sincronización desde Kajabi
  - Onboarding desde Typeform
  - Admin manual
- **Quién lee**: 
  - Todos los módulos del sistema
  - UI de estudiantes
- **Contrato explícito**: ⚠️ Conflicto (v3.1 dice ClickUp, v4+ usa PostgreSQL)
- **Problema crítico**: ❌ Conflicto de arquitectura - ClickUp vs PostgreSQL como fuente de verdad

#### 1.4.2 Fecha de Inscripción
- **Ubicación**: 
  - Kajabi: Primera compra de "Mundo de Luz"
  - ClickUp: Campo `CF_FECHA_INSCRIPCION`
  - PostgreSQL: Tabla `alumnos.fecha_inscripcion`
  - SQLite: Tabla `students.fecha_inscripcion`
- **Tipo**: Dato Histórico / Clasificación
- **Estados posibles**: Timestamp / Fecha
- **Quién escribe**: Sincronización desde Kajabi
- **Quién lee**: 
  - `calcularNivelAutomatico()` - Calcula nivel basado en días desde inscripción
  - Analytics
- **Contrato explícito**: ❌ No

### 1.5 CONTEXTOS PDE

#### 1.5.1 Contextos PDE (`pde_contexts`)
- **Ubicación**: 
  - PostgreSQL: Tabla `pde_contexts`
  - Registry: `src/core/packages/source-of-truth-registry.js`
- **Tipo**: Catálogo / Metadata
- **Estados posibles**: `active`, `archived` (en registry)
- **Quién escribe**: Admin Panel, APIs de gestión
- **Quién lee**: 
  - Package Engine
  - Resolvers
  - UI de estudiantes
- **Contrato explícito**: ✅ Sí (`projection.context.list`, `projection.context.edit`, `projection.context.runtime`)
- **Problema identificado**: ⚠️ FASE 2 migración - columnas dedicadas vs `definition` JSONB como fuente de verdad

### 1.6 PAQUETES PDE

#### 1.6.1 Paquetes PDE (`pde_packages`)
- **Ubicación**: PostgreSQL: Tabla `pde_packages`
- **Tipo**: Contenido / Configuración
- **Estados posibles**: `draft`, `published`, `archived` (en versiones)
- **Quién escribe**: Admin Panel (Creador de Paquetes)
- **Quién lee**: 
  - Package Engine
  - Resolvers
  - UI de estudiantes
- **Contrato explícito**: ✅ Sí (`PACKAGE_DEFINITION_V3_CONTRACT.md`)
- **Descripción**: Paquetes de contenido que referencian Sources of Truth (catálogos PDE)

### 1.7 SEÑALES (SIGNALS)

#### 1.7.1 Definiciones de Señales (`pde_signals`)
- **Ubicación**: PostgreSQL: Tabla `pde_signals`
- **Tipo**: Señal / Evento
- **Estados posibles**: `active`, `archived`
- **Quién escribe**: Admin Panel, Automatizaciones
- **Quién lee**: 
  - Automation Engine
  - Signal Emitter
  - Analytics
- **Contrato explícito**: ⚠️ Parcial (documentación en migraciones)

#### 1.7.2 Emisiones de Señales (`pde_signal_emissions`)
- **Ubicación**: PostgreSQL: Tabla `pde_signal_emissions`
- **Tipo**: Evento / Trazabilidad
- **Estados posibles**: Timestamp de emisión
- **Quién escribe**: Signal Emitter (automático)
- **Quién lee**: 
  - Automation Engine (triggers)
  - Analytics
- **Contrato explícito**: ❌ No

### 1.8 AUTOMATIZACIONES

#### 1.8.1 Automatizaciones (`pde_automations`)
- **Ubicación**: PostgreSQL: Tabla `pde_automations`
- **Tipo**: Configuración / Regla
- **Estados posibles**: `active`, `paused`, `archived`
- **Quién escribe**: Admin Panel
- **Quién lee**: Automation Engine
- **Contrato explícito**: ⚠️ Parcial

### 1.9 RECORRIDOS

#### 1.9.1 Recorridos (`recorridos`)
- **Ubicación**: PostgreSQL: Tabla `recorridos` (con versiones y drafts)
- **Tipo**: Contenido / Flujo
- **Estados posibles**: `draft`, `published`, `archived` (en versiones)
- **Quién escribe**: Editor de Recorridos
- **Quién lee**: 
  - Runtime de Recorridos
  - UI de estudiantes
- **Contrato explícito**: ✅ Sí (validación en `validate-recorrido-definition.js`)

### 1.10 MOTORES

#### 1.10.1 Motores (`pde_motors`)
- **Ubicación**: PostgreSQL: Tabla `pde_motors`
- **Tipo**: Configuración / Lógica de Negocio
- **Estados posibles**: `draft`, `published`, `archived`
- **Quién escribe**: Diseñador de Motores
- **Quién lee**: Motor Engine (runtime)
- **Contrato explícito**: ⚠️ Parcial

### 1.11 RESOLVERS

#### 1.11.1 Resolvers (`pde_resolvers`)
- **Ubicación**: PostgreSQL: Tabla `pde_resolvers`
- **Tipo**: Configuración / Lógica de Negocio
- **Estados posibles**: `active`, `archived`
- **Quién escribe**: Admin Panel
- **Quién lee**: Resolver Engine
- **Contrato explícito**: ✅ Sí (requiere contrato formal)

### 1.12 CONTRATOS DEL SISTEMA

#### 1.12.1 Contract Registry (`contract-registry.js`)
- **Ubicación**: `src/core/contracts/contract-registry.js`
- **Tipo**: Metadata / Registry
- **Estados posibles**: `active`, `degraded`, `broken`
- **Quién escribe**: Desarrollo (manual)
- **Quién lee**: 
  - Coherence Engine
  - System Diagnostics
  - Validación de sistema
- **Contrato explícito**: ✅ Sí (`CONTRACT_OF_CONTRACTS.md`)
- **Descripción**: Registry canónico de TODOS los contratos del sistema. Es el "Contrato de Contratos".

### 1.13 RUTAS Y NAVEGACIÓN

#### 1.13.1 Admin Route Registry (`admin-route-registry.js`)
- **Ubicación**: `src/core/admin/admin-route-registry.js`
- **Tipo**: Configuración / Routing
- **Estados posibles**: N/A (rutas activas)
- **Quién escribe**: Desarrollo (manual)
- **Quién lee**: 
  - Router (`src/router.js`)
  - Admin Router Resolver
- **Contrato explícito**: ✅ Sí (documentado como "fuente de verdad única")
- **Descripción**: Registry canónico de todas las rutas `/admin/*`. El router SOLO obedece este registry.

#### 1.13.2 Sidebar Contract (`sidebar-contract.js`)
- **Ubicación**: `src/core/admin/sidebar/sidebar-contract.js`
- **Tipo**: Configuración / UI
- **Estados posibles**: N/A (estructura activa)
- **Quién escribe**: Desarrollo (manual)
- **Quién lee**: 
  - Sidebar Resolver
  - UI del Admin
- **Contrato explícito**: ✅ Sí (documentado como "fuente de verdad única")

### 1.14 ASPECTOS ENERGÉTICOS (V8)

#### 1.14.1 Aspectos Energéticos (`aspectos_energeticos`)
- **Ubicación**: PostgreSQL: Tabla `aspectos_energeticos` (V8)
- **Tipo**: Catálogo / Clasificación
- **Estados posibles**: `activo` (boolean)
- **Quién escribe**: Admin Panel
- **Quién lee**: 
  - Sistema de Limpieza Energética
  - UI de estudiantes
- **Contrato explícito**: ❌ No

#### 1.14.2 Estado de Aspectos por Alumno (`aspectos_energeticos_alumnos`)
- **Ubicación**: PostgreSQL: Tabla `aspectos_energeticos_alumnos` (V8)
- **Tipo**: Estado de Estudiante
- **Estados posibles**: `pendiente`, `al_dia`, `muy_pendiente`
- **Quién escribe**: Sistema de Limpieza, Admin
- **Quién lee**: UI de estudiantes, Sistema de recomendaciones
- **Contrato explícito**: ❌ No

### 1.15 MÓDULO DE CREACIÓN (V8)

#### 1.15.1 Objetivos de Creación (`creacion_objetivos`)
- **Ubicación**: PostgreSQL: Tabla `creacion_objetivos` (V8)
- **Tipo**: Estado de Estudiante / Objetivo
- **Estados posibles**: `activo`, `completado`, `descartado`
- **Quién escribe**: Admin, Estudiantes (futuro)
- **Quién lee**: UI de estudiantes
- **Contrato explícito**: ❌ No

---

## 2️⃣ EVALUACIÓN DE ROBUSTEZ

### 2.1 CATÁLOGOS PDE

#### `pde_catalog_registry`
- ✅ **Validaciones duras**: Sí (CHECK constraints en SQL)
- ⚠️ **Estados explícitos**: Parcial (`active`, `archived` - pero no `draft`)
- ✅ **Auditoría**: Sí (tabla de audit log implícita en migraciones)
- ✅ **Lógica duplicada**: No (registry centralizado)
- ✅ **Preparado para señales**: Sí (puede emitir señales cuando cambia)

**Estado general**: ✅ **CORRECTO** (con mejoras menores posibles)

#### Catálogos Individuales
- ⚠️ **Validaciones duras**: Variable (algunos tienen constraints, otros no)
- ⚠️ **Estados explícitos**: Variable (algunos tienen `activo`, otros no)
- ⚠️ **Auditoría**: Variable (algunos tienen, otros no)
- ⚠️ **Lógica duplicada**: Parcial (algunos catálogos tienen lógica similar en diferentes lugares)
- ⚠️ **Preparado para señales**: Variable

**Estado general**: ⚠️ **MEJORABLE** (falta estandarización)

### 2.2 SISTEMA DE NIVELES

#### `NIVEL_THRESHOLDS` (hardcoded)
- ❌ **Validaciones duras**: No (hardcoded en código)
- ❌ **Estados explícitos**: No (solo array de objetos)
- ❌ **Auditoría**: No
- ❌ **Lógica duplicada**: No (centralizado pero hardcoded)
- ❌ **Preparado para señales**: No

**Estado general**: ❌ **PROBLEMÁTICO** (debería estar en base de datos o configuración)

#### Nivel Actual del Estudiante
- ⚠️ **Validaciones duras**: Parcial (validación en ClickUp, pero no en sincronización)
- ⚠️ **Estados explícitos**: No (solo número)
- ⚠️ **Auditoría**: Parcial (solo en ClickUp si está configurado)
- ❌ **Lógica duplicada**: Sí (ClickUp, PostgreSQL, SQLite - riesgo de inconsistencia)
- ⚠️ **Preparado para señales**: Parcial (podría emitir señal en cambio de nivel)

**Estado general**: ⚠️ **MEJORABLE** (múltiples fuentes de verdad, riesgo de inconsistencia)

### 2.3 RACHAS

#### Rachas (Streaks)
- ⚠️ **Validaciones duras**: Parcial (validación en lógica, pero no en base de datos)
- ❌ **Estados explícitos**: No (solo número)
- ⚠️ **Auditoría**: Parcial (solo en ClickUp si está configurado)
- ❌ **Lógica duplicada**: Sí (ClickUp, PostgreSQL, SQLite - riesgo de inconsistencia)
- ✅ **Preparado para señales**: Sí (puede emitir señales en hitos)

**Estado general**: ⚠️ **MEJORABLE** (múltiples fuentes de verdad, riesgo de inconsistencia)

### 2.4 ESTADO DE SUSCRIPCIÓN

#### Estado de Suscripción
- ✅ **Validaciones duras**: Sí (Kajabi es autoridad)
- ✅ **Estados explícitos**: Sí (`active`, `paused`, `canceled`)
- ⚠️ **Auditoría**: Parcial (en Kajabi, pero no en sincronización local)
- ❌ **Lógica duplicada**: Sí (Kajabi, PostgreSQL, ClickUp, SQLite - riesgo de desincronización)
- ✅ **Preparado para señales**: Sí (puede emitir señales en cambios)

**Estado general**: ⚠️ **MEJORABLE** (múltiples lugares, riesgo de desincronización con Kajabi)

### 2.5 DATOS DE ESTUDIANTES

#### Datos de Estudiante
- ⚠️ **Validaciones duras**: Parcial (validación en PostgreSQL, pero conflicto con ClickUp)
- ⚠️ **Estados explícitos**: No (entidad activa, pero sin estados explícitos)
- ⚠️ **Auditoría**: Parcial (en PostgreSQL v4+, pero no en ClickUp/SQLite legacy)
- ❌ **Lógica duplicada**: Sí (ClickUp, PostgreSQL, SQLite - CONFLICTO ARQUITECTÓNICO)
- ✅ **Preparado para señales**: Sí (puede emitir señales en cambios)

**Estado general**: ❌ **PROBLEMÁTICO** (conflicto de arquitectura - ClickUp vs PostgreSQL)

### 2.6 CONTEXTOS PDE

#### `pde_contexts`
- ✅ **Validaciones duras**: Sí (CHECK constraints, validación en código)
- ✅ **Estados explícitos**: Sí (`active`, `archived`)
- ✅ **Auditoría**: Sí (`pde_context_audit_log`)
- ⚠️ **Lógica duplicada**: Parcial (FASE 2 migración - columnas vs `definition`)
- ✅ **Preparado para señales**: Sí

**Estado general**: ✅ **CORRECTO** (con migración en curso FASE 2)

### 2.7 PAQUETES PDE

#### `pde_packages`
- ✅ **Validaciones duras**: Sí (validación en Package Engine)
- ✅ **Estados explícitos**: Sí (`draft`, `published`, `archived` en versiones)
- ✅ **Auditoría**: Sí (`pde_package_audit_log`)
- ✅ **Lógica duplicada**: No (centralizado)
- ✅ **Preparado para señales**: Sí

**Estado general**: ✅ **CORRECTO**

### 2.8 SEÑALES

#### `pde_signals`
- ✅ **Validaciones duras**: Sí (validación en Signal Engine)
- ✅ **Estados explícitos**: Sí (`active`, `archived`)
- ✅ **Auditoría**: Sí (`pde_signal_audit_log`)
- ✅ **Lógica duplicada**: No
- ✅ **Preparado para señales**: Sí (es el sistema de señales)

**Estado general**: ✅ **CORRECTO**

### 2.9 AUTOMATIZACIONES

#### `pde_automations`
- ✅ **Validaciones duras**: Sí (validación en Automation Engine)
- ✅ **Estados explícitos**: Sí (`active`, `paused`, `archived`)
- ✅ **Auditoría**: Sí (`pde_automation_audit_log`)
- ✅ **Lógica duplicada**: No
- ✅ **Preparado para señales**: Sí (consume señales)

**Estado general**: ✅ **CORRECTO**

### 2.10 RECORRIDOS

#### `recorridos`
- ✅ **Validaciones duras**: Sí (`validate-recorrido-definition.js`)
- ✅ **Estados explícitos**: Sí (`draft`, `published`, `archived` en versiones)
- ✅ **Auditoría**: Sí (`recorrido_audit_log`)
- ✅ **Lógica duplicada**: No
- ✅ **Preparado para señales**: Sí (puede emitir señales en eventos)

**Estado general**: ✅ **CORRECTO**

### 2.11 CONTRATOS DEL SISTEMA

#### `contract-registry.js`
- ✅ **Validaciones duras**: Sí (`validateRegistry()`)
- ✅ **Estados explícitos**: Sí (`active`, `degraded`, `broken`)
- ✅ **Auditoría**: Sí (Coherence Engine)
- ✅ **Lógica duplicada**: No (registry centralizado)
- ✅ **Preparado para señales**: Sí (puede emitir señales en cambios de estado)

**Estado general**: ✅ **CORRECTO**

### 2.12 RUTAS Y NAVEGACIÓN

#### `admin-route-registry.js`
- ✅ **Validaciones duras**: Sí (`validateAdminRouteRegistry()`)
- ✅ **Estados explícitos**: N/A (rutas activas)
- ✅ **Auditoría**: Parcial (validación en arranque)
- ✅ **Lógica duplicada**: No (registry centralizado)
- ⚠️ **Preparado para señales**: No (no emite señales)

**Estado general**: ✅ **CORRECTO**

---

## 3️⃣ DEPENDENCIAS Y ACOPLAMIENTOS

### 3.1 DEPENDENCIAS CRÍTICAS

#### 3.1.1 ClickUp como Fuente de Verdad (v3.1) vs PostgreSQL (v4+)
- **Problema**: Conflicto arquitectónico
- **Impacto**: Alto riesgo de inconsistencias
- **Ubicaciones afectadas**:
  - `src/modules/nivel.js` - Comenta "ClickUp es la fuente de verdad"
  - `src/modules/streak.js` - Actualiza ClickUp primero
  - `database/pg.js` - PostgreSQL como "única fuente de verdad v4"
- **Riesgo**: Datos desincronizados entre ClickUp y PostgreSQL

#### 3.1.2 Kajabi como Fuente Externa de Suscripciones
- **Problema**: Dependencia externa sin caché robusto
- **Impacto**: Si Kajabi API falla, no se puede validar acceso
- **Ubicaciones afectadas**:
  - `src/services/kajabi.js` - Llamadas a API
  - `src/endpoints/enter.js` - Validación de acceso
- **Riesgo**: Punto único de fallo

#### 3.1.3 Múltiples Cachés (ClickUp, PostgreSQL, SQLite)
- **Problema**: Tres lugares almacenan los mismos datos
- **Impacto**: Riesgo de inconsistencia
- **Ubicaciones afectadas**:
  - Todos los módulos que leen/escriben datos de estudiantes
- **Riesgo**: Datos desactualizados en cachés

### 3.2 ACOPLAMIENTOS PELIGROSOS

#### 3.2.1 UI Toma Decisiones de Negocio
- **Problema identificado**: Algunas pantallas calculan estados en lugar de leerlos
- **Ejemplo**: Cálculo de progreso en UI en lugar de leer de SOT
- **Riesgo**: Lógica duplicada, inconsistencias

#### 3.2.2 Handlers Recalculan Reglas del SOT
- **Problema identificado**: Algunos handlers recalculan niveles/rachas en lugar de leer del SOT
- **Ejemplo**: `actualizarNivelSiNecesario()` recalcula en lugar de solo leer
- **Riesgo**: Lógica duplicada, posibles inconsistencias

#### 3.2.3 Hardcoded en Código vs Base de Datos
- **Problema identificado**: `NIVEL_THRESHOLDS` y `MILESTONES` están hardcoded
- **Impacto**: No se pueden cambiar sin deploy
- **Riesgo**: Falta de flexibilidad

### 3.3 CASOS DE INCONSISTENCIA POTENCIAL

#### 3.3.1 Nivel del Estudiante
- **Escenario**: ClickUp tiene nivel 5, PostgreSQL tiene nivel 4, SQLite tiene nivel 3
- **Causa**: Sincronización fallida o parcial
- **Impacto**: UI muestra nivel incorrecto dependiendo de qué fuente lee

#### 3.3.2 Racha del Estudiante
- **Escenario**: ClickUp tiene racha 10, PostgreSQL tiene racha 8
- **Causa**: Actualización en ClickUp pero sincronización fallida a PostgreSQL
- **Impacto**: UI muestra racha incorrecta

#### 3.3.3 Estado de Suscripción
- **Escenario**: Kajabi tiene `paused`, pero PostgreSQL tiene `active`
- **Causa**: Sincronización fallida o retrasada
- **Impacto**: Usuario puede practicar cuando no debería

---

## 4️⃣ ZONAS QUE NO DEBEN REHACERSE

### 4.1 ESTRUCTURAS BIEN DISEÑADAS

#### 4.1.1 Contract Registry (`contract-registry.js`)
- **Justificación**: 
  - ✅ Registry centralizado y bien estructurado
  - ✅ Validación automática
  - ✅ Estados explícitos (`active`, `degraded`, `broken`)
  - ✅ Base para Coherence Engine
- **Estado**: ✅ **PRESERVAR**

#### 4.1.2 Sistema de Versionado (Recorridos, Paquetes, Temas, etc.)
- **Justificación**:
  - ✅ Patrón consistente: `draft` → `version` → `published`
  - ✅ Audit logs completos
  - ✅ Permite rollback
- **Estado**: ✅ **PRESERVAR**

#### 4.1.3 Projection Contracts
- **Justificación**:
  - ✅ Contratos explícitos para LIST, EDIT, RUNTIME
  - ✅ Separación clara de responsabilidades
  - ✅ Validación en código
- **Estado**: ✅ **PRESERVAR**

#### 4.1.4 Runtime Guard (`runtime-guard.js`)
- **Justificación**:
  - ✅ Garantiza respuestas JSON válidas
  - ✅ Captura todas las excepciones
  - ✅ Base para "Contrato de Contratos"
- **Estado**: ✅ **PRESERVAR**

#### 4.1.5 Admin Route Registry
- **Justificación**:
  - ✅ Fuente de verdad única para rutas
  - ✅ Validación en arranque
  - ✅ Previene errores silenciosos
- **Estado**: ✅ **PRESERVAR**

#### 4.1.6 Sistema de Señales y Automatizaciones
- **Justificación**:
  - ✅ Arquitectura bien diseñada
  - ✅ Audit logs completos
  - ✅ Separación de concerns
- **Estado**: ✅ **PRESERVAR**

### 4.2 DECISIONES ARQUITECTÓNICAS CORRECTAS

#### 4.2.1 PostgreSQL como Base de Datos Principal (v4+)
- **Justificación**:
  - ✅ Escalable
  - ✅ Transacciones ACID
  - ✅ Mejor que SQLite para producción
- **Estado**: ✅ **PRESERVAR** (pero resolver conflicto con ClickUp)

#### 4.2.2 Separación de Concerns (Repos, Services, Endpoints)
- **Justificación**:
  - ✅ Arquitectura limpia
  - ✅ Fácil de testear
  - ✅ Mantenible
- **Estado**: ✅ **PRESERVAR**

#### 4.2.3 Sistema de Contratos Explícitos
- **Justificación**:
  - ✅ Documentación clara
  - ✅ Validación automática
  - ✅ Base para robustez futura
- **Estado**: ✅ **PRESERVAR Y EXPANDIR**

---

## 5️⃣ RIESGOS PRINCIPALES

### 5.1 RIESGOS CRÍTICOS

#### 5.1.1 Conflicto de Arquitectura: ClickUp vs PostgreSQL
- **Severidad**: 🔴 **CRÍTICA**
- **Descripción**: Documentación v3.1 dice "ClickUp es la fuente de verdad", pero v4+ usa PostgreSQL
- **Impacto**: Inconsistencias de datos, confusión en desarrollo
- **Recomendación**: Definir UNA fuente de verdad y migrar completamente

#### 5.1.2 Múltiples Cachés sin Sincronización Robusta
- **Severidad**: 🔴 **CRÍTICA**
- **Descripción**: ClickUp, PostgreSQL y SQLite almacenan los mismos datos
- **Impacto**: Datos desincronizados, comportamiento impredecible
- **Recomendación**: Eliminar cachés redundantes o implementar sincronización robusta

#### 5.1.3 Hardcoded en Código (`NIVEL_THRESHOLDS`, `MILESTONES`)
- **Severidad**: 🟡 **ALTA**
- **Descripción**: Reglas de negocio hardcoded en código
- **Impacto**: No se pueden cambiar sin deploy, falta de flexibilidad
- **Recomendación**: Mover a base de datos o configuración

### 5.2 RIESGOS ALTOS

#### 5.2.1 Dependencia Externa (Kajabi) sin Caché Robusto
- **Severidad**: 🟡 **ALTA**
- **Descripción**: Si Kajabi API falla, no se puede validar acceso
- **Impacto**: Usuarios bloqueados
- **Recomendación**: Implementar caché robusto con TTL y fallback

#### 5.2.2 Falta de Estados Explícitos en Algunos SOT
- **Severidad**: 🟡 **ALTA**
- **Descripción**: Algunos SOT no tienen estados explícitos (draft/active/archived)
- **Impacto**: No se puede gestionar ciclo de vida
- **Recomendación**: Añadir estados explícitos donde falten

#### 5.2.3 Falta de Auditoría en Algunos SOT
- **Severidad**: 🟡 **ALTA**
- **Descripción**: Algunos SOT no tienen audit logs
- **Impacto**: No se puede rastrear cambios
- **Recomendación**: Añadir audit logs donde falten

### 5.3 RIESGOS MEDIOS

#### 5.3.1 Lógica Duplicada en UI
- **Severidad**: 🟠 **MEDIA**
- **Descripción**: UI recalcula estados en lugar de leer del SOT
- **Impacto**: Posibles inconsistencias
- **Recomendación**: Mover lógica a SOT, UI solo lee

#### 5.3.2 Falta de Validaciones Duras en Algunos SOT
- **Severidad**: 🟠 **MEDIA**
- **Descripción**: Algunos SOT no tienen CHECK constraints o validaciones
- **Impacto**: Datos inválidos pueden entrar
- **Recomendación**: Añadir validaciones donde falten

---

## 6️⃣ RESUMEN POR CATEGORÍA

### 6.1 CATÁLOGOS Y CONTENIDO
- **Total**: 8+ entidades
- **Estado general**: ⚠️ **MEJORABLE** (falta estandarización)
- **Acción prioritaria**: Estandarizar estructura y estados

### 6.2 CLASIFICACIONES Y PROGRESO
- **Total**: 4 entidades principales
- **Estado general**: ⚠️ **MEJORABLE** (múltiples fuentes de verdad, hardcoded)
- **Acción prioritaria**: Consolidar fuente de verdad, mover hardcoded a BD

### 6.3 ESTADOS DE SISTEMA
- **Total**: 3 entidades principales
- **Estado general**: ⚠️ **MEJORABLE** (dependencia externa, múltiples cachés)
- **Acción prioritaria**: Robustecer caché, eliminar cachés redundantes

### 6.4 CONFIGURACIÓN Y METADATA
- **Total**: 5+ entidades
- **Estado general**: ✅ **CORRECTO** (bien diseñadas)
- **Acción prioritaria**: Expandir patrón a otros SOT

---

## 7️⃣ CONCLUSIÓN

### 7.1 ESTADO GENERAL

El sistema AuriPortal tiene una **base sólida** con:
- ✅ Sistema de contratos explícitos bien diseñado
- ✅ Arquitectura de versionado robusta
- ✅ Separación de concerns clara

Pero también tiene **áreas críticas** que requieren atención:
- ❌ Conflicto arquitectónico ClickUp vs PostgreSQL
- ❌ Múltiples cachés sin sincronización robusta
- ❌ Reglas de negocio hardcoded

### 7.2 PRIORIDADES PARA FASE 2 (ROBUSTECIMIENTO)

1. **CRÍTICO**: Resolver conflicto ClickUp vs PostgreSQL
2. **CRÍTICO**: Consolidar fuentes de verdad (eliminar cachés redundantes)
3. **ALTO**: Mover hardcoded a base de datos o configuración
4. **ALTO**: Robustecer caché de Kajabi
5. **MEDIO**: Estandarizar estados explícitos en todos los SOT
6. **MEDIO**: Expandir patrón de contratos a más SOT

### 7.3 ZONAS ESTABLES (NO TOCAR)

- Contract Registry
- Sistema de Versionado
- Projection Contracts
- Runtime Guard
- Admin Route Registry
- Sistema de Señales y Automatizaciones
- Arquitectura de Repos/Services/Endpoints

---

**FIN DEL DIAGNÓSTICO**

Este documento es la base para la Fase 2 de certificación y robustecimiento del Source of Truth.




