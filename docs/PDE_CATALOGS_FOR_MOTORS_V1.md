# 📋 PDE CATÁLOGOS PARA MOTORES - AUDITORÍA V1

**Fecha:** 2025-01-XX  
**Versión:** v1.0.0  
**Estado:** ✅ Auditoría Completa

---

## 🎯 OBJETIVO

Documentación canónica de todos los catálogos PDE existentes en AuriPortal, con evaluación de capacidad para ser consumidos por Motores PDE y normalización de campos necesarios.

**Este documento es la fuente de verdad para:**
- Diseñador de Motores
- Sistema AXE
- Recorridos PDE
- Futuras automatizaciones

---

## 📊 RESUMEN EJECUTIVO

| Catálogo | Tabla | Estado | Usable por Motores | Campos Faltantes |
|----------|-------|--------|-------------------|------------------|
| Transmutaciones Energéticas | `listas_transmutaciones`, `items_transmutaciones` | ✅ | ✅ SÍ | `prioridad` (ya existe) |
| Técnicas de Limpieza | `tecnicas_limpieza` | ✅ | ✅ SÍ | `prioridad` |
| Preparaciones Práctica | `preparaciones_practica` | ✅ | ✅ SÍ | `prioridad` |
| Técnicas Post-práctica | `tecnicas_post_practica` | ✅ | ✅ SÍ | `prioridad` |
| Protecciones Energéticas | `protecciones_energeticas` | ✅ | ⚠️ PARCIAL | `nivel_minimo`, `prioridad` |
| Decretos | `decretos` | ✅ | ✅ SÍ | Ninguno |
| Frases PDE | `pde_frases_personalizadas` | ✅ | ✅ SÍ | Ninguno |
| Músicas | `musicas_meditacion` | ✅ | ✅ SÍ | Ninguno |
| Tonos | `tonos_meditacion` | ✅ | ✅ SÍ | Ninguno |

---

## 1. TRANSMUTACIONES ENERGÉTICAS

### 1.1 Identificación Técnica

- **URL Admin:** `https://admin.pdeeugenihidalgo.org/admin/transmutaciones-energeticas`
- **Tablas PostgreSQL:**
  - `listas_transmutaciones` (listas contenedoras)
  - `items_transmutaciones` (ítems energéticos dentro de listas)
  - `items_transmutaciones_alumnos` (estado por alumno)
- **Migración:** Creada en `database/pg.js` (líneas 1272-1378)
- **Repositorio:** `src/services/transmutaciones-energeticas.js`
- **Endpoints API:**
  - `/api/transmutaciones/listas` (GET, POST)
  - `/api/transmutaciones/listas/:id` (GET, PUT, DELETE)
  - `/api/transmutaciones/items` (GET, POST)
  - `/api/transmutaciones/items/:id` (GET, PUT, DELETE)
- **UI Admin:** `src/endpoints/admin-transmutaciones-energeticas.js`

### 1.2 Inventario de Campos

#### Tabla: `listas_transmutaciones`

| Campo | Tipo | Nullable | Significado |
|-------|------|----------|-------------|
| `id` | SERIAL | NO | PK |
| `nombre` | VARCHAR(255) | NO | Nombre de la lista |
| `tipo` | VARCHAR(20) | NO | 'recurrente' o 'una_vez' |
| `descripcion` | TEXT | SÍ | Descripción opcional |
| `activo` | BOOLEAN | SÍ | Soft delete (default: true) |
| `orden` | INTEGER | SÍ | Orden de visualización (default: 0) |
| `created_at` | TIMESTAMP | SÍ | Fecha creación |
| `updated_at` | TIMESTAMP | SÍ | Fecha actualización |

#### Tabla: `items_transmutaciones`

| Campo | Tipo | Nullable | Significado |
|-------|------|----------|-------------|
| `id` | SERIAL | NO | PK |
| `lista_id` | INTEGER | NO | FK a `listas_transmutaciones` |
| `nombre` | VARCHAR(255) | NO | Nombre del ítem |
| `descripcion` | TEXT | SÍ | Descripción opcional |
| `nivel` | INTEGER | NO | Nivel mínimo requerido (default: 9) |
| `frecuencia_dias` | INTEGER | SÍ | Para listas recurrentes: días que se mantiene limpio (default: 20) |
| `veces_limpiar` | INTEGER | SÍ | Para listas de una vez: veces que hay que limpiar (default: 15) |
| `prioridad` | VARCHAR(10) | SÍ | 'alta', 'media', 'bajo' (default: 'media') |
| `orden` | INTEGER | SÍ | Orden de visualización (default: 0) |
| `activo` | BOOLEAN | SÍ | Soft delete (default: true) |
| `created_at` | TIMESTAMP | SÍ | Fecha creación |
| `updated_at` | TIMESTAMP | SÍ | Fecha actualización |

