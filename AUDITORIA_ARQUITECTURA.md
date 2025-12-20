# 🔍 AUDITORÍA DE ARQUITECTURA - AURIPORTAL
## Análisis de Riesgos Arquitectónicos (Priorizado)

**Fecha:** $(date)  
**Alcance:** Repositorio completo (excepto node_modules)  
**Método:** Análisis estático de dependencias, acoplamientos y responsabilidades

---

## 🚨 RIESGOS CRÍTICOS (Acción Inmediata Requerida)

### 1. **ROUTER MONOLÍTICO CON LÓGICA DE NEGOCIO INCORPORADA**
**Archivo:** `src/router.js` (625 líneas)

**Problema:**
- El router contiene **625 líneas** de lógica de enrutamiento mezclada con manejo de archivos estáticos, validaciones, transformaciones de dominio y lógica condicional compleja.
- **Duplicación masiva**: Las rutas están definidas **dos veces** (para `pdeeugenihidalgo.org` y para rutas generales).
- Manejo de archivos estáticos, cookies, autenticación, y lógica de negocio están todos en el mismo archivo.
- Dependencias implícitas con múltiples endpoints que se importan dinámicamente.

**Impacto:**
- Cualquier cambio en el router afecta a **todos** los endpoints.
- Modificar una ruta requiere cambios en múltiples lugares (duplicación).
- Difícil de testear: no se puede probar el router sin levantar todo el sistema.
- Imposible de escalar: cada nueva ruta hace el archivo más complejo.
- Violación del principio de responsabilidad única (SRP).

**Evidencia:**
```javascript
// Líneas 126-273: Rutas para pdeeugenihidalgo.org
// Líneas 416-516: Mismas rutas repetidas para rutas generales
// Líneas 59-123: Lógica de archivos estáticos mezclada
```

**Riesgo:** 🔴 **CRÍTICO** - Bloquea evolución del sistema

---

### 2. **ENDPOINTS CON ACCESO DIRECTO A BASE DE DATOS Y LÓGICA DE NEGOCIO**
**Archivos Afectados:** 30+ endpoints en `src/endpoints/*.js`

**Problema:**
- Los endpoints importan directamente `database/pg.js` y ejecutan queries SQL.
- Lógica de negocio (validaciones, transformaciones, cálculos) está dentro de los handlers.
- **Ejemplo crítico**: `src/endpoints/practicas-handler.js` contiene:
  - Validación de cookies
  - Lógica de sanitización HTML
  - Extracción de videoId de YouTube
  - Cálculos de ordenamiento
  - Generación de HTML
  - Todo mezclado con el handler HTTP

**Impacto:**
- **Imposible reutilizar** lógica de negocio fuera de endpoints HTTP.
- **Difícil testear**: Cada endpoint requiere mocks de HTTP, DB, cookies, etc.
- **Cambios en reglas de negocio** requieren tocar múltiples endpoints.
- **No hay separación** entre capa de presentación y capa de dominio.

**Evidencia:**
```javascript
// src/endpoints/practicas-handler.js línea 28-72: Función sanitizarHTML
// src/endpoints/practicas-handler.js línea 77-86: validarAlumno (lógica de negocio)
// src/endpoints/practicas-handler.js línea 91-112: extraerVideoId (lógica de dominio)
// src/endpoints/admin-panel.js línea 43-549: 506 líneas de HTML embebido en endpoint
```

**Riesgo:** 🔴 **CRÍTICO** - Viola arquitectura en capas

---

### 3. **DEPENDENCIAS CIRCULARES ENTRE MÓDULOS CORE**
**Archivos:** `src/modules/student-v4.js` ↔ `src/modules/nivel-v4.js`

**Problema:**
- `nivel-v4.js` importa `getDiasActivos` desde `student-v4.js` (línea 38, 131).
- `student-v4.js` se usa en múltiples lugares que también usan `nivel-v4.js`.
- Dependencia circular **implícita** a través de `actualizarNivelSiCorresponde` que se llama desde módulos que usan ambos.

