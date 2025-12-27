# POLÍTICA CANÓNICA DE OWNERSHIP - POSTGRESQL
## AuriPortal - Source of Truth y Gobernanza de Ownership

**Versión**: v2.0.0-canonic (Unificación Total)  
**Fecha de Establecimiento**: 2025-12-26  
**Fecha de Unificación**: 2025-12-26 (v5.32.0)  
**Estado**: ✅ LEY OPERATIVA DEL PROYECTO

---

## 🎯 PROPÓSITO

Este documento establece la **política canónica de ownership** de tablas PostgreSQL en AuriPortal. El ownership es parte del **Source of Truth** y debe ser gobernado explícitamente.

---

## 📜 REGLAS ABSOLUTAS (NO NEGOCIABLES)

### 1. Ownership Unificado (LEY CONSTITUCIONAL)

**REGLA**: **TODAS** las tablas del schema `public` deben tener `owner = usuario_de_aplicación` (`aurelinportal`).

**Justificación**:
- Permite que la aplicación ejecute `ALTER TABLE` en migraciones
- Mantiene consistencia con el principio de Source of Truth
- Elimina definitivamente errores de ownership
- Simplifica gobernanza y auditoría

**DECISIÓN CONSTITUCIONAL (v5.32.0)**:
- NO existe distinción ACTIVA / LEGACY en ownership
- TODAS las tablas → `owner = aurelinportal`
- PostgreSQL (usuario `postgres`) queda EXCLUSIVAMENTE como rol administrativo
- Esta decisión es explícita, irreversible (salvo nueva versión constitucional) y coherente con PostgreSQL como SOT

**Aplicación**:
- Todas las tablas existentes: `owner = aurelinportal`
- Todas las tablas nuevas: `owner = aurelinportal` (por defecto o explícito)
- Sin excepciones, sin distinción legacy

### 2. Prohibición de Errores de Ownership

**REGLA**: Ninguna migración futura debe fallar por ownership incorrecto.

**Justificación**:
- El ownership debe estar correcto antes de ejecutar migraciones
- Los errores de ownership indican deuda técnica, no bugs funcionales
- Deben resolverse con migraciones administrativas explícitas

### 4. Ownership como Source of Truth

**REGLA**: El ownership es parte del Source of Truth y debe ser:
- Documentado explícitamente
- Verificado en migraciones
- Mantenido consistente

**Justificación**:
- El ownership afecta la capacidad de modificar esquemas
- Es parte de la configuración del sistema
- Debe ser gobernable y auditable

---

## 🔐 AUTENTICACIÓN Y SEGURIDAD

### Peer Authentication (OBLIGATORIO)

**REGLA**: PostgreSQL debe usar **peer authentication** para conexiones locales.

**Justificación**:
- Es el método más seguro para conexiones locales
- No requiere contraseñas (usa identidad del SO)
- Es la configuración por defecto y recomendada

**Prohibiciones**:
- ❌ NO cambiar `peer` → `md5` en `pg_hba.conf`
- ❌ NO poner contraseña al usuario `postgres` por conveniencia
- ❌ NO bajar seguridad para "arreglar" migraciones

### Ejecución de Migraciones Administrativas

**REGLA**: Las migraciones que requieren `ALTER OWNER` deben ejecutarse manualmente como usuario `postgres`.

**Procedimiento**:
```bash
sudo -i -u postgres
cd /var/www/aurelinportal
psql -d aurelinportal -f database/migrations/vX.Y.Z-fix-ownership.sql
exit
```

**Prohibiciones**:
- ❌ NO ejecutar desde la aplicación (usuario `aurelinportal` no tiene permisos)
- ❌ NO automatizar migraciones administrativas en runtime
- ❌ NO usar contraseñas para conexiones locales

---

## 📋 OWNERSHIP UNIFICADO

### Todas las Tablas

**REGLA CONSTITUCIONAL**: Todas las tablas del schema `public` tienen `owner = aurelinportal`.

**No existe clasificación**:
- ❌ NO hay distinción ACTIVA / LEGACY en ownership
- ❌ NO hay excepciones
- ❌ NO hay tablas con `owner = postgres` (salvo roles administrativos)

**Ejemplos (todas con owner = aurelinportal)**:
- `alumnos` (SOT Principal)
- `protecciones_energeticas` (Runtime)
- `automation_rules` (Runtime)
- `signal_definitions` (SOT)
- `audit_events` (SOT)
- `recorridos` (Runtime)
- `navigation_definitions` (Runtime)
- `feature_flags` (SOT)
- `altares`, `altares_items` (Legacy, pero ownership unificado)
- `arquetipos`, `arquetipos_alumnos` (Legacy, pero ownership unificado)
- `pde_packages_backup_before_legacy_delete` (Backup, pero ownership unificado)
- `ui_active_config`, `ui_layers`, `ui_screens` (Legacy, pero ownership unificado)

