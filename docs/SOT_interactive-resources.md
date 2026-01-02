# Source of Truth: Recursos Interactivos

**Fecha de creación:** 2025-01-XX  
**Estado:** ACTIVO  
**Versión:** 1.0

## ═══════════════════════════════════════════════════════════
## ¿QUÉ ES UN RECURSO INTERACTIVO?
## ═══════════════════════════════════════════════════════════

Un **Recurso Interactivo** es cualquier contenido multimedia o experiencia dinámica que puede asociarse a entidades del sistema (ej. Técnicas de Limpieza).

Todos los recursos interactivos son **la misma entidad ontológica**, independientemente de su tipo:
- 🎥 Videos
- 🎵 Audios / Músicas
- 🖼 Imágenes
- ❓ Quizzes
- 🎮 Experiencias dinámicas
- 🧩 Ejercicios interactivos / Minijuegos

**Principio Fundamental:** La diferencia entre tipos está en `resource_type` y `payload`, **NO** en tablas separadas.

---

## ═══════════════════════════════════════════════════════════
## TIPOS SOPORTADOS
## ═══════════════════════════════════════════════════════════

### `video`
Contenido de video.

**Payload estándar:**
```json
{
  "url": "string (requerido)",
  "duration": "number (segundos, opcional)",
  "thumbnail": "string (URL, opcional)",
  "description": "string (opcional)"
}
```

### `audio`
Contenido de audio.

**Payload estándar:**
```json
{
  "url": "string (requerido)",
  "duration": "number (segundos, opcional)",
  "description": "string (opcional)"
}
```

### `image`
Imagen estática.

**Payload estándar:**
```json
{
  "url": "string (requerido)",
  "alt": "string (texto alternativo, opcional)",
  "description": "string (opcional)"
}
```

### `quiz`
Cuestionario interactivo.

**Payload estándar:**
```json
{
  "questions": "array (requerido)",
  "passing_score": "number (0-100, default: 80)",
  "time_limit": "number (segundos, opcional)"
}
```

### `experience`
Experiencia interactiva dinámica.

**Payload estándar:**
```json
{
  "config": "object (configuración, default: {})",
  "steps": "array (pasos de la experiencia, default: [])"
}
```

### `game`
Juego o minijuego.

**Payload estándar:**
```json
{
  "type": "string (tipo de juego, opcional)",
  "config": "object (configuración, default: {})"
}
```

---

## ═══════════════════════════════════════════════════════════
## CONTRATO DE PAYLOAD
## ═══════════════════════════════════════════════════════════

### Estructura General

Cada recurso tiene:
- `title` (TEXT): Título descriptivo
- `resource_type` (TEXT): Tipo del recurso (uno de los tipos soportados)
- `payload` (JSONB): Contenido específico según tipo
- `capabilities` (JSONB): Funcionalidades disponibles
- `origin` (JSONB): Origen del recurso

### Campo `origin`

Identifica qué SOT (Source of Truth) creó el recurso y a qué entidad pertenece.

**Estructura:**
```json
{
  "sot": "string (ej: 'tecnicas-limpieza')",
  "entity_id": "string (UUID de la entidad en el SOT)"
}
```

**Ejemplo:**
```json
{
  "sot": "tecnicas-limpieza",
  "entity_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

### Campo `capabilities`

Define funcionalidades disponibles según el tipo.

**Capabilities por defecto:**

- **video:**
  ```json
  {
    "autoplay": false,
    "fullscreen": true,
    "controls": true,
    "loop": false
  }
  ```

- **audio:**
  ```json
  {
    "autoplay": false,
    "controls": true,
    "loop": false
  }
  ```

- **image:**
  ```json
  {
    "zoom": true,
    "download": false
  }
  ```

- **quiz:**
  ```json
  {
    "show_results": true,
    "allow_retry": true,
    "randomize_questions": false
  }
  ```

- **experience:**
  ```json
  {
    "interactive": true,
    "progress_tracking": false
  }
  ```

- **game:**
  ```json
  {
    "interactive": true,
    "score_tracking": false,
    "leaderboard": false
  }
  ```

---

## ═══════════════════════════════════════════════════════════
## RELACIÓN CON OTROS SOT
## ═══════════════════════════════════════════════════════════

Los recursos interactivos se crean **desde** otros SOT:

1. **Técnicas de Limpieza:** Una técnica puede tener videos, audios, imágenes asociadas
2. **Futuros SOT:** Preparaciones, Recorridos, etc.

**Flujo:**
```
SOT (ej. Técnica de Limpieza)
  ↓
Crea Recurso Interactivo
  ↓
Almacena en interactive_resources
  ↓
Referencia mediante origin: {sot, entity_id}
```

---

## ═══════════════════════════════════════════════════════════
## PREPARACIÓN PARA RUNTIME FUTURO
## ═══════════════════════════════════════════════════════════

### Storage de Archivos

El sistema decide dónde se guardan los archivos físicos. La estructura preparada es:

```
/media/
  {sot}/
    {entity_id}/
      video/
      audio/
      images/
