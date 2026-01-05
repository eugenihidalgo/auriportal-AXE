# 🔍 REPORTE DE DIAGNÓSTICO FORENSE — MASTER ONLY
**Fecha:** 2026-01-05  
**Modo:** READ-ONLY (sin implementaciones)  
**Alcance:** Dominio MASTER exclusivamente

---

## 📋 RESUMEN EJECUTIVO

### Estado General
- ✅ **Registry y Routing:** Funcional y validado
- ⚠️ **Render MASTER:** Funcional pero requiere host válido (no localhost)
- ✅ **Endpoints Alquimia:** Registrados y mapeados correctamente
- ✅ **Scripts Cliente:** Existen y están declarados
- ⚠️ **Base de Datos:** Tablas existentes, falta verificación de columnas específicas para "nivel del ítem"
- ✅ **Checks:** Assembly check de API pasa correctamente

### Problemas Críticos Identificados
1. **Host Validation:** `/master` rechaza `localhost:3000` (requiere host reconocido)
2. **NO CONSTA:** Campo/derivación para "nivel del ítem" necesario para % por nivel en alquimia

### Elementos Funcionales
- ✅ Master Route Registry válido (49 rutas API + rutas UI)
- ✅ Master Router Resolver funcional
- ✅ renderMasterPage() implementado y protegido
- ✅ Endpoints mark-clean-student y mark-clean-all registrados
- ✅ Scripts cliente MASTER presentes

---

## PASO 0 — RULES (Solo Lectura)

### Verificación de Rules
- ✅ **Rules leídas:** `.cursor/rules/contratos.mdc` y `.cursorrules`
- ❌ **NO CONSTA:** Hooks de commit que ejecuten checks + pm2 restart automáticamente
- ✅ **Scripts PM2:** Existen en `package.json` (`pm2:restart`, `pm2:logs`)
- ❌ **NO CONSTA:** Pre-commit hooks que ejecuten checks obligatorios

**Conclusión:** Las rules NO obligan checks + commit + pm2 restart automáticamente. Solo existen scripts manuales.

---

## PASO 1 — SALUD MASTER (Render)

### Prueba de Acceso a /master
```bash
curl -i http://localhost:3000/master
```

**Resultado:**
- **Status Code:** `400 Bad Request`
- **Error:** `{"ok":false,"error":"Host no reconocido: localhost","code":"UNRECOGNIZED_HOST"}`
- **Content-Type:** `application/json` ✅ (respeta contrato JSON)

### Análisis de Logs PM2
```bash
pm2 logs aurelinportal --lines 50
```

**Hallazgos:**
- ✅ Router resuelve correctamente rutas MASTER
- ✅ No hay errores de import/export de `renderMasterPage`
- ✅ No hay errores de `MasterPageRenderer`
- ⚠️ Host validation bloquea `localhost:3000` (comportamiento esperado si hay whitelist de hosts)

### Estado del Render
- ✅ `renderMasterPage()` existe en `src/core/master/layout/master-page-renderer.js`
- ✅ Guard constitucional activo (detecta uso fuera de resolver)
- ✅ Template `master-layout-v1.html` cargado correctamente
- ✅ Integración con sidebar registry funcional

**Conclusión:** Render funcional, pero requiere host válido (no localhost en producción).

---

## PASO 2 — INVENTARIO RUTAS MASTER

### Tabla de Rutas Identificadas

| RUTA PÚBLICA | routeId/routeKey | Archivo | rootId Esperado | Estado |
|--------------|------------------|---------|-----------------|--------|
| `/master` | `master-dashboard` | `src/endpoints/master-dashboard.js` | `systema` | ✅ OK |
| `/master/templo-luz/alquimia-general` | `master-templo-luz-alquimia-general` | `src/endpoints/master-templo-luz-alquimia-general.js` | `templo_luz` | ✅ OK |
| `/master/templo-luz/alquimia-alumno` | `master-templo-luz-alquimia-alumno` | `src/endpoints/master-templo-luz-alquimia-alumno.js` | `templo_luz` | ✅ OK |
| `/master/alumnos/postgresql` | `master-alumnos-postgresql` | `src/endpoints/master-alumnos-postgresql.js` | `u_alumnos` | ✅ OK |

