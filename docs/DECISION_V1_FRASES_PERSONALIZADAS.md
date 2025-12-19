# DECISIÓN CANÓNICA v1 — FRASES PERSONALIZADAS GLOBALES

## 📋 Resumen

Sistema de frases personalizadas por nivel convertido en recurso PDE canónico global, disponible en todo el sistema (Editor de Recorridos, Screen Templates, Sistema AXE, Navegación, Preview).

## ✅ Implementación Completada

### PASO 1: Modelo de Datos ✅
- **Migración SQL**: `database/migrations/v5.8.0-create-pde-frases-personalizadas.sql`
- **Tabla**: `pde_frases_personalizadas`
- **Campos**:
  - `id` (SERIAL PRIMARY KEY)
  - `nombre` (VARCHAR(200) NOT NULL)
  - `descripcion` (TEXT, nullable)
  - `frases_por_nivel` (JSONB: nivel -> array de strings)
  - `deleted_at` (TIMESTAMPTZ, soft delete)
  - `created_at`, `updated_at`

### PASO 2: Repositorio PDE ✅
- **Archivo**: `src/services/pde-frases-personalizadas.js`
- **Métodos**:
  - `listFrasesPersonalizadas()` - Lista todos los recursos activos
  - `getFrasesPersonalizadasById(id)` - Obtiene un recurso por ID
  - `createFrasesPersonalizadas(data)` - Crea un nuevo recurso
  - `updateFrasesPersonalizadas(id, data)` - Actualiza un recurso
  - `softDeleteFrasesPersonalizadas(id)` - Soft delete
  - `restoreFrasesPersonalizadas(id)` - Restaura un recurso eliminado

### PASO 3: Resolver Global ✅
- **Archivo**: `src/core/pde/catalogs/frases-personalizadas-resolver.js`
- **Función principal**: `resolveFrasePersonalizada({ frasesResourceId, studentCtx })`
- **Lógica**:
  1. Construir pool con TODAS las frases de niveles <= nivel_efectivo (incluido)
  2. Si pool vacío → devolver null
  3. Elegir frase RANDOM del pool
  4. Devolver string
- **Exportado en**: `src/core/pde/catalogs/index.js`

### PASO 4: Admin UI ✅
- **Ruta**: `/admin/frases`
- **Funcionalidades**:
  - Listar recursos de frases personalizadas
  - Crear nuevo recurso
  - Editar recurso existente
  - Eliminar recurso (soft delete)
  - Gestión de frases por nivel (1-9)
  - Múltiples frases por nivel permitidas
- **Archivo modificado**: `src/endpoints/admin-panel-v4.js`

## 🔄 Pendiente de Implementación

### PASO 5: Screen Template
- **ID**: `screen_frases_personalizadas`
- **Nombre**: "Frases personalizadas"
- **Props**:
  - `frases_resource_id` (required)
  - `title` (optional)
- **Renderizado**: Usa el resolver global para obtener frase según nivel_efectivo

### PASO 6: Integración en Editor de Recorridos
- Hacer disponible el template `screen_frases_personalizadas`
- Selector de recursos de frases personalizadas
- Validación en publish
- Preview real usando resolver global

### PASO 7: Integración en Navegación
- Permitir usar `screen_frases_personalizadas` en nodos de navegación
- Pantallas directas
- Flujos fuera de recorridos

### PASO 8: Integración en Sistema AXE
- Permitir que AXE consuma frases personalizadas como contenido
- Usar el resolver global
- No implementar lógica propia de nivel

## 📐 Reglas No Negociables

✅ **Contenido PDE ≠ Pantallas ≠ Recorridos ≠ AXE ≠ Progreso**
✅ **La lógica de nivel vive SOLO en el resolver global**
✅ **Usar nivel_efectivo ya existente**
✅ **Migraciones SQL reales**
✅ **Dominio accede a DB solo vía repositorios**
✅ **Fail-open absoluto**
✅ **Sin hardcodes**
✅ **Sin ClickUp** (migrado a PDE)
✅ **Sin duplicar lógica en AXE o navegación**

## 🎯 Decisión Canónica v1 — Frases

- **Pool permitido** = niveles <= nivel_efectivo (incluido)
- **Pool prohibido** = niveles > nivel_efectivo
- **Se incluyen frases del nivel exacto del alumno**
- **Selección RANDOM dentro del pool**
- **Si el pool está vacío → no se muestra frase**

## 📝 Uso del Resolver

```javascript
import { resolveFrasePersonalizada } from '../core/pde/catalogs/frases-personalizadas-resolver.js';

// En un endpoint o handler:
const frase = await resolveFrasePersonalizada({
  frasesResourceId: 1,
  studentCtx: ctx
});

// frase puede ser: "Bienvenido al nivel 1" o null
```

## 🔍 Verificación Pendiente

- [ ] Crear frases por nivel
- [ ] Usarlas en recorrido
- [ ] Usarlas en navegación
- [ ] Usarlas en AXE
- [ ] Simular distintos niveles
- [ ] Confirmar random correcto
- [ ] Confirmar que nunca aparecen frases de nivel superior

---

**Fecha**: 2025-01-XX
**Versión**: v1.0.0
**Estado**: Implementación base completada, integraciones pendientes