```

Esta información se prepara en `payload` pero **NO** se implementa storage aún.

### Integración Futura

El sistema está preparado para:
- **Packages:** Consumir recursos interactivos
- **Resolvers:** Resolver recursos según contexto
- **Widgets:** Renderizar recursos en UI
- **Juegos:** Integrar recursos como minijuegos
- **IA:** Usar recursos como contexto

---

## ═══════════════════════════════════════════════════════════
## EJEMPLOS JSON
## ═══════════════════════════════════════════════════════════

### Ejemplo 1: Video para Técnica de Limpieza

```json
{
  "id": "uuid-here",
  "title": "Técnica de Respiración Guiada",
  "resource_type": "video",
  "status": "active",
  "payload": {
    "url": "/media/tecnicas-limpieza/123e4567-e89b-12d3-a456-426614174000/video/respiracion.mp4",
    "duration": 300,
    "thumbnail": "/media/tecnicas-limpieza/123e4567-e89b-12d3-a456-426614174000/video/thumb.jpg",
    "description": "Video guiado para realizar técnica de respiración"
  },
  "capabilities": {
    "autoplay": false,
    "fullscreen": true,
    "controls": true,
    "loop": false
  },
  "origin": {
    "sot": "tecnicas-limpieza",
    "entity_id": "123e4567-e89b-12d3-a456-426614174000"
  },
  "created_at": "2025-01-XXT...",
  "updated_at": "2025-01-XXT..."
}
```

### Ejemplo 2: Quiz para Técnica

```json
{
  "id": "uuid-here",
  "title": "Quiz de Comprensión - Técnica X",
  "resource_type": "quiz",
  "status": "active",
  "payload": {
    "questions": [
      {
        "question": "¿Cuál es el primer paso?",
        "options": ["Opción A", "Opción B", "Opción C"],
        "correct": 0
      }
    ],
    "passing_score": 80,
    "time_limit": 600
  },
  "capabilities": {
    "show_results": true,
    "allow_retry": true,
    "randomize_questions": false
  },
  "origin": {
    "sot": "tecnicas-limpieza",
    "entity_id": "123e4567-e89b-12d3-a456-426614174000"
  },
  "created_at": "2025-01-XXT...",
  "updated_at": "2025-01-XXT..."
}
```

### Ejemplo 3: Imagen

```json
{
  "id": "uuid-here",
  "title": "Diagrama de Chakras",
  "resource_type": "image",
  "status": "active",
  "payload": {
    "url": "/media/tecnicas-limpieza/123e4567-e89b-12d3-a456-426614174000/images/chakras.png",
    "alt": "Diagrama mostrando los 7 chakras principales",
    "description": "Diagrama educativo sobre chakras"
  },
  "capabilities": {
    "zoom": true,
    "download": false
  },
  "origin": {
    "sot": "tecnicas-limpieza",
    "entity_id": "123e4567-e89b-12d3-a456-426614174000"
  },
  "created_at": "2025-01-XXT...",
  "updated_at": "2025-01-XXT..."
}
```

---

## ═══════════════════════════════════════════════════════════
## API
## ═══════════════════════════════════════════════════════════

### Crear Recurso

```
POST /admin/api/interactive-resources
Content-Type: application/json

{
  "title": "Título del recurso",
  "resource_type": "video",
  "payload": { ... },
  "capabilities": { ... },
  "origin": {
    "sot": "tecnicas-limpieza",
    "entity_id": "uuid"
  }
}
```

### Listar por Origen

```
GET /admin/api/interactive-resources/origin?sot=tecnicas-limpieza&entity_id=uuid
```

### Obtener Recurso

```
GET /admin/api/interactive-resources/:id
```

### Actualizar Recurso

```
PUT /admin/api/interactive-resources/:id
Content-Type: application/json

{
  "title": "Nuevo título",
  "payload": { ... }
}
```

### Archivar Recurso (Soft Delete)

```
DELETE /admin/api/interactive-resources/:id
```

---

## ═══════════════════════════════════════════════════════════
## CHECKLIST DE CERTIFICACIÓN
## ═══════════════════════════════════════════════════════════

- ✅ Tabla `interactive_resources` creada en PostgreSQL
- ✅ Campos obligatorios definidos (id, title, resource_type, status, payload, capabilities, origin)
- ✅ Índices creados (resource_type, status, origin GIN)
- ✅ Triggers de `updated_at` funcionando
- ✅ Repositorio PostgreSQL implementado (`InteractiveResourceRepoPg`)
- ✅ Servicio canónico con validaciones (`InteractiveResourceService`)
- ✅ API endpoints registrados en `admin-route-registry.js`
- ✅ Handler mapeado en `admin-router-resolver.js`
- ✅ Validación de `resource_type` implementada
- ✅ Normalización de `payload` por tipo
- ✅ Capabilities por defecto definidas
- ✅ Documentación completa

---

## ═══════════════════════════════════════════════════════════
## REGLAS ABSOLUTAS
## ═══════════════════════════════════════════════════════════

1. **Todos los recursos son la misma entidad ontológica.** NO crear tablas separadas por tipo.
2. **PostgreSQL = única autoridad.** NO usar SQLite ni legacy como fallback.
3. **Soft delete obligatorio.** Usar `status='archived'`, NO DELETE físico.
4. **origin siempre requerido.** Todo recurso debe tener `sot` y `entity_id`.
5. **Validación estricta de resource_type.** Solo tipos soportados.
6. **Normalización automática de payload.** El servicio normaliza según tipo.
7. **Capabilities por defecto.** Si no se proporcionan, se asignan automáticamente.

---

**Este SOT es parte de la constitución de AuriPortal y debe respetarse sin excepciones.**