**Impacto:**
- **Riesgo de errores de importación** en tiempo de ejecución.
- **Imposible refactorizar** sin romper dependencias.
- **Dificulta testing**: No se puede probar un módulo sin el otro.
- **Acoplamiento fuerte**: Cambiar cálculo de días activos afecta cálculo de niveles y viceversa.

**Evidencia:**
```javascript
// src/modules/nivel-v4.js línea 38:
const { getDiasActivos } = await import("./student-v4.js");

// src/modules/nivel-v4.js línea 131:
const { getDiasActivos } = await import("./student-v4.js");
```

**Riesgo:** 🔴 **CRÍTICO** - Puede causar fallos en runtime

---

### 4. **SISTEMA DE AUTENTICACIÓN DISPERSO Y DUPLICADO**
**Archivos:** `src/core/cookies.js`, 29 endpoints usando `getCookieData` directamente

**Problema:**
- **29 endpoints** validan cookies manualmente llamando `getCookieData(request)`.
- No hay middleware de autenticación centralizado.
- Cada endpoint replica la lógica: "si no hay cookie → renderPantalla0()".
- La validación del estudiante (verificar que existe en DB) está duplicada en múltiples lugares.

**Impacto:**
- **Cambiar lógica de autenticación** requiere modificar 29 archivos.
- **Inconsistencias**: Algunos endpoints validan, otros no.
- **Duplicación masiva** de código de validación.
- **No hay autorización granular**: No existe concepto de roles o permisos.

**Evidencia:**
```bash
# 29 endpoints usando getCookieData:
src/endpoints/perfil-personal.js
src/endpoints/limpieza-handler.js
src/endpoints/practicas-handler.js
# ... 26 más
```

**Riesgo:** 🔴 **CRÍTICO** - Vulnerabilidad de seguridad y mantenibilidad

---

## ⚠️ RIESGOS ALTOS (Requieren Atención Próxima)

### 5. **ACCESO DIRECTO A DATABASE SIN CAPA DE REPOSITORIO**
**Archivos:** 30+ archivos importando `database/pg.js` directamente

**Problema:**
- Los módulos y servicios importan directamente `query()` desde `database/pg.js`.
- No hay capa de repositorio que abstraiga las queries SQL.
- La lógica de mapeo objeto-relacional está dispersa (ej: `normalizeAlumno` en `student-v4.js`).

**Impacto:**
- **Cambiar estructura de DB** requiere modificar decenas de archivos.
- **No hay validación centralizada** de datos antes de insertar/actualizar.
- **Difícil migrar** a otro ORM o sistema de base de datos.
- **SQL hardcodeado** en múltiples lugares dificulta optimizaciones.

**Evidencia:**
```javascript
// 30 archivos importan directamente:
import { query } from '../../database/pg.js';
import { alumnos, pausas } from '../../database/pg.js';
```

**Riesgo:** 🟠 **ALTO** - Rigidez arquitectónica

---

### 6. **LÓGICA DE RENDERIZADO HTML DUPLICADA Y DISPERSA**
**Archivos:** `src/core/responses.js`, múltiples endpoints con funciones `replace()` propias

**Problema:**
- Función `replace()` para placeholders está **duplicada**:
  - `src/core/responses.js` línea 23
  - `src/endpoints/practicas-handler.js` línea 28
  - Probablemente en más lugares
- Lógica de aplicación de tema (`applyTheme`) está centralizada pero algunos endpoints generan HTML sin usarla.
- Sanitización HTML está duplicada en `practicas-handler.js` (línea 43) sin uso de librería estándar.

**Impacto:**
- **Inconsistencias** en cómo se procesan templates.
- **Cambios en formato de placeholders** requieren modificar múltiples archivos.
- **Vulnerabilidades XSS** si la sanitización no se aplica consistentemente.

**Evidencia:**
```javascript
// Duplicación de función replace():
// src/core/responses.js:23
function replace(html, placeholders) { ... }

// src/endpoints/practicas-handler.js:28
function replace(html, placeholders) { ... }
```

