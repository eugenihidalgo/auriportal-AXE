# DEFINICIÓN FASE 2.2
## Escrituras Canónicas del Estado del Alumno

**Versión**: 1.0.0  
**Fecha**: 2025-01-XX  
**Estado**: ACEPTADA  
**Base Legal**: `CERTIFICACION_SOURCE_OF_TRUTH_FASE1.md`  
**Precedente**: `VERIFICACION_FASE2.1_FINAL.md` (Fase 2.1 certificada)  
**Lista para**: Implementación de Fase 2.2

---

## 1. OBJETIVO EXACTO DE LA FASE

**Certificar operativamente que todas las mutaciones del estado del alumno:**
1. Se realizan exclusivamente en PostgreSQL como Source of Truth
2. Pasan por un punto canónico de escritura (servicio/repositorio)
3. Tienen auditoría mínima obligatoria (quién/cuándo/qué)
4. Están preparadas para emitir señales (sin implementar señales aún)
5. No escriben en ClickUp, SQLite o Kajabi como autoridad
6. Son atómicas y consistentes (transacciones cuando aplica)

**Alcance exclusivo**: Mutaciones del estado del alumno en PostgreSQL.  
**No incluye**: Señales, automatizaciones, UI nueva, migración de endpoints legacy.

---

## 2. MUTACIONES DEL ALUMNO EN ALCANCE

### 2.1 Mutaciones de Estado Operativo

#### 2.1.1 Nivel del Alumno
- **Función existente**: `student-v4.js → updateStudentNivel(email, nivel)`
- **Tabla**: `alumnos.nivel_actual` o `alumnos.nivel_manual`
- **Origen de mutación**:
  - Cálculo automático (motor de progreso)
  - Override manual del Master
- **Requisitos**:
  - Debe pasar por servicio canónico
  - Auditoría: nivel anterior → nivel nuevo
  - Preparación para señal: `student.level_changed`

#### 2.1.2 Racha (Streak)
- **Función existente**: `student-v4.js → updateStudentStreak(email, streak, client)`
- **Tabla**: `alumnos.streak`
- **Origen de mutación**:
  - Registro de práctica diaria
  - Cálculo desde tabla `practicas`
  - Corrección manual
- **Requisitos**:
  - Debe pasar por servicio canónico
  - Auditoría: streak anterior → streak nuevo
  - Preparación para señal: `student.streak_changed`
  - **Nota**: La racha se calcula desde `practicas`, pero el campo `alumnos.streak` puede actualizarse como caché derivado

#### 2.1.3 Fecha de Última Práctica
- **Función existente**: `student-v4.js → updateStudentUltimaPractica(email, fecha, client)`
- **Tabla**: `alumnos.fecha_ultima_practica`
- **Origen de mutación**:
  - Registro de práctica diaria
  - Sincronización desde tabla `practicas`
- **Requisitos**:
  - Debe pasar por servicio canónico
  - Auditoría: fecha anterior → fecha nueva
  - Preparación para señal: `student.last_practice_updated`

#### 2.1.4 Estado de Suscripción
- **Función existente**: `student-v4.js → updateStudentEstadoSuscripcion(email, estado, fechaReactivacion, client)`
- **Tabla**: `alumnos.estado_suscripcion`
- **Origen de mutación**:
  - Cambio manual desde Admin
  - Automatización registrada (futuro)
- **Requisitos**:
  - Debe pasar por servicio canónico
  - Auditoría: estado anterior → estado nuevo
  - Preparación para señal: `student.subscription_status_changed`
  - **Crítico**: Nunca desde Kajabi en runtime

### 2.2 Mutaciones de Identidad

#### 2.2.1 Apodo
- **Función existente**: `student-v4.js → updateStudentApodo(identifier, nuevoApodo, client)`
- **Tabla**: `alumnos.apodo`
- **Origen de mutación**:
  - Cambio manual desde Admin
  - Actualización desde Typeform/webhook
- **Requisitos**:
  - Debe pasar por servicio canónico
  - Auditoría: apodo anterior → apodo nuevo
  - Preparación para señal: `student.apodo_changed`
  - **Ya implementado**: Tiene auditoría completa

### 2.3 Mutaciones de Creación

#### 2.3.1 Creación de Alumno
- **Función existente**: `student-v4.js → createStudent(env, { email, apodo, nombreKajabi })`
- **Tabla**: `alumnos` (INSERT)
- **Origen de mutación**:
  - Webhook de Typeform (onboarding)
  - Creación manual desde Admin
- **Requisitos**:
  - Debe pasar por servicio canónico
  - Auditoría: evento de creación
  - Preparación para señal: `student.created`
  - **Crítico**: No crear en ClickUp como autoridad

