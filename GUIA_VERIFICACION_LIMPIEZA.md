# ✅ Guía de Verificación: Sistema de Limpieza Energética

## 📋 Resumen

Esta guía te ayudará a verificar paso a paso que todas las funcionalidades del nuevo sistema de limpieza energética estén funcionando correctamente.

---

## 🔧 PASO 1: Verificar Base de Datos

### 1.1. Verificar que las tablas nuevas existen

```sql
-- Conectar a PostgreSQL
psql -U postgres -d aurelinportal

-- Verificar tabla secciones_limpieza
SELECT * FROM secciones_limpieza LIMIT 1;

-- Verificar campos nuevos en aspectos_energeticos
SELECT 
  tipo_limpieza, 
  cantidad_minima, 
  descripcion_corta, 
  seccion_id 
FROM aspectos_energeticos 
LIMIT 1;

-- Verificar campos nuevos en aspectos_energeticos_alumnos
SELECT 
  cantidad_requerida, 
  cantidad_completada, 
  completado_permanentemente 
FROM aspectos_energeticos_alumnos 
LIMIT 1;
```

**✅ Resultado esperado**: Todas las consultas deben ejecutarse sin errores.

---

## 🎨 PASO 2: Verificar Pantalla Pública `/limpieza`

### 2.1. Acceder a la pantalla principal

1. Inicia sesión como alumno (con cookie válida)
2. Visita: `https://pdeeugenihidalgo.org/limpieza`
3. **Verificar**: Debes ver 4 botones:
   - ⚡ Limpieza Rápida
   - 🧘 Limpieza Básica
   - 🌊 Limpieza Profunda
   - ✨ Limpieza Total

### 2.2. Probar cada botón

**Limpieza Rápida:**
1. Haz clic en "⚡ Limpieza Rápida"
2. **Verificar**: Debes ver una lista de aspectos (máximo 3)
3. **Verificar**: Cada aspecto tiene un checkbox
4. **Verificar**: Hay un contador: "0 / X aspectos completados"

**Limpieza Básica:**
1. Haz clic en "🧘 Limpieza Básica"
2. **Verificar**: Debes ver una lista de aspectos (máximo 7)

**Limpieza Profunda:**
1. Haz clic en "🌊 Limpieza Profunda"
2. **Verificar**: Debes ver una lista de aspectos (máximo 15)

**Limpieza Total:**
1. Haz clic en "✨ Limpieza Total"
2. **Verificar**: Debes ver todos los aspectos disponibles según tu nivel

---

## ✅ PASO 3: Verificar Sistema de Checks

### 3.1. Marcar aspectos como limpios

1. En cualquier pantalla de limpieza, marca un checkbox
2. **Verificar**: El checkbox se marca visualmente
3. **Verificar**: El contador se actualiza (ej: "1 / 5 aspectos completados")
4. **Verificar**: No hay errores en la consola del navegador

### 3.2. Verificar registro en base de datos

```sql
-- Verificar que se registró la limpieza
SELECT * FROM aspectos_energeticos_alumnos 
WHERE alumno_id = [TU_ID] 
ORDER BY updated_at DESC 
LIMIT 5;

-- Verificar que se registró en el historial del master
SELECT * FROM limpiezas_master_historial 
WHERE alumno_id = [TU_ID] 
ORDER BY fecha_limpieza DESC 
LIMIT 5;
```

**✅ Resultado esperado**: Debes ver registros con `ultima_limpieza` actualizado y registros en el historial.

### 3.3. Completar una limpieza

1. Marca todos los checkboxes de una limpieza
2. **Verificar**: Aparece un mensaje verde: "¡[Tipo de Limpieza] completada! ✨"
3. **Verificar**: El mensaje tiene animación de aparición

---

## 👨‍🏫 PASO 4: Verificar Funcionalidades del Master

### 4.1. Acceder a Limpiezas Globales

