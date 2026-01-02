# Diagnóstico Forense Backend: Sidebar MASTER - "Systema" aparece en runtime

**Fecha**: 2025-01-XX  
**Tipo**: Diagnóstico Forense Backend (SOLO LECTURA)  
**Objetivo**: Determinar por qué el sidebar muestra "Systema" después de corregir `getMasterSidebarData()`

---

## 1️⃣ IDENTIFICACIÓN EXACTA DEL SOURCE OF TRUTH

### Generación de `SIDEBAR_DATA`

**Archivo**: `src/core/master/layout/master-page-renderer.js`  
**Línea**: 144  
**Función**: `renderMasterPage()`

```javascript
// Línea 144
const sidebarData = getMasterSidebarData(universeId, activePath);
```

**Serialización en HTML**:  
**Línea**: 210  
**Código**:
```javascript
html = html.replace(/\{\{SIDEBAR_DATA\}\}/g, sidebarDataJson);
```

**Inyección en template**:  
**Archivo**: `src/core/master/layout/master-layout-v1.html`  
**Línea**: 289  
**Atributo HTML**:
```html
<nav id="master-sidebar-container" class="master-sidebar" data-sidebar-data="{{SIDEBAR_DATA}}">
```

---

## 2️⃣ IMPORT Y PATH DE `getMasterSidebarData`

**Archivo**: `src/core/master/layout/master-page-renderer.js`  
**Línea**: 31  
**Import**:
```javascript
import { getMasterSidebarData } from '../registry/master-sidebar-registry.js';
```

**Archivo fuente**: `src/core/master/registry/master-sidebar-registry.js`  
**Línea**: 254  
**Función**: `export function getMasterSidebarData(universeId, activePath)`

**✅ CONFIRMADO**: El import es correcto y apunta a la función corregida.

---

## 3️⃣ FUNCIÓN CORREGIDA (Estado actual)

**Archivo**: `src/core/master/registry/master-sidebar-registry.js`  
**Líneas**: 254-268

**Estado actual de la función**:
```javascript
export function getMasterSidebarData(universeId, activePath) {
  // CONTRATO: El sidebar está ligado al layout activo (layout_templo_luz_v1),
  // NO depende del universeId. El universeId solo se usa para logs si existe.
  // El sidebar del Templo de Ankhar SIEMPRE muestra todas las secciones:
  // - Transmutaciones Energéticas
  // - Investigación
  // - Comunicaciones
  const templateEntries = masterSidebarRegistry.filter(entry => 
    entry.visible && entry.universe === 'templo_luz'
  );
  
  // Log si universeId existe (solo para contexto, no afecta resultado)
  if (universeId) {
    console.log(`[MasterSidebar] universeId recibido: ${universeId} (solo para logs, sidebar muestra siempre Templo)`);
  }
```

**✅ CONFIRMADO**: La función filtra SOLO por `entry.universe === 'templo_luz'` y ignora el parámetro `universeId`.

---

## 4️⃣ VALOR DE `universeId` EN RUNTIME

### Valor por defecto en renderer

**Archivo**: `src/core/master/layout/master-page-renderer.js`  
**Línea**: 121  
**Valor por defecto**:
```javascript
universeId = 'systema',
```

### Valores pasados por handlers

**Handler**: `master-dashboard.js`  
**Línea**: 23  
**Valor pasado**:
```javascript
universeId: 'systema'
```

**Handler**: `master-systema.js`  
**Línea**: 22  
**Valor pasado**:
```javascript
universeId: 'systema'
```

**Handler**: `master-templo-luz-alquimia-general.js`  
**Línea**: 23  
**Valor pasado**:
```javascript
universeId: 'templo_luz'
```

**✅ CONFIRMADO**: Los handlers pasan diferentes valores de `universeId`, pero según la función corregida, esto NO debería afectar el resultado.

---

## 5️⃣ ENTRIES DEL REGISTRY CON `universe: 'systema'`

**Archivo**: `src/core/master/registry/master-sidebar-registry.js`

**Entradas con `universe: 'systema'`**:

1. **Dashboard** (líneas 49-58):
   ```javascript
   {
     id: 'master-dashboard',
     label: 'Dashboard',
     icon: 'dashboard',
     route: '/master',
     section: null,
     visible: true,
     order: 1,
     universe: 'systema'
   }
   ```

2. **Systema** (líneas 84-94):
   ```javascript
   {
     id: 'master-systema',
     label: 'Systema',
     icon: 'system',
     route: '/master/systema',
     section: 'Systema',
     visible: true,
     order: 1,
     universe: 'systema'
   }
   ```

**⚠️ OBSERVACIÓN**: Estas entradas tienen `universe: 'systema'`, por lo que NO deberían aparecer después del filtro corregido (`entry.universe === 'templo_luz'`).