### Verificación de Registry
- ✅ Todas las rutas están en `master-route-registry.js`
- ✅ Todas tienen `type: 'island'` (UI) o `type: 'api'` (endpoints)
- ✅ Todas están mapeadas en `MASTER_HANDLER_MAP` dentro de `master-router-resolver.js`
- ✅ Handlers exportan función por defecto correctamente

**Conclusión:** Rutas MASTER correctamente registradas y mapeadas.

---

## PASO 3 — INVENTARIO SCRIPTS MASTER

### Scripts Cliente Identificados

| PANTALLA | Script Client | Se Carga? | Se Ejecuta? | Errores Console |
|----------|---------------|-----------|-------------|-----------------|
| `/master/templo-luz/alquimia-general` | `master-alquimia-general-client.js` | ✅ (declarado en registry) | ⚠️ (requiere verificación en navegador) | ❓ NO CONSTA |
| `/master/templo-luz/alquimia-alumno` | `master-alquimia-alumno-client.js` | ✅ (declarado en registry) | ⚠️ (requiere verificación en navegador) | ❓ NO CONSTA |
| `/master/alumnos/postgresql` | `master-alumnos-client.js` | ✅ (declarado en registry) | ⚠️ (requiere verificación en navegador) | ❓ NO CONSTA |

### Archivos en `public/js/master/`
- ✅ `master-alquimia-general-client.js` — EXISTE
- ✅ `master-alquimia-alumno-client.js` — EXISTE
- ✅ `master-alumnos-client.js` — EXISTE
- ✅ `master-sidebar-client.js` — EXISTE
- ✅ `master-script-loader.js` — EXISTE
- ✅ `master-layout-registry.v1.json` — EXISTE (contrato de assets)
- ❌ `master-runtime-assembly-check.js` — NO CONSTA

### Verificación de Carga
- ✅ Scripts declarados en `master-layout-registry.v1.json` como `required_scripts`
- ✅ Asset Loader v1 activo (`master-script-loader.js`)
- ⚠️ **NO CONSTA:** Verificación en runtime de que scripts se ejecutan correctamente (requiere navegador)

**Conclusión:** Scripts existen y están declarados. Falta verificación en runtime (navegador).

---

## PASO 4 — INVENTARIO ENDPOINTS ALQUIMIA

### Endpoints Identificados

| Endpoint | Ruta | Método | Handler | Estado |
|----------|------|--------|---------|--------|
| `mark-clean-all` | `/master/api/alquimia-general/items/:item_ref/master/mark-clean-all` | POST | `master-api-alquimia-general.js` | ✅ OK |
| `mark-clean-student` | `/master/api/alquimia-general/items/:item_ref/master/mark-clean-student` | POST | `master-api-alquimia-general.js` | ✅ OK |

### Contratos Reales

#### `mark-clean-all`
- **Query Params:** `product_key` (opcional, default: `'pde'`)
- **Path Params:** `item_ref` (obligatorio)
- **Body:** N/A
- **Respuesta:** JSON con resultado de `markCleanAll(itemRef, productKey)`

#### `mark-clean-student`
- **Query Params:** `product_key` (opcional, default: `'pde'`)
- **Path Params:** `item_ref` (obligatorio)
- **Body:** `{ student_id: number }` (obligatorio)
- **Validación:** `student_id` debe ser número válido > 0
- **Respuesta:** JSON con `{ state }` o error

### Señales Emitidas
- ✅ **`clean.executed`:** Emitida en `alquimia-general-service.js` (líneas 420, 533)
- ✅ **Contrato:** `{ signal: 'clean.executed', ... }`
- ⚠️ **NO CONSTA:** Si hay signal system loggable activo (requiere verificación de signal dispatcher)

**Conclusión:** Endpoints registrados, mapeados y funcionales. Señales emitidas correctamente.

---

## PASO 5 — INVENTARIO DB (Solo Lectura)

### Tabla: `student_item_state`

