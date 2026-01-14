# HISTORIAL DE LIMPIEZAS V1 — Sistema Canónico

**Versión:** 1.0  
**Dominio:** MASTER  
**Estado:** Documentación Canónica (Source of Truth del Diseño)  
**Fecha:** 2025-01-12

---

## 1. IDENTIDAD DEL SISTEMA

### ¿Qué es el Sistema de Historial de Limpiezas?

El Sistema de Historial de Limpiezas es la **memoria narrativa pedagógica** de AuriPortal. No es un log técnico ni un reporte operativo: es una construcción narrativa que transforma acciones de limpieza en historias pedagógicas con sentido.

### Dominio

- **Dominio:** MASTER
- **Rol:** Memoria narrativa pedagógica del sistema
- **Propósito:** Convertir acciones técnicas en narrativas pedagógicas

### Diferencia entre Acción, Historial e Informe

1. **Acción (Action)**
   - Evento técnico inmediato
   - Registrado en `cleaning_events`
   - Append-only, inmutable
   - Ejemplo: "mark_clean ejecutado el 2025-01-12 10:30:00"

2. **Historial (History)**
   - Construcción narrativa pedagógica
   - Generado desde señales y acciones
   - Almacenado en `history_entries`
   - Ejemplo: "Hoy has limpiado tu canal perceptivo por primera vez este mes"

3. **Informe (Report)**
   - Proyección agregada del historial
   - Construido desde `history_entries` y `cleaning_events`
   - Generado bajo demanda
   - Ejemplo: "En los últimos 30 días has trabajado 15 items diferentes"

**Regla Constitucional:** El historial NO es el informe. El historial es la fuente de verdad narrativa; el informe es una proyección agregada.

---

## 2. PRINCIPIOS CONSTITUCIONALES

### PostgreSQL como Único Source of Truth

- **PostgreSQL** es el ÚNICO Source of Truth del historial
- Está prohibido:
  - Leer historial desde ClickUp o Kajabi
  - Usar SQLite/legacy como fallback
  - Generar historial en runtime sin persistir

### Backend como Única Autoridad

- El **backend** es la ÚNICA autoridad de generación de historial
- Está prohibido:
  - Calcular historial en frontend
  - Inferir narrativas desde datos raw
  - Generar historial sin pasar por servicios canónicos

### Frontend No Infiere Ni Decide

- El frontend **NO** puede:
  - Calcular narrativas desde eventos
  - Inferir historial desde `cleaning_events`
  - Decidir qué es "historial" vs "acción"
- El frontend **SOLO** puede:
  - Consumir historial desde APIs
  - Renderizar historial recibido
  - Solicitar informes agregados

### Regla: Acción → Señal → Historial → Proyección

El flujo canónico es:

```
Acción Real (cleaning_events)
    ↓
Señal Emitida (student.cleaning.*)
    ↓
Listener de Historial (history-listener)
    ↓
Servicio de Generación (history-generation-service)
    ↓
Persistencia SOT (history_entries)
    ↓
Agregación (history_aggregation_runs)
    ↓
Proyección (informes)
```

**Regla Constitucional:** No se puede saltar fases. Toda acción debe pasar por señal antes de generar historial.

### Arquitectura UUID-Only

- El historial funciona **EXCLUSIVAMENTE** con `student_uuid` (UUID)
- Está prohibido:
  - Usar `legacy_alumno_id` en runtime
  - Acceder a tabla `alumnos` como Source of Truth
  - Crear servicios que resuelvan IDs legacy
- Si se intenta usar legacy → error explícito: "LEGACY alumno_id is forbidden. MASTER Historial is UUID-only."

### Append-Only

- `history_entries` es **append-only**
- Está prohibido:
  - Modificar o eliminar entradas históricas
  - Recalcular historial desde cero sin usar eventos
  - Saltarse el event log para actualizar historial
- **Regla:** Todo cambio de historial genera nueva entrada (nunca modifica existente)

### Historial ≠ Envío

