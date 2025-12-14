# ⚡ Guía Rápida: Conectar Cursor con Servidor Remoto (Tailscale)

## 🎯 Pasos Rápidos (5 minutos)

### 1. Instalar Extensión en Cursor
- Abre Cursor
- Ctrl+Shift+X (o Cmd+Shift+X en Mac)
- Busca: **"Remote - SSH"** (Microsoft)
- Click en **Install**

### 2. Conectar al Servidor

**Opción A: Si ya tienes `~/.ssh/config` configurado**
1. F1 → "Remote-SSH: Connect to Host"
2. Selecciona tu servidor de la lista
3. ¡Listo!

**Opción B: Si NO tienes `~/.ssh/config`**
1. F1 → "Remote-SSH: Connect to Host"
2. "Add New SSH Host"
3. Ingresa **exactamente** como te conectas normalmente:
   - `usuario@nombre-tailscale` 
   - o `usuario@100.x.x.x`
4. Selecciona `~/.ssh/config`
5. Selecciona tu servidor de la lista

### 3. Abrir Carpeta del Proyecto
- Cursor te pedirá abrir una carpeta
- Navega a: `/var/www/aurelinportal`
- Click en **OK**

### 4. Guardar Workspace (Opcional)
- File → Save Workspace As...
- Guarda en tu PC local
- La próxima vez, abre este archivo y se conectará automáticamente

## ✅ Verificar que Funciona

1. Abre una terminal en Cursor (Ctrl+` o View → Terminal)
2. Ejecuta:
   ```bash
   hostname
   pwd
   ```
3. Deberías ver el nombre del servidor remoto, no tu PC local

## 🐛 Problemas Comunes

**"Could not establish connection"**
- Verifica Tailscale: `tailscale status`
- Prueba SSH desde terminal: `ssh tu-servidor`
- Si funciona en terminal, usa el mismo formato en Cursor

**No aparece mi servidor en la lista**
- Usa "Add New SSH Host" y agrega exactamente como te conectas normalmente
- Verifica que `~/.ssh/config` tenga permisos correctos: `chmod 600 ~/.ssh/config`

**Pide contraseña cada vez**
- Configura autenticación por clave SSH (si no la tienes)
- O usa el agente SSH: `eval "$(ssh-agent -s)" && ssh-add ~/.ssh/id_rsa`

## 📝 Ejemplo de Configuración SSH

Si quieres crear/editar `~/.ssh/config` manualmente:

```bash
nano ~/.ssh/config
```

Agrega:
```
Host servidor-amigo
    HostName nombre-maquina-tailscale
    User tu-usuario
    Port 22
    ServerAliveInterval 60
    ServerAliveCountMax 3
```

Reemplaza:
- `servidor-amigo` → El nombre que quieras usar
- `nombre-maquina-tailscale` → El nombre o IP de Tailscale del servidor
- `tu-usuario` → Tu usuario SSH

---

**💡 Tip:** Si ya puedes conectarte por SSH desde terminal, Cursor usará la misma configuración. Solo necesitas seleccionar tu servidor de la lista.





