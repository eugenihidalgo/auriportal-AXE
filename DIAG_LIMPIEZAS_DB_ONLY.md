# Diagnóstico DB-ONLY: Limpiezas Energéticas / Transmutaciones / Aspectos

**Fecha**: 2025-12-15T20:06:13.399Z
**Modo**: Solo lectura (SELECT, information_schema)
**Escrituras**: PROHIBIDAS

---

## 1. Inventario de Tablas Relevantes

| Tabla | Filas (aprox) | Comentario |
|-------|---------------|------------|
| `alumnos_lugares` | 4 | Tabla de lugares/espacios |
| `alumnos_proyectos` | 6 | Tabla de proyectos |
| `aspectos_energeticos` | 68 | Tabla de aspectos energéticos |
| `aspectos_energeticos_alumnos` | 4 | Tabla de aspectos energéticos |
| `aspectos_energeticos_registros` | 0 | Tabla de aspectos energéticos |
| `aspectos_indeseables` | 4 | Tabla de aspectos energéticos |
| `aspectos_indeseables_alumnos` | 15 | Tabla de aspectos energéticos |
| `aspectos_karmicos` | 2 | Tabla de aspectos energéticos |
| `aspectos_karmicos_alumnos` | 0 | Tabla de aspectos energéticos |
| `aspectos_practica` | 3 | Tabla de aspectos energéticos |
| `items_transmutaciones` | 53 |  |
| `items_transmutaciones_alumnos` | 74 |  |
| `limpieza_hogar` | 6 | Tabla de limpiezas |
| `limpieza_hogar_alumnos` | 0 | Tabla de limpiezas |
| `limpiezas_master_historial` | 25 | Tabla de limpiezas |
| `listas_transmutaciones` | 9 |  |
| `secciones_limpieza` | 8 | Tabla de limpiezas |
| `tecnicas_limpieza` | 4 | Tabla de limpiezas |
| `transmutaciones_apadrinados` | 29 |  |
| `transmutaciones_apadrinados_estado` | 1 |  |
| `transmutaciones_lugares` | 1 | Tabla de lugares/espacios |
| `transmutaciones_lugares_estado` | 0 | Tabla de lugares/espacios |
| `transmutaciones_proyectos` | 2 | Tabla de proyectos |
| `transmutaciones_proyectos_estado` | 0 | Tabla de proyectos |

**Total de tablas encontradas**: 24

---

## 2. Estructura Detallada de Cada Tabla

### Tabla: `alumnos_lugares`

#### Columnas

| Columna | Tipo | Nullable | Default | Notas |
|---------|------|----------|---------|-------|
| `id` | integer | No | nextval('alumnos_lugares_id_seq'::regclass) | **PK** |
| `alumno_id` | integer | No | - | **FK** → `alumnos.id` |
| `nombre` | character varying(255) | No | - | - |
| `descripcion` | text | Sí | - | - |
| `activo` | boolean | Sí | false | *Estado* |
| `created_at` | timestamp without time zone | Sí | CURRENT_TIMESTAMP | *Temporal* |
| `updated_at` | timestamp without time zone | Sí | CURRENT_TIMESTAMP | *Temporal* |

### Tabla: `alumnos_proyectos`

#### Columnas

| Columna | Tipo | Nullable | Default | Notas |
|---------|------|----------|---------|-------|
| `id` | integer | No | nextval('alumnos_proyectos_id_seq'::regclass) | **PK** |
| `alumno_id` | integer | No | - | **FK** → `alumnos.id` |
| `nombre` | character varying(255) | No | - | - |
| `descripcion` | text | Sí | - | - |
| `activo` | boolean | Sí | false | *Estado* |
| `created_at` | timestamp without time zone | Sí | CURRENT_TIMESTAMP | *Temporal* |
| `updated_at` | timestamp without time zone | Sí | CURRENT_TIMESTAMP | *Temporal* |

### Tabla: `aspectos_energeticos`

#### Columnas

| Columna | Tipo | Nullable | Default | Notas |
|---------|------|----------|---------|-------|
| `id` | integer | No | nextval('aspectos_energeticos_id_seq'::regclass) | **PK** |
| `nombre` | text | No | - | - |
| `descripcion` | text | Sí | - | - |
| `categoria` | text | Sí | 'chakra'::text | - |
| `frecuencia_dias` | integer | No | 14 | - |
| `prioridad` | integer | Sí | 3 | - |
| `activo` | boolean | Sí | true | *Estado* |
| `orden` | integer | Sí | 0 | - |
| `metadata` | jsonb | Sí | '{}'::jsonb | - |
| `created_at` | timestamp without time zone | Sí | CURRENT_TIMESTAMP | *Temporal* |
| `updated_at` | timestamp without time zone | Sí | CURRENT_TIMESTAMP | *Temporal* |
| `seccion_id` | integer | Sí | - | **FK** → `secciones_limpieza.id` |

