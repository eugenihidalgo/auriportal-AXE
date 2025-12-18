# Catálogos PDE v1 - AuriPortal

Sistema de catálogos canónicos para la Plataforma de Desarrollo Espiritual (PDE).

**Versión:** 1.0.0  
**Fecha:** 2025-12-17  
**Estado:** Implementación

---

## 🧘 Principios Arquitectónicos (NO NEGOCIABLES)

### 1. Los catálogos PDE son SOURCE OF TRUTH PEDAGÓGICO
- Definen contenido
- Definen nivel mínimo
- Definen obligatoriedad
- Definen duración, tipo, posición, metadata

### 2. Los recorridos
- NO definen contenido
- SOLO orquestan catálogos
- Consumen bundles resueltos

### 3. El runtime
- Ejecuta
- Valida
- Calcula rachas / progreso
- NO inventa estructura

### 4. Los catálogos
- Son declarativos
- Son deterministas
- Son filtrables por nivel
- Soportan modos (ej: limpieza rápida / básica / profunda / maestro)

### 5. FAIL-OPEN SIEMPRE
- Si un catálogo falla, el recorrido continúa con fallback seguro

---

## 📚 Catálogos Implementados

| Catálogo | catalog_id | Fuente | Estado |
|----------|------------|--------|--------|
| Transmutaciones Energéticas | `energy_transmutations` | JSON | ✅ Publicado |
| Preparaciones para la Práctica | `preparations` | BD | ✅ v1 |
| Técnicas Post-Práctica | `post_practices` | BD | ✅ v1 |
| Protecciones Energéticas | `protections` | BD | ✅ v1 |
| Biblioteca de Decretos | `decrees` | BD | ✅ v1 |
| Lugares Activados | `places` | BD | ✅ v1 |
| Proyectos Activados | `projects` | BD | ✅ v1 |
| Apadrinados | `sponsors` | BD | ✅ v1 |

---

## 📋 Contratos de Catálogo

### 1. Preparaciones para la Práctica (`preparations.catalog.v1`)

**catalog_id:** `preparations`  
**version:** `1.0.0`  
**fuente:** Tabla `preparaciones_practica` (PostgreSQL)  
**admin:** `/admin/preparaciones-practica`

#### Schema de Item

```typescript
interface PreparationItem {
  id: number;                    // PK autoincrement
  nombre: string;                // Nombre visible
  descripcion: string;           // Descripción
  nivel: number;                 // Nivel mínimo requerido (1-10)
  video_url?: string;            // URL de video asociado
  orden: number;                 // Orden de presentación
  activo: boolean;               // Si está activo
  activar_reloj: boolean;        // Si activa el reloj de práctica
  musica_id?: number;            // FK a música asociada
  tipo: 'consigna' | 'practica' | 'decreto' | 'video';
  posicion: 'inicio' | 'medio' | 'fin';
  obligatoria_global: boolean;   // Obligatoria para todos
  obligatoria_por_nivel: Record<number, boolean>; // {1: true, 2: false, ...}
  minutos?: number;              // Duración declarada en minutos
  tiene_video: boolean;          // Si tiene video
  contenido_html?: string;       // Contenido HTML enriquecido
}
```

#### Filtros Permitidos

| Filtro | Tipo | Descripción |
|--------|------|-------------|
| `nivel` | number | Filtra items con `nivel <= studentLevel` |
| `activo` | boolean | Solo items activos |
| `posicion` | enum | Filtra por posición (`inicio`, `medio`, `fin`) |
| `tipo` | enum | Filtra por tipo de preparación |
| `obligatoria_global` | boolean | Solo obligatorias globales |

#### Resolver

```javascript
// src/core/pde/catalogs/preparations-resolver.js
resolvePreparationBundle(studentCtx, {
  mode_id?: string,           // 'rapida' | 'basica' | 'profunda' | 'maestro'
  phase?: 'pre' | 'post',     // Fase de la práctica
  context?: string,           // 'limpieza' | 'general'
  filter_obligatorias?: boolean
})
```

