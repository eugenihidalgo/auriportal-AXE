# Source of Truth Certification (SOT-CERT) v1.0

**Fecha de creación:** 2025-01-XX  
**Estado:** LEY OPERATIVA  
**Versión:** 1.0

## ═══════════════════════════════════════════════════════════
## DEFINICIÓN DE SOURCE OF TRUTH EN AURIPORTAL
## ═══════════════════════════════════════════════════════════

Un **Source of Truth (SOT)** en AuriPortal es una entidad ontológica que:

1. **Representa conocimiento canónico** del sistema
2. **PostgreSQL es su única autoridad** (no SQLite, no legacy, no APIs externas en runtime)
3. **Es consumible sin contexto de UI** por Packages, Resolvers y Widgets
4. **Tiene contrato semántico explícito** que define qué representa y qué NO representa
5. **Tiene contrato de filtros canónicos** declarativo
6. **Expone API mínima obligatoria** para consumo programático

**Ejemplos de SOT válidos:**
- Técnicas de Limpieza Energética
- Transmutaciones Energéticas
- Recursos Interactivos
- Catálogos PDE

**NO son SOT:**
- Estado del alumno (es un agregado, no un SOT)
- Sesiones de usuario (es operativo, no conocimiento)
- Logs de auditoría (es histórico, no conocimiento canónico)

---

## ═══════════════════════════════════════════════════════════
## DIFERENCIA: SOT vs RELACIÓN DEL ALUMNO CON EL SOT
## ═══════════════════════════════════════════════════════════

### Source of Truth (SOT)

El SOT es **conocimiento puro**, independiente del alumno:

- **Qué es:** Catálogo canónico de entidades (ej: técnicas, transmutaciones)
- **Dónde vive:** PostgreSQL (tabla principal del SOT)
- **Quién lo crea:** Master/Admin
- **Quién lo modifica:** Master/Admin
- **Ejemplo:** `tecnicas_limpieza` (tabla con todas las técnicas)

### Relación del Alumno con el SOT

La relación es **estado del alumno** con respecto al SOT:

- **Qué es:** Estado específico del alumno (progreso, completado, etc.)
- **Dónde vive:** PostgreSQL (tabla de estado del alumno)
- **Quién lo crea:** Sistema automático o alumno
- **Quién lo modifica:** Sistema automático o alumno
- **Ejemplo:** `student_tecnica_progress` (progreso del alumno en cada técnica)

**Regla absoluta:**
> El SOT NO contiene estado del alumno. El estado del alumno referencia al SOT mediante FK o identificador.

---

## ═══════════════════════════════════════════════════════════
## REGLAS ABSOLUTAS
## ═══════════════════════════════════════════════════════════

### 1. PostgreSQL como Única Autoridad

- ✅ PostgreSQL es el único Source of Truth
- ❌ NO leer ClickUp, Kajabi u otros en runtime para decidir estado
- ❌ NO usar SQLite/legacy como fallback
- ❌ NO considerar APIs externas como "autoridad"

### 2. Sin Lógica en UI

- ✅ La UI solo consume el SOT
- ❌ NO filtrar en la UI
- ❌ NO calcular en la UI
- ❌ NO transformar datos en la UI

### 3. Sin Acoplamiento a Packages

- ✅ El SOT es independiente de Packages
- ✅ Los Packages consumen el SOT, no al revés
- ❌ NO crear dependencias del SOT hacia Packages
- ❌ NO incluir lógica de Packages en el SOT

---

## ═══════════════════════════════════════════════════════════
## CONTRATO SEMÁNTICO OBLIGATORIO
## ═══════════════════════════════════════════════════════════

Todo SOT DEBE declarar explícitamente:

### Qué Representa

**Ejemplo (Técnicas de Limpieza):**
> Representa el catálogo canónico de técnicas de transmutación energética disponibles en el sistema. Define qué técnicas existen, sus características (nivel, descripción, clasificaciones) y sus recursos asociados.

### Qué NO Representa

**Ejemplo (Técnicas de Limpieza):**
> NO representa:
> - El progreso del alumno en cada técnica
> - El estado de completado de un alumno
> - La frecuencia de uso por alumno
> - Datos históricos de práctica

**Ubicación:** Debe estar en `docs/SOT_<entidad>.md` en la sección "ROL ONTOLÓGICO".

---

## ═══════════════════════════════════════════════════════════
## CONTRATO DE FILTROS CANÓNICOS
## ═══════════════════════════════════════════════════════════

Todo SOT DEBE declarar explícitamente qué campos son filtrables y qué operadores están permitidos.

### Formato Obligatorio

