# Principios Inmutables de AuriPortal

## Propósito

Este documento define la **columna vertebral estructural** de AuriPortal: un conjunto de principios, arquitecturas y reglas que son **NO NEGOCIABLES** y que protegen la integridad, seguridad y mantenibilidad del sistema.

El propósito de este documento es servir como **fuente de verdad canónica** que previene que cualquier evolución futura pueda romper los fundamentos del sistema. Cualquier propuesta de cambio que contradiga estos principios debe ser rechazada o refactorizada para respetarlos.

---

## Qué es la "Columna Vertebral"

La columna vertebral de AuriPortal está compuesta por los siguientes sistemas arquitectónicos fundamentales:

### 1. Contrato Único de Salida HTML (`renderHtml`)

**Ubicación**: `src/core/html-response.js`

**Definición**: Todas las respuestas HTML del sistema deben pasar por la función `renderHtml()`. Esta función centraliza:
- Aplicación de headers anti-cache correctos según entorno
- Aplicación automática de temas (dark/light) basado en preferencias del estudiante
- Garantía de consistencia en todas las respuestas HTML

**Regla**: Ningún endpoint debe retornar HTML directamente usando `new Response()`. Siempre debe usar `renderHtml()`.

### 2. Cache Busting Determinista

**Componentes**:
- `APP_VERSION`: Versión semántica desde `package.json` (ej: "4.0.0")
- `BUILD_ID`: Git commit hash corto (o timestamp si no hay git)
- `/__version`: Endpoint que expone versión actual para monitoreo
- `versionAsset()`: Función que añade parámetros de versión a assets CSS/JS

**Ubicaciones**:
- `server.js`: Definición de APP_VERSION y BUILD_ID al inicio
- `src/core/asset-version.js`: Función `versionAsset()`
- `src/router.js`: Endpoint `/__version`

**Regla**: Todos los assets estáticos (CSS, JS) deben usar `versionAsset()` para garantizar cache busting cuando cambie la versión.

### 3. Autenticación Centralizada por Contexto

**Ubicación**: `src/core/auth-context.js`

**Componentes**:
- `requireStudentContext(request, env)`: Retorna contexto de estudiante o Response HTML (pantalla0)
- `requireAdminContext(request, env)`: Retorna contexto de admin o Response HTML (login admin)

**Principio Fundamental**: Los endpoints NO gestionan autenticación; solo consumen contexto.

**Regla**: Los endpoints deben llamar a `requireStudentContext` o `requireAdminContext` y verificar si el retorno es una `Response` (no autenticado) o un objeto contexto (autenticado). Si es Response, retornarlo directamente.

### 4. Separación Dominio / Infraestructura mediante Repositorios

**Definición**: La lógica de negocio (dominio) debe estar separada de la infraestructura (APIs externas, bases de datos, servicios).

**Ubicaciones**:
- `src/modules/`: Contiene la lógica de negocio pura (student, streak, nivel, suscripcion)
- `src/services/`: Contiene adaptadores de infraestructura (kajabi.js, clickup.js)
- `src/endpoints/`: Contiene handlers HTTP que coordinan módulos y servicios

**Regla**: Los módulos de dominio NO deben llamar directamente a APIs externas o escribir SQL. Deben recibir dependencias inyectadas (servicios, repositorios) o delegar la persistencia a capas de infraestructura.

### 5. Feature Flags como Mecanismo Obligatorio de Cambio

**Ubicación**: `src/core/flags/feature-flags.js`

**Estados**:
- `off`: Feature nunca activa (comportamiento por defecto seguro)
- `beta`: Feature activa solo en dev y beta (bloqueada en prod)
- `on`: Feature activa en todos los entornos

**Regla**: Cualquier cambio crítico que pueda afectar el comportamiento existente DEBE estar detrás de un feature flag. Los flags se activan mediante código y deploy (no mediante UI de admin en producción).

