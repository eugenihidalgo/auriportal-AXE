# Constitución Alquimia y Clasificaciones v1

**Versión**: 1.0.0  
**Fecha**: 2025-01-27  
**Dominio**: MASTER  
**Estado**: CANÓNICO

## Estatuto Constitucional Acordado

### Principios Fundamentales

1. **PostgreSQL es el único Source of Truth**
   - Todo catálogo, estado y clasificación reside en PostgreSQL
   - Ninguna fuente externa (ClickUp, Kajabi) tiene autoridad sobre alquimia

2. **Catálogo Infinito**
   - Listas de transmutaciones son infinitas (sin límites arbitrarios)
   - Items de transmutaciones son infinitos dentro de cada lista
   - No hay "superficies de trabajo" o límites artificiales

3. **Clasificaciones Globales**
   - `pde_classification_terms` es el SOT global para términos (key/subkey/tag)
   - `transmutacion_lista_classifications` es la relación many-to-many canónica
   - No se duplican clasificaciones en columnas legacy

4. **Dos Visiones Canónicas**
   - **Alquimia General**: Visión global del catálogo (configuración/listas/ítems)
   - **Alquimia del Alumno**: Visión por alumno (panel con estado materializado)

## Alquimia General vs Alquimia del Alumno

### Alquimia General (`/master/templo-luz/alquimia-general`)

**Propósito**: Gestión canónica del catálogo

**Responsabilidades**:
- Crear/editar/archivar listas
- Crear/editar/archivar items
- Gestionar clasificaciones (category/subcategory/tags) usando SOT global
- Diagnóstico de coherencia del catálogo

**Campos Canónicos**:
- `status = 'active'|'archived'` (soft delete)
- `item_ref` como identidad externa para Cleaning Engine
- Campos legacy (`activo`, `category_key`, `subtype_key`, `tags JSONB`) son DEPRECATED

**No decide**:
- Estado de limpieza por alumno
- Nivel efectivo de alumnos
- Qué items son aplicables

### Alquimia del Alumno (`/master/templo-luz/alquimia-alumno`)

**Propósito**: Panel 100% particular por alumno

**Responsabilidades**:
- Mostrar catálogo filtrado por nivel_efectivo
- Mostrar estados materializados (cleaning_item_state)
- Permitir limpiar items
- Mostrar historial (dos paneles: técnico + humano)
- Mostrar reportes (dos paneles: técnico + humano)

**Fuente de Datos**:
- Catálogo (estructura)
- `cleaning_item_state` (estado materializado)
- `nivel_efectivo` del alumno (desde Level Engine)

**Seed Canónico**:
- Estados "NUNCA" se materializan automáticamente antes de construir megalist
- Solo items aplicables (nivel <= nivel_efectivo)
- Idempotente (ON CONFLICT DO NOTHING)
- Masivo (1 query, no loops)

## Report: Dos Paneles Obligatorios

### Panel Técnico (Colapsado por defecto)

**Visibilidad**: Oculta por defecto, expandible

**Contenido**:
- Eventos raw desde `cleaning_events`
- `execution_key`, `trace_id`, `meta`
- Agregaciones técnicas (eventos por día, top items por eventos)
- Dataset completo para debugging

### Panel Humano (Visible por defecto)

**Visibilidad**: Visible por defecto

**Contenido**:
- Nombres resueltos (no refs técnicas)
- Agrupado por lista (nombre legible)
- Agrupado por clasificaciones (category/subcategory/tags)
- Eventos resueltos con nombres y clasificaciones

**Agrupación**:
- Por lista (primaria)
- Por clasificación (secundaria)
- Por fecha (opcional)

## Seed "NUNCA" Canónico

**Objetivo**: Materializar estados "NUNCA" para todos los items aplicables

**Requisitos**:
- Idempotente (ON CONFLICT DO NOTHING)
- Masivo (1 query INSERT...SELECT, no loops)
- Filtrado por nivel_efectivo (solo items aplicables)
- Ejecutable de forma segura (por endpoint antes de leer, y/o por job manual)

**Estado "NUNCA" Canónico**:
```javascript
{
  shared_last_cleaned_at: null,
  pde_last_cleaned_at: null,
  shared_clean_count: 0,
  pde_clean_count: 0,
  shared_completed: 0,
  shared_remaining: 0, // Para una_vez: se actualiza después según veces_limpiar
  pde_completed: 0,
  meta: {}
}
```

**Integración**:
- En GET megalist: ejecutar seed antes de construir respuesta
- En POST clean: si estado no existe, ejecutar seed y revalidar

## Integración con Señales/Analíticas

**Preparación para Futuro**:
- Señales registradas: `cleaning.seed.executed`, `cleaning.clean.executed`, `alquimia.catalog.changed`
- Logs estructurados con prefijos canónicos: `[MASTER][ALQUIMIA_GENERAL]`, `[MASTER][ALQUIMIA_ALUMNO]`, `[CLEANING][SEED]`
- Hooks preparados para automatizaciones (sin implementar UTE aún)

## Preparación para UTEs/Contextos/Paquetes

**Estado Actual**: Preparado pero no implementado

**Hooks Preparados**:
- Estructura de clasificaciones permite extensión futura
- Estados materializados permiten agregación futura
- Señales preparadas para consumo por automatizaciones

**No Implementado**:
- UTEs específicas para alquimia
- Contextos de alquimia
- Paquetes de alquimia

---

**Referencias**:
- Contratos: `src/core/contracts/alquimia-contracts.js`
- Contract Registry: `src/core/contracts/contract-registry.js`
- Servicios: `src/core/master/services/alquimia-*`
- Endpoints: `src/endpoints/master-api-alquimia-*`
