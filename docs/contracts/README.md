# Contratos Canónicos - AuriPortal MASTER

Este directorio contiene los contratos canónicos que definen el comportamiento esperado de los sistemas principales de AuriPortal.

---

## Contratos Disponibles

### Cleaning Engine

1. **RESET_CONTRACT_V1.md**
   - Contrato canónico del sistema de Reset
   - Define cómo Reset marca el inicio de un nuevo ciclo de limpieza
   - Versión: 1.0
   - Estado: Activo

2. **SEED_CONTRACT_V1.md**
   - Contrato canónico del Cleaning State Seed
   - Define cómo Seed crea estados iniciales "NUNCA"
   - Incluye SeedReadinessMetrics v1 (observabilidad READ)
   - Versión: 1.0
   - Estado: Activo

3. **OVERRIDES_CONTRACT_V1.md**
   - Contrato canónico del sistema de Overrides
   - Define cómo Overrides permiten sobrescribir valores base a nivel de alumno
   - Documenta orden de resolución, casos límite y comportamientos reales
   - **DECISIÓN ARQUITECTÓNICA (Opción B):** Megalist aplica overrides (vista de estado efectivo)
   - Todas las vistas READ aplican overrides consistentemente (flotante, list-projection, megalist)
   - Preparación futura: metadata de overrides en respuestas (NO implementado todavía)
   - Versión: 1.0
   - Estado: Activo
   - Actualizado: 2026-01-17 (decisión arquitectónica Opción B)

### Sistema de Señales

4. **SIGNALS_CONTRACT_V1.md**
   - Contrato canónico del sistema de señales
   - Define cómo las señales se emiten desde acciones WRITE
   - Versión: 1.0
   - Estado: Activo

---

## Relaciones entre Contratos

### RESET ↔ OVERRIDES

**Independencia:**
- RESET NO lee overrides
- RESET NO modifica overrides
- Overrides persisten después del reset
- Overrides se aplican correctamente después de RESET

**Referencias cruzadas:**
- `RESET_CONTRACT_V1.md` → `OVERRIDES_CONTRACT_V1.md`
- `OVERRIDES_CONTRACT_V1.md` → `RESET_CONTRACT_V1.md`

---

### SEED ↔ OVERRIDES

**Independencia:**
- SEED NO lee overrides
- SEED NO modifica overrides
- Overrides pueden existir antes del seed
- Overrides se aplican después del seed cuando existe estado

**Referencias cruzadas:**
- `SEED_CONTRACT_V1.md` → `OVERRIDES_CONTRACT_V1.md`
- `OVERRIDES_CONTRACT_V1.md` → `SEED_CONTRACT_V1.md`

---

### CLEAN ↔ OVERRIDES

**Independencia:**
- CLEAN NO lee overrides
- CLEAN NO modifica overrides
- Overrides persisten después de CLEAN
- Overrides se aplican correctamente después de CLEAN

**Referencia:**
- `DIAGNOSTICO_CLEAN_AFTER_RESET.md` → `OVERRIDES_CONTRACT_V1.md`

---

## Diagnósticos Relacionados

**Diagnósticos que documentan el comportamiento real:**
- `docs/DIAGNOSTICO_SEED_MASTER.md` - Análisis completo del sistema de seed
- `docs/DIAGNOSTICO_OVERRIDES_MASTER_CANONICO.md` - Análisis completo y canónico del sistema de overrides (2026-01-17)
  - ⚠️ Este diagnóstico reemplaza y actualiza `docs/DIAGNOSTICO_OVERRIDES_MASTER.md`
  - Refleja el comportamiento REAL verificado en código actual
- `docs/DIAGNOSTICO_CLEAN_AFTER_RESET.md` - Verificación de CLEAN después de RESET
- `docs/DIAGNOSTICO_THRESHOLD_RESET.md` - Análisis de PENDING después de RESET

---

## Versionado

**Versión actual:** 1.0  
**Fecha de activación:** 2026-01-13

**Historial:**
- v1.0 (2026-01-13): Contratos canónicos iniciales (RESET, SEED, OVERRIDES, SIGNALS)

---

**Última actualización:** 2026-01-17

**Cambios recientes:**
- 2026-01-17: Actualización de OVERRIDES_CONTRACT_V1.md basado en DIAGNOSTICO_OVERRIDES_MASTER_CANONICO.md
  - Documentación explícita del orden de resolución
  - Casos límite documentados (8 casos)
  - Inconsistencia megalist/flotante documentada como COMPORTAMIENTO ACTUAL
  - Riesgos conocidos marcados como COMPORTAMIENTO INTENCIONAL
- 2026-01-17: Actualización decisión arquitectónica Opción B (OVERRIDES_CONTRACT_V1.md)
  - Megalist aplica overrides (decisión arquitectónica Opción B)
  - Megalist es vista de estado efectivo
  - Todas las vistas READ aplican overrides consistentemente
  - Preparación futura: metadata de overrides en respuestas (NO implementado todavía)
  - Actualizado MASTER_API_ALQUIMIA_ALUMNO_CONTRACTS_V1.md con decisión Opción B
