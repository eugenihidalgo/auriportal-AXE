# Source of Truth: Técnicas de Limpieza Energética

**Fecha de creación:** 2025-01-XX  
**Estado:** ACTIVO  
**Versión:** 1.0

## ═══════════════════════════════════════════════════════════
## ROL ONTOLÓGICO
## ═══════════════════════════════════════════════════════════

### Ontología

Las **Técnicas de Limpieza Energética** son el Source of Truth canónico que constituye la autoridad ontológica del conocimiento sobre técnicas de transmutación energética en AuriPortal.

### Qué es una Técnica de Limpieza

Una Técnica de Limpieza es **conocimiento estructural** que representa:
- Una técnica concreta de transmutación energética
- Sus características (nivel, descripción, clasificación)
- Sus recursos asociados (vídeo, audio, imágenes, quizzes, experiencias, minijuegos)
- Su clasificación funcional (energías indeseables, limpiezas recurrentes)

**Regla clave:** Una Técnica es **conocimiento estructural**, no estado del alumno.

### Qué NO es una Técnica de Limpieza

Una Técnica de Limpieza **NO** es:
- ❌ Una práctica del alumno (esa es una relación separada)
- ❌ El progreso del alumno en esa técnica (ese es estado del alumno)
- ❌ Un evento de práctica (ese es un evento histórico)
- ❌ Una sesión de limpieza (esa es una ejecución temporal)

### Campos Semánticos

**Campos obligatorios:**
- `level` (INTEGER): Nivel energético de la técnica (1-9+)
- `name` (TEXT): Nombre de la técnica

**Campos opcionales:**
- `description` (TEXT): Descripción detallada de la técnica
- `estimated_duration` (INTEGER): Duración estimada en minutos
- `aplica_energias_indeseables` (BOOLEAN): Si aplica para energías indeseables
- `aplica_limpiezas_recurrentes` (BOOLEAN): Si aplica para limpiezas recurrentes
- `prioridad` (TEXT): Prioridad de la técnica
- `is_obligatoria` (BOOLEAN): Si es obligatoria

**Relaciones:**
- `media` (relación externa): Vídeo, audio, imágenes asociadas
- `interactive_resources` (relación externa): Recursos interactivos (quiz, experiencia, minijuego)

**Estado:**
- `status` (VARCHAR): 'active' o 'archived'

Este SOT es:
- **Educativo:** Define qué técnicas existen y sus características
- **Extensible:** Preparado para Packages, Resolvers, Widgets
- **Interactivo:** Integrado con recursos multimedia
- **Vivo:** Puede evolucionar sin refactor

---

## ═══════════════════════════════════════════════════════════
## ESQUEMA DE BASE DE DATOS
## ═══════════════════════════════════════════════════════════

### Tabla: `tecnicas_limpieza`

**Campos obligatorios:**
- `id` (INTEGER/BIGINT PRIMARY KEY)
- `nombre` (TEXT NOT NULL)
- `nivel` (INTEGER NOT NULL)

**Campos opcionales:**
- `descripcion` (TEXT)
- `estimated_duration` (INTEGER) - Duración estimada en minutos
- `aplica_energias_indeseables` (BOOLEAN DEFAULT false)
- `aplica_limpiezas_recurrentes` (BOOLEAN DEFAULT false)
- `prioridad` (TEXT DEFAULT 'media')
- `is_obligatoria` (BOOLEAN DEFAULT false)

**Campos de auditoría:**
- `status` (VARCHAR(20) DEFAULT 'active') - 'active' o 'archived' (soft delete)
- `created_at` (TIMESTAMPTZ DEFAULT now())
- `updated_at` (TIMESTAMPTZ DEFAULT now()) - Actualizado automáticamente por trigger

**Índices:**
- `idx_tecnicas_limpieza_status` (WHERE status = 'active')
- `idx_tecnicas_limpieza_nivel` (WHERE status = 'active')
- `idx_tecnicas_limpieza_nivel_created` (nivel ASC, created_at ASC, WHERE status = 'active')

**Triggers:**
- `trigger_update_tecnicas_limpieza_updated_at` - Actualiza `updated_at` automáticamente

---

## ═══════════════════════════════════════════════════════════
## CONTRATO UI
## ═══════════════════════════════════════════════════════════

### Ruta Admin
`/admin/tecnicas-limpieza`

### Comportamiento Exacto

#### Lista Principal
- **Tabla densa** (NO cards)
- **40-60 filas visibles** simultáneamente
- **Orden canónico:** `level ASC, created_at ASC`
- **Edición inline** de todos los campos
- El nivel se mantiene al crear múltiples técnicas (persistente)

