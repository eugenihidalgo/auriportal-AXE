# CONSTITUCIÓN PLATAFORMA - CAPA 1 (CIERRE CONSTITUCIONAL)

**Versión**: 1.0  
**Fecha**: 2026-01-11  
**Estado**: CANÓNICO

---

## ¿QUÉ ES LA CAPA 1?

La Capa 1 es el suelo técnico constitucional de AuriPortal. Define los contratos fundamentales que garantizan:

- **Consistencia**: Todos los componentes hablan el mismo idioma
- **Observabilidad**: Todo es rastreable y auditable
- **Atomicidad**: Operaciones críticas son transaccionales
- **Identidad**: UUID-only en runtime (preparación)
- **Señales**: Motor único con validación obligatoria

La Capa 1 NO es UI. NO es migración visual. Es el **contrato constitucional** que permite que MASTER y GOD operen sin re-arquitecturas posteriores.

---

## GARANTÍAS DE LA CAPA 1

### 1. SEÑALES - MOTOR ÚNICO REAL

**Contrato**: `dispatchSignal()` es el ÚNICO motor de emisión de señales.

**Reglas**:
- TODA emisión pasa por `dispatchSignal()`
- Validación obligatoria contra `student-signal-registry.js`
- Señales no registradas: log estructurado + métrica + flag `unregistered: true`
- Fail-open CONTROLADO (no bloquea, pero registra violación)
- Wrappers legacy (`emitSignal`) marcados como DEPRECATED

**Verificación**:
- `npm run check:signals-registry`
- Logs estructurados con prefijo `[SignalDispatcher]`

**Referencias**:
- `src/core/signals/signal-dispatcher.js`
- `src/core/student/signals/student-signal-registry.js`
- `docs/SIGNALS_CONTRACT_V1.md`

---

### 2. IDENTIDAD - STUDENTREF CANÓNICO

**Contrato**: UUID es la identidad canónica en runtime.

**Reglas**:
- Servicios nuevos aceptan UUID como entrada principal
- Legacy INTEGER solo en borde (si existe)
- Prohibido: nuevos usos de `alumno_id` en servicios nuevos
- Preparación para UUID-only en runtime futuro

**Verificación**:
- `npm run check:student-identity`
- Warnings en servicios que usan `alumno_id` directamente

**Referencias**:
- `docs/STUDENT_IDENTITY_CONTRACT_V1.md`

---

### 3. CONTRATO HTTP - JSON V1 OBLIGATORIO

**Contrato**: Todos los endpoints MASTER + GOD usan `http-json-v1.js`.

**Reglas**:
- `sendJsonOk()` / `sendJsonError()` son los únicos helpers válidos
- Headers canónicos: `Cache-Control`, `X-Trace-Id`, `Content-Type`
- Envelope canónico: `{ ok: true/false, data/error, trace_id }`
- Prohibido: helpers alternativos, dialectos manuales

**Verificación**:
- `npm run check:http-contract`
- Fail-hard en dialectos alternativos

**Referencias**:
- `src/core/http/http-json-v1.js`
- `docs/HTTP_CONTRACT_V1.md`

---

### 4. ATOMICIDAD - SERVICIOS CRÍTICOS

**Contrato**: Operaciones críticas son transaccionales.

**Reglas**:
- Persistencia dentro de transacción
- Emisión de señales fuera de transacción (fail-open)
- Helper canónico: `withTransaction()` en `database/pg.js`
- Servicios críticos: Cleaning, Place, Project, Sponsor

**Verificación**:
- Revisión manual de servicios críticos
- Logs estructurados con `trace_id`

**Referencias**:
- `database/pg.js` (función `withTransaction`)
- `docs/ATOMICITY_RULES_V1.md`

---

### 5. CONTEXTOS + SOT - PREPARACIÓN GOD

**Contrato**: Separación clara entre Source of Truth y proyección.

**Reglas**:
- Estados SOT: PostgreSQL es autoridad
- Estados proyección: derivados, no autoridad
- GOD NO introduce lógica de negocio
- Documentación inline en servicios clave

**Referencias**:
- `docs/CERTIFICACION_SOURCE_OF_TRUTH_FASE1.md`

---

## QUÉ NO SE PERMITE A PARTIR DE AHORA

### ❌ PROHIBIDO

1. **Señales ad-hoc sin registro**
   - Emitir señales `student.*`, `place.*`, `project.*`, `sponsor.*` sin estar en registry
   - Usar wrappers legacy sin migrar a `dispatchSignal()`

2. **Dialectos HTTP alternativos**
   - Helpers alternativos a `sendJsonOk`/`sendJsonError`
   - Respuestas JSON manuales sin envelope canónico

3. **Nuevos servicios con `alumno_id`**
   - Usar `alumno_id` directamente en parámetros de funciones exportadas
   - No documentar legacy resolution en borde

4. **Operaciones críticas sin transacciones**
   - Persistencia fuera de transacción en servicios críticos
   - Señales dentro de transacción (deben estar fuera)

5. **Lógica de negocio en GOD**
   - GOD solo proyecta, no decide
   - Decisiones solo en servicios MASTER

---

## VERIFICACIÓN

### Checks Obligatorios

```bash
npm run check:all
```

Incluye:
- `check:god-ui`: Estructura GOD
- `check:http-contract`: Contrato HTTP
- `check:student-identity`: Contrato identidad
- `check:signals-registry`: Registry de señales

### Servidor Limpio

El servidor debe arrancar sin errores:
```bash
npm start
# o
pm2 restart aurelinportal
```

---

## ROADMAP FUTURO

### Sprint 2 (Preparación)
- Fail-hard en señales no registradas (GOD/Master new path)
- UUID-only obligatorio en runtime
- Transacciones aplicadas a todos los servicios críticos

### Sprint 3+ (Evolución)
- Migración completa a UUID
- Eliminación de wrappers legacy
- Optimizaciones de atomicidad

---

## REFERENCIAS

- `docs/SIGNALS_CONTRACT_V1.md`: Contrato de señales
- `docs/STUDENT_IDENTITY_CONTRACT_V1.md`: Contrato de identidad
- `docs/HTTP_CONTRACT_V1.md`: Contrato HTTP
- `docs/ATOMICITY_RULES_V1.md`: Reglas de atomicidad
- `ARCHITECTURE.md`: Arquitectura general

---

**ESTADO**: ✅ CAPA 1 CERRADA (2026-01-11)