#### 2.3.2 Registro de Práctica
- **Función existente**: `student-v4.js → createStudentPractice(alumnoId, fecha, tipo, origen, duracion, client)`
- **Tabla**: `practicas` (INSERT)
- **Origen de mutación**:
  - Usuario practica (botón "Sí, hoy practico")
  - Completar limpieza energética
  - Otras acciones que registran práctica
- **Requisitos**:
  - Debe pasar por servicio canónico
  - Auditoría: práctica registrada
  - Preparación para señal: `student.practice_registered`
  - **Nota**: Esta mutación puede disparar actualización de `alumnos.streak` y `alumnos.fecha_ultima_practica`

---

## 3. MUTACIONES EXPLÍCITAMENTE FUERA DEL ALCANCE

### 3.1 Mutaciones de Reglas de Progresión
- **Fuera de alcance**: Modificación de umbrales de niveles, milestones, categorías
- **Razón**: Estas son reglas del sistema, no estado del alumno
- **Certificación futura**: Fase posterior (reglas como SOT)

### 3.2 Mutaciones de Catálogos PDE
- **Fuera de alcance**: Creación/modificación de catálogos PDE
- **Razón**: Son entidades de catálogo, no estado del alumno
- **Certificación futura**: Ya certificado en Fase 1

### 3.3 Mutaciones de Señales
- **Fuera de alcance**: Emisión de señales por cambios de estado
- **Razón**: Las señales son consecuencia, no mutación del alumno
- **Certificación futura**: Fase posterior (señales y automatizaciones)

### 3.4 Mutaciones de Automatizaciones
- **Fuera de alcance**: Creación/modificación de automatizaciones
- **Razón**: Son reglas del sistema, no estado del alumno
- **Certificación futura**: Fase posterior

### 3.5 Sincronización con ClickUp
- **Fuera de alcance**: Escribir en ClickUp como mirror
- **Razón**: ClickUp es mirror, no autoridad. La sincronización es operativa, no parte del SOT
- **Nota**: Puede existir sincronización unidireccional PostgreSQL → ClickUp, pero no es parte de la mutación canónica

### 3.6 Mutaciones de Datos Derivados
- **Fuera de alcance**: Cálculo de días activos, energía emocional, etc.
- **Razón**: Son cálculos derivados, no mutaciones directas del estado
- **Nota**: Estos se calculan en lectura, no se mutan directamente

### 3.7 Mutaciones de Overrides del Master
- **Fuera de alcance**: Sistema de overrides (nivel manual, etc.)
- **Razón**: Los overrides son parte del estado, pero su gestión completa requiere UI Admin
- **Nota**: La mutación del override en sí está en alcance (ej: `updateStudentNivel`), pero la UI de gestión queda fuera

---

## 4. CONTRATOS OBLIGATORIOS ANTES DE ESCRIBIR CÓDIGO

### 4.1 Contrato de Servicio de Escritura

**Debe existir un servicio canónico que:**
1. Encapsule todas las mutaciones del estado del alumno
2. Valide entrada antes de escribir
3. Ejecute auditoría mínima obligatoria
4. Prepare punto de emisión de señal (sin implementar)
5. Maneje transacciones cuando aplica
6. Retorne resultado normalizado

**ACLARACIÓN ARQUITECTÓNICA CRÍTICA:**

El servicio canónico de mutación **NO es un motor de negocio**. Es un **coordinador de escritura**.

**El servicio NO debe:**
- ❌ Contener lógica de negocio compleja
- ❌ Recalcular reglas de progresión (niveles, milestones)
- ❌ Decidir políticas del sistema (cuándo actualizar, qué valores usar)
- ❌ Implementar algoritmos de negocio
- ❌ ❌ Convertirse en un "motor encubierto"

**El servicio SÍ debe:**
- ✅ Coordinar la escritura (orquestar validación, auditoría, señal)
- ✅ Validar entrada (tipos, rangos, existencia)
- ✅ Registrar auditoría (quién, cuándo, qué)
- ✅ Preparar punto de señal (placeholder estructurado)
- ✅ Manejar transacciones (atomicidad, consistencia)

**Responsabilidades separadas:**
- **Motores de negocio** (ej: `progress-engine.js`, `streak-engine.js`): Calculan qué valor debe escribirse
- **Servicio de mutación**: Escribe el valor calculado de forma canónica, auditable y preparada para señales

**Ejemplo de flujo correcto:**
```
1. Motor de progreso calcula: nivel debe ser 5
2. Servicio de mutación escribe: nivel = 5 (con auditoría y señal)
3. NO: Servicio calcula Y escribe (viola separación)
```

**Ubicación propuesta**: `src/core/services/student-mutation-service.js` (o similar)

