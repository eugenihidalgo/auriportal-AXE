# CONTRATO CANÓNICO DE MUTACIÓN DE ENTIDADES VIVAS
## AuriPortal - Fase 2.2 Certificada

**Versión**: 1.0  
**Fecha de Certificación**: 2025-01-XX  
**Estado**: ✅ IMPLEMENTADO Y CERTIFICADO  
**Alcance**: Mutación de entidades vivas en AuriPortal

---

## 1. PROPÓSITO DEL CONTRATO

Este contrato define, de forma explícita y no negociable, cómo funciona la mutación de "entidades vivas" en AuriPortal.

### Qué Protege

- **Integridad del Source of Truth**: Garantiza que toda mutación de entidad viva se realiza en PostgreSQL como única autoridad.
- **Trazabilidad**: Asegura que toda mutación es auditable y rastreable.
- **Consistencia**: Impide mutación ad-hoc que rompa la arquitectura del sistema.
- **Extensibilidad Controlada**: Permite añadir nuevas mutaciones sin violar principios constitucionales.

### Por Qué Existe

Antes de este contrato, la mutación de entidades podía ocurrir en múltiples puntos del sistema, generando:
- Duplicación de lógica
- Falta de auditoría
- Imposibilidad de rastrear cambios
- Violación del principio de Source of Truth único
- Mutaciones que calculan o deciden en lugar de solo escribir

Este contrato elimina estas violaciones mediante un punto canónico obligatorio.

### Qué Problemas Evita

- Mutación directa desde endpoints sin pasar por servicio canónico
- Mutación sin auditoría
- Mutación sin preparación de señales
- Mutación que no respeta transacciones
- Mutación que toca sistemas externos como autoridad
- Mutación que calcula o decide en lugar de solo escribir
- Mutación que ejecuta consecuencias durante la escritura

---

## 2. DEFINICIÓN DE MUTACIÓN DE ENTIDAD VIVA

### Mutación de Entidad Viva

Una **Mutación de Entidad Viva** es una operación que modifica el estado de una entidad viva existente.

Una mutación:
- Modifica campos de una entidad viva ya creada
- Debe ser rastreable y auditable
- Debe preservar la integridad del Source of Truth
- Puede preparar señales para consecuencias futuras

### Diferencia con Creación

**Mutación**:
- Modifica una entidad existente
- Requiere que la entidad exista previamente
- Cambia el estado actual de la entidad
- Ejemplos: Actualizar nivel, actualizar streak, actualizar apodo

**Creación**:
- Introduce una nueva entidad en el sistema
- La entidad no existe antes
- Establece el estado inicial de la entidad
- Ejemplos: Crear alumno, crear práctica

### Qué Implica Mutar una Entidad Viva

Mutar una entidad viva implica:
1. Leer el estado anterior desde PostgreSQL (Source of Truth)
2. Validar que la entidad existe
3. Escribir el nuevo estado en PostgreSQL (Source of Truth)
4. Generar evento de auditoría (estado anterior → nuevo)
5. Preparar señal estructurada (sin emitir)
6. Respetar transacciones si aplican
7. NO calcular, NO decidir, NO ejecutar consecuencias

---

## 3. PRINCIPIOS CONSTITUCIONALES

### Principio 1: Mutar ≠ Crear

**Declaración**: La mutación de una entidad viva es una operación distinta de la creación.

**Implicaciones**:
- Mutar modifica una entidad existente
- Crear introduce una nueva entidad
- No se puede "mutar creando" (upsert no es mutación canónica)
- Cada operación tiene su punto canónico específico

### Principio 2: Mutar NO Calcula

**Declaración**: El servicio canónico de mutación NO calcula valores, solo escribe valores ya calculados.

**Implicaciones**:
- Los valores a mutar deben venir ya calculados desde la lógica de negocio
- El servicio canónico es un coordinador, no un motor
- Cálculos pertenecen a motores de negocio (progress-engine, streak-engine, etc.)

### Principio 3: Mutar NO Decide

**Declaración**: El servicio canónico de mutación NO decide políticas del sistema, solo escribe decisiones ya tomadas.

**Implicaciones**:
- La decisión de mutar debe hacerse antes de llamar al servicio canónico
- El servicio no valida si "debería" mutarse, solo valida que puede mutarse
- Decisiones pertenecen a la lógica de negocio o Admin

