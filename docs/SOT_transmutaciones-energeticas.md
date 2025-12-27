# Source of Truth: Transmutaciones Energéticas PDE

**Ruta Admin:** `/admin/pde/transmutaciones-energeticas`  
**Fecha de Certificación:** 2025-01-XX  
**Estado:** ✅ **ACTIVO EN PRODUCCIÓN** (Fase 1 completada)

---

## ✅ Estado de Activación

**ACTIVO:** Esta pantalla está completamente operativa y accesible en producción.

- ✅ Bloqueo legacy eliminado
- ✅ Handler moderno activo
- ✅ UI renderiza contenido real desde PostgreSQL
- ✅ Operaciones Master implementadas
- ✅ Sin dependencias de legacy o rutas externas

---

## 📋 Ontología

### Tablas Principales

#### `listas_transmutaciones`
Source of Truth para listas de transmutaciones energéticas.

**Campos clave:**
- `id` (INTEGER PRIMARY KEY)
- `nombre` (VARCHAR) - Nombre de la lista
- `tipo` (VARCHAR) - 'recurrente' o 'una_vez'
- `descripcion` (TEXT) - Descripción opcional
- `orden` (INTEGER) - Orden de visualización
- `status` (VARCHAR) - 'active' | 'archived' (canónico)
- `created_at` (TIMESTAMPTZ) - Fecha de creación
- `updated_at` (TIMESTAMPTZ) - Fecha de actualización (trigger)
- `category_key` (TEXT) - Clave de categoría opcional
- `subtype_key` (TEXT) - Clave de subtipo opcional
- `tags` (JSONB) - Array de tag_keys opcional

#### `items_transmutaciones`
Source of Truth para items individuales de transmutación.

**Campos clave:**
- `id` (INTEGER PRIMARY KEY)
- `lista_id` (INTEGER) - FK a listas_transmutaciones
- `nombre` (VARCHAR) - Nombre del item
- `descripcion` (TEXT) - Descripción opcional
- `nivel` (INTEGER) - Nivel del item (OBLIGATORIO para orden)
- `frecuencia_dias` (INTEGER) - Para items recurrentes
- `veces_limpiar` (INTEGER) - Para items una_vez
- `prioridad` (VARCHAR) - Prioridad opcional
- `status` (VARCHAR) - 'active' | 'archived' (canónico)
- `created_at` (TIMESTAMPTZ) - Fecha de creación
- `updated_at` (TIMESTAMPTZ) - Fecha de actualización (trigger)

**LEY ABSOLUTA DE ORDEN:**
```sql
ORDER BY nivel ASC
```
❌ PROHIBIDO ordenar por nombre  
❌ PROHIBIDO reordenar automáticamente por criterios estéticos  
❌ PROHIBIDO ordenar por created_at

**Motivo:**
- El nivel define el orden semántico
- El Master controla el orden mediante el nivel

#### `student_te_recurrent_state`
Estado de alumnos para items recurrentes.

**Campos clave:**
- `id` (UUID PRIMARY KEY)
- `student_email` (TEXT) - Email del alumno
- `item_id` (INTEGER) - FK a items_transmutaciones
- `last_cleaned_at` (TIMESTAMPTZ) - Última limpieza
- `days_since_last_clean` (INTEGER) - Días desde última limpieza
- `is_clean` (BOOLEAN) - Si está limpio actualmente
- `is_critical` (BOOLEAN) - Si requiere atención urgente
- `notes` (TEXT) - Notas opcionales
- `status` (VARCHAR) - 'active' | 'archived'
- `created_at`, `updated_at` (TIMESTAMPTZ)

**Constraints:**
- UNIQUE(student_email, item_id)

#### `student_te_one_time_state`
Estado de alumnos para items una_vez.

**Campos clave:**
- `id` (UUID PRIMARY KEY)
- `student_email` (TEXT) - Email del alumno
- `item_id` (INTEGER) - FK a items_transmutaciones
- `remaining` (INTEGER) - Número de limpiezas restantes
- `completed` (INTEGER) - Número de limpiezas completadas
- `is_complete` (BOOLEAN) - Si ha completado todas las limpiezas
- `notes` (TEXT) - Notas opcionales
- `status` (VARCHAR) - 'active' | 'archived'
- `created_at`, `updated_at` (TIMESTAMPTZ)

**Constraints:**
- UNIQUE(student_email, item_id)

---

## 🎯 Dominio Funcional

### Categorías

Categorías iniciales:
- `recurrente` - Limpiezas recurrentes (periódicas)
- `una_vez` - Limpiezas de una sola vez

Cada categoría puede tener infinitas listas.

### Listas

