# PREPARACIÓN FASE D - FASE 3: ACTION REGISTRY
## AuriPortal - Automatizaciones Canónicas

**Fecha**: 2025-01-XX  
**Estado**: ⏳ PREPARACIÓN (NO IMPLEMENTADA)  
**Objetivo**: Preparar terreno conceptual para Fase 3

---

## QUÉ ES EL ACTION REGISTRY

El **Action Registry** es un registro canónico de todas las acciones que pueden ser ejecutadas por automatizaciones.

### Definición

Un **Action Registry** es:
- Un catálogo centralizado de acciones disponibles
- Un punto de validación de inputs antes de ejecutar
- Un contrato entre automatizaciones y servicios canónicos
- Una capa de seguridad que impide ejecutar código no registrado

### Propósito

El Action Registry:
- **Registra** acciones con schema y handler
- **Valida** inputs antes de ejecutar
- **Ejecuta** acciones usando servicios canónicos (Contrato B)
- **Prohíbe** ejecutar código inline o no registrado

---

## POR QUÉ ES EL SIGUIENTE PASO LÓGICO

### Orden de Implementación

1. ✅ **Fase 1**: Migraciones (tablas en PostgreSQL) - COMPLETADA
2. ✅ **Fase 2**: Contrato D (gobernanza) - COMPLETADA
3. ⏳ **Fase 3**: Action Registry (canónico) - SIGUIENTE
4. ⏳ **Fase 4**: Automation Engine (runtime)
5. ⏳ **Fase 5**: Integración con emisión de señales

### Dependencias

**Fase 3 (Action Registry) requiere**:
- ✅ Fase 1: Tablas en PostgreSQL (ya existe)
- ✅ Fase 2: Contrato D formalizado (ya existe)
- ✅ Contrato B: Servicios canónicos de mutación (ya existe)

**Fase 4 (Automation Engine) requiere**:
- ⏳ Fase 3: Action Registry (pendiente)

**Fase 5 (Integración) requiere**:
- ⏳ Fase 4: Automation Engine (pendiente)

### Lógica Arquitectónica

El Action Registry es el **puente** entre:
- **Automatizaciones** (que definen qué acciones ejecutar)
- **Servicios Canónicos** (que mutan estado según Contrato B)

Sin Action Registry:
- Las automatizaciones no saben qué acciones están disponibles
- No hay validación de inputs
- No hay contrato entre automatizaciones y servicios

Con Action Registry:
- Las automatizaciones ejecutan acciones registradas
- Los inputs se validan antes de ejecutar
- El contrato entre automatizaciones y servicios está explícito

---

## QUÉ CONTRATOS GOBIERNAN ESTA FASE

### Contrato B: Mutación de Entidades Vivas

**Obligación**:
- Toda mutación DEBE usar servicios canónicos
- Toda mutación DEBE preparar señal
- Toda mutación DEBE auditar

**Relación con Action Registry**:
- Las acciones registradas DEBEN usar servicios canónicos (Contrato B)
- No se puede mutar estado directamente desde acciones
- Las acciones son wrappers que llaman a servicios canónicos

**Ejemplo**:
```javascript
// Acción registrada
registerAction({
  key: 'student.updateStreak',
  handler: async (input) => {
    // Usa servicio canónico (Contrato B)
    const service = getStudentMutationService();
    return await service.updateStreak(
      input.email,
      input.streak,
      { type: 'system' } // Actor: sistema (automatización)
    );
  }
});
```

### Contrato D: Automatizaciones Canónicas

**Obligación**:
- Las automatizaciones SOLO ejecutan acciones registradas
- No se puede ejecutar código inline
- No se puede ejecutar funciones ad-hoc

**Relación con Action Registry**:
- El Action Registry es el ÚNICO punto de ejecución de acciones
- Las automatizaciones buscan acciones en el registry
- Si una acción no está registrada, la automatización falla explícitamente

**Ejemplo**:
```javascript
// Automatización ejecuta acción registrada
const action = getAction('student.updateStreak');
if (!action) {
  throw new Error('Action not registered: student.updateStreak');
}
await action.handler(resolvedInput);
```