- El historial **NO** es comunicación
- El historial es **memoria narrativa**
- Los envíos (emails, mensajes) son **consecuencia** del historial, no el historial mismo
- **Regla:** Historial se genera siempre; envíos son opcionales y gobernados por automatizaciones

---

## 3. HISTORIAL COMO SOURCE OF TRUTH

### ¿Qué Significa que el Historial Sea SOT?

El historial es Source of Truth de la **verdad narrativa pedagógica**. Esto significa:

- El historial es la **única autoridad** sobre qué ha pasado desde una perspectiva pedagógica
- El historial **no se recalcula** desde eventos (se genera una vez y persiste)
- El historial es **inmutable** (append-only, nunca se modifica)
- El historial es **completo** (no se omite información relevante)

### ¿Qué NO es SOT?

El historial **NO** es Source of Truth de:

- **Progreso técnico:** El progreso se calcula desde `cleaning_item_state` y `cleaning_events`
- **Estado energético:** El estado se calcula desde proyecciones y modelos
- **Acciones operativas:** Las acciones se registran en `cleaning_events`

**Regla:** El historial es SOT de la **narrativa**, no de la **operación**.

### Diferencia entre Verdad Operativa y Verdad Narrativa

1. **Verdad Operativa**
   - "El estudiante X limpió el item Y el día Z"
   - Fuente: `cleaning_events`
   - Propósito: Operación, auditoría, cálculo de estados

2. **Verdad Narrativa**
   - "El estudiante X ha trabajado consistentemente en limpieza energética durante el último mes"
   - Fuente: `history_entries`
   - Propósito: Pedagogía, comunicación, sentido

**Regla:** Ambas verdades coexisten. La verdad operativa alimenta la verdad narrativa, pero no la reemplaza.

---

## 4. TIPOS DE HISTORIAL

### ACTION_HISTORY (Inmediato)

**Tipo:** `action_history`  
**Generación:** Inmediata (al emitirse señal)  
**Propósito:** Registrar acción específica con contexto mínimo

**Ejemplo:**
```json
{
  "type": "action_history",
  "scope": "person",
  "scope_ref": "student_uuid",
  "title": "Limpieza realizada",
  "content": {
    "blocks": [
      {
        "type": "action",
        "text": "Has limpiado 'Canal Perceptivo'"
      }
    ]
  },
  "triggered_by": "signal:student.cleaning.item.marked",
  "created_at": "2025-01-12T10:30:00Z"
}
```

### NARRATIVE_HISTORY (Agregado)

**Tipo:** `narrative_history`  
**Generación:** Por ventana temporal (diaria, semanal, mensual)  
**Propósito:** Construir narrativa pedagógica agregada

**Ejemplo:**
```json
{
  "type": "narrative_history",
  "scope": "person",
  "scope_ref": "student_uuid",
  "window": "daily",
  "window_start": "2025-01-12T00:00:00Z",
  "window_end": "2025-01-12T23:59:59Z",
  "title": "Resumen del día",
  "content": {
    "blocks": [
      {
        "type": "context",
        "text": "Hoy has trabajado en 3 áreas diferentes de limpieza energética"
      },
      {
        "type": "actions",
        "items": [
          "Canal Perceptivo (primera vez este mes)",
          "Abundancia (día 5 consecutivo)",
          "Salud Física (hito: 10 limpiezas totales)"
        ]
      },
      {
        "type": "reading",
        "text": "Tu consistencia en Abundancia muestra un patrón estable de trabajo"
      }
    ]
  },
  "triggered_by": "aggregation:daily:2025-01-12",
  "created_at": "2025-01-13T00:05:00Z"
}
```

### SILENCE_HISTORY (Periodos Sin Intervención)

**Tipo:** `silence_history`  
**Generación:** Cuando detecta periodos sin acciones  
**Propósito:** Registrar ausencia como información válida