```javascript
// src/core/repos/<entidad>-repo.js o src/services/<entidad>-service.js

/**
 * Contrato de filtros canónicos para <Entidad>
 * 
 * Campos filtrables:
 * - campo1: eq, lte, gte, in
 * - campo2: eq, contains, startsWith
 * - campo3: eq
 * 
 * Operadores permitidos:
 * - eq: igualdad exacta
 * - lte: menor o igual
 * - gte: mayor o igual
 * - contains: contiene (string)
 * - startsWith: empieza con (string)
 * - in: pertenece a array
 */
export const FILTER_CONTRACT = {
  campo1: ['eq', 'lte', 'gte', 'in'],
  campo2: ['eq', 'contains', 'startsWith'],
  campo3: ['eq']
};
```

### Operadores Permitidos

- **eq:** Igualdad exacta (`campo = valor`)
- **lte:** Menor o igual (`campo <= valor`)
- **gte:** Mayor o igual (`campo >= valor`)
- **contains:** Contiene substring (`campo LIKE '%valor%'`)
- **startsWith:** Empieza con (`campo LIKE 'valor%'`)
- **in:** Pertenece a array (`campo IN (valor1, valor2, ...)`)

**Regla:** Si un campo no está en el contrato, NO es filtrable.

---

## ═══════════════════════════════════════════════════════════
## API MÍNIMA OBLIGATORIA
## ═══════════════════════════════════════════════════════════

Todo SOT DEBE exponer el método:

```javascript
/**
 * Lista entidades del SOT para consumo programático
 * 
 * @param {Object} filters - Filtros según FILTER_CONTRACT
 * @param {Object} options - Opciones de consumo
 * @param {boolean} [options.onlyActive=true] - Solo activos
 * @param {number} [options.limit] - Límite de resultados
 * @param {number} [options.offset] - Offset para paginación
 * @param {string} [options.orderBy] - Campo de ordenamiento
 * @param {string} [options.orderDir='ASC'] - Dirección (ASC/DESC)
 * @param {Array<string>} [options.include] - Campos a incluir (inclusión parcial)
 * @param {Array<string>} [options.exclude] - Campos a excluir
 * @returns {Promise<Array>} Array de entidades
 */
async function listForConsumption(filters = {}, options = {}) {
  // Implementación que respeta FILTER_CONTRACT
}
```

### Características Obligatorias

1. **Respeta FILTER_CONTRACT:** Solo permite filtros declarados
2. **Sin contexto de UI:** Funciona sin saber qué pantalla lo consume
3. **Inclusión parcial:** Permite `include` para seleccionar campos
4. **Exclusión:** Permite `exclude` para omitir campos
5. **Composición:** Puede combinarse con otros SOT sin acoplamiento

**Ubicación:** Debe estar en el servicio canónico (`src/services/<entidad>-service.js`).

---

## ═══════════════════════════════════════════════════════════
## PREPARACIÓN PARA PACKAGES
## ═══════════════════════════════════════════════════════════

### Inclusión Parcial

Los Packages pueden solicitar solo campos necesarios:

```javascript
const tecnicas = await tecnicasLimpiezaService.listForConsumption(
  { nivel: { lte: 5 } },
  { include: ['id', 'nombre', 'nivel'] }
);
```

### Exclusión

Los Packages pueden excluir campos sensibles o innecesarios:

```javascript
const tecnicas = await tecnicasLimpiezaService.listForConsumption(
  {},
  { exclude: ['descripcion', 'metadata_interna'] }
);
```

### Composición

Los Packages pueden combinar múltiples SOT sin acoplamiento:

```javascript
const tecnicas = await tecnicasLimpiezaService.listForConsumption({ nivel: { lte: 5 } });
const recursos = await interactiveResourceService.listResourcesByOrigin(
  { sot: 'tecnicas-limpieza', entity_id: tecnica.id }
);
// Combinar sin que los SOT sepan del Package
```

---

## ═══════════════════════════════════════════════════════════
## PROHIBICIONES EXPLÍCITAS
## ═══════════════════════════════════════════════════════════

### ❌ PROHIBIDO: Lógica Semántica en UI

```javascript
// ❌ MAL
function renderTecnicas() {
  const todas = await listarTecnicas();
  const filtradas = todas.filter(t => t.nivel <= alumnoNivel); // Lógica en UI
  return filtradas;
}

// ✅ BIEN
function renderTecnicas() {
  const filtradas = await tecnicasLimpiezaService.listForConsumption(
    { nivel: { lte: alumnoNivel } }
  );
  return filtradas;
}
```

### ❌ PROHIBIDO: Filtros No Declarados

```javascript
// ❌ MAL
await tecnicasLimpiezaService.listForConsumption({
  nombre_custom: { contains: 'test' } // No está en FILTER_CONTRACT
});

// ✅ BIEN
await tecnicasLimpiezaService.listForConsumption({
  nombre: { contains: 'test' } // Está en FILTER_CONTRACT
});
```

### ❌ PROHIBIDO: Acoplamiento a Packages

```javascript
// ❌ MAL
class TecnicasLimpiezaService {
  async listForPackage(packageId) { // Conoce Packages
    // ...
  }
}

// ✅ BIEN
class TecnicasLimpiezaService {
  async listForConsumption(filters, options) { // No conoce Packages
    // ...
  }
}
```