**Estructura mínima**:
```javascript
// Pseudocódigo - NO IMPLEMENTAR AÚN
export class StudentMutationService {
  async updateNivel(email, nivel, actor) {
    // 1. Validar entrada (nivel entre 1-15, email válido)
    // 2. Leer estado anterior (desde PostgreSQL)
    // 3. Escribir en PostgreSQL (transacción)
    // 4. Registrar auditoría (evento estructurado)
    // 5. Preparar punto de señal (placeholder)
    // 6. Retornar resultado normalizado
    // NOTA: NO calcula el nivel, solo lo escribe
  }
  
  // Similar para otras mutaciones
}
```

### 4.2 Contrato de Auditoría

**Debe existir un contrato de auditoría que:**
1. Registre quién hizo el cambio (actor)
2. Registre cuándo se hizo (timestamp)
3. Registre qué cambió (estado anterior → estado nuevo)
4. Sea consultable desde Admin
5. Tenga formato estructurado

**Ubicación**: Ya existe `src/infra/repos/audit-repo-pg.js`

**Requisitos**:
- Todas las mutaciones deben registrar evento de auditoría
- Formato: `{ eventType, actorType, actorId, severity, data: { anterior, nuevo } }`
- Eventos mínimos requeridos:
  - `STUDENT_LEVEL_UPDATED`
  - `STUDENT_STREAK_UPDATED`
  - `STUDENT_LAST_PRACTICE_UPDATED`
  - `STUDENT_SUBSCRIPTION_STATUS_UPDATED`
  - `STUDENT_APODO_UPDATED`
  - `STUDENT_CREATED`
  - `STUDENT_PRACTICE_REGISTERED`

### 4.3 Contrato de Preparación para Señales

**Debe existir un punto canónico donde:**
1. Se pueda emitir señal en el futuro (sin implementar aún)
2. Tenga formato estructurado
3. Esté documentado qué señales se emitirán
4. Sea consultable desde Admin (futuro)

**Ubicación propuesta**: `src/core/services/student-mutation-service.js` (método `_prepareSignal()`)

**Estructura mínima**:
```javascript
// Pseudocódigo - NO IMPLEMENTAR AÚN
_prepareSignal(mutationType, student, oldState, newState) {
  // Placeholder para emisión futura de señal
  // Retorna objeto estructurado con:
  // - signalType: 'student.level_changed'
  // - payload: { student_id, old_value, new_value, timestamp }
  // - metadata: { actor, reason }
}
```

### 4.4 Contrato de Validación

**Debe existir validación obligatoria antes de escribir:**
1. Validar que el alumno existe
2. Validar que el nuevo estado es válido (ej: nivel entre 1-15)
3. Validar que el actor tiene permisos
4. Validar que no hay conflictos (ej: transacciones concurrentes)

**Ubicación**: Dentro del servicio de mutación

### 4.5 Contrato de Transacciones

**Debe existir manejo de transacciones cuando:**
1. Múltiples campos se actualizan juntos (ej: práctica → streak + fecha)
2. Se requiere atomicidad (todo o nada)
3. Se requiere consistencia (no estados intermedios)

**Ubicación**: Usar `client` de PostgreSQL para transacciones

**Ejemplo**: Registro de práctica debe actualizar:
- `practicas` (INSERT)
- `alumnos.streak` (UPDATE)
- `alumnos.fecha_ultima_practica` (UPDATE)
- Todo en una transacción

---

## 5. CRITERIOS DE CERTIFICACIÓN

### Criterio 1: Todas las mutaciones pasan por servicio canónico ✅

**Verificación**:
- ✅ No hay escrituras directas a PostgreSQL desde handlers
- ✅ No hay escrituras en ClickUp/SQLite como autoridad
- ✅ Todas las mutaciones usan el servicio canónico
- ✅ El servicio canónico está documentado

**Resultado esperado**: ✅ CUMPLIDO

---

### Criterio 2: Auditoría mínima obligatoria ✅

**Verificación**:
- ✅ Todas las mutaciones registran evento de auditoría
- ✅ Auditoría incluye: quién, cuándo, qué (anterior → nuevo)
- ✅ Auditoría es consultable desde Admin (futuro)
- ✅ Formato de auditoría es estructurado y consistente

**Resultado esperado**: ✅ CUMPLIDO

---

### Criterio 3: Preparación para señales ✅

**Verificación**:
- ✅ Todas las mutaciones tienen punto de emisión de señal (placeholder)
- ✅ Formato de señal está documentado
- ✅ Señales están registradas en contrato (futuro)
- ✅ No se emiten señales aún (solo preparación)

**Resultado esperado**: ✅ CUMPLIDO

---

### Criterio 4: Validación obligatoria ✅

**Verificación**:
- ✅ Todas las mutaciones validan entrada
- ✅ Validación de existencia del alumno
- ✅ Validación de valores válidos (rangos, tipos)
- ✅ Validación de permisos del actor

