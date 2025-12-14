# ⏰ Frecuencia de Sincronización Kajabi → SQL

## 📊 Resumen

**Actualmente, la sincronización se realiza de forma automática e instantánea cuando alguien accede al portal, NO hay sincronización programada (diaria/semanal).**

---

## 🔄 Sincronización Automática (Tiempo Real)

### **Cuándo se sincroniza automáticamente:**

1. **Cuando alguien entra con su email (POST /enter)**
   - Se sincroniza en background (no bloquea la experiencia)
   - Línea 61 en `enter.js`: `sincronizarEmailKajabiASQL(email, env)`

2. **Cuando alguien con cookie accede al portal (GET /enter)**
   - Se sincroniza en background cada vez que entra
   - Línea 161 en `enter.js`: `sincronizarEmailKajabiASQL(cookie.email, env)`

3. **Cuando se verifica acceso desde SQL**
   - Si los datos tienen más de 24 horas, se sincroniza automáticamente
   - Línea 153 en `kajabi-sync-sql.js`: `await sincronizarEmailKajabiASQL(email, env)`

### **Ventajas:**
- ✅ **Instantáneo**: Los datos se actualizan cuando alguien entra
- ✅ **No bloquea**: Se hace en background, no afecta la experiencia del usuario
- ✅ **Eficiente**: Solo sincroniza cuando es necesario
- ✅ **Actualizado**: Si alguien se apunta hoy, se sincroniza hoy mismo

### **Desventajas:**
- ⚠️ Si nadie entra, los datos no se actualizan
- ⚠️ Si alguien se apunta pero nunca entra al portal, no se sincroniza

---

## 🔧 Sincronización Manual (Panel de Control)

### **Cuándo se puede sincronizar manualmente:**

1. **Sincronización masiva completa** (`/sync-kajabi-all`)
   - Sincroniza TODOS los contactos de Kajabi a SQL
   - Incluye: personas, ofertas y compras completas
   - Se hace desde el panel de control: `https://controlauriportal.eugenihidalgo.work/admin`

2. **Sincronización ClickUp ↔ Kajabi** (`/sync-all`)
   - Sincroniza datos de Kajabi a ClickUp
   - Actualiza información de estudiantes existentes

---

## ⏰ ¿Se sincroniza automáticamente cada día/semana?

**NO, actualmente NO hay sincronización programada (cron job).**

### **Opciones para añadir sincronización programada:**

#### **Opción 1: Cron Job en el Servidor**
```bash
# Añadir a crontab para sincronizar todos los días a las 3 AM
0 3 * * * curl -X GET "https://controlauriportal.eugenihidalgo.work/sync-kajabi-all?password=kaketes7897" > /dev/null 2>&1
```

#### **Opción 2: Sincronización Semanal Manual**
- Ejecutar desde el panel de control cada semana
- O programar recordatorio para ejecutarlo

#### **Opción 3: Añadir Sincronización Programada en el Código**
- Usar `node-cron` o similar
- Ejecutar sincronización masiva cada X días

---

## 📋 Recomendaciones

### **Para Usuarios Nuevos:**
- ✅ **Funciona bien**: Si alguien se apunta y entra al portal, se sincroniza instantáneamente
- ✅ **No hay problema**: Los datos se actualizan en tiempo real

### **Para Mantener Datos Actualizados:**
1. **Opción Recomendada**: Ejecutar sincronización masiva semanalmente desde el panel
   - Cada lunes, por ejemplo
   - Asegura que todos los datos estén actualizados

2. **Opción Automática**: Configurar cron job para sincronización diaria/semanal
   - Más trabajo de configuración
   - Pero completamente automático

3. **Opción Actual**: Dejar como está
   - Funciona bien si los usuarios entran regularmente
   - Los datos se actualizan cuando alguien accede

---

## 🔍 Cómo Verificar Última Sincronización

### **Desde la Base de Datos:**
```sql
-- Ver última sincronización de cada contacto
SELECT email, sync_updated_at, tiene_mundo_de_luz 
FROM students 
ORDER BY sync_updated_at DESC 
LIMIT 20;

-- Ver contactos que no se han sincronizado en más de 7 días
SELECT email, sync_updated_at 
FROM students 
WHERE sync_updated_at < datetime('now', '-7 days')
ORDER BY sync_updated_at ASC;
```

### **Desde el Panel de Control:**
- Ver estadísticas en tiempo real
- Ver últimos logs de sincronización

---

## ✅ Conclusión

**Actualmente:**
- ✅ Sincronización **instantánea** cuando alguien entra
- ✅ Sincronización **manual** disponible desde el panel
- ❌ **NO hay** sincronización programada automática

**Recomendación:**
- Si quieres asegurar que todos los datos estén actualizados, ejecuta la sincronización masiva semanalmente desde el panel
- O configura un cron job para hacerlo automáticamente

---

*Documento generado: $(date)*









