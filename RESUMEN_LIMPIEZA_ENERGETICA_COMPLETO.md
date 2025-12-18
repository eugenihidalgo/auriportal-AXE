# 📋 Resumen Exhaustivo: Sistema de Limpieza Energética del AuriPortal

## 🎯 Propósito del Sistema

El sistema de limpieza energética permite a los alumnos realizar diferentes tipos de limpiezas (rápida, básica, profunda, total) de aspectos energéticos organizados en listas de transmutaciones. El sistema gestiona el estado de cada aspecto por alumno, calcula frecuencias, y permite tanto limpiezas individuales como globales por parte del Master.

---

## 📁 Estructura de Archivos

### **1. Endpoints (Handlers de Rutas)**

#### `/var/www/aurelinportal/src/endpoints/limpieza-handler.js`
**Propósito**: Handler principal para las pantallas de limpieza energética del alumno

**Funciones principales**:
- `renderLimpiezaPrincipal(request, env)`: Renderiza la pantalla principal con 4 botones (rápida, básica, profunda, total)
- `renderLimpiezaTipo(request, env, tipoLimpieza)`: Renderiza la pantalla de un tipo específico de limpieza con aspectos y técnicas
- `handleMarcarLimpio(request, env)`: Endpoint POST para marcar un aspecto como limpio
- `handleVerificarCompletada(request, env)`: Endpoint POST para verificar si una limpieza está completada

**Tecnologías usadas**:
- Node.js ES Modules
- Template engine personalizado con placeholders `{{KEY}}` y condicionales `{{#KEY}}...{{/KEY}}`
- Sistema de reemplazo de templates con soporte para condicionales anidados
- Integración con cookies para autenticación
- Fetch API para llamadas AJAX desde el frontend

**Dependencias**:
- `getCookieData` de `../core/cookies.js`
- `getOrCreateStudent` de `../modules/student-v4.js`
- `obtenerAspectosParaLimpieza` de `../services/transmutaciones-energeticas.js`
- `limpiarItemParaAlumno` de `../services/transmutaciones-energeticas.js`
- `obtenerTecnicasPorNivel` de `../services/tecnicas-limpieza.js`
- `checkDailyStreak` de `../modules/streak.js`

---

#### `/var/www/aurelinportal/src/endpoints/limpieza-master.js`
**Propósito**: Endpoints para que el Master realice limpiezas (individuales y globales)

**Funciones principales**:
- `limpiarAspectoIndividual(request, env)`: Limpia un aspecto para un alumno específico
- `limpiarAspectoGlobal(request, env)`: Limpia un aspecto para todos los suscriptores activos
- `obtenerEstadoAspecto(request, env)`: Obtiene el estado de un aspecto para todos los alumnos

**Tecnologías usadas**:
- Autenticación de admin mediante `requireAdminAuth`
- Soporte para múltiples tipos de aspectos: 'anatomia', 'karmicos', 'indeseables', 'limpieza_hogar'
- Registro en historial de limpiezas del master (`limpiezas_master_historial`)

---

### **2. Módulos de Lógica de Negocio**

#### `/var/www/aurelinportal/src/modules/limpieza.js`
**Propósito**: Lógica de negocio para el sistema de limpieza energética (sistema antiguo, parcialmente en desuso)

**Funciones principales**:
- `obtenerAspectosParaLimpieza(alumnoId, tipoLimpieza)`: Obtiene aspectos según tipo de limpieza y nivel
- `marcarAspectoLimpio(alumnoId, aspectoId, tipoLimpieza)`: Marca un aspecto como limpio
- `verificarLimpiezaCompletada(alumnoId, tipoLimpieza, aspectoIds)`: Verifica si todos los aspectos están completados
- `getNombreLimpieza(tipoLimpieza)`: Obtiene el nombre legible del tipo de limpieza

**Nota**: Este módulo parece ser del sistema antiguo basado en `aspectos_energeticos`. El sistema actual usa `transmutaciones-energeticas.js`.

---

### **3. Servicios (Lógica de Datos)**

#### `/var/www/aurelinportal/src/services/transmutaciones-energeticas.js`
**Propósito**: Servicio principal para gestionar transmutaciones energéticas (sistema actual)

**Funciones principales**:
- `calcularEstado(item, estadoAlumno, tipoLista)`: Calcula el estado de un ítem ('limpio', 'pendiente', 'pasado')
- `obtenerListas()`: Obtiene todas las listas de transmutaciones activas
- `obtenerAspectosParaLimpieza(alumnoId, tipoLimpieza, soloEnergiasIndeseables)`: **FUNCIÓN PRINCIPAL** - Obtiene aspectos para limpieza según tipo
- `limpiarItemParaAlumno(itemId, alumnoId)`: Limpia un ítem para un alumno específico
- `limpiarItemParaTodos(itemId)`: Limpia un ítem para todos los suscriptores activos
- `obtenerTransmutacionesPorAlumno(alumnoId)`: Obtiene todas las transmutaciones de un alumno clasificadas por estado

