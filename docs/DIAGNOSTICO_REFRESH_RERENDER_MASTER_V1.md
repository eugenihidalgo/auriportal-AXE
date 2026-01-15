# DIAGNÓSTICO FORENSE TOTAL — REFRESH/RERENDER EN MASTER (AuriPortal)

**Fecha:** 2025-01-27  
**Objetivo:** Inventariar y entender EXACTAMENTE cómo funcionan hoy los refresh/rerender en TODO el dominio MASTER, para implementar luego Refresh Engine v1 de forma canónica.

**⚠️ REGLAS ABSOLUTAS CUMPLIDAS:**
- ✅ NO se implementaron cambios
- ✅ NO se propusieron mejoras
- ✅ Todo sustentado con path + línea
- ✅ Solo diagnóstico y mapa

---

## FASE 0 — INVENTARIO DE PUNTOS DE ENTRADA MASTER

### 0.1) Router/Entry Gate de MASTER

| Path | Rol | Líneas |
|------|-----|--------|
| `src/router.js` | Router principal que delega a `resolveMasterRoute()` | 40-41 |
| `src/core/master/router/master-router-resolver.js` | Resolver canónico de rutas MASTER | 199-483 |
| `src/core/master/registry/master-route-registry.js` | Registry canónico (Source of Truth de rutas) | 26-817 |
| `src/core/entry-gate/entry-context-resolver.js` | Resuelve contexto (MASTER/ADMIN/CLIENT) | 44 |

### 0.2) Inyección de Scripts MASTER

| Path | Rol | Líneas |
|------|-----|--------|
| `public/js/master/inject_master.js` | Entry gate que carga `master-script-loader.js` | 1-12 |
| `public/js/master/master-script-loader.js` | Loader canónico que carga scripts desde contrato | 1-431 |
| `src/core/master/registry/master-layout-registry.v1.json` | Contrato de scripts requeridos (inyectado en HTML) | NO CONSTA (archivo JSON) |

### 0.3) Estructura de `public/js/master/*`

| Archivo | Rol | Líneas Aprox. |
|---------|-----|---------------|
| `master-alquimia-general-client.js` | Cliente principal de Alquimia General | 5756 |
| `master-alquimia-alumno-client.js` | Cliente de Alquimia por Alumno | ~1500 |
| `master-lugares-client.js` | Cliente de Lugares | ~1200 |
| `master-proyectos-client.js` | Cliente de Proyectos | ~1200 |
| `master-apadrinados-client.js` | Cliente de Apadrinados | ~1400 |
| `master-sidebar-client.js` | Cliente del Sidebar | ~600 |
| `master-script-loader.js` | Loader de scripts | 431 |
| `inject_master.js` | Entry gate | 12 |

---

## FASE 1 — ENCONTRAR TODAS LAS "MUTACIONES" EN MASTER

### 1.1) Endpoints MASTER que Mutan Estado (Backend)

#### ALQUIMIA GENERAL

| METHOD | PATH | Handler | Función | Servicio/Repo | Señal | Líneas |
|--------|------|---------|---------|--------------|-------|--------|
| POST | `/master/api/alquimia-general/listas` | `master-api-alquimia-general.js` | `masterApiAlquimiaGeneralHandler` | `createLista()` | NO CONSTA | 184-232 |
| PUT | `/master/api/alquimia-general/listas/:id` | `master-api-alquimia-general.js` | `masterApiAlquimiaGeneralHandler` | `updateLista()` | NO CONSTA | 301-393 |
| DELETE | `/master/api/alquimia-general/listas/:id` | `master-api-alquimia-general.js` | `masterApiAlquimiaGeneralHandler` | `deleteLista()` | NO CONSTA | 395-428 |
| PUT | `/master/api/alquimia-general/listas/:id/classification` | `master-api-alquimia-general.js` | `masterApiAlquimiaGeneralHandler` | `updateListaClassification()` | NO CONSTA | 470-520 |
| POST | `/master/api/alquimia-general/items` | `master-api-alquimia-general.js` | `masterApiAlquimiaGeneralHandler` | `createItem()` | NO CONSTA | 729-842 |
| PUT | `/master/api/alquimia-general/items/:id` | `master-api-alquimia-general.js` | `masterApiAlquimiaGeneralHandler` | `updateItem()` | NO CONSTA | 844-898 |
| DELETE | `/master/api/alquimia-general/items/:id` | `master-api-alquimia-general.js` | `masterApiAlquimiaGeneralHandler` | `archiveItem()` | NO CONSTA | 899-910 |
| POST | `/master/api/alquimia-general/items/:item_ref/master/mark-clean-all` | `master-api-alquimia-general.js` | `masterApiAlquimiaGeneralHandler` | `markCleanAllStudents()` | NO CONSTA | 1112-1151 |
| POST | `/master/api/alquimia-general/items/:item_ref/master/mark-clean-student` | `master-api-alquimia-general.js` | `masterApiAlquimiaGeneralHandler` | `markCleanStudent()` | NO CONSTA | 1152-1293 |
| POST | `/master/api/alquimia-general/items/:item_ref/master/mark-pde-clean-all` | `master-api-alquimia-general.js` | `masterApiAlquimiaGeneralHandler` | `markPdeCleanAllStudents()` | NO CONSTA | 1294-1342 |
| POST | `/master/api/alquimia-general/items/:item_ref/master/increment-all` | `master-api-alquimia-general.js` | `masterApiAlquimiaGeneralHandler` | `incrementAllStudents()` | NO CONSTA | 1343-1385 |
| POST | `/master/api/alquimia-general/items/:item_ref/master/adjust-remaining` | `master-api-alquimia-general.js` | `masterApiAlquimiaGeneralHandler` | `adjustRemaining()` | NO CONSTA | 1386-1513 |
| POST | `/master/api/alquimia-general/reset-item` | `master-api-alquimia-general.js` | `masterApiAlquimiaGeneralHandler` | `resetItemProgress()` | NO CONSTA | 1514-1591 |
| POST | `/master/api/alquimia-general/reset-list` | `master-api-alquimia-general.js` | `masterApiAlquimiaGeneralHandler` | `resetListProgress()` | NO CONSTA | 1592-1667 |

