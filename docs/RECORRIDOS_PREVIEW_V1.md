# Recorridos Preview v1 - Arquitectura

**Versión:** v5.16.0  
**Fecha:** 2025-01-XX

---

## Arquitectura General

El sistema de preview de recorridos está diseñado como una **isla canónica** completamente aislada del runtime legacy del alumno. Utiliza comunicación por `postMessage` entre el editor y el preview host.

### Componentes

1. **Preview Host** (`/admin/recorridos/preview`)
   - HTML canónico sin base.html
   - Renderer mínimo de steps
   - Listener de mensajes con fail-open absoluto

2. **Editor Integration**
   - Panel preview con iframe
   - Theme selector con catálogo dinámico
   - postMessage con snapshot del recorrido

3. **Theme Catalog** (`/admin/api/themes/catalog`)
   - Endpoint canónico para consumo en editores
   - Agrega: Auto, Light Classic, Dark Classic, themes v3 publicados

---

## Contrato de Mensajes

### Editor → Preview Host

**Tipo:** `RECORRIDO_PREVIEW_UPDATE`

**Payload:**
```javascript
{
  theme: {
    key: "auto" | "light-classic" | "dark-classic" | "theme:<theme_key>:<version>",
    label: "Nombre humano del tema"
  },
  themeTokensCssText: ":root { --bg-main: #1e293b; --text-primary: #f1f5f9; ... }",
  snapshot: {
    recorrido: {
      id: string,
      name: string,
      version: string,
      status: "draft" | "published"
    },
    selected_step_id: string | null,
    steps: object | array,
    entry_step_id: string | null
  }
}
```

### Preview Host → Editor

**Tipo:** `RECORRIDO_PREVIEW_READY`

**Payload:**
```javascript
{
  type: "RECORRIDO_PREVIEW_READY",
  source: "preview-host"
}
```

---

## Theme Catalog

### Endpoint

`GET /admin/api/themes/catalog?include_drafts=0|1`

### Respuesta

```javascript
{
  ok: true,
  items: [
    {
      key: "auto",
      label: "Auto",
      kind: "system",
      source: "resolver",
      status: "published"
    },
    {
      key: "light-classic",
      label: "Light Classic",
      kind: "classic",
      source: "resolver",
      status: "published"
    },
    {
      key: "dark-classic",
      label: "Dark Classic",
      kind: "classic",
      source: "resolver",
      status: "published"
    },
    {
      key: "theme:<theme_key>:<version>",
      label: "Nombre humano",
      kind: "theme",
      source: "themes-v3",
      status: "published",
      theme_key: string,
      version: number
    }
  ]
}
```

### Keys

- **auto**: Tema automático (resuelto por Theme Resolver v1)
- **light-classic**: Tema claro clásico
- **dark-classic**: Tema oscuro clásico
- **theme:<theme_key>:<version>**: Tema publicado de Theme Studio v3

---

## Renderers de Steps

### screen_video

Renderiza:
- Título
- Descripción
- Bloque "VIDEO: <video_ref>"

### screen_choice

Renderiza:
- Título
- Descripción
- Opciones como botones simulables

### Otros

Muestra placeholder con JSON pretty del step (capado a 2-3kb).

---

## Fail-Open y Placeholders

### Principios

1. **Fail-open absoluto**: Si preview falla, muestra placeholder + banner, no throw uncaught
2. **Tema inválido**: Fallback automático a CONTRACT_DEFAULT / SYSTEM_DEFAULT
3. **Snapshot inválido**: Placeholder "Snapshot inválido" sin reventar
4. **Step no soportado**: Placeholder bonito con JSON, sin crash

### Placeholders

- **Esperando datos**: "Esperando datos del recorrido..."
- **No hay step seleccionado**: "Selecciona un step en el editor para ver el preview"
- **Step no renderizable**: "Step no renderizable aún" + JSON
- **Error renderizando**: "Error renderizando step" + mensaje

---

## Logs

### Prefijos

- `[AXE][THEME_CATALOG]` - Theme catalog requests
- `[AXE][REC_PREVIEW]` - Preview host messages
- `[AXE][SIDEBAR_FIX]` - Validación SIDEBAR_MENU

### Niveles

- **Info**: Operaciones normales
- **Warn**: Fallbacks y advertencias
- **Error**: Errores críticos (con fail-open)

---

## Seguridad

### postMessage

- Validación de origin opcional (no bloquea si no está claro)
- Logs de mensajes de origin diferente
- Validación de shape del mensaje

### Autenticación

- Preview host requiere `requireAdminContext()`
- Editor requiere autenticación admin

---

## Persistencia

### localStorage

- **Key**: `ap_recorridos_editor_theme_pref`
- **Valor**: Key del tema seleccionado
- **Fallback**: `auto` si no hay preferencia guardada

---

## Integración en Editor

### Panel Preview

- Toggle ON/OFF con botón "👁️ Preview Panel"
- Panel fijo a la derecha (50% ancho)
- Iframe con src="/admin/recorridos/preview"

### Theme Selector

- Dropdown con opciones del catálogo
- Persistencia en localStorage
- Actualización automática del preview al cambiar

### Snapshot

- Se construye desde `editorState.recorrido`
- Incluye: id, name, version, status, steps, selected_step_id, entry_step_id
- Se envía automáticamente cuando:
  - Se abre el panel preview
  - Se cambia el step seleccionado
  - Se cambia el tema

---

## Testing

### Checklist QA

- [ ] Preview funciona con recorrido válido
- [ ] Preview funciona con recorrido inválido (muestra placeholder)
- [ ] Step no soportado → placeholder bonito, sin crash
- [ ] Selector theme: Auto / Light / Dark aplican tokens visibles
- [ ] Theme publicado de themes-v3 aplica tokens correctamente
- [ ] 0 uncaught errors en consola
- [ ] Si themes-v3 falla → catalog sigue devolviendo classic/system
- [ ] Persistencia localStorage funciona
- [ ] Panel preview se abre/cierra correctamente
- [ ] Snapshot se actualiza al cambiar step

---

## Archivos Relacionados

- `src/core/html/admin/recorridos/recorridos-preview.html` - Preview host HTML
- `src/endpoints/admin-recorridos-preview-ui.js` - Preview handler
- `src/endpoints/admin-themes-catalog-api.js` - Theme catalog endpoint
- `src/core/ui/theme/theme-selector.js` - Helper reutilizable
- `src/core/theme/theme-tokens-to-css.js` - Convertir tokens a CSS
- `src/core/html/admin/recorridos/recorridos-editor.html` - Editor con integración

---

**Documentación completada para v5.16.0**




