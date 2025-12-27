# RESUMEN: Formalización del Contrato B - Mutación de Entidades Vivas
## Implementación de Capa de Gobernanza y Guardarraíles

**Fecha**: 2025-01-XX  
**Estado**: ✅ COMPLETADO  
**Alcance**: Gobernanza del Contrato Canónico de Mutación de Entidades Vivas

---

## ARCHIVOS CREADOS/MODIFICADOS

### 1. Documento Canónico

**Archivo**: `docs/CONTRATO_CANONICO_MUTACION_ENTIDADES_VIVAS.md`

**Contenido**:
- 12 secciones completas
- Principios constitucionales (11 principios)
- Certificación de 5 mutaciones actuales
- Reglas no negociables (12 prohibiciones)
- Estado del sistema certificado

**Secciones principales**:
1. Propósito del contrato
2. Definición de mutación vs creación
3. Principios constitucionales (11 principios)
4. Punto canónico obligatorio
5. Separación mutación vs consecuencias
6. Auditoría obligatoria
7. Preparación de señales
8. Transacciones
9. Entidades y mutaciones actuales certificadas
10. Extensibilidad futura
11. Reglas no negociables
12. Estado del sistema

---

### 2. Reglas de Proyecto (Cursor)

**Archivo**: `.cursor/rules/CONTRATO_B_MUTACION_ENTIDADES_VIVAS.yml`

**Contenido**:
- 12 reglas constitucionales aplicables siempre (`alwaysApply: true`)
- Reglas directas y accionables
- Referencias al documento canónico
- Cobertura completa del contrato

**Reglas incluidas**:
- B1: No mutar desde endpoints
- B2: No mutar desde módulos de negocio
- B3: No mutar desde repositorios
- B4: Toda mutación pasa por servicio canónico
- B5: Toda mutación audita (fail-open)
- B6: Toda mutación prepara señal (no emitir)
- B7: Mutar NO calcula / NO decide
- B8: Mutar NO ejecuta consecuencias
- B9: Mutar NO emite señales
- B10: PostgreSQL única autoridad para mutaciones
- B11: Toda mutación acepta transacciones
- B12: Prohibido upsert como mutación canónica
- B13: Nueva mutación debe cumplir contrato completo

---

### 3. Checklist Operativo

**Archivo**: `docs/checklists/CHECKLIST_MUTACION_ENTIDADES_VIVAS.md`

**Contenido**:
- Checklist concreta y accionable para PRs
- 9 secciones de verificación
- Ejemplos de violaciones comunes
- Referencias al contrato canónico

**Secciones**:
1. Punto Canónico
2. Source of Truth
3. Auditoría
4. Señales
5. Transacciones
6. Separación de Responsabilidades
7. Lectura de Estado Anterior
8. Documentación (nuevas mutaciones)
9. Tests (recomendado)

---

### 4. Script de Verificación Estática

**Archivo**: `scripts/verify-live-entities-mutation-contract.js`

**Funcionalidad**:
- Busca violaciones obvias del contrato
- Recorre `src/endpoints/` y `src/modules/`
- Detecta patrones prohibidos:
  - Mutación directa desde repositorios (updateNivel, updateStreak, etc.)
  - UPDATE directo en tablas principales
- Excluye falsos positivos (tablas de relación, servicio canónico)
- Reporte estructurado con archivo, línea, patrón y recomendación

**Patrones detectados**:
- `studentRepo.updateNivel()` / `repo.updateNivel()`
- `studentRepo.updateStreak()` / `repo.updateStreak()`
- `studentRepo.updateUltimaPractica()` / `repo.updateUltimaPractica()`
- `studentRepo.updateEstadoSuscripcion()` / `repo.updateEstadoSuscripcion()`
- `studentRepo.updateApodo()` / `repo.updateApodo()`
- `UPDATE alumnos SET nivel_actual`
- `UPDATE alumnos SET streak`
- `UPDATE alumnos SET fecha_ultima_practica`
- `UPDATE alumnos SET estado_suscripcion`
- `UPDATE alumnos SET apodo`

**Exclusiones**:
- Tablas de relación (no son entidades vivas principales)
- Servicio canónico (donde está permitido)

---

### 5. Script NPM

**Archivo**: `package.json` (modificado)

**Añadido**:
```json
"verify:contract:mutations": "node scripts/verify-live-entities-mutation-contract.js"
```

**Uso**:
```bash
npm run verify:contract:mutations
```

---

### 6. Documentación

**Archivos modificados**:
- `README.md`: Sección añadida sobre contrato de mutación
- `docs/CONTRACT_OF_CONTRACTS.md`: Entity Mutation Contracts añadida

**Contenido**:
- Referencia al contrato canónico
- Cómo ejecutar verificación
- Ubicación de checklist y reglas

---

## CÓMO CORRER LA VERIFICACIÓN

### Opción 1: NPM Script (Recomendado)
```bash
npm run verify:contract:mutations
```

### Opción 2: Directo
```bash
node scripts/verify-live-entities-mutation-contract.js
```

---

## EJEMPLO DE SALIDA OK

```
═══════════════════════════════════════════════════════════════
🔍 VERIFICACIÓN DEL CONTRATO DE MUTACIÓN DE ENTIDADES VIVAS
═══════════════════════════════════════════════════════════════

Buscando violaciones en:
  - src/endpoints
  - src/modules

✅ No se encontraron violaciones del contrato.
```

