# Migración Manual del Sistema de Recorridos

## Estado Actual
Las migraciones v5.1.0 y v5.2.0 están configuradas en `runMigrations()` de `database/pg.js`, pero aún NO se han ejecutado en producción.

---

## PASO 1: Verificar Estado Actual de Base de Datos

```bash
psql -U postgres -d auriportal -c "\dt recorr*"
```

**Resultado esperado ANTES de migrar:**
```
Did not find any relation named "recorr*".
```

Si ya existen tablas `recorridos`, `recorrido_drafts`, etc., las migraciones ya fueron aplicadas.

---

## PASO 2: Ejecutar Migración v5.1.0 (Versionado)

```bash
psql -U postgres -d auriportal -f /var/www/aurelinportal/database/migrations/v5.1.0-create-recorridos-versioning.sql
```

**Tablas que se crearán:**
- `recorridos` - Tabla principal de recorridos
- `recorrido_drafts` - Borradores editables
- `recorrido_versions` - Versiones publicadas (inmutables)
- `recorrido_audit_log` - Log de auditoría

---

## PASO 3: Verificar Migración v5.1.0

```bash
psql -U postgres -d auriportal -c "\dt recorr*"
```

**Resultado esperado:**
```
              List of relations
 Schema |        Name         | Type  | Owner
--------+---------------------+-------+-------
 public | recorrido_audit_log | table | postgres
 public | recorrido_drafts    | table | postgres
 public | recorrido_versions  | table | postgres
 public | recorridos          | table | postgres
```

---

## PASO 4: Ejecutar Migración v5.2.0 (Runtime)

```bash
psql -U postgres -d auriportal -f /var/www/aurelinportal/database/migrations/v5.2.0-create-recorrido-runtime.sql
```

**Tablas que se crearán:**
- `recorrido_runs` - Ejecuciones de recorridos por usuarios
- `recorrido_step_results` - Resultados de cada paso
- `recorrido_events` - Eventos de analíticas

---

## PASO 5: Verificar Migración v5.2.0

```bash
psql -U postgres -d auriportal -c "\dt recorr*"
```

**Resultado esperado FINAL:**
```
              List of relations
 Schema |          Name           | Type  | Owner
--------+-------------------------+-------+-------
 public | recorrido_audit_log     | table | postgres
 public | recorrido_drafts        | table | postgres
 public | recorrido_events        | table | postgres
 public | recorrido_runs          | table | postgres
 public | recorrido_step_results  | table | postgres
 public | recorrido_versions      | table | postgres
 public | recorridos              | table | postgres
```

**7 tablas en total.**

---

## PASO 6: Reiniciar Servidor (Opcional)

Si el servidor ya estaba corriendo, las migraciones se detectarán como "ya aplicadas" en el próximo arranque:

```bash
pm2 restart auriportal
```

---

## Verificación de Índices

```bash
psql -U postgres -d auriportal -c "\di recorr*"
```

Debería mostrar ~15 índices para optimización de consultas.

---

## Orden de Dependencias

```
v5.1.0 (versionado) ──DEBE IR ANTES──> v5.2.0 (runtime)
        │                                     │
        └── Crea tabla "recorridos" ──────────┘
                                              │
                                    v5.2.0 tiene FK a recorridos
```

**IMPORTANTE:** Si se ejecuta v5.2.0 antes de v5.1.0, fallará con error de FK.

---

## Solución de Problemas

### Error: "relation recorridos does not exist"
Causa: Se ejecutó v5.2.0 antes de v5.1.0
Solución: Ejecutar v5.1.0 primero

### Error: "table already exists"
Causa: La migración ya fue aplicada
Solución: Ignorar, es comportamiento esperado (idempotencia)

### Error: "permission denied"
Causa: Usuario sin permisos
Solución: Usar usuario con permisos de CREATE TABLE

---

Documento generado: 2025-01-XX
Versión: Corrección Controlada v1.0















