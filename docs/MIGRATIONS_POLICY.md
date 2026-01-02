# POLÍTICA DE MIGRACIONES - POSTGRESQL
## AuriPortal - Guardarraíles y Mejores Prácticas

**Versión**: v1.0.0-canonic  
**Fecha de Establecimiento**: 2025-12-26  
**Estado**: ✅ LEY OPERATIVA DEL PROYECTO

---

## 🎯 PROPÓSITO

Este documento establece la **política canónica de migraciones** PostgreSQL en AuriPortal. Define guardarraíles, prohibiciones y mejores prácticas para mantener la integridad del Source of Truth.

---

## 📜 PRINCIPIOS FUNDAMENTALES

### 1. Migraciones como Source of Truth

**REGLA**: Las migraciones son parte del Source of Truth y deben ser:
- Idempotentes (pueden ejecutarse múltiples veces)
- Documentadas explícitamente
- Verificables
- Reversibles (cuando sea posible)

### 2. Usuario de Aplicación como Default

**REGLA**: Las migraciones deben asumir que se ejecutan como usuario de aplicación (`aurelinportal`), NO como superusuario.

**Justificación**:
- La aplicación ejecuta migraciones automáticamente al arrancar
- El usuario de aplicación tiene permisos limitados (seguridad)
- Las operaciones administrativas requieren ejecución manual

### 3. Separación de Migraciones Normales y Administrativas

**REGLA**: Las migraciones se clasifican en dos tipos:

**A) Migraciones Normales** (ejecutadas por la aplicación):
- Crear/modificar tablas, columnas, índices
- Insertar datos iniciales
- Crear constraints, triggers, funciones
- **NO requieren permisos de superusuario**

**B) Migraciones Administrativas** (ejecutadas manualmente):
- Cambiar ownership de tablas (`ALTER TABLE ... OWNER TO`)
- Modificar permisos de esquema
- Operaciones que requieren `postgres` o superusuario
- **NO se ejecutan desde la aplicación**

---

## 🚫 PROHIBICIONES ABSOLUTAS

### En Migraciones Normales

**ESTÁ PROHIBIDO**:
- ❌ Asumir permisos de superusuario
- ❌ Ejecutar `ALTER TABLE ... OWNER TO` (requiere superusuario)
- ❌ Modificar `pg_hba.conf` o configuración de autenticación
- ❌ Usar `SET ROLE` para elevar privilegios
- ❌ Silenciar errores de permisos sin documentar

**Por qué está prohibido**:
- La aplicación ejecuta migraciones como usuario `aurelinportal`
- No tiene permisos de superusuario
- Asumir permisos elevados rompe el sistema de seguridad

### En Migraciones Administrativas

**ESTÁ PROHIBIDO**:
- ❌ Ejecutar desde la aplicación
- ❌ Automatizar en runtime
- ❌ Usar contraseñas en lugar de peer authentication
- ❌ Bajar seguridad para "arreglar" errores

**Por qué está prohibido**:
- Requieren permisos de superusuario
- Son operaciones administrativas, no de runtime
- Deben ejecutarse manualmente con peer authentication

---

## 📋 GUARDARRAÍLES PARA MIGRACIONES

### 1. Idempotencia

**REGLA**: Todas las migraciones deben ser idempotentes.

**Implementación**:
```sql
-- ✅ CORRECTO: Usar IF NOT EXISTS / IF EXISTS
CREATE TABLE IF NOT EXISTS nueva_tabla (...);
CREATE INDEX IF NOT EXISTS idx_nombre ON tabla(columna);
ALTER TABLE tabla ADD COLUMN IF NOT EXISTS nueva_columna TEXT;

-- ❌ INCORRECTO: Sin idempotencia
CREATE TABLE nueva_tabla (...);  -- Falla si ya existe
```

### 2. Verificación de Existencia

**REGLA**: Verificar existencia antes de modificar.

**Implementación**:
```sql
-- ✅ CORRECTO: Verificar antes de modificar
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'tabla' AND column_name = 'columna') THEN
    ALTER TABLE tabla ADD COLUMN columna TEXT;
  END IF;
END $$;
```

### 3. Documentación Explícita

**REGLA**: Toda migración debe incluir:
- Propósito claro
- Tablas/columnas afectadas
- Dependencias (otras migraciones)
- Verificación post-migración

**Formato**:
```sql
-- ============================================================================
-- Migración vX.Y.Z: Descripción clara
-- ============================================================================
-- Fecha: YYYY-MM-DD
-- Descripción: Qué hace esta migración y por qué
--
-- Tablas afectadas:
-- - tabla1 (crear/modificar)
-- - tabla2 (modificar)
--
-- Dependencias:
-- - Requiere migración vX.Y.Z-1
--
-- Verificación:
-- SELECT * FROM tabla1 LIMIT 1;
-- ============================================================================
```

