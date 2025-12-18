# AXE v0.6.3 — Canvas Persistence + Admin View v1 — RESUMEN FINAL

**Versión:** v0.6.3 (Freeze Semántico)  
**Fecha:** 2025-01-XX  
**Estado:** ✅ COMPLETADO — CONGELADO

## 🔒 FREEZE SEMÁNTICO v0.6.3

**AXE v0.6.3 está congelado semánticamente:**

- ✅ Contrato estable definido en `docs/AXE_CONTRACT_V1.md`
- ✅ Funciones core no cambiarán su firma
- ✅ Modelo Canvas v1.0 estable
- ✅ Conversiones bidireccionales estables
- ✅ Validaciones estructurales estables
- ✅ Flujo de publicación consolidado (canvas → definition)

**Cambios permitidos en v0.6.x:**
- Bug fixes
- Mejoras de performance
- Nuevos tipos de nodos (extensión)
- Nuevos tipos de edges (extensión)
- Mejoras en normalización (sin breaking changes)

**Cambios NO permitidos:**
- Breaking changes en CanvasDefinition
- Breaking changes en funciones core
- Cambios en comportamiento de conversiones
- Cambios en validaciones estructurales

**Próxima versión mayor (v0.7.0):**
- Requerirá migración
- Puede incluir breaking changes
- Requerirá actualización de documentación

**Ver:** `docs/AXE_CONTRACT_V1.md` para el contrato completo.

---

## 📦 ENTREGA COMPLETA

### ✅ 1. Migración SQL Ejecutada

- **Archivo:** `database/migrations/v5.5.0-recorridos-canvas-persistence.sql`
- **Estado:** ✅ Ejecutada y verificada en PostgreSQL
- **Columnas añadidas:**
  - `recorrido_drafts.canvas_json` (JSONB, nullable)
  - `recorrido_drafts.canvas_updated_at` (TIMESTAMPTZ, nullable)
  - `recorrido_versions.canvas_json` (JSONB, nullable)
- **Índices:** GIN sobre `canvas_json` en ambas tablas

### ✅ 2. Repositorios Extendidos

- **`RecorridoDraftRepoPg`:**
  - ✅ `updateCanvas()`: Guarda canvas_json + canvas_updated_at
  - ✅ Parseo automático de canvas_json en todos los métodos
- **`RecorridoVersionRepoPg`:**
  - ✅ `createVersion()`: Acepta canvas_json como parámetro opcional
  - ✅ Parseo automático de canvas_json en todos los métodos

### ✅ 3. Helper Canvas Storage

- **Archivo:** `src/core/canvas/canvas-storage.js`
- **Funciones:**
  - ✅ `getEffectiveCanvasForDraft()`: Obtiene canvas (persistido o derivado)
  - ✅ `saveCanvasToDraft()`: Valida, normaliza y guarda canvas

### ✅ 4. Endpoints Admin

- **GET** `/admin/api/recorridos/:id/canvas`
  - ✅ Devuelve canvas (draft o derived) con source y warnings
- **PUT** `/admin/api/recorridos/:id/canvas`
  - ✅ Valida, normaliza y guarda canvas en draft
  - ✅ Bloquea si hay errors bloqueantes
- **POST** `/admin/api/recorridos/:id/canvas/validate`
  - ✅ Valida canvas sin persistir
- **POST** `/admin/api/recorridos/:id/canvas/convert-to-recorrido`
  - ✅ Convierte Canvas → RecorridoDefinition (preview)

### ✅ 5. Flujo de Publish Modificado (AXE v0.6.3 Consolidado)

- **Archivo:** `src/endpoints/admin-recorridos-api.js` → `handlePublishVersion()`
- **Comportamiento:**
  - ✅ **Si `draft.canvas_json` existe:**
    1. Valida canvas estrictamente
    2. Normaliza canvas
    3. **Genera `definition_json` vía `canvasToRecorrido()`**
    4. Valida `definition_json` generada
    5. Publica ambos (canvas + definition generada)
  - ✅ **Si `draft.canvas_json` es null:**
    1. Usa `definition_json` legacy directamente
    2. Valida `definition_json`
    3. Opcionalmente deriva canvas para visualización
    4. Publica `definition_json` (y canvas si se derivó)
  - ✅ Canvas en version es INMUTABLE (congelado)
  - ✅ Definition en version es INMUTABLE (congelado)

### ✅ 6. Vista Canvas v1 en Editor

- **Archivo:** `src/core/html/admin/recorridos/recorridos-editor.html`
- **Características:**
  - ✅ Toggle "📋 Lista" / "🎨 Canvas" en topbar
  - ✅ Badge "DERIVED" cuando canvas es derivado
  - ✅ JSON editor para editar canvas
  - ✅ Canvas viewer simple (nodos en grid, edges como lista)
  - ✅ Botones: Cargar, Validar, Guardar, Convertir a Recorrido
  - ✅ Muestra warnings arriba

### ✅ 7. Runbook de Migración

- **Archivo:** `docs/AXE_V0_6_3_MIGRATION_RUNBOOK.md`
- **Contenido:**
  - ✅ Pre-check (git, PM2, PostgreSQL)
  - ✅ Instrucciones de ejecución
  - ✅ Verificación completa
  - ✅ Smoke tests HTTP
  - ✅ Verificación UI
  - ✅ Troubleshooting

### ✅ 8. Commit y Tag