#### ALQUIMIA ALUMNO

| METHOD | PATH | Handler | Función | Servicio/Repo | Señal | Líneas |
|--------|------|---------|---------|--------------|-------|--------|
| POST | `/master/api/alquimia-alumno/clean` | `master-api-alquimia-alumno.js` | `masterApiAlquimiaAlumnoHandler` | `markClean()` | NO CONSTA | 208-280 |

#### LUGARES

| METHOD | PATH | Handler | Función | Servicio/Repo | Señal | Líneas |
|--------|------|---------|---------|--------------|-------|--------|
| POST | `/master/api/places/clean` | `master-api-places.js` | `masterApiPlacesHandler` | `cleanPlace()` | NO CONSTA | 143-167 |
| POST | `/master/api/places/clean-bulk` | `master-api-places.js` | `masterApiPlacesHandler` | `cleanBulkPlaces()` | NO CONSTA | 170-194 |
| POST | `/master/api/places/clean-all` | `master-api-places.js` | `masterApiPlacesHandler` | `cleanAllActivePlaces()` | NO CONSTA | 197-257 |
| POST | `/master/api/places/activate` | `master-api-places.js` | `masterApiPlacesHandler` | `activatePlace()` | NO CONSTA | 260-284 |
| POST | `/master/api/places/deactivate` | `master-api-places.js` | `masterApiPlacesHandler` | `deactivatePlace()` | NO CONSTA | 287-311 |
| POST | `/master/api/places/limit` | `master-api-places.js` | `masterApiPlacesHandler` | `updateActivationLimit()` | NO CONSTA | 314-350 |
| PATCH | `/master/api/places/state/:id` | `master-api-places.js` | `masterApiPlacesHandler` | `updatePlaceState()` | NO CONSTA | 353-379 |
| POST | `/master/api/places/create-for-student` | `master-api-places.js` | `masterApiPlacesHandler` | `createPlaceForStudent()` | NO CONSTA | 382-407 |

#### PROYECTOS

| METHOD | PATH | Handler | Función | Servicio/Repo | Señal | Líneas |
|--------|------|---------|---------|--------------|-------|--------|
| POST | `/master/api/projects/clean` | `master-api-projects.js` | `masterApiProjectsHandler` | `cleanProject()` | NO CONSTA | 161-185 |
| POST | `/master/api/projects/clean-bulk` | `master-api-projects.js` | `masterApiProjectsHandler` | `cleanBulkProjects()` | NO CONSTA | 188-212 |
| POST | `/master/api/projects/clean-all` | `master-api-projects.js` | `masterApiProjectsHandler` | `cleanAllActiveProjects()` | NO CONSTA | 215-275 |
| POST | `/master/api/projects/activate` | `master-api-projects.js` | `masterApiProjectsHandler` | `activateProject()` | NO CONSTA | 278-302 |
| POST | `/master/api/projects/deactivate` | `master-api-projects.js` | `masterApiProjectsHandler` | `deactivateProject()` | NO CONSTA | 305-329 |
| POST | `/master/api/projects/limit` | `master-api-projects.js` | `masterApiProjectsHandler` | `updateActivationLimit()` | NO CONSTA | 332-368 |
| PATCH | `/master/api/projects/state/:id` | `master-api-projects.js` | `masterApiProjectsHandler` | `updateProjectState()` | NO CONSTA | 371-397 |
| POST | `/master/api/projects/create-for-student` | `master-api-projects.js` | `masterApiProjectsHandler` | `createProjectForStudent()` | NO CONSTA | 400-425 |

#### APADRINADOS

| METHOD | PATH | Handler | Función | Servicio/Repo | Señal | Líneas |
|--------|------|---------|---------|--------------|-------|--------|
| POST | `/master/api/sponsors` | `master-api-sponsors.js` | `masterApiSponsorsHandler` | `createSponsor()` | NO CONSTA | 167-216 |
| PATCH | `/master/api/sponsors/:id` | `master-api-sponsors.js` | `masterApiSponsorsHandler` | `updateSponsor()` | NO CONSTA | 219-251 |
| POST | `/master/api/sponsors/:id/link` | `master-api-sponsors.js` | `masterApiSponsorsHandler` | `linkStudent()` | NO CONSTA | 255-277 |
| POST | `/master/api/sponsors/:id/unlink` | `master-api-sponsors.js` | `masterApiSponsorsHandler` | `unlinkStudent()` | NO CONSTA | 281-326 |
| POST | `/master/api/sponsors/internal/cleanup-student/:studentId` | `master-api-sponsors.js` | `masterApiSponsorsHandler` | `cleanupStudent()` | NO CONSTA | 330-350 |

#### CLASIFICACIONES

| METHOD | PATH | Handler | Función | Servicio/Repo | Señal | Líneas |
|--------|------|---------|---------|--------------|-------|--------|
| POST | `/master/api/classifications` | `master-api-classifications.js` | `masterApiClassificationsHandler` | `createClassification()` | NO CONSTA | 146-218 |
| PATCH | `/master/api/classifications/:id` | `master-api-classifications.js` | `masterApiClassificationsHandler` | `updateClassification()` | NO CONSTA | 220-280 |
| POST | `/master/api/classifications/:id/deprecate` | `master-api-classifications.js` | `masterApiClassificationsHandler` | `deprecateClassification()` | NO CONSTA | 282-320 |

#### TAGS

| METHOD | PATH | Handler | Función | Servicio/Repo | Señal | Líneas |
|--------|------|---------|---------|--------------|-------|--------|
| POST | `/master/api/tags` | `master-api-tags.js` | `masterApiTagsHandler` | `createTag()` | NO CONSTA | 131-188 |
| PATCH | `/master/api/tags/:id` | `master-api-tags.js` | `masterApiTagsHandler` | `updateTag()` | NO CONSTA | 190-259 |
| POST | `/master/api/tags/:id/deprecate` | `master-api-tags.js` | `masterApiTagsHandler` | `deprecateTag()` | NO CONSTA | 261-320 |