**Principio**: Lento, seguro, incremental. Primero `off`, luego `beta` en entorno de pruebas, finalmente `on` cuando está validado.

### 6. Simuladores Admin READ-ONLY

**Definición**: Los paneles administrativos que muestran datos o simulaciones deben ser READ-ONLY por defecto. Cualquier operación que modifique datos debe requerir autenticación explícita y confirmación.

**Ubicaciones**:
- `src/endpoints/admin-panel.js`: Panel de administración general
- `src/endpoints/sql-admin.js`: Panel SQL con capacidades de edición (requiere autenticación)

**Regla**: Los simuladores y vistas de datos no deben permitir modificaciones accidentales. Si requieren edición, debe haber una barrera explícita (login, confirmación, flags de seguridad).

### 7. Transacciones PostgreSQL para Flujos Críticos

**Definición**: Cualquier operación que modifique múltiples tablas relacionadas DEBE ejecutarse dentro de una transacción PostgreSQL.

**Regla**: Si una operación escribe en más de una tabla y la integridad de datos es crítica, usar transacciones con `BEGIN`, `COMMIT` y manejo de `ROLLBACK` en caso de error.

**Ejemplos de flujos críticos**:
- Creación de estudiante con datos iniciales en múltiples tablas
- Actualización de racha con registro de práctica
- Sincronización bidireccional que actualiza múltiples fuentes

### 8. Gestión Profesional de Secretos

**Componentes**:
- `.env`: Archivo con variables de entorno (nunca en versionado)
- `src/config/validate.js`: Función `validateEnvironmentVariables()` que valida configuración
- Sanitización: Los secretos nunca se exponen en logs, respuestas HTTP o código

**Reglas**:
- Ningún secreto debe estar hardcodeado en el código
- Ningún secreto debe aparecer en logs (usar `***` o truncado)
- Ningún secreto debe documentarse con valores reales
- La validación de variables de entorno se ejecuta al inicio del servidor

### 9. Git + CI + Tests + Versionado + Releases

**Definición**: El sistema debe seguir un flujo profesional de desarrollo:

- **Git**: Control de versiones con commits descriptivos
- **CI**: Integración continua que valida código antes de merge
- **Tests**: Suite de tests que valida funcionalidad crítica
- **Versionado**: Versiones semánticas (MAJOR.MINOR.PATCH)
- **Releases**: Releases etiquetadas y documentadas

**Regla**: Ningún código que rompa tests o que no pase validaciones de CI debe llegar a producción.

---

## Reglas Inmutables

Las siguientes reglas son **OBLIGATORIAS** y no pueden ser violadas:

### Regla 1: Acceso a Base de Datos

**Ningún endpoint escribe en la base de datos sin pasar por dominio o repositorio.**

Los endpoints NO deben ejecutar SQL directamente. Deben usar funciones de módulos (`src/modules/`) o repositorios que encapsulen la lógica de acceso a datos.

**Violación**: Un endpoint que ejecuta `db.query("INSERT INTO students ...")` directamente.

**Correcto**: Un endpoint que llama a `createStudent()` desde `src/modules/student-v4.js`.

### Regla 2: Feature Flags para Cambios Críticos

**Ningún cambio crítico se activa sin feature flag.**

Cambios críticos incluyen:
- Modificaciones en lógica de cálculo (racha, niveles, suscripciones)
- Cambios en flujos de autenticación
- Modificaciones en integraciones con APIs externas
- Cambios que afectan la persistencia de datos

**Violación**: Modificar directamente `checkDailyStreak()` sin feature flag.

**Correcto**: Crear `streak_calculo_v2` flag, implementar nueva lógica dentro del flag, activar gradualmente (off → beta → on).

### Regla 3: Simuladores para Lógica Nueva

**Ninguna lógica nueva se implementa sin posibilidad de simulación.**

Si una feature nueva calcula valores o genera datos, debe existir un modo de simulación que permita previsualizar resultados sin modificar datos reales.