- **Commit:** `feat(canvas): persistencia y vista admin v1 para recorridos`
- **Tag:** `v5.5.0`
- **Descripción:** Completa con todos los cambios

---

## 🔍 VERIFICACIÓN REALIZADA

### Base de Datos

```sql
-- Columnas verificadas
✅ recorrido_drafts.canvas_json (jsonb, nullable)
✅ recorrido_drafts.canvas_updated_at (timestamptz, nullable)
✅ recorrido_versions.canvas_json (jsonb, nullable)

-- Índices verificados
✅ idx_recorrido_drafts_canvas_gin (GIN)
✅ idx_recorrido_versions_canvas_gin (GIN)
```

### Código

- ✅ Sin errores de linting
- ✅ Imports correctos
- ✅ Funciones documentadas
- ✅ Fail-open implementado

---

## 🎯 FUNCIONALIDADES IMPLEMENTADAS

### Persistencia

1. **Canvas en Draft:**
   - Se guarda SIEMPRE normalizado
   - Se actualiza `canvas_updated_at` al guardar
   - Si es null, se deriva automáticamente en runtime

2. **Canvas en Version:**
   - INMUTABLE (congelado en publish)
   - Si no existe en draft, se deriva en publish-time
   - Se guarda junto con `definition_json`

### UI Admin

1. **Toggle Vista:**
   - Cambia entre "Vista Lista" (actual) y "Vista Canvas" (nueva)
   - Badge "DERIVED" visible cuando corresponde

2. **Editor Canvas:**
   - JSON editor para editar canvas manualmente
   - Canvas viewer simple (sin drag&drop todavía)
   - Botones funcionales: Cargar, Validar, Guardar, Convertir

### Guardarraíles

1. **Validación:**
   - `validateCanvasDefinition()` con opción `isPublish`
   - Errors bloqueantes impiden guardado/publish
   - Warnings se reportan pero no bloquean

2. **Normalización:**
   - `normalizeCanvasDefinition()` siempre antes de guardar
   - Estructura determinista para diffs

3. **Fail-Open:**
   - Si no hay canvas, se deriva automáticamente
   - Si falla derivación, se muestra canvas vacío (no bloquea)

---

## 📝 PRÓXIMOS PASOS (NO IMPLEMENTADOS EN ESTA VERSIÓN)

- [ ] Drag & Drop en Canvas Viewer (v2)
- [ ] Tests mínimos para canvas persistence
- [ ] Visualización de edges como líneas conectadas
- [ ] Editor visual de canvas (arrastrar nodos, crear edges)

---

## 🚀 DESPLIEGUE

### Pre-requisitos

- ✅ PostgreSQL con tablas `recorrido_drafts` y `recorrido_versions`
- ✅ Migración v5.5.0 ejecutada
- ✅ PM2 corriendo

### Pasos

1. **Ejecutar migración** (si no se ejecutó):
   ```bash
   cat database/migrations/v5.5.0-recorridos-canvas-persistence.sql | sudo -u postgres psql -d aurelinportal
   ```

2. **Reiniciar servidor:**
   ```bash
   pm2 restart aurelinportal --update-env
   ```

3. **Verificar:**
   - Acceder a `/admin/recorridos`
   - Abrir un recorrido para editar
   - Verificar que existe el toggle Canvas
   - Activar vista Canvas y verificar funcionalidad

---

## ✅ CHECKLIST FINAL

- [x] Migración SQL creada y ejecutada
- [x] Repositorios extendidos
- [x] Helper canvas-storage creado
- [x] Endpoints admin implementados
- [x] Flujo de publish modificado
- [x] Vista Canvas v1 añadida al editor
- [x] Runbook de migración creado
- [x] Migración ejecutada y verificada
- [x] Commit y tag creados
- [ ] Tests mínimos (pendiente, no bloqueante)
- [ ] Smoke tests en producción (pendiente)

---

## 📚 DOCUMENTACIÓN

- **Contrato AXE v1:** `docs/AXE_CONTRACT_V1.md` (CONTRATO ESTABLE)
- **Runbook:** `docs/AXE_V0_6_3_MIGRATION_RUNBOOK.md`
- **Migración:** `database/migrations/v5.5.0-recorridos-canvas-persistence.sql`
- **Código:** Ver archivos en `src/core/canvas/` y `src/endpoints/admin-recorridos-api.js`

---

## 🔄 CAMBIOS EN FLUJO DE PUBLICACIÓN (v0.6.3)

### Antes (v0.6.2)
- Si existe `canvas_json`: Solo se validaba y guardaba, pero se usaba `definition_json` del draft
- Si no existe `canvas_json`: Se usaba `definition_json` legacy directamente

### Ahora (v0.6.3)
- **Si existe `canvas_json`:**
  1. Validar canvas estrictamente
  2. Normalizar canvas
  3. **Generar `definition_json` vía `canvasToRecorrido()`**
  4. Validar `definition_json` generada
  5. Publicar ambos (canvas + definition generada)

- **Si no existe `canvas_json`:**
  1. Usar `definition_json` legacy directamente
  2. Validar `definition_json`
  3. Opcionalmente derivar canvas para visualización
  4. Publicar `definition_json` (y canvas si se derivó)

**Resultado:** Canvas es ahora la fuente de verdad cuando existe, y se genera definition automáticamente.

---

**Implementación completada exitosamente** ✅  
**Listo para producción** ✅  
**Freeze semántico activo** 🔒