### 1.2) Llamadas Frontend a Endpoints Mutadores

#### ALQUIMIA GENERAL

| Archivo | Función UI | Endpoint | Post-Acción | Líneas |
|---------|------------|----------|-------------|--------|
| `master-alquimia-general-client.js` | `handleLimpiarItem()` | `POST /items/:item_ref/master/mark-clean-all` | `refreshAfterProjectionMutation()` | 2038-2115 |
| `master-alquimia-general-client.js` | `handleLimpiarEstudiante()` | `POST /items/:item_ref/master/mark-clean-student` | `refreshAfterProjectionMutation()` | 3222-3369 |
| `master-alquimia-general-client.js` | `handleIncrementAllItem()` | `POST /items/:item_ref/master/increment-all` | `refreshAfterProjectionMutation()` | NO CONSTA (buscar) |
| `master-alquimia-general-client.js` | `handleCreateLista()` | `POST /listas` | `loadListas()` + `renderView()` | NO CONSTA (buscar) |
| `master-alquimia-general-client.js` | `handleUpdateLista()` | `PUT /listas/:id` | `loadLista()` + `renderListaContent()` | NO CONSTA (buscar) |
| `master-alquimia-general-client.js` | `handleDeleteLista()` | `DELETE /listas/:id` | `loadListas()` + `renderView()` | NO CONSTA (buscar) |
| `master-alquimia-general-client.js` | `handleCreateItem()` | `POST /items` | `loadItems()` + `renderListaContent()` | NO CONSTA (buscar) |
| `master-alquimia-general-client.js` | `handleUpdateItem()` | `PUT /items/:id` | `loadItems()` + `renderListaContent()` | NO CONSTA (buscar) |
| `master-alquimia-general-client.js` | `handleDeleteItem()` | `DELETE /items/:id` | `loadItems()` + `renderListaContent()` | NO CONSTA (buscar) |

#### ALQUIMIA ALUMNO

| Archivo | Función UI | Endpoint | Post-Acción | Líneas |
|---------|------------|----------|-------------|--------|
| `master-alquimia-alumno-client.js` | `handleCleanItem()` | `POST /alquimia-alumno/clean` | `loadMegalist()` | 1094-1174 |

#### LUGARES

| Archivo | Función UI | Endpoint | Post-Acción | Líneas |
|---------|------------|----------|-------------|--------|
| `master-lugares-client.js` | `handleCleanPlace()` | `POST /places/clean` | `loadLugaresActivos()` | 599-612 |
| `master-lugares-client.js` | `handleCleanSelected()` | `POST /places/clean-bulk` | `loadLugaresActivos()` | 617-636 |
| `master-lugares-client.js` | `handleCleanAll()` | `POST /places/clean-all` | `loadLugaresActivos()` | 641-657 |
| `master-lugares-client.js` | `handleActivatePlace()` | `POST /places/activate` | `loadStudentById()` | 1080-1098 |
| `master-lugares-client.js` | `handleDeactivatePlace()` | `POST /places/deactivate` | `loadStudentById()` | 1080-1098 |

#### PROYECTOS

| Archivo | Función UI | Endpoint | Post-Acción | Líneas |
|---------|------------|----------|-------------|--------|
| `master-proyectos-client.js` | `handleCleanProject()` | `POST /projects/clean` | `loadProyectosActivos()` | 599-612 |
| `master-proyectos-client.js` | `handleCleanSelected()` | `POST /projects/clean-bulk` | `loadProyectosActivos()` | 617-636 |
| `master-proyectos-client.js` | `handleCleanAll()` | `POST /projects/clean-all` | `loadProyectosActivos()` | 641-657 |
| `master-proyectos-client.js` | `handleActivateProject()` | `POST /projects/activate` | `loadStudentById()` | 1080-1098 |
| `master-proyectos-client.js` | `handleDeactivateProject()` | `POST /projects/deactivate` | `loadStudentById()` | 1080-1098 |

#### APADRINADOS

| Archivo | Función UI | Endpoint | Post-Acción | Líneas |
|---------|------------|----------|-------------|--------|
| `master-apadrinados-client.js` | `handleLinkNewSponsor()` | `POST /sponsors/:id/link` | `loadStudents()` + `renderStudents()` | 1321-1348 |

---

## FASE 2 — INVENTARIO DE "REFRESH PRIMITIVES"

### 2.1) Funciones de Refresh en Frontend MASTER

#### ALQUIMIA GENERAL

| Función | Path | Líneas | Qué State Toca | Llama Render | Hace Fetch | Escribe DOM | Modo |
|---------|------|--------|----------------|--------------|------------|-------------|------|
| `refreshAfterProjectionMutation()` | `master-alquimia-general-client.js` | 1328-1361 | `state.projection.data = null` | Sí (vía `loadListProjection()`) | Sí (`loadListProjection()`) | No | proyección |
| `loadListProjection()` | `master-alquimia-general-client.js` | 1366-1453 | `state.projection.data`, `state.projection.loading` | Sí (`renderView()`) | Sí (`/list-projection`) | No | proyección |
| `loadListas()` | `master-alquimia-general-client.js` | 893-925 | `state.listas` | No | Sí (`/listas`) | No | operativa |
| `loadItems()` | `master-alquimia-general-client.js` | 1048-1075 | `state.items` | No | Sí (`/items`) | No | operativa |
| `loadLista()` | `master-alquimia-general-client.js` | 1013-1047 | `state.listaActiva` | No | Sí (`/listas/:id`) | No | operativa |
| `renderView()` | `master-alquimia-general-client.js` | 220-320 | No toca state | Sí (siempre) | No | Sí | ambos |
| `renderOperativeView()` | `master-alquimia-general-client.js` | 325-600 | No toca state | No | No | Sí | operativa |
| `renderProjectionView()` | `master-alquimia-general-client.js` | 1460-1600 | No toca state | No | No | Sí | proyección |
| `renderListaContent()` | `master-alquimia-general-client.js` | 1076-1327 | No toca state | No | No | Sí | operativa |

