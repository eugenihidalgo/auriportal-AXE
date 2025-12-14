# 🔄 Flujo Actual vs. Nuevo Flujo Propuesto (Solo ClickUp + Datos Propios)

## 📊 FLUJO ACTUAL COMPLETO

### **1. Usuario Nuevo (Primera Vez) - Flujo Actual**

```
1. Usuario visita "/" o "/enter"
   ↓
2. Sistema detecta que NO hay cookie de sesión
   ↓
3. Muestra PANTALLA 0: Formulario de email
   - "Hola de nuevo ✨"
   - Campo para ingresar email
   ↓
4. Usuario ingresa email y envía (POST /enter)
   ↓
5. Sistema verifica en SQL local:
   - ¿Existe el email en la tabla `students`?
   ↓
6a. Si EXISTE en SQL:
   - Crea cookie de sesión (válida 1 año)
   - Redirige a /enter
   - Muestra pantalla de racha (Pantalla 1 o 2)
   
6b. Si NO EXISTE en SQL:
   - Redirige a Typeform de onboarding
   - URL: https://pdeeugenihidalgo.typeform.com/to/GR5IErrl#email=...
   ↓
7. Usuario completa Typeform:
   - Email (pre-rellenado)
   - Apodo
   - Qué les gustaría hacer
   - Idea nueva
   ↓
8. Typeform envía webhook POST a /typeform-webhook
   ↓
9. Sistema procesa webhook:
   a) Guarda en SQL local (tabla `students`):
      - Email
      - Apodo
      - Fecha inscripción (fecha actual)
      - Nivel calculado automáticamente
      - Racha inicial: 0
   
   b) Crea/actualiza tarea en ClickUp:
      - Nombre de tarea: apodo o email
      - Custom field: Email
      - Custom field: Apodo
      - Custom field: Fecha inscripción
      - Custom field: Nivel Aurelín
      - Custom field: Streak general: 0
   
   c) (ANTES también validaba con Kajabi, pero ya no es necesario)
   ↓
10. Typeform redirige a /onboarding-complete?email=...
   ↓
11. Sistema verifica:
    - ¿Existe en SQL? (debería existir por el webhook)
    - ¿Existe en ClickUp? (debería existir por el webhook)
    ↓
12. Si todo está bien:
    - Crea cookie de sesión
    - Registra acceso en logs
    - Actualiza nivel si es necesario
    - Redirige a /enter
   ↓
13. Usuario ve PANTALLA 1 (no ha practicado hoy):
    - Racha: 0 días
    - Nivel actual
    - Botón "Sí, hoy practico"
```

### **2. Usuario Existente (Con Cookie) - Flujo Actual**

```
1. Usuario visita "/" o "/enter" (con cookie válida)
   ↓
2. Sistema lee cookie `auri_user`
   - Extrae email del usuario
   ↓
3. Sistema verifica en SQL:
   - ¿Existe el email en la tabla `students`?
   ↓
4a. Si NO existe en SQL:
   - Limpia cookie
   - Muestra error 403 (sin acceso)
   
4b. Si EXISTE en SQL:
   - Obtiene estudiante de ClickUp (usando email)
   - Gestiona estado de suscripción (pausa/reactivación)
   - Verifica última práctica
   ↓
5. Operaciones en background (no bloquean):
   - Registra acceso en logs
   - Actualiza nivel si es necesario
   - Sincroniza lista principal de ClickUp
   ↓
6. Verifica racha diaria:
   - ¿Ya practicó hoy?
   ↓
7a. Si NO ha practicado hoy:
   - Muestra PANTALLA 1
   - Racha actual
   - Frase motivacional
   - Botón "Sí, hoy practico"
   
7b. Si YA practicó hoy:
   - Muestra PANTALLA 2
   - Racha actual
   - Mensaje de hito (si alcanzó 25, 50, 75, 100+ días)
   - Botones para aprender o trabajar temas
```

### **3. Usuario Practica (Clic en "Sí, hoy practico") - Flujo Actual**