### 1.3 Evaluación para Motores

**✅ Puede ser consumido por motores:** SÍ

**Campos disponibles para motores:**
- ✅ **Filtrar por nivel:** `nivel` (en items)
- ✅ **Marcar obligatorios:** No aplica (se usa lógica de estado)
- ✅ **Ordenar por prioridad:** `prioridad` (alta/media/bajo)
- ✅ **Limitar cantidad:** Sí (mediante límite en query)

**Motores que pueden usarlo:**
- `motor_limpieza_energetica`
- `motor_transmutaciones_recurrentes`
- `motor_energias_indeseables`

**Limitaciones:**
- Requiere contexto de alumno para calcular estado
- No tiene campo `is_obligatoria` directo (usa lógica de estado)

---

## 2. TÉCNICAS DE LIMPIEZA

### 2.1 Identificación Técnica

- **URL Admin:** `https://admin.pdeeugenihidalgo.org/admin/tecnicas-limpieza`
- **Tabla PostgreSQL:** `tecnicas_limpieza`
- **Migración:** Creada en `database/pg.js` (líneas 1380-1397)  
  - Migración adicional: `database/migrations/v5.6.0-tecnicas-clasificacion-flags.sql`
- **Repositorio:** `src/services/tecnicas-limpieza.js`
- **Endpoints API:**
  - `/api/tecnicas-limpieza` (GET, POST)
  - `/api/tecnicas-limpieza/:id` (GET, PUT, DELETE)
- **UI Admin:** `src/endpoints/admin-tecnicas-limpieza.js`

### 2.2 Inventario de Campos

| Campo | Tipo | Nullable | Significado |
|-------|------|----------|-------------|
| `id` | SERIAL | NO | PK |
| `nombre` | VARCHAR(255) | NO | Nombre de la técnica |
| `descripcion` | TEXT | SÍ | Descripción opcional |
| `nivel` | INTEGER | NO | Nivel mínimo requerido (default: 1) |
| `orden` | INTEGER | SÍ | Orden de visualización (default: 0) |
| `activo` | BOOLEAN | SÍ | Soft delete (default: true) |
| `aplica_energias_indeseables` | BOOLEAN | NO | Flag para energías indeseables (default: false) |
| `aplica_limpiezas_recurrentes` | BOOLEAN | NO | Flag para limpiezas recurrentes (default: false) |
| `created_at` | TIMESTAMP | SÍ | Fecha creación |
| `updated_at` | TIMESTAMP | SÍ | Fecha actualización |

### 2.3 Evaluación para Motores

**✅ Puede ser consumido por motores:** SÍ (con normalización)

**Campos disponibles para motores:**
- ✅ **Filtrar por nivel:** `nivel`
- ❌ **Marcar obligatorios:** NO (falta `is_obligatoria` o `obligatoria_global`)
- ⚠️ **Ordenar por prioridad:** NO (falta campo `prioridad`)
- ✅ **Limitar cantidad:** Sí

**Campos faltantes para motores:**
- `prioridad` (VARCHAR(10) DEFAULT 'media' CHECK (prioridad IN ('alta', 'media', 'bajo')))
- `is_obligatoria` (BOOLEAN DEFAULT false) - O usar `obligatoria_global`

**Motores que pueden usarlo:**
- `motor_limpieza_energetica`
- `motor_seleccion_tecnicas`

**Acción requerida:** ⚠️ **NORMALIZAR** - Añadir campos `prioridad` e `is_obligatoria`

---

## 3. PREPARACIONES PARA LA PRÁCTICA

### 3.1 Identificación Técnica

- **URL Admin:** `https://admin.pdeeugenihidalgo.org/admin/preparaciones-practica`
- **Tabla PostgreSQL:** `preparaciones_practica`
- **Migración:** Creada en `database/pg.js` (líneas 1399-1443)  
  - Migración adicional: `database/pg.js` (líneas 1577-1639) - Campos Fase 1
  - Migración adicional: `database/migrations/v5.7.0-preparaciones-descripcion.sql`
