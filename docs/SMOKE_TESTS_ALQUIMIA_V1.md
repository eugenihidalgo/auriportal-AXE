# Smoke Tests Alquimia v1

**Fecha:** 2026-01-09  
**Versión:** 1.0.0  
**Dominio:** MASTER

---

## Descripción

Tests básicos de endpoints de limpieza sin navegador. Verifican que los endpoints responden correctamente y cumplen el contrato JSON canónico.

---

## Ubicación

**Script:** `scripts/test-alquimia-smoke.js`

**Comando:** `npm run test:alquimia-smoke`

---

## Cobertura

### Endpoints Testeados

1. **GET /master/api/alquimia-alumno/megalist**
   - Verifica respuesta JSON válida
   - Verifica campos `ok`, `data`, `trace_id`

2. **POST /master/api/alquimia-alumno/clean**
   - Verifica payload completo según CONTRATO LIMPIEZA v1
   - Verifica respuesta JSON (aunque falle por item_ref inexistente)

3. **GET /master/api/alquimia-general/items/:item_ref/students**
   - Verifica respuesta JSON válida (fail-open)
   - Verifica shape estable incluso si item no existe

4. **POST /master/api/alquimia-general/items/:item_ref/master/mark-clean-student**
   - Verifica payload completo según CONTRATO LIMPIEZA v1
   - Verifica respuesta JSON (aunque falle por item_ref inexistente)

5. **POST /master/api/alquimia-general/items/:item_ref/master/increment-all**
   - Verifica respuesta JSON válida
   - Verifica campo `updated` en respuesta

---

## Configuración

**Variables de entorno:**
- `API_BASE_URL` (opcional, default: `https://master.pdeeugenihidalgo.org`)

**Constantes de test:**
- `TEST_STUDENT_ID`: ID de alumno de prueba (default: `4`)
- `TEST_ITEM_REF`: Item ref de prueba (default: `'test-item-ref-001'`)

**Nota:** Si `TEST_ITEM_REF` no existe, los tests POST pueden fallar, pero verifican que el error viene en formato JSON canónico.

---

## Criterios PASS/FAIL

### PASS
- Todos los endpoints devuelven JSON válido
- Campos `ok`, `data`, `trace_id` presentes (cuando aplica)
- Errores vienen en formato JSON con campos `error` o `code`

### FAIL
- Respuesta no-JSON (HTML, texto plano, etc.)
- Campos requeridos faltantes (`ok`, `data`, `trace_id`)
- Errores sin formato JSON canónico

---

## Uso de `trace_id` para Forensics

### Ejemplo de Log PM2

```bash
pm2 logs aurelinportal --lines 100 | grep "trace-abc123"
```

### Qué Buscar

1. **Request recibido:**
   ```
   [TRACE-trace-abc123] [MasterApiAlquimiaAlumno] POST clean
   ```

2. **Payload recibido:**
   ```
   [TRACE-trace-abc123] Payload: { student_id: 4, item_ref: '...', item_kind: 'recurrente', ... }
   ```

3. **Validaciones:**
   ```
   [TRACE-trace-abc123] Validación: campos requeridos OK
   ```

4. **Cleaning Engine:**
   ```
   [TRACE-trace-abc123] [CleaningEngine] markCleanStudent ejecutado
   ```

5. **Errores:**
   ```
   [TRACE-trace-abc123] ERROR: Item no encontrado
   ```

---

## Ejecución

### Desarrollo Local

```bash
npm run test:alquimia-smoke
```

### CI/CD

```bash
API_BASE_URL=https://staging.master.pdeeugenihidalgo.org npm run test:alquimia-smoke
```

### Output Esperado

```
=== SMOKE TESTS ALQUIMIA v1 ===

Base URL: https://master.pdeeugenihidalgo.org
Test Student ID: 4
Test Item Ref: test-item-ref-001

✅ GET megalist devuelve JSON válido
   Trace ID: trace-abc123
✅ POST clean (Alquimia Alumno) con payload completo
   ⚠️  Clean falló (esperado si item_ref no existe): ITEM_NOT_FOUND
✅ GET students (flotante) devuelve JSON válido
   Trace ID: trace-def456, Students: 0
✅ POST mark-clean-student (Alquimia General) con payload completo
   ⚠️  Clean falló (esperado si item_ref no existe): ITEM_NOT_FOUND
✅ POST increment-all (+1 para todos) devuelve JSON válido
   ⚠️  Increment-all falló (esperado si item_ref no existe o no es una_vez): ITEM_NOT_FOUND

=== RESULTADOS ===
✅ Pasados: 5
❌ Fallidos: 0
Total: 5
```

---

## Mejoras Futuras

1. **Fixtures**: Crear items de prueba en setup y eliminarlos en teardown
2. **Assertions más estrictas**: Verificar valores específicos, no solo presencia de campos
3. **Rate limiting**: Verificar que no hay rate limiting en endpoints
4. **Idempotencia**: Verificar `execution_key` en respuestas exitosas

---

## Referencias

- [Alquimia Cierre Total v5.65.2](./ALQUIMIA_CIERRE_TOTAL_V5_65_2.md)
- [CONTRATO LIMPIEZA v1](./CONTRATO_LIMPIEZA_V1.md)
- Script: `scripts/test-alquimia-smoke.js`