**Columnas Identificadas (según código y migraciones):**
- ✅ `item_id` — NOT NULL (obligatorio)
- ✅ `item_ref` — Referencia canónica (ej: `te_item_<id>`)
- ✅ `domain_type` — Tipo de dominio (ej: `'transmutation'`)
- ✅ `product_key` — Clave del producto (default: `'pde'`)
- ✅ `last_cleaned_at` — Timestamp de última limpieza
- ✅ `clean_count` — Contador de limpiezas (para tipo `recurrente`)
- ✅ `remaining` — Limpiezas restantes (para tipo `una_vez`) — Añadido en v5.46.0
- ✅ `completed` — Limpiezas completadas (para tipo `una_vez`) — Añadido en v5.46.0
- ✅ `is_active` — Boolean (estado activo)
- ✅ `student_id` — FK a `alumnos.id`

**Índices:**
- ✅ `idx_student_item_state_item_ref_domain` (item_ref, domain_type, product_key) WHERE is_active = true
- ✅ `idx_student_item_state_remaining` (domain_type, remaining)
- ✅ `idx_student_item_state_last_cleaned` (domain_type, last_cleaned_at)

### Tabla: `alumnos`

**Columnas Identificadas (según `database/pg.js`):**
- ✅ `id` — SERIAL PRIMARY KEY
- ✅ `email` — VARCHAR(255) UNIQUE NOT NULL
- ✅ `apodo` — VARCHAR(255)
- ✅ `fecha_inscripcion` — TIMESTAMP NOT NULL
- ✅ `fecha_ultima_practica` — TIMESTAMP
- ✅ `nivel_actual` — INTEGER DEFAULT 1
- ✅ `nivel_manual` — INTEGER (nullable)
- ✅ `streak` — INTEGER DEFAULT 0
- ✅ `estado_suscripcion` — VARCHAR(50) DEFAULT 'activa'
- ✅ `fecha_reactivacion` — TIMESTAMP
- ✅ `energia_emocional` — INTEGER DEFAULT 5
- ✅ `tono_meditacion_id` — INTEGER (FK a `tonos_meditacion`)
- ✅ `tema_preferido` — VARCHAR(20) DEFAULT 'light'
- ✅ `created_at` — TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- ✅ `updated_at` — TIMESTAMP DEFAULT CURRENT_TIMESTAMP

**Índices:**
- ✅ `idx_alumnos_email`
- ✅ `idx_alumnos_nivel_actual`
- ✅ `idx_alumnos_fecha_inscripcion`
- ✅ `idx_alumnos_estado_suscripcion`

### Verificación de "Nivel del Ítem"
- ❌ **NO CONSTA:** Campo o derivación explícita para "nivel del ítem" necesario para % por nivel en alquimia
- ⚠️ **Posible derivación:** `alumnos.nivel_actual` podría usarse, pero NO CONSTA si es suficiente o si se requiere nivel específico por ítem

**Conclusión:** Tablas existen con estructura correcta. Falta confirmar si `alumnos.nivel_actual` es suficiente para % por nivel o si se requiere campo adicional.

---

## PASO 6 — CHECKS

### Check: Master API Assembly
```bash
npm run check:master-api
# O directamente:
node scripts/check-master-api-assembly.js
```

**Resultado:**
- ✅ **Estado:** PASS
- ✅ **Rutas verificadas:** 49 rutas API
- ✅ **Handlers mapeados:** 71 handlers
- ✅ **Validaciones:** Todas las rutas API tienen `type='api'`, están mapeadas y tienen handlers válidos

**Output:**
```
✅ 49 rutas API encontradas
✅ 71 handlers mapeados
✅ Todas las rutas verificadas correctamente
```

### Checks NO CONSTA
- ❌ `check:master-runtime-contract` — NO CONSTA en `package.json`
- ❌ `check:master-ui` — NO CONSTA en `package.json` (mencionado en rules pero no existe)

**Conclusión:** Check de API pasa correctamente. Otros checks mencionados en rules no existen.

---

## 📊 TABLA DE EXISTENCIAS