### Tabla: `aspectos_energeticos_alumnos`

#### Columnas

| Columna | Tipo | Nullable | Default | Notas |
|---------|------|----------|---------|-------|
| `id` | integer | No | nextval('aspectos_energeticos_alumnos_id_seq'::regclass) | **PK** |
| `alumno_id` | integer | No | - | **FK** → `alumnos.id` |
| `aspecto_id` | integer | No | - | *Inferido* → `aspectos` |
| `ultima_limpieza` | timestamp without time zone | Sí | - | - |
| `proxima_limpieza` | timestamp without time zone | Sí | - | - |
| `estado` | text | Sí | 'pendiente'::text | *Estado* |
| `veces_limpiado` | integer | Sí | 0 | - |
| `metadata` | jsonb | Sí | '{}'::jsonb | - |

### Tabla: `aspectos_energeticos_registros`

#### Columnas

| Columna | Tipo | Nullable | Default | Notas |
|---------|------|----------|---------|-------|
| `id` | integer | No | nextval('aspectos_energeticos_registros_id_seq'::regclass) | **PK** |
| `alumno_id` | integer | No | - | **FK** → `alumnos.id` |
| `aspecto_id` | integer | No | - | *Inferido* → `aspectos` |
| `fecha` | timestamp without time zone | No | CURRENT_TIMESTAMP | *Temporal* |
| `modo_limpieza` | text | Sí | - | - |
| `origen` | text | Sí | - | - |
| `notas` | text | Sí | - | - |
| `metadata` | jsonb | Sí | '{}'::jsonb | - |

### Tabla: `aspectos_indeseables`

#### Columnas

| Columna | Tipo | Nullable | Default | Notas |
|---------|------|----------|---------|-------|
| `id` | integer | No | nextval('aspectos_indeseables_id_seq'::regclass) | **PK** |
| `nombre` | character varying(200) | No | - | - |
| `frecuencia_dias` | integer | Sí | 14 | - |
| `prioridad` | character varying(50) | Sí | 'Normal'::character varying | - |
| `orden` | integer | Sí | 0 | - |
| `activo` | boolean | Sí | true | *Estado* |
| `created_at` | timestamp without time zone | Sí | CURRENT_TIMESTAMP | *Temporal* |
| `updated_at` | timestamp without time zone | Sí | CURRENT_TIMESTAMP | *Temporal* |

### Tabla: `aspectos_indeseables_alumnos`

#### Columnas

| Columna | Tipo | Nullable | Default | Notas |
|---------|------|----------|---------|-------|
| `id` | integer | No | nextval('aspectos_indeseables_alumnos_id_seq'::regclass) | **PK** |
| `alumno_id` | integer | Sí | - | **FK** → `alumnos.id` |
| `aspecto_id` | integer | Sí | - | **FK** → `aspectos_indeseables.id` |
| `estado` | character varying(50) | Sí | 'pendiente'::character varying | *Estado* |
| `ultima_limpieza` | timestamp without time zone | Sí | - | - |
| `proxima_limpieza` | timestamp without time zone | Sí | - | - |

### Tabla: `aspectos_karmicos`

#### Columnas

| Columna | Tipo | Nullable | Default | Notas |
|---------|------|----------|---------|-------|
| `id` | integer | No | nextval('aspectos_karmicos_id_seq'::regclass) | **PK** |
| `nombre` | character varying(200) | No | - | - |
| `frecuencia_dias` | integer | Sí | 14 | - |
| `prioridad` | character varying(50) | Sí | 'Normal'::character varying | - |
| `orden` | integer | Sí | 0 | - |
| `activo` | boolean | Sí | true | *Estado* |
| `created_at` | timestamp without time zone | Sí | CURRENT_TIMESTAMP | *Temporal* |
| `updated_at` | timestamp without time zone | Sí | CURRENT_TIMESTAMP | *Temporal* |

### Tabla: `aspectos_karmicos_alumnos`

#### Columnas

| Columna | Tipo | Nullable | Default | Notas |
|---------|------|----------|---------|-------|
| `id` | integer | No | nextval('aspectos_karmicos_alumnos_id_seq'::regclass) | **PK** |
| `alumno_id` | integer | Sí | - | **FK** → `alumnos.id` |
| `aspecto_id` | integer | Sí | - | **FK** → `aspectos_karmicos.id` |
| `estado` | character varying(50) | Sí | 'pendiente'::character varying | *Estado* |
| `ultima_limpieza` | timestamp without time zone | Sí | - | - |
| `proxima_limpieza` | timestamp without time zone | Sí | - | - |

### Tabla: `aspectos_practica`

#### Columnas