Cada lista tiene:
- `nombre` (title)
- `descripcion` (description)
- `classification_keys` (configurables, plegadas)
- `items` (ordenados por nivel ASC, created_at ASC)

### Items

Cada item tiene:
- `nivel` (level) - Persistente al crear en serie
- `nombre` (name)
- `descripcion` (description)

**Items recurrentes:**
- `frecuencia_dias` (days_clean) - Frecuencia en días

**Items una_vez:**
- `veces_limpiar` (one_time_total) - Total de veces a limpiar

---

## 🖥️ UI - Navegación Obligatoria

### Estructura de UI (OBLIGATORIA)

1. **Filtro de tipo (tabs superiores)**
   - Recurrentes / Una Sola Vez
   - Cambiar de tipo carga listas de ese tipo

2. **Tabs de LISTAS (horizontal, compactos)**
   - Cada tab = una lista
   - Navegación instantánea sin recargar
   - Botón ❌ para eliminar lista (soft delete)
   - Click en tab → muestra contenido debajo

3. **Contenido de lista seleccionada**
   - Header con nombre, descripción
   - Clasificaciones plegables (category_key, subtype_key, tags)
   - Editor inline de lista (botón ⚙️)
   - Línea rápida de creación de items (arriba)
   - Lista de items (ordenados por nivel ASC)
   - Items editables inline (todos los campos)

**Motivo:** Velocidad de trabajo del Master. Navegación sin fricción.

---

## ⚡ Creación de Ítems - UX Obligatoria

### Fila "Nuevo ítem" (SIEMPRE visible)

**Campos:**
- `nivel` (number)
- `nombre`
- `descripcion` (opcional)
- `frecuencia_dias` / `veces_limpiar` (según tipo)

**Pulsar ENTER:**
- ✅ Crea el ítem
- ❌ NO muestra modal
- ❌ NO pide confirmación

**Valor de level:**
- Se mantiene en memoria local por lista
- Se reutiliza automáticamente para el siguiente ítem

**Tras crear:**
- La lista se re-renderiza
- El orden se mantiene por `nivel ASC, created_at ASC`

---

## 🔧 Operaciones Master (Obligatorias)

### Recurrentes

**Por ítem:**
- **"Marcar limpio para todos"** - Marca limpio todos los alumnos
- **"Ver alumnos"** - Muestra 3 grupos:
  - ✅ Limpio
  - ⏳ Pendiente
  - 🚨 Crítico
  
  Cada alumno tiene botón: **"Marcar limpio"**

### Una Sola Vez

**Por ítem:**
- **"Limpieza +1 para todos"** - `remaining = max(remaining - 1, 0)`
  - Conserva progreso individual
- **"Ver alumnos"** - Muestra:
  - `remaining` por alumno
  - Permite ajustar `remaining` manualmente

---

## 🏗️ Implementación Técnica

### Base de Datos

**Tablas:**
- ✅ `listas_transmutaciones` - Con status canónico
- ✅ `items_transmutaciones` - Con status canónico
- ✅ `student_te_recurrent_state` - Estado de alumnos recurrentes
- ✅ `student_te_one_time_state` - Estado de alumnos una_vez

**Migraciones:**
- `v5.34.0-transmutaciones-energeticas-sot-canonical.sql` - Alineación a patrón canónico
- `v5.35.0-transmutaciones-energeticas-student-state.sql` - Tablas de estado de alumnos

**Características:**
- Status canónico: 'active' | 'archived'
- Soft delete: NO DELETE físico
- Auditoría: created_at / updated_at con triggers
- Constraints: CHECK status, UNIQUE keys

### Repos + Services

**Repositorios:**
- `src/core/repos/pde-transmutaciones-energeticas-repo.js` - Contrato
- `src/infra/repos/pde-transmutaciones-energeticas-repo-pg.js` - Implementación PostgreSQL

**Services:**
- `src/services/pde-transmutaciones-energeticas-service.js` - Lógica de negocio

**Operaciones Master:**
- `getRecurrentStateForItem(itemId)` - Estado con 3 grupos
- `markCleanForAllRecurrent(itemId)` - Marcar limpio todos
- `markCleanForStudentRecurrent(itemId, studentEmail)` - Marcar limpio individual
- `getOneTimeStateForItem(itemId)` - Estado una_vez
- `incrementCleanForAllOneTime(itemId)` - Incrementar +1 todos
- `adjustRemainingForStudent(itemId, studentEmail, newRemaining)` - Ajustar remaining

### UI

**Template:**
- `src/core/html/admin/transmutaciones-energeticas/transmutaciones-list.html`

**Características:**
- ✅ Usa `renderAdminPage()`
- ✅ Sidebar visible
- ✅ JS seguro:
  - fetch + JSON
  - DOM API
  - Sin onclick inline
  - Sin template strings frágiles
  - HTML escaping con `escapeHtml()` y `escapeAttr()`