---

## 6️⃣ VERIFICACIÓN DE DUPLICADOS

### Búsqueda de funciones similares

**✅ NO se encontraron**:
- Otras funciones con nombre `getMasterSidebarData`
- Funciones con nombres similares (`getSidebarData`, `getMasterSidebar`, etc.)
- Lógica duplicada de filtrado por `universeId` fuera del registry

### Búsqueda de lógica de sidebar alternativa

**✅ NO se encontró**:
- Lógica inline de filtrado de sidebar en handlers
- Helpers legacy que manipulen el sidebar
- Imports incorrectos o paths alternativos

---

## 7️⃣ CLIENTE JAVASCRIPT

**Archivo**: `public/js/master/master-sidebar-client.js`

**Verificación**:
- El cliente NO añade entradas manualmente
- El cliente NO filtra por `universeId`
- El cliente solo renderiza lo que recibe en `data-sidebar-data`

**✅ CONFIRMADO**: El cliente JavaScript no es la causa del problema.

---

## 8️⃣ CONCLUSIÓN DEL DIAGNÓSTICO

### Source of Truth Real

**El `SIDEBAR_DATA` se genera en**:
- **Archivo**: `src/core/master/layout/master-page-renderer.js`
- **Línea**: 144
- **Función**: `getMasterSidebarData(universeId, activePath)`

**El source of truth es**:
- **Archivo**: `src/core/master/registry/master-sidebar-registry.js`
- **Función**: `getMasterSidebarData()` (línea 254)

### Razón por la que sigue apareciendo "Systema"

**DIAGNÓSTICO**: 

La función `getMasterSidebarData()` **YA está corregida** para filtrar solo por `entry.universe === 'templo_luz'`. Las entradas con `universe: 'systema'` **NO deberían aparecer** con el código actual.

**Posibles causas**:

1. **Caché del servidor**: El servidor Node.js no se ha reiniciado después de la corrección, por lo que sigue ejecutando la versión anterior del código con el filtro por `universeId`.

2. **Caché del navegador**: El navegador puede estar mostrando HTML cacheado con `SIDEBAR_DATA` de una respuesta anterior.

3. **Código no desplegado**: Si el código está en un entorno de producción/staging, la corrección puede no haberse desplegado aún.

### Verificación requerida

Para confirmar el diagnóstico:

1. **Verificar que el servidor se ha reiniciado** después de la corrección
2. **Limpiar caché del navegador** o probar en modo incógnito
3. **Añadir logs temporales** en `getMasterSidebarData()` para verificar qué entradas se están filtrando:
   ```javascript
   console.log('[FORENSE] Entradas filtradas:', templateEntries.map(e => e.label));
   ```
4. **Inspeccionar el HTML generado** en el navegador para ver el valor real de `data-sidebar-data`

---

## 9️⃣ EVIDENCIA DEL FLUJO COMPLETO

### Flujo de generación de `SIDEBAR_DATA`

1. **Handler** (ej: `master-dashboard.js`) llama a `renderMasterPage({ universeId: 'systema', ... })`
2. **Renderer** (`master-page-renderer.js:144`) llama a `getMasterSidebarData('systema', '/master')`
3. **Registry** (`master-sidebar-registry.js:254`) filtra por `entry.universe === 'templo_luz'` (ignora `'systema'`)
4. **Renderer** (`master-page-renderer.js:145`) serializa como JSON y escapa para HTML
5. **Renderer** (`master-page-renderer.js:210`) reemplaza `{{SIDEBAR_DATA}}` en template
6. **Template** (`master-layout-v1.html:289`) inyecta en `data-sidebar-data`
7. **Cliente JS** (`master-sidebar-client.js`) lee `data-sidebar-data` y renderiza

**✅ FLUJO CONFIRMADO**: El código corregido debería funcionar correctamente.

---

## 📋 RESUMEN EJECUTIVO

**Pregunta**: ¿Dónde se genera `SIDEBAR_DATA` y por qué sigue apareciendo "Systema"?

**Respuesta**:
- `SIDEBAR_DATA` se genera en `master-page-renderer.js:144` usando `getMasterSidebarData()`
- La función `getMasterSidebarData()` ya está corregida para ignorar `universeId` y filtrar solo por `'templo_luz'`
- **La razón más probable**: El servidor no se ha reiniciado después de la corrección, ejecutando código antiguo
- **Verificación necesaria**: Reiniciar servidor y limpiar caché del navegador

---

**Diagnóstico completado**: ✅  
**Fuentes verificadas**: ✅  
**Duplicados verificados**: ✅  
**Causa identificada**: Caché del servidor (hipótesis principal)
