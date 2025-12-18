# 🎯 Entrega: Sistema de Progreso V4 (Motor Único)

## 📋 Resumen

Reconstrucción completa del sistema de PROGRESO (nivel + fase) siguiendo principios arquitectónicos sólidos:
- **Single source of truth**: Un único módulo calcula progreso
- **Separación clara**: nivel_base (calculado) vs overrides (Master) vs nivel_efectivo (consumo)
- **Fail-open controlado**: Fallbacks seguros con logs estructurados
- **Auditable y reversible**: Sistema de overrides con historial completo

---

## 📁 Archivos Creados/Modificados

### ✅ Archivos Nuevos

1. **`src/core/progress-engine.js`** (233 líneas)
   - Motor único de cálculo de progreso
   - Función `computeProgress()` que calcula nivel_base, aplica overrides y resuelve fase_efectiva
   - Fail-open controlado con fallbacks seguros

2. **`src/infra/repos/nivel-override-repo-pg.js`** (150 líneas)
   - Repositorio PostgreSQL para overrides de nivel
   - Operaciones: create, revoke, findByStudent, getActiveOverride
   - Sigue patrón de repos existentes (pausa-repo-pg.js)

3. **`scripts/progress/recompute-all.js`** (150 líneas)
   - Script para recalcular progreso de todos los alumnos
   - Modo dry-run (por defecto) y modo --apply
   - Muestra diferencias y estadísticas

4. **`tests/progress-engine.test.js`** (150 líneas)
   - Tests mínimos para casos críticos
   - Casos: sin pausas/overrides, con pausa, override ADD, override SET, fallback

### ✅ Archivos Modificados

5. **`database/pg.js`**
   - Añadida tabla `nivel_overrides` en `createTables()`
   - Campos: id, student_id, student_email, type, value, reason, created_by, created_at, revoked_at, revoked_by
   - Índices para búsquedas rápidas

6. **`src/core/student-context.js`**
   - Reemplazado `getNivelInfo()` por `computeProgress()`
   - Construye `nivelInfo` compatible con código existente
   - Mantiene compatibilidad con UI existente

---

## 🗄️ Esquema de Base de Datos

### Tabla: `nivel_overrides`

```sql
CREATE TABLE IF NOT EXISTS nivel_overrides (
  id SERIAL PRIMARY KEY,
  student_id INTEGER REFERENCES alumnos(id) ON DELETE CASCADE,
  student_email VARCHAR(255),
  type VARCHAR(10) NOT NULL CHECK (type IN ('ADD', 'SET', 'MIN')),
  value INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_by VARCHAR(255) DEFAULT 'system',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP,
  revoked_by VARCHAR(255)
);
```

**Tipos de override:**
- `ADD`: Suma valor al nivel_base (ej: nivel_base=5, ADD+2 → nivel_efectivo=7)
- `SET`: Fija nivel_efectivo a un valor específico (ej: SET 10 → nivel_efectivo=10)
- `MIN`: Establece nivel mínimo (ej: nivel_base=3, MIN 5 → nivel_efectivo=5)

---

## 🧪 Cómo Probar

### 1. Verificar que la tabla se creó correctamente

```bash
# Conectar a PostgreSQL
psql -U postgres -d aurelinportal

# Verificar tabla
\d nivel_overrides

# Verificar que existe
SELECT COUNT(*) FROM nivel_overrides;
```

### 2. Probar cálculo de progreso (3 curls)

#### Test 1: Alumno sin overrides
```bash
curl -X GET "http://localhost:3000/enter" \
  -H "Cookie: auriportal_session=<cookie_de_alumno_sin_override>"
```
**Esperado**: `nivel_efectivo = nivel_base` (calculado por días activos)

#### Test 2: Crear override ADD para un alumno
```bash
# Primero, obtener ID del alumno desde DB
psql -U postgres -d aurelinportal -c "SELECT id, email FROM alumnos LIMIT 1;"

# Insertar override (reemplazar <alumno_id> y <email>)
psql -U postgres -d aurelinportal -c "
INSERT INTO nivel_overrides (student_id, student_email, type, value, reason, created_by)
VALUES (<alumno_id>, '<email>', 'ADD', 2, 'Test override', 'master');
"

# Luego probar
curl -X GET "http://localhost:3000/enter" \
  -H "Cookie: auriportal_session=<cookie_del_alumno>"
```
**Esperado**: `nivel_efectivo = nivel_base + 2`

