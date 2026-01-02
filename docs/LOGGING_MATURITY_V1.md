# Logging Maturity v1 - AuriPortal

## Filosofía de Logs

AuriPortal implementa un sistema de logging maduro que:

- **NO silencia errores reales** - Los errores reales deben ser visibles y accionables
- **Clasifica correctamente** - ERROR / WARN / INFO / DEBUG según severidad
- **Separa dominios lógicos** - Cada log pertenece a un dominio canónico
- **Es confiable en PROD** - Los logs en producción son limpios y accionables

## Dominios Lógicos Canónicos

Todo log DEBE pertenecer a UN dominio lógico. Los dominios canónicos son:

- `[ADMIN]` - Operaciones del dominio Admin
- `[MASTER]` - Operaciones del dominio Master
- `[CLIENT]` - Operaciones del dominio Cliente (Student Portal)
- `[ENTRY_GATE]` - Resolución de contexto de entrada (hosts, routing)
- `[PUBLIC_ASSETS]` - Carga y gestión de assets públicos
- `[FORENSIC]` - Logs de diagnóstico y auditoría
- `[STUDENT]` - Operaciones relacionadas con estudiantes
- `[PRACTICE]` - Operaciones relacionadas con prácticas
- `[PAUSA]` - Operaciones relacionadas con pausas
- `[STREAK]` - Operaciones relacionadas con rachas
- `[AUDIT]` - Auditorías del sistema

Si un log no pertenece a ningún dominio canónico, es un **bug de logging**.

## Niveles de Log

### ERROR
- **Cuándo usar**: Rompe ejecución o viola contrato
- **Ejemplos**: 
  - Errores de base de datos
  - Handlers que devuelven tipos incorrectos
  - Violaciones de invariantes estructurales
- **En PROD**: Siempre visible
- **Stacktrace**: Solo en modo FORENSIC o DEV

### WARN
- **Cuándo usar**: Estado incompleto / esperado / roadmap
- **Ejemplos**:
  - Integraciones opcionales no configuradas
  - Rutas legacy clasificadas
  - Asserts estructurales en PROD (ADMIN_RENDER_OUTSIDE_RESOLVER)
- **En PROD**: Visible, pero no bloquea
- **Stacktrace**: No (solo mensaje estructurado)

### INFO
- **Cuándo usar**: Información operativa
- **Ejemplos**:
  - Hosts desconocidos (bots, IPs directas)
  - Operaciones exitosas críticas
  - Cambios de estado importantes
- **En PROD**: Solo si se fuerza explícitamente (`force: true`)
- **En DEV/BETA**: Siempre visible

### DEBUG
- **Cuándo usar**: Información de diagnóstico detallada
- **Ejemplos**:
  - Trazado de flujos complejos
  - Valores intermedios de cálculos
  - Estados internos de componentes
- **En PROD**: Nunca visible
- **En FORENSIC**: Visible con `DEBUG_FORENSIC=1`

## Diferencia PROD vs FORENSIC

### PROD (Producción)
- **Objetivo**: Logs limpios, accionables, sin ruido
- **Características**:
  - ERROR: Visible con stacktrace truncado
  - WARN: Visible sin stacktrace
  - INFO: Solo si se fuerza explícitamente
  - DEBUG: Nunca visible
- **Asserts estructurales**: WARN + FORENSIC (no ERROR repetitivo)

### FORENSIC (Diagnóstico)
- **Activación**: `DEBUG_FORENSIC=1`
- **Objetivo**: Diagnóstico completo y trazabilidad
- **Características**:
  - ERROR: Stacktrace completo
  - WARN: Detalles completos
  - INFO: Siempre visible
  - DEBUG: Visible
- **Asserts estructurales**: ERROR completo con stacktrace

## Cómo Leer los Logs

### Formato Estructurado (JSON)
Todos los logs se emiten en formato JSON por línea:

```json
{
  "timestamp": "2025-01-XX...",
  "level": "ERROR",
  "domain": "ADMIN",
  "message": "renderAdminPage llamado fuera de contexto",
  "env": "prod",
  "version": "5.32.6",
  "build": "abc123",
  "request_id": "req_1234567890_xyz",
  "code": "ADMIN_RENDER_OUTSIDE_RESOLVER",
  "trace_id": "req_1234567890_xyz"
}
```

