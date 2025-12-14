# 📊 Documentación: Base de Datos de Kajabi

## 🎯 Objetivo

Sistema completo de base de datos SQL para almacenar **todos** los datos de contactos, ofertas y compras de Kajabi. Esto permite:

- ✅ Operar sin depender constantemente de la API de Kajabi
- ✅ Consultas rápidas desde SQL local
- ✅ Historial completo de sincronizaciones
- ✅ Datos estructurados y relacionados

---

## 🗄️ Estructura de la Base de Datos

### **Tabla: `kajabi_contacts`**

Almacena información completa de cada contacto/persona de Kajabi.

**Campos principales:**
- `kajabi_id` - ID único de Kajabi
- `email` - Email (único, índice)
- `first_name`, `last_name`, `name` - Nombres
- `phone`, `city`, `state`, `country` - Información de contacto
- `tiene_mundo_de_luz` - Boolean (0/1)
- `fecha_compra_mundo_de_luz` - Fecha de compra
- `estado_suscripcion` - Estado actual (active, paused, etc.)
- `suscripcion_activa`, `suscripcion_pausada` - Booleanos
- `sync_updated_at` - Última sincronización

### **Tabla: `kajabi_offers`**

Almacena todas las ofertas/suscripciones de cada contacto.

**Campos principales:**
- `kajabi_offer_id` - ID único de la oferta
- `contact_id` - FK a `kajabi_contacts`
- `product_name`, `course_name` - Nombre del producto/curso
- `status` - Estado (active, paused, canceled, etc.)
- `created_at`, `started_at`, `expires_at` - Fechas
- `price_cents`, `currency` - Precio
- `metadata` - JSON con datos adicionales

### **Tabla: `kajabi_purchases`**

Almacena todas las compras de cada contacto.

**Campos principales:**
- `kajabi_purchase_id` - ID único de la compra
- `contact_id` - FK a `kajabi_contacts`
- `product_name`, `course_name` - Nombre del producto/curso
- `purchased_at` - Fecha de compra
- `price_cents`, `currency` - Precio
- `metadata` - JSON con datos adicionales

### **Tabla: `sync_log_kajabi`**

Log de todas las sincronizaciones realizadas.

**Campos principales:**
- `action` - Tipo de acción (sync_all, sync_contact, etc.)
- `contact_email` - Email sincronizado
- `success` - Boolean (0/1)
- `records_processed`, `records_created`, `records_updated` - Estadísticas
- `sync_duration_ms` - Duración en milisegundos

---

## 🔄 Sincronización

### **Sincronizar un Contacto Individual**

```javascript
import { sincronizarContactoCompleto } from './src/services/kajabi-db.js';

const resultado = await sincronizarContactoCompleto('email@ejemplo.com', env);
// Sincroniza: persona + ofertas + compras
```

### **Sincronizar Múltiples Contactos**

```javascript
import { sincronizarMultiplesContactos } from './src/services/kajabi-db.js';

const emails = ['email1@ejemplo.com', 'email2@ejemplo.com'];
const resultados = await sincronizarMultiplesContactos(emails, env, {
  delay: 150, // ms entre cada sincronización
  onProgress: (progress) => {
    console.log(`Progreso: ${progress.current}/${progress.total}`);
  }
});
```

### **Sincronización Masiva (Todos los Contactos)**

**Endpoint HTTP:**
```
GET /sync-kajabi-all
```

Este endpoint:
1. Obtiene todos los contactos de Kajabi (paginado)
2. Extrae los emails
3. Sincroniza cada contacto completo (persona + ofertas + compras)
4. Muestra resumen con estadísticas

**Uso:**
```bash
# Desde el navegador o curl
curl http://localhost:3000/sync-kajabi-all
```

---

## 📊 Consultas Útiles

### **Ver todos los contactos con Mundo de Luz**

```sql
SELECT email, name, fecha_compra_mundo_de_luz, estado_suscripcion
FROM kajabi_contacts
WHERE tiene_mundo_de_luz = 1
ORDER BY fecha_compra_mundo_de_luz DESC;
```

### **Ver ofertas activas de un contacto**

```sql
SELECT o.product_name, o.status, o.started_at, o.expires_at
FROM kajabi_offers o
JOIN kajabi_contacts c ON o.contact_id = c.id
WHERE c.email = 'email@ejemplo.com'
  AND o.status = 'active';
```

### **Ver compras de Mundo de Luz**

```sql
SELECT c.email, c.name, p.purchased_at, p.product_name
FROM kajabi_purchases p
JOIN kajabi_contacts c ON p.contact_id = c.id
WHERE p.product_name LIKE '%Mundo de Luz%'
ORDER BY p.purchased_at DESC;
```

### **Estadísticas de sincronización**

```sql
SELECT 
  action,
  COUNT(*) as total,
  SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as exitosos,
  SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as fallidos,
  AVG(sync_duration_ms) as duracion_promedio_ms
FROM sync_log_kajabi
GROUP BY action
ORDER BY synced_at DESC;
```

---

## 🚀 Inicialización

Las tablas se crean automáticamente al iniciar el servidor. El archivo `database/db.js` ejecuta el schema `schema-kajabi-completo.sql` automáticamente.

Si necesitas recrear las tablas manualmente:

```bash
sqlite3 database/aurelinportal.db < database/schema-kajabi-completo.sql
```

---

## ⚠️ Consideraciones

### **Rate Limits de Kajabi**
- La API de Kajabi tiene límites de ~100 requests/minuto
- El sistema incluye delays automáticos entre sincronizaciones
- La sincronización masiva puede tardar varios minutos

### **Tamaño de la Base de Datos**
- Cada contacto puede tener múltiples ofertas y compras
- Se recomienda hacer limpieza periódica de datos antiguos si es necesario
- Los índices optimizan las consultas

### **Sincronización Incremental**
- El sistema usa `ON CONFLICT DO UPDATE` para actualizar registros existentes
- No duplica datos si se sincroniza múltiples veces
- Mantiene historial de última sincronización

---

## 📝 Próximos Pasos

1. **Sincronizar todos los contactos:**
   ```bash
   # Visitar en navegador o usar curl
   http://localhost:3000/sync-kajabi-all
   ```

2. **Verificar datos sincronizados:**
   ```bash
   sqlite3 database/aurelinportal.db "SELECT COUNT(*) FROM kajabi_contacts;"
   sqlite3 database/aurelinportal.db "SELECT COUNT(*) FROM kajabi_offers;"
   sqlite3 database/aurelinportal.db "SELECT COUNT(*) FROM kajabi_purchases;"
   ```

3. **Consultar contactos con Mundo de Luz:**
   ```bash
   sqlite3 database/aurelinportal.db "SELECT email, name FROM kajabi_contacts WHERE tiene_mundo_de_luz = 1 LIMIT 10;"
   ```

---

*Documento generado: $(date)*
*Versión: AuriPortal v3.2*