**Ejemplo:**
```json
{
  "type": "silence_history",
  "scope": "person",
  "scope_ref": "student_uuid",
  "window": "weekly",
  "window_start": "2025-01-05T00:00:00Z",
  "window_end": "2025-01-11T23:59:59Z",
  "title": "Semana sin actividad",
  "content": {
    "blocks": [
      {
        "type": "context",
        "text": "Esta semana no se registraron limpiezas"
      },
      {
        "type": "reading",
        "text": "Los periodos de pausa son parte natural del proceso. Cuando estés listo, retoma tu práctica."
      }
    ]
  },
  "triggered_by": "aggregation:weekly:2025-01-05",
  "created_at": "2025-01-12T00:05:00Z"
}
```

**Regla:** `SILENCE_HISTORY` solo se genera si hay contexto previo (no se genera para estudiantes nuevos sin actividad).

---

## 5. ALCANCES (SCOPES)

### Persona (student)

**Scope:** `person`  
**Scope Ref:** `student_uuid`  
**Propósito:** Historial individual del estudiante

**Ejemplo:**
```json
{
  "scope": "person",
  "scope_ref": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Tu progreso en limpieza energética"
}
```

### Grupo (group)

**Scope:** `group`  
**Scope Ref:** `group_id` o `group_key`  
**Propósito:** Historial agregado de un grupo de estudiantes

**Ejemplo:**
```json
{
  "scope": "group",
  "scope_ref": "nivel-3-sanacion",
  "title": "Progreso del grupo Nivel 3 - Sanación"
}
```

**Nota:** Los grupos pueden ser:
- Por nivel (nivel-1, nivel-2, etc.)
- Por fase (fase-inicial, fase-intermedia, etc.)
- Por clasificación (category: "abundancia", etc.)
- Por universo (templo-luz, systema, etc.)

### Plataforma (global)

**Scope:** `platform`  
**Scope Ref:** `null` o `"global"`  
**Propósito:** Historial agregado de toda la plataforma

**Ejemplo:**
```json
{
  "scope": "platform",
  "scope_ref": "global",
  "title": "Actividad global de limpieza energética"
}
```

### Una Acción Puede Generar Múltiples Historiales

**Regla Constitucional:** Una sola acción puede generar múltiples entradas de historial con narrativas distintas según el scope.

**Ejemplo:**
- Acción: "Estudiante X limpia item Y"
- Historial generado:
  1. `person` scope: "Has limpiado item Y"
  2. `group` scope (si aplica): "Un estudiante del grupo ha completado item Y"
  3. `platform` scope: "Nueva limpieza registrada en la plataforma"

**Regla:** Cada scope tiene su propia narrativa, pero todas se generan desde la misma acción.

---

## 6. VOZ NARRATIVA

### Autor: Master (Eugeni)

- El historial se escribe en **primera persona** desde la perspectiva del Master
- El Master es **Eugeni** (no el sistema, no una automatización)
- **Regla:** El historial debe sonar como si Eugeni estuviera escribiendo directamente al estudiante

### Lenguaje Pedagógico

- El historial usa lenguaje **pedagógico**, no técnico
- Evita jerga técnica (no "mark_clean ejecutado", sino "has limpiado")
- Usa lenguaje **cercano** y **comprensivo**
- **Regla:** El historial debe ser comprensible para alguien sin conocimiento técnico

### No Voz Institucional

- Está prohibido:
  - "El sistema ha registrado..."
  - "Se ha completado la acción..."
  - "Tu cuenta muestra..."
- **Regla:** El historial es personal, no institucional

### No Voz Automática

- Está prohibido:
  - "Tu progreso automático es..."
  - "La automatización ha detectado..."
  - "El algoritmo ha calculado..."
- **Regla:** El historial es humano, no automático

---

## 7. CONTENIDO NARRATIVO

### Uso de Bloques Estructurados (JSON)

El contenido del historial se estructura en **bloques JSON**, no en texto plano.

**Estructura:**
```json
{
  "content": {
    "blocks": [
      {
        "type": "título",
        "text": "..."
      },
      {
        "type": "contexto",
        "text": "..."
      },
      {
        "type": "acciones",
        "items": ["...", "..."]
      },
      {
        "type": "lectura",
        "text": "..."
      },
      {
        "type": "cierre",
        "text": "..."
      }
    ]
  }
}
```