### 4. Manejo de Errores

**REGLA**: Los errores deben ser explícitos y documentados.

**Implementación**:
```sql
-- ✅ CORRECTO: Manejo explícito de errores
DO $$ 
BEGIN
  BEGIN
    ALTER TABLE tabla ADD COLUMN columna TEXT;
  EXCEPTION WHEN duplicate_column THEN
    RAISE NOTICE 'Columna ya existe, omitiendo';
  END;
END $$;

-- ❌ INCORRECTO: Silenciar errores
-- (no hacer nada, dejar que falle silenciosamente)
```

---

## 🔐 MIGRACIONES ADMINISTRATIVAS

### Cuándo Crear Migración Administrativa

**Crear migración administrativa cuando**:
- Se requiere cambiar ownership de tablas
- Se requiere modificar permisos de esquema
- Se requiere operaciones que solo `postgres` puede hacer

### Formato de Migración Administrativa

**Formato**:
```sql
-- ============================================================================
-- Migración vX.Y.Z: Operación Administrativa
-- ============================================================================
-- Fecha: YYYY-MM-DD
-- Descripción: Qué hace esta migración
--
-- ⚠️ IMPORTANTE: Esta migración requiere ejecución MANUAL como superusuario
-- Ejecutar como: sudo -i -u postgres
-- Comando: psql -d aurelinportal -f database/migrations/vX.Y.Z-*.sql
--
-- NO ejecutar desde la aplicación.
-- ============================================================================

ALTER TABLE IF EXISTS tabla_activa OWNER TO aurelinportal;
-- ... más operaciones administrativas ...
```

### Procedimiento de Ejecución

**Paso a paso**:
1. Verificar que la migración es administrativa (requiere superusuario)
2. Cambiar a usuario `postgres`: `sudo -i -u postgres`
3. Ejecutar migración: `psql -d aurelinportal -f database/migrations/vX.Y.Z-*.sql`
4. Verificar resultado
5. Documentar en `docs/DB_OWNERSHIP_REMEDIATION.md` (si aplica)

---

## ✅ VERIFICACIÓN POST-MIGRACIÓN

### Verificación Automática

**Recomendación**: Incluir queries de verificación en la migración:

```sql
-- Verificación post-migración
DO $$ 
DECLARE
  tabla_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO tabla_count
  FROM information_schema.tables
  WHERE table_schema = 'public' 
    AND table_name = 'nueva_tabla';
  
  IF tabla_count = 0 THEN
    RAISE EXCEPTION 'Migración falló: tabla nueva_tabla no existe';
  END IF;
END $$;
```

### Verificación Manual

**Para migraciones críticas**, documentar queries de verificación:

```sql
-- Verificar que la migración se aplicó correctamente
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'tabla_modificada'
ORDER BY ordinal_position;
```

---

## 🚨 ERRORES COMUNES Y SOLUCIONES

### Error: "must be owner of table"

**Causa**: Ownership incorrecto de tabla.

**Solución**:
1. Verificar ownership: `SELECT tablename, tableowner FROM pg_tables WHERE tablename = 'tabla';`
2. Si es tabla ACTIVA con owner `postgres` → Crear migración administrativa
3. Ejecutar migración manualmente como `postgres`
4. NO cambiar autenticación ni bajar seguridad

### Error: "permission denied for schema"

**Causa**: Usuario de aplicación no tiene permisos en esquema.

**Solución**:
1. Verificar permisos: `\dn+ schema_name`
2. Si requiere permisos administrativos → Crear migración administrativa
3. Ejecutar manualmente como `postgres`
4. NO dar permisos excesivos al usuario de aplicación

### Error: "relation already exists"

**Causa**: Migración no es idempotente.

**Solución**:
1. Usar `IF NOT EXISTS` / `IF EXISTS` en migración
2. Verificar existencia antes de crear
3. Hacer migración idempotente

---

## 📚 REFERENCIAS

- `docs/DB_OWNERSHIP_POLICY.md` - Política canónica de ownership
- `docs/DB_OWNERSHIP_REMEDIATION.md` - Proceso de remediación
- `database/migrations/` - Directorio de migraciones
- `.cursor/rules/contratos.mdc` - Reglas constitucionales

---

## 🎯 CONCLUSIÓN

Las migraciones PostgreSQL son parte del Source of Truth y deben seguir principios canónicos:
1. Idempotencia obligatoria
2. Usuario de aplicación como default
3. Separación de migraciones normales y administrativas
4. Documentación explícita
5. Verificación post-migración

**Esta política es LEY OPERATIVA del proyecto AuriPortal.**









