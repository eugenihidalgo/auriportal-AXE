# PROTOCOLO CANÓNICO DE FINALIZACIÓN DE FEATURES
## AuriPortal - Definición Oficial de DONE

**Versión**: v1.0.0-canonic  
**Fecha de Establecimiento**: 2025-12-26  
**Estado**: ✅ LEY OPERATIVA DEL PROYECTO

---

## ⚠️ ATENCIÓN (AGENTES IA)

**Antes de declarar una tarea como completada en AuriPortal, DEBES cumplir este protocolo.**

**No seguirlo implica trabajo incompleto.**

Este documento es la **fuente canónica** para el cierre de features y **referencia obligatoria** para agentes IA.

---

## 🎯 PROPÓSITO

Este protocolo establece la **definición oficial de DONE** en AuriPortal. Una feature no visible se considera **INEXISTENTE**, independientemente de si el código existe en el backend.

---

## 📜 DEFINICIÓN OFICIAL DE DONE

### En AuriPortal, "implementado" significa:

1. ✅ **Visible en la UI real**
   - La feature aparece en la interfaz de usuario
   - Es accesible desde su ruta canónica
   - No requiere inspeccionar código para encontrarla

2. ✅ **Usable sin inspeccionar código**
   - Un usuario puede interactuar con la feature
   - No requiere conocimiento técnico para acceder
   - La UI renderiza contenido (empty-state o datos reales)

3. ✅ **Ensamblada correctamente**
   - Usa `renderAdminPage()` (si es Admin UI)
   - El `bodyHtml` no está vacío
   - El sidebar aparece (si aplica)
   - No hay errores de consola que impidan el uso
   - **Pasa el Assembly Check System (ACS)** - Estado OK en `/admin/system/assembly`

### Está PROHIBIDO declarar una feature como completada si:

- ❌ La UI existe pero no renderiza contenido
- ❌ La ruta responde pero el body está vacío
- ❌ La lógica existe pero no está ensamblada
- ❌ El sidebar no aparece por violación de contrato
- ❌ Solo "existe en backend" o "existe en código"
- ❌ **El Assembly Check System reporta estado BROKEN o WARN**

**Regla absoluta**: "Ya está implementado pero no se ve" equivale a **NO IMPLEMENTADO**.

---

## 🔄 FASE OBLIGATORIA FINAL: ENSAMBLAJE Y VERIFICACIÓN

Toda feature con UI debe terminar con una fase explícita de **ENSAMBLAJE**.

### Checklist de Cierre UI (OBLIGATORIO)

Antes de declarar una feature como completada, verificar:

#### 1. Ruta Accesible
- [ ] La ruta responde con status 200 (no 404, no 500)
- [ ] La ruta está registrada en `admin-route-registry.js` (si es Admin)
- [ ] El handler está mapeado en `admin-router-resolver.js` (si es Admin)

#### 2. UI Visible
- [ ] La página renderiza contenido visible
- [ ] No aparece HTML vacío o `{{PLACEHOLDER}}` sin resolver
- [ ] El título de la página es correcto
- [ ] El contenido principal está presente

#### 3. Sidebar Presente (si aplica)
- [ ] El sidebar aparece en la página
- [ ] El item correspondiente está visible (si tiene feature flag, está activado)
- [ ] El item activo está marcado correctamente
- [ ] No aparece `{{SIDEBAR_MENU}}` sin resolver

#### 4. Empty-State o Datos Visibles
- [ ] Si hay datos: se muestran correctamente
- [ ] Si no hay datos: aparece empty-state apropiado
- [ ] No aparece contenido vacío sin explicación

#### 5. Sin Errores de Consola
- [ ] No hay errores JavaScript en consola
- [ ] No hay errores de carga de recursos
- [ ] No hay errores de red (404, 500, etc.)

#### 6. Contrato de Render Respetado
- [ ] Usa `renderAdminPage()` (si es Admin UI)
- [ ] Usa `base.html` como template base
- [ ] Inyecta scripts canónicos correctamente
- [ ] Respeta el contrato de render único

---

## ✅ VERIFICACIÓN PRÁCTICA

### Para Features Admin (`/admin/*`)

**Verificación mínima**:
1. Acceder a la ruta desde navegador
2. Confirmar que la página carga (status 200)
3. Confirmar que el sidebar aparece
4. Confirmar que el contenido principal es visible
5. Confirmar que no hay errores en consola del navegador

**Comandos de verificación** (opcional, para automatización futura):
```bash
# Verificar que la ruta responde
curl -I http://localhost:3000/admin/feature-flags

# Verificar que no hay placeholders sin resolver
curl http://localhost:3000/admin/feature-flags | grep -v "{{.*}}"
```

