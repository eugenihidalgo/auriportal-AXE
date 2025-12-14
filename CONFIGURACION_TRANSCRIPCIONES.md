# 🎵 Configuración de Transcripciones Automáticas de Audio

## 📋 Descripción

Este sistema monitorea automáticamente la carpeta en Google Drive con ID: **`1KA1auw4OMZsDOEQD8U_pqH6UNZdwBxko`**. Cuando se sube un archivo de audio, el sistema:

1. **Descarga** el archivo de Google Drive
2. **Sube** el archivo al servidor SSH "dani" (que tiene Whisper instalado)
3. **Transcribe** el audio usando Whisper
4. **Descarga** la transcripción del servidor remoto
5. **Guarda** la transcripción en una subcarpeta "transcripciones" dentro de "CANALIZACIONES MÍRIAM" en Google Drive

---

## 🔧 Configuración

### 1. Variables de Entorno

Agrega estas variables al archivo `.env`:

```env
# ============================================
# SSH Servidor "dani" (Whisper) - Usa Tailscale
# ============================================
SSH_DANI_TAILSCALE_HOST=DESKTOP-ON51NHF  # Hostname de Tailscale (recomendado)
# SSH_DANI_HOST=80.35.231.81  # IP pública (solo si no usas Tailscale)
SSH_DANI_PORT=22
SSH_DANI_USER=usuari
SSH_DANI_KEY_PATH=/path/to/private/key  # Opcional, si usas autenticación por clave
SSH_DANI_INPUT_PATH=/mnt/c/ServidorProyectos/Eugeni/audio
SSH_DANI_OUTPUT_PATH=/mnt/c/ServidorProyectos/Eugeni/transcripciones
SSH_DANI_PROYECTO_PATH=/mnt/c/ServidorProyectos/Eugeni
SSH_DANI_ENTORNO_VIRTUAL=whisper_env_linux
SSH_DANI_MODELO_WHISPER=large
SSH_DANI_IDIOMA=es
SSH_DANI_FORMATO=txt

# ============================================
# Google Drive - Transcripciones
# ============================================
GOOGLE_DRIVE_CANALIZACIONES_FOLDER_ID=1HL5gG6eq0mLqifr8eqdiR_GmnHPdmECP  # ID de la carpeta (recomendado)
GOOGLE_DRIVE_CANALIZACIONES_FOLDER=CANALIZACIONES MÍRIAM  # Nombre de la carpeta (fallback si no hay ID)
DRIVE_MONITOR_INTERVAL=5  # Minutos entre cada verificación (respaldo si webhook falla)
DRIVE_WEBHOOK_AUTO_SETUP=true  # Configurar webhook automáticamente al iniciar
WEBHOOK_BASE_URL=https://controlauriportal.eugenihidalgo.work  # URL base para webhooks
SERVER_URL=https://controlauriportal.eugenihidalgo.work  # URL del servidor (alternativa)

# ============================================
# Admin
# ============================================
ADMIN_PASSWORD=kaketes7897  # Password para endpoint manual
```

### 2. Configuración SSH

#### Opción A: Autenticación por Clave (Recomendado)

1. **Generar clave SSH** (si no existe):
```bash
ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa_dani -N "" -C "clave-para-dani-$(date +%Y%m%d)"
chmod 600 ~/.ssh/id_rsa_dani
chmod 644 ~/.ssh/id_rsa_dani.pub
```

2. **Copiar clave pública al servidor dani**:
```bash
ssh-copy-id -i ~/.ssh/id_rsa_dani.pub usuari@80.35.231.81
```

3. **Configurar en `.env`**:
```env
SSH_DANI_KEY_PATH=/root/.ssh/id_rsa_dani
```

#### Opción B: Autenticación por Contraseña

Si prefieres usar contraseña, simplemente no configures `SSH_DANI_KEY_PATH` y el sistema pedirá la contraseña (aunque esto no funcionará en modo automático sin interacción).