**Estado local mínimo:**
- Lista seleccionada
- Último level usado (por lista_id)
- Categoría activa

**Endpoint:**
- `src/endpoints/admin-transmutaciones-energeticas.js`
- Rutas canónicas: `/admin/pde/transmutaciones-energeticas`
- API endpoints bajo `/admin/pde/transmutaciones-energeticas/api/...`

---

## 🔍 Assembly Check System (ACS)

**Estado:** Pendiente de verificación

**Requisitos:**
- ✅ Sidebar detectado
- ✅ HTML no vacío
- ✅ Sin placeholders
- ✅ Sin redirecciones legacy
- ⏳ Verificación manual requerida (requiere autenticación)

**Comando para verificar:**
```bash
# Desde navegador autenticado:
POST /admin/api/assembly/initialize
POST /admin/api/assembly/run
```

**Resultado esperado:**
- Estado: `OK`
- Sin warnings críticos

---

## 📚 Reglas Maestras

### Reglas de Orden

**LEY ABSOLUTA:**
```sql
ORDER BY nivel ASC, created_at ASC
```

**Prohibido:**
- ❌ Ordenar por nombre
- ❌ Reordenar automáticamente por criterios estéticos
- ❌ Cambiar el orden semántico

### Reglas de Operaciones Master

**Recurrentes:**
- Marcar limpio actualiza `last_cleaned_at` y `days_since_last_clean = 0`
- Clasificación automática: limpio, pendiente, crítico (basado en `frecuencia_dias`)

**Una Vez:**
- Incrementar +1: `remaining = max(remaining - 1, 0)`
- Conserva progreso individual
- Ajuste manual permite valores personalizados

### Reglas de Auditoría

- Todas las operaciones Master deben ser auditables
- Source debe ser 'master' en logs
- Timestamps automáticos vía triggers

---

## 🔄 Flujo de Trabajo del Master

1. **Seleccionar categoría** (tab: recurrente / una_vez)
2. **Ver todas las listas** de esa categoría
3. **Click en lista** → Editor se despliega debajo
4. **Crear ítems rápidamente:**
   - Nivel (se mantiene automáticamente)
   - Nombre (Enter para crear)
   - Campo específico (frecuencia_dias o veces_limpiar)
5. **Operaciones Master:**
   - Ver alumnos (3 grupos o lista completa)
   - Marcar limpio (todos o individual)
   - Incrementar +1 (una_vez)
   - Ajustar remaining (una_vez)

**Sin modales innecesarios. Sin navegación compleja. Máxima velocidad.**

---

## 📝 Decisiones Técnicas

### Orden de Ítems

**Decisión:** `ORDER BY nivel ASC, created_at ASC`

**Razón:**
- El nivel define el orden semántico (importancia/progresión)
- El orden de creación dentro del nivel preserva el contexto temporal
- Permite al Master controlar el orden estableciendo el nivel

### Estado de Alumnos

**Decisión:** Tablas separadas para recurrentes y una_vez

**Razón:**
- Modelos de datos diferentes (días vs. remaining)
- Operaciones diferentes
- Consultas optimizadas por tipo

### Creación Rápida

**Decisión:** Fila siempre visible, Enter crea, sin modal

**Razón:**
- Velocidad de operación
- Flujo continuo sin interrupciones
- Reutilización automática del nivel

---

## ✅ Checklist de Certificación

- [x] Migración SQL aplicada y verificada
- [x] Repos y services implementados
- [x] UI completa implementada
- [x] Operaciones Master implementadas
- [x] JavaScript seguro (sin onclick inline)
- [x] HTML escaping correcto
- [x] Orden canónico respetado (nivel ASC, created_at ASC)
- [x] Soft delete vía status='archived'
- [x] Auditoría con created_at/updated_at
- [ ] Assembly Check = OK (verificación manual requerida)
- [x] Documentación completa

---

## 🔗 Referencias

- **Patrón canónico:** `docs/SOT_catalog-registry.md`
- **Migración BD:** `database/migrations/v5.34.0-transmutaciones-energeticas-sot-canonical.sql`
- **Migración estado alumnos:** `database/migrations/v5.35.0-transmutaciones-energeticas-student-state.sql`
- **Repo:** `src/infra/repos/pde-transmutaciones-energeticas-repo-pg.js`
- **Service:** `src/services/pde-transmutaciones-energeticas-service.js`
- **Endpoint:** `src/endpoints/admin-transmutaciones-energeticas.js`
- **Template:** `src/core/html/admin/transmutaciones-energeticas/transmutaciones-list.html`

---

**Última actualización:** 2025-01-XX  
**Versión:** v1.0 (Canónico)

