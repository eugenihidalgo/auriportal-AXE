# Diagnóstico del Sistema de Tags - AuriPortal

**Fecha:** 2025-01-XX  
**Estado:** 🔍 DIAGNÓSTICO (SIN IMPLEMENTAR)  
**Objetivo:** Entender el estado actual de tags antes de proponer un Tags SOT v1

---

## 🎯 Resumen Ejecutivo

El sistema de tags en AuriPortal está **parcialmente normalizado**:

- ✅ **Transmutaciones**: Tags migrados a sistema canónico `pde_classification_terms` (tipo 'tag')
- ⚠️ **Señales (pde_signals)**: Tags en JSONB array sin normalización
- ⚠️ **Protecciones Energéticas**: Tags en JSONB array sin normalización

**Conclusión preliminar:** Existe un sistema canónico parcial, pero no está unificado para todos los dominios.

---

## 📊 Análisis por Dominio

### 1. Tags en Transmutaciones (✅ NORMALIZADO)

**Estado:** ✅ Sistema canónico implementado

**Tabla Legacy:**
- `listas_transmutaciones.tags` (JSONB array) - **DEPRECADO pero todavía existe**

**Sistema Canónico:**
- Tabla: `pde_classification_terms` (tipo: `'tag'`)
- Relación: `transmutacion_lista_classifications`
- Migración: `v5.36.0-classification-terms-canonical.sql`

**Cómo funciona:**
1. Tags se crean/normalizan usando `ensure_classification_term('tag', value)`
2. Tags se asocian a listas vía tabla de relación
3. Tags se consultan usando `pde-classification-terms-repo-pg.js`

**Evidencia:**
```sql
-- Migración v5.36.0 migró tags JSONB a términos canónicos
INSERT INTO pde_classification_terms (type, value, normalized)
SELECT DISTINCT 'tag' as type, tag_value as value, normalize_classification_term(tag_value) as normalized
FROM listas_transmutaciones l, jsonb_array_elements_text(l.tags) as tag_value
WHERE l.tags IS NOT NULL AND jsonb_array_length(l.tags) > 0;
```

**Servicios/Repos:**
- `src/infra/repos/pde-classification-terms-repo-pg.js` - Repositorio canónico
- `src/services/tecnicas-limpieza-clasificaciones-service.js` - Servicio de alto nivel
- `src/services/pde-transmutaciones-resolver.js` - Usa tags para filtrado (include_tags, exclude_tags)

---

### 2. Tags en Señales (pde_signals) (⚠️ NO NORMALIZADO)

**Estado:** ⚠️ JSONB array sin normalización

**Tabla:**
- `pde_signals.tags` (JSONB NOT NULL DEFAULT '[]'::jsonb)

**Propósito:**
- Categorización de señales (ej: ["streak","progress","analytics"])

**Evidencia:**
```sql
-- Migración v5.18.0-create-pde-senales.sql
tags JSONB NOT NULL DEFAULT '[]'::jsonb,
-- Array de tags para categorización (ej: ["streak","progress","analytics"])
```

**Uso actual:**
- Se almacenan como array JSONB
- No hay normalización
- No hay validación de valores permitidos
- No hay relación con catálogo canónico

**Búsqueda en código:**
- No se encontraron servicios específicos que normalicen o validen tags de señales
- Tags se almacenan directamente como arrays JSONB

---

### 3. Tags en Protecciones Energéticas (⚠️ NO NORMALIZADO)

**Estado:** ⚠️ JSONB array sin normalización

**Tabla:**
- `protecciones_energeticas.tags` (JSONB DEFAULT '[]'::jsonb)

**Evidencia:**
```sql
-- Migración v4.13.1-create-protecciones-energeticas.sql
tags JSONB DEFAULT '[]'::jsonb,
COMMENT ON COLUMN protecciones_energeticas.tags IS 'Tags asociados en formato JSONB array';
```

**Uso actual:**
- Similar a señales: array JSONB sin normalización
- No hay validación ni catálogo

---

## 🔍 Búsqueda de Uso de Tags

### Archivos que Usan Tags

1. **Transmutaciones (Normalizado):**
   - `src/services/tecnicas-limpieza-service.js` - Consulta tags normalizados
   - `src/services/pde-transmutaciones-resolver.js` - Filtrado por tags (include_tags, exclude_tags)
   - `src/infra/repos/pde-classification-terms-repo-pg.js` - Repositorio canónico

2. **Endpoints que Mencionan Tags:**
   - `src/endpoints/master-api-alquimia-general.js`
   - `src/endpoints/admin-transmutaciones-energeticas.js`
   - `src/endpoints/admin-transmutaciones-classification-api.js`
   - `src/endpoints/admin-senales-api.js`
   - `src/endpoints/admin-protecciones-energeticas.js`
   - `src/endpoints/protecciones-energeticas-api.js`

3. **Migraciones:**
   - `database/migrations/v5.36.0-classification-terms-canonical.sql` - Sistema canónico
   - `database/migrations/v5.23.0-transmutaciones-classification-v1.sql` - Tags JSONB legacy
   - `database/migrations/v5.18.0-create-pde-senales.sql` - Tags en señales
   - `database/migrations/v4.13.1-create-protecciones-energeticas.sql` - Tags en protecciones

---

## ❓ Preguntas Clave Respondidas

### ¿Existe un catálogo canónico de tags?

**Respuesta:** ✅ **PARCIAL**

