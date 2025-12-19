# Verificación y Despliegue - Limpieza Energética Diaria v1

**Fecha:** 2025-12-17  
**Estado:** LISTO PARA IMPLEMENTAR

---

## 📁 Archivos Creados/Modificados

### Documentación

| Archivo | Descripción |
|---------|-------------|
| `docs/EDITOR_RECORRIDOS__COMO_FUNCIONA.md` | Auditoría completa del Editor de Recorridos |
| `docs/LIMPIEZA_DIARIA_V1__ESPECIFICACION_Y_MAPEO.md` | Especificación del flujo de 9 steps |
| `docs/VERIFICACION_LIMPIEZA_DIARIA_V1.md` | Este documento |

### Configuración

| Archivo | Descripción |
|---------|-------------|
| `config/recorridos/limpieza_energetica_diaria_v1.definition.json` | RecorridoDefinition canónica |
| `config/recorridos/limpieza_energetica_diaria_v1.import-bundle.json` | Bundle para importar vía API |

### Scripts

| Archivo | Descripción |
|---------|-------------|
| `scripts/import-limpieza-energetica-v1.js` | Script para importar directamente a BD |

---

## 🚀 Métodos de Importación

### Opción A: Vía Script (Recomendado para desarrollo)

```bash
cd /var/www/aurelinportal
node scripts/import-limpieza-energetica-v1.js
```

**El script:**
1. Crea el recorrido si no existe
2. Crea/actualiza el draft con la definición
3. Valida automáticamente
4. Muestra instrucciones para publicar

### Opción B: Vía API REST (Recomendado para producción)

```bash
# 1. Importar bundle completo
curl -X POST http://localhost:3000/admin/api/recorridos/import \
  -H "Content-Type: application/json" \
  -H "Cookie: auriportal_session=TU_COOKIE_ADMIN" \
  -d @config/recorridos/limpieza_energetica_diaria_v1.import-bundle.json

# Respuesta esperada:
# {"action":"created","recorrido_id":"limpieza_energetica_diaria_v1","draft_id":"uuid..."}
```

### Opción C: Crear manualmente + Actualizar draft

```bash
# 1. Crear recorrido vacío
curl -X POST http://localhost:3000/admin/api/recorridos \
  -H "Content-Type: application/json" \
  -H "Cookie: auriportal_session=TU_COOKIE_ADMIN" \
  -d '{"id":"limpieza_energetica_diaria_v1","name":"Limpieza Energética Diaria v1"}'

# 2. Actualizar draft con la definición
curl -X PUT http://localhost:3000/admin/api/recorridos/limpieza_energetica_diaria_v1/draft \
  -H "Content-Type: application/json" \
  -H "Cookie: auriportal_session=TU_COOKIE_ADMIN" \
  -d @config/recorridos/limpieza_energetica_diaria_v1.definition.json
```

---

## ✅ Validación del Draft

```bash
# Validar draft (modo draft, permite warnings)
curl -X POST http://localhost:3000/admin/api/recorridos/limpieza_energetica_diaria_v1/validate \
  -H "Content-Type: application/json" \
  -H "Cookie: auriportal_session=TU_COOKIE_ADMIN"

# Respuesta esperada:
# {
#   "valid": true,
#   "errors": [],
#   "warnings": [
#     "Step \"preparacion_seleccion\": no tiene step_type definido (recomendado para mejor validación)",
#     ...
#   ]
# }
```

**Criterios de éxito:**
- `valid: true`
- `errors: []` (vacío)
- Los warnings son informativos, no bloqueantes

---

## 📤 Publicación

```bash
# Publicar versión 1
curl -X POST http://localhost:3000/admin/api/recorridos/limpieza_energetica_diaria_v1/publish \
  -H "Content-Type: application/json" \
  -H "Cookie: auriportal_session=TU_COOKIE_ADMIN" \
  -d '{"release_notes":"v1.0 - Flujo canónico de 9 steps con handlers existentes"}'

# Respuesta esperada:
# {
#   "version": {
#     "version": 1,
#     "status": "published",
#     "definition_json": {...},
#     "release_notes": "v1.0 - Flujo canónico de 9 steps con handlers existentes",
#     "created_at": "2025-12-17T..."
#   },
#   "validation": {
#     "valid": true,
#     "warnings": [...]
#   }
# }
```

