# Alquimia UX Rules v1

**Versión**: 1.0.0  
**Fecha**: 2025-01-27  
**Scope**: MASTER  
**Estado**: CANÓNICO

## Reglas Fundamentales

### 1. Archivado = No Renderizable (Regla Absoluta)

**Regla**:
- Entidades con `status='archived'` NO aparecen en UI operativa
- NO se muestran en listados
- NO se muestran en selectores
- NO se permiten ediciones
- NO aparecen en megalist de alumno
- NO aparecen en panel humano del report/historial

**Excepción**:
- Panel técnico del report/historial SÍ puede mostrar eventos históricos de items archivados
- `cleaning_events` es append-only: la historia se preserva siempre

**Implementación**:
- Repositorios solo devuelven `status='active'` por defecto
- Endpoints GET devuelven 404 si entidad está archivada
- Endpoints PUT rechazan updates si entidad está archivada
- Servicios verifican `status='active'` antes de renderizar

### 2. DOM API Only (Regla Constitucional)

**Prohibido**:
- `innerHTML`
- Template literals con HTML en strings
- Concatenación de strings HTML
- `insertAdjacentHTML`

**Obligatorio**:
- `document.createElement()`
- `element.textContent` (no innerHTML)
- `element.classList.add()`
- `element.appendChild()`
- `element.dataset.*`

### 3. Estados Vacíos Deben Explicarse

**Prohibido**:
- Pantallas en blanco sin explicación
- Mensajes técnicos ("No data", "Empty array")
- Errores silenciosos

**Obligatorio**:
- Mensajes claros y humanos
- Explicación de por qué está vacío
- CTAs si aplica
- Íconos/visuales para contexto

**Ejemplos**:
- "No hay items con estado para este alumno. Esto puede significar que: el alumno no tiene items aplicables para su nivel, o los items aún no han sido materializados (seed automático)."
- "Selecciona un alumno para ver su Alquimia"

### 4. Refetch Tras Mutaciones

**Regla**:
- Después de cualquier POST/PUT que modifique datos → Refetch completo (GET)
- NUNCA asumir que "ya está" sin verificar con GET
- Re-renderizar desde datos frescos del backend

**Ejemplos**:
- Limpiar item → Refetch megalist completo
- Crear lista → Refetch listado de listas
- Editar item → Refetch items de la lista

### 5. Dos Paneles Obligatorios (Historial/Reporte)

**Estructura Canónica**:

**Panel Humano** (Visible por defecto):
- Nombres legibles (no refs técnicas)
- Clasificaciones resueltas (category/subcategory/tags)
- Agrupación por lista
- Fechas en formato legible
- Badges visuales

**Panel Técnico** (Colapsado por defecto):
- Datos raw (refs, execution_keys, metadata)
- Tablas técnicas
- Información para debugging
- Expandible pero oculto por defecto

**Implementación**:
- Header clicable para expandir/colapsar
- Indicador visual (▼/▲)
- Contenido oculto con `display: none` cuando colapsado

### 6. Seed Automático Antes de Megalist

**Regla**:
- Antes de construir megalist, ejecutar seed de estados "NUNCA"
- Seed es idempotente (no duplica si ya existe)
- Solo items aplicables (nivel <= nivel_efectivo)

**Implementación**:
- Seed se ejecuta en el endpoint `GET /master/api/alquimia-alumno/megalist`
- No requiere acción manual del usuario

### 7. Clasificaciones desde SOT Global

**Regla**:
- SIEMPRE usar `pde_classification_terms` + `transmutacion_lista_classifications`
- NO usar campos legacy (`category_key`, `subtype_key`, `tags` JSONB)

**Implementación**:
- Endpoints de clasificaciones consultan SOT global
- UI muestra clasificaciones desde SOT
- Legacy fields solo para advertencias (diagnóstico)

### 8. Nivel Efectivo desde Level Engine

**Regla**:
- El nivel efectivo del alumno viene del Level Engine
- NO calcular en UI
- NO usar `alumnos.nivel_actual` directamente

**Implementación**:
- Consultar `getStudentEffectiveLevel()` desde `cleaning-engine-service.js`
- Usar en filtros y validaciones
- Fallback a nivel 1 si no se puede calcular

## Estados y Transiciones

### Estados de Item en Megalist

- **never**: Nunca trabajado (colapsable, colapsado por defecto)
- **important**: Importante revisar (siempre visible, destacado)
- **pending**: Pendiente de limpieza (siempre visible)
- **reviewed**: Revisado (separado por actor: student/master)

### Estados de Limpieza

- **mark_clean**: Limpieza registrada (recurrentes)
- **increment**: Incremento de contador (una_vez)
- **adjust_remaining**: Ajuste manual de remaining

## Visual Guidelines

### Colores Canónicos

- **Nunca**: Gris (#94a3b8)
- **Importante**: Rojo (#fca5a5)
- **Pendiente**: Amarillo (#fde047)
- **Revisado**: Verde (#86efac)
- **Completado**: Verde (#86efac)

### Tipografía

- Headers: `font-weight: 600`
- Body: `font-size: 0.875rem`
- Small text: `font-size: 0.75rem`
- Monospace: Solo para datos técnicos

### Espaciado

- Padding estándar: `0.75rem`
- Gap entre elementos: `0.5rem` - `1rem`
- Margins de sección: `1rem` - `1.5rem`

---

**Referencias**:
- `docs/MASTER_ALQUIMIA_GENERAL_UI_V1.md`
- `docs/MASTER_ALQUIMIA_ALUMNO_UI_V1.md`
- `docs/CONSTITUTION_ALQUIMIA_AND_CLASSIFICATIONS_V1.md`