### 3. Verificar Conexión SSH

Puedes probar la conexión SSH ejecutando:

```bash
ssh -i /root/.ssh/id_rsa_dani usuari@80.35.231.81 "echo 'Conexión exitosa' && hostname"
```

---

## 🚀 Uso

### Procesamiento Automático

El sistema tiene **dos métodos** de sincronización:

#### 1. Webhooks (Tiempo Real) ⚡ **RECOMENDADO**

El sistema intenta configurar automáticamente un webhook de Google Drive al iniciar. Esto permite recibir notificaciones **en tiempo real** cuando se suben archivos.

**Ventajas:**
- ✅ Notificaciones instantáneas (sin esperar 5 minutos)
- ✅ Más eficiente (no hace polling constante)
- ✅ Menor uso de recursos

**Configuración automática:**
El webhook se configura automáticamente al iniciar el servidor. Si necesitas configurarlo manualmente:

```
https://tu-dominio.com/configurar-drive-webhook?password=kaketes7897
```

**Nota importante:** Los webhooks de Google Drive expiran después de **7 días**. El sistema intentará renovarlos automáticamente, pero puedes renovarlos manualmente accediendo al endpoint de configuración.

#### 2. Polling (Respaldo) 🔄

Si el webhook no está configurado o falla, el sistema usa polling cada **5 minutos** (configurable con `DRIVE_MONITOR_INTERVAL`) como respaldo.

El scheduler se inicia automáticamente cuando el servidor arranca.

### Procesamiento Manual

Puedes procesar archivos manualmente accediendo a:

```
https://tu-dominio.com/transcription-process?password=kaketes7897
```

O usando curl:

```bash
curl "https://tu-dominio.com/transcription-process?password=kaketes7897"
```

---

## 📁 Estructura de Carpetas

### En Google Drive:

```
CANALIZACIONES MÍRIAM/
├── audio1.mp3          # Archivo original
├── audio2.wav           # Archivo original
└── transcripciones/     # Subcarpeta creada automáticamente
    ├── transcripcion_audio1_2024-12-20.txt
    └── transcripcion_audio2_2024-12-20.txt
```

### En el Servidor Local (temporal):

```
/tmp/aurelinportal-transcripciones/
├── archivos-procesados.json  # Tracking de archivos ya procesados
└── [archivos temporales durante procesamiento]
```

---

## 🎯 Formatos de Audio Soportados

El sistema detecta automáticamente archivos de audio con estas extensiones:

- `.mp3`, `.m4a`, `.wav`, `.ogg`, `.flac`
- `.webm`, `.aac`, `.3gp`, `.wma`, `.m4b`

Y estos MIME types:

- `audio/mpeg`, `audio/mp3`, `audio/mp4`, `audio/m4a`
- `audio/wav`, `audio/ogg`, `audio/flac`
- `audio/webm`, `audio/aac`, etc.

---

## 📊 Monitoreo y Logs

### Ver logs en tiempo real:

```bash
pm2 logs aurelinportal
```

### Ver logs específicos de transcripciones:

```bash
pm2 logs aurelinportal | grep "Transcripción"
```

### Verificar estado del scheduler:

El scheduler se inicia automáticamente. Verás en los logs:

```
⏰ Inicializando tareas programadas...
✅ Tarea programada configurada: Sincronización diaria ClickUp → SQL a las 3:00 AM
✅ Tarea programada configurada: Procesamiento de transcripciones cada 5 minutos
```

---

## 🔍 Troubleshooting

### Error: "No se puede conectar al servidor SSH"

**Solución:**
1. Verifica que la IP `80.35.231.81` sea accesible desde tu servidor
2. Verifica que el puerto 22 esté abierto
3. Verifica que la clave SSH tenga permisos correctos: `chmod 600 ~/.ssh/id_rsa_dani`
4. Prueba la conexión manualmente: `ssh -i /path/to/key usuari@80.35.231.81`