#### Test 3: Crear override SET
```bash
# Insertar override SET
psql -U postgres -d aurelinportal -c "
INSERT INTO nivel_overrides (student_id, student_email, type, value, reason, created_by)
VALUES (<alumno_id>, '<email>', 'SET', 10, 'Promoción manual', 'master');
"

# Probar
curl -X GET "http://localhost:3000/enter" \
  -H "Cookie: auriportal_session=<cookie_del_alumno>"
```
**Esperado**: `nivel_efectivo = 10` (independiente de nivel_base)

### 3. Probar script de recálculo

#### Modo dry-run (solo mostrar diferencias)
```bash
node scripts/progress/recompute-all.js
```

**Esperado**: Muestra diferencias entre nivel_actual en DB y nivel_efectivo calculado, sin aplicar cambios.

#### Modo apply (aplicar cambios)
```bash
node scripts/progress/recompute-all.js --apply
```

**Esperado**: Actualiza `nivel_actual` en DB para alumnos sin `nivel_manual`, respetando overrides.

### 4. Probar UI (2 pruebas)

#### Prueba 1: Verificar que nivel y fase se muestran correctamente
1. Acceder a `/enter` con un alumno autenticado
2. Verificar que se muestra:
   - Nivel correcto (nivel_efectivo)
   - Fase correcta (fase_efectiva desde niveles_energeticos)
   - Nombre del nivel

#### Prueba 2: Verificar que override se refleja en UI
1. Crear override para un alumno (ver Test 2 arriba)
2. Acceder a `/enter` con ese alumno
3. Verificar que el nivel mostrado refleja el override

---

## 📊 Logs Estructurados

El motor de progreso genera logs estructurados con prefijo `[ProgressEngine]`:

- **INFO** (solo en dev/beta): Progreso calculado exitosamente
- **WARN**: Errores controlados (fallbacks, config faltante, overrides inválidos)

Ejemplo de log:
```
[ProgressEngine] Progreso calculado {
  student_id: 123,
  nivel_base: 5,
  nivel_efectivo: 7,
  fase_efectiva: 'sanación avanzada',
  dias_activos: 180,
  tiene_overrides: true
}
```

---

## 🔄 Migración y Seguridad

### Script de Recálculo

El script `scripts/progress/recompute-all.js` permite:

1. **Dry-run** (por defecto): Solo muestra diferencias sin aplicar cambios
2. **Apply mode** (`--apply`): Aplica cambios solo a alumnos sin `nivel_manual`

**Reglas de seguridad:**
- Nunca sobrescribe `nivel_manual` (respetado explícitamente)
- Solo actualiza `nivel_actual` si hay diferencia
- Logs detallados de cada cambio

### Reversibilidad

Los overrides son **reversibles** mediante soft delete:
```sql
UPDATE nivel_overrides 
SET revoked_at = CURRENT_TIMESTAMP, revoked_by = 'master'
WHERE id = <override_id>;
```

---

## ✅ Criterios de Aceptación Verificados

- ✅ El nivel y fase que ve el alumno vienen del motor único (`computeProgress`)
- ✅ El admin puede "promocionar" a un alumno sin romper el cálculo normal (overrides)
- ✅ Recalcular es posible y consistente (misma entrada => misma salida)
- ✅ Cero lógica duplicada de nivel/fase en UI (solo consume `ctx.nivelInfo`)
- ✅ Cambios mínimos, auditables, reversibles

---

## 📝 Commit Message