#### Bundle Resultante

```typescript
interface PreparationBundle {
  items: PreparationItem[];
  meta: {
    resolved_at: string;      // ISO timestamp
    student_level: number;
    total_available: number;
    items_selected: number;
    context: string;
  }
}
```

---

### 2. Técnicas Post-Práctica (`post_practices.catalog.v1`)

**catalog_id:** `post_practices`  
**version:** `1.0.0`  
**fuente:** Tabla `tecnicas_post_practica` (PostgreSQL)  
**admin:** `/admin/tecnicas-post-practica`

#### Schema de Item

```typescript
interface PostPracticeItem {
  id: number;
  nombre: string;
  descripcion: string;
  nivel: number;                 // Nivel mínimo requerido
  video_url?: string;
  orden: number;
  activo: boolean;
  activar_reloj: boolean;
  musica_id?: number;
  tipo: 'consigna' | 'practica' | 'decreto' | 'video';
  posicion: 'inicio' | 'medio' | 'fin';
  obligatoria_global: boolean;
  obligatoria_por_nivel: Record<number, boolean>;
  minutos?: number;
  tiene_video: boolean;
  contenido_html?: string;
}
```

#### Filtros Permitidos

Idénticos a Preparaciones.

#### Resolver

```javascript
// src/core/pde/catalogs/post-practices-resolver.js
resolvePostPracticeBundle(studentCtx, {
  mode_id?: string,
  context?: string,
  filter_obligatorias?: boolean
})
```

---

### 3. Protecciones Energéticas (`protections.catalog.v1`)

**catalog_id:** `protections`  
**version:** `1.0.0`  
**fuente:** Tabla `protecciones_energeticas` (PostgreSQL)  
**admin:** `/admin/protecciones-energeticas`

#### Schema de Item

```typescript
interface ProtectionItem {
  id: number;
  key: string;                   // Identificador único (slug)
  name: string;                  // Nombre visible
  description: string;           // Descripción
  usage_context: string;         // Contexto de uso
  recommended_moment: 'pre-practica' | 'durante' | 'post-practica' | 'transversal';
  tags: string[];                // Tags para filtrado
  status: 'active' | 'archived';
}
```

#### Filtros Permitidos

| Filtro | Tipo | Descripción |
|--------|------|-------------|
| `status` | enum | Solo items activos |
| `recommended_moment` | enum | Filtra por momento recomendado |
| `tags` | string[] | Filtra por tags |

#### Resolver

```javascript
// src/core/pde/catalogs/protections-resolver.js
resolveProtectionBundle(studentCtx, {
  moment?: 'pre-practica' | 'durante' | 'post-practica' | 'transversal',
  context?: string,
  tags?: string[]
})
```

#### Bundle Resultante

```typescript
interface ProtectionBundle {
  items: ProtectionItem[];
  meta: {
    resolved_at: string;
    total_available: number;
    items_selected: number;
    moment_filter?: string;
  }
}
```

---

### 4. Biblioteca de Decretos (`decrees.catalog.v1`)

**catalog_id:** `decrees`  
**version:** `1.0.0`  
**fuente:** Tabla `decretos` (PostgreSQL)  
**admin:** `/admin/decretos`

#### Schema de Item

```typescript
interface DecreeItem {
  id: number;
  nombre: string;                // Nombre del decreto
  contenido_html: string;        // Contenido HTML completo
  nivel_minimo: number;          // Nivel mínimo requerido
  posicion?: 'inicio' | 'medio' | 'fin';
  obligatoria_global: boolean;
  obligatoria_por_nivel: Record<number, boolean>;
  orden: number;
  activo: boolean;
}
```

#### Decisión Arquitectónica

> **La Biblioteca de Decretos es el ÚNICO Source of Truth para decretos.**  
> Preparaciones y post-práctica referencian decretos por `decreto_id`.  
> El resolver inyecta `contenido_html` en el bundle.

#### Filtros Permitidos