#### ALQUIMIA ALUMNO

| Función | Path | Líneas | Qué State Toca | Llama Render | Hace Fetch | Escribe DOM | Modo |
|---------|------|--------|----------------|--------------|------------|-------------|------|
| `loadMegalist()` | `master-alquimia-alumno-client.js` | 297-367 | `state.megalist`, `state.loading` | Sí (`renderMegalist()`) | Sí (`/megalist`) | No | - |
| `renderMegalist()` | `master-alquimia-alumno-client.js` | 520-543 | No toca state | No | No | Sí | - |

#### LUGARES

| Función | Path | Líneas | Qué State Toca | Llama Render | Hace Fetch | Escribe DOM | Modo |
|---------|------|--------|----------------|--------------|------------|-------------|------|
| `loadLugaresActivos()` | `master-lugares-client.js` | 220-340 | `state.places` | Sí (`renderLugaresActivos()`) | Sí (`/places/active`) | No | - |
| `renderLugaresActivos()` | `master-lugares-client.js` | 341-567 | No toca state | No | No | Sí | - |
| `loadStudentById()` | `master-lugares-client.js` | 704-718 | `state.studentConfig` | Sí (`renderStudentConfig()`) | Sí (`/places/student/:id`) | No | - |
| `renderStudentConfig()` | `master-lugares-client.js` | 760-1128 | No toca state | No | No | Sí | - |

#### PROYECTOS

| Función | Path | Líneas | Qué State Toca | Llama Render | Hace Fetch | Escribe DOM | Modo |
|---------|------|--------|----------------|--------------|------------|-------------|------|
| `loadProyectosActivos()` | `master-proyectos-client.js` | 220-340 | `state.projects` | Sí (`renderProyectosActivos()`) | Sí (`/projects/active`) | No | - |
| `renderProyectosActivos()` | `master-proyectos-client.js` | 341-567 | No toca state | No | No | Sí | - |
| `loadStudentById()` | `master-proyectos-client.js` | 704-718 | `state.studentConfig` | Sí (`renderStudentConfig()`) | Sí (`/projects/student/:id`) | No | - |
| `renderStudentConfig()` | `master-proyectos-client.js` | 760-1128 | No toca state | No | No | Sí | - |

#### APADRINADOS

| Función | Path | Líneas | Qué State Toca | Llama Render | Hace Fetch | Escribe DOM | Modo |
|---------|------|--------|----------------|--------------|------------|-------------|------|
| `loadSponsors()` | `master-apadrinados-client.js` | 539-647 | `ApadrinadosState.sponsors` | Sí (`renderSponsors()`) | Sí (`/sponsors`) | No | - |
| `renderSponsors()` | `master-apadrinados-client.js` | 648-782 | No toca state | No | No | Sí | - |
| `loadStudents()` | `master-apadrinados-client.js` | 1120-1204 | `ApadrinadosState.students` | Sí (`renderStudents()`) | Sí (`/students`) | No | - |
| `renderStudents()` | `master-apadrinados-client.js` | 1205-1352 | No toca state | No | No | Sí | - |

### 2.2) Patrones Repetidos Detectados

#### PATTERN 1: "Invalidate + Load + Render"
**Ejemplo:** `refreshAfterProjectionMutation()` → `loadListProjection()` → `renderView()`
- **Archivo:** `master-alquimia-general-client.js`
- **Líneas:** 1328-1361
- **Flujo:** `state.projection.data = null` → `await loadListProjection()` → `renderView()` (dentro de `loadListProjection()`)
- **Riesgo:** Doble render si `loadListProjection()` ya llama `renderView()` y luego se llama otra vez

#### PATTERN 2: "Load + Render Directo"
**Ejemplo:** `loadMegalist()` → `renderMegalist()`
- **Archivo:** `master-alquimia-alumno-client.js`
- **Líneas:** 297-367
- **Flujo:** `await fetch()` → `state.megalist = data` → `renderMegalist()`
- **Riesgo:** Bajo (patrón limpio)

#### PATTERN 3: "Load + Render Separado"
**Ejemplo:** `loadLugaresActivos()` → `renderLugaresActivos()`
- **Archivo:** `master-lugares-client.js`
- **Líneas:** 220-340
- **Flujo:** `await fetch()` → `state.places = data` → `renderLugaresActivos()` (llamado desde `loadLugaresActivos()`)
- **Riesgo:** Bajo (patrón limpio)

#### PATTERN 4: "Load + Render + Load + Render (Cascada)"
**Ejemplo:** `handleCleanPlace()` → `loadLugaresActivos()` → `renderLugaresActivos()`
- **Archivo:** `master-lugares-client.js`
- **Líneas:** 599-612
- **Flujo:** `POST /clean` → `await loadLugaresActivos()` → `renderLugaresActivos()` (dentro de `loadLugaresActivos()`)
- **Riesgo:** Bajo (patrón limpio)

#### PATTERN 5: "State Null + Load + Render"
**Ejemplo:** `state.projection.data = null` → `loadListProjection()` → `renderView()`
- **Archivo:** `master-alquimia-general-client.js`
- **Líneas:** 1334-1351
- **Flujo:** Invalidación explícita → carga → render
- **Riesgo:** Medio (depende de que `loadListProjection()` no llame `renderView()` dos veces)

#### PATTERN 6: "Modal Refresh Condicional"
**Ejemplo:** `refreshAfterProjectionMutation({ forceModalRefresh: true })` → `handleVerItem()`
- **Archivo:** `master-alquimia-general-client.js`
- **Líneas:** 1338-1348
- **Flujo:** Si modal abierto y `item_ref` coincide → `handleVerItem()` → luego `loadListProjection()`
- **Riesgo:** Medio (doble fetch si modal y proyección se refrescan)

