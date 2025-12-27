# CONTRATO CANÓNICO DE CREACIÓN DE ENTIDADES VIVAS
## AuriPortal - Fase 2.2 Certificada

**Versión**: 1.0  
**Fecha de Certificación**: 2025-01-XX  
**Estado**: ✅ IMPLEMENTADO Y CERTIFICADO  
**Alcance**: Creación de entidades vivas en AuriPortal

---

## 1. PROPÓSITO DEL CONTRATO

Este contrato define, de forma explícita y no negociable, cómo funciona la creación de "entidades vivas" en AuriPortal.

### Qué Protege

- **Integridad del Source of Truth**: Garantiza que toda entidad viva se crea en PostgreSQL como única autoridad.
- **Trazabilidad**: Asegura que toda creación es auditable y rastreable.
- **Consistencia**: Impide creación ad-hoc que rompa la arquitectura del sistema.
- **Extensibilidad Controlada**: Permite añadir nuevas entidades vivas sin violar principios constitucionales.

### Por Qué Existe

Antes de este contrato, la creación de entidades podía ocurrir en múltiples puntos del sistema, generando:
- Duplicación de lógica
- Falta de auditoría
- Imposibilidad de rastrear cambios
- Violación del principio de Source of Truth único

Este contrato elimina estas violaciones mediante un punto canónico obligatorio.

### Qué Problemas Evita

- Creación directa desde endpoints sin pasar por servicio canónico
- Creación sin auditoría
- Creación sin preparación de señales
- Creación que no respeta transacciones
- Creación que toca sistemas externos como autoridad
- Creación que calcula o decide en lugar de solo registrar

---

## 2. DEFINICIÓN DE ENTIDAD VIVA

### Entidad Viva

Una **Entidad Viva** es una entidad que introduce un **HECHO** en el sistema vivo del alumno.

Un hecho es un evento que:
- Modifica el estado del alumno o su contexto
- Puede disparar consecuencias (automatizaciones, señales, comunicaciones)
- Debe ser rastreable y auditable
- Forma parte del historial del alumno

### Diferencia con Entidad de Configuración

**Entidad Viva**:
- Representa un hecho que ocurrió
- Se crea en runtime
- Afecta al estado del alumno
- Es auditable y señalizable
- Ejemplos: Alumno, Práctica, Sesión, Evento de Progreso

**Entidad de Configuración**:
- Representa reglas o parámetros del sistema
- Se gestiona desde Admin
- No representa hechos del alumno
- Ejemplos: Catálogos PDE, Reglas de Progresión, Señales Registradas

### Qué Implica Crear una Entidad Viva

Crear una entidad viva implica:
1. Registrar un hecho en PostgreSQL (Source of Truth)
2. Generar evento de auditoría
3. Preparar señal estructurada (sin emitir)
4. Respetar transacciones si aplican
5. NO calcular, NO decidir, NO ejecutar consecuencias

---

## 3. PRINCIPIOS CONSTITUCIONALES

### Principio 1: Crear ≠ Actualizar

**Declaración**: La creación de una entidad viva es una operación distinta de la actualización.

**Implicaciones**:
- Crear introduce una nueva entidad en el sistema
- Actualizar modifica una entidad existente
- No se puede "crear actualizando" (upsert no es creación canónica)
- Cada operación tiene su punto canónico específico

### Principio 2: Crear ≠ Ejecutar Consecuencias

**Declaración**: La creación de una entidad viva NO ejecuta consecuencias automáticamente.

**Implicaciones**:
- Crear solo registra el hecho
- Las consecuencias (automatizaciones, señales, comunicaciones) se ejecutan después
- La creación no debe depender de que las consecuencias se ejecuten
- Las consecuencias son responsabilidad de otra capa del sistema

### Principio 3: Crear NO Calcula

**Declaración**: El servicio canónico de creación NO calcula valores, solo escribe valores ya calculados.

**Implicaciones**:
- Los valores a crear deben venir ya determinados desde la lógica de negocio
- El servicio canónico es un coordinador, no un motor
- Cálculos pertenecen a motores de negocio (progress-engine, streak-engine, etc.)