| Columna | Tipo | Nullable | Default | Notas |
|---------|------|----------|---------|-------|
| `id` | integer | No | nextval('aspectos_practica_id_seq'::regclass) | **PK** |
| `nombre` | character varying(255) | No | - | - |
| `webhook_typeform` | character varying(255) | Sí | - | - |
| `recomendado_iniciarse` | integer | Sí | 1 | - |
| `recomendado_conocer` | integer | Sí | 5 | - |
| `recomendado_dominio` | integer | Sí | 10 | - |
| `descripcion` | text | Sí | - | - |
| `activo` | boolean | Sí | true | *Estado* |
| `created_at` | timestamp without time zone | Sí | CURRENT_TIMESTAMP | *Temporal* |
| `updated_at` | timestamp without time zone | Sí | CURRENT_TIMESTAMP | *Temporal* |

### Tabla: `items_transmutaciones`

#### Columnas

| Columna | Tipo | Nullable | Default | Notas |
|---------|------|----------|---------|-------|
| `id` | integer | No | nextval('items_transmutaciones_id_seq'::regclass) | **PK** |
| `lista_id` | integer | No | - | **FK** → `listas_transmutaciones.id` |
| `nombre` | character varying(255) | No | - | - |
| `descripcion` | text | Sí | - | - |
| `nivel` | integer | No | 9 | - |
| `frecuencia_dias` | integer | Sí | 20 | - |
| `veces_limpiar` | integer | Sí | 15 | - |
| `orden` | integer | Sí | 0 | - |
| `activo` | boolean | Sí | true | *Estado* |
| `created_at` | timestamp without time zone | Sí | CURRENT_TIMESTAMP | *Temporal* |
| `updated_at` | timestamp without time zone | Sí | CURRENT_TIMESTAMP | *Temporal* |
| `prioridad` | character varying(10) | Sí | 'media'::character varying | - |

### Tabla: `items_transmutaciones_alumnos`

#### Columnas

| Columna | Tipo | Nullable | Default | Notas |
|---------|------|----------|---------|-------|
| `id` | integer | No | nextval('items_transmutaciones_alumnos_id_seq'::regclass) | **PK** |
| `item_id` | integer | No | - | **FK** → `items_transmutaciones.id` |
| `alumno_id` | integer | No | - | **FK** → `alumnos.id` |
| `ultima_limpieza` | timestamp without time zone | Sí | - | - |
| `veces_completadas` | integer | Sí | 0 | - |
| `created_at` | timestamp without time zone | Sí | CURRENT_TIMESTAMP | *Temporal* |
| `updated_at` | timestamp without time zone | Sí | CURRENT_TIMESTAMP | *Temporal* |

### Tabla: `limpieza_hogar`

#### Columnas

| Columna | Tipo | Nullable | Default | Notas |
|---------|------|----------|---------|-------|
| `id` | integer | No | nextval('limpieza_hogar_id_seq'::regclass) | **PK** |
| `nombre` | character varying(200) | No | - | - |
| `descripcion` | text | Sí | - | - |
| `nivel_minimo` | integer | Sí | 1 | - |
| `frecuencia_dias` | integer | Sí | 14 | - |
| `prioridad` | integer | Sí | 3 | - |
| `orden` | integer | Sí | 0 | - |
| `activo` | boolean | Sí | true | *Estado* |
| `created_at` | timestamp without time zone | Sí | CURRENT_TIMESTAMP | *Temporal* |
| `updated_at` | timestamp without time zone | Sí | CURRENT_TIMESTAMP | *Temporal* |

### Tabla: `limpieza_hogar_alumnos`

#### Columnas

| Columna | Tipo | Nullable | Default | Notas |
|---------|------|----------|---------|-------|
| `id` | integer | No | nextval('limpieza_hogar_alumnos_id_seq'::regclass) | **PK** |
| `alumno_id` | integer | Sí | - | **FK** → `alumnos.id` |
| `aspecto_id` | integer | Sí | - | **FK** → `limpieza_hogar.id` |
| `estado` | character varying(50) | Sí | 'pendiente'::character varying | *Estado* |
| `fecha_ultima_limpieza` | timestamp without time zone | Sí | - | *Temporal* |
| `veces_limpiado` | integer | Sí | 0 | - |
| `created_at` | timestamp without time zone | Sí | CURRENT_TIMESTAMP | *Temporal* |
| `updated_at` | timestamp without time zone | Sí | CURRENT_TIMESTAMP | *Temporal* |

### Tabla: `limpiezas_master_historial`

#### Columnas

