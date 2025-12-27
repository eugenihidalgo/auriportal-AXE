# Protocolo Permanente para Cursor - AuriPortal

**Estado:** LEY OPERATIVA  
**Fecha:** 2025-01-XX  
**Aplicación:** TODAS las interacciones futuras

---

## PRINCIPIO FUNDAMENTAL

AuriPortal tiene reglas constitucionales estrictas.
**NO se puede avanzar por intuición ni asumir estados.**
**TODO debe verificarse en PostgreSQL y pasar por los contratos canónicos.**

---

## FASE 1 — MIGRACIONES (OBLIGATORIA)

Si creas o detectas una migración SQL:

1. **Ejecuta TÚ MISMO la migración en el servidor** usando:
   ```bash
   cat database/migrations/<archivo>.sql | sudo -u postgres psql -d aurelinportal
   ```

2. **Verifica el schema inmediatamente después** con:
   ```bash
   sudo -u postgres psql -d aurelinportal -c "\d <tabla>"
   ```

3. **SI la migración NO puede ejecutarse:**
   - DETENTE
   - Indícalo explícitamente
   - NO continúes con UI, API, repos ni services

**REGLA ABSOLUTA:**
```
DONE = migración aplicada + schema verificado
DONE ≠ código escrito
```

---

## FASE 2 — VERIFICACIÓN DE REALIDAD (ANTI-FANTASMAS)

Antes de escribir o modificar código que use una tabla:

- ✅ Comprueba **SIEMPRE** que las columnas existen realmente en PostgreSQL
- ❌ NO asumas que una migración anterior está aplicada
- ❌ NO confíes en el estado del repo
- ✅ **La base de datos MANDA, el código obedece**

Si el código usa una columna que no existe:
→ Eso es un **BUG CRÍTICO**
→ Debes arreglar el schema **ANTES** de tocar la UI

---

## FASE 3 — SOURCE OF TRUTH (SOT)

Si estás creando o modificando un Source of Truth:

**OBLIGATORIO:**
- ✅ Documento `docs/SOT_<entidad>.md`
- ✅ Contrato semántico explícito
- ✅ Exportar `FILTER_CONTRACT` en el service
- ✅ Implementar `listForConsumption(filters, options)`
- ✅ Prohibido filtrado en UI
- ✅ PostgreSQL es la única autoridad

Si el SOT NO está certificado:
→ NO continúes
→ El Assembly Check debe fallar

**Referencia:** `docs/SOURCE_OF_TRUTH_CERTIFICATION.md`

---

## FASE 4 — UI ADMIN (ISLAND)

Toda UI Admin DEBE:

- ✅ Estar registrada en `admin-route-registry.js`
- ✅ Pasar por `admin-router-resolver.js`
- ✅ Renderizar **SOLO** vía `renderAdminPage()`
- ✅ Usar DOM API exclusivamente
- ❌ NO usar `innerHTML` dinámico
- ❌ NO usar template literals con datos
- ❌ NO contener lógica semántica

**Si la UI no pasa por el resolver:**
→ **NO EXISTE**

---

## FASE 5 — DIAGNÓSTICO DE ERRORES

Si aparece:
- Error 500
- "Invalid or unexpected token"
- JSON.parse recibiendo HTML
- Column does not exist

**ASUME SIEMPRE:**
→ Error de migración o schema desalineado
→ **NO es un problema de frontend** hasta demostrar lo contrario

---

## FASE 6 — DECISIONES TÉCNICAS

Cuando existan varias opciones posibles:

- ✅ Elige **SIEMPRE** la más segura, reversible y canónica
- ✅ Prefiere arreglar el schema antes que adaptar el código
- ✅ Prefiere consistencia sistémica a velocidad
- ❌ NO introduzcas flags temporales ni hacks

---

## REGLA FINAL — AUTORIDAD

**Cursor NO está autorizado a:**
- ❌ Continuar sin migraciones aplicadas
- ❌ Fingir que algo funciona
- ❌ Ocultar errores
- ❌ Avanzar sin verificación real

**Si algo no cuadra:**
→ Detente
→ Explícalo
→ Pide confirmación explícita

---

## ORDEN DE PRIORIDAD

1. **PostgreSQL** es la autoridad
2. **Migraciones** deben estar aplicadas
3. **Schema** debe estar verificado
4. **Código** debe reflejar la realidad
5. **UI** debe consumir el código canónico

---

## CHECKLIST ANTES DE DECLARAR "DONE"

Antes de declarar cualquier trabajo como completado:

- [ ] ¿Se creó/modificó una migración? → ¿Está aplicada?
- [ ] ¿Se modificó el schema? → ¿Está verificado en PostgreSQL?
- [ ] ¿Es un SOT? → ¿Está certificado?
- [ ] ¿Es UI Admin? → ¿Pasa por el resolver?
- [ ] ¿Hay errores? → ¿Se diagnosticó correctamente?

**Si alguna respuesta es NO → NO está DONE**

---

**Este protocolo es permanente y se aplica a TODAS las interacciones futuras en AuriPortal.**