**Lógica de tipos de limpieza**:
- **Rápida**: 5 aspectos aleatorios mezclados
- **Básica**: Máximo 10 ítems en total
- **Profunda**: Máximo 5 por lista y 30 en total
- **Total**: Máximo 10 por lista y 50 en total

**Sistema de estados**:
- **Limpio**: Dentro del período de frecuencia
- **Pendiente**: Últimos 7 días antes de vencer
- **Pasado**: Pasado de rosca

**Filtrado de energías indeseables**:
- Detecta listas de energías indeseables por nombre (contiene "energías indeseables" o "energias indeseables")
- Permite filtrar aspectos generales vs energías indeseables

---

#### `/var/www/aurelinportal/src/services/aspectos-indeseables.js`
**Propósito**: Gestión específica de energías indeseables (sistema antiguo, parcialmente en desuso)

**Funciones principales**:
- `listarAspectosIndeseablesGlobales()`: Lista todas las energías indeseables globales
- `getAspectosIndeseablesAlumno(alumnoId)`: Obtiene energías indeseables de un alumno con estado calculado
- `marcarTodosAlumnosLimpiosPorAspectoIndeseable(aspectoId)`: Marca todos los alumnos como limpios para un aspecto

**Nota**: Este servicio parece ser del sistema antiguo. El sistema actual usa `transmutaciones-energeticas.js` con filtrado por nombre de lista.

---

#### `/var/www/aurelinportal/src/services/secciones-limpieza.js`
**Propósito**: Gestión de secciones/pestañas de limpieza energética (sistema antiguo, parcialmente en desuso)

**Funciones principales**:
- `listarSecciones()`: Lista todas las secciones activas
- `obtenerSeccionesPorBoton(tipoBoton)`: Obtiene secciones que deben mostrarse en un botón específico
- `crearSeccion(datos)`: Crea una nueva sección
- `actualizarSeccion(seccionId, datos)`: Actualiza una sección

**Nota**: Este servicio parece ser del sistema antiguo basado en `secciones_limpieza`. El sistema actual usa listas de transmutaciones.

---

#### `/var/www/aurelinportal/src/services/tecnicas-limpieza.js`
**Propósito**: Gestión de técnicas de limpieza energética

**Funciones principales**:
- `listarTecnicas()`: Lista todas las técnicas activas
- `obtenerTecnicasPorNivel(nivelAlumno, soloEnergiasIndeseables)`: Obtiene técnicas disponibles para un nivel específico
- `crearTecnica(datos)`: Crea una nueva técnica
- `actualizarTecnica(tecnicaId, datos)`: Actualiza una técnica

**Campos de técnicas**:
- `nombre`: Nombre de la técnica
- `descripcion`: Descripción de la técnica
- `nivel`: Nivel mínimo requerido para ver la técnica
- `es_energias_indeseables`: Boolean que indica si es para energías indeseables
- `activo`: Boolean para activar/desactivar

---

### **4. Plantillas HTML**

#### `/var/www/aurelinportal/src/core/html/limpieza-principal.html`
**Propósito**: Pantalla principal de limpieza energética con 4 botones

**Características**:
- Diseño responsive con CSS puro
- Imagen de Aurelín con efecto de aura
- 4 botones: Rápida, Básica, Profunda, Total
- Placeholders: `{{IMAGEN_AURI}}`, `{{URL_LIMPIEZA_RAPIDA}}`, etc.

**Estilos**:
- Colores: #faf7f2 (fondo), #ffd86b (botones), #5a3c00 (texto)
- Efectos: hover, transform, box-shadow
- Responsive: media queries para móvil y escritorio grande

---

#### `/var/www/aurelinportal/src/core/html/limpieza-tipo.html`
**Propósito**: Pantalla de un tipo específico de limpieza con aspectos y técnicas

**Características**:
- Sistema de tabs (opcional, configurable)
- Contador de aspectos completados
- Lista de técnicas disponibles
- Lista de aspectos con checkboxes
- Botón de confirmación que aparece cuando todos están marcados
- Mensaje de completado con animación