### Principio 4: Mutar NO Ejecuta Consecuencias

**Declaración**: La mutación de una entidad viva NO ejecuta consecuencias automáticamente.

**Implicaciones**:
- Mutar solo modifica el estado
- Las consecuencias (automatizaciones, señales, comunicaciones) se ejecutan después
- La mutación no debe depender de que las consecuencias se ejecuten
- Las consecuencias son responsabilidad de otra capa del sistema

### Principio 5: Mutar NO Emite Señales

**Declaración**: La mutación de una entidad viva NO emite señales durante la mutación.

**Implicaciones**:
- La mutación solo prepara la señal
- La emisión pertenece a otra fase del sistema
- La preparación garantiza que la señal puede emitirse cuando corresponda

### Principio 6: Mutar SOLO Modifica el Estado

**Declaración**: La mutación de una entidad viva tiene una única responsabilidad: modificar el estado en PostgreSQL.

**Implicaciones**:
- Toda otra responsabilidad (auditoría, señales, logs) es coordinación, no mutación
- La mutación es atómica: o se modifica el estado completo o no se modifica nada
- No hay mutación parcial

### Principio 7: PostgreSQL es la Única Autoridad

**Declaración**: PostgreSQL es el ÚNICO Source of Truth para mutaciones de entidades vivas. Ningún sistema externo participa como autoridad.

**Implicaciones**:
- No se muta en ClickUp como autoridad
- No se muta en SQLite como autoridad
- No se muta en Kajabi como autoridad
- Sistemas externos solo pueden ser Mirror o Cache, nunca autoridad

### Principio 8: Toda Mutación es Auditable

**Declaración**: Toda mutación de entidad viva DEBE generar un evento de auditoría.

**Implicaciones**:
- El evento de auditoría es obligatorio
- La auditoría es fail-open (no bloquea la mutación si falla)
- La auditoría incluye: actor, entidad, cambio (anterior → nuevo), timestamp

### Principio 9: Toda Mutación Prepara Señal

**Declaración**: Toda mutación de entidad viva DEBE preparar una señal estructurada.

**Implicaciones**:
- La señal se prepara pero NO se emite en la mutación
- La señal está disponible para emisión posterior
- El formato de la señal es estructurado y versionado

### Principio 10: Toda Mutación Puede Participar en Transacción

**Declaración**: Toda mutación de entidad viva DEBE poder participar en una transacción atómica.

**Implicaciones**:
- El servicio canónico acepta parámetro `client` (opcional)
- Si se proporciona `client`, todas las operaciones usan la misma transacción
- Si no se proporciona, se usa pool por defecto

### Principio 11: Ninguna Mutación Toca Sistemas Externos

**Declaración**: La mutación de entidades vivas NO debe escribir en sistemas externos como autoridad.

**Implicaciones**:
- No se escribe en ClickUp como autoridad
- No se escribe en SQLite como autoridad
- No se escribe en Kajabi como autoridad
- Sistemas externos pueden sincronizarse después, pero no son autoridad

---

## 4. PUNTO CANÓNICO DE MUTACIÓN

### Servicio Canónico Obligatorio

**Declaración**: TODA mutación de entidad viva DEBE pasar por un servicio canónico.

**Estado Actual**: `StudentMutationService` en `src/core/services/student-mutation-service.js`

**Métodos Canónicos Actuales**:
- `updateNivel()` - Actualiza el nivel de un alumno
- `updateStreak()` - Actualiza el streak de un alumno
- `updateUltimaPractica()` - Actualiza la fecha de última práctica
- `updateEstadoSuscripcion()` - Actualiza el estado de suscripción
- `updateApodo()` - Actualiza el apodo de un alumno

### Prohibición Explícita

**Está PROHIBIDO**:
- Mutar entidades vivas directamente desde endpoints
- Mutar entidades vivas directamente desde módulos de negocio
- Mutar entidades vivas directamente desde repositorios
- Mutar entidades vivas fuera del servicio canónico

**Excepción**: Ninguna. El servicio canónico es el único punto válido de mutación.

### Responsabilidades del Servicio Canónico

