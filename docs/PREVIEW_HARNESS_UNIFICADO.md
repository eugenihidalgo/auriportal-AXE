# Preview Harness Unificado - Documentación

## SPRINT AXE v0.3

Documentación de los contratos creados y formalizados para el Preview Harness Unificado del Admin.

---

## Contratos Formales

### 1. PreviewContext

**Archivo**: `src/core/preview/preview-context.js`

**Estructura normalizada**:
```typescript
interface PreviewContext {
  student: {
    nivel: string;              // "1", "7", "12", etc.
    nivel_efectivo: number;     // 1-15
    estado: string;             // "activo", "pausado", etc.
    energia: number;            // 0-100
    racha: number;              // Días consecutivos
    email: string;              // Email mock
    nombre: string;             // Nombre mock
  };
  fecha_simulada: string;       // ISO string
  flags: object;                // Flags adicionales
  preview_mode: true;           // SIEMPRE true (protección runtime)
  navigation_id: string | null; // ID de navegación opcional
}
```

**Principios**:
- Fail-open absoluto: siempre devuelve un contexto válido
- Validación suave: warnings, no errores
- `preview_mode` siempre es `true` para proteger el runtime público

**Funciones principales**:
- `normalizePreviewContext(input)`: Normaliza y valida input, siempre devuelve contexto válido
- `validatePreviewContext(input)`: Solo valida, devuelve warnings sin modificar
- `getSafePreviewContext(input)`: Garantiza contexto válido (always succeeds)

---

### 2. Mock Profiles v1

**Archivo**: `src/core/preview/mock-profiles.js`

**Presets por defecto**:
- `basica`: Nivel 1, energía 50, racha 1
- `profunda`: Nivel 7, energía 75, racha 45
- `maestro`: Nivel 12, energía 90, racha 200

**Almacenamiento**: localStorage (clave: `auriportal_mock_profiles_v1`)

**Estructura**:
```typescript
interface MockProfile {
  id: string;
  name: string;
  description: string;
  preview_context: PreviewContext;
  updated_at: string;  // ISO string
}
```

**Funciones principales**:
- `getMockProfiles()`: Obtiene todos los profiles (inicializa con defaults si no existen)
- `getMockProfile(profileId)`: Obtiene un profile por ID
- `saveMockProfile(profile)`: Guarda o actualiza un profile
- `deleteMockProfile(profileId)`: Elimina un profile (no permite eliminar presets)
- `createPreviewContextFromProfileId(profileId)`: Genera PreviewContext desde profile

---

### 3. Endpoint Preview Extendido

**Endpoint**: `POST /admin/api/recorridos/:id/preview-step`

**Body (extendido)**:
```json
{
  "step_id": "step1",
  "mock": { ... },                    // Legacy (compatibilidad)
  "preview_context": { ... },         // Nuevo (PreviewContext normalizado)
  "preview_profile_id": "basica"      // Nuevo (ID de Mock Profile)
}
```

**Response**:
```json
{
  "ok": true,
  "html": "...",
  "render_spec": { ... },
  "warnings": [],
  "source": "draft" | "published",
  "checksum": "...",
  "updated_at": "...",
  "metadata": { ... },
  "render_error": null
}
```

**Compatibilidad**:
- Mantiene soporte para `mock` legacy
- Prioridad: `preview_context` > `preview_profile_id` > `mock` legacy

---

### 4. UI Preview Harness

**Archivo**: `public/js/preview-harness.js` + `public/css/preview-harness.css`

**Componentes**:
- Selector de Mock Profile
- Editor JSON del PreviewContext (colapsable)
- Render HTML del preview
- Warnings visibles
- Panel técnico colapsable (render_spec, metadata, context)

**Uso**:
```javascript
const harness = new PreviewHarness('container-id', {
  previewEndpoint: '/admin/api/recorridos',
  recorridoId: 'recorrido-id',
  stepId: 'step-id'
});
```

---

## Integración en Editor de Recorridos

El Preview Harness se integra en el editor de recorridos reemplazando el preview simple cuando está disponible.

**Cambios en**: `src/core/html/admin/recorridos/recorridos-editor.html`

- Container: `#preview-harness-container`
- Se inicializa automáticamente al cargar el editor
- Se actualiza cuando se selecciona un step

---

## Protecciones del Runtime

1. **preview_mode = true**: Siempre forzado en PreviewContext
2. **Validación en endpoint**: El endpoint no genera analíticas ni persiste estado cuando `preview_mode === true`
3. **Fail-open**: Si algo falla en preview, no afecta el runtime público

---

## Tests

**Archivo**: `tests/preview/preview-context.test.js`

Tests estructurales que verifican:
- Normalización con defaults
- Validación de rangos (nivel 1-15, energía 0-100)
- Fail-open absoluto
- Protección del runtime (preview_mode siempre true)

---

## Próximos Pasos (Fuera del Sprint)

- [ ] Soporte server-side para Mock Profiles (endpoints API)
- [ ] Preview de navegación / pantallas / temas
- [ ] Integración con otros editores
- [ ] Tests de integración E2E

---

**Versión**: 0.3  
**Fecha**: Sprint AXE v0.3