### Principio 4: Crear NO Decide

**Declaración**: El servicio canónico de creación NO decide políticas del sistema, solo escribe decisiones ya tomadas.

**Implicaciones**:
- La decisión de crear debe hacerse antes de llamar al servicio canónico
- El servicio no valida si "debería" crearse, solo valida que puede crearse
- Decisiones pertenecen a la lógica de negocio o Admin

### Principio 5: Crear NO Dispara Automatizaciones

**Declaración**: La creación de una entidad viva NO dispara automatizaciones directamente.

**Implicaciones**:
- Las automatizaciones se disparan desde señales, no desde creación
- La creación solo prepara la señal, no la emite
- Emisión de señales y automatizaciones pertenecen a otra fase del sistema

### Principio 6: Crear SOLO Registra un Hecho

**Declaración**: La creación de una entidad viva tiene una única responsabilidad: registrar el hecho en PostgreSQL.

**Implicaciones**:
- Toda otra responsabilidad (auditoría, señales, logs) es coordinación, no creación
- La creación es atómica: o se registra el hecho completo o no se registra nada
- No hay creación parcial

### Principio 7: PostgreSQL es la Única Autoridad

**Declaración**: PostgreSQL es el ÚNICO Source of Truth para entidades vivas. Ningún sistema externo participa como autoridad.

**Implicaciones**:
- No se crea en ClickUp como autoridad
- No se crea en SQLite como autoridad
- No se crea en Kajabi como autoridad
- Sistemos externos solo pueden ser Mirror o Cache, nunca autoridad

### Principio 8: Toda Creación es Auditable

**Declaración**: Toda creación de entidad viva DEBE generar un evento de auditoría.

**Implicaciones**:
- El evento de auditoría es obligatorio
- La auditoría es fail-open (no bloquea la creación si falla)
- La auditoría incluye: actor, entidad, datos de creación, timestamp

### Principio 9: Toda Creación Prepara Señal

**Declaración**: Toda creación de entidad viva DEBE preparar una señal estructurada.

**Implicaciones**:
- La señal se prepara pero NO se emite en la creación
- La señal está disponible para emisión posterior
- El formato de la señal es estructurado y versionado

### Principio 10: Toda Creación Puede Participar en Transacción

**Declaración**: Toda creación de entidad viva DEBE poder participar en una transacción atómica.

**Implicaciones**:
- El servicio canónico acepta parámetro `client` para transacciones
- Si se proporciona `client`, todas las operaciones usan la misma transacción
- Si no se proporciona, se usa pool por defecto

### Principio 11: Ninguna Creación Toca Sistemas Externos

**Declaración**: La creación de entidades vivas NO debe escribir en sistemas externos como autoridad.

**Implicaciones**:
- No se escribe en ClickUp como autoridad
- No se escribe en SQLite como autoridad
- No se escribe en Kajabi como autoridad
- Sistemos externos pueden sincronizarse después, pero no son autoridad

---

## 4. PUNTO CANÓNICO DE CREACIÓN

### Servicio Canónico Obligatorio

**Declaración**: TODA creación de entidad viva DEBE pasar por un servicio canónico.

**Estado Actual**: `StudentMutationService` en `src/core/services/student-mutation-service.js`

**Métodos Canónicos Actuales**:
- `createStudent()` - Crea un nuevo alumno
- `createStudentPractice()` - Crea una nueva práctica

### Prohibición Explícita

**Está PROHIBIDO**:
- Crear entidades vivas directamente desde endpoints
- Crear entidades vivas directamente desde módulos de negocio
- Crear entidades vivas directamente desde repositorios
- Crear entidades vivas fuera del servicio canónico

**Excepción**: Ninguna. El servicio canónico es el único punto válido de creación.

### Responsabilidades del Servicio Canónico

El servicio canónico de creación:
1. Valida parámetros mínimos (tipos, rangos, formatos)
2. Valida que la entidad NO existe (para evitar duplicados)
3. Escribe en PostgreSQL (Source of Truth)
4. Registra auditoría (fail-open)
5. Prepara señal estructurada (sin emitir)
6. Genera log estructurado
7. Retorna entidad creada normalizada