### ❌ PROHIBIDO: SOT sin Documentación

```javascript
// ❌ MAL
// No existe docs/SOT_tecnicas-limpieza.md
// No hay contrato semántico
// No hay FILTER_CONTRACT

// ✅ BIEN
// Existe docs/SOT_tecnicas-limpieza.md
// Declara qué representa y qué NO representa
// Exporta FILTER_CONTRACT
```

---

## ═══════════════════════════════════════════════════════════
## CHECKLIST DE CERTIFICACIÓN
## ═══════════════════════════════════════════════════════════

Un SOT está **certificado** cuando cumple TODOS estos puntos:

### Documentación

- [ ] Existe `docs/SOT_<entidad>.md`
- [ ] Declara qué representa (ROL ONTOLÓGICO)
- [ ] Declara qué NO representa
- [ ] Documenta esquema de BD
- [ ] Documenta API de consumo

### Contrato de Filtros

- [ ] Existe `FILTER_CONTRACT` exportado
- [ ] Declara todos los campos filtrables
- [ ] Declara operadores permitidos por campo
- [ ] Está documentado en el servicio

### API de Consumo

- [ ] Existe método `listForConsumption(filters, options)`
- [ ] Respeta `FILTER_CONTRACT`
- [ ] Soporta inclusión parcial (`include`)
- [ ] Soporta exclusión (`exclude`)
- [ ] Funciona sin contexto de UI

### Separación de Responsabilidades

- [ ] NO hay lógica de filtrado en UI
- [ ] NO hay lógica de cálculo en UI
- [ ] NO hay acoplamiento a Packages
- [ ] PostgreSQL es única autoridad

### Verificación Automática

- [ ] Pasa `SOT_CERTIFICATION_CHECK` del Assembly Check System
- [ ] Estado: 🟢 OK (no WARN, no BROKEN)

---

## ═══════════════════════════════════════════════════════════
## EJEMPLOS: SOT CORRECTO vs INCORRECTO
## ═══════════════════════════════════════════════════════════

### ✅ SOT CORRECTO: Técnicas de Limpieza

**Documentación:**
```markdown
# docs/SOT_tecnicas-limpieza.md

## ROL ONTOLÓGICO
Representa el catálogo canónico de técnicas de transmutación energética.
NO representa el progreso del alumno.
```

**Contrato de Filtros:**
```javascript
// src/services/tecnicas-limpieza-service.js
export const FILTER_CONTRACT = {
  nivel: ['eq', 'lte', 'gte', 'in'],
  aplica_energias_indeseables: ['eq'],
  aplica_limpiezas_recurrentes: ['eq']
};
```

**API de Consumo:**
```javascript
export async function listForConsumption(filters = {}, options = {}) {
  // Valida filters contra FILTER_CONTRACT
  // Retorna entidades sin contexto de UI
}
```

**Resultado:** ✅ CERTIFICADO

---

### ❌ SOT INCORRECTO: Técnicas con Lógica en UI

**Problema 1: Filtrado en UI**
```javascript
// ❌ MAL
const todas = await listarTecnicas();
const filtradas = todas.filter(t => t.nivel <= nivelAlumno); // Lógica en UI
```

**Problema 2: Sin FILTER_CONTRACT**
```javascript
// ❌ MAL
// No existe FILTER_CONTRACT exportado
// No se sabe qué campos son filtrables
```

**Problema 3: Sin listForConsumption**
```javascript
// ❌ MAL
// Solo existe listarTecnicas() que retorna todo
// No hay método para consumo programático
```

**Resultado:** ❌ NO CERTIFICADO

---

## ═══════════════════════════════════════════════════════════
## APLICACIÓN AUTOMÁTICA
## ═══════════════════════════════════════════════════════════

A partir de la creación de este documento:

1. **Cursor aplica automáticamente** la regla `source-of-truth-certification-required`
2. **Assembly Check System** verifica certificación con `SOT_CERTIFICATION_CHECK`
3. **Ningún SOT puede existir** sin pasar la certificación
4. **Packages SOLO consumen** SOT certificados

---

## ═══════════════════════════════════════════════════════════
## ESTADO ACTUAL DE SOT EXISTENTES
## ═══════════════════════════════════════════════════════════

### Pendientes de Certificación

- **Técnicas de Limpieza:** Requiere `FILTER_CONTRACT` y `listForConsumption()`
- **Transmutaciones Energéticas:** Requiere `FILTER_CONTRACT` y `listForConsumption()`
- **Recursos Interactivos:** Requiere `FILTER_CONTRACT` y `listForConsumption()`

### Plan de Certificación

1. Añadir `FILTER_CONTRACT` a cada SOT
2. Implementar `listForConsumption()` en cada servicio
3. Verificar con `SOT_CERTIFICATION_CHECK`
4. Actualizar documentación

---

**Este documento es LEY OPERATIVA y debe respetarse sin excepciones.**