El servicio canónico de mutación:
1. Valida parámetros mínimos (tipos, rangos, formatos)
2. Lee estado anterior desde PostgreSQL (para auditoría)
3. Valida que la entidad existe
4. Escribe en PostgreSQL (Source of Truth)
5. Registra auditoría (fail-open)
6. Prepara señal estructurada (sin emitir)
7. Genera log estructurado
8. Retorna entidad mutada normalizada

**NO hace**:
- Cálculos de negocio
- Decisiones de política
- Ejecución de consecuencias
- Escritura en sistemas externos

---

## 5. SEPARACIÓN MUTACIÓN VS CONSECUENCIAS

### Mutar Modifica el Estado

La mutación de una entidad viva tiene una única responsabilidad: modificar el estado en PostgreSQL.

**Ejemplo**: Mutar el nivel de un alumno cambia el campo `nivel_actual` en la tabla `alumnos`.

### Consecuencias se Ejecutan Después

Las consecuencias de mutar una entidad viva se ejecutan **después** de la mutación, explícitamente.

**Ejemplos de Consecuencias**:
- Disparar automatizaciones
- Enviar comunicaciones
- Actualizar analíticas
- Calcular nuevos valores derivados

### Las Consecuencias NO Forman Parte del Contrato de Mutación

**Declaración**: El contrato de mutación NO incluye la ejecución de consecuencias.

**Implicaciones**:
- La mutación puede ejecutarse sin consecuencias
- Las consecuencias pueden ejecutarse en otra transacción
- Las consecuencias pueden ejecutarse asíncronamente
- Las consecuencias son responsabilidad de otra capa del sistema

---

## 6. AUDITORÍA OBLIGATORIA

### Evento de Auditoría Requerido

**Declaración**: Toda mutación de entidad viva DEBE generar un evento de auditoría.

**Formato del Evento**:
- `eventType`: Tipo de evento (ej: `STUDENT_LEVEL_UPDATED`, `STUDENT_STREAK_UPDATED`)
- `actorType`: Tipo de actor (`system`, `admin`, `user`)
- `actorId`: ID del actor (o `null` si no está disponible)
- `severity`: Severidad del evento (`info`, `warning`, `error`)
- `data`: Objeto con datos de la mutación (entidad, estado anterior, estado nuevo, timestamps)

### Auditoría Fail-Open

**Declaración**: Si la auditoría falla, NO debe bloquear la mutación.

**Implicaciones**:
- La mutación se considera exitosa aunque la auditoría falle
- El error de auditoría se registra en log de advertencia
- La auditoría es importante pero no crítica para la mutación

### Auditoría Mínima Requerida

**Campos Obligatorios**:
- `actor`: Quién mutó la entidad
- `entidad`: Qué entidad se mutó
- `estado_anterior`: Estado antes de la mutación
- `estado_nuevo`: Estado después de la mutación

**Campos Opcionales**:
- `metadata`: Información adicional relevante
- `context`: Contexto de la mutación

---

## 7. PREPARACIÓN DE SEÑALES

### Señal Estructurada Requerida

**Declaración**: Toda mutación de entidad viva DEBE preparar una señal estructurada.

**Formato de la Señal**:
- `signalType`: Tipo de señal (ej: `student.level_changed`, `student.streak_changed`)
- `payload`: Datos de la señal (entidad, estado anterior, estado nuevo, timestamps)
- `metadata`: Metadatos de la señal (preparación, fase, versión)

### La Señal NO se Emite en la Mutación

**Declaración**: La señal se prepara pero NO se emite durante la mutación.

**Implicaciones**:
- La señal está disponible para emisión posterior
- La emisión pertenece a otra fase del sistema
- La preparación garantiza que la señal puede emitirse cuando corresponda

### Emisión Pertenece a Otra Fase

**Declaración**: La emisión de señales y la ejecución de automatizaciones pertenecen a otra fase del sistema.

**Implicaciones**:
- La mutación no debe depender de la emisión de señales
- Las señales pueden emitirse asíncronamente
- Las automatizaciones se disparan desde señales, no desde mutación

---

## 8. TRANSACCIONES

### Participación en Transacciones

**Declaración**: Toda mutación de entidad viva DEBE poder participar en una transacción atómica.