#### Creación Ultra-Rápida
- Input inline en la primera fila de la tabla
- **Enter** = crear (sin modales, sin confirmaciones)
- Nivel persistente hasta cambio manual

#### Acciones por Técnica
- **Editar:** Inline en cada campo
- **Recursos:** Botón 📎 que abre modal de recursos interactivos
- **Eliminar:** Delete físico (con confirmación)

#### Recursos por Técnica
- Bloque visible: **📎 Recursos asociados** [➕ Añadir recurso]
- Modal con:
  - Lista de recursos existentes
  - Crear nuevo recurso
  - Vincular recurso existente
- Usa `interactive_resources` como SOT canónico

### Técnicas de Implementación

**PROHIBIDO:**
- ❌ `innerHTML` dinámico
- ❌ Template literals con datos del usuario
- ❌ `onclick` inline
- ❌ HTML legacy

**OBLIGATORIO:**
- ✅ DOM API (`createElement`, `appendChild`, `textContent`, `value`)
- ✅ Event listeners (`addEventListener`)
- ✅ JS seguro (valores del usuario en `textContent` o `value`)

---

## ═══════════════════════════════════════════════════════════
## RELACIÓN CON RECURSOS INTERACTIVOS
## ═══════════════════════════════════════════════════════════

Las técnicas pueden tener recursos interactivos asociados:
- 🎥 Videos
- 🎵 Audios
- 🖼 Imágenes
- ❓ Quizzes
- 🎮 Experiencias dinámicas
- 🧩 Minijuegos

**Relación:**
```
tecnicas_limpieza (1) ↔ (N) interactive_resources
```

**Referencia en recursos:**
```json
{
  "origin": {
    "sot": "tecnicas-limpieza",
    "entity_id": "123"
  }
}
```

**Al crear recurso desde técnicas:**
1. Se crea `interactive_resource`
2. Se asigna `origin.sot = 'tecnicas-limpieza'`
3. Se asigna `origin.entity_id = tecnica.id`
4. Se prepara path lógico futuro (sin implementar storage físico aún)

---

## ═══════════════════════════════════════════════════════════
## API ADMIN
## ═══════════════════════════════════════════════════════════

### Endpoints

#### Listar Técnicas
```
GET /admin/api/tecnicas-limpieza?onlyActive=true&nivel=5&aplica_energias_indeseables=true
```

#### Obtener Técnica
```
GET /admin/api/tecnicas-limpieza/:id
```

#### Crear Técnica
```
POST /admin/api/tecnicas-limpieza
Content-Type: application/json

{
  "nombre": "Técnica de Respiración",
  "nivel": 3,
  "descripcion": "Descripción opcional",
  "aplica_energias_indeseables": true,
  "aplica_limpiezas_recurrentes": false
}
```

#### Actualizar Técnica
```
PUT /admin/api/tecnicas-limpieza/:id
Content-Type: application/json

{
  "nombre": "Nuevo nombre",
  "nivel": 4
}
```

#### Eliminar Técnica
```
DELETE /admin/api/tecnicas-limpieza/:id
```

**Nota:** Si `?archive=true`, hace soft delete. Si no, delete físico.

---

## ═══════════════════════════════════════════════════════════
## REPOSITORIO Y SERVICIO
## ═══════════════════════════════════════════════════════════

### Repositorio
- **Contrato:** `src/core/repos/tecnicas-limpieza-repo.js`
- **Implementación:** `src/infra/repos/tecnicas-limpieza-repo-pg.js`

### Servicio
- **Ubicación:** `src/services/tecnicas-limpieza-service.js`
- **Responsabilidades:**
  - Validación mínima
  - Normalización
  - Ninguna lógica de UI
  - Preparado para consumo por Packages

### Contrato de Filtros Canónicos

El servicio exporta `FILTER_CONTRACT` que define qué campos son filtrables:

```javascript
export const FILTER_CONTRACT = {
  level: { type: 'number', operators: ['eq', 'lte', 'gte'] },
  nombre: { type: 'string', operators: ['contains', 'startsWith'] },
  aplica_energias_indeseables: { type: 'boolean', operators: ['eq'] },
  aplica_limpiezas_recurrentes: { type: 'boolean', operators: ['eq'] },
  status: { type: 'string', operators: ['eq'], allowed: ['active', 'archived'] },
  has_video: { type: 'boolean', operators: ['eq'], requires_join: true },
  has_audio: { type: 'boolean', operators: ['eq'], requires_join: true },
  has_image: { type: 'boolean', operators: ['eq'], requires_join: true }
};
```

### API de Consumo: listForConsumption()

El servicio expone `listForConsumption(filters, options)` para consumo programático por Packages, Resolvers y Widgets.

