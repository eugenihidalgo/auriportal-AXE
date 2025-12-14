# 🔧 Configuración del Subdominio SQL

## 📋 Resumen

Se ha creado un panel de administración SQL accesible desde el subdominio:
**`sqlpdeaurelin.eugenihidalgo.work`**

Este panel permite:
- ✅ Ver todas las bases de datos de alumnos de Kajabi
- ✅ Editar parámetros de los estudiantes
- ✅ Buscar y filtrar registros
- ✅ Navegar por todas las tablas: `students`, `kajabi_contacts`, `kajabi_offers`, `kajabi_purchases`, etc.

## 🚀 Configuración del Subdominio

### Opción 1: Usando Nginx (Recomendado)

1. **Crear configuración de Nginx para el subdominio:**

```bash
sudo nano /etc/nginx/sites-available/sqlpdeaurelin.eugenihidalgo.work
```

2. **Agregar la siguiente configuración:**

```nginx
server {
    listen 80;
    server_name sqlpdeaurelin.eugenihidalgo.work;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

3. **Habilitar el sitio:**

```bash
sudo ln -s /etc/nginx/sites-available/sqlpdeaurelin.eugenihidalgo.work /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

4. **Configurar SSL (Opcional pero recomendado):**

```bash
sudo certbot --nginx -d sqlpdeaurelin.eugenihidalgo.work
```

### Opción 2: Usando Cloudflare (Si ya tienes Cloudflare configurado)

📖 **Para una guía paso a paso detallada, consulta:** `GUIA_CLOUDFLARE_SQL.md`

**Resumen rápido:**
1. **Ir a Cloudflare Dashboard** → DNS
2. **Agregar registro DNS:**
   - Tipo: `A` o `CNAME`
   - Nombre: `sqlpdeaurelin`
   - Contenido: IP de tu servidor o dominio principal
   - Proxy: 🟠 Activado (naranja) - **MUY IMPORTANTE**
3. **Guardar** y esperar 1-5 minutos
4. **El servidor Node.js ya detecta automáticamente el subdominio**

## 🔐 Seguridad

**IMPORTANTE:** Este panel permite editar datos directamente en la base de datos. Considera:

1. **Agregar autenticación básica en Nginx:**

```bash
sudo apt-get install apache2-utils
sudo htpasswd -c /etc/nginx/.htpasswd admin
```

Luego agregar en la configuración de Nginx:

```nginx
auth_basic "Panel SQL - Acceso Restringido";
auth_basic_user_file /etc/nginx/.htpasswd;
```

2. **O implementar autenticación en el código** (puede agregarse más adelante)

## 📊 Tablas Disponibles

El panel muestra las siguientes tablas:

- **`students`** - Estudiantes del sistema
- **`kajabi_contacts`** - Contactos de Kajabi
- **`kajabi_offers`** - Ofertas/Suscripciones de Kajabi
- **`kajabi_purchases`** - Compras de Kajabi
- **`sync_log`** - Log de sincronizaciones
- **`sync_log_kajabi`** - Log de sincronizaciones de Kajabi
- **`practices`** - Prácticas de estudiantes

## 🎯 Funcionalidades del Panel

### Ver Datos
- Selecciona una tabla haciendo clic en su tarjeta
- Los datos se muestran en una tabla paginada (50 registros por página)
- Puedes navegar entre páginas

### Buscar
- Usa el cuadro de búsqueda para filtrar registros
- La búsqueda se realiza en todas las columnas de texto
- Presiona Enter o clic en "Buscar"

### Editar Registros
1. Haz clic en el botón "Editar" de cualquier registro
2. Se abrirá un modal con todos los campos editables
3. Los campos booleanos (tiene_mundo_de_luz, suscripcion_pausada, etc.) se muestran como dropdowns
4. Haz clic en "Guardar" para aplicar los cambios

### Campos Protegidos
Los siguientes campos NO se pueden editar (por seguridad):
- `id` (clave primaria)
- `kajabi_id` (ID de Kajabi)
- Campos con `_local` en el nombre
- `created_at` (fecha de creación)

## 🧪 Pruebas

1. **Verificar que el servidor está corriendo:**
```bash
curl http://localhost:3000/api/tables
```

2. **Probar desde el navegador:**
```
http://sqlpdeaurelin.eugenihidalgo.work
```

3. **Verificar detección del subdominio:**
El router detecta automáticamente el subdominio `sqlpdeaurelin.eugenihidalgo.work` y enruta al panel SQL.

## 🔍 Troubleshooting

### El subdominio no carga
1. Verifica que el servidor Node.js esté corriendo en el puerto 3000
2. Verifica la configuración de Nginx: `sudo nginx -t`
3. Verifica los logs de Nginx: `sudo tail -f /var/log/nginx/error.log`

### No se muestran las tablas
1. Verifica que la base de datos existe: `ls -la database/aurelinportal.db`
2. Verifica los logs del servidor Node.js
3. Abre la consola del navegador (F12) para ver errores

### No puedo editar registros
1. Verifica que los campos no estén protegidos (ver sección "Campos Protegidos")
2. Verifica los logs del servidor para errores SQL
3. Asegúrate de que la base de datos tenga permisos de escritura

## 📝 Notas

- El panel está optimizado para pantallas grandes, pero es responsive
- Los datos se cargan de forma paginada para mejor rendimiento
- Las búsquedas son case-insensitive y buscan en todas las columnas de texto
- Los cambios se guardan inmediatamente en la base de datos

## 🔄 Actualizaciones Futuras

Posibles mejoras:
- [ ] Autenticación de usuarios
- [ ] Exportar datos a CSV/Excel
- [ ] Historial de cambios
- [ ] Filtros avanzados por columna
- [ ] Vista de relaciones entre tablas

---

*Documento creado: $(date)*
*Versión: AuriPortal v3.1*

