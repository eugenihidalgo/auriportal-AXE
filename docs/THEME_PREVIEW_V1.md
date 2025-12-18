# 🎨 Sistema de Preview de Temas v1

## 📋 Resumen

Sistema aislado de preview de temas para el editor de temas en el admin panel. Permite previsualizar cómo se verá un tema en una pantalla cliente sin afectar el sistema real.

## 🔒 Reglas Absolutas

- ✅ **NO aplica temas reales** - Solo muestra preview
- ✅ **NO persiste nada** - No guarda cambios
- ✅ **NO toca alumnos reales** - Usa datos fake
- ✅ **NO modifica applyTheme global** - Aplica valores CSS directamente
- ✅ **Fail-open** - Si falla, muestra error sin romper
- ✅ **Completamente reversible** - Cerrar preview = volver al estado anterior

## 🏗️ Arquitectura

### Endpoint de Preview

**Ruta:** `GET /admin/themes/preview`

**Parámetros:**
- `theme_id` (opcional): ID del tema guardado en BD
- `theme_draft` (opcional): JSON con definición de tema draft
- `screen` (opcional): Pantalla a previsualizar (pantalla1, ejecucion, limpieza-basica, limpieza-profunda)

**Funcionamiento:**
1. Recibe `theme_id` o `theme_draft`
2. Recibe `screen` (fallback a `pantalla1` si no existe o no está permitido)
3. Obtiene valores CSS del tema (desde BD o draft)
4. Crea estudiante fake (no existe en BD)
5. Renderiza pantalla seleccionada con datos fake usando renderizadores controlados
6. Aplica valores CSS directamente al HTML (inyecta `<style>`)
7. Devuelve HTML listo para iframe

**Aislamiento:**
- No pasa por `resolveTheme()` - aplica valores directamente
- No modifica `applyTheme()` global
- No persiste nada en BD
- Usa datos fake que no existen

### UI del Editor

**Selector de Pantalla:**
- Dropdown "Pantalla de Preview" en el editor
- Opciones disponibles (hardcodeadas):
  - `pantalla1` - Pantalla 1 (Ritual Diario)
  - `ejecucion` - Ejecución (Práctica)
  - `limpieza-basica` - Limpieza Básica
  - `limpieza-profunda` - Limpieza Profunda
- Solo afecta al preview, no se guarda en BD

**Botón "Previsualizar":**
- Disponible en todos los temas (guardados y drafts)
- Abre modal con iframe
- Funciona con temas guardados (`theme_id`) y drafts (`theme_draft`)
- Incluye pantalla seleccionada en la URL

**Modal de Preview:**
- Iframe aislado
- Cierre con ESC o clic fuera
- No afecta el editor

## 🔄 Flujo de Uso

### Preview de Tema Guardado

1. Usuario selecciona tema en editor
2. Selecciona pantalla de preview (opcional, default: pantalla1)
3. Clic en "👁️ Previsualizar"
4. Sistema construye URL: `/admin/themes/preview?theme_id=123&screen=pantalla1`
5. Endpoint obtiene tema de BD
6. Renderiza pantalla seleccionada con tema aplicado usando renderizador controlado
7. Muestra en iframe

### Preview de Tema Draft (IA o sin guardar)

1. Usuario tiene tema draft en editor (generado por IA o editado)
2. Selecciona pantalla de preview (opcional, default: pantalla1)
3. Clic en "👁️ Previsualizar"
4. Sistema recopila valores del formulario
5. Construye URL: `/admin/themes/preview?theme_draft={JSON}&screen=ejecucion`
6. Endpoint aplica valores directamente usando renderizador controlado
7. Muestra en iframe

## 🛡️ Garantías de Seguridad

### No Afecta Sistema Real

- ✅ Estudiantes fake no existen en BD
- ✅ No se llama a `resolveTheme()` real
- ✅ No se modifica `applyTheme()` global
- ✅ No se persisten cambios
- ✅ Headers de iframe permiten embedding solo en preview

### Fail-Open

- ✅ Si tema no existe → usa CONTRACT_DEFAULT
- ✅ Si error en parsing → muestra error en iframe
- ✅ Si error en render → muestra HTML de error
- ✅ Nunca rompe el servidor

## 📝 Ejemplo de Uso

### Desde Editor

```javascript
// Tema guardado
previsualizarTema() // theme_id=123

// Tema draft
previsualizarTema() // theme_draft={"key":"...","values":{...}}
```

### URL Directa

```
GET /admin/themes/preview?theme_id=123&screen=pantalla1
GET /admin/themes/preview?theme_draft=%7B%22key%22%3A%22...&screen=ejecucion
GET /admin/themes/preview?theme_id=123&screen=limpieza-basica
```

**Nota:** Si `screen` no existe o no está permitido, se usa `pantalla1` como fallback.

## 🔍 Debugging

### Logs

- `[AdminThemes Preview]` - Logs del endpoint
- Errores se muestran en iframe (no rompen servidor)

### Verificar Aislamiento

1. Abrir preview de tema
2. Verificar que no se crean estudiantes en BD
3. Verificar que no se modifican temas reales
4. Cerrar preview → todo vuelve a normal

## 🎯 Renderizadores Controlados

El sistema usa un mapa explícito de pantallas permitidas:

```javascript
const SCREEN_RENDERERS = {
  'pantalla1': renderPantalla1,
  'ejecucion': renderEjecucion,
  'limpieza-basica': renderLimpiezaBasica,
  'limpieza-profunda': renderLimpiezaProfunda
};
```

**Garantías:**
- ✅ Nunca usa paths dinámicos
- ✅ Nunca evalúa strings como código
- ✅ Si renderer no existe → fallback a pantalla1
- ✅ Validación estricta de pantallas permitidas

**Pantallas Disponibles:**
- `pantalla1`: Usa `renderPantalla1()` con datos fake
- `ejecucion`: Carga plantilla HTML directamente (preview simplificado)
- `limpieza-basica`: Carga plantilla HTML directamente (preview simplificado)
- `limpieza-profunda`: Carga plantilla HTML directamente (preview simplificado)

## ⚠️ Limitaciones v1

- Preview de pantallas seleccionadas (pantalla1, ejecucion, limpieza-basica, limpieza-profunda)
- No preview de otras pantallas (pantalla2, pantalla3, pantalla4, etc.)
- No preview de interacciones (botones no funcionan en preview)
- Requiere que el tema tenga valores CSS válidos
- Pantallas de ejecución y limpieza muestran versiones simplificadas (solo estructura HTML)

## 🚀 Futuras Mejoras (No Implementadas)

- Preview de todas las pantallas cliente
- Preview de interacciones (simuladas)
- Comparación lado a lado de temas
- Preview con datos más realistas para ejecución y limpieza

---

**Versión:** v1.1 (Multi-pantalla)  
**Fecha:** 2024  
**Estado:** ✅ Funcional y Aislado

## 📝 Cambios v1.1

- ✅ Añadido selector de pantalla en el editor
- ✅ Endpoint acepta parámetro `screen`
- ✅ Implementados renderizadores controlados para 4 pantallas
- ✅ Validación estricta de pantallas permitidas
- ✅ Fail-open: fallback a pantalla1 si screen inválido



