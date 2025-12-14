# 🚀 Configurar Cursor con Remote SSH (usando Tailscale)

## 📋 Requisitos Previos

Ya tienes:
- ✅ Tailscale instalado y configurado en tu PC
- ✅ Conexión SSH funcionando al servidor remoto por Tailscale
- ✅ Cursor instalado en tu PC

Solo necesitas:
- ✅ Instalar extensión "Remote - SSH" en Cursor
- ✅ Configurar Cursor para usar tu conexión SSH existente

## 🔧 Paso 1: Instalar Extensión Remote SSH en Cursor

1. Abre Cursor
2. Ve a **Extensions** (Ctrl+Shift+X o Cmd+Shift+X)
3. Busca: **"Remote - SSH"** (de Microsoft)
4. Haz clic en **Install**

## 🔍 Paso 2: Verificar tu Configuración SSH Actual

Como ya puedes conectarte por SSH, probablemente ya tienes una configuración. Vamos a verificar cómo te conectas:

### Método Rápido: Usar el Script de Verificación

**En tu PC local**, descarga y ejecuta el script de verificación:

```bash
# Desde tu PC local, descarga el script del servidor
scp usuario@servidor:/var/www/aurelinportal/verificar-ssh-para-cursor.sh ~/

# O copia el contenido y créalo manualmente
# Luego ejecútalo:
chmod +x ~/verificar-ssh-para-cursor.sh
~/verificar-ssh-para-cursor.sh
```

El script te mostrará:
- ✅ Tu configuración SSH actual
- ✅ Estado de Tailscale
- ✅ Máquinas disponibles en tu red
- ✅ Claves SSH configuradas

### Método Manual: Verificar Manualmente

**En tu PC local**, ejecuta estos comandos:

#### Opción A: Si usas un alias o nombre en SSH

```bash
# Ver tu archivo de configuración SSH
cat ~/.ssh/config
```

Busca entradas que tengan `Host` con el nombre que usas para conectarte (ej: `ssh servidor-amigo` o `ssh mi-servidor`).

#### Opción B: Si te conectas directamente

Si te conectas con algo como:
```bash
ssh usuario@nombre-tailscale
# o
ssh usuario@100.x.x.x
```

**Anota exactamente cómo te conectas**, porque usaremos la misma información en Cursor.

#### Verificar Tailscale

```bash
# Ver todas las máquinas en tu red Tailscale
tailscale status

# Ver tu IP de Tailscale
tailscale ip
```

## 🔑 Paso 3: Configurar Cursor con tu Conexión SSH Existente

### Opción A: Usar tu Configuración SSH Existente (Más Fácil)

Si ya tienes un `Host` configurado en `~/.ssh/config`, Cursor lo detectará automáticamente:

1. En Cursor, presiona **F1** (o Ctrl+Shift+P / Cmd+Shift+P)
2. Escribe: **"Remote-SSH: Connect to Host"**
3. Selecciona la opción
4. **Verás una lista con todos tus hosts SSH configurados**
5. Selecciona el que usas para conectarte al servidor remoto
6. ¡Listo! Cursor se conectará usando tu configuración existente

### Opción B: Agregar Nueva Conexión Directamente en Cursor

Si prefieres agregar una nueva entrada o no tienes `~/.ssh/config`:

1. En Cursor, presiona **F1** (o Ctrl+Shift+P / Cmd+Shift+P)
2. Escribe: **"Remote-SSH: Connect to Host"**
3. Selecciona la opción
4. Elige **"Add New SSH Host"**
5. Ingresa **exactamente** como te conectas normalmente:
   
   **Si usas nombre de máquina Tailscale:**
   ```
   usuario@nombre-maquina-tailscale
   ```
   Ejemplo: `root@servidor-amigo` o `usuario@mi-servidor`
   
   **Si usas IP de Tailscale:**
   ```
   usuario@100.x.x.x
   ```
   Ejemplo: `root@100.64.1.5`
   