- **Repositorio:** `src/services/preparaciones-practica.js`
- **Endpoints API:**
  - `/api/preparaciones-practica` (GET, POST)
  - `/api/preparaciones-practica/:id` (GET, PUT, DELETE)
- **UI Admin:** `src/endpoints/admin-preparaciones-practica.js`

### 3.2 Inventario de Campos

| Campo | Tipo | Nullable | Significado |
|-------|------|----------|-------------|
| `id` | SERIAL | NO | PK |
| `nombre` | VARCHAR(255) | NO | Nombre de la preparación |
| `descripcion` | TEXT | SÍ | Descripción opcional |
| `nivel` | INTEGER | NO | Nivel mínimo requerido (default: 1) |
| `video_url` | TEXT | SÍ | URL del video opcional |
| `orden` | INTEGER | SÍ | Orden de visualización (default: 0) |
| `activo` | BOOLEAN | SÍ | Soft delete (default: true) |
| `tipo` | VARCHAR(20) | SÍ | Tipo: 'consigna' (default: 'consigna') |
| `posicion` | VARCHAR(20) | SÍ | Posición: 'inicio' (default: 'inicio') |
| `obligatoria_global` | BOOLEAN | SÍ | Obligatoria para todos (default: false) |
| `obligatoria_por_nivel` | JSONB | SÍ | Obligatoriedad por nivel: `{"1": true, "2": false}` (default: {}) |
| `minutos` | INTEGER | SÍ | Duración en minutos (default: NULL) |
| `tiene_video` | BOOLEAN | SÍ | Flag de video (default: false) |
| `contenido_html` | TEXT | SÍ | Contenido HTML opcional |
| `activar_reloj` | BOOLEAN | SÍ | Activar reloj de meditación (default: false) |
| `musica_id` | INTEGER | SÍ | FK a `musicas_meditacion` (default: NULL) |
| `created_at` | TIMESTAMP | SÍ | Fecha creación |
| `updated_at` | TIMESTAMP | SÍ | Fecha actualización |

### 3.3 Evaluación para Motores

**✅ Puede ser consumido por motores:** SÍ (con normalización)

**Campos disponibles para motores:**
- ✅ **Filtrar por nivel:** `nivel`
- ✅ **Marcar obligatorios:** `obligatoria_global`, `obligatoria_por_nivel`
- ⚠️ **Ordenar por prioridad:** NO (falta campo `prioridad`)
- ✅ **Limitar cantidad:** Sí
- ✅ **Duración:** `minutos`

**Campos faltantes para motores:**
- `prioridad` (VARCHAR(10) DEFAULT 'media' CHECK (prioridad IN ('alta', 'media', 'bajo')))

**Motores que pueden usarlo:**
- `motor_preparacion_practica` ⭐ **PRINCIPAL**
- `motor_seleccion_preparaciones`

**Acción requerida:** ⚠️ **NORMALIZAR** - Añadir campo `prioridad`

---

## 4. TÉCNICAS POST-PRÁCTICA

### 4.1 Identificación Técnica

- **URL Admin:** `https://admin.pdeeugenihidalgo.org/admin/tecnicas-post-practica`
- **Tabla PostgreSQL:** `tecnicas_post_practica`
- **Migración:** Creada en `database/pg.js` (líneas 1445-1509)  
  - Migración adicional: `database/pg.js` (líneas 1642-1704) - Campos Fase 1
- **Repositorio:** `src/services/tecnicas-post-practica.js`
- **Endpoints API:**
  - `/api/tecnicas-post-practica` (GET, POST)
  - `/api/tecnicas-post-practica/:id` (GET, PUT, DELETE)
- **UI Admin:** `src/endpoints/admin-tecnicas-post-practica.js`

### 4.2 Inventario de Campos