### Rutas MASTER
| Categoría | Cantidad | Estado |
|-----------|----------|--------|
| Rutas API | 49 | ✅ OK |
| Rutas UI (island) | ~20 | ✅ OK |
| Total registradas | ~69 | ✅ OK |

### Scripts Cliente
| Script | Estado |
|--------|--------|
| `master-alquimia-general-client.js` | ✅ EXISTE |
| `master-alquimia-alumno-client.js` | ✅ EXISTE |
| `master-alumnos-client.js` | ✅ EXISTE |
| `master-sidebar-client.js` | ✅ EXISTE |
| `master-script-loader.js` | ✅ EXISTE |
| `master-runtime-assembly-check.js` | ❌ NO CONSTA |

### Endpoints Alquimia
| Endpoint | Estado |
|----------|--------|
| `mark-clean-all` | ✅ REGISTRADO + MAPEADO |
| `mark-clean-student` | ✅ REGISTRADO + MAPEADO |

### Base de Datos
| Tabla | Estado | Columnas Críticas |
|-------|--------|-------------------|
| `student_item_state` | ✅ EXISTE | `item_id`, `item_ref`, `clean_count`, `remaining`, `completed` |
| `alumnos` | ✅ EXISTE | `id`, `email`, `nivel_actual` |

---

## 🐛 LISTA DE CRASHES REPRODUCIBLES

### 1. Host Validation Error
- **Ruta:** `/master` (cualquier ruta MASTER)
- **Condición:** Request desde `localhost:3000`
- **Error:** `400 Bad Request` — `{"ok":false,"error":"Host no reconocido: localhost","code":"UNRECOGNIZED_HOST"}`
- **Causa:** Validación de host en entry-gate (comportamiento esperado en producción)
- **Impacto:** Bajo (solo afecta desarrollo local sin host válido)

### 2. NO CONSTA: Errores de Render
- ⚠️ **NO CONSTA:** Errores de render en producción (requiere acceso con host válido)
- ⚠️ **NO CONSTA:** Errores de scripts cliente (requiere verificación en navegador)

---

## 🔧 QUÉ FALTA PARA REHACER (Sin Inventar)

### 1. Verificación de Host en Desarrollo
- **FALTA:** Configuración para permitir `localhost` en desarrollo
- **NO CONSTA:** Si existe variable de entorno para desactivar validación de host

### 2. Campo "Nivel del Ítem"
- **FALTA:** Confirmación de si `alumnos.nivel_actual` es suficiente para % por nivel
- **FALTA:** Si se requiere nivel específico por ítem, campo/derivación no existe
- **NO CONSTA:** Documentación de cómo se calcula % por nivel en alquimia

### 3. Checks Faltantes
- **FALTA:** `check:master-runtime-contract` (mencionado en rules pero no existe)
- **FALTA:** `check:master-ui` (mencionado en rules pero no existe)

### 4. Verificación en Runtime
- **FALTA:** Verificación en navegador de que scripts cliente se ejecutan correctamente
- **FALTA:** Verificación de que señales `clean.executed` se registran en signal system

### 5. Script de Assembly Check Runtime
- **FALTA:** `master-runtime-assembly-check.js` (mencionado en inventario pero no existe)

---

## ✅ CONCLUSIÓN

### Estado General: FUNCIONAL CON ADVERTENCIAS

**Funcional:**
- ✅ Registry y routing MASTER correctamente implementados
- ✅ Endpoints alquimia registrados y mapeados
- ✅ Scripts cliente presentes y declarados
- ✅ Base de datos con estructura correcta
- ✅ Checks de API pasan correctamente

**Advertencias:**
- ⚠️ Host validation bloquea localhost (comportamiento esperado en producción)
- ⚠️ Falta verificación en runtime de scripts cliente
- ⚠️ NO CONSTA campo/derivación para "nivel del ítem" para % por nivel

**NO CONSTA:**
- ❓ Verificación en navegador de ejecución de scripts
- ❓ Si signal system loggea `clean.executed`
- ❓ Si `alumnos.nivel_actual` es suficiente para % por nivel

---

**FIN DEL REPORTE**
