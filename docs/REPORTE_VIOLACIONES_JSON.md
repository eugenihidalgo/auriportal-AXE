# Reporte de Violaciones de Contrato JSON - Sistema de Contextos PDE

**Fecha**: 2025-01-20  
**Script**: `scripts/find-json-contract-violations.js`  
**Estado**: ✅ **TODAS LAS VIOLACIONES CORREGIDAS**

---

## Resumen Ejecutivo

Se ejecutó una verificación exhaustiva del contrato JSON en el sistema de contextos PDE, detectando y corrigiendo **2 violaciones**:

1. **Contexto `nivel_efectivo_pde`**: Tenía `allowed_values: []` siendo `type: 'number'` (violación de tipo)
2. **Contexto `nivel_efectivo_pde`**: Su `definition` no tenía el campo `kind` (violación de estructura)

---

## Violaciones Detectadas y Corregidas

### 1. Violación de Tipo: `allowed_values` en contexto no-enum

**Contexto**: `nivel_efectivo_pde`  
**Problema**: 
- `type: 'number'` pero tenía `allowed_values: []`
- Según el contrato: `allowed_values` solo debe existir para `type: 'enum'`

**Corrección**:
```sql
UPDATE pde_contexts 
SET allowed_values = NULL 
WHERE context_key = 'nivel_efectivo_pde';
```

**Resultado**: ✅ Corregido

---

### 2. Violación de Estructura: `definition` sin campo `kind`

**Contexto**: `nivel_efectivo_pde`  
**Problema**:
- `definition` no tenía el campo `kind`
- Según el contrato: `definition` debe tener `type`, `scope`, `kind` como mínimo

**Corrección**:
- Se reconstruyó `definition` desde las columnas dedicadas usando `buildDefinitionFromColumns()`
- El campo `kind: 'normal'` se agregó automáticamente

**Resultado**: ✅ Corregido

---

## Verificaciones Realizadas

### ✅ Tipos Incorrectos
- Verifica que `allowed_values` solo existe para `type: 'enum'`
- Verifica que `allowed_values` es array cuando `type: 'enum'`
- Verifica que `allowed_values` no está vacío cuando `type: 'enum'`

**Resultado**: ✅ 0 violaciones

### ✅ Campos Perdidos
- Verifica que `scope`, `type`, `kind` no son NULL
- Verifica que `definition` no es NULL
- Verifica que `allowed_values` no es NULL cuando `type: 'enum'`

**Resultado**: ✅ 0 violaciones

### ✅ Serialización Inválida
- Verifica que `definition` es JSON válido
- Verifica que `allowed_values` es JSON válido
- Verifica que `default_value` es JSON válido

**Resultado**: ✅ 0 violaciones

### ✅ Inconsistencias definition ↔ columnas
- Verifica que `definition.type === type`
- Verifica que `definition.scope === scope`
- Verifica que `definition.kind === kind`
- Verifica que `definition.allowed_values === allowed_values`
- Verifica que `definition.default_value === default_value`

**Resultado**: ✅ 0 violaciones

### ✅ Valores Inválidos
- Verifica que `default_value` está en `allowed_values` cuando `type: 'enum'`
- Verifica que `default_value` es `number` cuando `type: 'number'`
- Verifica que `default_value` es `boolean` cuando `type: 'boolean'`

**Resultado**: ✅ 0 violaciones (después de corregir la query SQL)

### ✅ Estructura de definition JSONB
- Verifica que `definition` tiene `type`, `scope`, `kind`
- Verifica que `definition` tiene `allowed_values` cuando `type: 'enum'`

**Resultado**: ✅ 0 violaciones

---

## Correcciones Aplicadas al Script

### Problema en Query SQL de Valores Inválidos

**Error Original**:
```sql
WHERE elem = default_value::text
```

**Problema**: `jsonb_array_elements_text()` devuelve `text`, pero la comparación con `default_value::text` no funcionaba correctamente debido a diferencias de formato JSONB.

**Solución**:
```sql
WHERE elem::text = default_value#>>'{}'
```

El operador `#>>'{}'` extrae el valor JSONB como texto sin comillas adicionales, permitiendo una comparación correcta.

---

## Contrato JSON Canónico

### Estructura de `definition` (derivado desde columnas)

```json
{
  "type": "string" | "number" | "boolean" | "enum",
  "scope": "system" | "structural" | "personal" | "package",
  "kind": "normal" | "level",
  "injected": boolean,
  "origin": "user_choice" | "system" | "derived",
  "description": string,
  "allowed_values": array<string> | null,  // Solo para type: 'enum'
  "default_value": any | null
}
```

### Reglas de Validación

1. **Tipo `enum`**:
   - `allowed_values` es obligatorio y debe ser un array no vacío
   - `default_value` (si existe) debe estar en `allowed_values`

2. **Tipos no-enum**:
   - `allowed_values` debe ser `NULL`
   - `default_value` debe coincidir con el tipo (`number` → number, `boolean` → boolean)

3. **Campos obligatorios**:
   - `scope`, `type`, `kind` nunca pueden ser `NULL`
   - `definition` nunca puede ser `NULL`

4. **Consistencia**:
   - `definition` siempre se construye desde las columnas dedicadas
   - Las columnas dedicadas son la única fuente de verdad

---

## Archivos Modificados

1. **`scripts/find-json-contract-violations.js`**:
   - Creado script de verificación completo
   - Corregida query SQL para comparación de valores enum

2. **Base de Datos**:
   - Corregido contexto `nivel_efectivo_pde`: `allowed_values` → `NULL`
   - Reconstruido `definition` para `nivel_efectivo_pde`

---

## Recomendaciones

1. ✅ **Ejecutar este script periódicamente** para detectar violaciones tempranas
2. ✅ **Integrar en CI/CD** para prevenir violaciones en producción
3. ✅ **Validar en backend** antes de guardar para prevenir violaciones

---

## Estado Final

✅ **TODAS LAS VIOLACIONES CORREGIDAS**  
✅ **CONTRATO JSON VALIDADO**  
✅ **SISTEMA CONSISTENTE**

---

**Generado por**: `scripts/find-json-contract-violations.js`  
**Última ejecución**: 2025-01-20

