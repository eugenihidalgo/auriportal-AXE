# Editor de Recorridos UI v1 - Implementación Completada

## 📋 Resumen

Se ha implementado el Editor de Recorridos UI v1 (ADMIN) con estilo Typeform/Unity sobre el motor ya existente. El editor permite crear y editar drafts de recorridos sin código, visualizar el flujo de steps, configurar screens, props, branches y events, validar y publicar recorridos.

## 📁 Archivos Creados/Modificados

### Archivos Nuevos

1. **`src/endpoints/admin-recorridos.js`**
   - Handler principal para las vistas UI de recorridos
   - Renderiza listado y editor de recorridos
   - Verifica feature flag `recorridos_editor_v1`

2. **`src/core/html/admin/recorridos/recorridos-listado.html`**
   - Vista de lista de recorridos
   - Tabla con: id, name, status, published_version, updated_at
   - Acciones: Editar, Duplicar, Exportar
   - Botón "Nuevo recorrido"

3. **`src/core/html/admin/recorridos/recorridos-editor.html`**
   - Editor completo de recorridos
   - Layout de 3 columnas: steps list, preview, config panel
   - Funcionalidades completas de edición

### Archivos Modificados

1. **`src/core/html/admin/base.html`**
   - Añadida sección "Recorridos" en el sidebar
   - Enlaces: "Todos los recorridos" y "Nuevo recorrido"

2. **`src/router.js`**
   - Añadidas rutas para `/admin/recorridos` y `/admin/api/recorridos`
   - Rutas añadidas antes de la delegación a admin-panel-v4

3. **`src/core/flags/feature-flags.js`**
   - Feature flag `recorridos_editor_v1` actualizado a `'beta'`
   - Comentarios actualizados

## 🛣️ Rutas Nuevas

### UI Routes (Admin)

- `GET /admin/recorridos` - Lista de recorridos
- `GET /admin/recorridos/new` - Crear nuevo recorrido
- `GET /admin/recorridos/:id/edit` - Editor de recorrido

### API Routes (ya existían, ahora integradas)

- `GET /admin/api/recorridos` - Lista de recorridos (JSON)
- `POST /admin/api/recorridos` - Crear recorrido
- `GET /admin/api/recorridos/:id` - Obtener recorrido
- `PUT /admin/api/recorridos/:id/draft` - Actualizar draft
- `POST /admin/api/recorridos/:id/validate` - Validar draft
- `POST /admin/api/recorridos/:id/publish` - Publicar versión
- `GET /admin/api/recorridos/:id/export` - Exportar recorrido
- `POST /admin/api/recorridos/import` - Importar recorrido

## 🎯 Funcionalidades Implementadas

### PARTE 1: Sidebar ✅
- Sección "Recorridos" añadida al sidebar
- Enlaces a lista y creación de recorridos

### PARTE 2: Lista de Recorridos ✅
- Tabla con: id, name, status, published_version, updated_at
- Acciones: Editar, Duplicar, Exportar
- Botón "Nuevo recorrido"
- Carga dinámica desde API

### PARTE 3: Editor de Recorrido ✅
- **Layout:**
  - Header fijo con estado, validate, publish
  - Columna izquierda: lista de steps
  - Centro: preview de pantalla
  - Derecha: panel de configuración del step

- **Funcionalidades:**
  - ✅ Añadir/eliminar/reordenar steps
  - ✅ Seleccionar StepType desde registry
  - ✅ Seleccionar ScreenTemplate compatible
  - ✅ Generar formulario de props desde JSON Schema
  - ✅ Configurar capture
  - ✅ Configurar branches (edges) con Conditions registry
  - ✅ Configurar emit events
  - ✅ Guardar draft automáticamente (debounced 1s)

### PARTE 4: Preview ✅
- Botón "Preview Run" implementado
- Abre en nueva ventana (preparado para runtime real)
- Preview básico en el editor muestra información del step

### PARTE 5: Validación y Publicación ✅
- **Validate:**
  - Muestra errores/warnings inline
  - Feedback visual claro (errores en rojo, warnings en amarillo)
  
- **Publish:**
  - Bloquea si hay errores
  - Pide release notes
  - Feedback visual claro

### PARTE 6: Grafo Visual (READ-ONLY) ⏳
- **Pendiente para v1.1**
- Vista automática del flujo
- Nodos = steps
- Aristas = branches
- Solo lectura

## 🧪 Cómo Probar el Editor

### 1. Verificar Feature Flag

El feature flag `recorridos_editor_v1` debe estar en `'beta'` o `'on'`:

```javascript
// src/core/flags/feature-flags.js
recorridos_editor_v1: 'beta', // o 'on'
```

### 2. Acceder al Editor