| Columna | Tipo | Nullable | Default | Notas |
|---------|------|----------|---------|-------|
| `id` | integer | No | nextval('limpiezas_master_historial_id_seq'::regclass) | **PK** |
| `alumno_id` | integer | Sí | - | *Inferido* → `alumnoss` |
| `tipo` | character varying(50) | No | - | - |
| `aspecto_id` | integer | No | - | *Inferido* → `aspectos` |
| `aspecto_nombre` | character varying(500) | Sí | - | - |
| `seccion` | character varying(100) | Sí | - | - |
| `fecha_limpieza` | timestamp without time zone | Sí | CURRENT_TIMESTAMP | *Temporal* |
| `created_at` | timestamp without time zone | Sí | CURRENT_TIMESTAMP | *Temporal* |

### Tabla: `listas_transmutaciones`

#### Columnas

| Columna | Tipo | Nullable | Default | Notas |
|---------|------|----------|---------|-------|
| `id` | integer | No | nextval('listas_transmutaciones_id_seq'::regclass) | **PK** |
| `nombre` | character varying(255) | No | - | - |
| `tipo` | character varying(20) | No | 'recurrente'::character varying | - |
| `descripcion` | text | Sí | - | - |
| `activo` | boolean | Sí | true | *Estado* |
| `orden` | integer | Sí | 0 | - |
| `created_at` | timestamp without time zone | Sí | CURRENT_TIMESTAMP | *Temporal* |
| `updated_at` | timestamp without time zone | Sí | CURRENT_TIMESTAMP | *Temporal* |

### Tabla: `secciones_limpieza`

#### Columnas

| Columna | Tipo | Nullable | Default | Notas |
|---------|------|----------|---------|-------|
| `id` | integer | No | nextval('secciones_limpieza_id_seq'::regclass) | **PK** |
| `nombre` | character varying(200) | No | - | - |
| `tipo_limpieza` | character varying(20) | Sí | 'regular'::character varying | - |
| `activo` | boolean | Sí | true | *Estado* |
| `orden` | integer | Sí | 0 | - |
| `botones_mostrar` | jsonb | Sí | '[]'::jsonb | - |
| `created_at` | timestamp without time zone | Sí | CURRENT_TIMESTAMP | *Temporal* |
| `updated_at` | timestamp without time zone | Sí | CURRENT_TIMESTAMP | *Temporal* |

### Tabla: `tecnicas_limpieza`

#### Columnas

| Columna | Tipo | Nullable | Default | Notas |
|---------|------|----------|---------|-------|
| `id` | integer | No | nextval('tecnicas_limpieza_id_seq'::regclass) | **PK** |
| `nombre` | character varying(255) | No | - | - |
| `descripcion` | text | Sí | - | - |
| `nivel` | integer | No | 1 | - |
| `orden` | integer | Sí | 0 | - |
| `activo` | boolean | Sí | true | *Estado* |
| `created_at` | timestamp without time zone | Sí | CURRENT_TIMESTAMP | *Temporal* |
| `updated_at` | timestamp without time zone | Sí | CURRENT_TIMESTAMP | *Temporal* |
| `es_energias_indeseables` | boolean | Sí | false | - |

### Tabla: `transmutaciones_apadrinados`

#### Columnas

| Columna | Tipo | Nullable | Default | Notas |
|---------|------|----------|---------|-------|
| `id` | integer | No | nextval('transmutaciones_apadrinados_id_seq'::regclass) | **PK** |
| `nombre` | character varying(200) | No | - | - |
| `descripcion` | text | Sí | - | - |
| `nivel_minimo` | integer | Sí | 1 | - |
| `frecuencia_dias` | integer | Sí | 14 | - |
| `prioridad` | character varying(50) | Sí | 'Normal'::character varying | - |
| `orden` | integer | Sí | 0 | - |
| `activo` | boolean | Sí | true | *Estado* |
| `created_at` | timestamp without time zone | Sí | CURRENT_TIMESTAMP | *Temporal* |
| `updated_at` | timestamp without time zone | Sí | CURRENT_TIMESTAMP | *Temporal* |
| `alumno_id` | integer | Sí | - | **FK** → `alumnos.id` |

### Tabla: `transmutaciones_apadrinados_estado`

#### Columnas

| Columna | Tipo | Nullable | Default | Notas |
|---------|------|----------|---------|-------|
| `id` | integer | No | nextval('transmutaciones_apadrinados_estado_id_seq'::regclass) | **PK** |
| `apadrinado_id` | integer | Sí | - | **FK** → `transmutaciones_apadrinados.id` |
| `alumno_id` | integer | Sí | - | **FK** → `alumnos.id` |
| `estado` | character varying(50) | Sí | 'pendiente'::character varying | *Estado* |
| `ultima_limpieza` | timestamp without time zone | Sí | - | - |
| `veces_limpiado` | integer | Sí | 0 | - |
| `created_at` | timestamp without time zone | Sí | CURRENT_TIMESTAMP | *Temporal* |
| `updated_at` | timestamp without time zone | Sí | CURRENT_TIMESTAMP | *Temporal* |

### Tabla: `transmutaciones_lugares`

#### Columnas