**NO hace**:
- Cálculos de negocio
- Decisiones de política
- Ejecución de consecuencias
- Escritura en sistemas externos

---

## 5. SEPARACIÓN CREACIÓN VS CONSECUENCIAS

### Crear Registra el Hecho

La creación de una entidad viva tiene una única responsabilidad: registrar el hecho en PostgreSQL.

**Ejemplo**: Crear una Práctica registra que el alumno practicó en una fecha específica.

### Consecuencias se Ejecutan Después

Las consecuencias de crear una entidad viva se ejecutan **después** de la creación, explícitamente.

**Ejemplos de Consecuencias**:
- Actualizar streak del alumno
- Actualizar fecha de última práctica
- Calcular nuevo nivel
- Disparar automatizaciones
- Enviar comunicaciones
- Actualizar analíticas

### Las Consecuencias NO Forman Parte del Contrato de Creación

**Declaración**: El contrato de creación NO incluye la ejecución de consecuencias.

**Implicaciones**:
- La creación puede ejecutarse sin consecuencias
- Las consecuencias pueden ejecutarse en otra transacción
- Las consecuencias pueden ejecutarse asíncronamente
- Las consecuencias son responsabilidad de otra capa del sistema

**Ejemplo Práctico**:
- `createStudentPractice()` crea la práctica
- Después, explícitamente, se llama a `updateStreak()` y `updateUltimaPractica()`
- Todo puede estar en la misma transacción, pero son operaciones separadas

---

## 6. AUDITORÍA OBLIGATORIA

### Evento de Auditoría Requerido

**Declaración**: Toda creación de entidad viva DEBE generar un evento de auditoría.

**Formato del Evento**:
- `eventType`: Tipo de evento (ej: `STUDENT_CREATED`, `STUDENT_PRACTICE_REGISTERED`)
- `actorType`: Tipo de actor (`system`, `admin`, `user`)
- `actorId`: ID del actor (o `null` si no está disponible)
- `severity`: Severidad del evento (`info`, `warning`, `error`)
- `data`: Objeto con datos de la creación (entidad, valores, timestamps)

### Auditoría Fail-Open

**Declaración**: Si la auditoría falla, NO debe bloquear la creación.

**Implicaciones**:
- La creación se considera exitosa aunque la auditoría falle
- El error de auditoría se registra en log de advertencia
- La auditoría es importante pero no crítica para la creación

### Auditoría Mínima Requerida

**Campos Obligatorios**:
- `actor`: Quién creó la entidad
- `entidad`: Qué entidad se creó
- `datos`: Datos mínimos de la creación (identificadores, valores clave)

**Campos Opcionales**:
- `metadata`: Información adicional relevante
- `context`: Contexto de la creación

---

## 7. PREPARACIÓN DE SEÑALES

### Señal Estructurada Requerida

**Declaración**: Toda creación de entidad viva DEBE preparar una señal estructurada.

**Formato de la Señal**:
- `signalType`: Tipo de señal (ej: `student.created`, `student.practice_registered`)
- `payload`: Datos de la señal (entidad, valores, timestamps)
- `metadata`: Metadatos de la señal (preparación, fase, versión)

### La Señal NO se Emite en la Creación

**Declaración**: La señal se prepara pero NO se emite durante la creación.

**Implicaciones**:
- La señal está disponible para emisión posterior
- La emisión pertenece a otra fase del sistema
- La preparación garantiza que la señal puede emitirse cuando corresponda

### Emisión Pertenece a Otra Fase

**Declaración**: La emisión de señales y la ejecución de automatizaciones pertenecen a otra fase del sistema.

**Implicaciones**:
- La creación no debe depender de la emisión de señales
- Las señales pueden emitirse asíncronamente
- Las automatizaciones se disparan desde señales, no desde creación

---

## 8. TRANSACCIONES

### Participación en Transacciones

**Declaración**: Toda creación de entidad viva DEBE poder participar en una transacción atómica.

**Implementación**:
- El servicio canónico acepta parámetro `client` (opcional)
- Si se proporciona `client`, todas las operaciones usan la misma transacción
- Si no se proporciona, se usa pool por defecto

