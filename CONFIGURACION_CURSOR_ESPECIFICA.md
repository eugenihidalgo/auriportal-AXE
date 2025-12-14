# 🔧 Configuración Específica para Cursor - Servidor Remoto

## 📋 Información del Servidor

- **Hostname**: `Aurelinportal`
- **Usuario SSH**: `root`
- **IP Pública**: `88.99.173.249`
- **Contraseña SSH**: `onaelsacris`

## 🔑 Configuración SSH para Cursor

### Paso 1: En tu PC Local

Abre tu terminal y crea/edita el archivo `~/.ssh/config`:

```bash
nano ~/.ssh/config
```

### Paso 2: Agregar Configuración

Agrega esta configuración (ajusta según cómo te conectes por Tailscale):

**Opción A: Si usas nombre de máquina Tailscale**
```
Host servidor-amigo
    HostName nombre-maquina-tailscale
    User root
    Port 22
    ServerAliveInterval 60
    ServerAliveCountMax 3
```

**Opción B: Si usas IP de Tailscale (100.x.x.x)**
```
Host servidor-amigo
    HostName 100.x.x.x
    User root
    Port 22
    ServerAliveInterval 60
    ServerAliveCountMax 3
```

**Opción C: Si usas la IP pública directamente**
```
Host servidor-amigo
    HostName 88.99.173.249
    User root
    Port 22
    ServerAliveInterval 60
    ServerAliveCountMax 3
```

### Paso 3: Guardar y Probar

```bash
# Guardar el archivo (Ctrl+X, Y, Enter en nano)
# Probar la conexión
ssh servidor-amigo
# Ingresa la contraseña: onaelsacris
```

### Paso 4: Configurar Cursor

1. Abre Cursor
2. Presiona **F1** (o Ctrl+Shift+P)
3. Escribe: **"Remote-SSH: Connect to Host"**
4. Selecciona **"servidor-amigo"** de la lista
5. Ingresa la contraseña cuando se solicite: `onaelsacris`
6. Abre la carpeta: `/var/www/aurelinportal`

## 🔐 Configurar Autenticación por Clave SSH (Opcional pero Recomendado)

Para no tener que escribir la contraseña cada vez:

### En tu PC Local:

```bash
# 1. Generar clave SSH (si no tienes una)
ssh-keygen -t rsa -b 4096 -C "tu-email@ejemplo.com"
# Presiona Enter para usar la ubicación por defecto
# Opcional: agrega una frase de contraseña

# 2. Copiar la clave al servidor
# Si usas Tailscale:
ssh-copy-id root@nombre-maquina-tailscale
# O si usas IP pública:
ssh-copy-id root@88.99.173.249

# Cuando pida la contraseña, ingresa: onaelsacris

# 3. Probar conexión sin contraseña
ssh servidor-amigo
# Ahora deberías conectarte sin contraseña
```

## ✅ Verificar Configuración

### En tu PC Local:

```bash
# Ver tu configuración SSH
cat ~/.ssh/config

# Verificar Tailscale
tailscale status

# Probar conexión SSH
ssh servidor-amigo
```

### En Cursor:

1. Conéctate al servidor
2. Abre terminal (Ctrl+`)
3. Ejecuta:
   ```bash
   hostname    # Debería mostrar: Aurelinportal
   pwd         # Debería mostrar: /root o /var/www/aurelinportal
   whoami      # Debería mostrar: root
   ```

## 🎯 Resumen Rápido

1. ✅ Edita `~/.ssh/config` en tu PC local
2. ✅ Agrega la configuración del servidor (usando Tailscale o IP)
3. ✅ Prueba: `ssh servidor-amigo`
4. ✅ En Cursor: F1 → "Remote-SSH: Connect to Host" → Selecciona "servidor-amigo"
5. ✅ Abre carpeta: `/var/www/aurelinportal`

## 💡 Nota Importante

- **Si usas Tailscale**: Usa el nombre de máquina o IP de Tailscale (100.x.x.x) en `HostName`
- **Si no usas Tailscale**: Usa la IP pública `88.99.173.249`
- **Contraseña**: `onaelsacris` (considera configurar autenticación por clave para mayor seguridad)

---

**¿Cómo te conectas normalmente?** 
- `ssh root@nombre-tailscale` 
- `ssh root@100.x.x.x`
- `ssh root@88.99.173.249`

Usa el mismo formato en la configuración de Cursor.