**Placeholders principales**:
- `{{NOMBRE_LIMPIEZA}}`: Nombre del tipo de limpieza
- `{{TIPO_LIMPIEZA}}`: Tipo (rapida, basica, profunda, total)
- `{{CONTENIDO_HTML}}`: Contenido dinámico generado (técnicas + aspectos)
- `{{TOTAL_ASPECTOS_GENERALES}}`: Total de aspectos generales
- `{{TOTAL_ASPECTOS_ENERGIAS_INDESEABLES}}`: Total de energías indeseables
- `{{TIENE_ENERGIAS_INDESEABLES}}`: Boolean para mostrar/ocultar sección
- `{{MOSTRAR_TABS}}`: Boolean para mostrar/ocultar sistema de tabs

**JavaScript del frontend**:
- Manejo de checkboxes con estado persistente en localStorage
- Actualización de contador en tiempo real
- Verificación de completado
- Llamadas AJAX a `/limpieza/marcar` y `/limpieza/verificar`
- Redirección a `/tecnica-post-practica` después de completar

---

### **5. Router (Enrutamiento)**

#### `/var/www/aurelinportal/src/router.js`
**Rutas relacionadas con limpieza**:

```javascript
// Pantalla principal
if (path === "/limpieza") {
  const { renderLimpiezaPrincipal } = await import("./endpoints/limpieza-handler.js");
  return renderLimpiezaPrincipal(request, env);
}

// Pantalla de tipo específico
if (path.startsWith("/limpieza/")) {
  const tipoLimpieza = path.split("/limpieza/")[1];
  if (['rapida', 'basica', 'profunda', 'total'].includes(tipoLimpieza)) {
    const { renderLimpiezaTipo } = await import("./endpoints/limpieza-handler.js");
    return renderLimpiezaTipo(request, env, tipoLimpieza);
  }
}

// Marcar aspecto como limpio (POST)
if (path === "/limpieza/marcar" && request.method === "POST") {
  const { handleMarcarLimpio } = await import("./endpoints/limpieza-handler.js");
  return handleMarcarLimpio(request, env);
}

// Verificar limpieza completada (POST)
if (path === "/limpieza/verificar" && request.method === "POST") {
  const { handleVerificarCompletada } = await import("./endpoints/limpieza-handler.js");
  return handleVerificarCompletada(request, env);
}
```

---

### **6. Base de Datos (PostgreSQL)**

#### Tablas principales:

**1. `listas_transmutaciones`**
- Almacena listas de transmutaciones (recurrentes o de una sola vez)
- Campos: `id`, `nombre`, `tipo` ('recurrente' o 'una_vez'), `descripcion`, `activo`, `orden`
- Índices: `tipo`, `activo`, `orden`

**2. `items_transmutaciones`**
- Almacena ítems energéticos dentro de las listas
- Campos: `id`, `lista_id` (FK), `nombre`, `descripcion`, `nivel`, `frecuencia_dias`, `veces_limpiar`, `prioridad` ('alta', 'media', 'bajo'), `orden`, `activo`
- Índices: `lista_id`, `nivel`, `activo`, `orden`, `prioridad`

**3. `items_transmutaciones_alumnos`**
- Estado de cada ítem por alumno
- Campos: `id`, `item_id` (FK), `alumno_id` (FK), `ultima_limpieza`, `veces_completadas`
- Constraint UNIQUE: `(item_id, alumno_id)`
- Índices: `item_id`, `alumno_id`, `ultima_limpieza`

**4. `tecnicas_limpieza`**
- Técnicas disponibles para realizar limpiezas
- Campos: `id`, `nombre`, `descripcion`, `nivel`, `orden`, `activo`, `es_energias_indeseables`
- Índices: `nivel`, `activo`, `orden`

**5. `limpiezas_master_historial`**
- Historial de limpiezas realizadas por el Master
- Campos: `id`, `alumno_id` (NULL para limpiezas globales), `tipo`, `aspecto_id`, `aspecto_nombre`, `seccion`, `fecha_limpieza`
- Índices: `alumno_id`, `fecha_limpieza`, `tipo`

**6. `aspectos_energeticos`** (Sistema antiguo, parcialmente en desuso)
- Aspectos energéticos del sistema antiguo
- Campos: `id`, `nombre`, `descripcion`, `tipo_limpieza` ('regular' o 'una_vez'), `nivel_minimo`, `frecuencia_dias`, `cantidad_minima`, `seccion_id`, `prioridad`, `activo`

**7. `aspectos_energeticos_alumnos`** (Sistema antiguo, parcialmente en desuso)
- Estado de aspectos energéticos por alumno (sistema antiguo)
- Campos: `id`, `alumno_id`, `aspecto_id`, `ultima_limpieza`, `proxima_limpieza`, `estado`, `cantidad_completada`, `cantidad_requerida`, `completado_permanentemente`, `veces_limpiado`

