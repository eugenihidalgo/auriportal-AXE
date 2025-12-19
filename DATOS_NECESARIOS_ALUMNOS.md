# 📋 Documento de Datos Necesarios para Alumnos

Este documento lista todos los datos que necesitamos recoger de los alumnos y dónde se almacenan o deben configurarse.

---

## ✅ Datos Ya Disponibles en Base de Datos

### **Tabla: `alumnos`**

#### Datos Básicos
- ✅ `id` - ID único del alumno
- ✅ `email` - Email del alumno (único)
- ✅ `nombre_completo` - Nombre completo
- ✅ `apodo` - Apodo del alumno
- ✅ `nivel_actual` - Nivel actual del alumno
- ✅ `estado_suscripcion` - Estado de suscripción (activa, pausada, cancelada, etc.)
- ✅ `codigo_auri` - Código AURI (AURI-DNA)
- ✅ `streak` - Racha actual de días consecutivos
- ✅ `fecha_ultima_practica` - Fecha de última práctica

#### Datos de Nacimiento (Ya en BD, pero necesitan recogerse)
- ✅ `fecha_nacimiento` - Fecha de nacimiento (DATE)
- ✅ `hora_nacimiento` - Hora de nacimiento (TEXT, formato HH:MM)
- ✅ `lugar_nacimiento` - Lugar de nacimiento (TEXT)

**⚠️ ESTADO**: Campos existen en BD pero **NO se están recogiendo actualmente**

**🔧 ACCIÓN REQUERIDA**: 
- Crear Typeform o formulario para recoger estos datos
- Configurar webhook para guardar en BD
- Enlace Typeform: **[PENDIENTE DE CONFIGURAR]**

---

### **Tabla: `carta_astral`**

- ✅ `alumno_id` - ID del alumno (UNIQUE)
- ✅ `imagen_url` - URL de la imagen de la carta astral
- ✅ `notas` - Notas sobre la carta astral (TEXT)
- ✅ `fecha_subida` - Fecha de subida de la imagen

**⚠️ ESTADO**: Tabla existe, pero **NO hay endpoint para subir imágenes**

**🔧 ACCIÓN REQUERIDA**: 
- Crear endpoint `POST /admin/master/:alumnoId/carta-astral` para subir imagen
- Implementar almacenamiento de imágenes (local o cloud storage)
- Permitir al Master subir/actualizar imagen desde Modo Master

---

### **Tabla: `disenohumano`**

- ✅ `alumno_id` - ID del alumno (UNIQUE)
- ✅ `imagen_url` - URL de la imagen del diseño humano
- ✅ `tipo` - Tipo de diseño humano (TEXT)
- ✅ `notas` - Notas sobre el diseño humano (JSONB)
- ✅ `fecha_subida` - Fecha de subida de la imagen

**⚠️ ESTADO**: Tabla existe, pero **NO hay endpoint para subir imágenes**

**🔧 ACCIÓN REQUERIDA**: 
- Crear endpoint `POST /admin/master/:alumnoId/diseno-humano` para subir imagen
- Implementar almacenamiento de imágenes (local o cloud storage)
- Permitir al Master subir/actualizar imagen desde Modo Master

---

### **Tabla: `alumnos` - Columna `ajustes`**

- ✅ `ajustes` - Configuración personal del alumno (JSONB)

**⚠️ ESTADO**: Campo existe, estructura JSONB flexible

**📝 ESTRUCTURA SUGERIDA**:
```json
{
  "notificaciones": {
    "email": true,
    "push": false
  },
  "preferencias": {
    "idioma": "es",
    "tema": "oscuro"
  },
  "configuracion_energetica": {
    "frecuencia_practica": "diaria",
    "horario_preferido": "mañana"
  }
}
```

**🔧 ACCIÓN REQUERIDA**: 
- Definir estructura completa de ajustes
- Crear formulario en Modo Master para editar ajustes (solo lectura por ahora)

---

### **Tabla: `alumnos_disponibilidad`**

- ✅ `alumno_id` - ID del alumno (UNIQUE)
- ✅ `disponible` - Si el alumno está disponible para prácticas conjuntas (BOOLEAN)
- ✅ `mensaje` - Mensaje de disponibilidad (TEXT)
- ✅ `actualizado` - Fecha de última actualización (TIMESTAMP)

**⚠️ ESTADO**: Tabla existe, funcionalidad básica implementada

**🔧 ACCIÓN REQUERIDA**: 
- Mostrar en pestaña Información General
- Permitir editar desde Modo Master (opcional)

---

### **Tabla: `practicas_conjuntas` (Sinergias)**