```
1. Usuario hace clic en "Sí, hoy practico"
   → URL: /enter?practico=si
   ↓
2. Sistema verifica:
   - Cookie válida
   - Estado de suscripción (no debe estar pausada)
   ↓
3. Si suscripción está pausada:
   - Muestra mensaje de pausa
   - NO incrementa racha
   ↓
4. Si suscripción está activa:
   - Calcula nueva racha:
     * Si última práctica fue AYER → suma 1
     * Si rompió racha (más de 1 día) → resetea a 1
     * Si es primera vez → establece en 1
   - Actualiza fecha de última práctica (hoy)
   - Actualiza racha en ClickUp
   - Actualiza racha en SQL local
   - Actualiza nivel si es necesario
   - Detecta si alcanzó un hito (25, 50, 75, 100, 150, 200, 365 días)
   ↓
5. Muestra PANTALLA 2 (ya practicó hoy):
   - Mensaje especial si alcanzó hito
   - Racha actualizada
   - Nivel actual
   - Botones para aprender o trabajar temas
```

---

## 🎯 DEPENDENCIAS ACTUALES

### **Sistemas Externos que se Usan:**

1. **Typeform** ✅ (Actualmente activo)
   - Formulario de onboarding
   - Webhook que crea estudiante en SQL y ClickUp

2. **ClickUp** ✅ (Actualmente activo)
   - Base de datos principal de estudiantes
   - Almacena: racha, nivel, apodo, fecha inscripción, temas
   - Custom fields para todos los datos

3. **Kajabi** ⚠️ (Ya NO se usa para validación, pero hay código legacy)
   - Código existente para validar acceso
   - Código para sincronizar datos
   - **Ya no es necesario** en el flujo actual

4. **SQL Local** ✅ (Actualmente activo)
   - Base de datos SQLite local
   - Tabla `students` con datos de estudiantes
   - Cache rápido para verificar existencia

---

## 🚀 NUEVO FLUJO PROPUESTO (Solo ClickUp + Datos Propios)

### **Cambios Principales:**

1. ❌ **Eliminar Typeform** → Reemplazar con formulario propio
2. ❌ **Eliminar Kajabi** → Ya no validar acceso con Kajabi
3. ✅ **ClickUp como única fuente de verdad**
4. ✅ **SQL local como cache rápido**
5. ✅ **Formulario de registro propio en el portal**

---

### **1. Usuario Nuevo (Primera Vez) - Nuevo Flujo**

```
1. Usuario visita "/" o "/enter"
   ↓
2. Sistema detecta que NO hay cookie de sesión
   ↓
3. Muestra PANTALLA 0: Formulario de registro
   - "Bienvenido a Aurelín ✨"
   - Campo para ingresar email
   - Campo para ingresar apodo (opcional)
   - Botón "Comenzar"
   ↓
4. Usuario ingresa datos y envía (POST /enter)
   ↓
5. Sistema verifica:
   - ¿Existe el email en ClickUp?
   ↓
6a. Si EXISTE en ClickUp:
   - Crea cookie de sesión
   - Redirige a /enter
   - Muestra pantalla de racha
   
6b. Si NO EXISTE en ClickUp:
   - Crea nueva tarea en ClickUp:
     * Nombre: apodo o email
     * Custom field: Email
     * Custom field: Apodo
     * Custom field: Fecha inscripción (hoy)
     * Custom field: Nivel Aurelín (1)
     * Custom field: Streak general (0)
   - Guarda en SQL local (cache)
   - Crea cookie de sesión
   - Redirige a /enter
   ↓
7. Usuario ve PANTALLA 1 (no ha practicado hoy):
   - Racha: 0 días
   - Nivel: 1 (Sanación - Inicial)
   - Botón "Sí, hoy practico"
```

**Ventajas:**
- ✅ No depende de Typeform
- ✅ Registro directo en el portal
- ✅ Control total sobre el proceso
- ✅ Más rápido (sin redirecciones externas)

---

### **2. Usuario Existente (Con Cookie) - Nuevo Flujo**