**Violación**: Implementar cálculo de niveles sin modo de simulación.

**Correcto**: Implementar cálculo con modo `simulate: true` que retorna resultados sin escribir en DB.

### Regla 4: Transacciones para Operaciones Multi-Tabla

**Ninguna operación que modifica múltiples tablas se ejecuta sin transacción.**

Si una operación escribe en más de una tabla relacionada, debe usar transacciones PostgreSQL para garantizar atomicidad.

**Violación**: Actualizar tabla `students` y luego `practices` sin transacción (si falla la segunda, queda inconsistencia).

**Correcto**: Envolver ambas actualizaciones en `BEGIN ... COMMIT` con manejo de `ROLLBACK`.

### Regla 5: Secretos en Documentación

**Ningún secreto se documenta con valores reales.**

La documentación puede mostrar ejemplos con placeholders (ej: `CLICKUP_API_TOKEN=tu_token_aqui`) pero nunca valores reales de producción.

**Violación**: Documentar `CLICKUP_API_TOKEN=pk_abc123realvalue`.

**Correcto**: Documentar `CLICKUP_API_TOKEN=pk_tu_token_de_clickup` o usar `***` para mostrar formato.

### Regla 6: Compatibilidad y Versiones

**Ningún cambio rompe compatibilidad sin bump de versión MAJOR.**

Si un cambio rompe la API, los contratos de datos, o el comportamiento esperado de endpoints públicos, la versión debe incrementarse como MAJOR (ej: 4.0.0 → 5.0.0).

**Violación**: Cambiar formato de respuesta de `/enter` de HTML a JSON sin cambiar versión.

**Correcto**: Si se necesita cambiar formato, crear nuevo endpoint `/v5/enter` o incrementar versión MAJOR.

### Regla 7: Renderizado HTML Único

**Ninguna respuesta HTML se genera sin usar `renderHtml()`.**

Todos los endpoints que retornan HTML deben usar `renderHtml()` para garantizar headers correctos y aplicación de temas.

**Violación**: `return new Response(htmlString, { headers: { 'Content-Type': 'text/html' } })`.

**Correcto**: `return renderHtml(htmlString, { student: student })`.

### Regla 8: Autenticación Centralizada

**Ningún endpoint gestiona autenticación directamente.**

Los endpoints deben usar `requireStudentContext()` o `requireAdminContext()` y verificar si retornan Response (no autenticado) o contexto (autenticado).

**Violación**: Un endpoint que lee cookies directamente y verifica autenticación.

**Correcto**: Un endpoint que llama a `requireStudentContext()` y maneja el Response si no está autenticado.

---

## Qué SÍ se puede cambiar libremente

Los siguientes elementos son **evolutivos** y pueden modificarse sin restricciones arquitectónicas:

### 1. UI y Estilos

- Modificar HTML de pantallas (pantalla0, pantalla1, pantalla2, etc.)
- Cambiar estilos CSS
- Añadir nuevos componentes visuales
- Modificar layouts y diseño responsive

**Restricción única**: Debe seguir usando `renderHtml()` para el renderizado.

### 2. Copy y Contenido

- Mensajes de texto para usuarios
- Frases motivacionales
- Descripciones de temas
- Contenido educativo

### 3. Nuevos Módulos

- Crear nuevos módulos en `src/modules/` para nuevas funcionalidades
- Añadir nuevas funciones de negocio que no modifican sistemas existentes

**Restricción única**: Deben seguir el principio de separación dominio/infraestructura.

### 4. Nuevos Simuladores

- Crear nuevos paneles de simulación para previsualizar cálculos
- Añadir herramientas de visualización de datos

**Restricción única**: Deben ser READ-ONLY por defecto.

### 5. Nuevos Flujos Protegidos

- Crear nuevos endpoints que implementen funcionalidades adicionales
- Añadir nuevos flujos de usuario que no modifiquen flujos críticos existentes

**Restricción única**: Deben usar autenticación centralizada y seguir patrones de renderizado HTML.

