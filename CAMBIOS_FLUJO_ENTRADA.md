# 🔄 Cambios en el Flujo de Entrada - AurelinPortal

## 📋 Resumen de Cambios

Se ha modificado el flujo de entrada del portal para mejorar la experiencia del usuario y reducir la dependencia de la API de Kajabi mediante el uso de una base de datos SQL local.

---

## 🎯 Nuevo Flujo de Entrada

### **1. Usuario sin Cookie (Primera Vez o Sesión Expirada)**

```
Usuario visita "/" o "/enter"
  ↓
Pantalla 0: Formulario de email
  ↓
Usuario ingresa email y envía
  ↓
Sistema verifica acceso:
  - Consulta SQL local primero (rápido)
  - Si no está o está desactualizado → consulta Kajabi
  - Sincroniza datos a SQL
  ↓
¿Tiene "Mundo de Luz"?
  ├─ NO → Muestra error 403
  └─ SÍ → Verifica si existe en ClickUp o SQL
      ├─ NO existe → Redirige a Typeform (para poner apodo)
      └─ SÍ existe → Crea cookie y va a pantalla de racha
```

### **2. Usuario con Cookie (Visitas Subsecuentes)**

```
Usuario visita "/" o "/enter" (con cookie)
  ↓
Sistema lee cookie
  ↓
Verifica acceso rápidamente desde SQL (cache 24h)
  ↓
Si tiene acceso → Va DIRECTAMENTE a pantalla de racha
  (Pantalla 1 si no ha practicado, Pantalla 2 si ya practicó)
```

---

## 🔧 Cambios Técnicos Implementados

### **1. Nuevo Módulo: `kajabi-sync-sql.js`**

**Ubicación:** `src/services/kajabi-sync-sql.js`

**Funciones principales:**
- `sincronizarEmailKajabiASQL(email, env)` - Sincroniza un email desde Kajabi a SQL
- `verificarAccesoDesdeSQL(email, env, maxAgeHours)` - Verifica acceso usando SQL primero
- `existeEstudiante(email, env)` - Verifica si existe en ClickUp o SQL

**Ventajas:**
- ✅ Consultas rápidas desde SQL local
- ✅ Reduce llamadas a API de Kajabi
- ✅ Cache de 24 horas por defecto
- ✅ Sincronización automática en background

### **2. Modificaciones en `enter.js`**

**Cambios principales:**
- ✅ Eliminada redirección automática a Typeform en primera visita
- ✅ Verificación de existencia de estudiante antes de crear cookie
- ✅ Si no existe → redirige a Typeform
- ✅ Si existe → crea cookie y va directamente a pantalla de racha
- ✅ Uso de SQL para verificación rápida de acceso

### **3. Script de Prueba: `test-kajabi-api.js`**

**Ubicación:** `scripts/test-kajabi-api.js`

**Uso:**
```bash
node scripts/test-kajabi-api.js email@ejemplo.com
```

**Funcionalidad:**
- Prueba verificación de acceso
- Obtiene datos completos de Kajabi
- Muestra información detallada para debugging

---

## 📊 Flujo Comparativo

### **ANTES:**
```
Sin cookie → Typeform automático → Webhook → Onboarding → Cookie → Pantalla racha
Con cookie → Verificar Kajabi → Pantalla racha
```

### **AHORA:**
```
Sin cookie → Pantalla 0 → Verificar acceso → ¿Existe? → Typeform o Pantalla racha
Con cookie → Verificar SQL (rápido) → Pantalla racha directamente
```

---

## 🗄️ Base de Datos SQL

### **Tabla `students` (Actualizada)**

La tabla ya incluye todos los campos necesarios:
- `email` - Email único del estudiante
- `clickup_task_id` - ID de tarea en ClickUp
- `nombre` - Nombre completo (de Kajabi)
- `apodo` - Apodo (de Typeform)
- `tiene_mundo_de_luz` - Boolean (0/1)
- `suscripcion_pausada` - Boolean (0/1)
- `fecha_inscripcion` - Fecha de compra/inscripción
- `sync_updated_at` - Última sincronización con Kajabi

### **Índices Añadidos:**
- `idx_students_tiene_mundo_de_luz` - Para búsquedas rápidas de acceso
- `idx_students_sync_updated_at` - Para verificar antigüedad de datos

---

## 🔍 Verificación de API de Kajabi

### **Cómo Probar:**

1. **Ejecutar script de prueba:**
```bash
cd /var/www/aurelinportal
node scripts/test-kajabi-api.js email@ejemplo.com
```

2. **Verificar logs:**
   - ✅ Acceso permitido/denegado
   - ✅ Datos de persona
   - ✅ Ofertas y compras
   - ✅ Fecha de compra "Mundo de Luz"

3. **Probar flujo completo:**
   - Visitar `/enter` sin cookie
   - Ingresar email válido
   - Verificar que redirige correctamente

---

## ⚠️ Consideraciones Importantes

### **1. Sincronización Automática**
- Los datos se sincronizan automáticamente en background
- No bloquea la experiencia del usuario
- Cache de 24 horas para reducir llamadas a API

### **2. Fallback a Kajabi**
- Si SQL no tiene datos o están desactualizados → consulta Kajabi
- Si falla Kajabi pero hay datos antiguos en SQL → usa datos antiguos con warning

### **3. Compatibilidad**
- El sistema sigue funcionando si falla la sincronización SQL
- ClickUp sigue siendo la fuente de verdad principal
- SQL es caché para velocidad

---

## 🚀 Próximos Pasos

1. **Probar el script de verificación de API:**
   ```bash
   node scripts/test-kajabi-api.js tu-email@ejemplo.com
   ```

2. **Verificar que la sincronización funciona:**
   - Ingresar email en pantalla 0
   - Verificar que se sincroniza a SQL
   - Comprobar en base de datos

3. **Probar flujo completo:**
   - Usuario nuevo sin registro → debe ir a Typeform
   - Usuario existente → debe ir a pantalla de racha
   - Usuario con cookie → debe ir directamente a pantalla de racha

---

## 📝 Notas

- La base de datos SQL se inicializa automáticamente al iniciar el servidor
- Los índices se crean automáticamente si no existen
- La sincronización es incremental (no borra datos existentes)
- El sistema es resiliente a fallos (continúa funcionando aunque falle SQL o Kajabi)

---

*Documento generado: $(date)*
*Versión: AuriPortal v3.2*









