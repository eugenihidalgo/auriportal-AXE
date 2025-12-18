# Runbook de Migración: AXE v0.6.3 - Canvas Persistence

**Versión:** v5.5.0  
**Fecha:** 2025-01-XX  
**Descripción:** Persistencia de Canvas en Recorridos (draft/publish) + Vista Admin v1

---

## 📋 PRE-CHECK

### 1) Verificar Git Status

```bash
cd /var/www/aurelinportal
git status
git log --oneline -5
```

**Esperado:**
- Working directory limpio o con cambios controlados
- Último commit conocido

### 2) Verificar PM2

```bash
pm2 status aurelinportal
pm2 logs aurelinportal --lines 20
```

**Esperado:**
- Servidor corriendo sin errores críticos
- Logs recientes sin errores de conexión a PostgreSQL

### 3) Verificar PostgreSQL

```bash
psql "$DATABASE_URL" -c "SELECT version();"
psql "$DATABASE_URL" -c "\dt recorrido*"
```

**Esperado:**
- Conexión exitosa
- Tablas `recorridos`, `recorrido_drafts`, `recorrido_versions` existen

---

## 🚀 EJECUTAR MIGRACIÓN

### Paso 1: Backup (Opcional pero Recomendado)

```bash
# Backup de las tablas afectadas
psql "$DATABASE_URL" -c "\copy (SELECT * FROM recorrido_drafts) TO '/tmp/recorrido_drafts_backup_$(date +%Y%m%d_%H%M%S).csv' CSV HEADER"
psql "$DATABASE_URL" -c "\copy (SELECT * FROM recorrido_versions) TO '/tmp/recorrido_versions_backup_$(date +%Y%m%d_%H%M%S).csv' CSV HEADER"
```

### Paso 2: Ejecutar Migración

```bash
cd /var/www/aurelinportal
psql "$DATABASE_URL" -f database/migrations/v5.5.0-recorridos-canvas-persistence.sql
```

**Esperado:**
- Sin errores
- Mensajes: `ALTER TABLE`, `CREATE INDEX`, `COMMENT ON`

---

## ✅ VERIFICACIÓN

### 1) Verificar Columnas Añadidas

```bash
psql "$DATABASE_URL" -c "\d recorrido_drafts"
```

**Esperado:**
- Columna `canvas_json` (jsonb, nullable)
- Columna `canvas_updated_at` (timestamptz, nullable)

```bash
psql "$DATABASE_URL" -c "\d recorrido_versions"
```

**Esperado:**
- Columna `canvas_json` (jsonb, nullable)

### 2) Verificar Índices

```bash
psql "$DATABASE_URL" -c "\d+ recorrido_drafts" | grep -i canvas
psql "$DATABASE_URL" -c "\d+ recorrido_versions" | grep -i canvas
```

**Esperado:**
- Índice GIN `idx_recorrido_drafts_canvas_gin`
- Índice GIN `idx_recorrido_versions_canvas_gin`

### 3) Verificar Comentarios SQL

```bash
psql "$DATABASE_URL" -c "SELECT col_description('recorrido_drafts'::regclass, (SELECT ordinal_position FROM information_schema.columns WHERE table_name='recorrido_drafts' AND column_name='canvas_json'));"
```

**Esperado:**
- Comentario explicando derivación si null

---

## 🔄 RESTART CONTROLADO

### Paso 1: Reiniciar PM2

```bash
pm2 restart aurelinportal --update-env
```

**Esperado:**
- Restart exitoso
- Sin errores en logs

### Paso 2: Verificar Logs

```bash
pm2 logs aurelinportal --lines 50
```

**Esperado:**
- Servidor iniciado correctamente
- Sin errores de importación de módulos
- Sin errores de conexión a PostgreSQL

---

## 🧪 SMOKE TESTS HTTP

### 1) Health Check

```bash
curl -s http://localhost:3000/__version | jq .
```

**Esperado:**
- Status 200
- JSON con versión

### 2) Admin Panel (sin auth)

```bash
curl -I http://localhost:3000/admin
```

**Esperado:**
- Status 302 (redirect a login) o 401
- Headers correctos

### 3) Recorridos List (sin auth)

```bash
curl -I http://localhost:3000/admin/recorridos
```

**Esperado:**
- Status 302 (redirect) o 401
- No 500

### 4) Canvas API Endpoint (sin auth)

```bash
# Obtener un recorrido_id existente primero
RECORRIDO_ID="limpieza-diaria"  # Ajustar según exista
curl -I "http://localhost:3000/admin/api/recorridos/${RECORRIDO_ID}/canvas"
```