### Formato Legible (DEV/BETA/FORENSIC)
En entornos de desarrollo, también se muestra formato legible:

```
❌ [ADMIN] renderAdminPage llamado fuera de contexto | {"code":"ADMIN_RENDER_OUTSIDE_RESOLVER","trace_id":"req_1234567890_xyz"}
```

## Qué es Error Real y Qué No

### ❌ ERRORES REALES (Deben ser visibles)
- Errores de base de datos (conexión, queries)
- Handlers que devuelven tipos incorrectos
- Violaciones de contratos (APIs que devuelven HTML)
- Errores de autenticación críticos
- Fallos en Source of Truth

### ✅ NO SON ERRORES (No deben aparecer como ERROR)
- Hosts desconocidos (bots, IPs directas) → INFO
- Integraciones opcionales no configuradas → INFO (no WARN)
- Rutas legacy clasificadas → No generar warnings
- Asserts estructurales en PROD → WARN + FORENSIC (no ERROR repetitivo)

## Comandos Habituales de Diagnóstico

### Ver logs en tiempo real
```bash
pm2 logs aurelinportal
```

### Ver últimas 200 líneas
```bash
pm2 logs aurelinportal --lines 200
```

### Ver solo errores
```bash
pm2 logs aurelinportal | grep ERROR
```

### Ver logs de un dominio específico
```bash
pm2 logs aurelinportal | grep "\[ADMIN\]"
```

### Ver logs en modo FORENSIC
```bash
DEBUG_FORENSIC=1 pm2 restart aurelinportal
pm2 logs aurelinportal
```

### Filtrar por trace_id
```bash
pm2 logs aurelinportal | grep "req_1234567890_xyz"
```

### Ver logs estructurados (JSON)
```bash
pm2 logs aurelinportal --json
```

### Rotación de logs
PM2 maneja rotación automática. Los logs se guardan en:
- `./logs/pm2-error.log` - Solo errores
- `./logs/pm2-out.log` - Salida estándar
- `./logs/pm2-combined.log` - Logs combinados

### Limpiar logs antiguos
```bash
# Limpiar logs de más de 7 días
find ./logs -name "*.log" -mtime +7 -delete

# O usar logrotate (recomendado para producción)
```

## Configuración de Rotación de Logs

### PM2 Logrotate (Recomendado)
```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

### Logrotate del Sistema (Alternativa)
Crear `/etc/logrotate.d/aurelinportal`:

```
/var/www/aurelinportal/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

## Mejores Prácticas

1. **Usar dominios canónicos**: Siempre especificar dominio al loguear
2. **No loguear INFO en PROD**: Solo si es crítico y se fuerza explícitamente
3. **Asserts estructurales**: WARN en PROD, ERROR en FORENSIC
4. **No repetir stacktraces**: Una vez por trace_id es suficiente
5. **Redactar datos sensibles**: El logger redacta automáticamente
6. **Usar trace_id**: Siempre incluir para correlación

## Ejemplos de Uso

### Log de Error
```javascript
import { logError } from '../core/observability/logger.js';

logError('ADMIN', 'Error al procesar request', {
  error: err.message,
  code: 'ADMIN_HANDLER_ERROR',
  route_key: 'admin-dashboard',
  path: '/admin'
});
```

### Log de Warning
```javascript
import { logWarn } from '../core/observability/logger.js';

logWarn('ENTRY_GATE', 'Host no reconocido', {
  host: 'unknown.example.com',
  note: 'Posible bot o acceso directo'
});
```

### Log de Info (forzado en PROD)
```javascript
import { logInfo } from '../core/observability/logger.js';

logInfo('ADMIN', 'Operación crítica completada', {
  operation: 'migration',
  records_processed: 1000
}, true); // force: true para PROD
```

### Log Canónico (JSON estructurado)
```javascript
import { logErrorCanonical } from '../core/observability/logger.js';

logErrorCanonical('admin_handler_error', {
  route_key: 'admin-dashboard',
  path: '/admin',
  method: 'GET',
  error_type: 'ADMIN_RENDER_OUTSIDE_RESOLVER',
  trace_id: getRequestId()
});
```

## Versión

**v1.0.0** - Logging Maturity v1
- Clasificación semántica por dominio
- Niveles correctos (ERROR/WARN/INFO/DEBUG)
- Diferencia PROD vs FORENSIC
- Rotación de logs configurada
- Documentación completa