```
feat(progress): Motor único de cálculo de progreso con overrides del Master

Reconstrucción completa del sistema de PROGRESO (nivel + fase) siguiendo
principios arquitectónicos sólidos:

- Single source of truth: src/core/progress-engine.js
- Separación clara: nivel_base (calculado) vs overrides (Master) vs nivel_efectivo
- Fail-open controlado: fallbacks seguros con logs estructurados
- Sistema de overrides auditables y reversibles

Archivos nuevos:
- src/core/progress-engine.js: Motor único de cálculo
- src/infra/repos/nivel-override-repo-pg.js: Repositorio de overrides
- scripts/progress/recompute-all.js: Script de recálculo masivo
- tests/progress-engine.test.js: Tests mínimos

Archivos modificados:
- database/pg.js: Tabla nivel_overrides añadida
- src/core/student-context.js: Integración con progress-engine

Cambios:
- buildStudentContext ahora usa computeProgress() en lugar de getNivelInfo()
- Overrides del Master: tipos ADD, SET, MIN con auditoría completa
- Fase efectiva resuelta desde niveles_energeticos (config del Admin)
- Script de recálculo con modo dry-run y apply

Breaking changes: Ninguno (compatible con código existente)

Tests: tests/progress-engine.test.js con casos críticos
```

---

## 🚀 Próximos Pasos (Opcional)

1. **Endpoint Admin para gestionar overrides**: Crear UI en `/admin/nivel-overrides`
2. **Historial de overrides**: Mostrar historial completo de cambios
3. **Validaciones adicionales**: Límites de overrides por alumno, razones requeridas
4. **Notificaciones**: Notificar al alumno cuando se aplica un override

---

## 📝 Mejoras Post-Entrega: Validación de `niveles_energeticos`

### Cambios Implementados

1. **Schema/Validador**: `src/core/config/niveles-energeticos.schema.js`
   - Valida estructura, tipos, rangos, solapamientos
   - Normaliza tipos (strings → números) y ordena
   - Retorna `{ ok, value, errors }`

2. **Motor integrado**: `progress-engine.js` valida antes de resolver fase
   - Si inválida: `fase_efectiva = 'unknown'` + log estructurado
   - Si válida: usa `resolveFaseFromConfig()` normalizado

3. **Endpoints admin actualizados**:
   - `GET /admin/niveles-energeticos`: muestra estado validación
   - `POST /admin/niveles-energeticos`: valida antes de guardar (400 si inválida)

4. **UI admin mejorada**: validación live, botón deshabilitado si inválida

5. **Tests**: `tests/config/niveles-energeticos.schema.test.js` cubre casos críticos

### Principio Arquitectónico

**`niveles_energeticos` es el single source of truth para `fase_efectiva`**:
- Config inválida → fail-open con fase unknown (observabilidad)
- Config válida → fase resuelta desde config normalizada
- No hay lógica duplicada fuera del motor

---

---

## 📝 Decisiones Arquitectónicas Documentadas

### DELETE ALL + INSERT en Admin de Niveles Energéticos

El endpoint `POST /admin/niveles-energeticos` usa la estrategia **DELETE ALL + INSERT** para guardar la configuración.

**Razón**: La configuración es GLOBAL y ÚNICA (no hay versionado ni preview por entorno). Cada guardado reemplaza completamente la configuración anterior.

**Ventajas**:
- Simplicidad: No requiere diff, merge o detección de cambios
- Consistencia: Garantiza que la BD refleja exactamente lo guardado
- Transaccional: Todo o nada (BEGIN/COMMIT/ROLLBACK)

**Limitaciones**:
- No permite versionado histórico
- No permite preview por entorno (dev/beta/prod)
- No permite rollback granular

**Futuro**: Si se necesita versionado o preview por entorno, se puede implementar siguiendo el patrón de UI Experience System (tablas versionadas + `ui_active_config`).

Esta decisión es **consciente, reversible y documentada** en `src/endpoints/admin-niveles-energeticos.js`.

---

## 📝 Nota sobre Nomenclatura

**`niveles_energeticos` es el nombre canónico** para la configuración de fases y rangos de nivel.
Los formatos legacy (tabla `niveles_fases` en BD) se normalizan internamente, pero el concepto
y la documentación usan siempre `niveles_energeticos` como single source of truth.

---

**Versión**: v4.8.0  
**Fecha**: 2024-12-19  
**Autor**: Sistema de Progreso V4

