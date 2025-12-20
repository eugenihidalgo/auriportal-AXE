# 🤖 Sistema de Transcripción Inteligente

## 📋 Resumen

Sistema que selecciona automáticamente entre **Whisper Large** y **Whisper Medium** según los recursos disponibles del servidor, optimizando calidad y rendimiento.

---

## 🎯 Funcionalidades

### 1. **Selección Automática de Modelo**

El sistema monitorea recursos y selecciona el modelo óptimo:

- **Whisper Large**: Cuando hay recursos suficientes (1 transcripción, RAM disponible)
- **Whisper Medium**: Cuando hay múltiples transcripciones o recursos limitados

### 2. **Procesamiento Nocturno**

- **Horario**: 23:00 - 6:00 (configurable)
- **Comportamiento**: Procesa audios largos con Whisper Large
- **Ventaja**: Aprovecha recursos cuando hay menos carga

### 3. **Detección de Audios Largos**

- Detecta automáticamente audios >50MB
- Prioriza Whisper Large para audios largos si hay recursos

---

## 🔧 Lógica de Selección

### Reglas de Decisión

1. **1 transcripción + recursos suficientes** → **Whisper Large**
2. **1 transcripción + audio largo** → **Whisper Large** (si hay recursos)
3. **2+ transcripciones simultáneas** → **Whisper Medium**
4. **Procesamiento nocturno** → **Whisper Large** (forzado)
5. **Recursos insuficientes** → **Whisper Medium** (fallback)

### Requisitos de Recursos

| Modelo | RAM por Instancia | CPU por Instancia |
|--------|-------------------|-------------------|
| **Medium** | 2.6GB | 1.5 cores |
| **Large** | 4.5GB | 2.5 cores |

---

## 📊 Monitoreo de Recursos

El sistema monitorea:

- **RAM disponible**: Total, usado, libre, disponible
- **CPU**: Cores, carga actual, disponible
- **Procesos Whisper activos**: Cuántos están corriendo

### Ejemplo de Decisión

```
RAM disponible: 13GB
CPU disponible: 6 cores
Whisper activos: 0
Transcripciones simultáneas: 1
Audio largo: Sí

→ Decisión: Whisper Large ✅
Razón: 1 transcripción, recursos suficientes, audio largo
```

---

## 🕐 Tareas Programadas

### Procesamiento Normal

- **Frecuencia**: Cada 5 minutos (configurable)
- **Modelo**: Selección automática
- **Uso**: Procesamiento en tiempo real

### Procesamiento Nocturno

- **Horario**: 23:00 (configurable)
- **Modelo**: Whisper Large (forzado)
- **Uso**: Audios largos con máxima calidad

---

## 💻 Uso en Código

### Procesamiento Automático

```javascript
// El sistema selecciona automáticamente el modelo
const transcripcion = await transcribirAudioSSH(env, nombreArchivo, {
  modelo: 'auto', // Selección automática
  audioLargo: true,
  forzarLarge: false,
  transcripcionesSimultaneas: 1
});
```

### Forzar Whisper Large (Nocturno)

```javascript
const transcripcion = await transcribirAudioSSH(env, nombreArchivo, {
  modelo: 'auto',
  forzarLarge: true, // Forzar Large
  audioLargo: true,
  transcripcionesSimultaneas: 1
});
```

### Usar Modelo Específico

```javascript
const transcripcion = await transcribirAudioSSH(env, nombreArchivo, {
  modelo: 'large', // Forzar Large
  // o
  modelo: 'medium' // Forzar Medium
});
```

---

## 📈 Ventajas del Sistema

### ✅ Optimización de Recursos

- Usa Large cuando hay recursos disponibles
- Usa Medium cuando hay carga alta
- Evita saturación del servidor

### ✅ Calidad Adaptativa

- Máxima calidad (Large) para audios importantes
- Buena calidad (Medium) para procesamiento masivo

### ✅ Procesamiento Nocturno

- Aprovecha recursos cuando hay menos carga
- Procesa audios largos con máxima calidad

---

## 🔍 Monitoreo y Logs

El sistema registra:

```
🤖 [SSH] Modelo seleccionado automáticamente: LARGE - 1 transcripción, recursos suficientes - RAM: 13.00GB disponible
🎤 [SSH] Transcribiendo audio: audio_largo.mp3 con modelo LARGE
✅ [SSH] Transcripción completada: audio_largo.mp3 (modelo: LARGE)
```

---

## ⚙️ Configuración

### Variables de Entorno

```env
# Modelo por defecto (si no se usa 'auto')
SSH_DANI_MODELO_WHISPER=large

# Intervalo de procesamiento (minutos)
DRIVE_MONITOR_INTERVAL=5
```

### Modificar Horario Nocturno

Editar `src/services/scheduler.js`:

```javascript
// Cambiar de 23:00 a 22:00
const tareaNocturnaAudiosLargos = cron.schedule('0 22 * * *', ...);
```

---

## 📊 Ejemplo de Flujo

### Escenario 1: Día Normal

1. Usuario sube audio corto (5 min)
2. Sistema verifica recursos: 13GB RAM, 6 cores disponibles
3. **Decisión**: Whisper Large (1 transcripción, recursos suficientes)
4. Procesa con Large

### Escenario 2: Múltiples Usuarios

1. 3 usuarios suben audio simultáneamente
2. Sistema verifica recursos: 8GB RAM disponible
3. **Decisión**: Whisper Medium (múltiples transcripciones)
4. Procesa con Medium en cola

### Escenario 3: Noche (23:00)

1. Tarea programada se ejecuta
2. Sistema verifica recursos: 13GB RAM, baja carga
3. **Decisión**: Whisper Large (forzado, modo nocturno)
4. Procesa todos los audios largos con Large

---

## 🎯 Resultado

- ✅ **Calidad máxima** cuando hay recursos
- ✅ **Rendimiento óptimo** en alta carga
- ✅ **Procesamiento nocturno** para audios largos
- ✅ **Sin saturación** del servidor

---

**Última actualización**: Diciembre 2024



































