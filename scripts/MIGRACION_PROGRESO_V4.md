# 🔄 Guía de Migración Legacy → Progreso V4

## 📋 Objetivo

Realizar una migración controlada desde datos legacy hacia Progreso V4:
- Limpiar dependencia legacy
- Recalcular TODO el estado real del alumno usando Progreso V4
- Dejar el sistema preparado para apagar legacy en vistas y lógica

## ⚠️ PRINCIPIOS INMUTABLES

- `computeProgress()` NO se toca
- El cálculo SIEMPRE se hace desde Progreso V4
- Legacy solo alimenta datos base
- Todo debe ser auditable, reversible y con dry-run
- El servidor DEBE reiniciarse con PM2 después de la migración

## 📦 Datos Legacy que SÍ se Migran

ÚNICAMENTE estos datos legacy se usan como insumo:
- ✅ **email** del alumno
- ✅ **fecha_inscripcion** (fecha_inicio / created_at equivalente)
- ✅ **pausas** reales (rangos de fechas desde tabla `pausas`)
- ✅ **estado_suscripcion** (activo / pausado / cancelado)

## 🚫 Datos Legacy que NO se Migran

Estos datos se ignoran completamente:
- ❌ nivel_actual (legacy)
- ❌ nivel_manual (legacy)
- ❌ streak (legacy)
- ❌ Cualquier otro campo manual legacy

## 🚀 Operativa Obligatoria

### PASO 1: Ejecutar en Modo Dry-Run

**OBLIGATORIO**: Siempre ejecutar primero en modo `--dry-run` para revisar los resultados sin aplicar cambios.

```bash
cd /var/www/aurelinportal
node scripts/migrate-legacy-to-progreso-v4.js --dry-run
```

**Qué revisar en dry-run:**
- ✅ Total de alumnos procesados
- ✅ Alumnos con errores (revisar qué errores)
- ✅ Muestra de alumnos exitosos (verificar que los cálculos son correctos)
- ✅ Verificar que `nivel_base`, `nivel_efectivo` y `fase_efectiva` se calculan correctamente

**Si hay errores:**
- Revisar logs detallados
- Verificar que todos los alumnos tengan `fecha_inscripcion`
- Verificar que las pausas estén correctamente registradas
- Corregir datos antes de continuar

### PASO 2: Revisar Logs

Después del dry-run, revisar:
- Errores por alumno (si los hay)
- Validación de datos base (fecha_inscripcion, pausas, estado_suscripcion)
- Cálculos de progreso (nivel_base, nivel_efectivo, fase_efectiva)

**Ejemplo de salida esperada:**
```
═══════════════════════════════════════════════════════════
📊 RESUMEN DE MIGRACIÓN
═══════════════════════════════════════════════════════════
   Total alumnos: 150
   Procesados: 150
   Exitosos: 148
   Errores: 2
   Duración: 45.32s
   Modo: DRY-RUN
═══════════════════════════════════════════════════════════
```

### PASO 3: Ejecutar en Modo Apply

**Solo después de validar el dry-run**, ejecutar en modo `--apply`:

```bash
node scripts/migrate-legacy-to-progreso-v4.js --apply
```

**Qué hace el modo apply:**
- ✅ Procesa todos los alumnos igual que dry-run
- ✅ Registra evento de auditoría global en `audit_log`
- ✅ NO modifica datos (porque computeProgress() calcula en tiempo real)
- ✅ Valida que todos los datos base estén correctos

### PASO 4: Reiniciar Servidor con PM2

**CRÍTICO**: Después de la migración, reiniciar el servidor:

```bash
pm2 restart aurelinportal
# O el nombre que uses para tu proceso
```

**Verificar reinicio:**
```bash
pm2 list
pm2 logs aurelinportal --lines 50
```

**Confirmar nuevo PID:**
- El PID debe cambiar después del reinicio
- Verificar que no hay errores en los logs

### PASO 5: Verificar en Admin

Acceder a `/admin/progreso-v4` y verificar:

1. **Listado Global:**
   - ✅ Todos los alumnos aparecen
   - ✅ Niveles y fases se muestran correctamente
   - ✅ Sin referencias a datos legacy visibles

2. **Detalle de Alumno:**
   - ✅ Acceder a `/admin/progreso-v4/alumno/{id}`
   - ✅ Verificar que muestra:
     - Nivel base (calculado)
     - Nivel efectivo (con overrides si aplica)
     - Fase efectiva
     - Días activos
     - Días pausados
   - ✅ Verificar que NO muestra:
     - ❌ nivel_actual (legacy)
     - ❌ nivel_manual (legacy)
     - ❌ streak (legacy)

3. **Overrides:**
   - ✅ Verificar que los overrides existentes siguen funcionando
   - ✅ Verificar que se pueden crear nuevos overrides
   - ✅ Verificar que se pueden revocar overrides

## 📝 Estructura del Script

El script `migrate-legacy-to-progreso-v4.js`:

1. **Obtiene todos los alumnos** de PostgreSQL
2. **Para cada alumno:**
   - Lee email
   - Lee fecha_inscripcion
   - Lee pausas (de tabla `pausas`)
   - Lee estado_suscripcion
   - Construye objeto student mínimo
   - Ejecuta `computeProgress()` con esos datos
   - Valida que el cálculo funciona correctamente
3. **Registra auditoría** global (solo en modo apply)
4. **Muestra resumen** completo

## 🔍 Qué NO Hace el Script

- ❌ NO modifica datos legacy (se mantienen en DB)
- ❌ NO crea overrides automáticos
- ❌ NO modifica overrides existentes
- ❌ NO guarda resultados calculados (computeProgress() calcula en tiempo real)

## ✅ Entregable Final

Después de completar todos los pasos:

- ✅ Sistema gobernado 100% por Progreso V4
- ✅ Legacy convertido en simple histórico silencioso
- ✅ Base preparada para futuras sincronizaciones del Modo Master
- ✅ Sin dependencia mental ni técnica del sistema antiguo
- ✅ Vistas Admin muestran SOLO Progreso V4
- ✅ Datos legacy ocultos pero preservados en DB

## 🆘 Troubleshooting

### Error: "Email faltante"
- Verificar que todos los alumnos tengan email en tabla `alumnos`
- Ejecutar: `SELECT id, email FROM alumnos WHERE email IS NULL OR email = '';`

### Error: "fecha_inscripcion faltante"
- Verificar que todos los alumnos tengan fecha_inscripcion
- Ejecutar: `SELECT id, email, fecha_inscripcion FROM alumnos WHERE fecha_inscripcion IS NULL;`
- Si faltan, usar `created_at` como fallback temporal

### Error en computeProgress()
- Revisar logs detallados del error
- Verificar que el alumno tiene `id` válido
- Verificar que las pausas están correctamente formateadas

### El servidor no reinicia correctamente
- Verificar logs de PM2: `pm2 logs aurelinportal`
- Verificar que no hay errores de sintaxis en el código
- Verificar variables de entorno

## 📚 Referencias

- `computeProgress()`: `src/core/progress-engine.js`
- Tabla `alumnos`: `database/pg.js`
- Tabla `pausas`: `database/pg.js`
- Vista Admin Progreso V4: `src/endpoints/admin-panel-v4.js`

---

**Última actualización**: ${new Date().toISOString()}