**Riesgo:** 🟠 **ALTO** - Mantenibilidad y seguridad

---

### 7. **SERVICIOS CON RESPONSABILIDADES MEZCLADAS**
**Archivos:** `src/services/practicas-service.js`, `src/services/clickup.js`

**Problema:**
- `practicas-service.js` orquesta llamadas a otros servicios pero también contiene lógica de transformación de datos.
- `clickup.js` mezcla comunicación HTTP con normalización de datos.
- No hay distinción clara entre:
  - **Servicios de dominio** (lógica de negocio)
  - **Servicios de infraestructura** (APIs externas, DB)

**Impacto:**
- **Difícil mockear** para tests: servicios mezclan I/O con lógica.
- **No hay inversión de dependencias**: servicios dependen de implementaciones concretas.
- **Imposible cambiar** proveedor de API sin modificar lógica de negocio.

**Riesgo:** 🟠 **ALTO** - Viola principios SOLID

---

### 8. **MÚLTIPLES VERSIONES DE MÓDULOS COEXISTIENDO**
**Archivos:** 
- `student.js`, `student-v4.js`, `student-v7.js`
- `nivel.js`, `nivel-v4.js`
- `streak.js`, `streak-v4.js`
- `suscripcion.js`, `suscripcion-v4.js`

**Problema:**
- **3 versiones diferentes** del módulo de estudiantes coexistiendo.
- Dependencias entre versiones: `student-v7.js` importa `student-v4.js`.
- **Inconsistencia**: Algunos módulos usan ClickUp (v3), otros PostgreSQL (v4).
- No hay documentación clara de qué versión usar dónde.

**Impacto:**
- **Confusión** sobre qué módulo usar en cada contexto.
- **Bugs** por usar versión incorrecta.
- **Duplicación masiva** de código.
- **Imposible eliminar código legacy** sin riesgo de romper algo.

**Evidencia:**
```javascript
// src/modules/student-v7.js línea 4:
import { createStudent as createStudentV4 } from './student-v4.js';
```

**Riesgo:** 🟠 **ALTO** - Complejidad técnica y deuda

---

## ⚡ RIESGOS MEDIOS (Vigilancia Continua)

### 9. **ROUTER CON MANEJO DE ARCHIVOS ESTÁTICOS MEZCLADO**
**Archivo:** `src/router.js` líneas 59-123

**Problema:**
- El router HTTP también maneja servir archivos estáticos (CSS, JS, imágenes).
- Lógica de seguridad (verificar que archivo está en `public/`) está en el router.
- Mezcla responsabilidades de enrutamiento HTTP con servicio de archivos.

**Impacto:**
- **No se puede usar** un servidor de archivos estáticos dedicado (Nginx, CDN) fácilmente.
- **Lógica duplicada** si se añade otro punto de entrada.
- **Performance**: Node.js sirviendo archivos estáticos es menos eficiente que Nginx.

**Riesgo:** 🟡 **MEDIO** - Arquitectura no óptima

---

### 10. **CONFIGURACIÓN HARDCODEADA EN MÚLTIPLES LUGARES**
**Archivos:** `server.js`, `src/router.js`, múltiples endpoints

**Problema:**
- IDs de listas ClickUp, IDs de formularios Typeform, nombres de campos, etc. están hardcodeados.
- `src/config/config.js` existe pero muchos módulos no lo usan.
- Variables mágicas dispersas: `CLICKUP.LIST_ID`, nombres de campos personalizados, etc.

**Impacto:**
- **Cambiar configuración** requiere buscar y reemplazar en múltiples archivos.
- **No hay validación** de configuración al inicio.
- **Difícil mantener** múltiples entornos (dev, staging, prod).

**Riesgo:** 🟡 **MEDIO** - Mantenibilidad

---

### 11. **ENDPOINTS ADMIN CON ACCESO SQL DIRECTO**
**Archivos:** `src/endpoints/sql-admin.js`, `src/endpoints/admin-panel.js`