### Transacciones Atómicas

**Declaración**: Cuando múltiples operaciones deben ejecutarse juntas, deben estar en la misma transacción.

**Ejemplo**:
- Crear práctica + actualizar streak + actualizar fecha última práctica
- Todo debe estar en la misma transacción para garantizar atomicidad

### Respeto del Contexto Transaccional

**Declaración**: El contrato obliga a aceptar y respetar el contexto transaccional proporcionado.

**Implicaciones**:
- Si se proporciona `client`, todas las operaciones (creación, auditoría) usan ese `client`
- No se puede ignorar el contexto transaccional
- El servicio canónico no inicia transacciones, solo participa en ellas

---

## 9. ENTIDADES ACTUALES BAJO ESTE CONTRATO

### Alumno

**Método Canónico**: `StudentMutationService.createStudent()`

**Cumplimiento del Contrato**:
- ✅ Crea en PostgreSQL como única autoridad
- ✅ Valida que el alumno NO existe (evita duplicados)
- ✅ Registra auditoría (`STUDENT_CREATED`)
- ✅ Prepara señal (`student.created`)
- ✅ Genera log estructurado
- ✅ Acepta transacciones mediante `client`
- ✅ NO calcula valores (recibe valores ya determinados)
- ✅ NO decide políticas (la decisión se hace antes)
- ✅ NO ejecuta consecuencias (se ejecutan después)

**Valores por Defecto**:
- `nivel_actual`: 1
- `streak`: 0
- `estado_suscripcion`: 'activa'
- `fecha_inscripcion`: fecha actual

### Práctica

**Método Canónico**: `StudentMutationService.createStudentPractice()`

**Cumplimiento del Contrato**:
- ✅ Crea en PostgreSQL como única autoridad
- ✅ Valida que el alumno existe
- ✅ Registra auditoría (`STUDENT_PRACTICE_REGISTERED`)
- ✅ Prepara señal (`student.practice_registered`)
- ✅ Genera log estructurado
- ✅ Acepta transacciones mediante `client`
- ✅ NO calcula valores (recibe valores ya determinados)
- ✅ NO decide políticas (la decisión se hace antes)
- ✅ NO ejecuta consecuencias (se ejecutan después)

**Nota Importante**: Esta mutación SOLO crea la práctica. NO actualiza `streak` ni `fecha_ultima_practica`. Esas actualizaciones deben hacerse por separado usando `updateStreak()` y `updateUltimaPractica()`, todo en la misma transacción si es necesario.

---

## 10. EXTENSIBILIDAD FUTURA

### Cómo Añadir Nuevas Entidades Vivas

**Proceso Obligatorio**:
1. Definir la entidad viva y su propósito
2. Implementar método en el servicio canónico siguiendo el patrón existente
3. Asegurar cumplimiento de todos los principios constitucionales
4. Documentar en este contrato
5. Verificar que no viola reglas no negociables

### Reglas para Extender el Contrato

**Permitido**:
- Añadir nuevos métodos al servicio canónico
- Añadir nuevos tipos de entidades vivas
- Extender el formato de auditoría (manteniendo campos obligatorios)
- Extender el formato de señales (manteniendo estructura base)

**Prohibido**:
- Crear puntos canónicos alternativos
- Violar principios constitucionales
- Añadir excepciones ad-hoc
- Crear entidades vivas fuera del servicio canónico

### Prohibición de Excepciones Ad-Hoc

**Declaración**: No se permiten excepciones al contrato para casos específicos.

**Implicaciones**:
- Todas las entidades vivas siguen el mismo contrato
- No hay "casos especiales" que justifiquen violar el contrato
- Si una entidad no puede cumplir el contrato, el diseño debe revisarse

### Ejemplos de Entidades Futuras (NO Implementadas)

**Solo para Documentación**:
- **Sesión**: Registro de una sesión de práctica estructurada
- **Evento de Progreso**: Milestone o logro alcanzado
- **Override Manual del Master**: Cambio manual autorizado por Master
- **Pausa / Reactivación**: Estado de pausa de suscripción
- **Logro / Achievement**: Reconocimiento por hitos alcanzados
- **Estado de Recorrido**: Progreso en un recorrido específico
- **Resultado de Automatización**: Resultado de una automatización ejecutada
- **Interacción Significativa Validada**: Interacción que afecta el estado del alumno