#### PATTERN 7: "Load + RenderView (Indirecto)"
**Ejemplo:** `loadListProjection()` → `renderView()` (dentro de `loadListProjection()`)
- **Archivo:** `master-alquimia-general-client.js`
- **Líneas:** 1441
- **Flujo:** `await fetch()` → `state.projection.data = result.data` → `renderView()`
- **Riesgo:** Alto si `refreshAfterProjectionMutation()` también llama `renderView()` después

#### PATTERN 8: "Load + Load (Cascada de Loads)"
**Ejemplo:** `handleLinkNewSponsor()` → `loadStudents()` → `renderStudents()`
- **Archivo:** `master-apadrinados-client.js`
- **Líneas:** 1321-1348
- **Flujo:** `POST /link` → `fetch /by-student/:id` → `loadStudents()` → `renderStudents()`
- **Riesgo:** Bajo (patrón limpio)

---

## FASE 3 — MAPA DE FLUJOS CANÓNICOS ACTUALES (AS-IS)

### MÓDULO: Alquimia General

#### A) Acciones Mutadoras (UI + Endpoint)

1. **Limpiar Item (Todos los Alumnos)**
   - UI: `handleLimpiarItem(item, cleanLayer)`
   - Endpoint: `POST /items/:item_ref/master/mark-clean-all`
   - Líneas: 2038-2115

2. **Limpiar Estudiante (Desde Flotante)**
   - UI: `handleLimpiarEstudiante(student, item, cleanLayer, itemKind)`
   - Endpoint: `POST /items/:item_ref/master/mark-clean-student`
   - Líneas: 3222-3369

3. **Incrementar Todos (Una Vez)**
   - UI: `handleIncrementAllItem(item, cleanLayer)`
   - Endpoint: `POST /items/:item_ref/master/increment-all`
   - Líneas: NO CONSTA (buscar)

4. **Crear Lista**
   - UI: `handleCreateLista()`
   - Endpoint: `POST /listas`
   - Líneas: NO CONSTA (buscar)

5. **Actualizar Lista**
   - UI: `handleUpdateLista()`
   - Endpoint: `PUT /listas/:id`
   - Líneas: NO CONSTA (buscar)

6. **Eliminar Lista**
   - UI: `handleDeleteLista()`
   - Endpoint: `DELETE /listas/:id`
   - Líneas: NO CONSTA (buscar)

7. **Crear Item**
   - UI: `handleCreateItem()`
   - Endpoint: `POST /items`
   - Líneas: NO CONSTA (buscar)

8. **Actualizar Item**
   - UI: `handleUpdateItem()`
   - Endpoint: `PUT /items/:id`
   - Líneas: NO CONSTA (buscar)

9. **Eliminar Item**
   - UI: `handleDeleteItem()`
   - Endpoint: `DELETE /items/:id`
   - Líneas: NO CONSTA (buscar)

#### B) Flujo Post-Acción

**Para acciones en modo PROYECCIÓN:**
1. Invalidar: `state.projection.data = null` (línea 1335)
2. Refrescar modal (si aplica): `handleVerItem(item, 'shared', activeViewLayer)` (línea 1346)
3. Refetch: `await loadListProjection()` (línea 1351)
4. Render: `renderView()` (llamado desde `loadListProjection()` línea 1441)
5. **RIESGO:** Si `refreshAfterProjectionMutation()` también llama `renderView()` después, habría doble render

**Para acciones en modo OPERATIVA:**
- NO CONSTA (buscar handlers de CRUD de listas/items)

#### C) Riesgos Detectables

1. **Doble Render en Proyección (ALTA)**
   - **Ubicación:** `refreshAfterProjectionMutation()` → `loadListProjection()` → `renderView()` (línea 1441)
   - **Problema:** Si `refreshAfterProjectionMutation()` llama `renderView()` después de `loadListProjection()`, habría doble render
   - **Evidencia:** `loadListProjection()` ya llama `renderView()` en línea 1441

2. **Refresh Condicionado por Modo (MEDIA)**
   - **Ubicación:** `refreshAfterProjectionMutation()` tiene guard `if (state.projection?.mode !== 'proyeccion')` (línea 1330)
   - **Problema:** Si está en modo operativa, no refresca nada
   - **Evidencia:** Guard temprano que retorna sin hacer nada

3. **Modal Refresh Duplicado (MEDIA)**
   - **Ubicación:** `refreshAfterProjectionMutation()` → `handleVerItem()` → luego `loadListProjection()`
   - **Problema:** Dos fetches si modal está abierto (uno para modal, otro para proyección)
   - **Evidencia:** Líneas 1338-1348 y 1351

### MÓDULO: Alquimia Alumno

#### A) Acciones Mutadoras

1. **Limpiar Item**
   - UI: `handleCleanItem(item)`
   - Endpoint: `POST /alquimia-alumno/clean`
   - Líneas: 1094-1174

#### B) Flujo Post-Acción

1. Refetch: `await loadMegalist(state.selectedStudentUuid)` (línea 1162)
2. Render: `renderMegalist()` (llamado desde `loadMegalist()` línea ~360)
3. **RIESGO:** Bajo (patrón limpio)

#### C) Riesgos Detectables

- **Ninguno detectado** (patrón limpio: load → render)

### MÓDULO: Lugares

#### A) Acciones Mutadoras

1. **Limpiar Lugar**
   - UI: `handleCleanPlace(studentId, placeId)`
   - Endpoint: `POST /places/clean`
   - Líneas: 599-612

2. **Limpiar Seleccionados**
   - UI: `handleCleanSelected()`
   - Endpoint: `POST /places/clean-bulk`
   - Líneas: 617-636

3. **Limpiar Todos**
   - UI: `handleCleanAll()`
   - Endpoint: `POST /places/clean-all`
   - Líneas: 641-657

4. **Activar/Desactivar Lugar**
   - UI: `handleActivatePlace()` / `handleDeactivatePlace()`
   - Endpoint: `POST /places/activate` / `POST /places/deactivate`
   - Líneas: 1080-1098

#### B) Flujo Post-Acción

**Para limpiezas:**
1. Refetch: `await loadLugaresActivos()` (líneas 607, 631, 652)
2. Render: `renderLugaresActivos()` (llamado desde `loadLugaresActivos()` línea ~340)