6. Selecciona el archivo de configuración SSH (normalmente `~/.ssh/config`)
7. Cursor se conectará usando la misma conexión que ya funciona

### Opción C: Editar Manualmente ~/.ssh/config (Opcional)

Si quieres agregar o mejorar tu configuración SSH manualmente:

1. Abre tu archivo de configuración SSH:
   ```bash
   nano ~/.ssh/config
   ```
   
   O en Windows:
   ```
   C:\Users\TuUsuario\.ssh\config
   ```

2. Agrega o verifica una entrada para tu servidor remoto:
   
   **Ejemplo usando nombre de máquina Tailscale (Recomendado):**
   ```
   Host servidor-amigo
       HostName nombre-maquina-tailscale
       User tu-usuario
       Port 22
       IdentityFile ~/.ssh/id_rsa
       ServerAliveInterval 60
       ServerAliveCountMax 3
   ```
   
   **Ejemplo usando IP de Tailscale:**
   ```
   Host servidor-amigo
       HostName 100.64.1.5
       User tu-usuario
       Port 22
       IdentityFile ~/.ssh/id_rsa
       ServerAliveInterval 60
       ServerAliveCountMax 3
   ```
   
   **💡 Tip:** Usa el mismo `HostName` y `User` que ya usas cuando te conectas por SSH normalmente.

3. Guarda el archivo

4. Prueba que funciona:
   ```bash
   ssh servidor-amigo
   ```

## 🔌 Paso 4: Conectar desde Cursor

### Método 1: Desde la Paleta de Comandos

1. Presiona **F1** (o Ctrl+Shift+P)
2. Escribe: **"Remote-SSH: Connect to Host"**
3. Selecciona tu servidor de la lista (aparecerá como "servidor-amigo" si usaste la configuración manual)

### Método 2: Desde la Barra de Estado

1. Mira la esquina inferior izquierda de Cursor
2. Verás un ícono verde `><` o el texto "Open Remote Window"
3. Haz clic y selecciona **"Connect to Host"**
4. Elige tu servidor

### Método 3: Desde el Explorador Remoto

1. Presiona **F1**
2. Escribe: **"Remote-SSH: Open SSH Configuration File"**
3. Selecciona el archivo de configuración
4. Guarda y luego conecta usando el método 1 o 2

## 📁 Paso 5: Abrir Carpeta en el Servidor Remoto

Una vez conectado:

1. Cursor te pedirá que abras una carpeta
2. Navega a la carpeta del proyecto (ejemplo: `/var/www/aurelinportal`)
3. Haz clic en **"OK"** o **"Open Folder"**

**¡Listo!** Ahora estás trabajando directamente en el servidor remoto.

## ⚙️ Paso 6: Configurar para Trabajar Siempre en el Servidor

### Opción 1: Guardar Workspace Remoto

1. Una vez conectado y con la carpeta abierta
2. Ve a **File > Save Workspace As...**
3. Guarda el archivo `.code-workspace` en tu máquina local
4. La próxima vez, abre este archivo y Cursor se conectará automáticamente

### Opción 2: Configuración de Inicio Automático

1. Crea un script de inicio rápido en tu máquina local:

   **Linux/Mac:**
   ```bash
   # Crear script: ~/conectar-servidor-amigo.sh
   #!/bin/bash
   cursor --remote ssh-remote+servidor-amigo /var/www/aurelinportal
   ```

   **Windows (PowerShell):**
   ```powershell
   # Crear script: conectar-servidor-amigo.ps1
   cursor --remote ssh-remote+servidor-amigo /var/www/aurelinportal
   ```

2. Haz el script ejecutable (Linux/Mac):
   ```bash
   chmod +x ~/conectar-servidor-amigo.sh
   ```

3. Ejecuta el script para conectarte rápidamente

### Opción 3: Atajo de Teclado Personalizado

