# 📊 OBSERVABILIDAD V4 - Sistema de Logging Estructurado

## 🎯 Filosofía

El sistema de observabilidad de AuriPortal v4 proporciona **logs estructurados** que permiten:

- **Entender QUÉ ha pasado**: Eventos clave del sistema documentados
- **A QUIÉN le ha pasado**: Trazabilidad por alumno (ID, email)
- **EN QUÉ dominio**: Logs organizados por dominio (student, practice, pausa, streak, etc.)
- **SIN cambiar comportamiento**: Los logs son informativos, no afectan el flujo funcional
- **SIN dependencias externas**: Sistema autónomo, solo usa `console.log` estructurado

## 📁 Estructura

```
src/core/observability/
└── logger.js          # Módulo central de logging

src/modules/
├── student-v4.js       # Logs integrados
├── practice-v4.js      # Logs integrados
├── pausa-v4.js         # Logs integrados
└── streak-v4.js        # Logs integrados
```

## 🔧 Uso del Logger

### Importar el módulo

```javascript
import { logInfo, logWarn, logError, extractStudentMeta } from "../core/observability/logger.js";
```

### Funciones disponibles

#### `logInfo(domain, message, meta, force)`

Log informativo. Se muestra en DEV/BETA, en PROD solo si `force=true`.

```javascript
logInfo('student', 'Alumno creado', {
  alumno_id: 123,
  email: 'test@example.com',
  nivel: 1
});
```

#### `logWarn(domain, message, meta)`

Log de advertencia. Se muestra en todos los entornos.

```javascript
logWarn('practice', 'Práctica duplicada detectada', {
  alumno_id: 123,
  fecha: '2024-01-15'
});
```

#### `logError(domain, message, meta)`

Log de error. Se muestra en todos los entornos.

```javascript
logError('student', 'Error al actualizar nivel', {
  alumno_id: 123,
  error: err.message,
  stack: err.stack
});
```

#### `extractStudentMeta(student)`

Helper para extraer metadatos estándar de un alumno.

```javascript
const meta = extractStudentMeta(student);
// Retorna: { alumno_id, email, nivel, streak, estado_suscripcion }
```

## 📋 Formato de Logs

Todos los logs se emiten en formato **JSON estructurado**:

```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "level": "INFO",
  "domain": "student",
  "message": "Alumno creado",
  "env": "dev",
  "version": "4.0.0",
  "build": "abc123",
  "alumno_id": 123,
  "email": "test@example.com",
  "nivel": 1
}
```

### Campos estándar

- `timestamp`: ISO 8601 timestamp
- `level`: `INFO`, `WARN`, `ERROR`
- `domain`: Dominio del log (student, practice, pausa, streak, etc.)
- `message`: Mensaje descriptivo
- `env`: Entorno (dev, beta, prod)
- `version`: Versión de la aplicación (desde package.json)
- `build`: Build ID (git commit hash o timestamp)

### Campos de metadatos (opcionales)

Los metadatos pueden incluir cualquier información relevante:

- `alumno_id`: ID del alumno
- `email`: Email del alumno
- `nivel`: Nivel actual del alumno
- `streak`: Racha actual
- `estado_suscripcion`: Estado de la suscripción
- `practica_id`: ID de práctica
- `pausa_id`: ID de pausa
- `fecha`: Fecha del evento
- `error`: Mensaje de error
- `stack`: Stack trace (solo para errores)

## 🌍 Verbosidad por Entorno

### DEV (desarrollo)
- ✅ `INFO`: Todos los logs informativos
- ✅ `WARN`: Advertencias
- ✅ `ERROR`: Errores
- Formato: JSON + formato legible en consola

### BETA (staging)
- ✅ `INFO`: Logs informativos críticos
- ✅ `WARN`: Advertencias
- ✅ `ERROR`: Errores
- Formato: JSON + formato legible en consola

### PROD (producción)
- ❌ `INFO`: Solo si se fuerza explícitamente (`force=true`)
- ✅ `WARN`: Advertencias
- ✅ `ERROR`: Errores
- Formato: Solo JSON (mejor para parsing)

## 📊 Logs por Dominio

### `student` - Gestión de Alumnos

**Eventos logueados:**

1. **Creación de alumno**
   ```json
   {
     "domain": "student",
     "message": "Alumno creado",
     "alumno_id": 123,
     "email": "test@example.com",
     "nivel": 1,
     "fecha_inscripcion": "2024-01-15T10:30:45.123Z"
   }
   ```