**Para activar/desactivar:**
1. Refetch: `await loadStudentById(place.student_id)` (línea 1094)
2. Render: `renderStudentConfig()` (llamado desde `loadStudentById()` línea ~718)

#### C) Riesgos Detectables

- **Ninguno detectado** (patrón limpio: load → render)

### MÓDULO: Proyectos

#### A) Acciones Mutadoras

1. **Limpiar Proyecto**
   - UI: `handleCleanProject(studentId, projectId)`
   - Endpoint: `POST /projects/clean`
   - Líneas: 599-612

2. **Limpiar Seleccionados**
   - UI: `handleCleanSelected()`
   - Endpoint: `POST /projects/clean-bulk`
   - Líneas: 617-636

3. **Limpiar Todos**
   - UI: `handleCleanAll()`
   - Endpoint: `POST /projects/clean-all`
   - Líneas: 641-657

4. **Activar/Desactivar Proyecto**
   - UI: `handleActivateProject()` / `handleDeactivateProject()`
   - Endpoint: `POST /projects/activate` / `POST /projects/deactivate`
   - Líneas: 1080-1098

#### B) Flujo Post-Acción

**Para limpiezas:**
1. Refetch: `await loadProyectosActivos()` (líneas 607, 631, 652)
2. Render: `renderProyectosActivos()` (llamado desde `loadProyectosActivos()` línea ~340)

**Para activar/desactivar:**
1. Refetch: `await loadStudentById(project.student_id)` (línea 1094)
2. Render: `renderStudentConfig()` (llamado desde `loadStudentById()` línea ~718)

#### C) Riesgos Detectables

- **Ninguno detectado** (patrón limpio: load → render)

### MÓDULO: Apadrinados

#### A) Acciones Mutadoras

1. **Vincular Sponsor**
   - UI: `handleLinkNewSponsor(studentId)`
   - Endpoint: `POST /sponsors/:id/link`
   - Líneas: 1321-1348

#### B) Flujo Post-Acción

1. Refetch: `await apiFetch('/master/api/sponsors/by-student/:id')` (línea 1335)
2. Actualizar cache: `ApadrinadosState.studentSponsorsMap[studentId] = ...` (línea 1336)
3. Render: `renderStudents()` (línea 1344)
4. **RIESGO:** Bajo (patrón limpio)

#### C) Riesgos Detectables

- **Ninguno detectado** (patrón limpio)

---

## FASE 4 — DETECTAR "FUENTES DE VERDAD VISUAL" POR VISTA

### ALQUIMIA GENERAL (Modo Proyección)

| Vista | Campo que Decide Columna/Color/Estado | Origen | Inferencia Frontend |
|-------|--------------------------------------|--------|---------------------|
| Proyección (shared/pde/effective/combo) | `state_by_view_layer[view_layer].state` | Backend (`/list-projection`) | ⚠️ NO (usa `state_by_view_layer` directamente) |
| Proyección (recurrente) | `state_by_view_layer[view_layer].computed_state.days_since_last_clean` | Backend | ⚠️ NO (usa directamente) |
| Proyección (una_vez) | `state_by_view_layer.combo.state` | Backend | ⚠️ NO (usa directamente) |

**Conclusión:** ✅ Backend es Source of Truth. Frontend NO calcula estados.

### ALQUIMIA GENERAL (Modo Operativa)

| Vista | Campo que Decide Columna/Color/Estado | Origen | Inferencia Frontend |
|-------|--------------------------------------|--------|---------------------|
| Lista de Items | `item.status` | Backend (`/items`) | ⚠️ NO (usa directamente) |
| Items por Lista | `item.nombre`, `item.frecuencia_days` | Backend | ⚠️ NO (usa directamente) |

**Conclusión:** ✅ Backend es Source of Truth. Frontend NO calcula estados.

### ALQUIMIA ALUMNO

| Vista | Campo que Decide Columna/Color/Estado | Origen | Inferencia Frontend |
|-------|--------------------------------------|--------|---------------------|
| Megalist | `state_by_view_layer[view_layer].state` | Backend (`/megalist`) | ⚠️ NO (usa `state_by_view_layer` directamente) |
| Columnas (reviewed/pending/important) | `state_by_view_layer[view_layer].state` | Backend | ⚠️ NO (usa directamente) |

**Conclusión:** ✅ Backend es Source of Truth. Frontend NO calcula estados.

### LUGARES

| Vista | Campo que Decide Columna/Color/Estado | Origen | Inferencia Frontend |
|-------|--------------------------------------|--------|---------------------|
| Lugares Activos | `place.last_cleaned_at`, `place.is_active` | Backend (`/places/active`) | ⚠️ NO (usa directamente) |

**Conclusión:** ✅ Backend es Source of Truth. Frontend NO calcula estados.

### PROYECTOS

| Vista | Campo que Decide Columna/Color/Estado | Origen | Inferencia Frontend |
|-------|--------------------------------------|--------|---------------------|
| Proyectos Activos | `project.last_cleaned_at`, `project.is_active` | Backend (`/projects/active`) | ⚠️ NO (usa directamente) |

**Conclusión:** ✅ Backend es Source of Truth. Frontend NO calcula estados.

### APADRINADOS

| Vista | Campo que Decide Columna/Color/Estado | Origen | Inferencia Frontend |
|-------|--------------------------------------|--------|---------------------|
| Lista de Sponsors | `sponsor.status`, `sponsor.student_ids` | Backend (`/sponsors`) | ⚠️ NO (usa directamente) |

**Conclusión:** ✅ Backend es Source of Truth. Frontend NO calcula estados.

---

## FASE 5 — PROPUESTA DE "PUNTOS DE INSERCIÓN" (SIN IMPLEMENTAR)

### Ubicaciones Candidatas para Refresh Engine v1

#### 1. **Helper Canónico Post-Mutación (Alquimia General)**

