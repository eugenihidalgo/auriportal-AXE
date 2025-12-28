# CONTRATO CANÓNICO DE SEÑALES DEL SISTEMA
## AuriPortal - Fase 2.2 Certificada

**Versión**: 1.0  
**Fecha de Certificación**: 2025-01-XX  
**Estado**: ✅ IMPLEMENTADO Y CERTIFICADO  
**Alcance**: Señales canónicas en AuriPortal

---

## 1. PROPÓSITO DEL CONTRATO

Este contrato define, de forma explícita y no negociable, cómo funcionan las "señales" en AuriPortal.

### Qué Protege

- **Separación de Responsabilidades**: Garantiza que preparar señales no ejecuta consecuencias.
- **Integridad del Flujo**: Impide que señales muten estado o ejecuten acciones durante su preparación.
- **Extensibilidad Controlada**: Permite añadir nuevas señales sin violar principios constitucionales.
- **Observabilidad**: Asegura que todas las señales son estructuradas y rastreables.

### Por Qué Existe

Antes de este contrato, las señales podían confundirse con ejecución de acciones, generando:
- Señales que ejecutan automatizaciones durante su preparación
- Señales que mutan estado
- Señales que llaman sistemas externos
- Falta de claridad sobre qué es una señal vs qué es una acción

Este contrato elimina estas violaciones mediante principios constitucionales claros.

### Qué Problemas Evita

- Preparar señales que ejecutan automatizaciones
- Preparar señales que mutan estado
- Preparar señales que llaman sistemas externos
- Emitir señales desde servicios canónicos de creación/mutación
- Usar señales como control de flujo
- Señales no estructuradas o no versionadas

---

## 2. DEFINICIÓN FORMAL DE SEÑAL

### Señal

Una **Señal** es un dato estructurado que describe un hecho ocurrido en el sistema.

Una señal:
- Describe un evento que ya ocurrió
- Es inmutable (no cambia después de prepararse)
- Es estructurada (tiene formato canónico)
- Es versionada (tiene versión explícita)
- NO ejecuta acciones
- NO muta estado
- NO llama sistemas externos

### Diferencia con Acción

**Señal**:
- Describe un hecho ocurrido
- Es un dato, no una ejecución
- Se prepara, no se ejecuta
- Ejemplos: `student.level_changed`, `student.created`, `student.streak_changed`

**Acción**:
- Ejecuta una operación
- Es una ejecución, no un dato
- Se ejecuta, no se prepara
- Ejemplos: Enviar email, actualizar nivel, disparar automatización

### Diferencia con Automatización

**Señal**:
- Es un dato que describe un hecho
- Puede ser consumida por automatizaciones
- No ejecuta automatizaciones

**Automatización**:
- Es una regla que reacciona a señales
- Se ejecuta cuando recibe una señal
- Ejecuta acciones basadas en señales

---

## 3. SEPARACIÓN DE RESPONSABILIDADES

### Preparar Señal ≠ Emitir Señal

**Declaración**: Preparar una señal es distinto de emitirla.

**Preparar Señal**:
- Construir el dato estructurado de la señal
- Disponerlo para uso futuro
- NO enviarlo a ningún consumidor
- NO ejecutar ninguna acción

**Emitir Señal**:
- Enviar la señal a consumidores (automatizaciones, analíticas, etc.)
- Ejecutarse en otra fase del sistema
- NO pertenece a servicios canónicos de creación/mutación

### Preparar Señal ≠ Ejecutar Consecuencias

**Declaración**: Preparar una señal NO ejecuta consecuencias.

**Implicaciones**:
- Preparar señal no dispara automatizaciones
- Preparar señal no envía comunicaciones
- Preparar señal no actualiza analíticas
- Las consecuencias se ejecutan después, explícitamente

### Preparar Señal ≠ Mutar Estado

**Declaración**: Preparar una señal NO muta estado.

**Implicaciones**:
- Preparar señal no modifica PostgreSQL
- Preparar señal no actualiza entidades
- Preparar señal no cambia el estado del sistema
- La señal solo describe un hecho ya ocurrido

### Preparar Señal ≠ Llamar Sistemas Externos

**Declaración**: Preparar una señal NO llama sistemas externos.