**Características:**
- ✅ Valida filtros contra FILTER_CONTRACT
- ✅ Soporta inclusión parcial (`include`)
- ✅ Soporta exclusión (`exclude`)
- ✅ Soporta composición (AND)
- ✅ NO depende de contexto de UI
- ✅ NO muta datos

**Ejemplos:**
```javascript
// Nivel <= 4
const tecnicas = await listForConsumption({ level: { lte: 4 } });

// Nombre empieza con "D"
const tecnicas = await listForConsumption({ nombre: { startsWith: 'D' } });

// Con vídeo asociado
const tecnicas = await listForConsumption({ has_video: { eq: true } });
```

## ═══════════════════════════════════════════════════════════
## RECUPERACIÓN CONTROLADA DEL LEGACY
## ═══════════════════════════════════════════════════════════

### Migración v5.39.0

Se creó la migración `v5.39.0-tecnicas-limpieza-legacy-recovery.sql` que:

1. **NO borra datos:** Todas las técnicas existentes se preservan
2. **Normaliza campos:**
   - `level` nulo → asigna 9
   - `name` vacío → crea placeholder claro con ID
   - `description` nula → cadena vacía
   - `status` indefinido → 'active'
3. **Garantiza que ninguna técnica desaparece:** Todas las técnicas históricas reaparecen

**Política de normalización:**
- ✅ NO borrar registros
- ✅ NO descartar datos
- ✅ NO hacer DELETE físicos
- ✅ Normalización controlada con valores por defecto claros

**Verificación post-migración:**
- El número de técnicas visibles ≥ número histórico
- Ninguna técnica desaparece silenciosamente

---

## ═══════════════════════════════════════════════════════════
## PREPARACIÓN PARA FUTURO
## ═══════════════════════════════════════════════════════════

Este SOT está preparado para:

### Packages
Los Packages pueden consumir técnicas como fuente de datos.

### Resolvers
Los Resolvers pueden resolver técnicas según contexto (nivel del alumno, tipo de limpieza, etc.).

### Widgets
Los Widgets pueden renderizar técnicas en diferentes contextos (UI alumno, admin, etc.).

### Evolución sin Refactor
El esquema está diseñado para evolucionar sin romper contratos existentes.

---

## ═══════════════════════════════════════════════════════════
## CHECKLIST ACS
## ═══════════════════════════════════════════════════════════

Para considerar esta pantalla **completada**:

- ✅ Ruta registrada en `admin-route-registry.js`
- ✅ Handler mapeado en `admin-router-resolver.js`
- ✅ Handler ejecutable
- ✅ `renderAdminPage()` usado
- ✅ HTML no vacío
- ✅ Sidebar presente
- ✅ JS sin errores de sintaxis
- ✅ DOM API usado (NO innerHTML dinámico)
- ✅ Event listeners (NO onclick inline)
- ✅ API funcionando
- ✅ Integración con recursos interactivos funcionando

**Estado esperado:** 🟢 OK

---

## ═══════════════════════════════════════════════════════════
## REGLAS ABSOLUTAS
## ═══════════════════════════════════════════════════════════

1. **PostgreSQL = única autoridad.** NO usar SQLite ni legacy como fallback.
2. **Orden canónico:** `level ASC, created_at ASC`. NO cambiar.
3. **Soft delete:** Usar `status='archived'` para archivar.
4. **Delete físico:** Permitido explícitamente (con confirmación).
5. **DOM API obligatorio:** NO innerHTML dinámico, NO template literals con datos del usuario.
6. **JS seguro:** Valores del usuario SIEMPRE en `textContent` o `value`.
7. **Nivel persistente:** Se mantiene al crear múltiples técnicas hasta cambio manual.

---

---

## ═══════════════════════════════════════════════════════════
## ESTADO DE CERTIFICACIÓN
## ═══════════════════════════════════════════════════════════

**Estado:** 🟢 **CERTIFICADO**

**Fecha de certificación:** 2025-01-XX

### Checklist de Certificación SOT

- ✅ Documento `docs/SOT_tecnicas-limpieza.md` existe
- ✅ Contrato semántico declarado (qué representa y qué NO representa)
- ✅ `FILTER_CONTRACT` exportado en servicio
- ✅ Método `listForConsumption()` implementado
- ✅ UI sin lógica de filtrado (solo consumo del servicio)
- ✅ SOT consumible sin contexto de UI
- ✅ Assembly Check System: 🟢 OK

### Verificación

Para verificar la certificación:
```bash
node scripts/test-sot-certification.js
```

**Resultado esperado:** `✅ SOT CERTIFICADO CORRECTAMENTE`

---

**Este SOT es parte de la constitución de AuriPortal y debe respetarse sin excepciones.**