**Problema:**
- Panel admin permite ejecutar **SQL arbitrario** (línea 474 en `admin-panel.js`).
- No hay sanitización ni validación de queries.
- **Riesgo de seguridad**: SQL injection, acceso a datos sensibles, borrado accidental.

**Impacto:**
- **Vulnerabilidad crítica** si el panel admin se expone incorrectamente.
- **Sin auditoría**: No hay logs de qué queries se ejecutan.
- **Sin permisos**: Cualquiera con acceso admin puede hacer cualquier cosa.

**Riesgo:** 🟡 **MEDIO** - Seguridad (pero mitigado si acceso restringido)

---

### 12. **DEPENDENCIAS IMPLÍCITAS ENTRE MÓDULOS DE NEGOCIO**
**Ejemplos:**
- `streak-v4.js` importa `suscripcion-v4.js` (línea 7)
- `nivel-v4.js` importa `student-v4.js` dinámicamente
- Múltiples servicios dependen de `clickup.js` sin abstracción

**Problema:**
- Dependencias no son explícitas en interfaces o contratos.
- Cambios en un módulo pueden romper otros sin que TypeScript/ESLint lo detecte.
- No hay inyección de dependencias: módulos importan directamente implementaciones concretas.

**Impacto:**
- **Bugs sutiles** cuando se cambian implementaciones.
- **Difícil testear** módulos de forma aislada.
- **Acoplamiento fuerte** entre módulos que deberían ser independientes.

**Riesgo:** 🟡 **MEDIO** - Acoplamiento

---

## 📊 RESUMEN DE IMPACTO

### Por Categoría:

| Categoría | Críticos | Altos | Medios | Total |
|-----------|----------|-------|--------|-------|
| Dependencias Implícitas | 1 | 2 | 1 | 4 |
| Acoplamientos Fuertes | 2 | 1 | 1 | 4 |
| Lógica en Lugar Incorrecto | 2 | 2 | 1 | 5 |
| Código Duplicado | 0 | 2 | 1 | 3 |
| **TOTAL** | **4** | **8** | **4** | **16** |

### Por Severidad:

- 🔴 **Críticos:** 4 riesgos (requieren acción inmediata)
- 🟠 **Altos:** 8 riesgos (requieren atención próxima)
- 🟡 **Medios:** 4 riesgos (vigilancia continua)

---

## 🎯 RECOMENDACIONES PRIORIZADAS

### Fase 1 (Inmediata - Riesgos Críticos):
1. **Refactorizar router** → Separar en router de rutas, middleware de autenticación, servidor de archivos estáticos
2. **Extraer lógica de negocio** de endpoints → Crear capa de servicios/use cases
3. **Resolver dependencias circulares** → Introducir módulos de cálculo independientes
4. **Centralizar autenticación** → Middleware de autenticación y autorización

### Fase 2 (Próxima - Riesgos Altos):
5. **Introducir capa de repositorio** → Abstraer acceso a base de datos
6. **Unificar sistema de templates** → Una sola función de renderizado
7. **Separar servicios** → Distinguir servicios de dominio de infraestructura
8. **Consolidar versiones** → Eliminar código legacy, migrar todo a v4/v7

### Fase 3 (Mediano Plazo - Riesgos Medios):
9. **Mover archivos estáticos** a Nginx/CDN
10. **Centralizar configuración** → Un solo archivo de config con validación
11. **Restringir acceso SQL admin** → Queries predefinidas, logs, permisos
12. **Inyección de dependencias** → Hacer dependencias explícitas

---

## 📝 NOTAS ADICIONALES

- **No se encontraron** riesgos relacionados con gestión de memoria o performance críticos (aunque el router monolítico puede ser un cuello de botella).
- **La arquitectura actual funciona**, pero presenta **barreras significativas para evolución y mantenimiento**.
- **La migración de ClickUp a PostgreSQL (v4)** está incompleta, creando inconsistencia en el sistema.
- **Falta documentación** de arquitectura y decisiones de diseño (ADRs).

---

**Fin del Informe de Auditoría**















