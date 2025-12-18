# AXE Contract v1 — Contrato Estable de la Capa Intermedia

**Versión:** v0.6.3 (Freeze Semántico)  
**Fecha:** 2025-01-XX  
**Estado:** ✅ ESTABLE — CONGELADO

---

## 🎯 ¿Qué es AXE?

**AXE** (Architecture eXecution Engine) es una **capa intermedia estable** que proporciona:

1. **Representación Visual del Flujo**: CanvasDefinition como modelo visual de recorridos
2. **Conversión Bidireccional**: Transformación entre Canvas y RecorridoDefinition
3. **Validación Estructural**: Garantías de integridad del flujo
4. **Normalización Determinista**: Estructura consistente para diffs y comparaciones

### Propósito Principal

AXE permite **definir recorridos visualmente** (Canvas) y **convertirlos automáticamente** a definiciones ejecutables (RecorridoDefinition) que el runtime puede procesar.

---

## ❌ ¿Qué NO es AXE?

AXE **NO es**:

- ❌ **Runtime de ejecución**: No ejecuta recorridos, solo los convierte
- ❌ **Sistema de persistencia**: No guarda progreso ni estado
- ❌ **Motor de lógica de negocio**: No calcula ni procesa datos
- ❌ **UI de edición**: No renderiza interfaces visuales (aunque puede usarse por UI)
- ❌ **Sistema de autenticación**: No gestiona usuarios ni permisos
- ❌ **Base de datos**: No almacena datos directamente (usa repositorios)

**AXE es puramente una capa de transformación y validación.**

---

## 📥 Inputs

### 1. CanvasDefinition

**Formato:**
```typescript
{
  version: '1.0',
  canvas_id: string,
  name: string,
  description?: string,
  entry_node_id: string,
  nodes: CanvasNode[],
  edges: CanvasEdge[],
  viewport?: ViewportConfig,
  meta?: CanvasMetadata
}
```

**Fuentes:**
- Persistido en `recorrido_drafts.canvas_json` (editable)
- Persistido en `recorrido_versions.canvas_json` (inmutable)
- Derivado desde `definition_json` vía `recorridoToCanvas()` (runtime)

### 2. RecorridoDefinition (Legacy)

**Formato:**
```typescript
{
  id: string,
  name: string,
  description?: string,
  entry_step_id: string,
  steps: { [step_id: string]: StepDefinition },
  edges: EdgeDefinition[]
}
```

**Fuentes:**
- Persistido en `recorrido_drafts.definition_json` (editable)
- Persistido en `recorrido_versions.definition_json` (inmutable)
- Generado desde `canvas_json` vía `canvasToRecorrido()` (publish-time)

---

## 📤 Outputs

### 1. RecorridoDefinition (desde Canvas)

**Función:** `canvasToRecorrido(canvas: CanvasDefinition): RecorridoDefinition`

**Comportamiento:**
- Filtra nodos no ejecutables (group, comment, start, end)
- Convierte nodos a steps según tipo
- Convierte edges a edges de recorrido
- Preserva orden lógico
- Mapea decisiones a branching existente

**Uso:** En flujo de publicación cuando existe `canvas_json`

### 2. CanvasDefinition (desde Recorrido)

**Función:** `recorridoToCanvas(recorrido: RecorridoDefinition, options?): CanvasDefinition`

**Comportamiento:**
- Genera nodos desde steps
- Infiere Start y End
- Representa secuencialidad como edges directos
- Genera posiciones automáticamente (opcional)

**Uso:** En runtime cuando se necesita visualizar un recorrido legacy

### 3. Validación

**Función:** `validateCanvasDefinition(canvas: CanvasDefinition, options?): ValidationResult`

**Retorna:**
```typescript
{
  ok: boolean,
  errors: ValidationError[],
  warnings: ValidationWarning[]
}
```

**Errores bloqueantes:**
- 0 o >1 StartNode
- Nodos huérfanos (sin edges)
- Edges a nodos inexistentes
- EndNode inalcanzable
- Loops infinitos sin salida
- ScreenNode sin `screen_template_id`

### 4. Normalización

**Función:** `normalizeCanvasDefinition(canvas: CanvasDefinition, options?): CanvasDefinition`

**Comportamiento:**
- Ordena nodos y edges determinísticamente
- Completa campos faltantes con defaults
- Asegura IDs únicos
- Prepara estructura para diffs

---

## ✅ Garantías

AXE garantiza:

### 1. Conversión Determinista

- `canvasToRecorrido()` siempre produce el mismo `RecorridoDefinition` para el mismo `CanvasDefinition`
- `recorridoToCanvas()` siempre produce el mismo `CanvasDefinition` para el mismo `RecorridoDefinition` (con opciones iguales)

