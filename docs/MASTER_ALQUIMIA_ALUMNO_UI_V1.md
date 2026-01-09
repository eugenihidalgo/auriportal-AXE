# Master Alquimia del Alumno UI v1

**Versión**: 1.0.0  
**Fecha**: 2025-01-27  
**Scope**: MASTER  
**Estado**: CANÓNICO

## Propósito

UI canónica para el panel operativo de limpiezas SHARED por alumno.

**URL**: `/master/templo-luz/alquimia-alumno`

## Componentes Principales

### 1. Selector de Alumno (Obligatorio)

**Ubicación**: Arriba del todo

**Componentes**:
- **Input de búsqueda**: Filtra alumnos por nombre/apodo/email
- **Select dropdown**: Lista completa de alumnos

**Comportamiento**:
- Al seleccionar alumno → Refetch completo de megalist y report
- Deep-link: `?student_id=...` carga automáticamente el alumno
- Cambiar alumno → Estado y megalist son 100% particulares por alumno

**REGLA CANÓNICA**: Selector SIEMPRE visible, incluso si no hay alumno seleccionado.

### 2. Estado Vacío (Sin Alumno)

**Mensaje**: "Selecciona un alumno para ver su Alquimia"

**Acción**: Usar selector para elegir alumno

### 3. Panel de Contenido (Con Alumno Seleccionado)

#### Selector de Nivel Cap

**Ubicación**: Arriba del resumen

**Opciones**:
- **Auto (nivel efectivo)**: Usa nivel_efectivo del alumno
- **1-9**: Cap explícito de nivel
- **∞ (Todos)**: Mostrar todos los niveles

**Persistencia**: Se guarda en localStorage por alumno (`ap_master_alquimia_alumno_level_cap_v1:${student_id}`)

#### Resumen

**Métricas**:
- **Total**: Total de items con estado
- **Nunca**: Items nunca trabajados
- **Importante**: Items importantes (críticos)
- **Pendiente**: Items pendientes
- **Revisado**: Items revisados

**Visualización**:
- Tarjetas con números grandes
- Barra de progreso: porcentaje revisado

#### Megalist por Listas

**Estructura**:
- Agrupada por **Lista** (nombre legible)
- Dentro de cada lista, agrupada por **Estado**:
  - **NUNCA** (colapsable, colapsado por defecto)
  - **IMPORTANTE** (siempre visible)
  - **PENDIENTE** (siempre visible)

**Cada Item Muestra**:
- **Nombre**: Nombre legible del item
- **Descripción**: Descripción del item (si existe)
- **Nivel**: Nivel requerido (badge)
- **Recurrencia**: "Cada X días" (recurrentes) o "N veces" (una_vez)
- **Estado**: Badge visual (never/important/pending)
- **Botones**:
  - **Marcar como revisado**: Limpieza SHARED (solo si NO está revisado)
  - **Historial**: Abre modal con historial completo

**REGLA CANÓNICA**: Solo se muestran items/listas con `status='active'`. Items/listas archivados no aparecen.

#### Revisados

**Subsecciones**:
- **Por Alumno**: Items revisados por el alumno (`actor_type='student'`)
- **Por Master**: Items revisados por el master (`actor_type='master'`)

**Estructura**: Agrupada por lista, mostrando items revisados con botón "Historial".

#### Informe

**Dos Paneles**:

**A) Panel Humano (Visible por defecto)**:
- Agrupado por **Lista** (nombre legible)
- Cada lista muestra:
  - Clasificaciones (categoría, subcategoría, tags) como badges
  - Items con eventos:
    - Nombre del item
    - Número de eventos
    - Última fecha de limpieza
- Nombres resueltos (no refs técnicas)

**B) Panel Técnico (Colapsado por defecto)**:
- **Totales**: Total eventos, por Master, por Alumno
- **Eventos por día**: Gráfico/lista de eventos por fecha
- **Top items por eventos**: Ranking de items más trabajados
- **Dataset**: Datos raw para debugging

**Regla**: Panel técnico expandible, pero colapsado por defecto para no saturar.

## Modal de Historial de Item

**Trigger**: Botón "Historial" en cualquier item

**Dos Paneles**:

**A) Panel Humano (Visible por defecto)**:
- **Info del Item**:
  - Nombre legible
  - Lista legible
  - Clasificaciones (badges)
- **Eventos**:
  - Fecha legible
  - Acción legible ("✓ Limpieza registrada")
  - Actor ("por Master" / "por Alumno")

**B) Panel Técnico (Colapsado por defecto)**:
- Tabla con eventos raw:
  - Fecha ISO
  - Tipo de acción
  - Layer (shared/pde)
  - Actor type
  - Execution key
  - Metadata (JSON)

**REGLA**: Si el item está archivado, el panel técnico puede mostrar eventos históricos, pero el panel humano no muestra el item (o lo marca como archivado).

## Estados Vacíos

### Sin Items en Megalist

**Mensaje**: 
- Ícono: 📋
- Título: "No hay items con estado para este alumno"
- Explicación: "Esto puede significar que: el alumno no tiene items aplicables para su nivel, o los items aún no han sido materializados (seed automático)."

### Sin Eventos en Historial

**Panel Humano**: "No hay eventos de limpieza registrados"

**Panel Técnico**: "No hay eventos técnicos"

### Sin Eventos en Reporte

**Panel Humano**: "No hay eventos de limpieza en este período"

## Reglas Canónicas

1. **Archivado = No Renderizable**: Items/listas archivados NO aparecen en megalist ni panel humano
2. **Historia Preservada**: Eventos históricos de items archivados SÍ aparecen en panel técnico
3. **DOM API Only**: Prohibido `innerHTML`, template literals con HTML
4. **Refetch tras Mutaciones**: Después de limpiar, refetch completo de megalist
5. **Seed Automático**: Antes de construir megalist, se ejecuta seed de estados "NUNCA"
6. **Nivel Efectivo**: Se usa nivel_efectivo del alumno (desde Level Engine)

## Endpoints Consumidos

- `GET /master/api/students?limit=200`
- `GET /master/api/alquimia-alumno/megalist?student_id=...&level_cap=...`
- `POST /master/api/alquimia-alumno/clean`
- `GET /master/api/alquimia-alumno/item-history?student_id=...&item_ref=...&limit=50`
- `GET /master/api/alquimia-alumno/report?student_id=...&days=30`

---

**Referencias**: 
- Handler: `src/endpoints/master-templo-luz-alquimia-alumno.js`
- Cliente JS: `public/js/master/master-alquimia-alumno-client.js`
- API: `src/endpoints/master-api-alquimia-alumno.js`