**8. `secciones_limpieza`** (Sistema antiguo, parcialmente en desuso)
- Secciones/pestañas de limpieza (sistema antiguo)
- Campos: `id`, `nombre`, `tipo_limpieza`, `activo`, `orden`, `botones_mostrar` (JSONB), `icono`

**9. `aspectos_indeseables`** (Sistema antiguo, parcialmente en desuso)
- Energías indeseables (sistema antiguo)
- Campos: `id`, `nombre`, `frecuencia_dias`, `prioridad`, `orden`, `activo`, `nivel_minimo`

**10. `aspectos_indeseables_alumnos`** (Sistema antiguo, parcialmente en desuso)
- Estado de energías indeseables por alumno (sistema antiguo)
- Campos: `id`, `alumno_id`, `aspecto_id`, `estado`, `ultima_limpieza`, `proxima_limpieza`, `veces_limpiado`

---

### **7. Frontend JavaScript (Admin)**

#### `/var/www/aurelinportal/public/js/admin-master.js`
**Funciones relacionadas con limpieza**:

- `renderLimpiezaEnergetica()`: Renderiza la sección de limpieza energética en el panel de admin
- `renderProgresoEnergetico()`: Renderiza el progreso energético del alumno
- `inicializarSubtabsLimpieza()`: Inicializa el sistema de subtabs en limpieza energética
- `abrirModalListaLimpieza(moduloId)`: Abre modal con lista de limpieza de un módulo específico

**Características**:
- Sistema de tabs y subtabs
- Filtrado por estado (limpio, pendiente, pasado)
- Visualización de limpiezas del master
- Integración con el sistema de transmutaciones

---

## 🔄 Flujo de Funcionamiento

### **Flujo del Alumno:**

1. **Acceso a limpieza principal** (`/limpieza`)
   - Se renderiza `limpieza-principal.html`
   - Muestra 4 botones: Rápida, Básica, Profunda, Total

2. **Selección de tipo** (`/limpieza/{tipo}`)
   - Se renderiza `limpieza-tipo.html`
   - Se obtienen aspectos mediante `obtenerAspectosParaLimpieza()`
   - Se obtienen técnicas mediante `obtenerTecnicasPorNivel()`
   - Se genera HTML dinámico con técnicas y aspectos

3. **Marcado de aspectos** (POST `/limpieza/marcar`)
   - Frontend envía `aspecto_id` mediante AJAX
   - Backend llama a `limpiarItemParaAlumno()`
   - Se actualiza `items_transmutaciones_alumnos`
   - Se guarda estado en localStorage del frontend

4. **Verificación de completado** (POST `/limpieza/verificar`)
   - Frontend envía array de `aspecto_ids`
   - Backend verifica que todos estén marcados
   - Se suma racha mediante `checkDailyStreak()`
   - Se redirige a `/tecnica-post-practica`

### **Flujo del Master:**

1. **Limpieza individual** (POST `/admin/limpieza/individual`)
   - Master selecciona aspecto y alumno
   - Se llama a `limpiarAspectoIndividual()`
   - Se actualiza estado del alumno
   - Se registra en `limpiezas_master_historial`

2. **Limpieza global** (POST `/admin/limpieza/global`)
   - Master selecciona aspecto
   - Se llama a `limpiarAspectoGlobal()`
   - Se actualiza estado de todos los suscriptores activos
   - Se registra en `limpiezas_master_historial` con `alumno_id = NULL`

---

## 🎨 Tecnologías y Patrones de Programación

### **Backend:**
- **Node.js ES Modules**: Uso de `import/export` en lugar de `require/module.exports`
- **Template Engine Personalizado**: Sistema de reemplazo de placeholders con condicionales
- **PostgreSQL**: Base de datos relacional con índices optimizados
- **Async/Await**: Manejo asíncrono de operaciones de base de datos
- **REST API**: Endpoints POST para acciones, GET para visualización

### **Frontend:**
- **Vanilla JavaScript**: Sin frameworks, JavaScript puro
- **CSS Puro**: Sin preprocesadores, estilos inline en HTML
- **localStorage**: Persistencia de estado de checkboxes
- **Fetch API**: Llamadas AJAX para comunicación con backend
- **Responsive Design**: Media queries para móvil y escritorio

### **Base de Datos:**
- **PostgreSQL**: Base de datos relacional
- **Índices**: Optimización de consultas frecuentes
- **Constraints**: UNIQUE, FOREIGN KEY, CHECK
- **JSONB**: Para campos como `botones_mostrar` en secciones
- **Timestamps**: `created_at`, `updated_at` automáticos