**Esperado:**
- Status 401 o 302 (no 404, no 500)
- Endpoint existe y responde

---

## 🎨 VERIFICACIÓN UI

### 1) Navegabilidad

1. Acceder a `/admin/recorridos` (con auth)
2. Abrir un recorrido existente para editar
3. Verificar que existe el toggle "📋 Lista" / "🎨 Canvas" en el topbar

**Esperado:**
- Toggle visible y funcional
- Al hacer clic, cambia entre vistas

### 2) Vista Canvas v1

1. Activar vista Canvas
2. Verificar que se carga el canvas (derivado o persistido)
3. Verificar badge "DERIVED" si es derivado
4. Verificar que se muestra el JSON editor y el viewer

**Esperado:**
- Canvas se carga correctamente
- Badge muestra estado correcto
- Viewer muestra nodos y edges

### 3) Funcionalidades Canvas

1. **Cargar Canvas:** Debe cargar desde servidor
2. **Validar Canvas:** Debe validar sin guardar
3. **Guardar Canvas:** Debe persistir en draft
4. **Convertir a Recorrido:** Debe mostrar preview

**Esperado:**
- Todas las funciones responden sin errores
- Mensajes de éxito/error claros

---

## 📊 VERIFICACIÓN DE DATOS

### 1) Verificar Draft con Canvas

```bash
psql "$DATABASE_URL" -c "SELECT recorrido_id, draft_id, canvas_json IS NOT NULL as has_canvas, canvas_updated_at FROM recorrido_drafts ORDER BY updated_at DESC LIMIT 5;"
```

**Esperado:**
- Algunos drafts pueden tener `has_canvas = true` si se guardó canvas
- `canvas_updated_at` se actualiza al guardar

### 2) Verificar Versión con Canvas (después de publish)

```bash
psql "$DATABASE_URL" -c "SELECT recorrido_id, version, canvas_json IS NOT NULL as has_canvas FROM recorrido_versions ORDER BY created_at DESC LIMIT 5;"
```

**Esperado:**
- Versiones publicadas después de la migración pueden tener canvas
- Canvas en versiones es INMUTABLE

---

## 🐛 TROUBLESHOOTING

### Error: "column canvas_json does not exist"

**Causa:** Migración no se ejecutó correctamente

**Solución:**
```bash
# Verificar que el archivo existe
ls -la database/migrations/v5.5.0-recorridos-canvas-persistence.sql

# Re-ejecutar migración
psql "$DATABASE_URL" -f database/migrations/v5.5.0-recorridos-canvas-persistence.sql
```

### Error: "Cannot read property 'canvas_json' of undefined"

**Causa:** Código intenta acceder a canvas_json antes de que la migración se ejecute

**Solución:**
1. Verificar que la migración se ejecutó
2. Reiniciar PM2
3. Verificar logs del servidor

### Error: "Endpoint no encontrado" en `/canvas`

**Causa:** Router no registra los endpoints de canvas

**Solución:**
1. Verificar que `admin-recorridos-api.js` tiene los handlers
2. Verificar que el router incluye las rutas
3. Reiniciar PM2

### Vista Canvas no aparece

**Causa:** HTML no se actualizó o hay error de JavaScript

**Solución:**
1. Verificar que `recorridos-editor.html` tiene el toggle y la vista
2. Abrir consola del navegador (F12) y verificar errores
3. Verificar que las funciones JavaScript están definidas

---

## ✅ CHECKLIST FINAL

- [ ] Migración ejecutada sin errores
- [ ] Columnas `canvas_json` y `canvas_updated_at` existen
- [ ] Índices GIN creados
- [ ] PM2 reiniciado sin errores
- [ ] Smoke tests HTTP pasan
- [ ] Toggle Canvas visible en editor
- [ ] Vista Canvas carga correctamente
- [ ] Funciones Canvas (cargar, validar, guardar, convertir) funcionan
- [ ] Badge DERIVED aparece cuando corresponde
- [ ] Publish incluye canvas en versiones

---

## 📝 NOTAS

- **Retrocompatibilidad:** Recorridos existentes sin canvas funcionan (se deriva automáticamente)
- **Fail-open:** Si hay error derivando canvas, se muestra canvas vacío (no bloquea)
- **Inmutabilidad:** Canvas en `recorrido_versions` nunca cambia después de publish
- **Normalización:** Canvas siempre se guarda normalizado

---

**Migración completada:** ✅  
**Fecha:** _______________  
**Ejecutado por:** _______________

