# 📋 Plan de Implementación: Sistema de Limpieza Energética Completo

## 🎯 Objetivos

1. **Pantalla pública `/limpieza`** con botones funcionales (rápida, básica, profunda, total)
2. **Sistema de checks** para que alumnos marquen aspectos como limpios
3. **Colaboración Master-Alumno** en limpiezas
4. **Dos tipos de listas**: Regular (recurrente) y Una vez (cantidad mínima)
5. **Sistema de niveles** funcional con ordenamiento automático
6. **Vista "Ver por cada alumno"** con estados (Limpio/Pendiente/Olvidado)
7. **Limpieza global del Master** con registro automático
8. **Ventana flotante** en limpiezas globales con lista copiable

---

## 📊 Estructura de Base de Datos

### **Modificaciones Necesarias**

#### **1. Tabla `aspectos_energeticos`**
Añadir campos:
- `tipo_limpieza` VARCHAR(20) DEFAULT 'regular' -- 'regular' o 'una_vez'
- `cantidad_minima` INTEGER DEFAULT NULL -- Solo para tipo 'una_vez'
- `descripcion_corta` TEXT -- Descripción corta para mostrar en pantalla pública

#### **2. Tabla `aspectos_energeticos_alumnos`**
Añadir campos:
- `cantidad_requerida` INTEGER DEFAULT NULL -- Cantidad personalizada por alumno (para limpiezas de una vez)
- `cantidad_completada` INTEGER DEFAULT 0 -- Cantidad completada por alumno
- `completado_permanentemente` BOOLEAN DEFAULT FALSE -- Para limpiezas de una vez completadas

#### **3. Nueva tabla `secciones_limpieza`**
Para gestionar las pestañas/secciones:
- `id` SERIAL PRIMARY KEY
- `nombre` VARCHAR(200) NOT NULL -- Ej: "Anatomía Energética", "Registros y Karmas"
- `tipo_limpieza` VARCHAR(20) DEFAULT 'regular' -- 'regular' o 'una_vez'
- `activo` BOOLEAN DEFAULT TRUE
- `orden` INTEGER DEFAULT 0
- `botones_mostrar` JSONB DEFAULT '[]' -- Array de botones donde aparece: ['rapida', 'basica', 'profunda', 'total']

#### **4. Modificar `aspectos_energeticos`**
Añadir:
- `seccion_id` INTEGER REFERENCES secciones_limpieza(id)

---

## 🔧 Implementación por Fases

### **FASE 1: Estructura de Base de Datos** ✅
- [x] Crear tabla `secciones_limpieza`
- [ ] Añadir campos a `aspectos_energeticos`
- [ ] Añadir campos a `aspectos_energeticos_alumnos`
- [ ] Migración de datos existentes

### **FASE 2: Sistema de Niveles**
- [ ] Guardado automático de nivel (sin confirmación)
- [ ] Ordenamiento automático por nivel
- [ ] Separación visual por niveles en listas

### **FASE 3: Pantalla Pública `/limpieza`**
- [ ] Endpoint `/limpieza` con validación de sesión
- [ ] Mostrar botones (rápida, básica, profunda, total)
- [ ] Al hacer clic, mostrar aspectos según nivel del alumno
- [ ] Sistema de checks para marcar aspectos
- [ ] Mensaje de completado cuando todos los checks están marcados

### **FASE 4: Sistema de Limpiezas**
- [ ] Endpoint para marcar aspecto como limpio (alumno)
- [ ] Endpoint para limpieza global (Master)
- [ ] Registro en `limpiezas_master_historial`
- [ ] Actualización de estado en tablas de alumnos

### **FASE 5: Vista "Ver por cada alumno"**
- [ ] Ventana flotante con lista de alumnos
- [ ] Estados: Limpio, Pendiente, Olvidado
- [ ] Botón para limpiar individualmente
- [ ] Botón para limpiar todos los suscriptores activos

### **FASE 6: Limpiezas Globales del Master**
- [ ] Detección automática cuando algo está limpio en todos
- [ ] Registro automático en limpiezas globales
- [ ] Ventana flotante con lista de aspectos limpiados hoy
- [ ] Formato: enumeración simple, sin descripciones, sin fechas
- [ ] Botón de copiado

### **FASE 7: Reformular Sección Limpieza Energética**
- [ ] Separar en dos tipos: Regular y Una vez
- [ ] Formato diferente para cada tipo
- [ ] Gestión de pestañas/secciones
- [ ] Integración con botones de limpieza

### **FASE 8: Modo Master - Tab Limpieza Energética**
- [ ] Reflejar nueva estructura
- [ ] Mostrar limpiezas de lugares y proyectos (después)

---

## 📝 Archivos a Crear/Modificar

### **Nuevos Archivos**
1. `src/modules/limpieza.js` - Lógica de negocio
2. `src/endpoints/limpieza-handler.js` - Handler principal
3. `src/endpoints/limpieza-rapida.js` - Handler limpieza rápida
4. `src/endpoints/limpieza-basica.js` - Handler limpieza básica
5. `src/endpoints/limpieza-profunda.js` - Handler limpieza profunda
6. `src/endpoints/limpieza-total.js` - Handler limpieza total
7. `src/services/secciones-limpieza.js` - Gestión de secciones
8. `src/core/html/limpieza-*.html` - Plantillas HTML

### **Archivos a Modificar**
1. `database/pg.js` - Añadir tablas y campos
2. `src/router.js` - Añadir rutas
3. `src/core/responses.js` - Modificar renderPantalla21
4. `src/endpoints/admin-panel-v4.js` - Integrar nueva sección
5. `src/endpoints/admin-limpiezas-master.js` - Añadir ventana flotante
6. `src/endpoints/admin-master.js` - Actualizar tab de limpieza

---

## 🎨 Diseño de Interfaces

### **Pantalla `/limpieza`**
- Header con imagen de Aurelín
- 4 botones grandes: Rápida, Básica, Profunda, Total
- Al hacer clic, mostrar lista de aspectos con checks
- Progreso visual (X/Y completados)
- Mensaje de felicitación al completar

### **Vista "Ver por cada alumno"**
- Modal flotante
- 3 columnas: Limpio | Pendiente | Olvidado
- Botones de acción en cada fila
- Botón "Limpiar todos" destacado

### **Limpiezas Globales**
- Botón "Ver lista de hoy"
- Modal con lista numerada
- Botón "Copiar" grande y visible
- Formato: "1. Chakra Raíz\n2. Chakra Sacral\n..."

---

## ✅ Criterios de Éxito

1. ✅ Alumno puede ver aspectos según su nivel
2. ✅ Alumno puede marcar aspectos como limpios
3. ✅ Master puede ver estado de todos los alumnos
4. ✅ Master puede limpiar individualmente o globalmente
5. ✅ Limpiezas globales se registran automáticamente
6. ✅ Lista copiable funciona correctamente
7. ✅ Niveles se guardan y ordenan automáticamente
8. ✅ Dos tipos de listas funcionan correctamente