| Filtro | Tipo | Descripción |
|--------|------|-------------|
| `nivel_minimo` | number | Filtra por nivel del alumno |
| `activo` | boolean | Solo decretos activos |
| `posicion` | enum | Filtra por posición |
| `obligatoria_global` | boolean | Solo obligatorios |

#### Resolver

```javascript
// src/core/pde/catalogs/decrees-resolver.js
resolveDecreeBundle(studentCtx, {
  context?: string,              // 'limpieza' | 'practica_general'
  posicion?: string,
  include_content?: boolean,     // Si incluir contenido_html
  decreto_ids?: number[]         // IDs específicos a resolver
})
```

#### Uso desde Preparaciones/Post-Práctica

Cuando un item de preparación tiene `tipo: 'decreto'`, el handler debe:

1. Obtener el `decreto_id` del item
2. Llamar al resolver de decretos para obtener el contenido
3. Inyectar `contenido_html` en el renderSpec

```javascript
// Ejemplo de uso
if (item.tipo === 'decreto' && item.decreto_id) {
  const decreeBundle = await resolveDecreeBundle(studentCtx, {
    decreto_ids: [item.decreto_id],
    include_content: true
  });
  item.decreto_contenido = decreeBundle.items[0]?.contenido_html;
}
```

---

### 5. Lugares Activados (`places.catalog.v1`)

**catalog_id:** `places`  
**version:** `1.0.0`  
**fuente:** Tabla `transmutaciones_lugares` (PostgreSQL)  
**admin:** `/admin/transmutaciones-lugares`

#### Schema de Item

```typescript
interface PlaceItem {
  id: number;
  nombre: string;                // Nombre del lugar
  descripcion?: string;
  nivel_minimo: number;          // Nivel mínimo requerido
  frecuencia_dias: number;       // Frecuencia de limpieza recomendada
  prioridad: 'Alta' | 'Normal' | 'Baja';
  orden: number;
  activo: boolean;
  alumno_id?: number;            // Si es lugar personal de un alumno
  // Estado (join con transmutaciones_lugares_estado)
  ultima_limpieza?: Date;
  veces_limpiado?: number;
  estado?: 'limpio' | 'pendiente' | 'olvidado';
}
```

#### Filtros Permitidos

| Filtro | Tipo | Descripción |
|--------|------|-------------|
| `nivel_minimo` | number | Filtra por nivel del alumno |
| `activo` | boolean | Solo lugares activos |
| `alumno_id` | number | Lugares globales + personales del alumno |
| `prioridad` | enum | Filtra por prioridad |
| `estado` | enum | Filtra por estado de limpieza |

#### Resolver

```javascript
// src/core/pde/catalogs/places-resolver.js
resolvePlaceBundle(studentCtx, {
  alumno_id?: number,            // Para obtener estado personalizado
  include_global?: boolean,      // Incluir lugares globales
  include_personal?: boolean,    // Incluir lugares personales
  filter_estado?: string,        // 'pendiente' | 'olvidado'
  prioridad?: string
})
```

#### Uso Futuro en Recorridos

```javascript
// En un recorrido futuro
{
  step_id: 'limpieza_lugar',
  handler: 'place_selection_handler',
  props: {
    catalog: 'places',
    filter: {
      estado: 'pendiente',
      prioridad: 'Alta'
    },
    selection_mode: 'single'     // Solo seleccionar un lugar
  }
}
```

---

### 6. Proyectos Activados (`projects.catalog.v1`)

**catalog_id:** `projects`  
**version:** `1.0.0`  
**fuente:** Tabla `transmutaciones_proyectos` (PostgreSQL)  
**admin:** `/admin/transmutaciones-proyectos`

#### Schema de Item

```typescript
interface ProjectItem {
  id: number;
  nombre: string;
  descripcion?: string;
  nivel_minimo: number;
  frecuencia_dias: number;
  prioridad: 'Alta' | 'Normal' | 'Baja';
  orden: number;
  activo: boolean;
  alumno_id?: number;            // Propietario del proyecto
  // Estado (join con transmutaciones_proyectos_estado)
  ultima_limpieza?: Date;
  veces_limpiado?: number;
  estado?: 'limpio' | 'pendiente' | 'olvidado';
}
```