| Columna | Tipo | Nullable | Default | Notas |
|---------|------|----------|---------|-------|
| `id` | integer | No | nextval('transmutaciones_lugares_id_seq'::regclass) | **PK** |
| `nombre` | character varying(200) | No | - | - |
| `descripcion` | text | Sí | - | - |
| `nivel_minimo` | integer | Sí | 1 | - |
| `frecuencia_dias` | integer | Sí | 14 | - |
| `prioridad` | character varying(50) | Sí | 'Normal'::character varying | - |
| `orden` | integer | Sí | 0 | - |
| `activo` | boolean | Sí | true | *Estado* |
| `created_at` | timestamp without time zone | Sí | CURRENT_TIMESTAMP | *Temporal* |
| `updated_at` | timestamp without time zone | Sí | CURRENT_TIMESTAMP | *Temporal* |

### Tabla: `transmutaciones_lugares_estado`

#### Columnas

| Columna | Tipo | Nullable | Default | Notas |
|---------|------|----------|---------|-------|
| `id` | integer | No | nextval('transmutaciones_lugares_estado_id_seq'::regclass) | **PK** |
| `lugar_id` | integer | Sí | - | **FK** → `transmutaciones_lugares.id` |
| `alumno_id` | integer | Sí | - | **FK** → `alumnos.id` |
| `estado` | character varying(50) | Sí | 'pendiente'::character varying | *Estado* |
| `ultima_limpieza` | timestamp without time zone | Sí | - | - |
| `veces_limpiado` | integer | Sí | 0 | - |
| `created_at` | timestamp without time zone | Sí | CURRENT_TIMESTAMP | *Temporal* |
| `updated_at` | timestamp without time zone | Sí | CURRENT_TIMESTAMP | *Temporal* |

### Tabla: `transmutaciones_proyectos`

#### Columnas

| Columna | Tipo | Nullable | Default | Notas |
|---------|------|----------|---------|-------|
| `id` | integer | No | nextval('transmutaciones_proyectos_id_seq'::regclass) | **PK** |
| `nombre` | character varying(200) | No | - | - |
| `descripcion` | text | Sí | - | - |
| `nivel_minimo` | integer | Sí | 1 | - |
| `frecuencia_dias` | integer | Sí | 14 | - |
| `prioridad` | character varying(50) | Sí | 'Normal'::character varying | - |
| `orden` | integer | Sí | 0 | - |
| `activo` | boolean | Sí | true | *Estado* |
| `created_at` | timestamp without time zone | Sí | CURRENT_TIMESTAMP | *Temporal* |
| `updated_at` | timestamp without time zone | Sí | CURRENT_TIMESTAMP | *Temporal* |

### Tabla: `transmutaciones_proyectos_estado`

#### Columnas

| Columna | Tipo | Nullable | Default | Notas |
|---------|------|----------|---------|-------|
| `id` | integer | No | nextval('transmutaciones_proyectos_estado_id_seq'::regclass) | **PK** |
| `proyecto_id` | integer | Sí | - | **FK** → `transmutaciones_proyectos.id` |
| `alumno_id` | integer | Sí | - | **FK** → `alumnos.id` |
| `estado` | character varying(50) | Sí | 'pendiente'::character varying | *Estado* |
| `ultima_limpieza` | timestamp without time zone | Sí | - | - |
| `veces_limpiado` | integer | Sí | 0 | - |
| `created_at` | timestamp without time zone | Sí | CURRENT_TIMESTAMP | *Temporal* |
| `updated_at` | timestamp without time zone | Sí | CURRENT_TIMESTAMP | *Temporal* |

---

## 3. Relaciones Inferidas

### Mapa de Relaciones

```

aspectos_energeticos
 ├─ seccion_id → secciones_limpieza

aspectos_energeticos_registros
 ├─ alumno_id → alumnos
 ├─ aspecto_id → aspectos

items_transmutaciones
 ├─ lista_id → listas_transmutaciones

limpiezas_master_historial
 ├─ alumno_id → alumnoss
 ├─ aspecto_id → aspectos

transmutaciones_apadrinados
 ├─ alumno_id → alumnos

transmutaciones_apadrinados_estado
 ├─ apadrinado_id → transmutaciones_apadrinados
 ├─ alumno_id → alumnos

transmutaciones_lugares_estado
 ├─ lugar_id → transmutaciones_lugares
 ├─ alumno_id → alumnos

transmutaciones_proyectos_estado
 ├─ proyecto_id → transmutaciones_proyectos
 ├─ alumno_id → alumnos
```

### Cardinalidad Inferida