1. Inicia sesión como Master (admin)
2. Visita: `https://admin.pdeeugenihidalgo.org/admin/limpiezas-master?filtro=hoy`
3. **Verificar**: Debes ver el panel de limpiezas globales
4. **Verificar**: Hay un botón "📋 Ver lista de hoy"

### 4.2. Probar ventana flotante de lista copiable

1. Haz clic en "📋 Ver lista de hoy"
2. **Verificar**: Se abre un modal con una lista de aspectos
3. **Verificar**: La lista está numerada (1. Aspecto 1, 2. Aspecto 2, etc.)
4. **Verificar**: No hay descripciones ni fechas
5. Haz clic en "📋 Copiar lista"
6. **Verificar**: El botón cambia a "✅ ¡Copiado!"
7. Pega en un editor de texto
8. **Verificar**: La lista se pega correctamente, solo nombres numerados

### 4.3. Verificar filtros

1. Prueba el filtro "Hoy"
2. Prueba el filtro "Ayer"
3. Prueba el filtro "Todas"
4. **Verificar**: Cada filtro muestra las limpiezas correspondientes

---

## 🔍 PASO 5: Verificar "Ver por cada alumno"

### 5.1. Acceder desde panel admin

1. En el panel admin, busca un aspecto energético
2. **Verificar**: Hay un botón "Ver por cada alumno"
3. Haz clic en el botón
4. **Verificar**: Se abre un modal con 3 columnas:
   - Limpio
   - Pendiente
   - Olvidado

### 5.2. Verificar estados

1. **Verificar**: En "Limpio" aparecen alumnos con limpieza reciente
2. **Verificar**: En "Pendiente" aparecen alumnos que necesitan limpieza
3. **Verificar**: En "Olvidado" aparecen alumnos sin limpieza o muy antigua

### 5.3. Probar limpieza individual

1. En el modal, busca un alumno en "Pendiente" o "Olvidado"
2. Haz clic en "Limpiar" junto al alumno
3. **Verificar**: El alumno se mueve a la columna "Limpio"
4. **Verificar**: Se registra en `limpiezas_master_historial`

### 5.4. Probar limpieza global

1. En el modal, haz clic en "Limpiar todos los suscriptores activos"
2. Confirma la acción
3. **Verificar**: Todos los alumnos se mueven a "Limpio"
4. **Verificar**: Se registra en `limpiezas_master_historial` con `alumno_id = NULL`
5. **Verificar**: Aparece en limpiezas globales del Master

---

## 📊 PASO 6: Verificar Sistema de Niveles

### 6.1. Verificar que los aspectos se filtran por nivel

1. Como alumno de nivel 1, visita `/limpieza/rapida`
2. **Verificar**: Solo ves aspectos con `nivel_minimo <= 1`
3. Cambia tu nivel a 5 (desde admin)
4. Recarga la página
5. **Verificar**: Ahora ves más aspectos (con `nivel_minimo <= 5`)

### 6.2. Verificar ordenamiento por nivel

1. En el panel admin, ve a la sección de aspectos energéticos
2. **Verificar**: Los aspectos están agrupados por nivel
3. Cambia el nivel de un aspecto
4. **Verificar**: El aspecto se mueve automáticamente a su nuevo grupo de nivel

---

## 🔄 PASO 7: Verificar Limpiezas Regulares vs Una Vez

### 7.1. Limpiezas Regulares

1. Crea un aspecto con `tipo_limpieza = 'regular'`
2. Marca el aspecto como limpio
3. **Verificar**: Se actualiza `ultima_limpieza`
4. Espera o cambia la fecha en la BD
5. **Verificar**: El aspecto vuelve a aparecer como pendiente después de `frecuencia_dias`

### 7.2. Limpiezas de Una Vez

1. Crea un aspecto con `tipo_limpieza = 'una_vez'` y `cantidad_minima = 3`
2. Marca el aspecto como limpio 3 veces
3. **Verificar**: `cantidad_completada = 3`
4. **Verificar**: `completado_permanentemente = true`
5. **Verificar**: El aspecto ya no aparece en las listas de limpieza

