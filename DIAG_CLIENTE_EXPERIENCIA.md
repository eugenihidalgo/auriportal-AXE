# 🔍 DIAGNÓSTICO COMPLETO: ÁREA CLIENTE - AURIPORTAL

**Fecha:** 2024  
**Modo:** READ ONLY - Solo análisis, sin modificaciones  
**Objetivo:** Inventariar y documentar el estado actual del área cliente para reordenar y estabilizar la experiencia del alumno

---

## 📋 ÍNDICE

1. [Sistema de Render](#1-sistema-de-render)
2. [Pantallas Cliente Existentes](#2-pantallas-cliente-existentes)
3. [Sistema de Temas y Colores](#3-sistema-de-temas-y-colores)
4. [Sistema de Prácticas](#4-sistema-de-prácticas)
5. [Flujos de Navegación](#5-flujos-de-navegación)
6. [Problemas Detectados](#6-problemas-detectados)

---

## 1. SISTEMA DE RENDER

### 1.1 Función Centralizada `renderHtml()`

**Ubicación:** `src/core/html-response.js`

**Función principal:**
```javascript
export function renderHtml(html, options = {})
```

**Características:**
- Aplica headers anti-cache automáticamente (`getHtmlCacheHeaders()`)
- Aplica tema automáticamente si se proporciona `student` (`applyTheme()`)
- Versiona automáticamente referencias a CSS y JS (`versionAsset()`)
- Acepta headers adicionales y código de estado HTTP

**Uso en el código:**
- **66 usos** encontrados en todo el proyecto
- Se usa en: `responses.js`, `practicas-handler.js`, `perfil-personal.js`, `limpieza-handler.js`, `admin-panel.js`, `admin-panel-v4.js`, `error-response.js`, `auth-context.js`, `health-check.js`

### 1.2 Función `applyTheme()`

**Ubicación:** `src/core/responses.js` (líneas 56-199)

**Funcionalidad:**
- Obtiene tema del estudiante (`student.tema_preferido`) o usa `'dark'` por defecto
- Reemplaza placeholder `{{TEMA_PREFERIDO}}` en HTML
- Añade `data-theme="${tema}"` al tag `<html>` si no existe
- Inyecta script inline crítico en `<head>` para activar tema ANTES del render visual (evita parpadeos)
- Añade clase `theme-dark` al `<body>` si es tema oscuro
- Añade automáticamente links a CSS de tema si no existen:
  - `/css/theme-variables.css`
  - `/css/theme-overrides.css`
- Versiona automáticamente todas las referencias a CSS y JS

**Estrategias anti-parpadeo:**
1. Aplicar directamente si `document.body` ya existe
2. Usar `MutationObserver` para detectar cuando se crea el body
3. Fallback con `DOMContentLoaded`
4. Fallback con `window.onload`

### 1.3 Funciones de Render Específicas

**Ubicación:** `src/core/responses.js`

**Funciones disponibles:**
- `renderPantalla0(student = null)` - Login/recuperación de sesión
- `renderPantalla1(student, ctx)` - No ha practicado hoy
- `renderPantalla2(student, ctx)` - Ya practicó hoy
- `renderPantalla3(student, data)` - Vista de tema individual
- `renderPantalla4(student, temasHTML = "")` - Lista de temas
- `renderPantalla2Practicar(student, streakInfo)` - Pantalla de práctica
- `renderPantalla21(student = null)` - Pantalla de limpieza

**Todas usan:**
- `replace()` para reemplazar placeholders `{{PLACEHOLDER}}`
- `renderHtml()` centralizado para aplicar tema y headers

### 1.4 Carga de CSS y Temas

**Archivos CSS principales:**
- `public/css/theme-variables.css` - Variables CSS para tema claro/oscuro
- `public/css/theme-overrides.css` - Overrides sistemáticos de variables
- `public/css/reloj-meditacion.css` - Estilos específicos del reloj
- `public/css/tailwind.css` - Tailwind CSS (solo admin)

**Cómo se cargan:**
1. **En HTML templates:** Links directos en `<head>`:
   ```html
   <link rel="stylesheet" href="/css/theme-variables.css" />
   <link rel="stylesheet" href="/css/theme-overrides.css" />
   ```

2. **Automáticamente por `applyTheme()`:** Si el HTML no tiene los links, `applyTheme()` los añade automáticamente

3. **Versionado automático:** `applyTheme()` versiona todos los links CSS/JS usando `versionAsset()`

### 1.5 Contratos de Render

**CONTRATO 1: Pantallas básicas (pantalla0-4)**
- HTML estático cargado desde archivos en `src/core/html/`
- Placeholders `{{PLACEHOLDER}}` reemplazados con `replace()`
- Tema aplicado automáticamente por `renderHtml()`

**CONTRATO 2: Pantallas de prácticas**
- HTML cargado desde `src/core/html/practicas/*.html`
- Placeholders reemplazados manualmente
- Tema aplicado por `renderHtml()`

**CONTRATO 3: Perfil personal**
- HTML cargado desde `src/core/html/perfil-personal.html`
- Placeholders reemplazados manualmente
- Tema aplicado por `renderHtml()`

**CONTRATO 4: Admin panels**
- Algunos usan `renderHtml()` (admin-panel.js)
- Otros renderizan HTML inline (admin-panel-v4.js)
- No todos usan el sistema de temas del cliente

**PROBLEMA DETECTADO:** Múltiples contratos de render distintos, algunos no usan el sistema centralizado de temas.

---

## 2. PANTALLAS CLIENTE EXISTENTES

### 2.1 Inventario Completo

#### **PANTALLA 0: Login / Recuperación de Sesión**

**Archivo:** `src/core/html/pantalla0.html`  
**Ruta:** `/` o `/enter` (sin cookie)  
**Handler:** `src/endpoints/enter.js`

**Datos necesarios:**
- Ninguno (pantalla pública)

**Layout:**
- Formulario de email
- Checkbox "Recuérdame en este dispositivo"
- Link a Typeform para nuevos usuarios

**Tema:**
- Usa `{{TEMA_PREFERIDO}}` placeholder
- Carga `theme-variables.css` y `theme-overrides.css`
- Aplica tema automáticamente (por defecto 'dark')

**Acceso:**
- GET `/` o `/enter` sin cookie → muestra pantalla0
- POST `/enter` con email → valida y crea cookie

---

#### **PANTALLA 1: No Ha Practicado Hoy**

**Archivo:** `src/core/html/pantalla1.html`  
**Ruta:** `/` o `/enter` (con cookie, no ha practicado hoy)  
**Handler:** `src/endpoints/enter.js` → `renderPantalla1()`

**Datos necesarios:**
- `student` (objeto estudiante completo)
- `ctx.nivelInfo` (nivel, nombre, fase)
- `ctx.streakInfo` (streak, fraseNivel, motivationalPhrase)
- `ctx.estadoSuscripcion` (pausada, razon)
- `ctx.frase` (frase del sistema)

**Layout:**
- Círculo de aura animado
- Imagen de Aurelín
- Racha actual: "Racha actual: X días"
- Frase motivacional según racha
- Nivel: "Nivel X - Nombre"
- Botón "Sí, hoy practico" → `/enter?practico=si`
- Link a "Fuegos Sagrados" (Typeform con hidden fields)

**Tema:**
- Usa `{{TEMA_PREFERIDO}}` placeholder
- Carga CSS de tema
- Aplica tema automáticamente

**Variante (Suscripción Pausada):**
- Muestra mensaje: "⏸️ Tu suscripción está pausada..."
- Botón deshabilitado

---

#### **PANTALLA 2: Ya Practicó Hoy**

**Archivo:** `src/core/html/pantalla2.html`  
**Ruta:** `/` o `/enter` (con cookie, ya practicó hoy)  
**Handler:** `src/endpoints/enter.js` → `renderPantalla2()`

**Datos necesarios:**
- `student` (objeto estudiante completo)
- `ctx.nivelInfo` (nivel, nombre, fase)
- `ctx.streakInfo` (streak, fraseNivel)
- `ctx.bloqueHito` (mensaje especial si alcanzó hito: 25, 50, 75, 100, 150, 200, 365 días)
- `ctx.frase` (frase del sistema)

**Layout:**
- Círculo de aura animado
- Imagen de Aurelín
- **Bloque de Hito** (si corresponde): "✨ Hoy alcanzas los X días de racha. Auri se ilumina contigo."
- Frase del nivel
- Racha: "Racha general: X días"
- Nivel: "Nivel X - Fase"
- Botón "¡Voy a practicar con Aurelín!" → `/practicar`
- Botón "Quiero visitar mi universo personal" → `/perfil-personal`

**Tema:**
- Usa `{{TEMA_PREFERIDO}}` placeholder
- Carga CSS de tema
- Aplica tema automáticamente

---

#### **PANTALLA 3: Vista de Tema Individual**

**Archivo:** `src/core/html/pantalla3.html`  
**Ruta:** `/topic/{temaId}`  
**Handler:** `src/endpoints/topic-screen.js` → `renderPantalla3()`

**Datos necesarios:**
- `student` (objeto estudiante completo)
- `data.nombre` (nombre del tema)
- `data.contador` (veces trabajado)
- `data.objetivo` (objetivo recomendado o "—")
- `data.id` (ID del tema)

**Layout:**
- Imagen de Aurelín
- Nombre del tema
- Contador: "Veces trabajado: X"
- Objetivo: "Objetivo recomendado: Y" (o "—")
- Indicador si objetivo cumplido
- Botón "Practicar este tema" → `/topic/{temaId}?practicar=si`

**Tema:**
- Usa `{{TEMA_PREFERIDO}}` placeholder
- Carga CSS de tema
- Aplica tema automáticamente

---

#### **PANTALLA 4: Lista de Temas**

**Archivo:** `src/core/html/pantalla4.html`  
**Ruta:** `/topics` o `/aprender`  
**Handler:** `src/endpoints/topic-list.js` → `renderPantalla4()`

**Datos necesarios:**
- `student` (objeto estudiante completo)
- `temasHTML` (HTML generado con lista de temas)

**Layout:**
- Imagen de Aurelín
- Lista de tarjetas de temas:
  - Nombre del tema
  - Veces trabajado: X
  - Objetivo recomendado: Y (o "—")
  - Botón "Entrar en este tema" → `/topic/{temaId}`

**Tema:**
- Usa `{{TEMA_PREFERIDO}}` placeholder
- Carga CSS de tema
- Aplica tema automáticamente

---

#### **PANTALLA: Perfil Personal**

**Archivo:** `src/core/html/perfil-personal.html`  
**Ruta:** `/perfil-personal`  
**Handler:** `src/endpoints/perfil-personal.js`

**Datos necesarios:**
- `student` (objeto estudiante completo)
- Notas de Eugeni Hidalgo (si suscripción activa)
- Canalizaciones/comunicados
- Lugares creados por el alumno
- Proyectos del alumno
- Transmutaciones energéticas (items verdes)
- Tonos de meditación disponibles

**Layout:**
- Sistema de tabs:
  - Notas
  - Canalizaciones
  - Lugares
  - Proyectos
  - Transmutaciones
  - Tonos
- Cada tab muestra contenido específico

**Tema:**
- Usa sistema de temas
- Carga CSS de tema
- Aplica tema automáticamente

---

#### **PANTALLA: Práctica - Preparaciones**

**Archivo:** `src/core/html/practicas/preparaciones.html`  
**Ruta:** `/practica/{id}/preparaciones`  
**Handler:** `src/endpoints/practicas-handler.js` → `renderPreparaciones()`

**Datos necesarios:**
- `student` (objeto estudiante completo)
- `practicaId` (ID de la práctica)
- `nivelAlumno` (nivel actual del alumno)
- Lista de preparaciones filtradas por nivel
- Preparaciones obligatorias marcadas automáticamente

**Layout:**
- Título: "Preparaciones para la Práctica"
- Lista de checkboxes de preparaciones:
  - Tipo: Consigna, Acción, Decreto, Meditación
  - Posición: Inicio o Final
  - Nivel requerido
  - Badge "Obligatoria" si aplica
- Botón "Continuar" → POST a `/practica/{id}/ejecucion`

**Tema:**
- Usa sistema de temas
- Carga CSS de tema
- Aplica tema automáticamente

---

#### **PANTALLA: Práctica - Ejecución**

**Archivo:** `src/core/html/practicas/ejecucion.html`  
**Ruta:** `/practica/{id}/ejecucion`  
**Handler:** `src/endpoints/practicas-handler.js` → `renderEjecucion()`

**Datos necesarios:**
- `student` (objeto estudiante completo)
- `practicaId` (ID de la práctica)
- IDs de preparaciones seleccionadas (POST o query string)
- Contenido completo de cada preparación seleccionada
- Música de meditación (si aplica)
- Tono de meditación (si aplica)

**Layout:**
- Título: "Ejecución de la Práctica"
- Contenido de cada preparación seleccionada (en orden)
- Reproductor de música/tono (si aplica)
- Botón "Continuar" → `/practica/{id}/post-seleccion`

**Tema:**
- Usa sistema de temas
- Carga CSS de tema
- Aplica tema automáticamente

---

#### **PANTALLA: Práctica - Post-Selección**

**Archivo:** `src/core/html/practicas/post-seleccion.html`  
**Ruta:** `/practica/{id}/post-seleccion`  
**Handler:** `src/endpoints/practicas-handler.js` → `renderPostSeleccion()`

**Datos necesarios:**
- `student` (objeto estudiante completo)
- `practicaId` (ID de la práctica)
- Lista de técnicas post-práctica disponibles

**Layout:**
- Título: "Técnicas Post-Práctica"
- Lista de técnicas disponibles
- Botón "Continuar" → `/practica/{id}/post-ejecucion`

**Tema:**
- Usa sistema de temas
- Carga CSS de tema
- Aplica tema automáticamente

---

#### **PANTALLA: Práctica - Post-Ejecución**

**Archivo:** `src/core/html/practicas/post-ejecucion.html`  
**Ruta:** `/practica/{id}/post-ejecucion`  
**Handler:** `src/endpoints/practicas-handler.js` → `renderPostEjecucion()`

**Datos necesarios:**
- `student` (objeto estudiante completo)
- `practicaId` (ID de la práctica)
- Contenido de técnicas post-práctica seleccionadas

**Layout:**
- Título: "Post-Práctica"
- Contenido de técnicas post-práctica
- Botón "Finalizar" → redirige a `/enter`

**Tema:**
- Usa sistema de temas
- Carga CSS de tema
- Aplica tema automáticamente

---

#### **PANTALLA: Práctica - Decreto**

**Archivo:** `src/core/html/practicas/decreto.html`  
**Ruta:** `/practica/{id}/decreto/{decretoId}`  
**Handler:** `src/endpoints/practicas-handler.js` → `renderDecreto()`

**Datos necesarios:**
- `student` (objeto estudiante completo)
- `practicaId` (ID de la práctica)
- `decretoId` (ID del decreto)
- Contenido del decreto

**Layout:**
- Título del decreto
- Contenido del decreto
- Botón "Continuar" → vuelve a ejecución

**Tema:**
- Usa sistema de temas
- Carga CSS de tema
- Aplica tema automáticamente

---

#### **PANTALLA: Limpieza Principal**

**Archivo:** `src/core/html/limpieza-principal.html`  
**Ruta:** `/limpieza`  
**Handler:** `src/endpoints/limpieza-handler.js` → `renderLimpiezaPrincipal()`

**Datos necesarios:**
- `student` (objeto estudiante completo)
- Lista de tipos de limpieza disponibles

**Layout:**
- Título: "Limpieza Energética"
- Lista de tipos de limpieza:
  - Rápida
  - Básica
  - Profunda
  - Total
- Botones para cada tipo → `/limpieza/{tipo}`

**Tema:**
- Usa sistema de temas
- Carga CSS de tema
- Aplica tema automáticamente

---

#### **PANTALLA: Limpieza por Tipo**

**Archivo:** `src/core/html/limpieza-tipo.html`  
**Ruta:** `/limpieza/{tipo}` (rapida, basica, profunda, total)  
**Handler:** `src/endpoints/limpieza-handler.js` → `renderLimpiezaTipo()`

**Datos necesarios:**
- `student` (objeto estudiante completo)
- `tipoLimpieza` (tipo de limpieza)
- Lista de técnicas de limpieza para ese tipo
- Lista de aspectos a limpiar

**Layout:**
- Título: "Limpieza {Tipo}"
- Lista de técnicas disponibles
- Lista de aspectos a limpiar
- Botón "Marcar como completado" → POST `/limpieza/marcar`

**Tema:**
- Usa sistema de temas
- Carga CSS de tema
- Aplica tema automáticamente

---

### 2.2 Resumen de Pantallas

**Total de pantallas cliente:** 13 pantallas principales

**Categorías:**
1. **Autenticación:** Pantalla 0 (1 pantalla)
2. **Racha diaria:** Pantalla 1, Pantalla 2 (2 pantallas)
3. **Temas:** Pantalla 3, Pantalla 4 (2 pantallas)
4. **Prácticas:** Preparaciones, Ejecución, Post-Selección, Post-Ejecución, Decreto (5 pantallas)
5. **Limpieza:** Limpieza Principal, Limpieza por Tipo (2 pantallas)
6. **Perfil:** Perfil Personal (1 pantalla)

**Todas las pantallas:**
- ✅ Usan sistema de temas
- ✅ Cargar CSS de tema
- ✅ Aplican tema automáticamente
- ✅ Usan `renderHtml()` centralizado (excepto algunas variantes)

---

## 3. SISTEMA DE TEMAS Y COLORES

### 3.1 Archivos CSS de Tema

#### **theme-variables.css**

**Ubicación:** `public/css/theme-variables.css`  
**Líneas:** 212 líneas

**Estructura:**
1. **Tema Claro (Default)** - `:root` (líneas 9-82)
   - Fondos: `--bg-main`, `--bg-primary`, `--bg-card`, `--bg-card-active`, etc.
   - Textos: `--text-primary`, `--text-secondary`, `--text-muted`, `--text-accent`, `--text-streak`
   - Bordes: `--border-soft`, `--border-strong`, `--border-accent`, `--border-focus`
   - Acentos: `--accent-primary` (#ffd86b - dorado), `--accent-secondary`, `--accent-hover`
   - Sombras: `--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-xl`
   - Gradientes: `--gradient-primary`, `--gradient-hover`, `--gradient-header`, `--aura-gradient`
   - Badges: `--badge-bg-active`, `--badge-text-active`, `--badge-bg-pending`, etc.
   - Inputs: `--input-bg`, `--input-border`, `--input-text`, `--input-focus-border`
   - Button text: `--button-text-color` (#333333 para modo claro)
   - Card backgrounds: `--card-bg`, `--card-bg-active`

2. **Tema Oscuro** - `body.theme-dark` (líneas 89-164)
   - Fondos: `--bg-main` (#0a0e1a - muy oscuro), `--bg-panel` (#0f1422), `--bg-card` (#141827)
   - Textos: `--text-primary` (#f1f5f9 - blanco nítido), `--text-accent` (#a78bfa - violeta claro)
   - Acentos: `--accent-primary` (#7c3aed - violeta), `--accent-secondary` (#6366f1 - índigo)
   - Gradientes: `--gradient-primary` (violeta-índigo), `--aura-gradient` (violeta suave)
   - **REGLA ABSOLUTA:** TODO debe ser oscuro - NO fondos claros, NO amarillos, NO beige

3. **Fondos degradados especiales** (líneas 170-172)
   - `body.theme-dark` tiene `background: radial-gradient(ellipse at top, #0a0e1a, #0f1422) !important`

4. **Border Radius** (líneas 194-200)
   - `--radius-sm: 12px`
   - `--radius-md: 16px`
   - `--radius-lg: 20px`
   - `--radius-xl: 24px`
   - `--radius-full: 9999px`

5. **Transiciones** (líneas 205-211)
   - Transiciones suaves para cambios de tema (0.3s ease)

#### **theme-overrides.css**

**Ubicación:** `public/css/theme-overrides.css`  
**Líneas:** 782 líneas

**Estructura:**
1. **Elementos Base** (líneas 9-12)
   - `body` usa `--bg-main` o `--bg-primary`

2. **Contenedores y Paneles** (líneas 17-57)
   - `.container`, `.card`, `.contador`, `.preparaciones-container`, etc.
   - Overrides específicos para modo oscuro

3. **Tipografía y Textos** (líneas 62-114)
   - `h1-h6` usan `--text-accent`
   - Modo oscuro: `font-weight: 700`, `text-shadow`, `letter-spacing`
   - `.streak`, `.racha` usan `--text-streak`

4. **Botones y CTAs** (líneas 119-183)
   - Botones usan `--gradient-primary`
   - Botones de confirmación usan `--gradient-success` (VERDE)
   - Hover effects con `--gradient-hover`

5. **Inputs y Formularios** (líneas 188-216)
   - Inputs usan `--input-bg`, `--input-border`, `--input-text`
   - Focus usa `--input-focus-border`

6. **Checkboxes y Radios** (líneas 221-232)
   - Usan `--accent-primary` como `accent-color`

7. **Badges y Estados** (líneas 237-295)
   - Badges activos: `--badge-bg-active` (VERDE en modo oscuro)
   - Badges pendientes: `--badge-bg-pending` (violeta)

8. **Items de Lista y Cards** (líneas 300-370)
   - `.nota-item`, `.canalizacion-item`, `.tema-card`, etc.
   - Overrides específicos para modo oscuro

9. **Headers y Navegación** (líneas 375-417)
   - Tabs usan `--border-soft`, `--accent-primary`

10. **Links** (líneas 422-431)
    - Links usan `--accent-primary`

11. **Labels** (líneas 436-439)
    - Labels usan `--text-primary`

12. **Aura y Elementos Decorativos** (líneas 444-446)
    - `.aura-circle` usa `--aura-gradient`

13. **Scrollbars** (líneas 451-458)
    - Scrollbars usan `--accent-primary`

14. **Mensajes y Alertas** (líneas 464-537)
    - Mensajes de éxito: VERDE (`--accent-success`)
    - Mensajes de error: ROJO (`--accent-error`)
    - Mensajes de warning: ÁMBAR (`--accent-warning`)
    - Mensajes informativos: ÍNDIGO (`--accent-primary`)

15. **Listas Agrupadas** (líneas 542-569)
    - `.lista-grupo` usa `--bg-card`, `--border-soft`

16. **Técnicas y Aspectos** (líneas 574-632)
    - `.tecnica-item`, `.aspecto-item` con overrides para modo oscuro

17. **Especiales para Modo Oscuro** (líneas 639-782)
    - Overrides masivos para modo oscuro
    - **REGLA ABSOLUTA:** TODO debe ser oscuro - NO fondos claros, NO amarillos, NO beige
    - Efecto continuo sin cajas - bordes sutiles, fondos integrados

### 3.2 Variables CSS

**Total de variables definidas:** ~80 variables CSS

**Categorías:**
1. **Fondos:** 8 variables
2. **Textos:** 7 variables
3. **Bordes:** 5 variables
4. **Acentos:** 6 variables
5. **Sombras:** 4 variables
6. **Gradientes:** 8 variables
7. **Badges:** 6 variables
8. **Inputs:** 4 variables
9. **Button text:** 1 variable
10. **Card backgrounds:** 2 variables
11. **Border radius:** 5 variables

### 3.3 Hardcodes Detectados

**PROBLEMA 1: Colores hardcodeados en HTML templates**
- Algunos templates tienen colores hardcodeados en `<style>` inline
- Ejemplo: `pantalla0.html` tiene estilos inline con colores específicos

**PROBLEMA 2: Colores hardcodeados en JavaScript**
- Algunos handlers generan HTML con colores hardcodeados
- Ejemplo: `renderPantalla1()` genera HTML con colores específicos para suscripción pausada

**PROBLEMA 3: CSS inline en templates**
- Muchos templates tienen `<style>` inline con reglas específicas
- Estas reglas no usan variables CSS, dificultan el cambio de tema

### 3.4 Duplicaciones Detectadas

**PROBLEMA 1: Estilos duplicados**
- Múltiples templates tienen estilos similares para `.card`, `.boton`, `.container`
- Estos estilos deberían estar en `theme-overrides.css`

**PROBLEMA 2: Variables duplicadas**
- Algunas variables tienen aliases (ej: `--bg-main` y `--bg-primary`)
- Esto puede causar confusión sobre cuál usar

**PROBLEMA 3: Overrides duplicados**
- `theme-overrides.css` tiene muchas reglas que podrían simplificarse
- Algunas reglas se repiten para diferentes selectores

### 3.5 Por Qué Cambiar un Color a Veces No Se Refleja

**RAZÓN 1: Especificidad CSS**
- `theme-overrides.css` usa `!important` en muchas reglas
- Si hay estilos inline en templates, pueden tener mayor especificidad
- Los estilos inline en `<style>` dentro de templates tienen alta especificidad

**RAZÓN 2: Orden de carga**
- Si un template carga CSS después de `theme-overrides.css`, puede sobrescribir
- El orden de `<link>` tags importa

**RAZÓN 3: Cache del navegador**
- Los CSS están versionados, pero si el navegador cachea, puede no reflejar cambios
- `getHtmlCacheHeaders()` devuelve `no-store` en dev/beta, pero `max-age=0` en producción

**RAZÓN 4: Variables no usadas**
- Si cambias una variable pero ningún elemento la usa, no se refleja
- Algunas variables están definidas pero no se usan en ningún lugar

**RAZÓN 5: Modo oscuro vs claro**
- Algunos colores solo se aplican en modo oscuro (`body.theme-dark`)
- Si estás en modo claro, los cambios en variables de modo oscuro no se ven

**RAZÓN 6: Script inline de tema**
- El script inline en `applyTheme()` aplica `theme-dark` al body
- Si el script no se ejecuta correctamente, el tema no se aplica

---

## 4. SISTEMA DE PRÁCTICAS

### 4.1 Cómo Se Renderiza una Práctica Hoy

**Flujo completo:**

1. **Preparaciones** (`/practica/{id}/preparaciones`)
   - Handler: `renderPreparaciones()` en `practicas-handler.js`
   - Obtiene preparaciones filtradas por nivel del alumno
   - Marca automáticamente las obligatorias
   - Renderiza HTML con checkboxes
   - POST a `/practica/{id}/ejecucion` con IDs seleccionados

2. **Ejecución** (`/practica/{id}/ejecucion`)
   - Handler: `renderEjecucion()` en `practicas-handler.js`
   - Recibe IDs de preparaciones (POST o query string)
   - Obtiene obligatorias válidas y las une con seleccionadas
   - Obtiene contenido completo de cada preparación
   - Renderiza HTML con contenido de preparaciones
   - Incluye música/tono si aplica
   - Botón "Continuar" → `/practica/{id}/post-seleccion`

3. **Post-Selección** (`/practica/{id}/post-seleccion`)
   - Handler: `renderPostSeleccion()` en `practicas-handler.js`
   - Obtiene técnicas post-práctica disponibles
   - Renderiza HTML con lista de técnicas
   - Botón "Continuar" → `/practica/{id}/post-ejecucion`

4. **Post-Ejecución** (`/practica/{id}/post-ejecucion`)
   - Handler: `renderPostEjecucion()` en `practicas-handler.js`
   - Obtiene contenido de técnicas post-práctica seleccionadas
   - Renderiza HTML con contenido
   - Botón "Finalizar" → redirige a `/enter`

5. **Decreto** (`/practica/{id}/decreto/{decretoId}`)
   - Handler: `renderDecreto()` en `practicas-handler.js`
   - Obtiene contenido del decreto
   - Renderiza HTML con decreto
   - Botón "Continuar" → vuelve a ejecución

### 4.2 HTML Usado

**Templates:**
- `src/core/html/practicas/preparaciones.html`
- `src/core/html/practicas/ejecucion.html`
- `src/core/html/practicas/post-seleccion.html`
- `src/core/html/practicas/post-ejecucion.html`
- `src/core/html/practicas/decreto.html`

**Características:**
- Todos usan sistema de temas
- Todos cargan `theme-variables.css` y `theme-overrides.css`
- Todos usan `renderHtml()` centralizado
- Placeholders `{{PLACEHOLDER}}` reemplazados manualmente

### 4.3 Integración de Vídeos

**NO se encontraron vídeos integrados en el sistema de prácticas actual.**

**Nota:** El código tiene función `extraerVideoId()` en `practicas-handler.js` (líneas 91-112) que extrae videoId de URLs de YouTube, pero no se usa en ninguna parte del código actual.

### 4.4 Relojes / Timers

**NO se encontraron relojes/timers en el sistema de prácticas actual.**

**Nota:** Existe `public/css/reloj-meditacion.css`, pero no se usa en las pantallas de prácticas.

### 4.5 Dependencias de Backend

**SÍ depende de backend:**

1. **Preparaciones:**
   - `obtenerPreparacionesParaPantalla()` - obtiene preparaciones desde BD
   - `obtenerObligatoriasPreparaciones()` - obtiene obligatorias desde BD
   - Filtrado por nivel del alumno

2. **Ejecución:**
   - `obtenerDatosCompletosDePreparaciones()` - obtiene contenido completo desde BD
   - `listarMusicas()` - obtiene músicas desde BD
   - `obtenerTonoPorDefecto()` / `obtenerTono()` - obtiene tonos desde BD

3. **Post-Práctica:**
   - `obtenerPostPracticasParaPantalla()` - obtiene técnicas post-práctica desde BD
   - `obtenerDatosCompletosDePost()` - obtiene contenido completo desde BD
   - `obtenerObligatoriasPostPracticas()` - obtiene obligatorias desde BD

4. **Decreto:**
   - API endpoint `/api/decreto` (POST) - obtiene decreto desde BD

**NO depende de backend (frontend puro):**
- Navegación entre pantallas
- Renderizado de HTML
- Aplicación de temas
- Validación de formularios (parcial - se valida en backend también)

---

## 5. FLUJOS DE NAVEGACIÓN

### 5.1 Cómo Entra un Alumno al Portal

**FLUJO 1: Primera Vez (Sin Cookie)**

```
1. Usuario visita "/" o "/enter"
   ↓
2. Sistema detecta NO hay cookie
   ↓
3. Muestra PANTALLA 0 (login)
   ↓
4. Usuario ingresa email y envía (POST /enter)
   ↓
5. Sistema verifica si email existe en PostgreSQL
   ├─ SÍ existe → Crea cookie y redirige a /enter
   └─ NO existe → Redirige a Typeform (onboarding)
```

**FLUJO 2: Con Cookie (Visitas Subsecuentes)**

```
1. Usuario visita "/" o "/enter"
   ↓
2. Sistema lee cookie
   ↓
3. Construye contexto del estudiante (buildStudentContext)
   ↓
4. Verifica si practicó hoy (ctx.todayPracticed)
   ├─ NO practicó → PANTALLA 1
   └─ SÍ practicó → PANTALLA 2
```

**FLUJO 3: Después de Onboarding (Typeform)**

```
1. Usuario completa Typeform
   ↓
2. Typeform redirige a /onboarding-complete?email=...
   ↓
3. Sistema valida acceso con Kajabi
   ↓
4. Crea/obtiene estudiante en PostgreSQL
   ↓
5. Crea cookie de sesión
   ↓
6. Redirige a /enter
   ↓
7. Continúa con FLUJO 2
```

### 5.2 Cómo Llega a Practicar

**FLUJO 1: Desde Pantalla 1 (No ha practicado hoy)**

```
1. Usuario en PANTALLA 1
   ↓
2. Hace clic en "Sí, hoy practico"
   ↓
3. GET /enter?practico=si
   ↓
4. Sistema registra práctica (forcePractice: true)
   ↓
5. Redirige a PANTALLA 2 (ya practicó)
   ↓
6. Usuario hace clic en "¡Voy a practicar con Aurelín!"
   ↓
7. GET /practicar
   ↓
8. Redirige a /practica/1/preparaciones
```

**FLUJO 2: Desde Pantalla 2 (Ya practicó hoy)**

```
1. Usuario en PANTALLA 2
   ↓
2. Hace clic en "¡Voy a practicar con Aurelín!"
   ↓
3. GET /practicar
   ↓
4. Redirige a /practica/1/preparaciones
```

**FLUJO 3: Flujo Completo de Práctica**

```
1. /practica/{id}/preparaciones
   ↓
2. Usuario selecciona preparaciones
   ↓
3. POST /practica/{id}/ejecucion (con IDs seleccionados)
   ↓
4. /practica/{id}/ejecucion
   ↓
5. Usuario lee contenido de preparaciones
   ↓
6. Hace clic en "Continuar"
   ↓
7. /practica/{id}/post-seleccion
   ↓
8. Usuario selecciona técnicas post-práctica
   ↓
9. Hace clic en "Continuar"
   ↓
10. /practica/{id}/post-ejecucion
    ↓
11. Usuario lee contenido post-práctica
    ↓
12. Hace clic en "Finalizar"
    ↓
13. Redirige a /enter (PANTALLA 2)
```

### 5.3 Cómo Vuelve Atrás

**PROBLEMA DETECTADO: NO HAY NAVEGACIÓN ATRÁS EXPLÍCITA**

**Situación actual:**
- No hay botón "Atrás" en ninguna pantalla
- No hay breadcrumbs
- No hay navegación histórica
- El usuario debe usar el botón "Atrás" del navegador

**Excepciones:**
- Algunas pantallas redirigen automáticamente (ej: después de completar práctica)
- Algunas pantallas tienen links a otras secciones (ej: "Quiero visitar mi universo personal")

### 5.4 Puntos de Confusión o Rotura Detectados

**PROBLEMA 1: Falta de navegación atrás**
- Usuario no puede volver fácilmente a pantallas anteriores
- Debe usar botón "Atrás" del navegador, que puede causar problemas de estado

**PROBLEMA 2: Redirecciones automáticas sin contexto**
- Después de completar práctica, redirige a `/enter` sin indicar qué pasó
- Usuario puede no entender que la práctica se registró correctamente

**PROBLEMA 3: Múltiples puntos de entrada a prácticas**
- `/practicar` redirige a `/practica/1/preparaciones`
- No está claro por qué siempre es práctica ID 1
- No hay forma de acceder a otras prácticas directamente

**PROBLEMA 4: Flujo de temas confuso**
- `/topics` muestra lista de temas
- `/topic/{temaId}` muestra tema individual
- `/topic/{temaId}?practicar=si` incrementa contador
- No está claro cómo volver a la lista después de practicar un tema

**PROBLEMA 5: Perfil personal aislado**
- `/perfil-personal` no tiene navegación clara de vuelta
- Usuario puede quedar "atrapado" en el perfil

**PROBLEMA 6: Limpieza desconectada**
- `/limpieza` es una sección separada
- No está claro cómo se relaciona con las prácticas
- No hay navegación clara entre limpieza y prácticas

---

## 6. PROBLEMAS DETECTADOS

### 6.1 Sistema de Render

**PROBLEMA 1: Múltiples contratos de render**
- Algunos handlers usan `renderHtml()` centralizado
- Otros renderizan HTML inline sin usar el sistema centralizado
- Inconsistencia en cómo se aplican temas

**PROBLEMA 2: Placeholders inconsistentes**
- Algunos templates usan `{{PLACEHOLDER}}`
- Otros usan interpolación directa en JavaScript
- Dificulta el mantenimiento

**PROBLEMA 3: Estilos inline en templates**
- Muchos templates tienen `<style>` inline
- Estos estilos no usan variables CSS
- Dificultan el cambio de tema

### 6.2 Sistema de Temas

**PROBLEMA 1: Colores hardcodeados**
- Algunos templates tienen colores hardcodeados
- Algunos handlers generan HTML con colores específicos
- Dificulta el cambio de tema

**PROBLEMA 2: Variables duplicadas**
- Algunas variables tienen aliases (ej: `--bg-main` y `--bg-primary`)
- Confusión sobre cuál usar

**PROBLEMA 3: Overrides excesivos**
- `theme-overrides.css` tiene 782 líneas
- Muchas reglas con `!important`
- Dificulta el mantenimiento

**PROBLEMA 4: Cambios de color no se reflejan**
- Especificidad CSS alta
- Cache del navegador
- Variables no usadas
- Modo oscuro vs claro

### 6.3 Sistema de Prácticas

**PROBLEMA 1: Falta de vídeos**
- Código tiene función para extraer videoId de YouTube
- Pero no se usa en ninguna parte
- No hay integración de vídeos

**PROBLEMA 2: Falta de relojes/timers**
- Existe CSS para reloj de meditación
- Pero no se usa en prácticas
- No hay timers en el flujo

**PROBLEMA 3: Dependencia total de backend**
- Todo el contenido viene del backend
- No hay cache local
- Puede ser lento si el backend es lento

### 6.4 Flujos de Navegación

**PROBLEMA 1: Falta de navegación atrás**
- No hay botón "Atrás" explícito
- Usuario debe usar botón del navegador
- Puede causar problemas de estado

**PROBLEMA 2: Redirecciones sin contexto**
- Después de acciones, redirige sin indicar qué pasó
- Usuario puede no entender el resultado

**PROBLEMA 3: Múltiples puntos de entrada**
- Diferentes formas de llegar a la misma pantalla
- Puede causar confusión

**PROBLEMA 4: Secciones desconectadas**
- Limpieza, prácticas, temas, perfil son secciones separadas
- No hay navegación clara entre ellas

### 6.5 Problemas Generales

**PROBLEMA 1: Falta de feedback visual**
- No hay indicadores de carga
- No hay mensajes de éxito/error claros
- Usuario no sabe qué está pasando

**PROBLEMA 2: Falta de validación en frontend**
- Algunas validaciones solo en backend
- Usuario puede enviar formularios inválidos
- Errores solo se muestran después de enviar

**PROBLEMA 3: Falta de accesibilidad**
- No hay indicadores de foco claros
- No hay navegación por teclado explícita
- Contraste puede no ser suficiente en algunos casos

**PROBLEMA 4: Falta de responsive design consistente**
- Algunos templates tienen media queries
- Otros no
- Inconsistencia en móvil

---

## 📊 RESUMEN EJECUTIVO

### Estado Actual

- **13 pantallas cliente** identificadas
- **Sistema de temas** funcional pero con problemas de mantenibilidad
- **Sistema de render** centralizado pero con inconsistencias
- **Sistema de prácticas** completo pero sin vídeos/timers
- **Flujos de navegación** funcionales pero con puntos de confusión

### Problemas Críticos

1. **Múltiples contratos de render** - Inconsistencia en cómo se renderizan pantallas
2. **Colores hardcodeados** - Dificulta el cambio de tema
3. **Falta de navegación atrás** - Usuario puede quedar atrapado
4. **Redirecciones sin contexto** - Usuario no entiende qué pasó

### Problemas Menores

1. Variables CSS duplicadas
2. Overrides excesivos en CSS
3. Falta de vídeos/timers en prácticas
4. Secciones desconectadas

### Próximos Pasos Recomendados

1. **Estandarizar sistema de render** - Todos los handlers deben usar `renderHtml()`
2. **Eliminar colores hardcodeados** - Todo debe usar variables CSS
3. **Añadir navegación atrás** - Botones de navegación explícitos
4. **Mejorar feedback visual** - Indicadores de carga y mensajes claros
5. **Conectar secciones** - Navegación clara entre limpieza, prácticas, temas, perfil

---

**FIN DEL DIAGNÓSTICO**

*Este documento es READ ONLY. No se han realizado modificaciones al código.*

