- ✅ `alumno1_id` - ID del primer alumno
- ✅ `alumno2_id` - ID del segundo alumno
- ✅ `practica_id` - ID de la práctica conjunta
- ✅ `fecha` - Fecha de la práctica conjunta
- ✅ `metadata` - Datos adicionales (JSONB)

**⚠️ ESTADO**: Tabla existe, funcionalidad de sinergias implementada

**🔧 ACCIÓN REQUERIDA**: 
- Mostrar sinergias disponibles en pestaña Información General
- Listar alumnos disponibles para prácticas conjuntas

---

## ❌ Datos Faltantes / Por Configurar

### **1. Formulario de Datos de Nacimiento**

**Datos necesarios**:
- Fecha de nacimiento (DD/MM/YYYY)
- Hora de nacimiento (HH:MM)
- Lugar de nacimiento (Ciudad, País)

**🔧 CONFIGURACIÓN REQUERIDA**:
- [ ] Crear Typeform para recoger datos de nacimiento
- [ ] Configurar webhook en Typeform → AuriPortal
- [ ] Crear endpoint `POST /webhook/typeform-nacimiento`
- [ ] Guardar datos en tabla `alumnos` (campos ya existen)

**📝 ENLACE TYPEFORM**: **[PENDIENTE DE CREAR]**

---

### **2. Sistema de Subida de Imágenes**

**Imágenes necesarias**:
- Carta Astral (imagen)
- Diseño Humano (imagen)

**🔧 CONFIGURACIÓN REQUERIDA**:
- [ ] Decidir almacenamiento: Local (`/public/uploads/`) o Cloud (S3, Cloudinary, etc.)
- [ ] Crear endpoints de subida:
  - `POST /admin/master/:alumnoId/carta-astral/upload`
  - `POST /admin/master/:alumnoId/diseno-humano/upload`
- [ ] Implementar validación de tipos de archivo (solo imágenes)
- [ ] Implementar límite de tamaño (ej: 5MB)
- [ ] Generar URLs públicas para las imágenes
- [ ] Mostrar imágenes en Modo Master y perfil del alumno

**📝 CONFIGURACIÓN**: **[PENDIENTE DE DECIDIR]**

---

### **3. Estructura Completa de Ajustes**

**Ajustes a definir**:
- Notificaciones (email, push, SMS)
- Preferencias de visualización (tema, idioma)
- Configuración energética (frecuencia, horarios)
- Privacidad (visibilidad de perfil, sinergias)
- Otros ajustes personalizados

**🔧 CONFIGURACIÓN REQUERIDA**:
- [ ] Definir estructura JSON completa de `ajustes`
- [ ] Crear formulario de edición en Modo Master
- [ ] Validar estructura al guardar

**📝 ESTRUCTURA**: **[PENDIENTE DE DEFINIR]**

---

### **4. Sistema de Sinergias (Prácticas Conjuntas)**

**Funcionalidad necesaria**:
- Listar alumnos disponibles para prácticas conjuntas
- Mostrar sinergias activas del alumno
- Permitir al Master ver/editar sinergias

**🔧 CONFIGURACIÓN REQUERIDA**:
- [ ] Mostrar lista de alumnos disponibles en pestaña Información General
- [ ] Mostrar sinergias activas del alumno
- [ ] Crear interfaz para gestionar sinergias (opcional)

---

## 📝 Resumen de Tareas Pendientes

### **Prioridad Alta** 🔴
1. **Crear Typeform para datos de nacimiento**
   - Enlace: **[PENDIENTE]**
   - Webhook: **[PENDIENTE]**

2. **Implementar subida de imágenes (Carta Astral y Diseño Humano)**
   - Endpoints: **[PENDIENTE]**
   - Almacenamiento: **[PENDIENTE DE DECIDIR]**

### **Prioridad Media** 🟡
3. **Definir estructura completa de ajustes**
   - Documento: **[PENDIENTE]**

4. **Mostrar sinergias en pestaña Información General**
   - Implementación: **[EN PROGRESO]**

### **Prioridad Baja** 🟢
5. **Mejorar interfaz de gestión de sinergias**
   - Funcionalidad: **[FUTURO]**

---

## 🔗 Enlaces y Recursos

### **Typeforms Existentes**
- [ ] Formulario de datos de nacimiento: **[PENDIENTE]**
- [ ] Otros formularios: **[REVISAR]**

### **APIs Externas**
- Typeform API: Configurada ✅
- ClickUp API: Configurada ✅
- Kajabi API: Eliminada ❌

### **Almacenamiento**
- Base de datos PostgreSQL: Configurada ✅
- Almacenamiento de imágenes: **[PENDIENTE DE CONFIGURAR]**

---

**Última actualización**: $(date)
**Versión**: 1.0
**Responsable**: Equipo de Desarrollo AuriPortal