**Resultado esperado**: ✅ CUMPLIDO

---

### Criterio 5: Transacciones cuando aplica ✅

**Verificación**:
- ✅ Mutaciones que afectan múltiples campos usan transacciones
- ✅ Atomicidad garantizada (todo o nada)
- ✅ Consistencia garantizada (no estados intermedios)
- ✅ Manejo de errores en transacciones

**Resultado esperado**: ✅ CUMPLIDO

---

### Criterio 6: Sin escrituras en fuentes externas como autoridad ✅

**Verificación**:
- ✅ No se escribe en ClickUp como autoridad
- ✅ No se escribe en SQLite
- ✅ No se escribe en Kajabi
- ✅ Solo PostgreSQL es autoridad

**Resultado esperado**: ✅ CUMPLIDO

---

### Criterio 7: Funciones existentes refactorizadas ✅

**Verificación**:
- ✅ `updateStudentNivel()` pasa por servicio canónico
- ✅ `updateStudentStreak()` pasa por servicio canónico
- ✅ `updateStudentUltimaPractica()` pasa por servicio canónico
- ✅ `updateStudentEstadoSuscripcion()` pasa por servicio canónico
- ✅ `updateStudentApodo()` pasa por servicio canónico (ya tiene auditoría)
- ✅ `createStudent()` pasa por servicio canónico
- ✅ `createStudentPractice()` pasa por servicio canónico

**Resultado esperado**: ✅ CUMPLIDO

---

## 6. ORDEN DE IMPLEMENTACIÓN PROPUESTO

### Paso 1: Definir Contrato de Servicio
- Crear estructura del servicio canónico
- Definir interfaces de mutación
- Documentar contratos

### Paso 2: Implementar Servicio Canónico
- Crear `student-mutation-service.js`
- Implementar métodos de mutación
- Integrar auditoría
- Preparar puntos de señal

### Paso 3: Refactorizar Funciones Existentes
- Hacer que `student-v4.js` use el servicio canónico
- Mantener API pública compatible
- Añadir auditoría donde falte

### Paso 4: Verificar Criterios
- Ejecutar verificación de cada criterio
- Documentar cumplimiento
- Identificar violaciones

### Paso 5: Certificar Fase 2.2
- Generar documento de certificación
- Listar criterios cumplidos
- Declarar alcance respetado

---

## 7. PROHIBICIONES ABSOLUTAS

1. **NO crear señales nuevas** - Solo preparación
2. **NO modificar UI Admin** - Solo backend
3. **NO migrar endpoints legacy** - Solo refactorizar funciones existentes
4. **NO escribir en ClickUp como autoridad** - Solo PostgreSQL
5. **NO escribir en SQLite** - Prohibido
6. **NO escribir en Kajabi** - Prohibido
7. **NO añadir features nuevas** - Solo certificar escrituras existentes
8. **NO tocar reglas de progresión** - Fuera de alcance

---

## 8. DOCUMENTOS DE REFERENCIA

- `CERTIFICACION_SOURCE_OF_TRUTH_FASE1.md` - Base legal
- `VERIFICACION_FASE2.1_FINAL.md` - Precedente (lecturas certificadas)
- `src/modules/student-v4.js` - Funciones existentes a refactorizar
- `src/infra/repos/audit-repo-pg.js` - Repositorio de auditoría
- `src/infra/repos/student-repo-pg.js` - Repositorio de alumnos

---

## 9. CONCLUSIÓN

**Fase 2.2 certifica que todas las escrituras del estado del alumno:**
- Son canónicas (pasan por servicio único)
- Son auditables (registran quién/cuándo/qué)
- Están preparadas para señales (sin implementar)
- Son atómicas (transacciones cuando aplica)
- Solo escriben en PostgreSQL (no en fuentes externas)

**Alcance**: Mutaciones del estado del alumno en PostgreSQL.  
**Fuera de alcance**: Señales, automatizaciones, UI, migración de endpoints legacy.

---

## 10. ESTADO Y APROBACIÓN

**Estado del documento**: ✅ ACEPTADA  
**Fecha de aceptación**: 2025-01-XX  
**Lista para**: Implementación de Fase 2.2

**Aprobación formal**:
- Estructura: ✅ Aceptada
- Alcance: ✅ Aceptado
- Prohibiciones: ✅ Aceptadas
- Contratos: ✅ Aceptados
- Criterios: ✅ Aceptados
- Aclaración arquitectónica: ✅ Aceptada (servicio NO es motor)

**Próximo paso**: Implementación de Fase 2.2 según esta definición.

---

**FIN DE DEFINICIÓN**

Este documento es la base vinculante para la implementación de la Fase 2.2.  
El servicio canónico de mutación es un coordinador de escritura, NO un motor de negocio.

