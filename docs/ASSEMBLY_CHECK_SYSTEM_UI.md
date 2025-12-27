# Assembly Check System (ACS) - UI y Semántica de Runs

## Propósito

El Assembly Check System (ACS) verifica el ensamblaje real de Admin UIs antes de que lleguen al usuario. La UI del ACS refleja fielmente el estado real del sistema, mostrando solo resultados completados y verificados.

---

## Semántica de Run

### Estados de Run

Un **run** es una ejecución completa de todos los checks registrados. Tiene tres estados posibles:

1. **`running`**: El run está en ejecución
   - Se crea cuando se inicia la ejecución
   - No es mostrable en la UI (resultados parciales)

2. **`completed`**: El run terminó exitosamente
   - Todos los checks se ejecutaron
   - Tiene resultados finales (OK, WARN, BROKEN)
   - **Solo runs `completed` son mostrables en la UI**

3. **`failed`**: El run falló durante la ejecución
   - Error crítico que impidió completar los checks
   - No es mostrable en la UI (no tiene resultados válidos)

### Reglas de Run

- **Un run tiene estado explícito**: `running | completed | failed`
- **Solo runs `completed` son mostrables**: La UI nunca muestra runs `running` o `failed`
- **Identificación clara del último run completed**: La UI muestra SOLO el último run con `status = 'completed'`
- **No mezcla histórico**: La UI no muestra múltiples runs, solo el último completado

---

## Comportamiento de la UI

### Vista Principal

La UI del ACS (`/admin/system/assembly`) muestra:

1. **Último Run Completado** (si existe):
   - **Run ID**: Identificador único del run (ej: `run-1234567890-abc123`)
   - **Fecha**: Fecha y hora de finalización (`completed_at`)
   - **Duración**: Tiempo total de ejecución (calculado como `completed_at - started_at`)
   - **Estado**: Siempre "✅ Completado" (solo se muestran runs completed)
   - **Resumen**: Total de checks, OK, WARN, BROKEN

2. **Tabla de Checks Registrados**:
   - Muestra todos los checks habilitados
   - **Estado**: Resultado del último run completed (OK, WARN, BROKEN, o "Sin ejecutar")
   - **Duración**: Tiempo de ejecución de cada check en el último run completed
   - Si no hay run completed, todos los checks muestran "Sin ejecutar"

### Botón "Ejecutar Assembly Check"

**Comportamiento**:

1. **Inicia ejecución**: Llama a `/admin/api/assembly/run` (POST)
2. **Espera a que termine**: Hace polling cada 2 segundos al endpoint `/admin/api/assembly/runs/:run_id`
3. **No muestra resultados parciales**: Mientras el run esté `running`, muestra "⏳ Ejecutando..."
4. **Refetch explícito**: Cuando el run pasa a `completed`, recarga la página automáticamente para mostrar resultados
5. **Timeout**: Si después de 60 intentos (2 minutos) el run no está `completed` o `failed`, recarga la página para verificar estado

**Reglas**:
- ✅ Espera a que el run termine (`status = 'completed'` o `'failed'`)
- ✅ No muestra resultados parciales
- ✅ Refetch explícito tras completar
- ❌ No muestra runs `running` en la UI
- ❌ No muestra runs `failed` en la UI

---

## Bypass de Autenticación (X-ACS-Check)

### Propósito

El ACS usa un bypass de autenticación canónico para ejecutar checks sin requerir sesión de admin real.

### Implementación

El header `X-ACS-Check: true` permite que `validateAdminSession()` permita la ejecución sin autenticación real.

**Ubicación**: `src/core/assembly/assembly-check-engine.js` (línea 125)

