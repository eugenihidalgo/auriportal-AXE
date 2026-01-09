# Master Alquimia General UI v1

**Versión**: 1.0.0  
**Fecha**: 2025-01-27  
**Scope**: MASTER  
**Estado**: CANÓNICO

## Propósito

UI canónica para la gestión del catálogo de Alquimia (listas e items de transmutaciones).

**URL**: `/master/templo-luz/alquimia-general`

## Componentes Principales

### 1. Tabs de Tipo (Superiores)

- **Recurrentes**: Listas que requieren limpieza periódica (cada X días)
- **Una vez**: Listas que requieren limpieza un número fijo de veces

Al cambiar de tab, se recargan las listas correspondientes.

### 2. Tabs de Listas (Navegación Horizontal)

- Muestra todas las listas activas del tipo seleccionado
- Al hacer clic en una lista, se muestra su contenido completo
- Botón "➕ Nueva Lista" para crear nuevas listas

**REGLA CANÓNICA**: Solo se muestran listas con `status='active'`. Listas archivadas no aparecen.

### 3. Contenido de Lista

#### Header de Lista

- Título de la lista
- Botón "⚙ Configurar lista" (abre modal de edición)

#### Clasificación

- **Categoría**: Una categoría por lista (desde SOT global)
- **Subclasificación**: Una subclasificación por lista (desde SOT global)
- **Tags**: Múltiples tags por lista (desde SOT global)

**REGLA CANÓNICA**: Las clasificaciones se gestionan desde `pde_classification_terms` y `transmutacion_lista_classifications`. NO se usan campos legacy (`category_key`, `subtype_key`, `tags` JSONB).

#### Tabla de Items

**Fila Sticky de Creación**:
- Permite crear items inline (Enter-to-create)
- Mantiene nivel/grupo/frecuencia_dias entre creaciones (sticky)

**Filas de Items Existentes**:
- **NIVEL**: Número del 1 al 9 (editable inline, autosave)
- **NOMBRE**: Nombre del item (editable inline, autosave)
- **DESCRIPCIÓN**: Descripción del item (editable inline, autosave)
- **GRUPO**: Grupo opcional (editable inline, autosave)
- **DÍAS RECURRENCIA** (solo recurrentes): Frecuencia en días (editable inline, autosave)
- **VECES LIMPIAR** (solo una_vez): Número de veces requeridas (editable inline, autosave)
- **ACCIONES**:
  - **VER**: Abre modal con estudiantes por estado
  - **🟢 Limpiar** (solo recurrentes): Limpieza global SHARED para todos los alumnos
  - **PDE** (solo recurrentes): Registro PDE de hoy para todos los alumnos
  - **+1** (solo una_vez): Incrementar +1 para todos los alumnos (SHARED)
  - **PDE** (solo una_vez): Registro PDE de incremento
  - **🗑**: Archivar item (soft delete, `status='archived'`)

**Ordenamiento**:
- Clic en header de columna: establecer como prioridad 1
- Shift+Clic: añadir como siguiente prioridad
- Pipeline de ordenamiento se guarda en localStorage por lista

**REGLA CANÓNICA**: Solo se muestran items con `status='active'`. Items archivados no aparecen.

### 4. Panel de Diagnóstico

**Ubicación**: Parte inferior de la página

**Contenido**:

1. **Items sin item_ref**: Debe ser 0 (crítico)
2. **Items sin lista_id**: Debe ser 0 (crítico)
3. **Listas sin items**: Permitido (informativo)
4. **Listas sin clasificaciones**: Permitido (informativo)
5. **Campos legacy poblados**: Advertencia si hay campos deprecated poblados

**REGLA**: Panel NO bloqueante, solo informativo.

## Estados Vacíos

### Sin Listas

**Mensaje**: "No hay listas todavía"  
**CTA**: "Usa el botón '➕ Nueva Lista' para crear una"

### Lista Sin Items

**Mensaje**: "Esta lista no tiene items todavía"  
**Acción**: Usar fila sticky de creación para añadir items

### Sin Datos en Diagnóstico

**Estado**: Panel muestra todos los checks en verde (✅)

## Reglas Canónicas

1. **Archivado = No Renderizable**: Items/listas con `status='archived'` NO aparecen en la UI
2. **DOM API Only**: Prohibido `innerHTML`, template literals con HTML
3. **Autosave**: Cambios en items se guardan automáticamente tras 800ms de inactividad
4. **Clasificaciones desde SOT**: Siempre usar `pde_classification_terms` + `transmutacion_lista_classifications`
5. **Refetch tras Mutaciones**: Después de crear/editar/archivar, refetch completo

## Endpoints Consumidos

- `GET /master/api/alquimia-general/listas?tipo=...`
- `GET /master/api/alquimia-general/listas/:id`
- `GET /master/api/alquimia-general/listas/:id/items`
- `POST /master/api/alquimia-general/listas`
- `PUT /master/api/alquimia-general/listas/:id`
- `PUT /master/api/alquimia-general/listas/:id/classification`
- `POST /master/api/alquimia-general/items`
- `PUT /master/api/alquimia-general/items/:id`
- `DELETE /master/api/alquimia-general/items/:id`
- `GET /master/api/alquimia-general/items/:item_ref/students?clean_layer=...`
- `POST /master/api/alquimia-general/items/:item_ref/master/mark-clean-all`
- `POST /master/api/alquimia-general/items/:item_ref/master/mark-pde-clean-all`
- `POST /master/api/alquimia-general/items/:item_ref/master/increment-all`
- `GET /master/api/alquimia-general/diagnostics`

---

**Referencias**: 
- Handler: `src/endpoints/master-templo-luz-alquimia-general.js`
- Cliente JS: `public/js/master/master-alquimia-general-client.js`
- API: `src/endpoints/master-api-alquimia-general.js`