```
1. Usuario visita "/" o "/enter" (con cookie válida)
   ↓
2. Sistema lee cookie `auri_user`
   - Extrae email del usuario
   ↓
3. Sistema verifica en ClickUp:
   - Busca tarea por email (custom field)
   ↓
4a. Si NO existe en ClickUp:
   - Limpia cookie
   - Muestra PANTALLA 0 (formulario de registro)
   
4b. Si EXISTE en ClickUp:
   - Obtiene datos del estudiante
   - Verifica última práctica
   - Actualiza SQL local (cache)
   ↓
5. Operaciones en background:
   - Registra acceso en logs
   - Actualiza nivel si es necesario
   ↓
6. Verifica racha diaria:
   - ¿Ya practicó hoy?
   ↓
7a. Si NO ha practicado hoy:
   - Muestra PANTALLA 1
   
7b. Si YA practicó hoy:
   - Muestra PANTALLA 2
```

**Ventajas:**
- ✅ ClickUp es la única fuente de verdad
- ✅ SQL solo como cache para velocidad
- ✅ No depende de Kajabi

---

### **3. Usuario Practica - Nuevo Flujo**

```
1. Usuario hace clic en "Sí, hoy practico"
   → URL: /enter?practico=si
   ↓
2. Sistema verifica:
   - Cookie válida
   - Estudiante existe en ClickUp
   ↓
3. Calcula nueva racha:
   - Si última práctica fue AYER → suma 1
   - Si rompió racha → resetea a 1
   - Si es primera vez → establece en 1
   ↓
4. Actualiza en ClickUp:
   - Custom field: Streak general
   - Custom field: Última práctica (fecha)
   ↓
5. Actualiza SQL local (cache):
   - Racha actual
   - Última práctica
   ↓
6. Actualiza nivel si es necesario
   ↓
7. Detecta hitos (25, 50, 75, 100+ días)
   ↓
8. Muestra PANTALLA 2 (ya practicó hoy)
```

**Ventajas:**
- ✅ Solo actualiza ClickUp y SQL
- ✅ No depende de sistemas externos
- ✅ Más rápido y confiable

---

## 🔧 CAMBIOS TÉCNICOS NECESARIOS

### **1. Eliminar Dependencias de Typeform**

**Archivos a modificar:**
- `src/endpoints/enter.js` - Eliminar redirección a Typeform
- `src/endpoints/typeform-webhook.js` - Eliminar o adaptar para formulario propio
- `src/endpoints/onboarding-complete.js` - Eliminar (ya no necesario)

**Cambios:**
- Crear formulario de registro en Pantalla 0
- Procesar registro directamente en POST /enter
- Crear estudiante en ClickUp directamente

---

### **2. Eliminar Dependencias de Kajabi**

**Archivos a modificar:**
- `src/endpoints/enter.js` - Eliminar validación con Kajabi
- `src/services/kajabi-sync-sql.js` - Eliminar o desactivar
- `src/services/kajabi-sync.js` - Eliminar o desactivar
- `src/modules/suscripcion.js` - Eliminar verificación de suscripción con Kajabi

**Cambios:**
- Eliminar todas las llamadas a API de Kajabi
- Eliminar validación de "Mundo de Luz"
- Eliminar gestión de suscripciones pausadas (o hacerlo manual en ClickUp)

---

### **3. ClickUp como Única Fuente de Verdad**

**Archivos a mantener/modificar:**
- `src/services/clickup.js` - Mantener (ya funciona bien)
- `src/modules/student.js` - Modificar para solo usar ClickUp
- `database/db.js` - Mantener SQL como cache

**Cambios:**
- Todas las operaciones de lectura/escritura van a ClickUp
- SQL solo como cache local para velocidad
- Sincronización ClickUp → SQL en background

---

### **4. Nuevo Formulario de Registro**

**Crear nuevo archivo:**
- `src/core/html/pantalla0-registro.html` - Formulario de registro propio

**Campos del formulario:**
- Email (requerido)
- Apodo (opcional)
- Botón "Comenzar"

**Procesamiento:**
- POST /enter recibe datos
- Verifica si existe en ClickUp
- Si no existe → crea en ClickUp
- Crea cookie y redirige