**Nota**: Estas entidades NO están implementadas. Se documentan solo como ejemplos de cómo se extendería el contrato.

---

## 11. REGLAS NO NEGOCIABLES

### Prohibiciones Absolutas

1. **Está PROHIBIDO crear entidades vivas directamente desde endpoints**
   - Toda creación debe pasar por el servicio canónico
   - Los endpoints solo coordinan, no crean

2. **Está PROHIBIDO crear entidades vivas directamente desde módulos de negocio**
   - Los motores de negocio calculan, no crean
   - La creación pertenece al servicio canónico

3. **Está PROHIBIDO crear entidades vivas directamente desde repositorios**
   - Los repositorios son infraestructura, no lógica de dominio
   - La creación debe pasar por el servicio canónico

4. **Está PROHIBIDO crear entidades vivas sin auditoría**
   - Toda creación debe generar evento de auditoría
   - La auditoría es obligatoria, no opcional

5. **Está PROHIBIDO crear entidades vivas sin preparar señal**
   - Toda creación debe preparar señal estructurada
   - La señal es obligatoria, no opcional

6. **Está PROHIBIDO crear entidades vivas que calculen valores**
   - Los valores deben venir ya calculados
   - El servicio canónico no calcula, solo escribe

7. **Está PROHIBIDO crear entidades vivas que decidan políticas**
   - Las decisiones deben hacerse antes de crear
   - El servicio canónico no decide, solo escribe

8. **Está PROHIBIDO crear entidades vivas que ejecuten consecuencias**
   - Las consecuencias se ejecutan después, explícitamente
   - La creación no ejecuta consecuencias

9. **Está PROHIBIDO crear entidades vivas en sistemas externos como autoridad**
   - PostgreSQL es la única autoridad
   - Sistemas externos no participan como autoridad en creación

10. **Está PROHIBIDO crear entidades vivas sin soporte de transacciones**
    - Toda creación debe aceptar contexto transaccional
    - Las transacciones son obligatorias cuando aplican

11. **Está PROHIBIDO crear entidades vivas que bloqueen si falla auditoría**
    - La auditoría es fail-open
    - La creación no debe depender de la auditoría

12. **Está PROHIBIDO crear entidades vivas que emitan señales durante la creación**
    - Las señales se preparan, no se emiten
    - La emisión pertenece a otra fase

---

## 12. ESTADO DEL SISTEMA

### Declaración de Certificación

**Este contrato YA está implementado y certificado para**:
- ✅ Alumno (`createStudent()`)
- ✅ Práctica (`createStudentPractice()`)

### El Documento Certifica, No Promete

**Declaración**: Este documento NO es una promesa de implementación futura. Es una certificación de lo que YA existe.

**Implicaciones**:
- El contrato está activo y operativo
- Las entidades actuales cumplen el contrato
- Futuras entidades deben cumplir el contrato
- No hay "plan de implementación", solo certificación de estado actual

### Verificación de Cumplimiento

**Para verificar que una entidad viva cumple el contrato**:
1. ¿Pasa por el servicio canónico?
2. ¿Crea en PostgreSQL como única autoridad?
3. ¿Registra auditoría?
4. ¿Prepara señal?
5. ¿Acepta transacciones?
6. ¿NO calcula, NO decide, NO ejecuta consecuencias?

**Si todas las respuestas son afirmativas, la entidad cumple el contrato.**

---

## CONCLUSIÓN

Este contrato define el estándar obligatorio para la creación de entidades vivas en AuriPortal.

**Estado**: ✅ IMPLEMENTADO Y CERTIFICADO

**Alcance**: Alumno y Práctica

**Extensibilidad**: Futuras entidades vivas deben cumplir este contrato sin excepciones.

**Vigencia**: Este contrato es constitucional y no negociable. Cualquier violación es una regresión arquitectónica.

---

**FIN DEL CONTRATO**