### **Patrones de Diseño:**
- **Service Layer**: Separación de lógica de negocio en servicios
- **Repository Pattern**: Acceso a datos centralizado en `pg.js`
- **Template Method**: Sistema de templates con placeholders
- **State Management**: Estado de aspectos calculado dinámicamente

---

## 🔍 Sistema Dual (Antiguo vs Nuevo)

El sistema actualmente tiene **dos implementaciones**:

### **Sistema Nuevo (Activo):**
- Usa `transmutaciones-energeticas.js`
- Tablas: `listas_transmutaciones`, `items_transmutaciones`, `items_transmutaciones_alumnos`
- Organización por listas de transmutaciones
- Filtrado de energías indeseables por nombre de lista

### **Sistema Antiguo (Parcialmente en desuso):**
- Usa `limpieza.js` y `aspectos-indeseables.js`
- Tablas: `aspectos_energeticos`, `aspectos_energeticos_alumnos`, `secciones_limpieza`, `aspectos_indeseables`
- Organización por secciones y aspectos directos
- Sistema de energías indeseables separado

**Nota**: El sistema nuevo está activo y se usa en las pantallas del alumno. El sistema antiguo puede estar en uso en algunas partes del admin.

---

## 📊 Cálculo de Estados

### **Para ítems recurrentes:**
```javascript
const diasDesdeLimpieza = Math.floor((ahora - ultimaLimpieza) / (1000 * 60 * 60 * 24));
const frecuencia = item.frecuencia_dias || 20;

if (diasDesdeLimpieza <= frecuencia) {
  return 'limpio'; // Dentro del período
} else if (diasDesdeLimpieza <= frecuencia + 7) {
  return 'pendiente'; // Últimos 7 días antes de vencer
} else {
  return 'pasado'; // Pasado de rosca
}
```

### **Para ítems de una vez:**
```javascript
if (!estadoAlumno || !estadoAlumno.veces_completadas) {
  return 'pasado'; // No ha limpiado nunca
}
if (estadoAlumno.veces_completadas >= item.veces_limpiar) {
  return 'limpio'; // Ya completó todas las veces
}
return 'pasado'; // No ha completado todas las veces
```

---

## 🎯 Tipos de Limpieza y Cantidades

| Tipo | Cantidad | Organización |
|------|----------|-------------|
| **Rápida** | 5 aspectos | Aleatorios mezclados |
| **Básica** | 10 aspectos | Ordenados por prioridad |
| **Profunda** | 30 aspectos | Máximo 5 por lista |
| **Total** | 50 aspectos | Máximo 10 por lista |

---

## 🔐 Autenticación y Seguridad

- **Alumnos**: Autenticación mediante cookies (`getCookieData`)
- **Master**: Autenticación mediante `requireAdminAuth`
- **Validación**: Verificación de existencia de alumno antes de operaciones
- **Sanitización**: Uso de parámetros preparados en queries SQL

---

## 📝 Notas Importantes

1. **Sistema Dual**: Existen dos sistemas (antiguo y nuevo) que pueden coexistir. El nuevo es el activo.

2. **Energías Indeseables**: Se detectan por nombre de lista, no por tabla separada.

3. **Técnicas**: Se muestran según el nivel del alumno y si son para energías indeseables o no.

4. **Historial**: Las limpiezas del master se registran en `limpiezas_master_historial`.

5. **Racha**: Al completar una limpieza, se suma la racha diaria mediante `checkDailyStreak()`.

6. **Persistencia**: El estado de checkboxes se guarda en localStorage para no perder progreso.

---

## 🚀 Endpoints Disponibles

### **Alumno:**
- `GET /limpieza` - Pantalla principal
- `GET /limpieza/{tipo}` - Pantalla de tipo específico (rapida, basica, profunda, total)
- `POST /limpieza/marcar` - Marcar aspecto como limpio
- `POST /limpieza/verificar` - Verificar limpieza completada

### **Master:**
- `POST /admin/limpieza/individual` - Limpiar aspecto para un alumno
- `POST /admin/limpieza/global` - Limpiar aspecto para todos
- `GET /admin/limpieza/estado?aspecto_id=X&tipo_aspecto=Y` - Obtener estado de aspecto

---

## 📦 Dependencias Principales

- `database/pg.js` - Gestor de PostgreSQL
- `modules/student-v4.js` - Gestión de alumnos
- `modules/streak.js` - Sistema de rachas
- `core/cookies.js` - Manejo de cookies
- `modules/admin-auth.js` - Autenticación de admin

---

**Versión del documento**: 1.0  
**Fecha**: 2024  
**Sistema**: AuriPortal v4.0+
