---

## 📋 CHECKLIST DE IMPLEMENTACIÓN

### **Fase 1: Eliminar Typeform**
- [ ] Modificar Pantalla 0 para incluir formulario de registro
- [ ] Modificar POST /enter para crear estudiante directamente
- [ ] Eliminar redirección a Typeform
- [ ] Eliminar endpoint /onboarding-complete (o adaptarlo)
- [ ] Mantener /typeform-webhook por si acaso (o eliminarlo)

### **Fase 2: Eliminar Kajabi**
- [ ] Eliminar validación de acceso con Kajabi
- [ ] Eliminar verificación de "Mundo de Luz"
- [ ] Eliminar gestión de suscripciones pausadas (o hacerlo manual)
- [ ] Eliminar sincronización Kajabi → ClickUp
- [ ] Eliminar sincronización Kajabi → SQL
- [ ] Limpiar código legacy de Kajabi

### **Fase 3: ClickUp como Única Fuente**
- [ ] Modificar getOrCreateStudent para solo usar ClickUp
- [ ] Eliminar dependencias de Kajabi en módulos
- [ ] Asegurar que todas las operaciones van a ClickUp
- [ ] Mantener SQL como cache (opcional, para velocidad)

### **Fase 4: Testing**
- [ ] Probar registro de nuevo usuario
- [ ] Probar acceso de usuario existente
- [ ] Probar práctica diaria
- [ ] Probar actualización de racha
- [ ] Probar actualización de nivel
- [ ] Verificar que no hay errores de Kajabi/Typeform

---

## 🎯 VENTAJAS DEL NUEVO FLUJO

1. **✅ Independencia Total**
   - No depende de Typeform
   - No depende de Kajabi
   - Solo ClickUp y datos propios

2. **✅ Control Completo**
   - Formulario propio en el portal
   - Proceso de registro controlado
   - Sin redirecciones externas

3. **✅ Más Rápido**
   - Menos pasos en el flujo
   - Sin esperar webhooks externos
   - Registro instantáneo

4. **✅ Más Simple**
   - Menos sistemas involucrados
   - Menos puntos de fallo
   - Código más limpio

5. **✅ Más Confiable**
   - No depende de APIs externas
   - ClickUp es estable y confiable
   - Menos errores potenciales

---

## ⚠️ CONSIDERACIONES

### **1. Migración de Usuarios Existentes**
- Los usuarios que ya están en ClickUp seguirán funcionando
- No se pierden datos
- Solo cambia el flujo de registro

### **2. Validación de Acceso**
- **Pregunta:** ¿Seguimos validando que tengan acceso?
- **Opciones:**
  - Opción A: Eliminar validación (cualquiera puede registrarse)
  - Opción B: Validar manualmente en ClickUp (añadir campo "tiene_acceso")
  - Opción C: Validar con lista de emails permitidos

### **3. Gestión de Suscripciones**
- **Pregunta:** ¿Cómo gestionamos suscripciones pausadas?
- **Opciones:**
  - Opción A: Eliminar gestión automática (manual en ClickUp)
  - Opción B: Campo en ClickUp "suscripcion_pausada" (boolean)
  - Opción C: Lista separada de emails pausados

### **4. SQL como Cache**
- **Pregunta:** ¿Mantenemos SQL como cache?
- **Recomendación:** Sí, para velocidad
- ClickUp puede ser lento, SQL es instantáneo
- Sincronizar ClickUp → SQL en background

---

## 📝 RESUMEN

**Flujo Actual:**
```
Usuario → Typeform → Webhook → ClickUp + SQL → Cookie → Portal
```

**Nuevo Flujo:**
```
Usuario → Formulario Propio → ClickUp + SQL → Cookie → Portal
```

**Sistemas Eliminados:**
- ❌ Typeform
- ❌ Kajabi

**Sistemas Mantenidos:**
- ✅ ClickUp (única fuente de verdad)
- ✅ SQL (cache local)
- ✅ Portal propio

---

*Documento creado: $(date)*
*Versión: Propuesta v1.0*