**Exit code**: 0

---

## EJEMPLO DE SALIDA CON VIOLACIONES

```
═══════════════════════════════════════════════════════════════
🔍 VERIFICACIÓN DEL CONTRATO DE MUTACIÓN DE ENTIDADES VIVAS
═══════════════════════════════════════════════════════════════

Buscando violaciones en:
  - src/endpoints
  - src/modules

❌ Se encontraron 5 violación(es) del contrato:

1. src/endpoints/practica-registro.js:636
   Patrón: UPDATE directo de fecha_ultima_practica en tabla alumnos
   Código: `UPDATE alumnos SET fecha_ultima_practica = CURRENT_TIMESTAMP WHERE id = $1`,
   Recomendación: Usar StudentMutationService.updateUltimaPractica()

2. src/endpoints/practica-registro.js:656
   Patrón: UPDATE directo de streak en tabla alumnos
   Código: `UPDATE alumnos SET streak = streak + 1 WHERE id = $1`,
   Recomendación: Usar StudentMutationService.updateStreak()

3. src/endpoints/practica-registro.js:662
   Patrón: UPDATE directo de streak en tabla alumnos
   Código: `UPDATE alumnos SET streak = 1 WHERE id = $1`,
   Recomendación: Usar StudentMutationService.updateStreak()

4. src/modules/admin-data.js:580
   Patrón: UPDATE directo de nivel_actual en tabla alumnos
   Código: await query('UPDATE alumnos SET nivel_actual = $1 WHERE id = $2', [nivelAutomatico, alumnoId]);
   Recomendación: Usar StudentMutationService.updateNivel()

5. src/modules/nivel-v4.js:358
   Patrón: UPDATE directo de nivel_actual en tabla alumnos
   Código: 'UPDATE alumnos SET nivel_actual = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
   Recomendación: Usar StudentMutationService.updateNivel()

═══════════════════════════════════════════════════════════════
Referencia: CONTRATO_CANONICO_MUTACION_ENTIDADES_VIVAS.md
═══════════════════════════════════════════════════════════════
```

**Exit code**: 1

**Nota**: Las violaciones detectadas son casos conocidos donde se muta directamente en PostgreSQL sin pasar por el servicio canónico. Estas son violaciones del contrato que deberían corregirse en el futuro, pero no bloquean el funcionamiento actual del sistema.

---

## VERIFICACIÓN FINAL

### ✅ Archivos Creados

1. `docs/CONTRATO_CANONICO_MUTACION_ENTIDADES_VIVAS.md` - Documento canónico
2. `.cursor/rules/CONTRATO_B_MUTACION_ENTIDADES_VIVAS.yml` - Reglas de proyecto
3. `docs/checklists/CHECKLIST_MUTACION_ENTIDADES_VIVAS.md` - Checklist operativo
4. `scripts/verify-live-entities-mutation-contract.js` - Script de verificación

### ✅ Archivos Modificados

1. `package.json` - Script NPM añadido
2. `README.md` - Documentación añadida
3. `docs/CONTRACT_OF_CONTRACTS.md` - Entity Mutation Contracts añadida

### ✅ Sin Cambios de Runtime

- ✅ No se modificó lógica de negocio
- ✅ No se modificaron endpoints
- ✅ No se modificaron servicios
- ✅ No se refactorizó código existente
- ✅ Solo se añadieron reglas, docs, scripts y wiring

---

## ESTADO ACTUAL

**Contrato**: ✅ Documentado y certificado  
**Reglas**: ✅ Implementadas y activas  
**Checklist**: ✅ Disponible para PRs  
**Verificación**: ✅ Funcional y detectando violaciones  
**Documentación**: ✅ Integrada en README y docs centrales

**Mutaciones Certificadas**:
- ✅ `updateNivel()` - Actualiza nivel
- ✅ `updateStreak()` - Actualiza streak
- ✅ `updateUltimaPractica()` - Actualiza fecha última práctica
- ✅ `updateEstadoSuscripcion()` - Actualiza estado de suscripción
- ✅ `updateApodo()` - Actualiza apodo

---

## PRÓXIMOS PASOS (NO IMPLEMENTAR AÚN)

1. **Refactorizar `practica-registro.js`**: Debería usar `StudentMutationService.updateUltimaPractica()` y `updateStreak()` en lugar de UPDATE directo
2. **Refactorizar `admin-data.js`**: Debería usar `StudentMutationService.updateNivel()` en lugar de UPDATE directo
3. **Refactorizar `nivel-v4.js`**: Debería usar `StudentMutationService.updateNivel()` en lugar de UPDATE directo
4. **Integrar verificación en CI/CD**: Ejecutar `verify:contract:mutations` en pipeline

---

## COMPARACIÓN CON CONTRATO A

**Isomorfismo**: ✅ El Contrato B sigue exactamente el mismo patrón que el Contrato A

**Similitudes**:
- Misma estructura de documento canónico
- Mismo formato de reglas de Cursor
- Mismo formato de checklist
- Mismo formato de script de verificación
- Mismo nivel de rigor constitucional

**Diferencias**:
- Contrato A: Creación de entidades vivas
- Contrato B: Mutación de entidades vivas
- Contrato B incluye lectura de estado anterior (para auditoría)
- Contrato B incluye principio adicional: "Mutar NO emite señales"

---

**FIN DE RESUMEN**