**Implementación**:
- El servicio canónico acepta parámetro `client` (opcional)
- Si se proporciona `client`, todas las operaciones usan la misma transacción
- Si no se proporciona, se usa pool por defecto

### Transacciones Atómicas

**Declaración**: Cuando múltiples operaciones deben ejecutarse juntas, deben estar en la misma transacción.

**Ejemplo**:
- Actualizar práctica + actualizar streak + actualizar fecha última práctica
- Todo debe estar en la misma transacción para garantizar atomicidad

### Respeto del Contexto Transaccional

**Declaración**: El contrato obliga a aceptar y respetar el contexto transaccional proporcionado.

**Implicaciones**:
- Si se proporciona `client`, todas las operaciones (mutación, auditoría) usan ese `client`
- No se puede ignorar el contexto transaccional
- El servicio canónico no inicia transacciones, solo participa en ellas

---

## 9. ENTIDADES Y MUTACIONES ACTUALES BAJO ESTE CONTRATO

### Alumno - Mutaciones Certificadas

**Servicio Canónico**: `StudentMutationService`

**Mutaciones Implementadas**:

#### updateNivel()
- **Campo mutado**: `nivel_actual` en tabla `alumnos`
- **Auditoría**: `STUDENT_LEVEL_UPDATED`
- **Señal preparada**: `student.level_changed`
- **Validaciones**: Email válido, nivel entre 1-15 (entero)
- **Cumplimiento**: ✅

#### updateStreak()
- **Campo mutado**: `streak` en tabla `alumnos`
- **Auditoría**: `STUDENT_STREAK_UPDATED`
- **Señal preparada**: `student.streak_changed`
- **Validaciones**: Email válido, streak >= 0 (entero)
- **Cumplimiento**: ✅

#### updateUltimaPractica()
- **Campo mutado**: `fecha_ultima_practica` en tabla `alumnos`
- **Auditoría**: `STUDENT_LAST_PRACTICE_UPDATED`
- **Señal preparada**: `student.last_practice_updated`
- **Validaciones**: Email válido, fecha válida
- **Cumplimiento**: ✅

#### updateEstadoSuscripcion()
- **Campos mutados**: `estado_suscripcion`, `fecha_reactivacion` en tabla `alumnos`
- **Auditoría**: `STUDENT_SUBSCRIPTION_STATUS_UPDATED`
- **Señal preparada**: `student.subscription_status_changed`
- **Validaciones**: Email válido, estado válido ('activa', 'pausada', 'cancelada', 'past_due')
- **Cumplimiento**: ✅

#### updateApodo()
- **Campo mutado**: `apodo` en tabla `alumnos`
- **Auditoría**: `STUDENT_APODO_SET` o `STUDENT_APODO_UPDATED`
- **Señal preparada**: `student.apodo_changed`
- **Validaciones**: Identifier válido (email o ID), apodo string o null
- **Cumplimiento**: ✅

### Patrón de 8 Pasos

Todas las mutaciones siguen el mismo patrón de 8 pasos:

1. **Validar parámetros mínimos** ✅
2. **Leer estado anterior** ✅
3. **Validar existencia** ✅
4. **Escribir en PostgreSQL** ✅
5. **Registrar auditoría** ✅
6. **Preparar señal** ✅
7. **Generar log** ✅
8. **Retornar normalizado** ✅

---

## 10. EXTENSIBILIDAD FUTURA

### Cómo Añadir Nuevas Mutaciones

**Proceso Obligatorio**:
1. Definir la mutación y su propósito
2. Implementar método en el servicio canónico siguiendo el patrón existente
3. Asegurar cumplimiento de todos los principios constitucionales
4. Documentar en este contrato
5. Verificar que no viola reglas no negociables

### Reglas para Extender el Contrato

**Permitido**:
- Añadir nuevos métodos al servicio canónico
- Añadir nuevos tipos de mutaciones
- Extender el formato de auditoría (manteniendo campos obligatorios)
- Extender el formato de señales (manteniendo estructura base)

**Prohibido**:
- Crear puntos canónicos alternativos
- Violar principios constitucionales
- Añadir excepciones ad-hoc
- Mutar entidades vivas fuera del servicio canónico

### Prohibición de Excepciones Ad-Hoc

**Declaración**: No se permiten excepciones al contrato para casos específicos.