| Tabla Origen | Columna | Tabla Destino | Cardinalidad | Tipo |
|--------------|--------|---------------|--------------|------|
| `alumnos_lugares` | `alumno_id` | `alumnos` | 1-N | FK Declarada |
| `alumnos_proyectos` | `alumno_id` | `alumnos` | 1-N | FK Declarada |
| `aspectos_energeticos` | `seccion_id` | `secciones_limpieza` | 1-N | FK Declarada |
| `aspectos_energeticos_alumnos` | `alumno_id` | `alumnos` | 1-N | FK Declarada |
| `aspectos_energeticos_alumnos` | `aspecto_id` | `aspectos` | 1-N | Inferida |
| `aspectos_energeticos_registros` | `alumno_id` | `alumnos` | 1-N | FK Declarada |
| `aspectos_energeticos_registros` | `aspecto_id` | `aspectos` | 1-N | Inferida |
| `aspectos_indeseables_alumnos` | `alumno_id` | `alumnos` | 1-N | FK Declarada |
| `aspectos_indeseables_alumnos` | `aspecto_id` | `aspectos_indeseables` | 1-N | FK Declarada |
| `aspectos_karmicos_alumnos` | `alumno_id` | `alumnos` | 1-N | FK Declarada |
| `aspectos_karmicos_alumnos` | `aspecto_id` | `aspectos_karmicos` | 1-N | FK Declarada |
| `items_transmutaciones` | `lista_id` | `listas_transmutaciones` | 1-N | FK Declarada |
| `items_transmutaciones_alumnos` | `item_id` | `items_transmutaciones` | 1-N | FK Declarada |
| `items_transmutaciones_alumnos` | `alumno_id` | `alumnos` | 1-N | FK Declarada |
| `limpieza_hogar_alumnos` | `alumno_id` | `alumnos` | 1-N | FK Declarada |
| `limpieza_hogar_alumnos` | `aspecto_id` | `limpieza_hogar` | 1-N | FK Declarada |
| `limpiezas_master_historial` | `alumno_id` | `alumnoss` | 1-N | Inferida |
| `limpiezas_master_historial` | `aspecto_id` | `aspectos` | 1-N | Inferida |
| `transmutaciones_apadrinados` | `alumno_id` | `alumnos` | 1-N | FK Declarada |
| `transmutaciones_apadrinados_estado` | `apadrinado_id` | `transmutaciones_apadrinados` | 1-N | FK Declarada |
| `transmutaciones_apadrinados_estado` | `alumno_id` | `alumnos` | 1-N | FK Declarada |
| `transmutaciones_lugares_estado` | `lugar_id` | `transmutaciones_lugares` | 1-N | FK Declarada |
| `transmutaciones_lugares_estado` | `alumno_id` | `alumnos` | 1-N | FK Declarada |
| `transmutaciones_proyectos_estado` | `proyecto_id` | `transmutaciones_proyectos` | 1-N | FK Declarada |
| `transmutaciones_proyectos_estado` | `alumno_id` | `alumnos` | 1-N | FK Declarada |

---

## 4. Clasificación: Estado vs Evento

### `alumnos_lugares`

**Clasificación**: MIXTA

**Justificación**:
- Campos de estado: activo
- Campos temporales: created_at
- Relación con alumno: Sí (alumno_id)

### `alumnos_proyectos`

**Clasificación**: MIXTA

**Justificación**:
- Campos de estado: activo
- Campos temporales: created_at
- Relación con alumno: Sí (alumno_id)

### `aspectos_energeticos`

**Clasificación**: MIXTA

**Justificación**:
- Campos de estado: activo
- Campos temporales: created_at

### `aspectos_energeticos_alumnos`

**Clasificación**: ESTADO ACTUAL

**Justificación**:
- Campos de estado: estado
- Relación con alumno: Sí (alumno_id)

### `aspectos_energeticos_registros`

**Clasificación**: MIXTA

**Justificación**:
- Relación con alumno: Sí (alumno_id)

### `aspectos_indeseables`

**Clasificación**: MIXTA

**Justificación**:
- Campos de estado: activo
- Campos temporales: created_at

### `aspectos_indeseables_alumnos`

**Clasificación**: ESTADO ACTUAL

**Justificación**:
- Campos de estado: estado
- Relación con alumno: Sí (alumno_id)

### `aspectos_karmicos`

**Clasificación**: MIXTA

**Justificación**:
- Campos de estado: activo
- Campos temporales: created_at

### `aspectos_karmicos_alumnos`

**Clasificación**: ESTADO ACTUAL

**Justificación**:
- Campos de estado: estado
- Relación con alumno: Sí (alumno_id)

### `aspectos_practica`

**Clasificación**: MIXTA

**Justificación**:
- Campos de estado: activo
- Campos temporales: created_at

### `items_transmutaciones`

**Clasificación**: MIXTA

**Justificación**:
- Campos de estado: activo
- Campos temporales: created_at

### `items_transmutaciones_alumnos`

**Clasificación**: MIXTA