#### Filtros y Resolver

Análogos a Lugares.

---

### 7. Apadrinados (`sponsors.catalog.v1`)

**catalog_id:** `sponsors`  
**version:** `1.0.0`  
**fuente:** Tabla `transmutaciones_apadrinados` (PostgreSQL)  
**admin:** `/admin/apadrinados`

#### Schema de Item

```typescript
interface SponsorItem {
  id: number;
  nombre: string;                // Nombre del apadrinado
  descripcion?: string;
  nivel_minimo: number;
  frecuencia_dias?: number;      // Opcional para apadrinados
  prioridad: 'Alta' | 'Normal' | 'Baja';
  orden: number;
  activo: boolean;
  alumno_id: number;             // Padrino (alumno responsable)
  // Estado (join con transmutaciones_apadrinados_estado)
  ultima_limpieza?: Date;
  veces_limpiado?: number;
  estado?: 'limpio' | 'pendiente' | 'olvidado';
}
```

#### Diferencia Clave

Los **Apadrinados** siempre tienen un `alumno_id` (padrino) asignado.  
Son relaciones energéticas personales, no elementos globales.

#### Resolver

```javascript
// src/core/pde/catalogs/sponsors-resolver.js
resolveSponsorBundle(studentCtx, {
  alumno_id: number,             // Requerido: el padrino
  include_estado?: boolean,      // Incluir estado de limpieza
  filter_estado?: string
})
```

---

## 🔧 Estructura de Archivos

```
src/core/pde/
├── catalogs/
│   ├── preparations-resolver.js    # Resolver de preparaciones
│   ├── post-practices-resolver.js  # Resolver de técnicas post
│   ├── protections-resolver.js     # Resolver de protecciones
│   ├── decrees-resolver.js         # Resolver de decretos
│   ├── places-resolver.js          # Resolver de lugares
│   ├── projects-resolver.js        # Resolver de proyectos
│   ├── sponsors-resolver.js        # Resolver de apadrinados
│   └── index.js                    # Exports centralizados
└── contracts/
    └── catalog-contracts.js        # Tipos y validaciones

config/
└── pde/
    └── catalogs.config.json        # Configuración de catálogos (metadata)
```

---

## 🔗 Integración con Handlers Existentes

### Actualización del `selection-handler.js`

El handler de selección actual (`src/core/recorridos/step-handlers/selection-handler.js`) 
debe ser actualizado para:

1. **Usar resolvers de catálogo** en lugar de datos hardcoded
2. **Mantener compatibilidad** con el contrato actual de `selection_items`
3. **Fail-open** si el resolver falla

```javascript
// ANTES (hardcoded):
const SELECTION_SOURCES = {
  preparacion: {
    getItems: (state, ctx) => getPreparacionItems(tipoLimpieza, nivel)
  }
};

// DESPUÉS (con resolver):
const SELECTION_SOURCES = {
  preparacion: {
    getItems: async (state, ctx) => {
      try {
        const bundle = await resolvePreparationBundle(ctx, {
          mode_id: state.tipo_limpieza,
          phase: 'pre'
        });
        return bundle.items.map(mapToSelectionItem);
      } catch (err) {
        logWarn('Error en resolver, usando fallback');
        return []; // Fail-open
      }
    }
  }
};
```

### Mapeo de Bundle a SelectionItem

```javascript
function mapToSelectionItem(catalogItem) {
  return {
    id: String(catalogItem.id),
    label: catalogItem.nombre || catalogItem.name,
    description: catalogItem.descripcion || catalogItem.description || '',
    duration_minutes: catalogItem.minutos || null,
    default_selected: catalogItem.obligatoria_global || false,
    metadata: {
      tipo: catalogItem.tipo,
      posicion: catalogItem.posicion,
      nivel_minimo: catalogItem.nivel || catalogItem.nivel_minimo
    }
  };
}
```

---

