# 👤 Usuario Admin de Prueba para Antigravity

Este directorio contiene scripts para crear y gestionar un usuario admin de prueba para auditoría con Antigravity.

## 📋 Descripción

El usuario admin de prueba permite:
- ✅ Loguearse en el panel admin como cualquier admin normal
- ✅ Acceso completo a todas las funcionalidades admin
- ✅ Persistencia en base de datos PostgreSQL
- ✅ Autenticación segura con passwords hasheadas

## 🔧 Requisitos Previos

1. **Variables de entorno configuradas:**
   - `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`
   - O `DATABASE_URL` con la cadena de conexión completa

2. **PostgreSQL funcionando:**
   - La base de datos debe estar accesible
   - El usuario debe tener permisos para crear tablas e insertar datos

## 📝 Scripts Disponibles

### 1. `create-admin-test-user.js`

Crea el usuario admin de prueba en PostgreSQL.

**Uso:**
```bash
node scripts/create-admin-test-user.js
```

**Qué hace:**
- Crea la tabla `admin_users` si no existe
- Verifica si el usuario ya existe (idempotente)
- Hashea la password usando pbkdf2
- Inserta el usuario con:
  - Email: `admin-test@auriportal.local`
  - Password: `TestAdmin123!`
  - Rol: `admin`
  - Estado: `activo`

**Salida esperada:**
```
✅ Tabla admin_users verificada/creada
🔐 Hasheando password...
📝 Creando usuario admin de prueba: admin-test@auriportal.local
✅ Usuario admin de prueba creado exitosamente

📋 Detalles del usuario:
   Email: admin-test@auriportal.local
   Password: TestAdmin123!
   Rol: admin
   Estado: activo

🔐 El usuario puede loguearse en el panel admin como cualquier admin normal.
   El sistema verificará las credenciales contra la base de datos.
```

### 2. `remove-admin-test-user.js`

Elimina el usuario admin de prueba de PostgreSQL.

**Uso:**
```bash
node scripts/remove-admin-test-user.js
```

**Qué hace:**
- Verifica que el usuario existe
- Valida que es el usuario de prueba (por seguridad)
- Elimina el usuario de la base de datos

**Salida esperada:**
```
🗑️  Eliminando usuario admin de prueba: admin-test@auriportal.local
✅ Usuario admin de prueba eliminado exitosamente
```

## 🔐 Cómo Funciona

### Autenticación Híbrida

El sistema de autenticación admin ahora soporta dos métodos:

1. **Variables de entorno** (comportamiento original):
   - `ADMIN_USER` y `ADMIN_PASS`
   - Prioridad: Se verifica primero

2. **Base de datos** (nuevo):
   - Tabla `admin_users` en PostgreSQL
   - Passwords hasheadas con pbkdf2
   - Se verifica si no coincide con variables de entorno

### Seguridad

- ✅ Passwords hasheadas con pbkdf2 (100,000 iteraciones, sha512)
- ✅ Salt único por usuario
- ✅ Fail-open: Si la BD falla, no rompe el sistema
- ✅ Validación de usuario activo antes de autenticar

## 🚀 Uso del Usuario de Prueba

Una vez creado el usuario, puedes loguearte en el panel admin:

1. Ir a `/admin/login`
2. Ingresar:
   - **Email:** `admin-test@auriportal.local`
   - **Password:** `TestAdmin123!`
3. El sistema verificará las credenciales contra la base de datos

## ⚠️ Notas Importantes

- El usuario de prueba está marcado con `notes: 'Admin de pruebas para Antigravity'`
- El script de eliminación solo elimina usuarios con esta marca (por seguridad)
- El usuario puede ser eliminado y recreado las veces que sea necesario
- Los scripts son idempotentes: pueden ejecutarse múltiples veces sin problemas

## 🔍 Verificación

Para verificar que el usuario fue creado correctamente:

```sql
SELECT email, role, active, created_at, notes 
FROM admin_users 
WHERE email = 'admin-test@auriportal.local';
```

## 📚 Archivos Modificados

- `src/modules/admin-auth.js` - Añadida verificación de usuarios en BD
- `src/endpoints/admin-panel-v4.js` - Actualizado para usar async/await
- `scripts/create-admin-test-user.js` - Script de creación
- `scripts/remove-admin-test-user.js` - Script de eliminación

---

**Creado para auditoría con Antigravity** 🚀








