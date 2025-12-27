# RESUMEN: Formalización del Contrato C - Señales Canónicas
## Implementación de Capa de Gobernanza y Guardarraíles

**Fecha**: 2025-01-XX  
**Estado**: ✅ COMPLETADO  
**Alcance**: Gobernanza del Contrato Canónico de Señales del Sistema

---

## ARCHIVOS CREADOS/MODIFICADOS

### 1. Documento Canónico

**Archivo**: `docs/CONTRATO_CANONICO_SENALES.md`

**Contenido**:
- 11 secciones completas
- Principios constitucionales (8 principios)
- Certificación de 7 señales actuales
- Reglas no negociables (10 prohibiciones)
- Estado del sistema certificado

**Secciones principales**:
1. Propósito del contrato
2. Definición formal de señal
3. Separación de responsabilidades
4. Principios constitucionales (8 principios)
5. Tipos de señales (Dominio vs Observabilidad)
6. Estructura canónica de una señal
7. Dónde se preparan señales
8. Dónde está prohibido preparar/emitir señales
9. Relación con contratos A y B
10. Reglas no negociables
11. Estado del sistema

---

### 2. Reglas de Proyecto (Cursor)

**Archivo**: `.cursor/rules/CONTRATO_C_SENALES.yml`

**Contenido**:
- 12 reglas constitucionales aplicables siempre (`alwaysApply: true`)
- Reglas directas y accionables
- Referencias al documento canónico
- Cobertura completa del contrato

**Reglas incluidas**:
- C1: No emitir señales desde servicios canónicos
- C2: No ejecutar automatizaciones al preparar señales
- C3: No mutar estado desde señales
- C4: No llamar sistemas externos desde señales
- C5: No usar señales como control de flujo
- C6: Toda señal debe tener estructura canónica
- C7: Toda señal debe estar versionada
- C8: Las señales son inmutables
- C9: Las señales solo describen hechos
- C10: Preparar señales solo en servicios canónicos
- C11: Señales obligatorias en creación y mutación
- C12: Nueva señal debe cumplir contrato completo

---

### 3. Checklist Operativo

**Archivo**: `docs/checklists/CHECKLIST_SENALES.md`

**Contenido**:
- Checklist concreta y accionable para PRs
- 9 secciones de verificación
- Ejemplos de violaciones comunes
- Referencias al contrato canónico

**Secciones**:
1. Preparación de Señales
2. Estructura Canónica
3. Emisión
4. Separación de Responsabilidades
5. Inmutabilidad
6. Versionado
7. Relación con Contratos A y B
8. Documentación (nuevas señales)
9. Tests (recomendado)

---

### 4. Script de Verificación Estática

**Archivo**: `scripts/verify-signals-contract.js`

**Funcionalidad**:
- Busca violaciones obvias del contrato
- Recorre `src/core/services/` y `src/modules/`
- Detecta patrones prohibidos:
  - Emisión de señales desde servicios canónicos
  - Ejecución de automatizaciones al preparar señales
  - Mutación de estado desde señales
  - Llamadas a sistemas externos desde señales
  - Uso de señales como control de flujo
- Excluye archivos legítimos (pde-signal-emitter.js, package-engine.js, admin-signals-api.js)
- Reporte estructurado con archivo, línea, patrón y recomendación

**Patrones detectados**:
- `emitSignal()` en servicios canónicos
- `triggerAutomation()` / `executeAutomation()` / `runAutomation()`
- Mutaciones dentro de `_prepareSignal()`
- Llamadas a APIs externas dentro de `_prepareSignal()`
- Uso de señales en `if` / `switch` / operadores ternarios

**Exclusiones**:
- `pde-signal-emitter.js` (sistema legítimo de emisión)
- `package-engine.js` (emisión legítima en otra fase)
- `admin-signals-api.js` (emisión legítima desde Admin)

---

### 5. Script NPM

**Archivo**: `package.json` (modificado)

**Añadido**:
```json
"verify:contract:signals": "node scripts/verify-signals-contract.js"
```

**Uso**:
```bash
npm run verify:contract:signals
```

---

### 6. Documentación

**Archivos modificados**:
- `README.md`: Sección añadida sobre contrato de señales
- `docs/CONTRACT_OF_CONTRACTS.md`: Entity Signals Contracts añadida

**Contenido**:
- Referencia al contrato canónico
- Cómo ejecutar verificación
- Ubicación de checklist y reglas

---

## CÓMO CORRER LA VERIFICACIÓN

### Opción 1: NPM Script (Recomendado)
```bash
npm run verify:contract:signals
```

### Opción 2: Directo
```bash
node scripts/verify-signals-contract.js
```

---

## EJEMPLO DE SALIDA OK

```
═══════════════════════════════════════════════════════════════
🔍 VERIFICACIÓN DEL CONTRATO DE SEÑALES CANÓNICAS
═══════════════════════════════════════════════════════════════

Buscando violaciones en:
  - src/core/services
  - src/modules

✅ No se encontraron violaciones del contrato.
```