**Criterios de éxito:**
- `version.status: "published"`
- `validation.valid: true`

---

## 🔍 Verificar Recorrido Publicado

```bash
# Obtener info del recorrido
curl http://localhost:3000/admin/api/recorridos/limpieza_energetica_diaria_v1 \
  -H "Cookie: auriportal_session=TU_COOKIE_ADMIN"

# Respuesta esperada:
# {
#   "recorrido": {
#     "id": "limpieza_energetica_diaria_v1",
#     "name": "Limpieza Energética Diaria v1",
#     "status": "published",
#     "current_published_version": 1,
#     ...
#   },
#   "draft": {...},
#   "published_version": {...}
# }
```

---

## 🧪 Probar Flujo (Alumno)

### 1. Iniciar Run

```bash
# Iniciar recorrido como alumno
curl -X POST http://localhost:3000/api/recorridos/limpieza_energetica_diaria_v1/start \
  -H "Content-Type: application/json" \
  -H "Cookie: auriportal_session=COOKIE_ALUMNO"

# Respuesta esperada:
# {
#   "run_id": "uuid-del-run",
#   "step": {
#     "step_id": "seleccion_tipo_limpieza",
#     "screen_template_id": "screen_choice",
#     "props": {...}
#   }
# }
```

### 2. Obtener Step Actual

```bash
curl http://localhost:3000/api/recorridos/run/{RUN_ID}/current \
  -H "Cookie: auriportal_session=COOKIE_ALUMNO"
```

### 3. Completar Step 1 (Selección de tipo)

```bash
curl -X POST http://localhost:3000/api/recorridos/run/{RUN_ID}/submit \
  -H "Content-Type: application/json" \
  -H "Cookie: auriportal_session=COOKIE_ALUMNO" \
  -d '{
    "step_id": "seleccion_tipo_limpieza",
    "input": {
      "choice_id": "basica"
    }
  }'
```

### 4. Completar Step 2 (Selección preparaciones)

```bash
curl -X POST http://localhost:3000/api/recorridos/run/{RUN_ID}/submit \
  -H "Content-Type: application/json" \
  -H "Cookie: auriportal_session=COOKIE_ALUMNO" \
  -d '{
    "step_id": "preparacion_seleccion",
    "input": {
      "selected_items": ["respiracion_consciente", "enraizamiento"],
      "selection_source": "preparacion"
    }
  }'
```

### 5. Completar Step 3 (Timer preparación)

```bash
curl -X POST http://localhost:3000/api/recorridos/run/{RUN_ID}/submit \
  -H "Content-Type: application/json" \
  -H "Cookie: auriportal_session=COOKIE_ALUMNO" \
  -d '{
    "step_id": "preparacion_practica",
    "input": {
      "practice_completed": true,
      "duration_real_minutes": 5
    }
  }'
```

### 6. Completar Step 4 (Protecciones)

```bash
curl -X POST http://localhost:3000/api/recorridos/run/{RUN_ID}/submit \
  -H "Content-Type: application/json" \
  -H "Cookie: auriportal_session=COOKIE_ALUMNO" \
  -d '{
    "step_id": "protecciones_energeticas",
    "input": {
      "selected_items": ["escudo_luz"],
      "selection_source": "protecciones"
    }
  }'
```

### 7. Completar Step 5 (Limpieza - PUNTO DE RACHA)

```bash
curl -X POST http://localhost:3000/api/recorridos/run/{RUN_ID}/submit \
  -H "Content-Type: application/json" \
  -H "Cookie: auriportal_session=COOKIE_ALUMNO" \
  -d '{
    "step_id": "limpieza_energetica",
    "input": {
      "limpieza_completada": true,
      "transmutations_done": ["trans_1", "trans_2", "trans_3"],
      "mode_id": "basica"
    }
  }'
```

**⚡ Este es el ÚNICO punto donde se incrementa la racha.**

### 8-9. Completar Steps Restantes

