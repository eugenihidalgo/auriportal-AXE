# DIAGNÓSTICO FUNCIONAL: Sistema de Limpiezas Energéticas y Transmutaciones

**Fecha**: 2024  
**Modo**: Diagnóstico funcional (sin cambios)  
**Objetivo**: Describir exhaustivamente la lógica funcional actual del sistema de limpiezas, tal como funciona HOY.

---

## ÍNDICE

1. [Acciones del Master](#1-acciones-del-master)
2. [Tipos de Limpieza](#2-tipos-de-limpieza)
3. [Reglas de Nivel y Visibilidad](#3-reglas-de-nivel-y-visibilidad)
4. [Estado vs Histórico](#4-estado-vs-histórico)
5. [Casos Especiales y Excepciones](#5-casos-especiales-y-excepciones)

---

## 1. ACCIONES DEL MASTER

### 1.1. Limpiar Aspecto Individual

**Endpoint**: `POST /admin/master/:alumnoId/marcar-limpio`  
**Handler**: `src/endpoints/limpieza-master.js::limpiarAspectoIndividual()`

**Inputs**:
- `aspecto_id` (número)
- `alumno_id` (número)
- `tipo_aspecto` (string): `'anatomia'`, `'karmicos'`, `'indeseables'`, `'limpieza_hogar'`

**Tablas que toca**:
- `aspectos_energeticos_alumnos` (si tipo = 'anatomia')
- `aspectos_karmicos_alumnos` (si tipo = 'karmicos')
- `aspectos_indeseables_alumnos` (si tipo = 'indeseables')
- `limpieza_hogar_alumnos` (si tipo = 'limpieza_hogar')
- `limpiezas_master_historial` (siempre, para registro)

**Columnas modificadas**:
- `ultima_limpieza` → `CURRENT_TIMESTAMP`
- `estado` → `'al_dia'` (si es regular) o `cantidad_completada` (si es una_vez)
- `veces_limpiado` → incrementa en 1
- `proxima_limpieza` → calcula según `frecuencia_dias` (solo regular)
- `completado_permanentemente` → `true` si alcanza `cantidad_requerida` (solo una_vez)

**Histórico**: SÍ. Registra en `limpiezas_master_historial` con:
- `alumno_id` = ID del alumno
- `tipo` = tipo_aspecto
- `aspecto_id` = ID del aspecto
- `aspecto_nombre` = nombre del aspecto
- `seccion` = nombre de la sección
- `fecha_limpieza` = timestamp actual

**Lógica**:
1. Obtiene información del aspecto (frecuencia_dias, tipo_limpieza, cantidad_minima)
2. Si `tipo_limpieza = 'regular'`:
   - Calcula `proxima_limpieza = ahora + frecuencia_dias`
   - Actualiza `ultima_limpieza`, `estado = 'al_dia'`, incrementa `veces_limpiado`
3. Si `tipo_limpieza = 'una_vez'`:
   - Incrementa `cantidad_completada`
   - Si `cantidad_completada >= cantidad_requerida` → `completado_permanentemente = true`
4. Registra en historial

---

### 1.2. Limpiar Aspecto Global (Todos los Suscriptores)

**Endpoint**: `POST /admin/master/limpiar-global`  
**Handler**: `src/endpoints/limpieza-master.js::limpiarAspectoGlobal()`

**Inputs**:
- `aspecto_id` (número)
- `tipo_aspecto` (string): `'anatomia'`, `'karmicos'`, `'indeseables'`, `'limpieza_hogar'`

**Tablas que toca**:
- Mismas tablas que individual, pero para TODOS los alumnos con `estado_suscripcion = 'activa'`
- `limpiezas_master_historial` (una sola entrada con `alumno_id = NULL`)

**Columnas modificadas**: Igual que individual, pero en bucle para todos los alumnos activos.

**Histórico**: SÍ. Una sola entrada en `limpiezas_master_historial` con:
- `alumno_id` = `NULL` (indica que es global)
- Resto de campos igual que individual

**Lógica**:
1. Obtiene todos los alumnos con `estado_suscripcion = 'activa'`
2. Para cada alumno, ejecuta la misma lógica que individual
3. Registra UNA SOLA entrada en historial (con `alumno_id = NULL`)

---

### 1.3. Limpiar desde Panel de Aspectos (Botón "Limpiar Todos")

**Endpoint**: `POST /admin/anatomia-energetica` (y similares)  
**Handler**: `src/services/aspectos-energeticos.js::marcarTodosAlumnosLimpiosPorAspecto()`

**Inputs**:
- `aspecto_id` (número)

**Tablas que toca**:
- `aspectos_energeticos_alumnos` (para todos los alumnos activos que pueden ver el aspecto)
- `limpiezas_master_historial` (una entrada con `alumno_id = NULL`)

**Filtros aplicados**:
- Solo alumnos con `estado_suscripcion = 'activa'`
- Solo alumnos con `nivel_actual >= nivel_minimo` del aspecto

**Histórico**: SÍ. Una entrada global.

---

### 1.4. Limpiar Lugar

**Endpoint**: `POST /admin/master/limpiar-lugar`  
**Handler**: `src/services/transmutaciones-lugares.js::marcarTodosAlumnosLimpiosPorLugar()`

**Inputs**:
- `lugar_id` (número)

**Tablas que toca**:
- `transmutaciones_lugares_estado`
- `limpiezas_master_historial`

**Filtros aplicados**:
- Solo alumnos con `estado_suscripcion = 'activa'`
- Solo alumnos con `nivel_actual >= nivel_minimo` del lugar
- Si el lugar tiene `alumno_id` asignado, solo ese alumno

**Histórico**: SÍ. Una entrada por alumno (no global).

---

### 1.5. Limpiar Proyecto

**Endpoint**: `POST /admin/master/limpiar-proyecto`  
**Handler**: `src/services/transmutaciones-proyectos.js::marcarTodosAlumnosLimpiosPorProyecto()`

**Inputs**:
- `proyecto_id` (número)

**Tablas que toca**:
- `transmutaciones_proyectos_estado`
- `limpiezas_master_historial`

**Filtros aplicados**: Igual que lugares.

**Histórico**: SÍ. Una entrada por alumno.

---

### 1.6. Limpiar Apadrinado

**Endpoint**: `POST /admin/master/limpiar-apadrinado`  
**Handler**: `src/services/transmutaciones-apadrinados.js::marcarTodosAlumnosLimpiosPorApadrinado()`

**Inputs**:
- `apadrinado_id` (número)

**Tablas que toca**:
- `transmutaciones_apadrinados_estado`
- `limpiezas_master_historial`

**Filtros aplicados**: Solo el padrino (alumno que tiene el apadrinado asignado).

**Histórico**: SÍ. Una entrada por alumno.

---

### 1.7. Limpiar Item de Transmutación (Lista)

**Endpoint**: `POST /admin/master/limpiar-item`  
**Handler**: `src/services/transmutaciones-energeticas.js::limpiarItemParaTodos()`

**Inputs**:
- `item_id` (número)

**Tablas que toca**:
- `items_transmutaciones_alumnos`

**Lógica**:
- Si la lista es `tipo = 'recurrente'` → actualiza `ultima_limpieza`
- Si la lista es `tipo = 'una_vez'` → incrementa `veces_completadas`

**Histórico**: NO. No se registra en `limpiezas_master_historial`.

---

## 2. TIPOS DE LIMPIEZA

### 2.1. Aspectos Energéticos (Anatomía Energética)

**Tabla principal**: `aspectos_energeticos`  
**Tabla de estado**: `aspectos_energeticos_alumnos`

**Características**:
- **Recurrente o finito**: Puede ser ambos según `tipo_limpieza`:
  - `'regular'` → Recurrente (cada X días)
  - `'una_vez'` → Finito (hasta completar cantidad)
- **Qué significa "limpio"**:
  - Regular: `estado = 'al_dia'` Y `dias_desde_limpieza <= frecuencia_dias`
  - Una vez: `completado_permanentemente = true` O `cantidad_completada >= cantidad_requerida`
- **Cómo vuelve a estar pendiente**:
  - Regular: Cuando `dias_desde_limpieza > frecuencia_dias` → `estado = 'pendiente'` o `'muy_pendiente'`
  - Una vez: Nunca vuelve (es permanente una vez completado)
- **Quién puede marcarlo**: Master (individual o global) o Alumno (desde portal)

**Estados posibles**:
- `'pendiente'` → Nunca limpiado o pasado de fecha
- `'muy_pendiente'` → Pasado más del doble de frecuencia_dias
- `'al_dia'` → Limpio y dentro de frecuencia_dias

**Cálculo de estado** (en `getAspectosAlumno()`):
```sql
estado = CASE
  WHEN ultima_limpieza IS NULL THEN 'pendiente'
  WHEN CURRENT_TIMESTAMP <= (ultima_limpieza + INTERVAL '1 day' * frecuencia_dias) THEN 'al_dia'
  WHEN CURRENT_TIMESTAMP <= (ultima_limpieza + INTERVAL '1 day' * frecuencia_dias * 2) THEN 'pendiente'
  ELSE 'muy_pendiente'
END
```

---

### 2.2. Aspectos Kármicos

**Tabla principal**: `aspectos_karmicos`  
**Tabla de estado**: `aspectos_karmicos_alumnos`

**Características**:
- **Recurrente o finito**: SIEMPRE recurrente (no tiene `tipo_limpieza`)
- **Qué significa "limpio"**: `estado = 'al_dia'` Y `dias_desde_limpieza <= frecuencia_dias`
- **Cómo vuelve a estar pendiente**: Igual que aspectos energéticos regulares
- **Quién puede marcarlo**: Solo Master (individual o global)

**Estados posibles**: Igual que aspectos energéticos regulares.

---

### 2.3. Energías Indeseables

**Tabla principal**: `aspectos_indeseables`  
**Tabla de estado**: `aspectos_indeseables_alumnos`

**Características**:
- **Recurrente o finito**: SIEMPRE recurrente
- **Qué significa "limpio"**: Igual que aspectos kármicos
- **Cómo vuelve a estar pendiente**: Igual que aspectos energéticos regulares
- **Quién puede marcarlo**: Solo Master (individual o global)

**Estados posibles**: Igual que aspectos energéticos regulares.

---

### 2.4. Items de Transmutación (Listas)

**Tabla principal**: `items_transmutaciones`  
**Tabla de estado**: `items_transmutaciones_alumnos`  
**Tabla de listas**: `listas_transmutaciones`

**Características**:
- **Recurrente o finito**: Depende del `tipo` de la lista:
  - `'recurrente'` → Recurrente (cada `frecuencia_dias`)
  - `'una_vez'` → Finito (hasta completar `veces_limpiar`)
- **Qué significa "limpio"**:
  - Recurrente: `dias_desde_limpieza <= frecuencia_dias`
  - Una vez: `veces_completadas >= veces_limpiar`
- **Cómo vuelve a estar pendiente**:
  - Recurrente: Cuando `dias_desde_limpieza > frecuencia_dias`
  - Una vez: Nunca vuelve (es permanente)
- **Quién puede marcarlo**: Master (individual o global) o Alumno (desde portal)

**Estados calculados** (función `calcularEstado()`):
- `'limpio'` → Dentro de frecuencia
- `'pendiente'` → Últimos 7 días antes de vencer (solo recurrente)
- `'pasado'` → Pasado de fecha o nunca limpiado

**Cálculo**:
```javascript
// Recurrente
if (diasDesdeLimpieza <= frecuencia) return 'limpio';
if (diasDesdeLimpieza <= frecuencia + 7) return 'pendiente';
return 'pasado';

// Una vez
if (veces_completadas >= veces_limpiar) return 'limpio';
return 'pasado';
```

---

### 2.5. Limpieza de Hogar

**Tabla principal**: `limpieza_hogar`  
**Tabla de estado**: `limpieza_hogar_alumnos`

**Características**:
- **Recurrente o finito**: SIEMPRE recurrente
- **Qué significa "limpio"**: Igual que aspectos energéticos regulares
- **Cómo vuelve a estar pendiente**: Igual que aspectos energéticos regulares
- **Quién puede marcarlo**: Solo Master (individual o global)

**Estados posibles**: Igual que aspectos energéticos regulares.

---

### 2.6. Lugares

**Tabla principal**: `transmutaciones_lugares`  
**Tabla de estado**: `transmutaciones_lugares_estado`

**Características**:
- **Recurrente o finito**: SIEMPRE recurrente
- **Qué significa "limpio"**: `dias_desde_limpieza <= frecuencia_dias`
- **Cómo vuelve a estar pendiente**: Cuando `dias_desde_limpieza > frecuencia_dias`
- **Quién puede marcarlo**: Solo Master (individual o global)

**Estados calculados**:
- `'limpio'` → `dias <= frecuencia_dias`
- `'pendiente'` → `dias <= frecuencia_dias + 15`
- `'olvidado'` → `dias > frecuencia_dias + 15`

**Especial**: Puede tener `alumno_id` asignado (lugar personal del alumno).

---

### 2.7. Proyectos

**Tabla principal**: `transmutaciones_proyectos`  
**Tabla de estado**: `transmutaciones_proyectos_estado`

**Características**: Igual que lugares.

**Especial**: Puede tener `alumno_id` asignado (proyecto personal del alumno).

---

### 2.8. Apadrinados

**Tabla principal**: `transmutaciones_apadrinados`  
**Tabla de estado**: `transmutaciones_apadrinados_estado`

**Características**: Igual que lugares.

**Especial**: SIEMPRE tiene `alumno_id` asignado (el padrino). Solo ese alumno puede verlo.

---

## 3. REGLAS DE NIVEL Y VISIBILIDAD

### 3.1. Filtro por Nivel Mínimo

**Dónde se aplica**:
- Al obtener aspectos para limpieza del alumno
- Al limpiar globalmente (solo alumnos con nivel suficiente)

**Tablas con `nivel_minimo`**:
- `aspectos_energeticos.nivel_minimo`
- `aspectos_karmicos.nivel_minimo`
- `aspectos_indeseables.nivel_minimo`
- `transmutaciones_lugares.nivel_minimo`
- `transmutaciones_proyectos.nivel_minimo`
- `transmutaciones_apadrinados.nivel_minimo`
- `items_transmutaciones.nivel` (no `nivel_minimo`, pero mismo concepto)

**Regla**:
```sql
WHERE nivel_minimo <= nivel_actual_del_alumno
```

**Valor por defecto**: `1` (si `nivel_minimo` es NULL, se considera 1)

---

### 3.2. ¿El Nivel Bloquea Limpiar o Solo Ver?

**Respuesta**: Solo bloquea VER (no limpiar).

**Explicación**:
- Si el Master limpia un aspecto para un alumno específico, NO se verifica nivel
- Si el Master limpia globalmente, SÍ se filtra por nivel (solo alumnos con nivel suficiente)
- El alumno NO puede ver aspectos de nivel superior al suyo
- El alumno NO puede limpiar aspectos que no ve (porque no aparecen en su lista)

**Código de referencia**:
- `src/modules/limpieza.js::obtenerAspectosParaLimpieza()` → Filtra por nivel al obtener aspectos
- `src/endpoints/limpieza-master.js::limpiarAspectoIndividual()` → NO verifica nivel (Master puede limpiar cualquier aspecto)
- `src/endpoints/limpieza-master.js::limpiarAspectoGlobal()` → SÍ filtra por nivel

---

### 3.3. Excepciones desde el Master

**Sí, existen excepciones**:
1. El Master puede limpiar aspectos individualmente SIN verificar nivel
2. El Master puede limpiar aspectos globalmente, pero solo afecta a alumnos con nivel suficiente
3. El Master puede ver TODOS los aspectos en el panel admin, independientemente del nivel

---

## 4. ESTADO VS HISTÓRICO

### 4.1. ¿Existe Histórico Real?

**SÍ**, existe la tabla `limpiezas_master_historial`.

**Estructura**:
```sql
CREATE TABLE limpiezas_master_historial (
  id SERIAL PRIMARY KEY,
  alumno_id INT,  -- NULL si es global
  tipo VARCHAR(50) NOT NULL,  -- 'anatomia', 'karmicos', 'indeseables', etc.
  aspecto_id INT NOT NULL,
  aspecto_nombre VARCHAR(500),
  seccion VARCHAR(100),
  fecha_limpieza TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

**Cuándo se registra**:
- Cuando el Master limpia individualmente → Una entrada por alumno
- Cuando el Master limpia globalmente → Una entrada con `alumno_id = NULL`
- Cuando el alumno se limpia a sí mismo → NO se registra (solo Master)

---

### 4.2. ¿Se Pisa el Estado Anterior?

**SÍ**, el estado se PISA (no se mantiene histórico en la tabla de estado).

**Explicación**:
- La tabla de estado (ej: `aspectos_energeticos_alumnos`) solo guarda el ESTADO ACTUAL
- Cada limpieza SOBRESCRIBE `ultima_limpieza` y `estado`
- El histórico está en `limpiezas_master_historial` (solo limpiezas del Master)

**Ejemplo**:
1. Alumno limpia aspecto el día 1 → `ultima_limpieza = '2024-01-01'`, `estado = 'al_dia'`
2. Alumno limpia aspecto el día 15 → `ultima_limpieza = '2024-01-15'`, `estado = 'al_dia'` (se pisó el anterior)
3. Histórico: Solo tiene entrada si el Master limpió (no si el alumno se limpió a sí mismo)

---

### 4.3. ¿Se Puede Saber Cuántas Veces se Limpió?

**SÍ**, pero solo para limpiezas del Master.

**Campos disponibles**:
- `veces_limpiado` → Contador en tabla de estado (solo se incrementa cuando Master limpia)
- `limpiezas_master_historial` → Puede contar entradas por `alumno_id` + `aspecto_id`

**Limitación**:
- Si el alumno se limpia a sí mismo, NO se incrementa `veces_limpiado`
- Si el alumno se limpia a sí mismo, NO se registra en histórico

**Código de referencia**:
```javascript
// En limpiarAspectoIndividual()
veces_limpiado = aspectos_energeticos_alumnos.veces_limpiado + 1
```

---

### 4.4. ¿Se Puede Reconstruir una Línea Temporal?

**PARCIALMENTE**, solo para limpiezas del Master.

**Datos disponibles**:
- `limpiezas_master_historial.fecha_limpieza` → Fechas de limpiezas del Master
- `aspectos_energeticos_alumnos.ultima_limpieza` → Última limpieza (cualquiera que la haya hecho)

**Limitación**:
- No se puede reconstruir línea temporal completa si el alumno se limpia a sí mismo
- Solo se puede ver cuándo el Master limpió (no cuándo el alumno se limpió)

---

## 5. CASOS ESPECIALES Y EXCEPCIONES

### 5.1. Limpiezas que Afectan a Varios Alumnos

**Tipos**:
1. **Limpieza global** → Afecta a TODOS los suscriptores activos con nivel suficiente
2. **Limpieza de lugar/proyecto sin `alumno_id`** → Afecta a todos los alumnos que pueden verlo
3. **Limpieza de item de transmutación** → Afecta a todos los suscriptores activos

**Registro en histórico**:
- Global → Una entrada con `alumno_id = NULL`
- Por lugar/proyecto → Una entrada por cada alumno afectado

---

### 5.2. Limpiezas que Afectan a un Solo Alumno

**Tipos**:
1. **Limpieza individual** → Solo el alumno especificado
2. **Limpieza de lugar/proyecto con `alumno_id`** → Solo ese alumno
3. **Limpieza de apadrinado** → Solo el padrino (alumno que tiene el apadrinado)

**Registro en histórico**: Una entrada por alumno.

---

### 5.3. Limpiezas que No Dependen del Alumno

**NO EXISTEN**. Todas las limpiezas dependen del alumno (están en tablas `*_alumnos` o `*_estado`).

**Excepción conceptual**: Los aspectos globales (tabla `aspectos_energeticos`) no dependen del alumno, pero el ESTADO sí (tabla `aspectos_energeticos_alumnos`).

---

### 5.4. Inconsistencias entre Tipos

**Inconsistencia 1: Items de Transmutación no registran en histórico**
- Los items de transmutación NO se registran en `limpiezas_master_historial`
- Todos los demás tipos SÍ se registran

**Inconsistencia 2: Alumno limpiándose a sí mismo no registra en histórico**
- Si el alumno se limpia desde el portal, NO se registra en `limpiezas_master_historial`
- Solo las limpiezas del Master se registran

**Inconsistencia 3: Items de transmutación usan `nivel` en vez de `nivel_minimo`**
- Todos los demás tipos usan `nivel_minimo`
- Items de transmutación usan `nivel` (mismo concepto, nombre diferente)

**Inconsistencia 4: Cálculo de estado diferente para lugares/proyectos**
- Aspectos energéticos/kármicos/indeseables: `'al_dia'`, `'pendiente'`, `'muy_pendiente'`
- Lugares/proyectos: `'limpio'`, `'pendiente'`, `'olvidado'`
- Items de transmutación: `'limpio'`, `'pendiente'`, `'pasado'`

---

## RESUMEN EJECUTIVO

### Acciones del Master
1. Limpiar aspecto individual → Una entrada en histórico por alumno
2. Limpiar aspecto global → Una entrada en histórico con `alumno_id = NULL`
3. Limpiar lugar/proyecto/apadrinado → Una entrada por alumno afectado
4. Limpiar item de transmutación → NO registra en histórico

### Tipos de Limpieza
- **Recurrentes**: Aspectos energéticos (regular), kármicos, indeseables, hogar, lugares, proyectos, apadrinados, items (recurrente)
- **Finitos**: Aspectos energéticos (una_vez), items (una_vez)

### Reglas de Nivel
- El nivel SOLO bloquea VER (no limpiar)
- El Master puede limpiar cualquier aspecto sin verificar nivel
- El alumno solo ve aspectos de su nivel o inferior

### Estado vs Histórico
- Estado: Se PISA en cada limpieza (solo estado actual)
- Histórico: Solo limpiezas del Master (no del alumno)
- Contador: `veces_limpiado` solo se incrementa cuando Master limpia

### Casos Especiales
- Limpiezas globales → Una entrada con `alumno_id = NULL`
- Items de transmutación → NO registran en histórico
- Alumno limpiándose → NO registra en histórico

---

**FIN DEL DOCUMENTO**