---

## ESTRUCTURA ESPERADA DEL ACTION REGISTRY

### Funciones Principales

1. **`registerAction({ key, description, schema, handler, sideEffectsLevel })`**
   - Registra una acción en el registry
   - Valida que la acción no esté duplicada
   - Almacena schema para validación de inputs

2. **`getAction(key)`**
   - Obtiene una acción registrada por su clave
   - Retorna `null` si no existe
   - Usado por Automation Engine para ejecutar acciones

3. **`validateActionInput(key, input)`**
   - Valida que el input cumple el schema de la acción
   - Retorna `{ valid: boolean, errors: [] }`
   - Usado antes de ejecutar la acción

### Acciones Mínimas Requeridas

Las siguientes acciones DEBEN estar registradas (usando Contrato B):

- `student.updateNivel` → `StudentMutationService.updateNivel()`
- `student.updateStreak` → `StudentMutationService.updateStreak()`
- `student.updateUltimaPractica` → `StudentMutationService.updateUltimaPractica()`
- `student.updateEstadoSuscripcion` → `StudentMutationService.updateEstadoSuscripcion()`
- `student.updateApodo` → `StudentMutationService.updateApodo()`

### Ubicación Esperada

**Archivo**: `src/core/actions/action-registry.js` (extender o crear nuevo)

**Nota**: Si ya existe un `action-registry.js` en el sistema, debe ser extendido para cumplir con Contrato D.

---

## PROHIBICIONES EXPLÍCITAS

### Está PROHIBIDO en Fase 3

1. ❌ Ejecutar automatizaciones (Fase 4)
2. ❌ Conectar con emisión de señales (Fase 5)
3. ❌ Crear Admin UI (Fase 6)
4. ❌ Mutar estado directamente desde acciones
5. ❌ Ejecutar código inline desde acciones
6. ❌ Registrar acciones que no usan servicios canónicos (Contrato B)

### Está PERMITIDO en Fase 3

1. ✅ Registrar acciones que usan servicios canónicos
2. ✅ Validar inputs con schema
3. ✅ Documentar acciones registradas
4. ✅ Preparar estructura para Automation Engine (Fase 4)

---

## ESTADO ACTUAL DEL SISTEMA

### Código Existente

Según `DIAGNOSTICO_FASE_D_AUTOMATIZACIONES.md`:
- Existe `src/core/automations/action-registry.js` (legacy)
- Necesita ser extendido o reemplazado para cumplir Contrato D

### Servicios Canónicos Disponibles

- ✅ `StudentMutationService.updateNivel()`
- ✅ `StudentMutationService.updateStreak()`
- ✅ `StudentMutationService.updateUltimaPractica()`
- ✅ `StudentMutationService.updateEstadoSuscripcion()`
- ✅ `StudentMutationService.updateApodo()`

**Todos estos servicios cumplen Contrato B y están listos para ser usados por acciones.**

---

## PREPARACIÓN PARA FASE 3

### Lo que NO se debe hacer ahora

- ❌ NO implementar Action Registry todavía
- ❌ NO registrar acciones todavía
- ❌ NO escribir handlers todavía
- ❌ NO conectar con Automation Engine todavía

### Lo que SÍ se debe hacer ahora

- ✅ Certificar Fase 1 como completada
- ✅ Dejar el sistema listo conceptualmente para Fase 3
- ✅ Documentar qué es Action Registry y por qué es necesario
- ✅ Documentar qué contratos gobiernan esta fase

---

## CONCLUSIÓN

El sistema está **preparado conceptualmente** para la Fase 3 (Action Registry).

**Estado**:
- ✅ Fase 1: Migraciones - COMPLETADA
- ✅ Fase 2: Contrato D - COMPLETADA
- ⏳ Fase 3: Action Registry - PREPARADA (no implementada)

**Próximo paso**: Implementar Fase 3 (Action Registry) cuando se solicite.

---

**FIN DE PREPARACIÓN**