- ✅ Sí existe para **Transmutaciones**: `pde_classification_terms` (tipo 'tag')
- ❌ No existe para **Señales** ni **Protecciones Energéticas**

### ¿Existen tags globales o por dominio?

**Respuesta:** ⚠️ **MIXTO**

- **Transmutaciones**: Tags normalizados y reutilizables (pueden ser compartidos entre listas)
- **Señales**: Tags específicos por señal (sin normalización)
- **Protecciones**: Tags específicos por protección (sin normalización)

**Conclusión:** No hay tags globales unificados. Cada dominio maneja tags de forma independiente.

### ¿Dónde se guardan realmente?

**Respuesta:**

1. **Transmutaciones (Normalizado):**
   - Tabla: `pde_classification_terms` (tipo 'tag')
   - Relación: `transmutacion_lista_classifications`
   - Columna legacy: `listas_transmutaciones.tags` (JSONB, deprecado pero existe)

2. **Señales:**
   - Columna: `pde_signals.tags` (JSONB array)

3. **Protecciones:**
   - Columna: `protecciones_energeticas.tags` (JSONB array)

### ¿Qué módulos los usan?

**Respuesta:**

**Transmutaciones (Normalizado):**
- `src/infra/repos/pde-classification-terms-repo-pg.js` - Repositorio
- `src/services/tecnicas-limpieza-clasificaciones-service.js` - Servicio
- `src/services/pde-transmutaciones-resolver.js` - Resolver (filtrado)

**Señales y Protecciones:**
- No se encontraron servicios/repositorios específicos
- Probablemente se usan directamente en endpoints/handlers

---

## 💡 Propuesta: Tags SOT v1

### Opción A: Extender Sistema Existente (RECOMENDADO)

**Extender `pde_classification_terms` para todos los dominios:**

**Ventajas:**
- ✅ Reutilizar infraestructura existente
- ✅ Ya está normalizado y probado
- ✅ Migración de transmutaciones ya completa

**Desventajas:**
- ⚠️ El nombre `pde_classification_terms` sugiere "PDE" pero podría usarse globalmente
- ⚠️ Requiere migración de señales y protecciones

**Implementación:**
1. Mantener `pde_classification_terms` como SOT global
2. Crear tablas de relación:
   - `pde_signal_tags` (signal_id, classification_term_id)
   - `proteccion_energetica_tags` (proteccion_id, classification_term_id)
3. Migrar datos JSONB a términos canónicos
4. Deprecar columnas JSONB (mantener por compatibilidad temporal)

---

### Opción B: Sistema Unificado Nuevo (NO RECOMENDADO)

**Crear nuevo sistema global de tags:**

**Ventajas:**
- ✅ Nombre genérico (ej: `tags_global`)
- ✅ Diseño desde cero para todos los casos de uso

**Desventajas:**
- ❌ Duplicación con sistema existente
- ❌ Requiere migración completa (incluyendo transmutaciones)
- ❌ Más complejidad y tiempo

**Conclusión:** No recomendado porque ya existe un sistema funcional.

---

### Opción C: Mantener Estado Actual (NO RECOMENDADO)

**Dejar como está (sin normalización global):**

**Desventajas:**
- ❌ Sin validación de tags
- ❌ Duplicación de valores (ej: "energia" vs "energía" vs "Energía")
- ❌ Sin autocomplete/UI consistente
- ❌ Sin búsqueda/filtrado unificado

**Conclusión:** No recomendado para un sistema en crecimiento.

---

## 🎯 Recomendación Final

**PROPONER: Opción A - Extender Sistema Existente**

**Razones:**
1. ✅ Ya existe infraestructura probada
2. ✅ Migración de transmutaciones ya completa
3. ✅ Repositorio y servicios ya implementados
4. ✅ Normalización y validación ya funcionando

**Plan de Implementación (NO IMPLEMENTAR AÚN):**

1. **Fase 1: Extender pde_classification_terms**
   - Renombrar conceptualmente a "tags globales" (mantener tabla)
   - Documentar que es SOT para todos los tags

2. **Fase 2: Migrar Señales**
   - Crear tabla `pde_signal_tags`
   - Migrar tags JSONB → términos canónicos
   - Actualizar servicios/endpoints

3. **Fase 3: Migrar Protecciones**
   - Crear tabla `proteccion_energetica_tags`
   - Migrar tags JSONB → términos canónicos
   - Actualizar servicios/endpoints

4. **Fase 4: Deprecar Columnas JSONB**
   - Marcar columnas como deprecated
   - Mantener por compatibilidad temporal
   - Documentar migración

---

## 📚 Referencias

- **Migración Canónica:** `database/migrations/v5.36.0-classification-terms-canonical.sql`
- **Repositorio:** `src/infra/repos/pde-classification-terms-repo-pg.js`
- **Servicio:** `src/services/tecnicas-limpieza-clasificaciones-service.js`
- **Resolver:** `src/services/pde-transmutaciones-resolver.js`

---

## ⚠️ NOTA IMPORTANTE

**ESTE ES UN DIAGNÓSTICO. NO SE DEBE IMPLEMENTAR NADA AÚN.**

Este documento sirve como:
- ✅ Análisis del estado actual
- ✅ Identificación de patrones
- ✅ Propuesta de solución
- ❌ NO es un plan de implementación aprobado

Cualquier implementación requiere:
1. Aprobación explícita
2. Plan de migración detallado
3. Tests y validación
4. Documentación actualizada

---

**Última actualización:** 2025-01-XX
