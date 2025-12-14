# 🚀 AuriPortal V6 - Documentación Completa

**Versión:** 6.0.0  
**Fecha:** Diciembre 2025  
**Estado:** Implementación Completa

---

## 📋 Tabla de Contenidos

1. [Introducción](#introducción)
2. [Sistema de Módulos](#sistema-de-módulos)
3. [Módulos Gamificación](#módulos-gamificación)
4. [Módulos Funcionales](#módulos-funcionales)
5. [Arquitectura](#arquitectura)
6. [Base de Datos](#base-de-datos)
7. [Integración con Admin Panel](#integración-con-admin-panel)
8. [Guía de Activación](#guía-de-activación)
9. [API y Servicios](#api-y-servicios)
10. [Testing y Verificación](#testing-y-verificación)

---

## 1. Introducción

AuriPortal V6 es una evolución masiva del sistema V5 que añade un sistema de gamificación completo, módulos dinámicos, y control granular de funcionalidades mediante un sistema de estados (OFF / BETA / ON).

### Características Principales

✅ **Sistema de Módulos** - Control dinámico de activación/desactivación  
✅ **9 Nuevos Módulos** - Gamificación y funcionales  
✅ **100% Modular** - Cada módulo es independiente  
✅ **Sin Romper V5** - Total compatibilidad hacia atrás  
✅ **PostgreSQL First** - Todo en base de datos local  
✅ **IA Local** - Whisper y Ollama integrados  
✅ **Analytics Completo** - Eventos en todos los módulos  

---

## 2. Sistema de Módulos

### 2.1. Concepto

El **Sistema de Módulos** es la base de AuriPortal V6. Permite activar, desactivar o poner en modo BETA cualquier funcionalidad del sistema de forma dinámica.

### 2.2. Estados de Módulos

| Estado | Descripción | Visibilidad Admin | Visibilidad Alumnos |
|--------|-------------|-------------------|---------------------|
| **OFF** | Desactivado completamente | ❌ No visible | ❌ No visible |
| **BETA** | En pruebas | ✅ Visible | ⚠️ Solo con cookie `auribeta=1` |
| **ON** | Activo para todos | ✅ Visible | ✅ Visible |

### 2.3. Tabla `modulos_sistema`

```sql
CREATE TABLE modulos_sistema (
  id SERIAL PRIMARY KEY,
  codigo TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  estado TEXT NOT NULL DEFAULT 'off',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT check_estado CHECK (estado IN ('off', 'beta', 'on'))
);
```

### 2.4. Servicio `modulos.js`

**Ubicación:** `/var/www/aurelinportal/src/services/modulos.js`

**Funciones Principales:**

```javascript
// Verificar si un módulo está activo
await isActivo('auribosses')

// Verificar si está en beta
await isBeta('arquetipos')

// Obtener estado
await getEstado('token_auri') // 'off', 'beta', 'on'

// Listar todos los módulos
await listarModulos()

// Actualizar estado
await actualizarEstado('auribosses', 'on')

// Verificar acceso (middleware)
await checkModulo(request, 'auribosses')
```

### 2.5. Admin Panel - Gestión de Módulos

**Ruta:** `/admin/modulos`

**Funcionalidades:**

- ✅ Ver todos los módulos con sus estados
- ✅ Cambiar estado con un clic (OFF / BETA / ON)
- ✅ Estadísticas en tiempo real
- ✅ Agrupación por categorías
- ✅ Cambios inmediatos sin reiniciar servidor

---

## 3. Módulos Gamificación

### 3.1. 👹 Auribosses (Retos de Ascenso)

**Código:** `auribosses`  
**Estado Inicial:** OFF  
**Ruta Admin:** `/admin/auribosses`

#### Descripción

Sistema de retos que los alumnos deben superar para ascender de nivel. Cada boss tiene condiciones específicas basadas en:

- Número de prácticas
- Racha de días consecutivos
- Energía emocional mínima
- Diversidad de aspectos practicados
- Prácticas de aspectos específicos

#### Tablas

```sql
CREATE TABLE auribosses (
  id SERIAL PRIMARY KEY,
  nivel INTEGER NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  condiciones JSONB NOT NULL DEFAULT '{}',
  recompensa JSONB DEFAULT '{}',
  activo BOOLEAN DEFAULT true
);

CREATE TABLE auribosses_alumnos (
  alumno_id INTEGER REFERENCES alumnos(id),
  boss_id INTEGER REFERENCES auribosses(id),
  completado BOOLEAN DEFAULT false,
  intentos INTEGER DEFAULT 0,
  fecha_completado TIMESTAMP
);
```

#### Servicios

**Ubicación:** `/var/www/aurelinportal/src/modules/auribosses/services/auribosses.js`

```javascript
// Obtener boss del nivel
await getBossPorNivel(nivel)

// Verificar condiciones
await verificarCondicionesBoss(alumnoId, condiciones)

// Completar boss
await completarBoss(alumnoId, bossId)

// Obtener progreso
await getProgresoBosses(alumnoId)
```

#### Ejemplo de Condiciones

```json
{
  "min_practicas": 25,
  "min_racha": 7,
  "energia_min": 5,
  "min_practicas_aspecto": {
    "sanacion": 5,
    "canalizacion": 3
  },
  "min_diversidad": 5
}
```

---

### 3.2. 🎭 Arquetipos Dinámicos

**Código:** `arquetipos`  
**Estado Inicial:** OFF  
**Ruta Admin:** `/admin/arquetipos`

#### Descripción

Sistema que asigna arquetipos a los alumnos basándose en su comportamiento:

- **El Explorador** 🧭 - Practica muchos aspectos diferentes
- **El Constante** ⚡ - Mantiene racha larga
- **El Profundo** 🔮 - Se enfoca en pocos aspectos
- **El Sanador** 💚 - Orientado a sanación
- **El Canalizador** ✨ - Domina canalización

#### Tablas

```sql
CREATE TABLE arquetipos (
  id SERIAL PRIMARY KEY,
  codigo TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  icono TEXT,
  descripcion TEXT,
  condiciones JSONB NOT NULL DEFAULT '{}',
  prioridad INTEGER DEFAULT 0,
  activo BOOLEAN DEFAULT true
);

CREATE TABLE arquetipos_alumnos (
  alumno_id INTEGER REFERENCES alumnos(id),
  arquetipo_codigo TEXT REFERENCES arquetipos(codigo),
  fecha_asignado TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  activo BOOLEAN DEFAULT true
);
```

#### Servicios

```javascript
// Evaluar arquetipos del alumno
await evaluarArquetipos(alumnoId)

// Asignar arquetipo
await asignarArquetipo(alumnoId, 'explorador')

// Obtener arquetipos del alumno
await getArquetiposAlumno(alumnoId)
```

---

### 3.3. ✨ Evolución Avatar Aurelín

**Código:** `avatar_aurelin`  
**Estado Inicial:** OFF  
**Ruta Admin:** `/admin/avatar`

#### Descripción

El avatar de Aurelín evoluciona visualmente según el progreso del alumno:

- **Aurelín Novato** (Nivel 1)
- **Aurelín Aprendiz** (Nivel 3, Racha 5)
- **Aurelín Practicante** (Nivel 5, Racha 10)
- **Aurelín Maestro** (Nivel 7, Racha 15)
- **Aurelín Iluminado** (Nivel 10, Racha 21)

#### Tablas

```sql
CREATE TABLE avatar_estados (
  codigo TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  nivel_min INTEGER DEFAULT 0,
  racha_min INTEGER DEFAULT 0,
  emocion_min INTEGER DEFAULT 0,
  imagen_url TEXT,
  descripcion TEXT
);

CREATE TABLE avatar_alumnos (
  alumno_id INTEGER PRIMARY KEY REFERENCES alumnos(id),
  avatar_codigo TEXT REFERENCES avatar_estados(codigo),
  fecha_cambio TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Servicios

```javascript
// Evaluar avatar correspondiente
await evaluarEstadoAvatar(alumnoId)

// Actualizar avatar
await actualizarAvatarAlumno(alumnoId, 'aurelin_maestro')

// Obtener avatar actual
await getAvatarAlumno(alumnoId)
```

---

### 3.4. 📖 Modo Historia

**Código:** `modo_historia`  
**Estado Inicial:** OFF  
**Ruta Admin:** `/admin/historia`

#### Descripción

Narrativa por niveles que acompaña al alumno en su viaje. Cada nivel desbloquea nuevos capítulos y escenas.

#### Tablas

```sql
CREATE TABLE historias (
  capitulo INTEGER NOT NULL,
  escena INTEGER NOT NULL,
  titulo TEXT NOT NULL,
  contenido TEXT NOT NULL,
  condiciones JSONB DEFAULT '{}',
  media_url TEXT
);

CREATE TABLE historias_alumnos (
  alumno_id INTEGER REFERENCES alumnos(id),
  historia_id INTEGER REFERENCES historias(id),
  completada BOOLEAN DEFAULT false,
  fecha_vista TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

### 3.5. 🗺️ Aurimapa

**Código:** `aurimapa`  
**Estado Inicial:** OFF  
**Ruta Admin:** `/admin/aurimapa`

#### Descripción

Mapa interior del alumno con nodos que se desbloquean según el progreso:

- Inicio del Viaje
- Sanación Básica
- Exploración Interna
- Portal de Transformación
- Maestría en Canalización
- Iluminación Total

---

### 3.6. 🧭 AuriQuest

**Código:** `auriquest`  
**Estado Inicial:** OFF  
**Ruta Admin:** `/admin/auriquest`

#### Descripción

Viajes guiados de varios días con prácticas y reflexiones diarias.

**Ejemplo:** "Viaje de 7 Días: Sanación Profunda"

Día 1: Reconocimiento  
Día 2: Aceptación  
Día 3: Liberación  
...  
Día 7: Celebración

#### Tablas

```sql
CREATE TABLE quests (
  codigo TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  dias INTEGER NOT NULL,
  contenido JSONB NOT NULL DEFAULT '[]',
  nivel_minimo INTEGER DEFAULT 1
);

CREATE TABLE quests_alumnos (
  alumno_id INTEGER REFERENCES alumnos(id),
  quest_id INTEGER REFERENCES quests(id),
  dia_actual INTEGER DEFAULT 1,
  completada BOOLEAN DEFAULT false,
  progreso JSONB DEFAULT '{}'
);
```

---

### 3.7. 🪙 Token AURI (BETA)

**Código:** `token_auri`  
**Estado Inicial:** OFF  
**Ruta Admin:** `/admin/tokens`

#### Descripción

Sistema de tokens virtuales (no reales, solo gamificación) que los alumnos ganan por:

- Completar prácticas
- Mantener racha
- Completar misiones
- Vencer auribosses
- Reflexiones profundas

Los tokens se pueden gastar en:

- Desbloquear contenido especial
- Personalización de avatar
- Quests premium

#### Tablas

```sql
CREATE TABLE tokens_auri (
  alumno_id INTEGER PRIMARY KEY REFERENCES alumnos(id),
  balance INTEGER DEFAULT 0,
  total_ganados INTEGER DEFAULT 0,
  total_gastados INTEGER DEFAULT 0
);

CREATE TABLE tokens_transacciones (
  alumno_id INTEGER REFERENCES alumnos(id),
  tipo TEXT NOT NULL,
  cantidad INTEGER NOT NULL,
  concepto TEXT,
  metadata JSONB DEFAULT '{}'
);
```

---

## 4. Módulos Funcionales

### 4.1. 📝 Informe Semanal

**Código:** `informe_semanal`  
**Estado Inicial:** OFF  
**Ruta Admin:** `/admin/informes`

#### Descripción

Generación automática de informes semanales para cada alumno con:

- Prácticas realizadas
- Días practicados
- Reflexiones y energía promedio
- Aspectos más practicados
- Progreso de racha
- Logros obtenidos

---

### 4.2. 🎁 Prácticas Sorpresa

**Código:** `practicas_sorpresa`  
**Estado Inicial:** OFF  
**Ruta Admin:** `/admin/sorpresas`

#### Descripción

Sistema de recomendación inteligente que sugiere prácticas basándose en:

- Días sin practicar
- Aspectos menos trabajados
- Estado emocional
- Racha actual
- Nivel de progreso

---

## 5. Arquitectura

### 5.1. Estructura de Directorios

```
/var/www/aurelinportal/
├── database/
│   ├── pg.js                    # Conexión PostgreSQL
│   └── v6-schema.sql            # Schema completo V6
├── src/
│   ├── services/
│   │   ├── modulos.js           # Sistema de módulos
│   │   ├── analytics.js         # Analytics V5
│   │   └── ...
│   ├── endpoints/
│   │   ├── admin-panel-v4.js    # Router principal
│   │   ├── admin-panel-modulos.js  # Admin módulos
│   │   └── ...
│   └── modules/                 # 🆕 Módulos V6
│       ├── auribosses/
│       │   ├── endpoints/       # Admin panel del módulo
│       │   ├── services/        # Lógica de negocio
│       │   ├── templates/       # HTML (si aplica)
│       │   └── index.js         # Exportaciones
│       ├── arquetipos/
│       ├── informes/
│       ├── sorpresas/
│       ├── historia/
│       ├── avatar/
│       ├── aurimapa/
│       ├── auriquest/
│       └── tokens/
└── AURIPORTAL_V6.md             # Esta documentación
```

### 5.2. Flujo de Activación de Módulo

```
Admin Panel
    ↓
Click en estado (OFF/BETA/ON)
    ↓
POST /admin/modulos
    ↓
actualizarEstado(codigo, estado)
    ↓
UPDATE modulos_sistema SET estado = ...
    ↓
Cambio inmediato sin reiniciar
```

### 5.3. Middleware de Verificación

Cada endpoint de módulo verifica su estado:

```javascript
export async function renderAuribosses(request, env) {
  // Verificar si el módulo está activo
  const moduloActivo = await isActivo('auribosses');
  
  if (!moduloActivo) {
    // Mostrar aviso de módulo desactivado
  }
  
  // Continuar con renderizado...
}
```

---

## 6. Base de Datos

### 6.1. Nuevas Tablas V6

- `modulos_sistema` - Control de módulos
- `auribosses` - Definición de bosses
- `auribosses_alumnos` - Progreso de bosses
- `arquetipos` - Definición de arquetipos
- `arquetipos_alumnos` - Arquetipos asignados
- `informes_semanales` - Informes generados
- `sorpresas` - Definición de sorpresas
- `sorpresas_alumnos` - Sorpresas mostradas
- `historias` - Escenas narrativas
- `historias_alumnos` - Progreso en historia
- `avatar_estados` - Estados de avatar
- `avatar_alumnos` - Avatar actual del alumno
- `aurimapa_nodos` - Nodos del mapa
- `aurimapa_alumnos` - Nodos desbloqueados
- `quests` - Definición de quests
- `quests_alumnos` - Progreso en quests
- `tokens_auri` - Balance de tokens
- `tokens_transacciones` - Historial de tokens

### 6.2. Ejecutar Schema V6

```bash
cd /var/www/aurelinportal
psql -h localhost -U aureliadmin -d aurelin_db -f database/v6-schema.sql
```

O reiniciar el servidor (se crean automáticamente):

```bash
pm2 restart aurelinportal
```

---

## 7. Integración con Admin Panel

### 7.1. Sidebar Reorganizado

El sidebar del Admin Panel ahora tiene estas secciones:

1. **Dashboard**
2. **GESTIÓN** - Alumnos, Prácticas, Reflexiones, Audios, Respuestas
3. **CURRÍCULUM PDE** - Frases
4. **ARQUITECTURA AURIPORTAL** - Workflow, Caminos, Pantallas, Aspectos, Racha
5. **AURIPORTAL V5** - Analytics, Misiones, Logros, Auricalendar, Aurigraph, Modo Maestro
6. **GAMIFICACIÓN V6** - Auribosses, Arquetipos, Avatar, Historia, Aurimapa, AuriQuest, Tokens
7. **MÓDULOS FUNCIONALES** - Informes, Sorpresas
8. **CONFIGURACIÓN** - Módulos Sistema, Email, Logs

### 7.2. Rutas Registradas

```javascript
// En admin-panel-v4.js
if (path === '/admin/auribosses') {
  return await renderAuribosses(request, env);
}

if (path === '/admin/arquetipos') {
  return await renderArquetipos(request, env);
}

// ... etc para cada módulo
```

---

## 8. Guía de Activación

### 8.1. Primer Uso

1. **Acceder al Admin Panel**
   ```
   https://admin.pdeeugenihidalgo.org/admin/login
   ```

2. **Ir a Gestión de Módulos**
   ```
   https://admin.pdeeugenihidalgo.org/admin/modulos
   ```

3. **Activar módulos deseados**
   - OFF = Desactivado
   - BETA = Solo para ti (admin)
   - ON = Activo para todos

### 8.2. Orden Recomendado de Activación

Para un despliegue gradual:

**Semana 1:**
- ✅ Auribosses (BETA)
- ✅ Arquetipos (BETA)

**Semana 2:**
- ✅ Avatar Aurelín (BETA)
- ✅ Aurimapa (BETA)

**Semana 3:**
- ✅ Modo Historia (BETA)
- ✅ AuriQuest (BETA)

**Semana 4:**
- ✅ Informe Semanal (ON)
- ✅ Prácticas Sorpresa (ON)

**Cuando esté listo:**
- ✅ Cambiar todos a ON
- ✅ Token AURI permanece en BETA

### 8.3. Modo Beta para Alumnos

Para que un alumno vea módulos en BETA:

```javascript
// Establecer cookie en el navegador del alumno
document.cookie = "auribeta=1; path=/; max-age=2592000";
```

---

## 9. API y Servicios

### 9.1. Servicios Principales

Todos los servicios están en `/var/www/aurelinportal/src/modules/{modulo}/services/`

**Auribosses:**
```javascript
import * as auribosses from '../modules/auribosses/services/auribosses.js';
```

**Arquetipos:**
```javascript
import * as arquetipos from '../modules/arquetipos/services/arquetipos.js';
```

**Avatar:**
```javascript
import * as avatar from '../modules/avatar/services/avatar.js';
```

**Historia:**
```javascript
import * as historia from '../modules/historia/services/historia.js';
```

**Aurimapa:**
```javascript
import * as aurimapa from '../modules/aurimapa/services/aurimapa.js';
```

**AuriQuest:**
```javascript
import * as auriquest from '../modules/auriquest/services/auriquest.js';
```

**Tokens:**
```javascript
import * as tokens from '../modules/tokens/services/tokens.js';
```

**Informes:**
```javascript
import * as informes from '../modules/informes/services/informes.js';
```

**Sorpresas:**
```javascript
import * as sorpresas from '../modules/sorpresas/services/sorpresas.js';
```

### 9.2. Analytics

Todos los módulos registran eventos en `analytics_eventos`:

```javascript
await registrarEvento({
  alumno_id: alumnoId,
  tipo_evento: 'boss_completado',
  metadata: { boss_id: bossId }
});
```

Tipos de eventos V6:

- `boss_completado`
- `arquetipo_asignado`
- `avatar_evolucionado`
- `escena_historia_completada`
- `nodo_aurimapa_desbloqueado`
- `quest_iniciada`
- `quest_completada`
- `tokens_ganados`
- `tokens_gastados`
- `informe_semanal_generado`
- `sorpresa_mostrada`

---

## 10. Testing y Verificación

### 10.1. Verificar Instalación

```bash
# Verificar que las tablas existen
psql -h localhost -U aureliadmin -d aurelin_db -c "\dt modulos_sistema"
psql -h localhost -U aureliadmin -d aurelin_db -c "\dt auribosses"

# Verificar módulos registrados
psql -h localhost -U aureliadmin -d aurelin_db -c "SELECT codigo, nombre, estado FROM modulos_sistema"
```

### 10.2. Test de Módulos

1. **Acceder a cada ruta:**
   - https://admin.pdeeugenihidalgo.org/admin/modulos
   - https://admin.pdeeugenihidalgo.org/admin/auribosses
   - https://admin.pdeeugenihidalgo.org/admin/arquetipos
   - etc.

2. **Verificar cambio de estado:**
   - Cambiar un módulo de OFF a ON
   - Recargar página
   - El módulo debe aparecer activo

3. **Verificar sidebar:**
   - El sidebar debe mostrar la nueva estructura
   - Todos los enlaces deben funcionar

### 10.3. Logs

```bash
# Ver logs del servidor
pm2 logs aurelinportal

# Ver logs de PostgreSQL
tail -f /var/log/postgresql/postgresql-*.log
```

---

## 11. Mantenimiento

### 11.1. Añadir Nuevo Módulo

1. Crear carpeta: `/src/modules/{nuevo_modulo}/`
2. Crear tablas en `database/v6-schema.sql`
3. Crear servicios en `services/`
4. Crear endpoint admin en `endpoints/`
5. Registrar en `modulos_sistema`:

```sql
INSERT INTO modulos_sistema (codigo, nombre, descripcion, estado)
VALUES ('nuevo_modulo', 'Nombre del Módulo', 'Descripción', 'off');
```

6. Añadir ruta en `admin-panel-v4.js`
7. Añadir enlace en `base.html` (sidebar)

### 11.2. Backup

```bash
# Backup completo de base de datos
pg_dump -h localhost -U aureliadmin aurelin_db > backup_v6_$(date +%Y%m%d).sql

# Backup solo tablas V6
pg_dump -h localhost -U aureliadmin aurelin_db \
  -t modulos_sistema \
  -t auribosses \
  -t arquetipos \
  > backup_v6_modules_$(date +%Y%m%d).sql
```

---

## 12. Reglas de Oro V6

✅ **PostgreSQL = Única Fuente de Verdad**  
✅ **Whisper y Ollama SIEMPRE locales**  
✅ **Ninguna API externa nueva**  
✅ **Nada rompe V5**  
✅ **Módulos 100% independientes**  
✅ **Analytics obligatorio**  
✅ **Logging completo**  
✅ **OFF = No existe para nadie**  
✅ **BETA = Solo admins**  
✅ **ON = Todos**  

---

## 13. Roadmap Post-V6

- [ ] Implementar endpoints para alumnos (portal frontend)
- [ ] Integración con Whisper para análisis de audios
- [ ] Integración con Ollama para recomendaciones personalizadas
- [ ] Sistema de notificaciones push
- [ ] App móvil con React Native
- [ ] Dashboard de métricas avanzadas
- [ ] Exportación de informes en PDF

---

## 14. Soporte y Contacto

Para dudas o issues:

- **Desarrollador:** Cursor AI + Eugeni Hidalgo
- **Servidor:** Hetzner Cloud
- **Base de Datos:** PostgreSQL 16
- **Node.js:** v18+
- **PM2:** v5+

---

**🎉 AuriPortal V6 está listo para transformar la experiencia de los alumnos en el PDE! 🎉**

---

*Última actualización: Diciembre 2025*