2. **Actualización de nivel**
   ```json
   {
     "domain": "student",
     "message": "Nivel actualizado",
     "alumno_id": 123,
     "nivel_anterior": 5,
     "nivel_nuevo": 6
   }
   ```

3. **Actualización de streak**
   ```json
   {
     "domain": "student",
     "message": "Streak actualizado",
     "alumno_id": 123,
     "streak_anterior": 10,
     "streak_nuevo": 11
   }
   ```

4. **Cambio de estado de suscripción**
   ```json
   {
     "domain": "student",
     "message": "Estado de suscripción actualizado",
     "alumno_id": 123,
     "estado_anterior": "activa",
     "estado_nuevo": "pausada",
     "fecha_reactivacion": null
   }
   ```

### `practice` - Gestión de Prácticas

**Eventos logueados:**

1. **Creación de práctica**
   ```json
   {
     "domain": "practice",
     "message": "Práctica creada",
     "alumno_id": 123,
     "practica_id": 456,
     "fecha": "2024-01-15T00:00:00.000Z",
     "tipo": "general",
     "origen": "portal"
   }
   ```

2. **Detección de práctica duplicada**
   ```json
   {
     "domain": "practice",
     "level": "WARN",
     "message": "Práctica duplicada detectada",
     "alumno_id": 123,
     "practica_id": 456,
     "fecha": "2024-01-15"
   }
   ```

### `pausa` - Gestión de Pausas

**Eventos logueados:**

1. **Creación de pausa**
   ```json
   {
     "domain": "pausa",
     "message": "Pausa creada",
     "alumno_id": 123,
     "pausa_id": 789,
     "inicio": "2024-01-15T10:30:45.123Z",
     "fin": null
   }
   ```

2. **Cierre de pausa**
   ```json
   {
     "domain": "pausa",
     "message": "Pausa cerrada",
     "pausa_id": 789,
     "alumno_id": 123,
     "fin": "2024-01-20T10:30:45.123Z"
   }
   ```

3. **Detección de pausa activa** (solo DEV/BETA)
   ```json
   {
     "domain": "pausa",
     "message": "Pausa activa detectada",
     "alumno_id": 123,
     "pausa_id": 789,
     "inicio": "2024-01-15T10:30:45.123Z"
   }
   ```

### `streak` - Gestión de Rachas

**Eventos logueados:**

1. **Primera práctica**
   ```json
   {
     "domain": "streak",
     "message": "Primera práctica registrada",
     "alumno_id": 123,
     "streak": 1,
     "fecha": "2024-01-15T00:00:00.000Z"
   }
   ```

2. **Incremento de streak**
   ```json
   {
     "domain": "streak",
     "message": "Streak incrementado",
     "alumno_id": 123,
     "streak_anterior": 10,
     "streak_nuevo": 11,
     "es_milestone": false
   }
   ```

3. **Reset de streak (racha rota)**
   ```json
   {
     "domain": "streak",
     "message": "Streak reseteado (racha rota)",
     "alumno_id": 123,
     "streak_anterior": 15,
     "streak_nuevo": 1,
     "dias_desde_ultima": 3
   }
   ```

4. **Bloqueo por suscripción pausada**
   ```json
   {
     "domain": "streak",
     "level": "WARN",
     "message": "Streak bloqueado por suscripción pausada",
     "alumno_id": 123,
     "razon": "Suscripción pausada"
   }
   ```

## 🔍 Cómo Usar los Logs para Depurar

### Problema: Nivel mal calculado

**Búsqueda:**
```bash
# Buscar logs de actualización de nivel
grep '"domain":"student".*"message":"Nivel actualizado"' logs.txt | jq
```

**Análisis:**
1. Verificar `nivel_anterior` y `nivel_nuevo`
2. Buscar logs de `getDiasActivos` (si están disponibles)
3. Verificar logs de pausas que puedan afectar el cálculo

### Problema: Streak incorrecto

**Búsqueda:**
```bash
# Buscar logs de streak para un alumno específico
grep '"alumno_id":123.*"domain":"streak"' logs.txt | jq
```

**Análisis:**
1. Verificar secuencia de incrementos/resets
2. Buscar bloqueos por suscripción pausada
3. Verificar fechas de prácticas

### Problema: Pausa no detectada

**Búsqueda:**
```bash
# Buscar logs de pausas para un alumno
grep '"alumno_id":123.*"domain":"pausa"' logs.txt | jq
```

