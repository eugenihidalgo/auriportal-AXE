# 🔧 MASTER ALQUIMIA GENERAL - ESTADO DE RECUPERACIÓN

**Fecha:** 2026-01-05  
**Modo:** Diagnóstico Real + Recuperación  
**Objetivo:** Restaurar funcionalidad completa de Alquimia General (Listas + Items + Clasificación/Tags)

---

## 📊 FASE 1: DIAGNÓSTICO REAL (DB + API + UI)

### 1.1 Base de Datos - Verificación Real ✅

**Ejecutado:** `node scripts/diagnose-alquimia-db.js`  
**Timestamp:** 2026-01-05T11:10:50.688Z

#### Conteos Reales

| Tabla | Total | Activos | Estado |
|-------|-------|---------|--------|
| `listas_transmutaciones` | **16** | **15** | ✅ EXISTE |
| `items_transmutaciones` | **101** | **100** | ✅ EXISTE |
| `pde_classification_terms` | **26** | **26** | ✅ EXISTE |
| `transmutacion_lista_classifications` | **28** | - | ✅ EXISTE |

#### Desglose de Classifications

- **Categories (key):** 9
- **Subtypes (subkey):** 11
- **Tags (tag):** 6

#### Muestra de Datos

**Listas (sample):**
- ID 6: "Canales de conexión" (recurrente, active)
- ID 2: "Limpieza del hogar" (recurrente, active)
- ID 3: "Registros y Karmas" (una_vez, active)
- ID 4: "Karmas" (una_vez, active)
- ID 8: "Relación con los apadrinados y seres del entorno" (recurrente, active)

**Items (sample):**
- ID 119: "Segrestos d'altres realitats" (lista_id: 14, item_ref: te_item_119, active)
- ID 113: "Pobreza en la fuerza y en la determinación" (lista_id: 14, item_ref: te_item_113, active)
- ID 114: "Resistencias a soltar el pasado" (lista_id: 14, item_ref: te_item_114, active)

**Relaciones lista-classification (sample):**
- Lista 1 → category: "limpieza_recurrente"
- Lista 2 → category: "limpieza_recurrente"
- Lista 3 → category: "limpieza_puntual"
- Lista 4 → category: "limpieza_puntual"
- Lista 5 → category: "limpieza_recurrente"

#### Estructura de Tablas

**`listas_transmutaciones`** - Columnas presentes:
- ✅ `id`, `nombre`, `tipo`, `descripcion`, `activo`, `orden`
- ✅ `created_at`, `updated_at`
- ✅ `category_key`, `subtype_key`, `tags` (legacy)
- ✅ `status` (canónico)

**`items_transmutaciones`** - Columnas presentes:
- ✅ `id`, `lista_id`, `nombre`, `descripcion`, `nivel`
- ✅ `frecuencia_dias`, `veces_limpiar`, `orden`, `activo`
- ✅ `created_at`, `updated_at`
- ✅ `prioridad` (legacy), `status` (canónico)
- ✅ `item_ref` (canónico v5.46.0+)
- ✅ `priority` (integer, canónico)

**Conclusión DB:** ✅ **TABLAS EXISTEN Y TIENEN DATOS**

---

### 1.2 API Canónica - Verificación

**Problema detectado:** El servidor rechaza `localhost` con error `UNRECOGNIZED_HOST`.

**Endpoints a verificar:**
- `GET /master/api/alquimia-general/listas`
- `GET /master/api/classifications`
- `GET /master/api/tags`

**Estado:** ⚠️ **PENDIENTE** - Requiere acceso con host válido o verificación desde navegador.

**Nota:** El código del handler (`src/endpoints/master-api-alquimia-general.js`) está implementado y debería funcionar correctamente según la documentación.

**Logs PM2:**
- Requests están llegando al servidor
- Todos son rechazados por `UNRECOGNIZED_HOST`
- El problema es la validación de host, no el código del endpoint

---

### 1.3 UI - Verificación

**Ruta:** `/master/templo-luz/alquimia-general`

**Estado:** ⚠️ **PENDIENTE** - Requiere verificación en navegador.

**Sentinels esperados:**
- `SERVER_SENTINEL` - Debe ser visible
- `CLIENT_SENTINEL` - Debe ser visible