### Tipos de Bloque

#### 1. Título (title)

**Tipo:** `title`  
**Propósito:** Encabezado principal del historial

**Ejemplo:**
```json
{
  "type": "title",
  "text": "Resumen del día"
}
```

#### 2. Contexto (context)

**Tipo:** `context`  
**Propósito:** Establecer el contexto temporal o situacional

**Ejemplo:**
```json
{
  "type": "context",
  "text": "Hoy has trabajado en 3 áreas diferentes de limpieza energética"
}
```

#### 3. Acciones (actions)

**Tipo:** `actions`  
**Propósito:** Lista de acciones realizadas

**Ejemplo:**
```json
{
  "type": "actions",
  "items": [
    "Canal Perceptivo (primera vez este mes)",
    "Abundancia (día 5 consecutivo)",
    "Salud Física (hito: 10 limpiezas totales)"
  ]
}
```

#### 4. Lectura (reading)

**Tipo:** `reading`  
**Propósito:** Interpretación pedagógica de las acciones

**Ejemplo:**
```json
{
  "type": "reading",
  "text": "Tu consistencia en Abundancia muestra un patrón estable de trabajo. Esto indica que estás integrando la práctica de forma natural."
}
```

#### 5. Cierre (closure)

**Tipo:** `closure`  
**Propósito:** Cierre pedagógico del historial

**Ejemplo:**
```json
{
  "type": "closure",
  "text": "Sigue así. Cada limpieza te acerca más a tu objetivo."
}
```

### Prohibido Texto Plano No Estructurado

- Está prohibido:
  - Texto plano sin bloques
  - HTML en el contenido
  - Markdown sin estructura
- **Regla:** Todo contenido debe estar estructurado en bloques JSON

---

## 8. CONSCIENCIA TEMPORAL

### Repetición

El historial es **consciente de la repetición**:

- Primera vez: "Has limpiado X por primera vez"
- Repetición: "Has limpiado X (día 5 consecutivo)"
- Hitos: "Has alcanzado 10 limpiezas de X"

**Regla:** El historial debe reflejar patrones temporales (consecutivos, totales, frecuencia).

### Hitos (Primera Vez, Cierre de Ciclo)

El historial detecta y registra **hitos**:

- **Primera vez:** "Esta es la primera vez que limpias X"
- **Cierre de ciclo:** "Has completado el ciclo de limpieza de X"
- **Múltiplos:** "Has alcanzado 25 limpiezas de X (hito: 25)"

**Regla:** Los hitos deben ser explícitos en el historial.

### Intensidad

El historial es **consciente de la intensidad**:

- **Baja intensidad:** "Has trabajado en 1 área hoy"
- **Media intensidad:** "Has trabajado en 3 áreas diferentes"
- **Alta intensidad:** "Has trabajado en 5 áreas diferentes (día muy activo)"

**Regla:** El historial debe reflejar la intensidad de la actividad.

### Silencio como Información Válida

El historial **registra el silencio** como información válida:

- "Esta semana no se registraron limpiezas"
- "Han pasado 7 días desde tu última limpieza"
- "Los periodos de pausa son parte natural del proceso"

**Regla:** El silencio no es ausencia de información; es información válida que debe registrarse.

---

## 9. MODELO TEMPORAL

### Generación Asíncrona desde Señales

El historial se genera **asíncronamente** desde señales:

1. Acción real → `cleaning_events`
2. Señal emitida → `student.cleaning.*`
3. Listener de historial → captura señal
4. Servicio de generación → construye narrativa
5. Persistencia → `history_entries`

**Regla:** El historial NO se genera síncronamente con la acción. Se genera después, de forma asíncrona.

### Modelo Híbrido

El historial usa un **modelo híbrido**:

1. **Registro Inmediato (Action)**
   - `ACTION_HISTORY` se genera inmediatamente al emitirse señal
   - Se registra en `history_entries` con `type='action_history'`
   - Propósito: Capturar acción específica con contexto mínimo