```javascript
const mockRequest = new Request(`http://localhost${check.route_path}`, {
  method: 'GET',
  headers: {
    'Cookie': 'admin_session=test-session',
    'X-ACS-Check': 'true' // Header especial para bypass de autenticación
  }
});
```

### Seguridad

Este bypass es **seguro** porque:
- ✅ Solo se usa en el contexto del ACS (checks internos)
- ✅ No afecta la seguridad de rutas reales
- ✅ Permite verificar el ensamblaje correcto de las pantallas
- ✅ Los handlers reales siguen requiriendo autenticación normal

**NOTA**: Este bypass es intencional y canónico. No es un hack, es parte del diseño del ACS.

---

## Flujo de Ejecución

```
Usuario hace clic en "Ejecutar Assembly Check"
  ↓
POST /admin/api/assembly/run
  ↓
runAssemblyChecks() crea run con status='running'
  ↓
Ejecuta todos los checks habilitados
  ↓
Guarda resultados en assembly_check_results
  ↓
Actualiza run con status='completed' y estadísticas
  ↓
UI hace polling hasta que run.status === 'completed'
  ↓
UI recarga página automáticamente
  ↓
UI muestra último run completed con resultados
```

---

## Repositorio de Datos

### Funciones Clave

**`getLastCompletedRun()`**: 
- Obtiene el último run con `status = 'completed'`
- Ordenado por `completed_at DESC`
- Retorna `null` si no hay runs completados

**`getResultsByRunId(runId)`**:
- Obtiene todos los resultados de un run específico
- Incluye información del check (ui_key, route_path, display_name)

### Tablas PostgreSQL

- **`assembly_check_runs`**: Ejecuciones de checks
- **`assembly_check_results`**: Resultados individuales de cada check
- **`assembly_checks`**: Definición de checks registrados

---

## Verificación de Resultados

### Catalog Registry

El check `catalog-registry` debe aparecer como **OK** si:
- ✅ La ruta `/admin/pde/catalog-registry` existe en Admin Route Registry
- ✅ El handler se importa correctamente
- ✅ El HTML no está vacío
- ✅ No hay placeholders sin resolver
- ✅ El sidebar está presente (si `expected_sidebar = true`)

### Coincidencia UI vs Engine

La UI muestra exactamente lo que el engine ejecutó:
- ✅ Los resultados en la tabla de checks provienen del último run completed
- ✅ Los contadores (OK, WARN, BROKEN) coinciden con el run
- ✅ No hay discrepancias entre lo ejecutado y lo mostrado

---

## Reglas de Diseño

1. **NO bajar exigencia del ACS**: Los checks siguen siendo estrictos
2. **NO silenciar checks**: Todos los problemas se reportan
3. **NO hacks**: Todo es canónico y bien diseñado
4. **UI simple pero inequívoca**: Muestra solo lo necesario, de forma clara

---

## Troubleshooting

### La UI no muestra resultados

**Causa**: No hay runs `completed` en la base de datos.

**Solución**: Ejecutar un Assembly Check y esperar a que termine.

### El botón se queda en "Ejecutando..."

**Causa**: El run está tardando más de 2 minutos o hay un error.

**Solución**: La UI recargará automáticamente después del timeout. Verificar logs del servidor si persiste.

### Los resultados no coinciden con la ejecución

**Causa**: La UI está mostrando un run antiguo.

**Solución**: La UI siempre muestra el último run `completed`. Si hay discrepancias, verificar que el run más reciente tenga `status = 'completed'` en la base de datos.

---

## Cambios Implementados (2024)

### Normalización del Concepto de Run

- ✅ Un run tiene estado explícito: `running | completed | failed`
- ✅ Solo runs `completed` son mostrables
- ✅ Identificación clara del último run completed

### Modificaciones en la UI

- ✅ Mostrar SOLO el último run completed
- ✅ No mezclar histórico (eliminada tabla de múltiples runs)
- ✅ Mostrar ID, fecha y duración del run
- ✅ Refrescar tras ejecutar un run

### Ajustes en el Botón

- ✅ Esperar a que termine el run (polling)
- ✅ No mostrar resultados parciales
- ✅ Refetch explícito tras completar

### Verificación

- ✅ catalog-registry aparece como OK
- ✅ Resultados coinciden con ejecución real
- ✅ No hay discrepancias UI vs engine

---

**Última actualización**: 2024
**Versión**: ACS UI v1.0