1. En Cursor, ve a **File > Preferences > Keyboard Shortcuts**
2. Busca: **"Remote-SSH: Connect to Host"**
3. Asigna un atajo personalizado (ej: Ctrl+Alt+S)
4. Úsalo para conectarte rápidamente

## 🔐 Paso 7: Autenticación (Ya Configurada)

Como ya puedes conectarte por SSH, tu autenticación ya está configurada. Cursor usará la misma configuración:

- ✅ Si usas claves SSH, Cursor las usará automáticamente
- ✅ Si usas contraseña, Cursor te la pedirá la primera vez (y puede guardarla)
- ✅ Si usas agente SSH, Cursor lo usará automáticamente

## 📝 Configuración Avanzada SSH (Opcional)

Si quieres mejorar tu configuración SSH existente, puedes agregar estas opciones a `~/.ssh/config`:

```
Host servidor-amigo
    HostName nombre-maquina-tailscale  # o IP de Tailscale
    User tu-usuario
    Port 22
    IdentityFile ~/.ssh/id_rsa
    ServerAliveInterval 60
    ServerAliveCountMax 3
    ForwardAgent yes
    Compression yes
```

**Explicación:**
- `ServerAliveInterval`: Mantiene la conexión viva enviando señales cada 60 segundos (útil para evitar desconexiones)
- `ServerAliveCountMax`: Número de intentos antes de desconectar
- `ForwardAgent`: Permite usar tus claves SSH locales en el servidor remoto
- `Compression`: Comprime los datos para conexiones más rápidas (útil en conexiones lentas)

## 🎯 Verificar Conexión

Para verificar que todo funciona:

1. Conéctate desde Cursor
2. Abre una terminal en Cursor (Ctrl+` o View > Terminal)
3. Verifica que estás en el servidor remoto:
   ```bash
   hostname
   pwd
   whoami
   ```

Deberías ver el nombre del servidor remoto, no tu máquina local.

## 🐛 Solución de Problemas

### Error: "Could not establish connection"

**Solución:**
- Verifica que Tailscale esté corriendo: `tailscale status`
- Prueba conectarte por SSH desde terminal: `ssh servidor-amigo` (o como te conectas normalmente)
- Si funciona en terminal pero no en Cursor, verifica que uses el mismo `Host` en la configuración

### Error: "Permission denied"

**Solución:**
- Verifica usuario y contraseña
- Si usas clave SSH, verifica permisos:
  ```bash
  chmod 600 ~/.ssh/id_rsa
  chmod 644 ~/.ssh/id_rsa.pub
  ```

### La conexión se cae frecuentemente

**Solución:**
Agrega a tu `~/.ssh/config`:
```
ServerAliveInterval 60
ServerAliveCountMax 3
```

### Extensiones no funcionan en remoto

**Solución:**
- Algunas extensiones necesitan instalarse en el servidor remoto
- Cursor te pedirá instalarlas automáticamente
- Acepta la instalación cuando se solicite

## 📌 Resumen Rápido

1. ✅ Instalar extensión "Remote - SSH" en Cursor
2. ✅ Conectar desde Cursor (F1 > "Remote-SSH: Connect to Host")
3. ✅ Seleccionar tu servidor de la lista (o agregarlo si no está)
4. ✅ Abrir carpeta del proyecto en el servidor (ej: `/var/www/aurelinportal`)
5. ✅ Guardar workspace para acceso rápido

**💡 Como ya tienes SSH funcionando, solo necesitas los pasos 1, 2, 3 y 4.**

## 🎉 ¡Listo!

Ahora puedes trabajar directamente en el servidor remoto desde Cursor, igual que si estuvieras trabajando localmente. Todos los cambios se guardan directamente en el servidor.

---

**Nota:** Asegúrate de tener una conexión estable a internet, ya que Cursor necesita estar conectado al servidor para funcionar.