**Implicaciones**:
- Preparar señal no llama APIs externas
- Preparar señal no envía webhooks
- Preparar señal no interactúa con ClickUp, Kajabi, etc.
- La señal es un dato local, no una comunicación

---

## 4. PRINCIPIOS CONSTITUCIONALES

### Principio 1: Preparar Señal NO Ejecuta

**Declaración**: Preparar una señal NO ejecuta ninguna acción.

**Implicaciones**:
- No dispara automatizaciones
- No envía comunicaciones
- No actualiza analíticas
- No ejecuta ninguna operación

### Principio 2: Preparar Señal NO Decide

**Declaración**: Preparar una señal NO decide políticas del sistema.

**Implicaciones**:
- No valida si "debería" prepararse
- No decide qué hacer con la señal
- Solo describe el hecho ocurrido
- Las decisiones pertenecen a otra capa

### Principio 3: Preparar Señal NO Muta

**Declaración**: Preparar una señal NO muta el estado del sistema.

**Implicaciones**:
- No modifica PostgreSQL
- No actualiza entidades
- No cambia el estado del sistema
- Solo describe un hecho ya registrado

### Principio 4: Preparar Señal NO Llama Externos

**Declaración**: Preparar una señal NO llama sistemas externos.

**Implicaciones**:
- No llama APIs externas
- No envía webhooks
- No interactúa con sistemas externos
- La señal es un dato local

### Principio 5: Emisión Está Prohibida en Dominio

**Declaración**: Emitir señales está PROHIBIDO en servicios canónicos de creación/mutación.

**Implicaciones**:
- Los servicios canónicos solo preparan señales
- La emisión pertenece a otra fase del sistema
- No se puede emitir desde create* ni update*
- La emisión es responsabilidad de otra capa

### Principio 6: Señales Son Inmutables

**Declaración**: Una señal, una vez preparada, es inmutable.

**Implicaciones**:
- No se modifica después de prepararse
- No se actualiza con información adicional
- Es un snapshot del hecho ocurrido
- Si se necesita más información, se prepara una nueva señal

### Principio 7: Señales Son Estructuradas

**Declaración**: Toda señal DEBE tener una estructura canónica.

**Implicaciones**:
- Formato consistente
- Campos obligatorios
- Versionado explícito
- Sin campos ad-hoc

### Principio 8: Señales Son Versionadas

**Declaración**: Toda señal DEBE tener una versión explícita.

**Implicaciones**:
- Versión en metadata
- Compatibilidad versionada
- Evolución controlada
- Sin cambios breaking sin versión

---

## 5. TIPOS DE SEÑALES

### Señales de Dominio

**Definición**: Señales que describen hechos del dominio de negocio.

**Características**:
- Describen eventos del alumno o del sistema
- Son consumidas por automatizaciones de negocio
- Ejemplos: `student.created`, `student.level_changed`, `student.streak_changed`

**Preparación**:
- Se preparan en servicios canónicos de creación/mutación
- Forman parte del contrato de creación/mutación
- Son obligatorias para entidades vivas

### Señales de Observabilidad

**Definición**: Señales que describen hechos del sistema (telemetría, diagnósticos).

**Características**:
- Describen eventos técnicos del sistema
- Son consumidas por sistemas de observabilidad
- Ejemplos: `system.error`, `system.performance`, `system.health`

**Preparación**:
- Se preparan en capas de observabilidad
- No forman parte del contrato de creación/mutación
- Son opcionales y específicas de observabilidad

**Nota**: Este contrato se enfoca en Señales de Dominio. Las Señales de Observabilidad tienen su propio contrato.

---

## 6. ESTRUCTURA CANÓNICA DE UNA SEÑAL

### Formato Obligatorio

```javascript
{
  signalType: string,      // Tipo de señal (ej: 'student.level_changed')
  payload: {
    entity: Object,        // Entidad afectada (normalizada)
    oldState: Object|null, // Estado anterior (si aplica)
    newState: Object,      // Estado nuevo
    timestamp: string,     // ISO 8601 timestamp
    actor: {
      type: string,        // 'system' | 'admin' | 'user'
      id: string|null     // ID del actor (si disponible)
    }
  },
  metadata: {
    version: string,      // Versión de la señal (ej: '1.0')
    preparedAt: string,  // ISO 8601 timestamp de preparación
    source: string       // Origen de la señal (ej: 'StudentMutationService')
  }
}
```