### 2. Validación Estructural

- Canvas válido → Recorrido válido (si pasa validación, el recorrido resultante es ejecutable)
- Validación en publish-time es estricta (bloquea errores)
- Validación en draft-time es permisiva (permite warnings)

### 3. Normalización Consistente

- `normalizeCanvasDefinition()` siempre produce estructura determinista
- Facilita diffs y comparaciones
- Asegura IDs únicos automáticamente

### 4. Fail-Open

- Si falla conversión, no rompe el sistema
- Si falla validación, reporta errores pero no lanza excepciones
- Si falta canvas, se deriva automáticamente desde `definition_json`

### 5. Inmutabilidad en Versiones

- `canvas_json` en `recorrido_versions` es INMUTABLE (congelado en publish)
- `definition_json` en `recorrido_versions` es INMUTABLE (congelado en publish)
- Una vez publicado, nunca cambia

---

## ⚠️ No-Garantías

AXE **NO garantiza**:

### 1. Ejecutabilidad del Runtime

- AXE valida estructura, no ejecutabilidad
- El runtime puede rechazar un recorrido válido estructuralmente
- Validación de `screen_template_id` contra registries la hace el runtime

### 2. Preservación de Información Visual

- Conversión Canvas → Recorrido puede perder información visual (posiciones, viewport)
- Conversión Recorrido → Canvas puede inferir información visual incorrectamente
- Meta se preserva cuando es posible

### 3. Compatibilidad Hacia Atrás

- Cambios en el modelo Canvas pueden romper conversiones antiguas
- Versiones futuras pueden requerir migración de canvas existentes
- El formato Canvas v1.0 es estable, pero futuras versiones pueden cambiar

### 4. Performance

- Conversiones grandes pueden ser lentas
- Validaciones complejas pueden tomar tiempo
- No hay caché de conversiones (se calculan cada vez)

### 5. UI/UX

- AXE no garantiza que el canvas sea editable visualmente
- No garantiza que la UI pueda renderizar todos los tipos de nodos
- No garantiza que el editor visual funcione correctamente

---

## 🔗 Relación con Runtime

### Flujo de Ejecución

```
1. Editor → CanvasDefinition (visual)
   ↓
2. AXE → canvasToRecorrido() → RecorridoDefinition
   ↓
3. Publish → Guarda RecorridoDefinition en version
   ↓
4. Runtime → Lee RecorridoDefinition → Ejecuta
```

### Separación de Responsabilidades

**AXE:**
- Transformación Canvas ↔ Recorrido
- Validación estructural
- Normalización

**Runtime:**
- Ejecución de pasos
- Gestión de estado
- Validación de registries (screen templates, conditions)
- Manejo de errores en ejecución

### Interfaz

El runtime **NO conoce** CanvasDefinition. Solo consume RecorridoDefinition.

AXE **NO conoce** el runtime. Solo produce RecorridoDefinition estándar.

---

## 📋 Flujo de Publicación (AXE v0.6.3)

### Caso 1: Canvas Persistido

```
1. draft.canvas_json existe
   ↓
2. Validar canvas estrictamente (isPublish: true)
   ↓
3. Normalizar canvas
   ↓
4. Generar definition_json vía canvasToRecorrido()
   ↓
5. Validar definition_json (isPublish: true)
   ↓
6. Publicar ambos (canvas_json + definition_json)
```

### Caso 2: Canvas No Persistido (Legacy)

```
1. draft.canvas_json es null
   ↓
2. Usar draft.definition_json directamente
   ↓
3. Validar definition_json (isPublish: true)
   ↓
4. Derivar canvas vía recorridoToCanvas() (opcional, para visualización)
   ↓
5. Publicar definition_json (y canvas_json derivado si se generó)
```

---

## 🔒 Freeze Semántico v0.6.3

**AXE v0.6.3 está congelado semánticamente:**

- ✅ Contrato estable (este documento)
- ✅ Funciones core no cambiarán su firma
- ✅ Modelo Canvas v1.0 estable
- ✅ Conversiones bidireccionales estables
- ✅ Validaciones estructurales estables

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

---

## 📚 Referencias

- **Modelo Canvas:** `docs/AXE_V0_6_1_CANVAS_MODEL.md`
- **Lógica Canvas:** `docs/AXE_V0_6_2_CANVAS_LOGIC.md`
- **Implementación v0.6.3:** `docs/AXE_V0_6_3_RESUMEN_FINAL.md`

---

**Fin del Contrato AXE v1**