| Campo | Tipo | Nullable | Significado |
|-------|------|----------|-------------|
| `id` | SERIAL | NO | PK |
| `nombre` | VARCHAR(255) | NO | Nombre de la técnica |
| `descripcion` | TEXT | SÍ | Descripción opcional |
| `nivel` | INTEGER | NO | Nivel mínimo requerido (default: 1) |
| `video_url` | TEXT | SÍ | URL del video opcional |
| `orden` | INTEGER | SÍ | Orden de visualización (default: 0) |
| `activo` | BOOLEAN | SÍ | Soft delete (default: true) |
| `tipo` | VARCHAR(20) | SÍ | Tipo: 'consigna' (default: 'consigna') |
| `posicion` | VARCHAR(20) | SÍ | Posición: 'inicio' (default: 'inicio') |
| `obligatoria_global` | BOOLEAN | SÍ | Obligatoria para todos (default: false) |
| `obligatoria_por_nivel` | JSONB | SÍ | Obligatoriedad por nivel (default: {}) |
| `minutos` | INTEGER | SÍ | Duración en minutos (default: NULL) |
| `tiene_video` | BOOLEAN | SÍ | Flag de video (default: false) |
| `contenido_html` | TEXT | SÍ | Contenido HTML opcional |
| `activar_reloj` | BOOLEAN | SÍ | Activar reloj de meditación (default: false) |
| `musica_id` | INTEGER | SÍ | FK a `musicas_meditacion` (default: NULL) |
| `created_at` | TIMESTAMP | SÍ | Fecha creación |
| `updated_at` | TIMESTAMP | SÍ | Fecha actualización |

### 4.3 Evaluación para Motores

**✅ Puede ser consumido por motores:** SÍ (con normalización)

**Campos disponibles para motores:**
- ✅ **Filtrar por nivel:** `nivel`
- ✅ **Marcar obligatorios:** `obligatoria_global`, `obligatoria_por_nivel`
- ⚠️ **Ordenar por prioridad:** NO (falta campo `prioridad`)
- ✅ **Limitar cantidad:** Sí
- ✅ **Duración:** `minutos`

**Campos faltantes para motores:**
- `prioridad` (VARCHAR(10) DEFAULT 'media' CHECK (prioridad IN ('alta', 'media', 'bajo')))

**Motores que pueden usarlo:**
- `motor_post_practica`
- `motor_seleccion_post_practica`

**Acción requerida:** ⚠️ **NORMALIZAR** - Añadir campo `prioridad`

---

## 5. PROTECCIONES ENERGÉTICAS

### 5.1 Identificación Técnica

- **URL Admin:** `https://admin.pdeeugenihidalgo.org/admin/protecciones-energeticas`
- **Tabla PostgreSQL:** `protecciones_energeticas`
- **Migración:** `database/migrations/v4.13.1-create-protecciones-energeticas.sql`
- **Repositorio:** `src/services/protecciones-energeticas.js`
- **Endpoints API:**
  - `/api/protecciones-energeticas` (GET, POST)
  - `/api/protecciones-energeticas/:id` (GET, PUT, DELETE)
- **UI Admin:** `src/endpoints/admin-protecciones-energeticas.js`

### 5.2 Inventario de Campos

| Campo | Tipo | Nullable | Significado |
|-------|------|----------|-------------|
| `id` | SERIAL | NO | PK |
| `key` | VARCHAR(255) | NO | Clave única (slug) - UNIQUE |
| `name` | VARCHAR(255) | NO | Nombre legible |
| `description` | TEXT | SÍ | Descripción opcional |
| `usage_context` | TEXT | SÍ | Contexto de uso |
| `recommended_moment` | TEXT | SÍ | Momento recomendado: 'pre-practica', 'durante', 'post-practica', 'transversal' (default: 'transversal') |
| `tags` | JSONB | SÍ | Tags asociados (default: []) |
| `status` | VARCHAR(20) | SÍ | Estado: 'active' o 'archived' (default: 'active') |
| `created_at` | TIMESTAMP | SÍ | Fecha creación |
| `updated_at` | TIMESTAMP | SÍ | Fecha actualización |

### 5.3 Evaluación para Motores

**⚠️ Puede ser consumido por motores:** PARCIAL (requiere normalización)

**Campos disponibles para motores:**
- ❌ **Filtrar por nivel:** NO (falta `nivel_minimo`)
- ❌ **Marcar obligatorios:** NO (falta `is_obligatoria`)
- ❌ **Ordenar por prioridad:** NO (falta campo `prioridad`)
- ✅ **Limitar cantidad:** Sí
- ✅ **Filtrar por momento:** `recommended_moment`
- ✅ **Filtrar por tags:** `tags` (JSONB)

**Campos faltantes para motores:**
- `nivel_minimo` (INTEGER DEFAULT 1)
- `prioridad` (VARCHAR(10) DEFAULT 'media' CHECK (prioridad IN ('alta', 'media', 'bajo')))
- `is_obligatoria` (BOOLEAN DEFAULT false) - O usar `obligatoria_global`

