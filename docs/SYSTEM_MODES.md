# System Modes - Documentación

## ¿Qué son los System Modes?

Los **System Modes** son modos de operación del sistema derivados del Coherence Engine. Definen el estado operacional del sistema y sus capacidades (lectura/escritura).

### Principio Fundamental

> **Los System Modes son puramente DECLARATIVOS.**
> - NO modifican contratos
> - NO ejecutan lógica de negocio
> - NO persisten estados
> - SOLO lectura y decisión

## Modos Disponibles

### NORMAL
- **Estado de coherencia**: `active`
- **Escritura**: ✅ Permitida
- **Descripción**: Sistema completamente operativo. Todas las funcionalidades disponibles.

### DEGRADED
- **Estado de coherencia**: `degraded`
- **Escritura**: ✅ Permitida (con advertencias)
- **Descripción**: Sistema operativo con limitaciones. Algunos contratos están degradados.

### SAFE
- **Estado de coherencia**: `degraded` (con override manual futuro)
- **Escritura**: ✅ Permitida (override manual)
- **Descripción**: Sistema en modo seguro. Operaciones permitidas con override manual.

### BROKEN
- **Estado de coherencia**: `broken`
- **Escritura**: ❌ Bloqueada
- **Descripción**: Sistema no operativo. Contratos críticos están rotos. Solo lectura disponible.

## Uso de los System Modes

### Obtener Modo Actual

```javascript
import { getSystemMode } from './src/core/system/system-modes.js';

const mode = getSystemMode();
console.log(`Modo actual: ${mode}`); // 'NORMAL', 'DEGRADED', 'SAFE', o 'BROKEN'
```

### Verificar Capacidades

```javascript
import { isSystemWritable, isSystemReadOnly } from './src/core/system/system-modes.js';

if (isSystemWritable()) {
  // Permitir operaciones de escritura
  await saveData();
} else {
  // Solo permitir lectura
  console.warn('Sistema en modo solo lectura');
}
```

### Obtener Información Detallada

```javascript
import { getSystemModeInfo } from './src/core/system/system-modes.js';

const info = getSystemModeInfo();
console.log('Modo:', info.mode);
console.log('Estado de coherencia:', info.system_state);
console.log('Permite escritura:', info.writable);
console.log('Estadísticas:', info.stats);
```

### Verificar Modo Específico

```javascript
import { isSystemInMode } from './src/core/system/system-modes.js';

if (isSystemInMode('BROKEN')) {
  console.error('⚠️ Sistema no operativo');
  // Bloquear operaciones críticas
}
```

### Obtener Descripción

```javascript
import { getSystemModeDescription } from './src/core/system/system-modes.js';

const description = getSystemModeDescription();
console.log(description);
```

## Matriz de Decisiones

| Modo      | Escritura | Solo Lectura | Descripción                    |
|-----------|-----------|--------------|--------------------------------|
| NORMAL    | ✅ Sí     | ❌ No        | Completamente operativo         |
| DEGRADED  | ✅ Sí     | ❌ No        | Operativo con limitaciones      |
| SAFE      | ✅ Sí     | ❌ No        | Modo seguro (override)         |
| BROKEN    | ❌ No     | ✅ Sí        | No operativo                   |

## Integración con Otros Sistemas

### Action Engine (Futuro)

El Action Engine puede usar System Modes para decidir si permitir acciones:

```javascript
import { isSystemWritable } from './src/core/system/system-modes.js';

async function executeAction(action, input) {
  if (!isSystemWritable() && action.requiresWrite) {
    return {
      ok: false,
      error: 'Sistema en modo solo lectura'
    };
  }
  // Ejecutar acción...
}
```

### UI (Futuro)

La UI puede mostrar el estado del sistema:

```javascript
import { getSystemMode, getSystemModeDescription } from './src/core/system/system-modes.js';

const mode = getSystemMode();
const description = getSystemModeDescription();

// Mostrar banner de estado
if (mode === 'BROKEN') {
  showErrorBanner('Sistema no operativo');
} else if (mode === 'DEGRADED') {
  showWarningBanner(description);
}
```

## Arquitectura

### Flujo de Derivación

```
1. getSystemMode()
   ↓
2. getSystemCoherenceReport()
   ↓
3. coherenceReport.system_state
   ↓
4. COHERENCE_TO_MODE[system_state]
   ↓
5. SystemMode (NORMAL | DEGRADED | SAFE | BROKEN)
```

### Inmutabilidad

Los System Modes:
- **NO mutan el estado del sistema**
- **NO persisten información**
- **NO tienen efectos secundarios**
- Son funciones puras que derivan el modo desde el Coherence Engine

## Funciones Disponibles

### `getSystemMode()`
Retorna el modo actual del sistema.

**Retorna**: `'NORMAL' | 'DEGRADED' | 'SAFE' | 'BROKEN'`

### `isSystemWritable()`
Indica si el sistema permite operaciones de escritura.

**Retorna**: `boolean`

### `isSystemReadOnly()`
Indica si el sistema está en modo solo lectura.

**Retorna**: `boolean`

### `getSystemModeInfo()`
Obtiene información detallada del modo actual.

**Retorna**: 
```typescript
{
  mode: SystemMode,
  system_state: string,
  writable: boolean,
  read_only: boolean,
  stats: {
    total: number,
    active: number,
    degraded: number,
    broken: number
  },
  timestamp: string
}
```

### `getSystemModeDescription()`
Obtiene una descripción legible del modo actual.

**Retorna**: `string`

### `isSystemInMode(targetMode)`
Verifica si el sistema está en un modo específico.

**Parámetros**:
- `targetMode`: `'NORMAL' | 'DEGRADED' | 'SAFE' | 'BROKEN'`

**Retorna**: `boolean`

## Manejo de Errores

Si el Coherence Engine falla:
- El sistema asume modo `BROKEN` por seguridad
- Se registra un error en los logs
- Se bloquea la escritura automáticamente

## Limitaciones Actuales

Los System Modes v1:
- ✅ Derivar modo desde Coherence Engine
- ✅ Indicar capacidades (lectura/escritura)
- ✅ Proporcionar información detallada
- ❌ NO implementan UI
- ❌ NO implementan overrides manuales
- ❌ NO bloquean operaciones reales (solo indican)

## Próximos Pasos

Futuras versiones podrían incluir:
1. **UI Dashboard**: Visualización del modo actual
2. **Overrides Manuales**: Permitir forzar modo SAFE
3. **Bloqueos Reales**: Bloquear operaciones en modo BROKEN
4. **Alertas**: Notificaciones cuando el modo cambia
5. **Historial**: Registro de cambios de modo

## Archivos Relacionados

- `src/core/system/system-modes.js`: Módulo principal
- `src/core/coherence/coherence-engine.js`: Coherence Engine
- `src/core/contracts/contract-registry.js`: Contract Registry
- `scripts/test-system-modes.js`: Script de prueba

## Testing

Para probar los System Modes:

```bash
node scripts/test-system-modes.js
```

Este script muestra:
- Modo actual del sistema
- Capacidades (lectura/escritura)
- Información detallada
- Verificación de modos específicos
- Matriz de decisiones

---

**Versión**: 1.0.0  
**Fecha**: 2025-01-20  
**Autor**: Sistema AuriPortal