---

## 🎯 PASO 8: Verificar Secciones de Limpieza

### 8.1. Crear una sección

```sql
INSERT INTO secciones_limpieza (nombre, tipo_limpieza, activo, orden, botones_mostrar)
VALUES ('Anatomía Energética', 'regular', true, 1, '["rapida", "basica", "profunda", "total"]'::jsonb);
```

### 8.2. Asignar aspectos a la sección

```sql
UPDATE aspectos_energeticos 
SET seccion_id = (SELECT id FROM secciones_limpieza WHERE nombre = 'Anatomía Energética' LIMIT 1)
WHERE nombre LIKE 'Chakra%';
```

### 8.3. Verificar que aparecen en los botones correctos

1. Visita `/limpieza/rapida`
2. **Verificar**: Solo ves aspectos de secciones que tienen "rapida" en `botones_mostrar`
3. Visita `/limpieza/total`
4. **Verificar**: Ves todos los aspectos de todas las secciones

---

## 🐛 PASO 9: Verificar Errores y Casos Especiales

### 9.1. Alumno sin sesión

1. Cierra sesión (elimina cookie)
2. Visita `/limpieza`
3. **Verificar**: Te redirige a la pantalla de login (pantalla 0)

### 9.2. Alumno sin aspectos asignados

1. Crea un alumno nuevo sin aspectos
2. Visita `/limpieza/rapida`
3. **Verificar**: Ves un mensaje indicando que no hay aspectos (o lista vacía)

### 9.3. Master sin autenticación

1. Intenta acceder a `/admin/limpiezas-master` sin autenticación
2. **Verificar**: Te redirige al login

---

## 📝 PASO 10: Verificar Registros en Historial

### 10.1. Verificar registro de limpieza de alumno

```sql
SELECT * FROM limpiezas_master_historial 
WHERE alumno_id IS NOT NULL 
ORDER BY fecha_limpieza DESC 
LIMIT 10;
```

**✅ Resultado esperado**: Debes ver registros con `alumno_id`, `aspecto_id`, `aspecto_nombre`, `fecha_limpieza`.

### 10.2. Verificar registro de limpieza global

```sql
SELECT * FROM limpiezas_master_historial 
WHERE alumno_id IS NULL 
ORDER BY fecha_limpieza DESC 
LIMIT 10;
```

**✅ Resultado esperado**: Debes ver registros con `alumno_id = NULL` (limpiezas globales).

---

## ✅ Checklist Final

- [ ] Base de datos: Tablas y campos creados correctamente
- [ ] Pantalla pública: 4 botones funcionan
- [ ] Sistema de checks: Marcar aspectos funciona
- [ ] Mensaje de completado: Aparece cuando se completan todos
- [ ] Limpiezas globales: Panel funciona y muestra limpiezas
- [ ] Lista copiable: Modal funciona y copia correctamente
- [ ] Ver por cada alumno: Modal muestra estados correctos
- [ ] Limpieza individual: Master puede limpiar a un alumno
- [ ] Limpieza global: Master puede limpiar a todos
- [ ] Sistema de niveles: Filtrado y ordenamiento funcionan
- [ ] Limpiezas regulares: Se repiten según frecuencia
- [ ] Limpiezas de una vez: Se completan permanentemente
- [ ] Secciones: Los aspectos aparecen en los botones correctos
- [ ] Historial: Se registran todas las limpiezas

---

## 🆘 Si Algo No Funciona

1. **Revisa los logs del servidor**: `npm run pm2:logs` o `tail -f logs/server.log`
2. **Revisa la consola del navegador**: F12 → Console
3. **Verifica la base de datos**: Ejecuta las consultas SQL de verificación
4. **Revisa las rutas**: Asegúrate de que el router tiene todas las rutas configuradas

---

**Fecha de creación**: $(date)
**Versión del sistema**: AuriPortal v3.1 - Sistema de Limpieza Energética Completo