**Motores que pueden usarlo:**
- `motor_protecciones_energeticas`
- `motor_seleccion_protecciones`

**Acción requerida:** ⚠️ **NORMALIZAR** - Añadir campos `nivel_minimo`, `prioridad`, `is_obligatoria`

---

## 6. DECRETOS

### 6.1 Identificación Técnica

- **URL Admin:** `https://admin.pdeeugenihidalgo.org/admin/decretos`
- **Tabla PostgreSQL:** `decretos`
- **Migración:** Creada en `database/pg.js` (líneas 1723-1777)  
  - Migración adicional: `database/migrations/v5.9.0-decretos-editor-v1.sql`
- **Repositorio:** `src/services/decretos-service.js` (usa `src/infra/repos/decretos-repo-pg.js`)
- **Endpoints API:**
  - `/api/pde/decretos` (GET, POST)
  - `/api/pde/decretos/:id` (GET, PUT, DELETE)
  - `/api/pde/decretos/:id/restore` (POST)
- **UI Admin:** `src/endpoints/admin-decretos.js`

### 6.2 Inventario de Campos

| Campo | Tipo | Nullable | Significado |
|-------|------|----------|-------------|
| `id` | SERIAL | NO | PK |
| `nombre` | VARCHAR(255) | NO | Nombre del decreto |
| `contenido_html` | TEXT | NO | Contenido HTML del decreto |
| `content_delta` | JSONB | SÍ | Delta JSON del editor Quill (opcional) |
| `content_text` | TEXT | SÍ | Texto plano extraído (opcional) |
| `nivel_minimo` | INTEGER | SÍ | Nivel mínimo requerido (default: 1) |
| `posicion` | VARCHAR(20) | SÍ | Posición: 'inicio' (default: 'inicio') |
| `obligatoria_global` | BOOLEAN | SÍ | Obligatoria para todos (default: false) |
| `obligatoria_por_nivel` | JSONB | SÍ | Obligatoriedad por nivel (default: {}) |
| `orden` | INTEGER | SÍ | Orden de visualización (default: 0) |
| `activo` | BOOLEAN | SÍ | Soft delete (default: true) |
| `deleted_at` | TIMESTAMP | SÍ | Soft delete timestamp (NULL = activo) |
| `created_at` | TIMESTAMP | SÍ | Fecha creación |
| `updated_at` | TIMESTAMP | SÍ | Fecha actualización |

### 6.3 Evaluación para Motores

**✅ Puede ser consumido por motores:** SÍ

**Campos disponibles para motores:**
- ✅ **Filtrar por nivel:** `nivel_minimo`
- ✅ **Marcar obligatorios:** `obligatoria_global`, `obligatoria_por_nivel`
- ⚠️ **Ordenar por prioridad:** NO (falta campo `prioridad`, pero tiene `orden`)
- ✅ **Limitar cantidad:** Sí

**Campos faltantes para motores:**
- `prioridad` (VARCHAR(10) DEFAULT 'media' CHECK (prioridad IN ('alta', 'media', 'bajo'))) - Opcional, puede usar `orden`

**Motores que pueden usarlo:**
- `motor_decretos`
- `motor_seleccion_decretos`

**Acción requerida:** ⚠️ **OPCIONAL** - Añadir campo `prioridad` para consistencia (o usar `orden`)

---

## 7. FRASES PDE

### 7.1 Identificación Técnica

- **URL Admin:** `https://admin.pdeeugenihidalgo.org/admin/frases` (vía admin-panel-v4.js)
- **Tabla PostgreSQL:** `pde_frases_personalizadas`
- **Migración:** `database/migrations/v5.8.0-create-pde-frases-personalizadas.sql`
- **Repositorio:** `src/services/pde-frases-personalizadas.js`
- **Endpoints API:** Integrado en admin-panel-v4.js (líneas 48-571)
- **UI Admin:** Renderizado en `src/endpoints/admin-panel-v4.js` (función `renderEditorFrasesPersonalizadas`)

### 7.2 Inventario de Campos

| Campo | Tipo | Nullable | Significado |
|-------|------|----------|-------------|
| `id` | SERIAL | NO | PK |
| `nombre` | VARCHAR(200) | NO | Nombre del conjunto de frases |
| `descripcion` | TEXT | SÍ | Descripción opcional |
| `frases_por_nivel` | JSONB | NO | Estructura: `{"1": ["frase 1", ...], "2": [...], ...}` |
| `deleted_at` | TIMESTAMPTZ | SÍ | Soft delete (NULL = activo) |
| `created_at` | TIMESTAMPTZ | NO | Fecha creación |
| `updated_at` | TIMESTAMPTZ | NO | Fecha actualización |

