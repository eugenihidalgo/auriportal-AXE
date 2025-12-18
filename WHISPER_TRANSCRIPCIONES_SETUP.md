# 🎤 Sistema de Transcripciones Whisper - Configuración Completa

## 📋 Resumen

Sistema completo para transcribir automáticamente archivos de audio desde Google Drive usando Whisper (Large/Medium según recursos) con portal de administración en modo oscuro.

---

## ✅ Funcionalidades Implementadas

### 1. **Procesamiento Automático**
- ✅ Transcribe archivos de audio desde carpeta específica de Google Drive
- ✅ Guarda transcripciones en carpeta de transcripciones
- ✅ Mueve archivos procesados a carpeta de procesados
- ✅ Ejecución automática a las 2:00 AM
- ✅ Selección inteligente de modelo (Large/Medium según recursos)

### 2. **Portal de Administración**
- ✅ Modo oscuro suave y amable para los ojos
- ✅ Control de pausar/activar transcripciones
- ✅ Procesamiento manual
- ✅ Historial completo de transcripciones
- ✅ Estadísticas en tiempo real
- ✅ Configuración automática de DNS

### 3. **Sistema Inteligente**
- ✅ Selección automática Large/Medium según RAM disponible
- ✅ 1 transcripción → Large (si hay recursos)
- ✅ 2+ transcripciones → Medium
- ✅ Procesamiento nocturno con Large para audios largos

---

## 🔧 Configuración

### 1. **Crear Tablas en PostgreSQL**

Ejecutar manualmente en PostgreSQL:

```sql
-- Conectar a la base de datos
\c aurelinportal

-- Ejecutar el schema
\i database/schema-whisper-transcripciones.sql
```

O desde Node.js (cuando el servidor esté corriendo):

```bash
# Las tablas se crearán automáticamente al iniciar el servidor
# O ejecutar manualmente:
node scripts/init-whisper-tables.js
```

### 2. **Configurar Variables de Entorno**

Agregar a `.env`:

```env
# IDs de carpetas de Google Drive
WHISPER_CARPETA_AUDIOS_ID=1Htd8X-F-WhBayF7jbepq277grzialj9Z
WHISPER_CARPETA_TRANSCRIPCIONES_ID=1tTrjJjz87tDSpQG45XcveUxAAXer12Fu
WHISPER_CARPETA_PROCESADOS_ID=12Rxs9bpJG93bhYVdP-tuWahAtyDhPdNE

# IP del servidor (para DNS)
SERVER_IP=88.99.173.249
```

### 3. **Configurar DNS en Cloudflare**

El portal puede configurar el DNS automáticamente, o hacerlo manualmente:

1. Ve a [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Selecciona dominio: `eugenihidalgo.work`
3. Ve a **DNS** → **Records**
4. Click en **"+ Add record"**
5. Configura:
   - **Type:** `A`
   - **Name:** `whispertranscripciones`
   - **IPv4 address:** `88.99.173.249` (o la IP de tu servidor)
   - **Proxy status:** 🟠 Proxied (recomendado)
   - **TTL:** Auto
6. Click en **Save**

### 4. **Configurar Nginx (si usas Nginx)**

Crear archivo `/etc/nginx/sites-available/whispertranscripciones`:

```nginx
server {
    listen 80;
    server_name whispertranscripciones.eugenihidalgo.work;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Activar:

```bash
sudo ln -s /etc/nginx/sites-available/whispertranscripciones /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 🎨 Portal de Administración

### Acceso

**URL:** `https://whispertranscripciones.eugenihidalgo.work`

### Características

- **Modo Oscuro Suave**: Colores amables para los ojos
  - Fondo: Gradiente oscuro (#1a1a2e → #16213e)
  - Texto: Gris claro (#e0e0e0)
  - Acentos: Azul suave (#64b5f6)
  - Éxito: Verde suave (#81c784)
  - Advertencia: Naranja suave (#ffb74d)

- **Funcionalidades**:
  - ▶️ Activar/Pausar transcripciones
  - 🚀 Procesar manualmente
  - 📊 Ver estadísticas
  - 📜 Historial completo
  - 🌐 Configurar DNS automáticamente

---

## 📊 Flujo de Procesamiento

### Automático (2:00 AM)

1. **Tarea programada se ejecuta** a las 2:00 AM
2. **Verifica estado**: Si está pausado, no procesa
3. **Lista archivos** en carpeta de audios
4. **Filtra archivos nuevos** (no procesados)
5. **Para cada archivo**:
   - Descarga de Google Drive
   - Sube al servidor SSH
   - Selecciona modelo (Large/Medium)
   - Transcribe con Whisper
   - Descarga transcripción
   - Sube transcripción a Google Drive
   - Mueve archivo original a procesados
   - Registra en historial

### Manual (desde portal)

1. Click en **"🚀 Procesar Ahora"**
2. Mismo flujo que automático
3. Resultado mostrado en tiempo real

---

## 🔍 Estructura de Carpetas Google Drive

```
📁 Carpeta Audios (1Htd8X-F-WhBayF7jbepq277grzialj9Z)
   ├── audio1.mp3
   ├── audio2.wav
   └── ...

📁 Carpeta Transcripciones (1tTrjJjz87tDSpQG45XcveUxAAXer12Fu)
   ├── transcripcion_audio1.txt
   ├── transcripcion_audio2.txt
   └── ...

📁 Carpeta Procesados (12Rxs9bpJG93bhYVdP-tuWahAtyDhPdNE)
   ├── audio1.mp3 (movido después de transcribir)
   ├── audio2.wav
   └── ...
```

---

## 📝 Historial de Transcripciones

El sistema guarda en la tabla `whisper_transcripciones`:

- Archivo procesado
- Modelo usado (Large/Medium)
- Estado (pendiente, procesando, completado, error, pausado)
- Tamaño del archivo
- Duración del procesamiento
- Fecha de inicio/fin
- ID de transcripción en Google Drive
- Mensajes de error (si hay)

---

## 🎯 Control de Transcripciones

### Pausar/Activar

- **Pausar**: Las transcripciones automáticas se detienen
- **Activar**: Las transcripciones automáticas se reanudan
- El estado se guarda en la tabla `whisper_control`

### Procesamiento Manual

- Click en **"🚀 Procesar Ahora"**
- Procesa todos los archivos pendientes
- Respeta el estado de pausa/activación

---

## 🔧 Troubleshooting

### Las tablas no se crean

```bash
# Verificar conexión PostgreSQL
psql -U postgres -d aurelinportal -c "SELECT 1;"

# Crear tablas manualmente
psql -U postgres -d aurelinportal -f database/schema-whisper-transcripciones.sql
```

### El portal no carga

1. Verificar DNS en Cloudflare
2. Verificar que Nginx esté configurado
3. Verificar que el servidor Node.js esté corriendo
4. Ver logs: `pm2 logs aurelinportal`

### Las transcripciones no se procesan

1. Verificar que Whisper esté instalado en el servidor SSH
2. Verificar conexión SSH
3. Verificar permisos de Google Drive
4. Ver logs del servidor

---

## 📊 Estadísticas

El portal muestra:

- **Total Procesados**: Todos los archivos procesados
- **Exitosos**: Transcripciones completadas
- **Fallidos**: Transcripciones con error
- **Estado**: Activo/Pausado

---

## 🎨 Diseño del Portal

### Colores (Modo Oscuro Suave)

- **Fondo principal**: `#1a1a2e` → `#16213e` (gradiente)
- **Tarjetas**: `rgba(255, 255, 255, 0.05)` con blur
- **Texto principal**: `#e0e0e0`
- **Texto secundario**: `#90a4ae`
- **Acentos azul**: `#64b5f6`
- **Éxito verde**: `#81c784`
- **Advertencia naranja**: `#ffb74d`
- **Error rojo**: `#e57373`

### Características Visuales

- ✅ Gradientes suaves
- ✅ Efectos de blur (backdrop-filter)
- ✅ Transiciones suaves
- ✅ Hover effects sutiles
- ✅ Badges de estado con colores suaves
- ✅ Tablas con bordes sutiles

---

## 🚀 Próximos Pasos

1. ✅ Crear tablas en PostgreSQL
2. ✅ Configurar DNS en Cloudflare
3. ✅ Configurar Nginx (si es necesario)
4. ✅ Reiniciar servidor Node.js
5. ✅ Acceder al portal: `https://whispertranscripciones.eugenihidalgo.work`
6. ✅ Probar procesamiento manual

---

**Última actualización**: Diciembre 2024