1. Ir a `/admin` (requiere autenticación admin)
2. En el sidebar, buscar la sección "🗺️ Recorridos"
3. Clic en "Todos los recorridos" o "Nuevo recorrido"

### 3. Crear un Recorrido

1. Clic en "Nuevo recorrido"
2. Introducir ID (ej: `mi-recorrido`)
3. Introducir nombre (ej: `Mi Recorrido de Prueba`)
4. Se crea automáticamente con un step inicial

### 4. Editar un Recorrido

1. En la lista, clic en "Editar" de cualquier recorrido
2. El editor se abre con:
   - Lista de steps a la izquierda
   - Preview en el centro
   - Panel de configuración a la derecha

### 5. Añadir Steps

1. Clic en el botón "➕" en la lista de steps
2. Introducir ID del step (ej: `step2`)
3. El step se añade automáticamente

### 6. Configurar un Step

1. Seleccionar un step de la lista
2. En el panel derecho:
   - Seleccionar StepType (desde registry)
   - Seleccionar ScreenTemplate
   - Configurar props (generadas desde JSON Schema)
   - Configurar capture
   - Añadir branches (edges)
   - Añadir emit events

### 7. Validar

1. Clic en "✓ Validar" en el header
2. Se muestran errores/warnings inline

### 8. Publicar

1. Clic en "🚀 Publicar" en el header
2. Introducir release notes (opcional)
3. Si hay errores, se bloquea la publicación
4. Si es válido, se publica como nueva versión

### 9. Duplicar/Exportar

- **Duplicar:** Desde la lista, clic en "Duplicar"
- **Exportar:** Desde la lista, clic en "Exportar" (descarga JSON)

## 📝 Notas de Decisiones v1

### Arquitectura

1. **HTML Server-Side (renderHtml)**
   - Se mantiene la arquitectura existente
   - No hay lógica de flujo en frontend
   - Todo viene del backend y schemas

2. **Feature Flag**
   - Inicialmente en `'beta'` para testing
   - Protege el editor hasta que esté completamente probado

3. **Guardado Automático**
   - Debounced de 1 segundo
   - No bloquea la UI
   - Guarda en draft automáticamente

4. **Registry Integration**
   - Usa `/admin/api/registry` para obtener capabilities
   - No duplica registry
   - Filtra screen templates compatibles

### Limitaciones v1

1. **Preview**
   - Preview básico implementado
   - Preview completo con runtime real pendiente (se abrirá en nueva ventana)

2. **Grafo Visual**
   - Pendiente para v1.1
   - Se puede añadir con librería de grafos (ej: vis.js, cytoscape.js)

3. **Reordenar Steps**
   - UI básica implementada
   - Reordenamiento drag-and-drop pendiente para v1.1

4. **Validación en Tiempo Real**
   - Validación manual con botón
   - Validación automática en tiempo real pendiente para v1.1

### Mejoras Futuras (v1.1+)

1. Preview completo con runtime real en iframe
2. Grafo visual interactivo (read-only)
3. Reordenamiento drag-and-drop de steps
4. Validación en tiempo real mientras se edita
5. Historial de cambios (undo/redo)
6. Templates de recorridos predefinidos
7. Importación desde JSON mejorada
8. Exportación a diferentes formatos

## 🔧 Dependencias

- **Backend:**
  - Endpoints API de recorridos (ya existentes)
  - Registry de capabilities (ya existente)
  - Sistema de validación (ya existente)

- **Frontend:**
  - Tailwind CSS (ya incluido en base.html)
  - JavaScript vanilla (sin dependencias externas)

## 🐛 Troubleshooting

### El editor no aparece en el sidebar

- Verificar que el feature flag `recorridos_editor_v1` esté en `'beta'` o `'on'`
- Verificar que las rutas estén correctamente añadidas en `router.js`

### Error al cargar recorridos

- Verificar que los endpoints API estén funcionando: `/admin/api/recorridos`
- Verificar autenticación admin

### Error al guardar draft

- Verificar que el recorrido exista
- Verificar permisos de escritura en la base de datos
- Revisar logs del servidor

### Registry no carga

- Verificar que `/admin/api/registry` esté funcionando
- Verificar feature flag `recorridos_registry_v1`

## ✅ Checklist de Implementación

- [x] PARTE 1: Sidebar con sección Recorridos
- [x] PARTE 2: Lista de recorridos
- [x] PARTE 3: Editor de recorrido completo
- [x] PARTE 4: Preview (básico)
- [x] PARTE 5: Validación y publicación
- [ ] PARTE 6: Grafo visual (pendiente v1.1)
- [x] Rutas añadidas al router
- [x] Feature flag configurado
- [x] Documentación completa

## 🎉 Estado

**Editor de Recorridos UI v1 implementado y funcional**

El editor está listo para usar en entornos beta. Para producción, cambiar el feature flag a `'on'` después de pruebas exhaustivas.