### 7.3 Evaluación para Motores

**✅ Puede ser consumido por motores:** SÍ

**Campos disponibles para motores:**
- ✅ **Filtrar por nivel:** Lógica en resolver (usa `frases_por_nivel` JSONB)
- ❌ **Marcar obligatorios:** No aplica (frases son opcionales)
- ❌ **Ordenar por prioridad:** No aplica (selección aleatoria)
- ✅ **Limitar cantidad:** Sí (selección aleatoria de 1)

**Motores que pueden usarlo:**
- `motor_frases_personalizadas`
- `motor_mensajes_motivacionales`

**Limitaciones:**
- Lógica de nivel vive en el resolver, no en la tabla
- Selección aleatoria dentro del pool permitido

**Acción requerida:** ✅ **Ninguna** - Ya está listo para motores

---

## 8. MÚSICAS DE MEDITACIÓN

### 8.1 Identificación Técnica

- **URL Admin:** `https://admin.pdeeugenihidalgo.org/admin/recursos-tecnicos/musicas`
- **Tabla PostgreSQL:** `musicas_meditacion`
- **Migración:** Creada en `database/pg.js` (líneas 1511-1545)
- **Repositorio:** `src/services/musicas-meditacion.js`
- **Endpoints API:**
  - `/api/musicas-meditacion` (GET, POST)
  - `/api/musicas-meditacion/:id` (GET, PUT, DELETE)
- **UI Admin:** `src/endpoints/admin-recursos-tecnicos.js`

### 8.2 Inventario de Campos

| Campo | Tipo | Nullable | Significado |
|-------|------|----------|-------------|
| `id` | SERIAL | NO | PK |
| `nombre` | VARCHAR(255) | NO | Nombre de la música |
| `descripcion` | TEXT | SÍ | Descripción opcional |
| `archivo_path` | TEXT | SÍ | Ruta del archivo MP3 |
| `url_externa` | TEXT | SÍ | URL externa opcional |
| `duracion_segundos` | INTEGER | SÍ | Duración en segundos |
| `peso_mb` | DECIMAL(10,2) | SÍ | Peso en MB |
| `categoria` | VARCHAR(100) | SÍ | Categoría de la música |
| `es_por_defecto` | BOOLEAN | SÍ | Música por defecto (default: false) |
| `activo` | BOOLEAN | SÍ | Soft delete (default: true) |
| `created_at` | TIMESTAMP | SÍ | Fecha creación |
| `updated_at` | TIMESTAMP | SÍ | Fecha actualización |

### 8.3 Evaluación para Motores

**✅ Puede ser consumido por motores:** SÍ

**Campos disponibles para motores:**
- ❌ **Filtrar por nivel:** No aplica (músicas no tienen nivel)
- ❌ **Marcar obligatorios:** No aplica
- ✅ **Ordenar por prioridad:** No aplica (usa `es_por_defecto` y `categoria`)
- ✅ **Limitar cantidad:** Sí
- ✅ **Filtrar por categoría:** `categoria`
- ✅ **Duración:** `duracion_segundos`

**Motores que pueden usarlo:**
- `motor_seleccion_musica`
- `motor_reloj_meditacion`

**Acción requerida:** ✅ **Ninguna** - Ya está listo para motores

---

## 9. TONOS DE MEDITACIÓN

### 9.1 Identificación Técnica

- **URL Admin:** `https://admin.pdeeugenihidalgo.org/admin/recursos-tecnicos/tonos`
- **Tabla PostgreSQL:** `tonos_meditacion`
- **Migración:** Creada en `database/pg.js` (líneas 1547-1568)
- **Repositorio:** `src/services/tonos-meditacion.js`
- **Endpoints API:**
  - `/api/tonos-meditacion` (GET, POST)
  - `/api/tonos-meditacion/:id` (GET, PUT, DELETE)
- **UI Admin:** `src/endpoints/admin-recursos-tecnicos.js`

### 9.2 Inventario de Campos