```bash
# Step 6: transicion_racha (solo continuar)
curl -X POST http://localhost:3000/api/recorridos/run/{RUN_ID}/submit \
  -H "Content-Type: application/json" \
  -H "Cookie: auriportal_session=COOKIE_ALUMNO" \
  -d '{"step_id": "transicion_racha", "input": {}}'

# Step 7: post_limpieza_seleccion
curl -X POST http://localhost:3000/api/recorridos/run/{RUN_ID}/submit \
  -H "Content-Type: application/json" \
  -H "Cookie: auriportal_session=COOKIE_ALUMNO" \
  -d '{
    "step_id": "post_limpieza_seleccion",
    "input": {
      "selected_items": ["sellado_energetico"],
      "selection_source": "post_limpieza"
    }
  }'

# Step 8: post_limpieza_practica
curl -X POST http://localhost:3000/api/recorridos/run/{RUN_ID}/submit \
  -H "Content-Type: application/json" \
  -H "Cookie: auriportal_session=COOKIE_ALUMNO" \
  -d '{
    "step_id": "post_limpieza_practica",
    "input": {
      "practice_completed": true,
      "duration_real_minutes": 2
    }
  }'

# Step 9: cierre (finaliza recorrido)
curl -X POST http://localhost:3000/api/recorridos/run/{RUN_ID}/submit \
  -H "Content-Type: application/json" \
  -H "Cookie: auriportal_session=COOKIE_ALUMNO" \
  -d '{"step_id": "cierre", "input": {}}'

# Respuesta final esperada:
# {
#   "run": {
#     "status": "completed",
#     ...
#   },
#   "step": null
# }
```

---

## 🌐 Probar desde Navegador

### Admin: Verificar en UI

1. Ir a: `https://tu-dominio.com/admin/recorridos`
2. Buscar: "limpieza_energetica_diaria_v1"
3. Click en "Editar"
4. Verificar que muestra 9 steps
5. Verificar que el flujo es lineal

### Alumno: Lanzar recorrido

1. Login como alumno
2. Ir a: `https://tu-dominio.com/practica` (o donde esté el hub de prácticas)
3. Click en "Limpieza Energética Diaria"
4. Completar el flujo de 9 steps

---

## 🔒 Checklist de Seguridad

### ✅ NO se crearon tablas nuevas
- [ ] Verificar que no hay nuevos archivos en `database/migrations/`

### ✅ NO se rompieron UIs existentes
- [ ] Verificar `/admin/recorridos` funciona
- [ ] Verificar `/admin/preparaciones-practica` funciona
- [ ] Verificar `/enter` funciona

### ✅ NO se rompió el runtime
- [ ] Verificar que PM2 está `online`
- [ ] Verificar `/health-check`

### ✅ Handlers existentes funcionan
- [ ] `selection_handler_v1` carga items de catálogos
- [ ] `practice_timer_handler_v1` calcula duración
- [ ] `limpieza_energetica_handler` ejecuta racha

---

## 📊 Comandos de Diagnóstico

```bash
# Ver estado PM2
pm2 status aurelinportal

# Ver logs recientes
pm2 logs aurelinportal --lines 50 --nostream

# Health check
curl http://localhost:3000/health-check

# Listar recorridos existentes
curl http://localhost:3000/admin/api/recorridos \
  -H "Cookie: auriportal_session=TU_COOKIE_ADMIN"

# Ver audit log del recorrido
psql -U tu_usuario -d tu_db -c "
  SELECT action, created_at, created_by, details_json
  FROM recorrido_audit_log
  WHERE recorrido_id = 'limpieza_energetica_diaria_v1'
  ORDER BY created_at DESC
  LIMIT 10;
"
```

---

## 🔮 Próximos Pasos (No en este prompt)

1. **UI de Timer**: Crear componente HTML para `screen_practice_timer`
2. **UI de Selección**: Mejorar componente para `screen_toggle_resources`
3. **Integración con Home**: Añadir botón en área "Práctica" para lanzar el recorrido
4. **Analytics**: Implementar dashboard de métricas de uso

---

**Documento generado:** 2025-12-17  
**Autor:** Sistema AuriPortal