**Exit code**: 0

---

## EJEMPLO DE SALIDA CON VIOLACIONES

```
═══════════════════════════════════════════════════════════════
🔍 VERIFICACIÓN DEL CONTRATO DE SEÑALES CANÓNICAS
═══════════════════════════════════════════════════════════════

Buscando violaciones en:
  - src/core/services
  - src/modules

❌ Se encontraron 2 violación(es) del contrato:

1. src/core/services/student-mutation-service.js:150
   Patrón: Emisión de señal desde servicio canónico
   Código: await emitSignal(signalData);
   Recomendación: Las señales solo se preparan en servicios canónicos, no se emiten

2. src/core/services/student-mutation-service.js:230
   Patrón: Ejecución de automatización al preparar señal
   Código: await triggerAutomation(signalData);
   Recomendación: Las automatizaciones se ejecutan después, cuando se emite la señal

═══════════════════════════════════════════════════════════════
Referencia: CONTRATO_CANONICO_SENALES.md
═══════════════════════════════════════════════════════════════
```

**Exit code**: 1

**Nota**: Estas son violaciones hipotéticas. El sistema actual cumple el contrato: las señales solo se preparan, no se emiten desde servicios canónicos.

---

## VERIFICACIÓN FINAL

### ✅ Archivos Creados

1. `docs/CONTRATO_CANONICO_SENALES.md` - Documento canónico
2. `.cursor/rules/CONTRATO_C_SENALES.yml` - Reglas de proyecto
3. `docs/checklists/CHECKLIST_SENALES.md` - Checklist operativo
4. `scripts/verify-signals-contract.js` - Script de verificación

### ✅ Archivos Modificados

1. `package.json` - Script NPM añadido
2. `README.md` - Documentación añadida
3. `docs/CONTRACT_OF_CONTRACTS.md` - Entity Signals Contracts añadida

### ✅ Sin Cambios de Runtime

- ✅ No se modificó lógica de negocio
- ✅ No se modificaron servicios
- ✅ No se modificaron automatizaciones
- ✅ No se refactorizó código existente
- ✅ Solo se añadieron reglas, docs, scripts y wiring

---

## ESTADO ACTUAL

**Contrato**: ✅ Documentado y certificado  
**Reglas**: ✅ Implementadas y activas  
**Checklist**: ✅ Disponible para PRs  
**Verificación**: ✅ Funcional y sin violaciones detectadas  
**Documentación**: ✅ Integrada en README y docs centrales

**Señales Certificadas**:
- ✅ `student.created` - Preparada en `createStudent()`
- ✅ `student.practice_registered` - Preparada en `createStudentPractice()`
- ✅ `student.level_changed` - Preparada en `updateNivel()`
- ✅ `student.streak_changed` - Preparada en `updateStreak()`
- ✅ `student.last_practice_updated` - Preparada en `updateUltimaPractica()`
- ✅ `student.subscription_status_changed` - Preparada en `updateEstadoSuscripcion()`
- ✅ `student.apodo_changed` - Preparada en `updateApodo()`

---

## RELACIÓN CON CONTRATOS A Y B

### Contrato A: Creación de Entidades Vivas
- Toda creación DEBE preparar señal
- La señal se prepara en el servicio canónico
- La señal NO se emite durante la creación

### Contrato B: Mutación de Entidades Vivas
- Toda mutación DEBE preparar señal
- La señal se prepara en el servicio canónico
- La señal NO se emite durante la mutación

### Contrato C: Señales Canónicas
- Define qué es una señal y cómo se prepara
- Prohíbe emisión desde servicios canónicos
- Establece estructura canónica
- Completa los Contratos A y B

**Isomorfismo**: ✅ El Contrato C sigue exactamente el mismo patrón que los Contratos A y B

---

## PRÓXIMOS PASOS (NO IMPLEMENTAR AÚN)

1. **Implementar motor de emisión de señales**: Sistema dedicado para emitir señales preparadas
2. **Implementar consumidores de señales**: Automatizaciones que reaccionan a señales emitidas
3. **Integrar verificación en CI/CD**: Ejecutar `verify:contract:signals` en pipeline
4. **Registro canónico de señales**: Registry centralizado de tipos de señales y sus contratos

---

## COMPARACIÓN CON CONTRATOS A Y B

**Isomorfismo**: ✅ El Contrato C sigue exactamente el mismo patrón que los Contratos A y B

**Similitudes**:
- Misma estructura de documento canónico
- Mismo formato de reglas de Cursor
- Mismo formato de checklist
- Mismo formato de script de verificación
- Mismo nivel de rigor constitucional

**Diferencias**:
- Contrato A: Creación de entidades vivas
- Contrato B: Mutación de entidades vivas
- Contrato C: Señales canónicas (completa A y B)
- Contrato C incluye principios adicionales sobre emisión y consumo

---

**FIN DE RESUMEN**