2. **Consolidación por Ventana (Narrative)**
   - `NARRATIVE_HISTORY` se genera por ventana temporal
   - Se ejecuta en `history_aggregation_runs`
   - Propósito: Construir narrativa pedagógica agregada

**Regla:** Ambas capas coexisten. La acción inmediata alimenta la narrativa agregada.

### Ventanas: Diaria, Semanal, Mensual, Anual

Las ventanas de agregación son:

- **Diaria:** `window='daily'`, `window_start` y `window_end` del día
- **Semanal:** `window='weekly'`, `window_start` y `window_end` de la semana
- **Mensual:** `window='monthly'`, `window_start` y `window_end` del mes
- **Anual:** `window='yearly'`, `window_start` y `window_end` del año

**Regla:** Cada ventana genera su propia entrada de `NARRATIVE_HISTORY`.

---

## 10. FLUJO COMPLETO DEL SISTEMA

### 1. Acción Real

- Usuario ejecuta acción de limpieza
- Cleaning Engine registra en `cleaning_events`
- Cleaning Engine actualiza `cleaning_item_state`

### 2. Emisión de Señal

- Cleaning Engine emite señal: `student.cleaning.item.marked`
- Señal incluye: `student_uuid`, `item_ref`, `clean_layer`, `execution_key`, `trace_id`

### 3. Listener de Historial

- `history-listener` captura señal
- Valida que la señal sea relevante para historial
- Encola tarea de generación de historial

### 4. Servicio de Generación

- `history-generation-service` procesa señal
- Construye narrativa pedagógica
- Genera bloques estructurados (título, contexto, acciones, lectura, cierre)
- Determina scope (person, group, platform)

### 5. Persistencia SOT

- Servicio persiste en `history_entries`
- Registra `type`, `scope`, `scope_ref`, `content`, `triggered_by`, `created_at`
- **Regla:** Append-only, nunca modifica entradas existentes

### 6. Agregación

- `history-aggregation-service` ejecuta agregaciones por ventana
- Genera `NARRATIVE_HISTORY` desde `ACTION_HISTORY`
- Registra en `history_aggregation_runs`
- Persiste nuevas entradas en `history_entries`

### 7. Proyección

- Informes se construyen desde `history_entries`
- Agregan por scope, ventana, tipo
- Generan proyecciones bajo demanda

**Regla:** Todo el flujo es asíncrono. La acción real no espera la generación de historial.

---

## 11. MODELO DE DATOS (DESCRIPTIVO)

### history_entries

**Propósito:** Almacenar entradas de historial (Source of Truth)

**Campos principales:**
- `id` (UUID, PK)
- `type` (`action_history` | `narrative_history` | `silence_history`)
- `scope` (`person` | `group` | `platform`)
- `scope_ref` (UUID o string según scope)
- `window` (`daily` | `weekly` | `monthly` | `yearly` | `null`)
- `window_start` (timestamp, nullable)
- `window_end` (timestamp, nullable)
- `title` (string)
- `content` (JSONB, bloques estructurados)
- `triggered_by` (string, señal o agregación que lo generó)
- `created_at` (timestamp)
- `trace_id` (UUID, para auditoría)

**Invariantes:**
- Append-only (nunca se modifica ni elimina)
- `type` debe ser válido
- `scope` debe ser válido
- `content` debe ser JSON válido con bloques estructurados

### history_aggregation_runs

**Propósito:** Registrar ejecuciones de agregación

**Campos principales:**
- `id` (UUID, PK)
- `window` (`daily` | `weekly` | `monthly` | `yearly`)
- `window_start` (timestamp)
- `window_end` (timestamp)
- `scope` (`person` | `group` | `platform`)
- `scope_ref` (UUID o string según scope)
- `status` (`pending` | `running` | `completed` | `failed`)
- `entries_generated` (integer)
- `started_at` (timestamp)
- `completed_at` (timestamp, nullable)
- `error_message` (text, nullable)
- `trace_id` (UUID)