### Campos Obligatorios

- `signalType`: Identificador único del tipo de señal
- `payload.entity`: Entidad afectada (normalizada)
- `payload.newState`: Estado nuevo después del evento
- `metadata.version`: Versión de la señal
- `metadata.preparedAt`: Timestamp de preparación

### Campos Opcionales

- `payload.oldState`: Estado anterior (null si es creación)
- `payload.actor`: Actor que causó el evento
- `metadata.source`: Origen de la señal

---

## 7. DÓNDE SE PREPARAN SEÑALES

### Servicios Canónicos de Creación/Mutación

**Declaración**: Las señales de dominio se preparan en servicios canónicos de creación/mutación.

**Estado Actual**:
- `StudentMutationService` prepara señales en:
  - `createStudent()` → `student.created`
  - `createStudentPractice()` → `student.practice_registered`
  - `updateNivel()` → `student.level_changed`
  - `updateStreak()` → `student.streak_changed`
  - `updateUltimaPractica()` → `student.last_practice_updated`
  - `updateEstadoSuscripcion()` → `student.subscription_status_changed`
  - `updateApodo()` → `student.apodo_changed`

**Método Canónico**:
- `_prepareSignal(signalType, student, oldState, newState)`
- Construye la señal estructurada
- NO la emite
- Retorna el dato estructurado

### Relación con Contratos A y B

**Contrato A (Creación)**:
- Toda creación de entidad viva DEBE preparar señal
- La señal se prepara en el servicio canónico de creación
- La señal NO se emite durante la creación

**Contrato B (Mutación)**:
- Toda mutación de entidad viva DEBE preparar señal
- La señal se prepara en el servicio canónico de mutación
- La señal NO se emite durante la mutación

**Contrato C (Señales)**:
- Define qué es una señal y cómo se prepara
- Prohíbe emisión desde servicios canónicos
- Establece estructura canónica

---

## 8. DÓNDE ESTÁ PROHIBIDO PREPARAR/EMITIR SEÑALES

### Prohibiciones Absolutas

1. **Está PROHIBIDO emitir señales desde servicios canónicos de creación/mutación**
   - Los servicios canónicos solo preparan, no emiten
   - La emisión pertenece a otra fase del sistema

2. **Está PROHIBIDO ejecutar automatizaciones al preparar señales**
   - Preparar señal no dispara automatizaciones
   - Las automatizaciones se ejecutan después, explícitamente

3. **Está PROHIBIDO mutar estado desde señales**
   - Preparar señal no modifica PostgreSQL
   - Preparar señal no actualiza entidades

4. **Está PROHIBIDO llamar sistemas externos desde señales**
   - Preparar señal no llama APIs externas
   - Preparar señal no envía webhooks

5. **Está PROHIBIDO usar señales como control de flujo**
   - Las señales no controlan el flujo de ejecución
   - Las señales solo describen hechos ocurridos

6. **Está PROHIBIDO preparar señales fuera de servicios canónicos**
   - Las señales de dominio se preparan en servicios canónicos
   - No se preparan en endpoints, módulos de negocio, o repositorios

---

## 9. RELACIÓN CON CONTRATOS A Y B

### Contrato A: Creación de Entidades Vivas

**Obligación**:
- Toda creación DEBE preparar señal
- La señal se prepara en el servicio canónico de creación
- La señal NO se emite durante la creación

**Ejemplo**:
- `createStudent()` prepara `student.created`
- La señal está disponible para emisión posterior
- No se emite durante `createStudent()`

### Contrato B: Mutación de Entidades Vivas

**Obligación**:
- Toda mutación DEBE preparar señal
- La señal se prepara en el servicio canónico de mutación
- La señal NO se emite durante la mutación

**Ejemplo**:
- `updateNivel()` prepara `student.level_changed`
- La señal está disponible para emisión posterior
- No se emite durante `updateNivel()`

### Contrato C: Señales Canónicas

**Obligación**:
- Define qué es una señal y cómo se prepara
- Prohíbe emisión desde servicios canónicos
- Establece estructura canónica

