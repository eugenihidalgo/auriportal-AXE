# Coherence Engine v1 - Documentación

## ¿Qué es el Coherence Engine?

El **Coherence Engine** es un motor que evalúa la coherencia global del sistema basándose exclusivamente en el Contract Registry existente. Determina el estado efectivo de cada contrato considerando sus dependencias.

### Principio Fundamental

> **El motor NO modifica nada.**
> - NO modifica contratos existentes
> - NO ejecuta lógica de negocio
> - NO repara nada automáticamente
> - SOLO lee, evalúa y reporta

## Objetivo

El Coherence Engine responde a las preguntas:
- **¿Cuál es el estado efectivo de cada contrato?**
- **¿Cómo afectan las dependencias al estado de un contrato?**
- **¿Cuál es el estado global del sistema?**
- **¿Qué contratos están afectando a otros?**

## Lógica de Evaluación

### Reglas de Estado Efectivo

1. **Si un contrato depende de uno 'broken'**:
   - `effective_status = 'broken'`
   - Razón: "Depende de contratos rotos: [ids]"

2. **Si depende de uno 'degraded'** (y no hay broken):
   - `effective_status = 'degraded'`
   - Razón: "Depende de contratos degradados: [ids]"

3. **Si todas sus dependencias están 'active'**:
   - `effective_status = declared_status`
   - Razón: "Todas las dependencias están activas. Estado declarado: [status]"

### Estado Global del Sistema

El `system_state` se calcula así:

- **'broken'**: Si existe al menos un contrato con `effective_status = 'broken'`
- **'degraded'**: Si no hay broken pero sí hay degraded
- **'active'**: Si todos los contratos están active

## Uso del Coherence Engine

### Evaluar Coherencia Completa

```javascript
import { evaluateCoherence } from './src/core/coherence/coherence-engine.js';

const report = evaluateCoherence();
console.log('Estado del sistema:', report.system_state);
console.log('Estadísticas:', report.stats);
```

### Obtener Estado de un Contrato Específico

```javascript
import { getContractState } from './src/core/coherence/coherence-engine.js';

const state = getContractState('projection.context.edit');
console.log('Estado efectivo:', state.effective_status);
console.log('Razón:', state.reason);
```

### Obtener Reporte Completo

```javascript
import { getSystemCoherenceReport } from './src/core/coherence/coherence-engine.js';

const report = getSystemCoherenceReport();
// report.system_state
// report.contracts[]
// report.stats
```

### Obtener Contratos por Estado Efectivo

```javascript
import { getContractsByEffectiveStatus } from './src/core/coherence/coherence-engine.js';

const broken = getContractsByEffectiveStatus('broken');
const degraded = getContractsByEffectiveStatus('degraded');
const active = getContractsByEffectiveStatus('active');
```

### Obtener Dependientes de un Contrato

```javascript
import { getDependents } from './src/core/coherence/coherence-engine.js';

const dependents = getDependents('projection.context.list');
// Retorna todos los contratos que dependen de 'projection.context.list'
```

## Estructura del Reporte

### CoherenceReport

```typescript
{
  system_state: 'active' | 'degraded' | 'broken',
  contracts: ContractState[],
  stats: {
    total: number,
    active: number,
    degraded: number,
    broken: number
  }
}
```

### ContractState

```typescript
{
  id: string,
  declared_status: 'active' | 'degraded' | 'broken',
  effective_status: 'active' | 'degraded' | 'broken',
  reason: string,
  dependencies: string[],
  dependency_states: ContractState[]
}
```

## Ejemplo de Uso

```javascript
import { evaluateCoherence, getContractState } from './src/core/coherence/coherence-engine.js';

// Evaluar todo el sistema
const report = evaluateCoherence();

console.log(`Estado del sistema: ${report.system_state}`);
console.log(`Total: ${report.stats.total}`);
console.log(`Activos: ${report.stats.active}`);
console.log(`Degradados: ${report.stats.degraded}`);
console.log(`Rotos: ${report.stats.broken}`);

// Obtener estado de un contrato específico
const state = getContractState('projection.context.edit');
console.log(`Contrato: ${state.id}`);
console.log(`Declarado: ${state.declared_status}`);
console.log(`Efectivo: ${state.effective_status}`);
console.log(`Razón: ${state.reason}`);

// Ver dependencias
if (state.dependencies.length > 0) {
  console.log('Dependencias:');
  state.dependency_states.forEach(dep => {
    console.log(`  - ${dep.id}: ${dep.effective_status}`);
  });
}
```