**Invariantes:**
- Una ejecución por ventana/scope/scope_ref (idempotencia)
- `status` debe ser válido
- `entries_generated` >= 0

### history_entry_links

**Propósito:** Vincular entradas de historial con acciones/eventos

**Campos principales:**
- `id` (UUID, PK)
- `history_entry_id` (UUID, FK a `history_entries`)
- `source_type` (`cleaning_event` | `signal` | `aggregation`)
- `source_ref` (UUID o string, referencia al origen)
- `created_at` (timestamp)

**Invariantes:**
- Una entrada de historial puede tener múltiples links
- `source_type` debe ser válido
- `source_ref` debe existir en la fuente correspondiente

**Propósito:** Permitir trazabilidad desde historial hasta acciones/eventos originales.

---

## 12. INFORMES

### Diferencia entre Historial e Informe

- **Historial:** Memoria narrativa pedagógica (Source of Truth)
- **Informe:** Proyección agregada del historial (construido bajo demanda)

**Regla:** El informe NO es Source of Truth. El historial sí lo es.

### Informes por Alumno

**Endpoint:** `GET /master/api/alquimia-alumno/report?student_uuid=...&days=30`

**Propósito:** Construir informe agregado del historial de un alumno

**Estructura:**
- `technical_panel`: Datos técnicos (eventos, execution_keys, etc.)
- `human_panel`: Narrativa pedagógica (agrupada por lista, clasificación, etc.)

**Regla:** El informe se construye desde `history_entries` y `cleaning_events`, no se calcula desde cero.

### Informes por Grupo

**Endpoint:** `GET /master/api/alquimia-grupo/report?group_key=...&days=30`

**Propósito:** Construir informe agregado del historial de un grupo

**Estructura:**
- Agregación de historiales de estudiantes del grupo
- Narrativa colectiva del progreso del grupo

**Regla:** El informe de grupo se construye desde `history_entries` con `scope='group'`.

### Informes por Plataforma

**Endpoint:** `GET /master/api/alquimia-plataforma/report?days=30`

**Propósito:** Construir informe agregado del historial de toda la plataforma

**Estructura:**
- Agregación de historiales globales
- Narrativa del estado general de la plataforma

**Regla:** El informe de plataforma se construye desde `history_entries` con `scope='platform'`.

### Uso Actual: Copy / Paste

**Estado Actual:** Los informes se generan para **copy/paste manual**.

- El Master (Eugeni) accede a los informes
- Copia el contenido
- Lo pega en comunicación (email, mensaje, etc.)

**Regla:** Los informes NO se envían automáticamente todavía.

### Uso Futuro: Envío Automático (Modo GOD)

**Estado Futuro:** Los informes se enviarán automáticamente en modo GOD.

- Automatizaciones consumen informes
- Generan comunicaciones (emails, mensajes)
- Envían automáticamente según reglas

**Regla:** El envío automático es futuro, no existe todavía.

---

## 13. UI (FUERA DEL NÚCLEO)

### Módulo MASTER

- La UI de historial está en el dominio **MASTER**
- **Ruta:** `/master/comunicaciones/informes-limpiezas`
- **Handler:** `master-informes-limpiezas-handler.js`

### Sidebar → Comunicaciones → Informes de Limpiezas

**Navegación:**
```
MASTER
  └─ Comunicaciones
      └─ Informes de Limpiezas
```

**Regla:** La UI está en MASTER, no en ADMIN (legacy).

### UI Solo Lectura

- La UI es **solo lectura**
- Está prohibido:
  - Editar historial
  - Eliminar historial
  - Modificar narrativas
- **Regla:** El historial es inmutable. La UI solo muestra.

### No Edición

- No existe funcionalidad de edición
- No existe funcionalidad de corrección
- No existe funcionalidad de reversión

**Regla:** Si el historial está mal, se corrige en el servicio de generación, no en la UI.

### No Envío Todavía

- La UI NO envía informes automáticamente
- La UI solo muestra informes para copy/paste
- El envío automático es futuro (modo GOD)