**Relación**:
- El Contrato C completa los Contratos A y B
- Define el "qué" y "cómo" de las señales
- Establece prohibiciones explícitas

---

## 10. REGLAS NO NEGOCIABLES

### Prohibiciones Absolutas

1. **Está PROHIBIDO emitir señales desde servicios canónicos de creación/mutación**
   - Los servicios canónicos solo preparan, no emiten
   - La emisión pertenece a otra fase del sistema

2. **Está PROHIBIDO ejecutar automatizaciones al preparar señales**
   - Preparar señal no dispara automatizaciones
   - Las automatizaciones se ejecutan después, explícitamente

3. **Está PROHIBIDO mutar estado desde señales**
   - Preparar señal no modifica PostgreSQL
   - Preparar señal no actualiza entidades

4. **Está PROHIBIDO llamar sistemas externos desde señales**
   - Preparar señal no llama APIs externas
   - Preparar señal no envía webhooks

5. **Está PROHIBIDO usar señales como control de flujo**
   - Las señales no controlan el flujo de ejecución
   - Las señales solo describen hechos ocurridos

6. **Está PROHIBIDO preparar señales fuera de servicios canónicos**
   - Las señales de dominio se preparan en servicios canónicos
   - No se preparan en endpoints, módulos de negocio, o repositorios

7. **Está PROHIBIDO señales no estructuradas**
   - Toda señal debe tener estructura canónica
   - Sin campos ad-hoc o formatos inconsistentes

8. **Está PROHIBIDO señales no versionadas**
   - Toda señal debe tener versión explícita
   - Sin cambios breaking sin versión

9. **Está PROHIBIDO señales que mutan después de prepararse**
   - Una señal, una vez preparada, es inmutable
   - No se modifica con información adicional

10. **Está PROHIBIDO señales que deciden políticas**
    - Las señales no deciden qué hacer
    - Solo describen hechos ocurridos

---

## 11. ESTADO DEL SISTEMA

### Declaración de Certificación

**Este contrato YA está implementado y certificado para**:
- ✅ Preparación de señales en `StudentMutationService`
- ✅ Estructura canónica de señales
- ✅ Separación preparación vs emisión
- ✅ Prohibición de emisión desde servicios canónicos

### Señales Preparadas Actualmente

**Creación**:
- ✅ `student.created` - Preparada en `createStudent()`
- ✅ `student.practice_registered` - Preparada en `createStudentPractice()`

**Mutación**:
- ✅ `student.level_changed` - Preparada en `updateNivel()`
- ✅ `student.streak_changed` - Preparada en `updateStreak()`
- ✅ `student.last_practice_updated` - Preparada en `updateUltimaPractica()`
- ✅ `student.subscription_status_changed` - Preparada en `updateEstadoSuscripcion()`
- ✅ `student.apodo_changed` - Preparada en `updateApodo()`

### El Documento Certifica, No Promete

**Declaración**: Este documento NO es una promesa de implementación futura. Es una certificación de lo que YA existe.

**Implicaciones**:
- El contrato está activo y operativo
- Las señales actuales cumplen el contrato
- Futuras señales deben cumplir el contrato
- No hay "plan de implementación", solo certificación de estado actual

### Verificación de Cumplimiento

**Para verificar que una señal cumple el contrato**:
1. ¿Se prepara en servicio canónico?
2. ¿Tiene estructura canónica?
3. ¿Está versionada?
4. ¿NO se emite durante preparación?
5. ¿NO ejecuta acciones?
6. ¿NO muta estado?
7. ¿NO llama sistemas externos?

**Si todas las respuestas son afirmativas, la señal cumple el contrato.**

---

## CONCLUSIÓN

Este contrato define el estándar obligatorio para las señales canónicas en AuriPortal.

**Estado**: ✅ IMPLEMENTADO Y CERTIFICADO

**Alcance**: Señales de dominio preparadas en servicios canónicos (7 señales certificadas)

**Extensibilidad**: Futuras señales deben cumplir este contrato sin excepciones.

**Vigencia**: Este contrato es constitucional y no negociable. Cualquier violación es una regresión arquitectónica.

---

**FIN DEL CONTRATO**