### Error: "No se encuentra la carpeta CANALIZACIONES MÍRIAM"

**Solución:**
1. Verifica que la carpeta existe en Google Drive
2. Verifica que el Service Account tenga permisos en la carpeta
3. El sistema creará la carpeta automáticamente si no existe

### Error: "Whisper no está instalado"

**Solución:**
1. Verifica que Whisper esté instalado en el servidor "dani"
2. Verifica que el entorno virtual `whisper_env_linux` exista
3. Verifica que el script `traducir_audio.py` esté en la ruta correcta

### Los archivos no se procesan automáticamente

**Solución:**
1. Verifica que el scheduler esté corriendo: `pm2 status`
2. Verifica los logs: `pm2 logs aurelinportal`
3. Prueba el procesamiento manual: `/transcription-process?password=...`
4. Verifica que `DRIVE_MONITOR_INTERVAL` esté configurado

### Las transcripciones no aparecen en Google Drive

**Solución:**
1. Verifica que el Service Account tenga permisos de escritura
2. Verifica los logs para ver si hay errores
3. Verifica que la subcarpeta "transcripciones" se haya creado

---

## ⚙️ Configuración Avanzada

### Cambiar intervalo de monitoreo

Edita `.env`:

```env
DRIVE_MONITOR_INTERVAL=10  # Cada 10 minutos
```

### Cambiar modelo de Whisper

Edita `.env`:

```env
SSH_DANI_MODELO_WHISPER=medium  # Más rápido, menos preciso
# o
SSH_DANI_MODELO_WHISPER=large   # Más lento, más preciso (recomendado)
```

### Cambiar idioma de transcripción

Edita `.env`:

```env
SSH_DANI_IDIOMA=es   # Español
SSH_DANI_IDIOMA=ca   # Catalán
SSH_DANI_IDIOMA=en   # Inglés
# O dejar vacío para auto-detección
```

### Cambiar formato de salida

Edita `.env`:

```env
SSH_DANI_FORMATO=txt   # Texto plano (recomendado)
SSH_DANI_FORMATO=srt   # Subtítulos
SSH_DANI_FORMATO=json  # JSON completo
```

---

## 📝 Notas Importantes

1. **Webhooks vs Polling**: 
   - **Webhooks** (recomendado): Notificaciones en tiempo real cuando se suben archivos. Se configuran automáticamente al iniciar.
   - **Polling**: Respaldo cada 5 minutos si el webhook falla o no está configurado.

2. **Renovación de Webhooks**: Los webhooks de Google Drive expiran después de 7 días. El sistema intenta renovarlos automáticamente, pero puedes renovarlos manualmente accediendo a `/configurar-drive-webhook?password=...`

3. **Archivos procesados**: El sistema mantiene un registro de archivos ya procesados para evitar duplicados. Este registro se guarda en `/tmp/aurelinportal-transcripciones/archivos-procesados.json`

4. **Limpieza automática**: Los archivos temporales se eliminan automáticamente después de procesarse

5. **Tiempo de procesamiento**: Depende del tamaño del audio y del modelo de Whisper. Un archivo de 10 minutos puede tardar 2-5 minutos con el modelo `large`

6. **Permisos**: Asegúrate de que el usuario del servidor tenga permisos para:
   - Leer/escribir en `/tmp`
   - Conectarse por SSH al servidor "dani"
   - Acceder a Google Drive API

7. **URL del Webhook**: Debe ser accesible públicamente por HTTPS. Google Drive necesita poder hacer POST a tu servidor.

---

## 🎉 ¡Listo!

Una vez configurado, el sistema funcionará automáticamente. Solo sube archivos de audio a la carpeta "CANALIZACIONES MÍRIAM" en Google Drive y las transcripciones aparecerán en la subcarpeta "transcripciones".

**Última actualización:** Diciembre 2024