**Regla:** La UI es solo visualización. El envío es responsabilidad de automatizaciones (futuro).

---

## 14. COSAS QUE NO EXISTEN (IMPORTANTE)

### Envíos

- **NO existe** envío automático de informes
- **NO existe** sistema de emails desde historial
- **NO existe** integración con servicios de comunicación

**Regla:** Los envíos son futuros, no existen todavía.

### Preferencias de Comunicación

- **NO existe** sistema de preferencias de comunicación
- **NO existe** configuración de frecuencia de envío
- **NO existe** opt-in/opt-out de comunicaciones

**Regla:** Las preferencias son futuras, no existen todavía.

### Timeline Interactivo

- **NO existe** timeline interactivo del historial
- **NO existe** visualización temporal avanzada
- **NO existe** filtros complejos en UI

**Regla:** La UI es simple: lista de entradas de historial, sin interactividad avanzada.

### Reversión Histórica

- **NO existe** capacidad de revertir historial
- **NO existe** capacidad de corregir narrativas históricas
- **NO existe** capacidad de eliminar entradas

**Regla:** El historial es append-only e inmutable. Si hay error, se corrige en el servicio, no se revierte.

---

## 15. PREPARACIÓN PARA FUTURO (GOD)

### Separación Núcleo / Proyección

El sistema está diseñado con **separación clara** entre:

1. **Núcleo (Core)**
   - Generación de historial
   - Persistencia en `history_entries`
   - Agregaciones

2. **Proyección (Projection)**
   - Construcción de informes
   - Envíos automáticos
   - Comunicaciones

**Regla:** El núcleo es estable. La proyección puede evolucionar sin afectar el núcleo.

### Capacidad de Envío Automático Futuro

El sistema está **preparado** para envío automático futuro:

- Los informes se construyen de forma determinista
- Las automatizaciones pueden consumir informes
- El formato de informes es estable

**Regla:** El sistema puede activar envíos automáticos sin cambiar el núcleo.

### Reviews Mensuales y Anuales

El sistema está **preparado** para reviews mensuales y anuales:

- Agregaciones por ventana mensual/anual
- Narrativas de largo plazo
- Hitos anuales

**Regla:** Las ventanas mensuales y anuales están definidas, pero la generación es futura.

---

## REFERENCIAS

### Documentación Relacionada

- `docs/ALQUIMIA_CANONICA_V1.md` - Sistema de Alquimia (limpiezas)
- `docs/CLEANING_ENGINE_CANONICAL_MODEL_V1.md` - Motor de Limpieza
- `docs/CONTRATO_LIMPIEZA_V1.md` - Contrato de Limpieza
- `docs/MASTER_ALQUIMIA_ALUMNO_CONTRACTS_V2.md` - Contratos de Alquimia Alumno
- `docs/CONTRATO_CANONICO_SENALES.md` - Sistema de Señales

### Código Relacionado

- `src/core/master/services/alquimia-report-service.js` - Servicio de Reportes
- `src/core/master/services/alquimia-history-resolver-service.js` - Resolución de Historial
- `src/core/master/services/cleaning-engine-service.js` - Motor de Limpieza
- `src/infra/repos/cleaning/cleaning-events-repo-pg.js` - Repositorio de Eventos
- `src/infra/repos/cleaning/cleaning-item-state-repo-pg.js` - Repositorio de Estado

### Tablas de Base de Datos

- `cleaning_events` - Event log de limpiezas (append-only)
- `cleaning_item_state` - Proyección materializada de estado
- `history_entries` - Entradas de historial (futuro, append-only)
- `history_aggregation_runs` - Ejecuciones de agregación (futuro)
- `history_entry_links` - Vínculos historial-acciones (futuro)

---

## VERSIONADO

**Versión Actual:** 1.0  
**Última Actualización:** 2025-01-12  
**Próxima Revisión:** Cuando se implemente el sistema de historial

**Regla:** Este documento es Source of Truth del diseño. Cualquier cambio en el diseño debe reflejarse en este documento.

---

**FIN DEL DOCUMENTO**