### 6. Nuevas Integraciones

- Añadir nuevos servicios externos (APIs, webhooks, etc.)
- Crear nuevos adaptadores de infraestructura

**Restricción única**: Deben seguir separación dominio/infraestructura y no exponer secretos.

---

## Proceso para Añadir Algo Nuevo

Antes de implementar cualquier nueva funcionalidad, se debe verificar el siguiente checklist:

### Checklist Obligatorio

#### 1. ¿Está detrás de un feature flag?

- [ ] Si la funcionalidad es crítica o modifica comportamiento existente, debe tener un feature flag
- [ ] El flag comienza en estado `off`
- [ ] Se documenta el propósito del flag en `feature-flags.js`

#### 2. ¿Es reversible?

- [ ] Si se activa el flag y hay problemas, ¿se puede desactivar inmediatamente?
- [ ] ¿Hay un plan de rollback si algo falla?
- [ ] ¿Los datos pueden restaurarse a un estado anterior si es necesario?

#### 3. ¿Es observable?

- [ ] ¿Hay logs que permitan rastrear el comportamiento de la funcionalidad?
- [ ] ¿Se puede monitorear el impacto en producción?
- [ ] ¿Hay métricas o indicadores de éxito/fallo?

#### 4. ¿Es testeable?

- [ ] ¿Existen tests unitarios para la nueva funcionalidad?
- [ ] ¿Los tests cubren casos de éxito y error?
- [ ] ¿Los tests pasan en CI antes de merge?

#### 5. ¿Respeta contratos existentes?

- [ ] ¿No rompe la API de módulos existentes?
- [ ] ¿Mantiene compatibilidad con respuestas HTML existentes?
- [ ] ¿No modifica esquemas de base de datos sin migración?
- [ ] ¿Usa `renderHtml()` para HTML?
- [ ] ¿Usa autenticación centralizada?

#### 6. ¿Sigue separación de responsabilidades?

- [ ] ¿La lógica de negocio está en `src/modules/`?
- [ ] ¿La infraestructura está en `src/services/`?
- [ ] ¿Los endpoints solo coordinan y no contienen lógica de negocio?

#### 7. ¿Gestiona secretos correctamente?

- [ ] ¿No hay secretos hardcodeados?
- [ ] ¿Los secretos están en `.env`?
- [ ] ¿No se exponen secretos en logs o respuestas?

#### 8. ¿Usa transacciones si es necesario?

- [ ] Si modifica múltiples tablas, ¿usa transacciones PostgreSQL?
- [ ] ¿Hay manejo de rollback en caso de error?

---

## Filosofía de Evolución

AuriPortal sigue la filosofía:

**"Lento, seguro, incremental, reversible y auditado"**

### Lento

No hay prisa por implementar features. Es preferible tomar tiempo en diseño, validación y pruebas antes de desplegar a producción.

### Seguro

Todas las decisiones se toman pensando en la estabilidad del sistema. Si hay dudas, se elige la opción más conservadora.

### Incremental

Los cambios grandes se dividen en cambios pequeños. Cada cambio pequeño se valida antes de pasar al siguiente.

### Reversible

Cualquier cambio debe poder deshacerse. Ya sea mediante feature flags, migraciones de rollback, o restauración de código.

### Auditado

Todo cambio debe dejar rastro: commits en Git, logs en producción, documentación actualizada. Nada debe ocurrir sin registro.

---

## Vigencia y Autoridad

Este documento es **fuente de verdad estructural** de AuriPortal. Nada que lo contradiga debe aceptarse en el futuro sin una revisión arquitectónica explícita que justifique el cambio.

**Fecha de creación**: 2024

**Versión del documento**: 1.0

**Mantenimiento**: Este documento debe actualizarse cuando se añadan nuevos principios inmutables a la columna vertebral, pero los principios existentes no deben eliminarse sin consenso arquitectónico explícito.

---













