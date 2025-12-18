# Checklist de Verificación - Sistema de Recorridos ⚠️ BETA

## Pre-requisitos

- [ ] Migraciones v5.1.0 aplicadas
- [ ] Migraciones v5.2.0 aplicadas
- [ ] Servidor reiniciado después de correcciones

---

## Verificación de Tablas

```bash
psql -U postgres -d auriportal -c "\dt recorr*"
```

- [ ] Tabla `recorridos` existe
- [ ] Tabla `recorrido_drafts` existe
- [ ] Tabla `recorrido_versions` existe
- [ ] Tabla `recorrido_audit_log` existe
- [ ] Tabla `recorrido_runs` existe
- [ ] Tabla `recorrido_step_results` existe
- [ ] Tabla `recorrido_events` existe

**Total esperado: 7 tablas**

---

## Verificación de UI Admin

- [ ] `/admin/recorridos` carga sin errores
- [ ] Lista de recorridos se muestra correctamente
- [ ] Botón "Crear Recorrido" visible

---

## Verificación de Flujo Editor

### Crear Recorrido
- [ ] Navegar a `/admin/recorridos/new/edit`
- [ ] Prompt de ID aparece
- [ ] Prompt de nombre aparece
- [ ] Recorrido se crea correctamente
- [ ] URL cambia a `/admin/recorridos/{id}/edit`

### Guardar Draft
- [ ] Añadir un step funciona
- [ ] Seleccionar step funciona
- [ ] Cambiar screen_template funciona
- [ ] Cambiar step_type funciona
- [ ] Auto-guardado activa (ver consola: "Draft guardado automáticamente")

### Añadir Branch/Edge
- [ ] Botón "Añadir Branch" funciona
- [ ] Selector "To Step" muestra steps disponibles
- [ ] Edge se guarda con `from_step_id` y `to_step_id` (verificar en DB o Network tab)

### Validar Draft
- [ ] Botón "Validar" funciona
- [ ] Mensajes de validación aparecen
- [ ] Errores muestran campos correctos (`from_step_id`, `to_step_id`, `step_type`)

### Publicar Versión
- [ ] Botón "Publicar" funciona
- [ ] Prompt de release notes aparece
- [ ] Versión se publica (alerta de confirmación)
- [ ] Badge de versión se actualiza

---

## Verificación de Runtime (API)

### startRun
```bash
curl -X POST http://localhost:3000/api/recorridos/{id}/start \
  -H "Content-Type: application/json" \
  -H "Cookie: {session_cookie}" \
  -d '{}'
```

- [ ] Respuesta incluye `run_id`
- [ ] Respuesta incluye `step` con `step_id`
- [ ] Respuesta incluye `step.step_type`
- [ ] Respuesta incluye `step.screen_template_id`

### submitStep
```bash
curl -X POST http://localhost:3000/api/recorridos/runs/{run_id}/submit \
  -H "Content-Type: application/json" \
  -H "Cookie: {session_cookie}" \
  -d '{"step_id": "{current_step_id}", "input": {}}'
```

- [ ] Respuesta incluye siguiente step
- [ ] Si no hay siguiente step, respuesta incluye `completed: true`

---

## Verificación de Contrato (Datos)

### Verificar Edge en DB
```sql
SELECT definition_json->'edges' 
FROM recorrido_drafts 
WHERE recorrido_id = '{id}';
```

- [ ] Cada edge tiene `from_step_id` (NO `from`)
- [ ] Cada edge tiene `to_step_id` (NO `to`)

### Verificar Step en DB
```sql
SELECT definition_json->'steps' 
FROM recorrido_drafts 
WHERE recorrido_id = '{id}';
```

- [ ] Cada step usa `step_type` (NO `step_type_id`)

---

## Estado Final

Si TODOS los checks pasan:

```
✅ Sistema de Recorridos: USABLE EN BETA ⚠️
```

Si ALGÚN check falla:

```
❌ Sistema de Recorridos: NO USABLE
   → Revisar log de errores
   → Verificar migraciones
   → Verificar correcciones de contrato
```

---

## Notas

- Este checklist verifica SOLO funcionalidad BETA
- NO incluye verificación de UX/UI avanzada
- NO incluye verificación de analíticas completas
- NO incluye verificación de todos los step types

---

Documento generado: 2025-01-XX
Versión: Corrección Controlada v1.0