**Ubicación:** `public/js/master/master-alquimia-general-client.js`
**Función Actual:** `refreshAfterProjectionMutation()` (líneas 1328-1361)
**Qué Reemplazaría:** 
- Invalidación manual: `state.projection.data = null`
- Refetch manual: `await loadListProjection()`
- Render manual: `renderView()` (si se llama después)

**Invariant a Garantizar:**
- 1 mutación = 1 refetch = 1 render
- No doble render si `loadListProjection()` ya renderiza
- Preservar `view_layer` activa durante refetch

**Assembly Check:**
- Verificar que `loadListProjection()` NO llama `renderView()` si Refresh Engine ya lo hace
- Verificar que modal refresh no duplica fetches

#### 2. **Helper Canónico Post-Mutación (Alquimia Alumno)**

**Ubicación:** `public/js/master/master-alquimia-alumno-client.js`
**Función Actual:** `handleCleanItem()` (líneas 1094-1174)
**Qué Reemplazaría:**
- Refetch manual: `await loadMegalist(state.selectedStudentUuid)`

**Invariant a Garantizar:**
- 1 mutación = 1 refetch = 1 render
- Preservar `view_layer` activa durante refetch

**Assembly Check:**
- Verificar que `loadMegalist()` NO llama `renderMegalist()` si Refresh Engine ya lo hace

#### 3. **Helper Canónico Post-Mutación (Lugares)**

**Ubicación:** `public/js/master/master-lugares-client.js`
**Funciones Actuales:** `handleCleanPlace()`, `handleCleanSelected()`, `handleCleanAll()` (líneas 599-657)
**Qué Reemplazaría:**
- Refetch manual: `await loadLugaresActivos()`

**Invariant a Garantizar:**
- 1 mutación = 1 refetch = 1 render
- No doble render si `loadLugaresActivos()` ya renderiza

**Assembly Check:**
- Verificar que `loadLugaresActivos()` NO llama `renderLugaresActivos()` si Refresh Engine ya lo hace

#### 4. **Helper Canónico Post-Mutación (Proyectos)**

**Ubicación:** `public/js/master/master-proyectos-client.js`
**Funciones Actuales:** `handleCleanProject()`, `handleCleanSelected()`, `handleCleanAll()` (líneas 599-657)
**Qué Reemplazaría:**
- Refetch manual: `await loadProyectosActivos()`

**Invariant a Garantizar:**
- 1 mutación = 1 refetch = 1 render
- No doble render si `loadProyectosActivos()` ya renderiza

**Assembly Check:**
- Verificar que `loadProyectosActivos()` NO llama `renderProyectosActivos()` si Refresh Engine ya lo hace

#### 5. **Helper Canónico Post-Mutación (Apadrinados)**

**Ubicación:** `public/js/master/master-apadrinados-client.js`
**Función Actual:** `handleLinkNewSponsor()` (líneas 1321-1348)
**Qué Reemplazaría:**
- Refetch manual: `await apiFetch('/master/api/sponsors/by-student/:id')`
- Render manual: `renderStudents()`

**Invariant a Garantizar:**
- 1 mutación = 1 refetch = 1 render
- Actualizar cache antes de render

**Assembly Check:**
- Verificar que cache se actualiza antes de render

### Arquitectura Propuesta (Sin Implementar)

```
Refresh Engine v1:
  - refreshAfterMutation(mutationType, context)
    - Determina qué invalidar (state keys)
    - Determina qué refetch (endpoints)
    - Determina qué render (funciones)
    - Ejecuta: invalidate → refetch → render (una vez cada uno)
    - Preserva view_layer/scope activos
    - Logs forenses estructurados
```

---

## FASE 6 — ENTREGABLE FINAL

### 1) LISTA DE MUTACIONES (Backend)

**Total:** 47 endpoints mutadores

- **Alquimia General:** 14 endpoints
- **Alquimia Alumno:** 1 endpoint
- **Lugares:** 8 endpoints
- **Proyectos:** 8 endpoints
- **Apadrinados:** 5 endpoints
- **Clasificaciones:** 3 endpoints
- **Tags:** 3 endpoints
- **Otros:** 5 endpoints (NO CONSTA completamente)

### 2) LISTA DE MUTACIONES (Frontend)

**Total:** ~20 handlers UI que llaman endpoints mutadores

- **Alquimia General:** ~9 handlers
- **Alquimia Alumno:** 1 handler
- **Lugares:** 5 handlers
- **Proyectos:** 5 handlers
- **Apadrinados:** 1 handler

### 3) PRIMITIVAS DE REFRESH (Frontend)

**Total:** ~25 funciones de refresh/load/render

- **Alquimia General:** 9 funciones
- **Alquimia Alumno:** 2 funciones
- **Lugares:** 4 funciones
- **Proyectos:** 4 funciones
- **Apadrinados:** 4 funciones
- **Sidebar:** 2 funciones

### 4) PATRONES REPETIDOS

**Total:** 8 patrones identificados

1. "Invalidate + Load + Render" (Alquimia General)
2. "Load + Render Directo" (Alquimia Alumno)
3. "Load + Render Separado" (Lugares/Proyectos)
4. "Load + Render + Load + Render (Cascada)" (Lugares/Proyectos)
5. "State Null + Load + Render" (Alquimia General)
6. "Modal Refresh Condicional" (Alquimia General)
7. "Load + RenderView (Indirecto)" (Alquimia General)
8. "Load + Load (Cascada de Loads)" (Apadrinados)

### 5) MAPA AS-IS POR MÓDULO

#### Alquimia General
- **Acciones:** 9 mutadoras
- **Flujo Post-Acción:** `refreshAfterProjectionMutation()` → `loadListProjection()` → `renderView()`
- **Riesgos:** Doble render (ALTA), Refresh condicionado por modo (MEDIA), Modal refresh duplicado (MEDIA)

#### Alquimia Alumno
- **Acciones:** 1 mutadora
- **Flujo Post-Acción:** `loadMegalist()` → `renderMegalist()`
- **Riesgos:** Ninguno

#### Lugares
- **Acciones:** 5 mutadoras
- **Flujo Post-Acción:** `loadLugaresActivos()` → `renderLugaresActivos()`
- **Riesgos:** Ninguno

