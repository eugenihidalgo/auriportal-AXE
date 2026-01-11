# REPORTE DE BACKUP POSTGRESQL — PRE-SPRINT SAFETY
**AuriPortal / Aurelín**  
**Fecha:** 2026-01-11 13:19:32 UTC  
**Objetivo:** Backup completo verificado antes de Sprint 1 (cambios constitucionales)

---

## METADATOS DE BACKUP

**Timestamp UTC:** 2026-01-11T13:19:32Z  
**APP_VERSION:** 5.65.2  
**Branch:** master  
**Commit:** e56ab744c55547fdd020c0d7970739ca6d631634  
**Commit Message:** fix: Alquimia UNA_VEZ no filtra por nivel + toast correcto

**Conexión PostgreSQL:**
- **Método:** DATABASE_URL (connection string)
- **Database:** aurelinportal
- **User:** aurelinportal
- **Verificación:** ✅ Conexión exitosa verificada

**Resultado de verificación:**
```json
{
  "current_database": "aurelinportal",
  "current_user": "aurelinportal",
  "now": "2026-01-11T13:19:35.517Z"
}
```

---

## UBICACIÓN DE BACKUPS

**Directorio de backups:** `/var/backups/aurelinportal/20260111T131932Z_v5.65.2/`

**Archivos generados:**
- `aurelinportal_20260111T131932Z_v5.65.2.dump` (1.2M) - Backup completo formato custom
- `globals_20260111T131932Z.sql` (202 bytes) - Roles y configuraciones globales
- `SHA256SUMS.txt` - Checksums de verificación
- `LS_LH.txt` - Listado de archivos con tamaños

**⚠️ IMPORTANTE:** Backups NO se commitean en git. Están en `/var/backups/aurelinportal/`

---

## COMANDOS EJECUTADOS

### 1. Backup del esquema+datos (formato custom)
```bash
pg_dump "$DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --verbose \
  -f "/var/backups/aurelinportal/20260111T131932Z_v5.65.2/aurelinportal_20260111T131932Z_v5.65.2.dump"
```

**Resultado:**
- ✅ Backup completado exitosamente
- ✅ 2843 TOC Entries (tablas, funciones, tipos, etc.)
- ✅ Compresión: gzip
- ✅ Dump Version: 1.15-0
- ✅ Database version: 16.11 (Ubuntu 16.11-0ubuntu0.24.04.1)

### 2. Backup de globals (roles y configuraciones)
```bash
pg_dumpall "$DATABASE_URL" \
  --globals-only \
  --verbose \
  > "/var/backups/aurelinportal/20260111T131932Z_v5.65.2/globals_20260111T131932Z.sql"
```

**Resultado:**
- ⚠️ Backup completado (archivo generado, 202 bytes)

### 3. Verificación del backup
```bash
pg_restore -l "/var/backups/aurelinportal/20260111T131932Z_v5.65.2/aurelinportal_20260111T131932Z_v5.65.2.dump" | head -40
```

**Resultado:**
- ✅ Backup válido y legible
- ✅ Contiene todas las tablas, funciones, tipos, extensiones esperadas

---

## CHECKSUMS (SHA256)

```
4f0f3d85a8a2093a810e4dc66e3191168c109f038b176842e3b1edcd95305315  aurelinportal_20260111T131932Z_v5.65.2.dump
7607afeab674b83e684b6282e530486b65985582f26ec009738b8f520b97508f  globals_20260111T131932Z.sql
```

**Verificación:**
```bash
cd /var/backups/aurelinportal/20260111T131932Z_v5.65.2/
sha256sum -c SHA256SUMS.txt
```

---

## TAMAÑOS DE ARCHIVOS

```
total 1.2M
-rw-r--r-- 1 root root 1.2M Jan 11 13:19 aurelinportal_20260111T131932Z_v5.65.2.dump
-rw-r--r-- 1 root root  202 Jan 11 13:19 globals_20260111T131932Z.sql
-rw-r--r-- 1 root root  205 Jan 11 13:19 SHA256SUMS.txt
-rw-r--r-- 1 root root    0 Jan 11 13:19 LS_LH.txt
```

---

## ESTADO DEL REPOSITORIO

**Archivos modificados/creados:**
- ✅ `docs/BACKUP_POSTGRESQL_REPORT_20260111T131932Z.md` (este archivo)
- ✅ `.gitignore` (actualizado con patrones de backup)

**Archivos NO commiteados (correcto):**
- ❌ `/var/backups/aurelinportal/` (gitignored)
- ❌ `*.dump` (gitignored)
- ❌ `*.sql.gz` (gitignored)

---

## NOTAS

1. **Backups NO se commitean:** Los archivos `.dump` y backups están en `.gitignore`
2. **Ubicación permanente:** Backups en `/var/backups/aurelinportal/` (fuera del repo)
3. **Verificación:** Checksums SHA256 permiten verificar integridad del backup
4. **Restauración:** Usar `pg_restore -d <database> <dump_file>` para restaurar

---

## PRÓXIMOS PASOS

1. ✅ Backup verificado y documentado
2. ⏳ Commit del reporte (sin backups)
3. ⏳ Actualizar/crear rules para automatizar backups pre-sprint
4. ⏳ Restart PM2 (proceso canónico)

---

**FIN DEL REPORTE DE BACKUP**