**Implicaciones**:
- Todas las mutaciones siguen el mismo contrato
- No hay "casos especiales" que justifiquen violar el contrato
- Si una mutación no puede cumplir el contrato, el diseño debe revisarse

---

## 11. REGLAS NO NEGOCIABLES

### Prohibiciones Absolutas

1. **Está PROHIBIDO mutar entidades vivas directamente desde endpoints**
   - Toda mutación debe pasar por el servicio canónico
   - Los endpoints solo coordinan, no mutan

2. **Está PROHIBIDO mutar entidades vivas directamente desde módulos de negocio**
   - Los motores de negocio calculan, no mutan
   - La mutación pertenece al servicio canónico

3. **Está PROHIBIDO mutar entidades vivas directamente desde repositorios**
   - Los repositorios son infraestructura, no lógica de dominio
   - La mutación debe pasar por el servicio canónico

4. **Está PROHIBIDO mutar entidades vivas sin auditoría**
   - Toda mutación debe generar evento de auditoría
   - La auditoría es obligatoria, no opcional

5. **Está PROHIBIDO mutar entidades vivas sin preparar señal**
   - Toda mutación debe preparar señal estructurada
   - La señal es obligatoria, no opcional

6. **Está PROHIBIDO mutar entidades vivas que calculen valores**
   - Los valores deben venir ya calculados
   - El servicio canónico no calcula, solo escribe

7. **Está PROHIBIDO mutar entidades vivas que decidan políticas**
   - Las decisiones deben hacerse antes de mutar
   - El servicio canónico no decide, solo escribe

8. **Está PROHIBIDO mutar entidades vivas que ejecuten consecuencias**
   - Las consecuencias se ejecutan después, explícitamente
   - La mutación no ejecuta consecuencias

9. **Está PROHIBIDO mutar entidades vivas en sistemas externos como autoridad**
   - PostgreSQL es la única autoridad
   - Sistemas externos no participan como autoridad en mutación

10. **Está PROHIBIDO mutar entidades vivas sin soporte de transacciones**
    - Toda mutación debe aceptar contexto transaccional
    - Las transacciones son obligatorias cuando aplican

11. **Está PROHIBIDO mutar entidades vivas que bloqueen si falla auditoría**
    - La auditoría es fail-open
    - La mutación no debe depender de la auditoría

12. **Está PROHIBIDO mutar entidades vivas que emitan señales durante la mutación**
    - Las señales se preparan, no se emiten
    - La emisión pertenece a otra fase

---

## 12. ESTADO DEL SISTEMA

### Declaración de Certificación

**Este contrato YA está implementado y certificado para**:
- ✅ Alumno - `updateNivel()`
- ✅ Alumno - `updateStreak()`
- ✅ Alumno - `updateUltimaPractica()`
- ✅ Alumno - `updateEstadoSuscripcion()`
- ✅ Alumno - `updateApodo()`

### El Documento Certifica, No Promete

**Declaración**: Este documento NO es una promesa de implementación futura. Es una certificación de lo que YA existe.

**Implicaciones**:
- El contrato está activo y operativo
- Las mutaciones actuales cumplen el contrato
- Futuras mutaciones deben cumplir el contrato
- No hay "plan de implementación", solo certificación de estado actual

### Verificación de Cumplimiento

**Para verificar que una mutación cumple el contrato**:
1. ¿Pasa por el servicio canónico?
2. ¿Muta en PostgreSQL como única autoridad?
3. ¿Registra auditoría?
4. ¿Prepara señal?
5. ¿Acepta transacciones?
6. ¿NO calcula, NO decide, NO ejecuta consecuencias?

**Si todas las respuestas son afirmativas, la mutación cumple el contrato.**

---

## CONCLUSIÓN

Este contrato define el estándar obligatorio para la mutación de entidades vivas en AuriPortal.

**Estado**: ✅ IMPLEMENTADO Y CERTIFICADO

**Alcance**: Alumno (5 mutaciones certificadas)

**Extensibilidad**: Futuras mutaciones deben cumplir este contrato sin excepciones.

**Vigencia**: Este contrato es constitucional y no negociable. Cualquier violación es una regresión arquitectónica.

---

**FIN DEL CONTRATO**