## 📊 Diagrama de Flujo

```
┌─────────────────────────────────────────────────────────────────┐
│                        CATÁLOGOS PDE                            │
│  (Source of Truth Pedagógico)                                   │
├─────────────────────────────────────────────────────────────────┤
│ preparations │ post_practices │ protections │ decrees │ ...    │
└──────┬───────┴───────┬────────┴──────┬──────┴────┬────┴────────┘
       │               │               │           │
       ▼               ▼               ▼           ▼
┌─────────────────────────────────────────────────────────────────┐
│                        RESOLVERS                                │
│  (Deterministas, filtrables por nivel)                         │
├─────────────────────────────────────────────────────────────────┤
│ resolvePreparationBundle() │ resolveProtectionBundle() │ ...   │
└──────┬───────────────────┬─┴────────────────────────────────────┘
       │                   │
       ▼                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                        BUNDLES                                  │
│  (Planos, listos para renderizar)                              │
├─────────────────────────────────────────────────────────────────┤
│ { items: [...], meta: {...} }                                   │
└──────┬──────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│                        HANDLERS                                 │
│  (selection_handler, practice_timer_handler, etc.)             │
├─────────────────────────────────────────────────────────────────┤
│ enhanceRenderSpec() → renderSpec.props.selection_items         │
└──────┬──────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│                        RUNTIME                                  │
│  (Ejecuta, valida, calcula rachas)                             │
├─────────────────────────────────────────────────────────────────┤
│ recorrido-runtime.js                                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🧪 Tests

### Tests Básicos de Resolvers

```javascript
// tests/pde/catalogs/preparations-resolver.test.js
describe('PreparationsResolver', () => {
  it('should filter by student level', async () => {
    const ctx = { nivelInfo: { nivel: 2 } };
    const bundle = await resolvePreparationBundle(ctx, {});
    
    expect(bundle.items.every(i => i.nivel <= 2)).toBe(true);
  });
  
  it('should return empty bundle on error (fail-open)', async () => {
    // Simular error de BD
    const bundle = await resolvePreparationBundle(null, {});
    
    expect(bundle.items).toEqual([]);
    expect(bundle.meta.reason).toBe('error');
  });
});
```

---

## ✅ Checklist de Verificación

### Seguridad (CRÍTICO)

- [ ] No se crean tablas nuevas
- [ ] No se rompen UIs admin existentes
- [ ] No se rompe publish de recorridos
- [ ] No se rompe navegación
- [ ] PM2 estable después de cambios
- [ ] Feature flags si procede

### Funcionalidad

- [ ] Resolvers devuelven bundles válidos
- [ ] Filtrado por nivel funciona
- [ ] Fail-open activo en todos los resolvers
- [ ] Handlers integrados con resolvers
- [ ] Tests básicos pasan

### Documentación

- [ ] PDE_CATALOGS_V1.md completo
- [ ] Contratos documentados
- [ ] Ejemplos de uso incluidos

---

## 🔮 Evolución Futura (v2)

### Funcionalidades Planificadas

- [ ] Editor visual de catálogos (Studio)
- [ ] Versionado de catálogos con historial
- [ ] A/B testing de contenido pedagógico
- [ ] Analytics de uso por catálogo
- [ ] Estrategia `random` con seed para determinismo
- [ ] Sincronización bidireccional con ClickUp/Drive

### Migración a BD (si aplica)

Para catálogos actualmente en JSON (como `transmutations.catalog.v1.json`):

1. Crear tablas con migraciones
2. Importar JSON a tablas
3. Crear loader alternativo para BD
4. Feature flag para switch (v1 JSON vs v2 BD)
5. UI admin para edición

---

## 🧘 Mantra Final

> "Los catálogos definen el QUÉ.  
> Los recorridos definen el CUÁNDO.  
> El runtime decide el SI.  
> La navegación muestra el DÓNDE."

**No improvises. No refactorices UIs. No mezcles capas. Formaliza lo que ya funciona.**

---

**Autor:** Sistema  
**Última actualización:** 2025-12-17