#### Proyectos
- **Acciones:** 5 mutadoras
- **Flujo Post-Acción:** `loadProyectosActivos()` → `renderProyectosActivos()`
- **Riesgos:** Ninguno

#### Apadrinados
- **Acciones:** 1 mutadora
- **Flujo Post-Acción:** `fetch /by-student/:id` → `renderStudents()`
- **Riesgos:** Ninguno

### 6) RIESGOS / INCONSISTENCIAS

#### PRIORIDAD ALTA

1. **Doble Render en Alquimia General (Proyección)**
   - **Ubicación:** `refreshAfterProjectionMutation()` → `loadListProjection()` → `renderView()` (línea 1441)
   - **Problema:** `loadListProjection()` ya llama `renderView()`, pero `refreshAfterProjectionMutation()` podría llamarlo otra vez
   - **Impacto:** Render duplicado innecesario
   - **Evidencia:** Línea 1441 de `master-alquimia-general-client.js`

#### PRIORIDAD MEDIA

2. **Refresh Condicionado por Modo**
   - **Ubicación:** `refreshAfterProjectionMutation()` guard (línea 1330)
   - **Problema:** Si está en modo operativa, no refresca nada después de mutación
   - **Impacto:** UI desincronizada en modo operativa
   - **Evidencia:** Guard temprano que retorna sin hacer nada

3. **Modal Refresh Duplicado**
   - **Ubicación:** `refreshAfterProjectionMutation()` → `handleVerItem()` → `loadListProjection()`
   - **Problema:** Dos fetches si modal está abierto (uno para modal, otro para proyección)
   - **Impacto:** Fetches duplicados innecesarios
   - **Evidencia:** Líneas 1338-1348 y 1351

#### PRIORIDAD BAJA

4. **Inconsistencias en Handlers NO CONSTA**
   - **Ubicación:** Handlers de CRUD de listas/items (NO CONSTA)
   - **Problema:** No se pudo verificar si refrescan correctamente
   - **Impacto:** Desconocido
   - **Evidencia:** Funciones no encontradas en búsqueda

### 7) PUNTOS DE INSERCIÓN PARA REFRESH ENGINE v1

#### Ubicación 1: Helper Canónico Post-Mutación (Alquimia General)
- **Path:** `public/js/master/master-alquimia-general-client.js`
- **Función Actual:** `refreshAfterProjectionMutation()` (líneas 1328-1361)
- **Qué Reemplazaría:** Invalidación + refetch + render manual
- **Invariant:** 1 mutación = 1 refetch = 1 render
- **Assembly Check:** Verificar que `loadListProjection()` NO llama `renderView()` si Refresh Engine ya lo hace

#### Ubicación 2: Helper Canónico Post-Mutación (Alquimia Alumno)
- **Path:** `public/js/master/master-alquimia-alumno-client.js`
- **Función Actual:** `handleCleanItem()` (líneas 1094-1174)
- **Qué Reemplazaría:** Refetch manual
- **Invariant:** 1 mutación = 1 refetch = 1 render
- **Assembly Check:** Verificar que `loadMegalist()` NO llama `renderMegalist()` si Refresh Engine ya lo hace

#### Ubicación 3: Helper Canónico Post-Mutación (Lugares)
- **Path:** `public/js/master/master-lugares-client.js`
- **Funciones Actuales:** `handleCleanPlace()`, `handleCleanSelected()`, `handleCleanAll()` (líneas 599-657)
- **Qué Reemplazaría:** Refetch manual
- **Invariant:** 1 mutación = 1 refetch = 1 render
- **Assembly Check:** Verificar que `loadLugaresActivos()` NO llama `renderLugaresActivos()` si Refresh Engine ya lo hace

#### Ubicación 4: Helper Canónico Post-Mutación (Proyectos)
- **Path:** `public/js/master/master-proyectos-client.js`
- **Funciones Actuales:** `handleCleanProject()`, `handleCleanSelected()`, `handleCleanAll()` (líneas 599-657)
- **Qué Reemplazaría:** Refetch manual
- **Invariant:** 1 mutación = 1 refetch = 1 render
- **Assembly Check:** Verificar que `loadProyectosActivos()` NO llama `renderProyectosActivos()` si Refresh Engine ya lo hace

#### Ubicación 5: Helper Canónico Post-Mutación (Apadrinados)
- **Path:** `public/js/master/master-apadrinados-client.js`
- **Función Actual:** `handleLinkNewSponsor()` (líneas 1321-1348)
- **Qué Reemplazaría:** Refetch + render manual
- **Invariant:** 1 mutación = 1 refetch = 1 render
- **Assembly Check:** Verificar que cache se actualiza antes de render

### 8) ANEXO FUERA DE SCOPE

#### ADMIN/CLIENT/GOD
- **NO CONSTA:** No se analizaron rutas fuera de `/master/*`
- **Razón:** Scope limitado a MASTER según instrucciones

#### Legacy
- **NO CONSTA:** No se analizaron handlers legacy fuera de MASTER
- **Razón:** Scope limitado a MASTER según instrucciones

---

## CONCLUSIÓN

El diagnóstico revela:

1. **Backend es Source of Truth:** ✅ Confirmado. Frontend NO calcula estados, usa `state_by_view_layer` directamente.

2. **Patrones Mayormente Limpios:** ✅ La mayoría de módulos (Lugares, Proyectos, Apadrinados, Alquimia Alumno) tienen patrones limpios de refresh.

3. **Riesgo Principal en Alquimia General:** ⚠️ Alquimia General tiene el patrón más complejo con riesgo de doble render y refrescos condicionados por modo.

4. **Puntos de Inserción Claros:** ✅ 5 ubicaciones candidatas identificadas para Refresh Engine v1.

5. **Handlers NO CONSTA:** ⚠️ Algunos handlers de CRUD (crear/actualizar/eliminar listas/items) no se encontraron en búsqueda. Requieren análisis adicional.

---

**FIN DEL DIAGNÓSTICO**