**Nota**: La clasificación ACTIVA / LEGACY puede existir para otros propósitos (uso, mantenimiento, eliminación), pero NO afecta el ownership, que es unificado para todas las tablas.

---

## 🔄 PROCESO DE REMEDIACIÓN

### Cuando se Detecta Ownership Incorrecto

1. **Identificar**: Verificar ownership de tablas afectadas
2. **Documentar**: Registrar en `docs/DB_OWNERSHIP_AUDIT.md`
3. **Remediar**: Crear migración administrativa para TODAS las tablas con ownership incorrecto
4. **Ejecutar**: Aplicar migración manualmente como `postgres`
5. **Verificar**: Confirmar que ownership se corrigió (0 tablas con owner != aurelinportal)

### Creación de Migración de Ownership

**Formato**:
```sql
-- Migración vX.Y.Z: Unificación de ownership
-- Ejecutar manualmente como: sudo -i -u postgres

ALTER TABLE IF EXISTS tabla1 OWNER TO aurelinportal;
ALTER TABLE IF EXISTS tabla2 OWNER TO aurelinportal;
-- ... TODAS las tablas del schema public ...
```

**Requisitos**:
- Cambiar ownership de TODAS las tablas con ownership incorrecto
- NO hacer distinción ACTIVA / LEGACY
- Ser idempotente (`IF EXISTS`)
- Incluir comentarios explicativos
- Documentar en `docs/DB_OWNERSHIP_REMEDIATION.md`

---

## ✅ VERIFICACIÓN Y AUDITORÍA

### Verificación Post-Remediación

```sql
-- Verificar que TODAS las tablas tienen ownership correcto
SELECT tablename, tableowner
FROM pg_tables
WHERE schemaname = 'public'
  AND tableowner != 'aurelinportal'
ORDER BY tablename;
```

**Resultado esperado**: **0 filas** (todas las tablas tienen `tableowner = 'aurelinportal'`)

### Auditoría Periódica

**Recomendación**: Ejecutar auditoría periódica para detectar regresiones:

```sql
-- Detectar CUALQUIER tabla con ownership incorrecto
SELECT tablename, tableowner 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tableowner != 'aurelinportal'
ORDER BY tablename;
```

**Resultado esperado**: **0 filas** (ownership unificado para todas las tablas)

---

## 🚫 PROHIBICIONES ABSOLUTAS

### Seguridad

- ❌ **NO editar `pg_hba.conf`** para cambiar autenticación
- ❌ **NO cambiar `peer` → `md5`** por conveniencia
- ❌ **NO poner contraseña** al usuario `postgres`
- ❌ **NO bajar seguridad** para "arreglar" migraciones

### Runtime

- ❌ **NO ejecutar migraciones administrativas** desde la aplicación
- ❌ **NO automatizar `ALTER OWNER`** en runtime
- ❌ **NO usar usuario `postgres`** en conexiones de aplicación

### Migraciones

- ❌ **NO modificar migraciones antiguas** para cambiar ownership
- ❌ **NO asumir permisos de superusuario** en migraciones normales
- ❌ **NO silenciar errores** de ownership sin documentar

---

## 📚 REFERENCIAS

- `docs/DB_OWNERSHIP_AUDIT.md` - Auditoría completa de ownership
- `docs/DB_OWNERSHIP_REMEDIATION.md` - Proceso de remediación (incluye unificación v5.32.0)
- `database/migrations/v5.32.0-unify-all-table-ownership.sql` - Migración unificada (ACTUAL)
- `.cursor/rules/contratos.mdc` - Reglas constitucionales

---

## 🎯 CONCLUSIÓN

El ownership de tablas PostgreSQL es parte del **Source of Truth** y debe ser gobernado explícitamente. Esta política establece las reglas canónicas para mantener el ownership correcto sin comprometer la seguridad del sistema.

**Principios fundamentales** (v5.32.0):
1. **TODAS las tablas** → `owner = aurelinportal` (ownership unificado)
2. NO existe distinción ACTIVA / LEGACY en ownership
3. PostgreSQL (usuario `postgres`) queda EXCLUSIVAMENTE como rol administrativo
4. Peer authentication es obligatorio
5. Migraciones administrativas son manuales
6. Ownership es parte del Source of Truth

**Decisión constitucional**: Esta política es explícita, irreversible (salvo nueva versión constitucional) y coherente con PostgreSQL como SOT.

---

**Esta política es LEY OPERATIVA del proyecto AuriPortal.**