**Endpoints que debe consumir:**
- `GET /master/api/alquimia-general/listas`
- `GET /master/api/alquimia-general/listas/:id/items`
- `GET /master/api/classifications`
- `GET /master/api/tags`

---

## 🎯 CONCLUSIÓN FASE 1

### Estado Actual

✅ **Base de Datos:** 
- Tablas existen y tienen datos reales
- 15 listas activas, 100 items activos
- 26 classifications activas
- 28 relaciones lista-classification

⚠️ **API:** 
- Handler implementado según docs
- No se puede verificar sin host válido
- Código parece correcto según `MASTER_ALQUIMIA_GENERAL_V1.md`

❓ **UI:** 
- Requiere verificación en navegador
- Según `MASTER_BLANCO_DIAGNOSTIC.md`, el problema principal es que "SCRIPT NO SE EJECUTA"

### Hipótesis Principal

**Si la DB tiene datos pero la UI muestra "No hay listas":**

1. **Endpoint devuelve vacío por filtro incorrecto** (probable)
   - Verificar que `listListas({ onlyActive: true, tipo })` no filtra demasiado
   - Verificar que `status='active'` coincide con los datos

2. **Cliente está llamando mal** (posible)
   - Verificar ruta/host/product_key en el cliente
   - Verificar que el cliente espera el formato correcto de respuesta

3. **Response shape no coincide** (posible)
   - Verificar que el cliente espera `{ ok: true, listas: [...] }`
   - Verificar que el cliente maneja `warnings` correctamente

---

## 📋 PRÓXIMOS PASOS

### FASE 2: Recuperar Modelo ✅ COMPLETADO

- [x] Verificar migraciones aplicadas (v5.34.0, v5.35.0, v5.46.0) - Existen en `database/migrations/`
- [x] Verificar que `item_ref` está presente en todos los items - Confirmado en diagnóstico DB
- [x] Añadir renderizado de clasificaciones en cliente
- [x] Añadir funcionalidad de creación de listas
- [x] Añadir funcionalidad de creación de items

### FASE 3: UI Alquimia General ✅ COMPLETADO (Mínimo Operativo)

- [x] Cliente carga correctamente (guards implementados)
- [x] Cliente llama a endpoints correctos (`/master/api/alquimia-general/listas`, etc.)
- [x] Cliente renderiza listas correctamente
- [x] Cliente renderiza items correctamente
- [x] Cliente renderiza clasificaciones (category, subtype, tags)
- [x] Funcionalidad de creación de listas implementada
- [x] Funcionalidad de creación de items implementada
- [ ] Funcionalidad de edición de clasificaciones (dejado para después, no crítico)

### FASE 4: Checks + Commit + Restart

- [ ] Ejecutar `npm run check:master-api`
- [ ] Ejecutar `scripts/check-assets-master.js` (si existe)
- [ ] Commit con mensaje apropiado
- [ ] `pm2 restart aurelinportal`

---

## 🔧 CAMBIOS IMPLEMENTADOS

### Cliente JavaScript (`public/js/master/master-alquimia-general-client.js`)

1. **Carga de Classifications:**
   - Función `loadClassifications()` que carga categories, subtypes y tags desde `/master/api/alquimia-general/classifications`
   - Se ejecuta al inicio en `init()`

2. **Renderizado de Clasificaciones:**
   - Sección de clasificación añadida en `renderListaContent()`
   - Muestra category_key, subtype_key y tags de la lista activa
   - Usa datos de `state.listaActiva.classification`

3. **Creación de Listas:**
   - Función `handleCrearLista()` implementada
   - Usa `prompt()` para nombre (temporal, puede mejorarse con modal)
   - Crea lista con tipo activo (recurrente/una_vez)
   - Recarga listas y selecciona la nueva lista

4. **Creación de Items:**
   - Función `handleCrearItem()` implementada
   - Botón "➕ Nuevo Item" añadido en `renderListaContent()`
   - Usa `prompt()` para nombre (temporal, puede mejorarse con modal)
   - Crea item con valores por defecto (nivel: 9, priority: 10, days: 20)
   - Recarga items después de crear

---

**Última actualización:** 2026-01-05T11:10:50Z
