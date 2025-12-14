# 🌐 Configuración del Subdominio - Dashboard Kajabi

## 🎯 Subdominio a Crear

**URL:** `https://kajabi-dashboard.eugenihidalgo.work`

Dashboard completo, bonito, editable y claro para todos los datos de Kajabi.

---

## 📋 Pasos para Configurar en Cloudflare

### **Paso 1: Acceder a Cloudflare Dashboard**

1. Ve a: **https://dash.cloudflare.com**
2. Inicia sesión
3. Selecciona el dominio: **`eugenihidalgo.work`**

### **Paso 2: Ir a DNS**

1. En el menú lateral, haz clic en **"DNS"** o **"DNS Records"**

### **Paso 3: Agregar Nuevo Registro**

1. Haz clic en **"+ Add record"**

### **Paso 4: Configurar el Registro**

**Configuración recomendada:**

```
Type:        A
Name:        kajabi-dashboard
IPv4 address: 88.99.173.249
Proxy status: 🟠 Proxied (naranja - ACTIVADO) ⚠️ IMPORTANTE
TTL:         Auto
```

**O si prefieres CNAME:**

```
Type:        CNAME
Name:        kajabi-dashboard
Target:      eugenihidalgo.work
Proxy status: 🟠 Proxied (naranja - ACTIVADO)
TTL:         Auto
```

### **Paso 5: Guardar**

1. Haz clic en **"Save"**
2. Espera 1-5 minutos para la propagación DNS

---

## ✅ Verificación

### **Verificar DNS:**

```bash
dig kajabi-dashboard.eugenihidalgo.work
nslookup kajabi-dashboard.eugenihidalgo.work
```

### **Verificar Nginx:**

```bash
sudo nginx -t
sudo systemctl status nginx
```

### **Verificar Servidor:**

```bash
pm2 status
pm2 logs aurelinportal --lines 10
```

---

## 🎨 Características del Dashboard

- ✅ **Interfaz moderna y bonita** con gradientes y animaciones
- ✅ **Totalmente editable** - haz clic en cualquier celda para editar
- ✅ **Muy clara** - diseño limpio y fácil de entender
- ✅ **Búsqueda en tiempo real** - busca en todas las tablas
- ✅ **Actualización automática** - se actualiza cada 30 segundos
- ✅ **Responsive** - funciona en móvil y desktop
- ✅ **Navegación intuitiva** - menú claro con iconos

---

## 📊 Secciones Disponibles

1. **📊 Resumen** - Vista general
2. **👥 Contactos** - Lista completa (editable)
3. **🛒 Compras** - Todas las compras (editable)
4. **💳 Suscripciones** - Suscripciones activas/inactivas (editable)
5. **💰 Transacciones** - Historial completo
6. **📦 Catálogo** - Productos, cursos y ofertas

---

## ✏️ Cómo Editar Datos

1. **Haz clic en cualquier celda** que tenga el cursor de mano (👆)
2. **Escribe el nuevo valor**
3. **Presiona Enter** o haz clic fuera
4. **Los cambios se guardan automáticamente**

### **Campos Editables:**

- **Contactos:** Nombre, teléfono, ciudad, país
- **Compras/Suscripciones:** Razón de desactivación, estado

---

## 🔒 Seguridad (Opcional)

Si quieres proteger el dashboard con contraseña, añade `?password=kaketes7897` a la URL:

```
https://kajabi-dashboard.eugenihidalgo.work?password=kaketes7897
```

O puedes quitar la verificación de contraseña en el código para acceso público.

---

## 🚀 Acceso

Una vez configurado el DNS en Cloudflare:

```
https://kajabi-dashboard.eugenihidalgo.work
```

**¡Listo para usar!** 🎉