**Análisis:**
1. Verificar creación de pausa
2. Verificar cierre de pausa
3. Verificar detección de pausa activa

### Problema: Práctica duplicada

**Búsqueda:**
```bash
# Buscar advertencias de prácticas duplicadas
grep '"domain":"practice".*"level":"WARN"' logs.txt | jq
```

**Análisis:**
1. Verificar `alumno_id` y `fecha`
2. Verificar si hay múltiples creaciones en la misma fecha
3. Revisar lógica de detección de duplicados

## ✅ Buenas Prácticas

### ✅ QUÉ Loguear

- **Eventos de negocio críticos**: Creación de alumnos, actualización de niveles, cambios de estado
- **Operaciones que modifican estado**: Actualizaciones de streak, creación de prácticas
- **Detección de anomalías**: Prácticas duplicadas, pausas activas
- **Errores y advertencias**: Siempre loguear errores con contexto

### ❌ QUÉ NO Loguear

- **Operaciones de lectura simples**: `findStudentByEmail`, `findByAlumnoId` (a menos que sea crítico)
- **Información sensible**: Contraseñas, tokens, datos personales sensibles
- **Logs excesivamente verbosos**: Evitar logs en bucles o funciones llamadas frecuentemente
- **Información redundante**: No loguear lo que ya está en la base de datos

### 📝 Recomendaciones

1. **Usar metadatos descriptivos**: Incluir información suficiente para reconstruir el contexto
2. **Mensajes claros**: El mensaje debe ser autoexplicativo
3. **Incluir IDs**: Siempre incluir `alumno_id` cuando aplique
4. **Valores antes/después**: Para actualizaciones, incluir valores anteriores y nuevos
5. **Fechas en ISO 8601**: Usar formato estándar para fechas

## 🚀 Ejemplos de Uso

### Ejemplo 1: Log de creación de práctica

```javascript
import { logInfo } from "../core/observability/logger.js";

export async function crearPractica(practicaData) {
  const practica = await repo.create(practicaData);
  
  logInfo('practice', 'Práctica creada', {
    alumno_id: practicaData.alumno_id,
    practica_id: practica.id,
    fecha: practicaData.fecha.toISOString(),
    tipo: practicaData.tipo
  });
  
  return practica;
}
```

### Ejemplo 2: Log de error con contexto

```javascript
import { logError, extractStudentMeta } from "../core/observability/logger.js";

try {
  await updateStudentNivel(email, nivel);
} catch (err) {
  logError('student', 'Error al actualizar nivel', {
    ...extractStudentMeta(student),
    nivel_intentado: nivel,
    error: err.message,
    stack: err.stack
  });
  throw err;
}
```

### Ejemplo 3: Log condicional (solo en dev/beta)

```javascript
import { logInfo } from "../core/observability/logger.js";

const pausa = await getPausaActiva(alumnoId);
if (pausa) {
  const env = process.env.APP_ENV || 'prod';
  if (env === 'dev' || env === 'beta') {
    logInfo('pausa', 'Pausa activa detectada', {
      alumno_id: alumnoId,
      pausa_id: pausa.id
    }, true); // Force log
  }
}
```

## 🔧 Configuración

El sistema de logging se configura automáticamente según `APP_ENV`:

```bash
# Desarrollo
APP_ENV=dev

# Staging
APP_ENV=beta

# Producción
APP_ENV=prod
```

Las variables `APP_VERSION` y `BUILD_ID` se establecen automáticamente en `server.js` al arrancar.

## 📈 Próximos Pasos (NO Implementados)

Estas mejoras están fuera del alcance de V4 pero pueden considerarse para futuras versiones:

1. **Correlación por request**: Generar `request_id` único por request HTTP
2. **Métricas agregadas**: Contadores de eventos por dominio
3. **Exportación a servicios externos**: Envío a sistemas de logging centralizados
4. **Dashboards**: Visualización de logs en tiempo real
5. **Alertas automáticas**: Notificaciones basadas en patrones de logs

## 📚 Referencias

- **Arquitectura V4**: Ver `AUDITORIA_ARQUITECTURA.md`
- **Refactorización de dominios**: Ver `REFACTORIZACION_*.md`
- **Configuración de entornos**: Ver `IMPLEMENTACION_ENTORNOS.md`

---

**Versión**: 4.0.0  
**Fecha**: 2024-01-15  
**Autor**: Sistema de Observabilidad AuriPortal