**Justificación**:
- Campos temporales: created_at
- Relación con alumno: Sí (alumno_id)

### `limpieza_hogar`

**Clasificación**: MIXTA

**Justificación**:
- Campos de estado: activo
- Campos temporales: created_at

### `limpieza_hogar_alumnos`

**Clasificación**: MIXTA

**Justificación**:
- Campos de estado: estado
- Campos temporales: created_at
- Relación con alumno: Sí (alumno_id)

### `limpiezas_master_historial`

**Clasificación**: HISTÓRICO

**Justificación**:
- Campos temporales: fecha_limpieza, created_at
- Relación con alumno: Sí (alumno_id)

### `listas_transmutaciones`

**Clasificación**: MIXTA

**Justificación**:
- Campos de estado: activo
- Campos temporales: created_at

### `secciones_limpieza`

**Clasificación**: MIXTA

**Justificación**:
- Campos de estado: activo
- Campos temporales: created_at

### `tecnicas_limpieza`

**Clasificación**: MIXTA

**Justificación**:
- Campos de estado: activo
- Campos temporales: created_at

### `transmutaciones_apadrinados`

**Clasificación**: MIXTA

**Justificación**:
- Campos de estado: activo
- Campos temporales: created_at
- Relación con alumno: Sí (alumno_id)

### `transmutaciones_apadrinados_estado`

**Clasificación**: MIXTA

**Justificación**:
- Campos de estado: estado
- Campos temporales: created_at
- Relación con alumno: Sí (alumno_id)

### `transmutaciones_lugares`

**Clasificación**: MIXTA

**Justificación**:
- Campos de estado: activo
- Campos temporales: created_at

### `transmutaciones_lugares_estado`

**Clasificación**: MIXTA

**Justificación**:
- Campos de estado: estado
- Campos temporales: created_at
- Relación con alumno: Sí (alumno_id)

### `transmutaciones_proyectos`

**Clasificación**: MIXTA

**Justificación**:
- Campos de estado: activo
- Campos temporales: created_at

### `transmutaciones_proyectos_estado`

**Clasificación**: MIXTA

**Justificación**:
- Campos de estado: estado
- Campos temporales: created_at
- Relación con alumno: Sí (alumno_id)

---

## 5. Soporte de Recurrencia y Niveles (DB)

### Columnas de Recurrencia

| Tabla | Columna | Tipo |
|-------|---------|------|
| `aspectos_energeticos` | `frecuencia_dias` | integer |
| `aspectos_energeticos_alumnos` | `veces_limpiado` | integer |
| `aspectos_indeseables` | `frecuencia_dias` | integer |
| `aspectos_karmicos` | `frecuencia_dias` | integer |
| `items_transmutaciones` | `frecuencia_dias` | integer |
| `items_transmutaciones` | `veces_limpiar` | integer |
| `items_transmutaciones_alumnos` | `veces_completadas` | integer |
| `limpieza_hogar` | `frecuencia_dias` | integer |
| `limpieza_hogar_alumnos` | `veces_limpiado` | integer |
| `transmutaciones_apadrinados` | `frecuencia_dias` | integer |
| `transmutaciones_apadrinados_estado` | `veces_limpiado` | integer |
| `transmutaciones_lugares` | `frecuencia_dias` | integer |
| `transmutaciones_lugares_estado` | `veces_limpiado` | integer |
| `transmutaciones_proyectos` | `frecuencia_dias` | integer |
| `transmutaciones_proyectos_estado` | `veces_limpiado` | integer |

### Columnas de Nivel

| Tabla | Columna | Tipo |
|-------|---------|------|
| `items_transmutaciones` | `nivel` | integer |
| `limpieza_hogar` | `nivel_minimo` | integer |
| `tecnicas_limpieza` | `nivel` | integer |
| `transmutaciones_apadrinados` | `nivel_minimo` | integer |
| `transmutaciones_lugares` | `nivel_minimo` | integer |
| `transmutaciones_proyectos` | `nivel_minimo` | integer |

### Columnas Contadoras

| Tabla | Columna | Tipo |
|-------|---------|------|
| `aspectos_energeticos_alumnos` | `veces_limpiado` | integer |
| `limpieza_hogar_alumnos` | `veces_limpiado` | integer |
| `transmutaciones_apadrinados_estado` | `veces_limpiado` | integer |
| `transmutaciones_lugares_estado` | `veces_limpiado` | integer |
| `transmutaciones_proyectos_estado` | `veces_limpiado` | integer |

---

## 6. Conclusiones DB-ONLY

### Tablas Clave

Las siguientes tablas gobiernan el sistema actual:

- `aspectos_energeticos`
- `aspectos_energeticos_alumnos`
- `aspectos_energeticos_registros`
- `aspectos_indeseables`
- `aspectos_indeseables_alumnos`
- `aspectos_karmicos`
- `aspectos_karmicos_alumnos`
- `aspectos_practica`
- `items_transmutaciones`
- `items_transmutaciones_alumnos`
- `limpieza_hogar`
- `limpieza_hogar_alumnos`
- `limpiezas_master_historial`
- `listas_transmutaciones`
- `secciones_limpieza`
- `tecnicas_limpieza`
- `transmutaciones_apadrinados`
- `transmutaciones_apadrinados_estado`
- `transmutaciones_lugares`
- `transmutaciones_lugares_estado`
- `transmutaciones_proyectos`
- `transmutaciones_proyectos_estado`

### Tablas Secundarias / Legacy

- `alumnos_lugares`
- `alumnos_proyectos`

### Riesgos Detectados (Solo desde DB)

- **Estados sobrescribibles**: `alumnos_lugares` tiene campos de estado sin histórico de cambios
- **Estados sobrescribibles**: `alumnos_proyectos` tiene campos de estado sin histórico de cambios
- **Estados sobrescribibles**: `aspectos_energeticos` tiene campos de estado sin histórico de cambios
- **Estados sobrescribibles**: `aspectos_energeticos_alumnos` tiene campos de estado sin histórico de cambios
- **Estados sobrescribibles**: `aspectos_indeseables` tiene campos de estado sin histórico de cambios
- **Estados sobrescribibles**: `aspectos_indeseables_alumnos` tiene campos de estado sin histórico de cambios
- **Estados sobrescribibles**: `aspectos_karmicos` tiene campos de estado sin histórico de cambios
- **Estados sobrescribibles**: `aspectos_karmicos_alumnos` tiene campos de estado sin histórico de cambios
- **Estados sobrescribibles**: `aspectos_practica` tiene campos de estado sin histórico de cambios
- **Estados sobrescribibles**: `items_transmutaciones` tiene campos de estado sin histórico de cambios
- **Estados sobrescribibles**: `limpieza_hogar` tiene campos de estado sin histórico de cambios
- **Estados sobrescribibles**: `limpieza_hogar_alumnos` tiene campos de estado sin histórico de cambios
- **Estados sobrescribibles**: `listas_transmutaciones` tiene campos de estado sin histórico de cambios
- **Estados sobrescribibles**: `secciones_limpieza` tiene campos de estado sin histórico de cambios
- **Estados sobrescribibles**: `tecnicas_limpieza` tiene campos de estado sin histórico de cambios
- **Estados sobrescribibles**: `transmutaciones_apadrinados` tiene campos de estado sin histórico de cambios
- **Estados sobrescribibles**: `transmutaciones_apadrinados_estado` tiene campos de estado sin histórico de cambios
- **Estados sobrescribibles**: `transmutaciones_lugares` tiene campos de estado sin histórico de cambios
- **Estados sobrescribibles**: `transmutaciones_lugares_estado` tiene campos de estado sin histórico de cambios
- **Estados sobrescribibles**: `transmutaciones_proyectos` tiene campos de estado sin histórico de cambios
- **Estados sobrescribibles**: `transmutaciones_proyectos_estado` tiene campos de estado sin histórico de cambios
- **Falta de histórico**: `items_transmutaciones` parece almacenar solo estado actual sin registro histórico
- **Falta de histórico**: `items_transmutaciones_alumnos` parece almacenar solo estado actual sin registro histórico
- **Falta de histórico**: `limpieza_hogar` parece almacenar solo estado actual sin registro histórico
- **Falta de histórico**: `limpieza_hogar_alumnos` parece almacenar solo estado actual sin registro histórico
- **Falta de histórico**: `limpiezas_master_historial` parece almacenar solo estado actual sin registro histórico
- **Falta de histórico**: `listas_transmutaciones` parece almacenar solo estado actual sin registro histórico
- **Falta de histórico**: `secciones_limpieza` parece almacenar solo estado actual sin registro histórico
- **Falta de histórico**: `tecnicas_limpieza` parece almacenar solo estado actual sin registro histórico
- **Falta de histórico**: `transmutaciones_apadrinados` parece almacenar solo estado actual sin registro histórico
- **Falta de histórico**: `transmutaciones_apadrinados_estado` parece almacenar solo estado actual sin registro histórico
- **Falta de histórico**: `transmutaciones_lugares` parece almacenar solo estado actual sin registro histórico
- **Falta de histórico**: `transmutaciones_lugares_estado` parece almacenar solo estado actual sin registro histórico
- **Falta de histórico**: `transmutaciones_proyectos` parece almacenar solo estado actual sin registro histórico
- **Falta de histórico**: `transmutaciones_proyectos_estado` parece almacenar solo estado actual sin registro histórico
- **Posible duplicidad**: Se encontraron tablas con nombres similares que podrían almacenar información duplicada

---

**Fin del diagnóstico**