| Campo | Tipo | Nullable | Significado |
|-------|------|----------|-------------|
| `id` | SERIAL | NO | PK |
| `nombre` | VARCHAR(255) | NO | Nombre del tono |
| `descripcion` | TEXT | SÍ | Descripción opcional |
| `archivo_path` | TEXT | SÍ | Ruta del archivo MP3 |
| `url_externa` | TEXT | SÍ | URL externa opcional |
| `duracion_segundos` | INTEGER | SÍ | Duración en segundos |
| `peso_mb` | DECIMAL(10,2) | SÍ | Peso en MB |
| `categoria` | VARCHAR(100) | SÍ | Categoría del tono |
| `es_por_defecto` | BOOLEAN | SÍ | Tono por defecto (default: false) |
| `activo` | BOOLEAN | SÍ | Soft delete (default: true) |
| `created_at` | TIMESTAMP | SÍ | Fecha creación |
| `updated_at` | TIMESTAMP | SÍ | Fecha actualización |

### 9.3 Evaluación para Motores

**✅ Puede ser consumido por motores:** SÍ

**Campos disponibles para motores:**
- ❌ **Filtrar por nivel:** No aplica (tonos no tienen nivel)
- ❌ **Marcar obligatorios:** No aplica
- ✅ **Ordenar por prioridad:** No aplica (usa `es_por_defecto` y `categoria`)
- ✅ **Limitar cantidad:** Sí
- ✅ **Filtrar por categoría:** `categoria`
- ✅ **Duración:** `duracion_segundos`

**Motores que pueden usarlo:**
- `motor_seleccion_tono`
- `motor_reloj_meditacion`

**Acción requerida:** ✅ **Ninguna** - Ya está listo para motores

---

## 🔧 NORMALIZACIÓN REQUERIDA

### Campos a Añadir

#### 1. Técnicas de Limpieza (`tecnicas_limpieza`)
- `prioridad` VARCHAR(10) DEFAULT 'media' CHECK (prioridad IN ('alta', 'media', 'bajo'))
- `is_obligatoria` BOOLEAN DEFAULT false

#### 2. Preparaciones Práctica (`preparaciones_practica`)
- `prioridad` VARCHAR(10) DEFAULT 'media' CHECK (prioridad IN ('alta', 'media', 'bajo'))

#### 3. Técnicas Post-práctica (`tecnicas_post_practica`)
- `prioridad` VARCHAR(10) DEFAULT 'media' CHECK (prioridad IN ('alta', 'media', 'bajo'))

#### 4. Protecciones Energéticas (`protecciones_energeticas`)
- `nivel_minimo` INTEGER DEFAULT 1
- `prioridad` VARCHAR(10) DEFAULT 'media' CHECK (prioridad IN ('alta', 'media', 'bajo'))
- `is_obligatoria` BOOLEAN DEFAULT false

#### 5. Decretos (`decretos`) - OPCIONAL
- `prioridad` VARCHAR(10) DEFAULT 'media' CHECK (prioridad IN ('alta', 'media', 'bajo'))

---

## 📝 NOTAS DE DISEÑO

### Principios de Normalización

1. **Prioridad:** Campo estándar `prioridad` con valores: 'alta', 'media', 'bajo'
2. **Obligatoriedad:** Campo `is_obligatoria` (BOOLEAN) o usar `obligatoria_global` existente
3. **Nivel:** Campo `nivel` o `nivel_minimo` según contexto
4. **Orden:** Campo `orden` (INTEGER) para ordenamiento secundario
5. **Soft Delete:** Campo `activo` (BOOLEAN) o `deleted_at` (TIMESTAMP)

### Convenciones de Nombres

- **Nivel mínimo:** `nivel` o `nivel_minimo` según tabla
- **Prioridad:** Siempre `prioridad` (VARCHAR(10))
- **Obligatoriedad:** `is_obligatoria` (BOOLEAN) o `obligatoria_global` (BOOLEAN)
- **Orden:** `orden` (INTEGER)
- **Duración:** `minutos` (INTEGER) o `duracion_segundos` (INTEGER)

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

- [ ] Crear migración SQL para normalización
- [ ] Aplicar migración a base de datos
- [ ] Actualizar servicios para incluir nuevos campos
- [ ] Actualizar UI Admin para exponer nuevos campos
- [ ] Actualizar endpoints API
- [ ] Verificar compatibilidad con código existente
- [ ] Documentar cambios en este documento

---

**Última actualización:** 2025-01-XX  
**Versión del documento:** v1.0.0  
**Mantenido por:** Arquitecto Técnico Principal AuriPortal




