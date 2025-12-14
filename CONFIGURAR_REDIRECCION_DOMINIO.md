# 🔄 Configuración de Redirección: eugenihidalgo.org → www.eugenihidalgo.org

## 🎯 Objetivo

Configurar Cloudflare para que todas las visitas a `eugenihidalgo.org` sean redirigidas automáticamente a `www.eugenihidalgo.org`.

---

## 📋 Pasos para Configurar en Cloudflare Dashboard

### **Paso 1: Acceder a Cloudflare Dashboard**

1. Abre tu navegador y ve a: **https://dash.cloudflare.com**
2. Inicia sesión con tu cuenta de Cloudflare
3. Selecciona el dominio: **`eugenihidalgo.org`**

---

### **Paso 2: Crear Page Rule para Redirección**

1. En el menú lateral izquierdo, haz clic en **"Rules"** → **"Page Rules"**
   - O ve directamente a: **https://dash.cloudflare.com/[ZONE_ID]/rules/page-rules**

2. Haz clic en el botón **"Create Page Rule"** (Crear regla de página)

3. **Configura la regla con estos valores:**

   ```
   URL Pattern (Patrón de URL):
   eugenihidalgo.org/*
   
   Settings (Configuración):
   - Selecciona: "Forwarding URL"
   - Status Code: "301 - Permanent Redirect"
   - Destination URL: https://www.eugenihidalgo.org/$1
   ```

4. Haz clic en **"Save and Deploy"** (Guardar y desplegar)

---

## ✅ Verificación

Una vez configurada la regla, puedes verificar que funciona:

### **Verificación con curl:**

```bash
curl -I http://eugenihidalgo.org
```

**Resultado esperado:**
```
HTTP/1.1 301 Moved Permanently
Location: https://www.eugenihidalgo.org/
```

### **Verificación en el navegador:**

1. Abre una ventana de incógnito
2. Visita: `http://eugenihidalgo.org` o `https://eugenihidalgo.org`
3. Deberías ser redirigido automáticamente a `https://www.eugenihidalgo.org`

---

## 📊 Estado Actual de los Registros DNS

### **Dominio Raíz (eugenihidalgo.org)**
- **Tipo:** A
- **IPs:** 104.18.42.139, 172.64.145.117 (IPs de Kajabi)
- **Proxy:** DNS only (desactivado) ✅

### **Subdominio www (www.eugenihidalgo.org)**
- **Tipo:** CNAME
- **Target:** ssl.kajabi.com
- **Proxy:** DNS only (desactivado) ✅

---

## 🔍 Cómo Funciona la Redirección

1. **Usuario visita:** `eugenihidalgo.org` o `eugenihidalgo.org/cualquier-ruta`
2. **Cloudflare detecta:** La Page Rule coincide con el patrón `eugenihidalgo.org/*`
3. **Cloudflare redirige:** A `https://www.eugenihidalgo.org/$1` (donde `$1` es la ruta original)
4. **Resultado:** El usuario ve `www.eugenihidalgo.org` en su navegador

---

## ⚙️ Configuración Detallada de la Page Rule

### **URL Pattern (Patrón de URL):**
```
eugenihidalgo.org/*
```

Este patrón coincide con:
- ✅ `eugenihidalgo.org` (dominio raíz)
- ✅ `eugenihidalgo.org/` (dominio raíz con barra)
- ✅ `eugenihidalgo.org/cualquier-ruta` (cualquier ruta)
- ✅ `eugenihidalgo.org/pagina.html` (páginas específicas)

### **Destination URL (URL de Destino):**
```
https://www.eugenihidalgo.org/$1
```

- `$1` captura la ruta después de `/*`
- Si visitas `eugenihidalgo.org/productos`, serás redirigido a `www.eugenihidalgo.org/productos`

---

## 🆘 Troubleshooting

### **La redirección no funciona**

1. **Verifica que la Page Rule esté activa:**
   - Ve a Rules → Page Rules
   - Asegúrate de que el estado sea "Active" (Activa)

2. **Verifica el orden de las reglas:**
   - Las Page Rules se ejecutan en orden de prioridad
   - Asegúrate de que esta regla tenga prioridad alta (número bajo)

3. **Limpia la caché:**
   - Espera 1-5 minutos para que Cloudflare actualice la configuración
   - Limpia la caché de tu navegador (Ctrl+Shift+Delete)

4. **Verifica que los registros DNS estén correctos:**
   ```bash
   dig eugenihidalgo.org +short
   dig www.eugenihidalgo.org CNAME +short
   ```

### **Error: "Too many redirects"**

Esto puede ocurrir si hay múltiples reglas de redirección. Verifica:
- Que no haya otra Page Rule que redirija `www.eugenihidalgo.org` de vuelta a `eugenihidalgo.org`
- Que no haya configuraciones en Kajabi que causen redirecciones en bucle

---

## 📝 Notas Importantes

1. **El proxy debe estar desactivado** para los registros DNS de Kajabi (como ya está configurado)

2. **La redirección es permanente (301)**, lo que es bueno para SEO

3. **La propagación puede tardar 1-5 minutos** después de crear la regla

4. **Los cambios son inmediatos** en Cloudflare, pero pueden tardar más en propagarse globalmente

---

## 🎯 Resultado Final

Después de configurar esta redirección:

- ✅ `eugenihidalgo.org` → Redirige a `www.eugenihidalgo.org`
- ✅ `www.eugenihidalgo.org` → Funciona normalmente (apunta a Kajabi)
- ✅ Todas las rutas se preservan (ej: `/productos` → `/productos`)
- ✅ Redirección permanente (301) para SEO

---

**Última actualización:** 2025-01-27  
**Estado:** Configuración lista para aplicar en Cloudflare Dashboard