### Para Features Cliente

**Verificación mínima**:
1. Acceder a la ruta desde navegador
2. Confirmar que la página carga correctamente
3. Confirmar que el contenido es visible
4. Confirmar que la funcionalidad es usable

---

## 🚫 PROHIBICIONES ABSOLUTAS

### Declaración Prematura de Completado

**ESTÁ PROHIBIDO** declarar una feature como completada si:
- ❌ Solo existe el código backend
- ❌ Solo existe el handler
- ❌ Solo existe la ruta registrada
- ❌ La UI no renderiza contenido visible
- ❌ El sidebar no aparece
- ❌ Hay errores que impiden el uso

### Bypass del Protocolo

**ESTÁ PROHIBIDO**:
- ❌ "Ya está implementado, solo falta ensamblar" → NO está implementado
- ❌ "El código existe, solo no se ve" → NO está implementado
- ❌ "Funciona en backend" → NO está implementado si no es visible
- ❌ Saltarse la fase de ENSAMBLAJE

---

## 📋 EJEMPLOS DE VIOLACIONES

### ❌ Violación: UI sin contenido

```javascript
// Handler existe pero no renderiza contenido
export default async function handler(request, env, ctx) {
  return renderAdminPage({
    title: 'Feature X',
    contentHtml: '', // ❌ VACÍO
    activePath: '/admin/feature-x'
  });
}
```

**Estado**: NO completada (bodyHtml vacío)

### ❌ Violación: Sidebar no aparece

```javascript
// Handler no usa renderAdminPage()
export default async function handler(request, env, ctx) {
  return new Response('<html>...</html>'); // ❌ HTML manual, sin sidebar
}
```

**Estado**: NO completada (viola contrato de render)

### ❌ Violación: Ruta no accesible

```javascript
// Ruta registrada pero handler no mapeado
// admin-route-registry.js: { key: 'feature-x', path: '/admin/feature-x' }
// admin-router-resolver.js: // ❌ NO tiene mapeo
```

**Estado**: NO completada (ruta no funciona)

### ✅ Correcto: Feature visible y usable

```javascript
// Handler completo con contenido visible
export default async function handler(request, env, ctx) {
  const data = await getData();
  return renderAdminPage({
    title: 'Feature X',
    contentHtml: `
      <div class="container">
        <h1>Feature X</h1>
        ${data.length > 0 
          ? renderDataTable(data) 
          : '<p class="empty-state">No hay datos disponibles</p>'
        }
      </div>
    `,
    activePath: '/admin/feature-x'
  });
}
```

**Estado**: ✅ Completada (visible, usable, ensamblada)

---

## 🔄 PROCESO DE CIERRE CANÓNICO

### Paso 1: Implementación de Código
- Crear handlers, servicios, repos según corresponda
- Implementar lógica de negocio
- Crear tests si aplica

### Paso 2: Registro de Rutas
- Registrar ruta en `admin-route-registry.js` (si es Admin)
- Mapear handler en `admin-router-resolver.js` (si es Admin)
- Añadir entrada al sidebar si aplica

### Paso 3: ENSAMBLAJE (OBLIGATORIO)
- Usar `renderAdminPage()` con contenido real
- Verificar que sidebar aparece
- Verificar que contenido es visible
- Verificar que no hay errores

### Paso 4: Verificación Final
- Acceder a la ruta desde navegador
- Confirmar visibilidad y usabilidad
- Confirmar que no hay errores
- **Solo entonces** declarar como completada

---

## 📚 REFERENCIAS

- `.cursor/rules/contratos.mdc` - Regla `done-means-visible`
- `docs/CONTRACT_OF_CONTRACTS.md` - Registro de contratos
- `src/core/admin/admin-page-renderer.js` - Contrato de render Admin
- `src/core/admin/admin-route-registry.js` - Registry de rutas Admin
- `docs/ASSEMBLY_CHECK_SYSTEM.md` - Assembly Check System (ACS) v1.0
- `/admin/system/assembly` - UI del Assembly Check System

---

## 🎯 CONCLUSIÓN

**Una feature no visible se considera INEXISTENTE.**

Este protocolo es **LEY OPERATIVA** del proyecto AuriPortal. Cualquier feature que no cumpla este protocolo **NO está completada**, independientemente de si el código existe en el backend.

**Principios fundamentales**:
1. Visible = Implementado
2. No visible = No implementado
3. ENSAMBLAJE es fase obligatoria
4. Verificación práctica es requerida
5. "Ya está pero no se ve" = NO está

---

**Este protocolo es LEY OPERATIVA del proyecto AuriPortal.**