## Cache de Evaluación

El Coherence Engine mantiene un cache interno de estados evaluados para:
- Evitar recálculos innecesarios
- Detectar ciclos de dependencias
- Optimizar rendimiento

El cache se limpia automáticamente en cada llamada a `evaluateCoherence()`.

Para limpiar manualmente el cache:

```javascript
import { clearCache } from './src/core/coherence/coherence-engine.js';

clearCache();
```

## Logs Estructurados

El Coherence Engine genera logs con el prefijo `[COHERENCE_ENGINE]`:

```
[COHERENCE_ENGINE] Iniciando evaluación de coherencia...
[COHERENCE_ENGINE] Evaluando 12 contratos
[COHERENCE_ENGINE] Estado global del sistema: active
[COHERENCE_ENGINE] Estadísticas: { total: 12, active: 12, degraded: 0, broken: 0 }
[COHERENCE_ENGINE] Evaluación completada
```

## Casos de Uso

### 1. Verificar Estado del Sistema

```javascript
const report = evaluateCoherence();
if (report.system_state === 'broken') {
  console.error('⚠️ Sistema tiene contratos rotos');
  const broken = getContractsByEffectiveStatus('broken');
  broken.forEach(c => console.error(`  - ${c.id}: ${c.reason}`));
}
```

### 2. Analizar Impacto de un Contrato Roto

```javascript
// Si un contrato está roto, ver qué otros afecta
const brokenContract = 'some.broken.contract';
const dependents = getDependents(brokenContract);
console.log(`Contratos afectados por '${brokenContract}':`);
dependents.forEach(dep => {
  console.log(`  - ${dep.id}: ${dep.effective_status}`);
});
```

### 3. Validar Dependencias

```javascript
const contract = getContractState('projection.context.runtime');
if (contract.dependency_states.some(dep => dep.effective_status === 'broken')) {
  console.warn(`⚠️ ${contract.id} depende de contratos rotos`);
}
```

## Arquitectura

### Flujo de Evaluación

```
1. evaluateCoherence()
   ↓
2. Obtener todos los contratos del registry
   ↓
3. Para cada contrato:
   a. Si ya está en cache → retornar
   b. Si no tiene dependencias → estado = declarado
   c. Si tiene dependencias:
      - Evaluar dependencias recursivamente
      - Determinar estado efectivo según reglas
   ↓
4. Calcular estado global del sistema
   ↓
5. Calcular estadísticas
   ↓
6. Retornar reporte completo
```

### Inmutabilidad

El Coherence Engine:
- **NO muta el Contract Registry**
- Trabaja sobre copias en memoria
- Usa cache interno para optimización
- No tiene efectos secundarios

## Limitaciones Actuales

El Coherence Engine v1:
- ✅ Evalúa estados efectivos basados en dependencias
- ✅ Calcula estado global del sistema
- ✅ Genera reportes completos
- ❌ NO implementa UI
- ❌ NO implementa modos SAFE / DEGRADED
- ❌ NO repara automáticamente
- ❌ NO persiste resultados

## Próximos Pasos

Futuras versiones del Coherence Engine podrían incluir:
1. **UI Dashboard**: Visualización de estados de contratos
2. **Modos de Operación**: SAFE, DEGRADED, BROKEN
3. **Reparaciones Automáticas**: Sugerencias de reparación
4. **Persistencia**: Guardar historial de evaluaciones
5. **Alertas**: Notificaciones cuando contratos cambian de estado

## Archivos Relacionados

- `src/core/coherence/coherence-engine.js`: Motor principal
- `src/core/contracts/contract-registry.js`: Contract Registry
- `scripts/test-coherence-engine.js`: Script de prueba

## Testing

Para probar el Coherence Engine:

```bash
node scripts/test-coherence-engine.js
```

Este script muestra:
- Evaluación completa del sistema
- Contratos con estados no-activos
- Estado de un contrato específico
- Dependientes de un contrato
- Resumen del reporte

---

**Versión**: 1.0.0  
**Fecha**: 2025-01-20  
**Autor**: Sistema AuriPortal

