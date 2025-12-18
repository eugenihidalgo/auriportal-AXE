# 🔍 DIAGNÓSTICO EXHAUSTIVO: RELOJ DE MEDITACIÓN AURIPORTAL

**Fecha de análisis:** 2025-01-XX  
**Versión del sistema:** 4.0.0  
**Objetivo:** Documentación completa del sistema de reloj de meditación para análisis externo

---

## 📋 ÍNDICE

1. [Arquitectura General](#1-arquitectura-general)
2. [Flujo de Datos Backend → Frontend](#2-flujo-de-datos-backend--frontend)
3. [Configuración del Reloj](#3-configuración-del-reloj)
4. [Sistema de Audio](#4-sistema-de-audio)
5. [Estados y Ciclo de Vida](#5-estados-y-ciclo-de-vida)
6. [Problemas Identificados](#6-problemas-identificados)
7. [Análisis de Código Crítico](#7-análisis-de-código-crítico)
8. [Recomendaciones](#8-recomendaciones)

---

## 1. ARQUITECTURA GENERAL

### 1.1 Componentes Principales

```
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND (Node.js)                        │
├─────────────────────────────────────────────────────────────┤
│  practicas-handler.js                                       │
│  ├─ renderEjecucion()                                       │
│  ├─ renderPostEjecucion()                                   │
│  └─ Calcula: totalMinutos, musicasDisponibles               │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ HTML + data-reloj-config
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Browser)                       │
├─────────────────────────────────────────────────────────────┤
│  ejecucion.html / post-ejecucion.html                       │
│  ├─ <div id="reloj-meditacion-unico">                       │
│  └─ <script> inicializa RelojMeditacion                     │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ new RelojMeditacion()
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              reloj-meditacion.js (Clase JS)                 │
├─────────────────────────────────────────────────────────────┤
│  ├─ Constructor: recibe config del servidor                 │
│  ├─ init(): carga localStorage, renderiza UI               │
│  ├─ AudioContext: Web Audio API para música/tono           │
│  ├─ Loop continuo: música nunca se detiene                  │
│  └─ Overlay interno: finalización sin popups nativos        │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Archivos Involucrados

**Backend:**
- `/src/endpoints/practicas-handler.js` - Handler principal que renderiza pantallas
- `/src/services/musicas-meditacion.js` - Servicio que obtiene músicas de PostgreSQL

**Frontend:**
- `/public/js/reloj-meditacion.js` - Clase JavaScript del reloj (874 líneas)
- `/public/css/reloj-meditacion.css` - Estilos del reloj
- `/src/core/html/practicas/ejecucion.html` - Template HTML con inicialización
- `/src/core/html/practicas/post-ejecucion.html` - Template HTML post-ejecución

---

## 2. FLUJO DE DATOS BACKEND → FRONTEND

### 2.1 Backend: Cálculo de Minutos y Configuración

**Ubicación:** `src/endpoints/practicas-handler.js` (líneas 308-455)

```javascript
// PASO 1: Calcular minutos totales de prácticas seleccionadas
let totalMinutos = 0;
preparaciones.forEach(prep => {
  const minutosRaw = prep.minutos;
  let minutos = 0;
  if (minutosRaw != null) {
    const minutosNum = Number(minutosRaw);
    if (!isNaN(minutosNum) && minutosNum >= 0 && isFinite(minutosNum)) {
      minutos = Math.floor(minutosNum);
    }
  }
  totalMinutos += minutos;
});

// PASO 2: Obtener músicas disponibles de PostgreSQL
const todasLasMusicas = await listarMusicas();
const musicasDisponibles = todasLasMusicas.map(m => ({
  id: m.id,
  nombre: m.nombre,
  url: m.archivo_path || m.url_externa,
  duracion: m.duracion_segundos,
  esPorDefecto: m.es_por_defecto
}));

// PASO 3: Configurar música por defecto
const musicaPorDefecto = musicasDisponibles.find(m => m.esPorDefecto);
let musicaUrl = null;
let musicaDuracion = null;
let musicaIdPorDefecto = null;

if (musicaPorDefecto) {
  musicaUrl = musicaPorDefecto.url;
  musicaDuracion = musicaPorDefecto.duracion;
  musicaIdPorDefecto = musicaPorDefecto.id;
}

// PASO 4: Crear configuración del reloj
relojConfig = {
  musicaUrl: musicaUrl,                    // URL de música por defecto
  musicaDuracion: musicaDuracion,          // Duración en segundos
  musicaIdPorDefecto: musicaIdPorDefecto,  // ID de música por defecto
  musicasDisponibles: musicasDisponibles,  // Array completo de músicas
  tonoUrl: tonoUrl                         // URL del tono de finalización
};

// PASO 5: Serializar y pasar al HTML
const relojConfigStr = JSON.stringify(relojConfig).replace(/"/g, '&quot;');
relojHTML = `
  <div id="reloj-meditacion-unico" data-reloj-config="${relojConfigStr}"></div>
`;
```

**⚠️ PROBLEMA IDENTIFICADO #1:**
- El backend **NO pasa `tiempoTotal`** (minutos totales calculados)
- El reloj debe calcular/obtener el tiempo desde `localStorage` o configuración del usuario
- Esto causa que el reloj no refleje automáticamente los minutos de las prácticas seleccionadas

### 2.2 Frontend: Inicialización del Reloj

**Ubicación:** `src/core/html/practicas/ejecucion.html` (líneas 362-379)

```javascript
<script src="/js/reloj-meditacion.js"></script>
<script>
  document.addEventListener('DOMContentLoaded', function() {
    const relojEl = document.getElementById('reloj-meditacion-unico');
    if (relojEl) {
      const configStr = relojEl.getAttribute('data-reloj-config');
      if (configStr) {
        try {
          const config = JSON.parse(configStr.replace(/&quot;/g, '"'));
          console.log('Config del reloj:', config);
          window.relojMeditacionActual = new RelojMeditacion('reloj-meditacion-unico', config);
        } catch (error) {
          console.error('Error inicializando reloj:', error);
        }
      }
    }
  });
</script>
```

**Flujo:**
1. HTML carga con `<div id="reloj-meditacion-unico" data-reloj-config="...">`
2. `DOMContentLoaded` se dispara
3. Se lee `data-reloj-config` y se parsea JSON
4. Se crea instancia de `RelojMeditacion` con la configuración

---

## 3. CONFIGURACIÓN DEL RELOJ

### 3.1 Constructor de RelojMeditacion

**Ubicación:** `public/js/reloj-meditacion.js` (líneas 5-57)

```javascript
constructor(containerId, config) {
  // 1. Obtener contenedor DOM
  this.container = document.getElementById(containerId);
  
  // 2. Procesar configuración del servidor
  this.config = {
    musicaUrl: config.musicaUrl || null,
    musicaDuracion: config.musicaDuracion || null,
    musicaIdPorDefecto: config.musicaIdPorDefecto || null,
    musicasDisponibles: config.musicasDisponibles || [],
    tonoUrl: config.tonoUrl || null
  };
  
  // 3. Inicializar estado
  this.tiempoTotal = 0;  // ⚠️ PROBLEMA: Empieza en 0
  this.tiempoTranscurrido = 0;
  this.estaIniciado = false;
  this.estaPausado = false;
  this.estaFinalizado = false;
  
  // 4. Inicializar audio
  this.audioContext = null;
  this.musicGainNode = null;
  this.toneGainNode = null;
  this.musicSources = [];
  
  // 5. Llamar init()
  this.init();
}
```

**⚠️ PROBLEMA IDENTIFICADO #2:**
- `tiempoTotal` se inicializa en `0`
- Solo se actualiza desde `localStorage` (si existe configuración previa)
- Si no hay `localStorage`, el usuario debe configurar manualmente el tiempo

### 3.2 Método init()

**Ubicación:** `public/js/reloj-meditacion.js` (líneas 59-92)

```javascript
init() {
  // 1. Cargar configuración guardada desde localStorage
  const saved = this.cargarConfiguracion();
  if (saved && saved.tiempoTotal) {
    this.tiempoTotal = saved.tiempoTotal;  // Solo si existe en localStorage
  }
  
  // 2. Cargar preferencias de música
  if (saved && saved.musicaSeleccionadaId) {
    // Usar música guardada
    const musica = this.config.musicasDisponibles.find(m => m.id == saved.musicaSeleccionadaId);
    if (musica) {
      this.musicaSeleccionadaId = musica.id;
      this.musicaSeleccionadaUrl = musica.url;
      this.musicaSeleccionadaDuracion = musica.duracion;
      this.reproducirMusica = true;
    }
  } else if (this.config.musicaIdPorDefecto) {
    // Usar música por defecto del servidor
    const musicaDefecto = this.config.musicasDisponibles.find(m => m.id == this.config.musicaIdPorDefecto);
    if (musicaDefecto) {
      this.musicaSeleccionadaId = musicaDefecto.id;
      this.musicaSeleccionadaUrl = musicaDefecto.url;
      this.musicaSeleccionadaDuracion = musicaDefecto.duracion;
    }
  }
  
  // 3. Renderizar UI
  this.render();
  
  // 4. Configurar event listeners
  this.setupEventListeners();
  
  // 5. Inicializar AudioContext
  this.initAudioContext();
}
```

**⚠️ PROBLEMA IDENTIFICADO #3:**
- El reloj depende de `localStorage` para el tiempo
- Si el usuario nunca ha usado el reloj, `tiempoTotal = 0`
- No hay forma de que el reloj sepa automáticamente los minutos calculados en el backend

### 3.3 localStorage

**Ubicación:** `public/js/reloj-meditacion.js` (líneas 842-868)

```javascript
guardarConfiguracion() {
  const key = 'reloj-meditacion-config';
  const data = {
    tiempoTotal: this.tiempoTotal,
    reproducirMusica: this.reproducirMusica,
    musicaSeleccionadaId: this.musicaSeleccionadaId,
    tiempoTranscurrido: this.estaIniciado ? this.tiempoTranscurrido : 0
  };
  localStorage.setItem(key, JSON.stringify(data));
}

cargarConfiguracion() {
  const key = 'reloj-meditacion-config';
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : null;
}
```

**Problema:**
- `localStorage` es persistente entre sesiones
- Si el usuario cambia de prácticas, el reloj sigue usando el tiempo anterior
- No hay sincronización con el backend

---

## 4. SISTEMA DE AUDIO

### 4.1 AudioContext

**Ubicación:** `public/js/reloj-meditacion.js` (líneas 94-109)

```javascript
initAudioContext() {
  if (!this.audioContext) {
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    console.log('[Reloj] AudioContext creado, estado inicial:', this.audioContext.state);
  }
}
```

**Estado del AudioContext:**
- `suspended`: Contexto creado pero no activo (móvil)
- `running`: Contexto activo y reproduciendo
- Se activa en el click de "Iniciar Meditación" (gesto del usuario requerido en móvil)

### 4.2 Reproducción de Música

**Ubicación:** `public/js/reloj-meditacion.js` (líneas 383-419)

```javascript
async reproducirMusicaMeditacion() {
  // 1. Verificar AudioContext activo
  if (this.audioContext.state === 'suspended') {
    await this.audioContext.resume();
  }
  
  // 2. Cargar audio desde URL
  const response = await fetch(this.musicaSeleccionadaUrl);
  const arrayBuffer = await response.arrayBuffer();
  this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
  
  // 3. Crear GainNode para control de volumen
  this.musicGainNode = this.audioContext.createGain();
  this.musicGainNode.gain.setValueAtTime(1.0, this.audioContext.currentTime);
  
  // 4. Iniciar loop continuo
  this.crearLoopMusicaConFade();
}
```

### 4.3 Loop Continuo de Música

**Ubicación:** `public/js/reloj-meditacion.js` (líneas 440-509)

```javascript
crearLoopMusicaConFade() {
  const duracionMusica = this.audioBuffer.duration;
  this.musicSources = [];  // Array de sources activos
  
  // Función que crea el siguiente buffer ANTES de que termine el actual
  const programarSiguienteBuffer = () => {
    // Crear nuevo source
    const source = this.audioContext.createBufferSource();
    source.buffer = this.audioBuffer;
    source.connect(this.musicGainNode);
    source.start(this.audioContext.currentTime);
    
    // Guardar referencia
    this.musicSources.push(source);
  };
  
  // Iniciar primer buffer
  programarSiguienteBuffer();
  
  // Programar siguientes buffers con intervalo
  const intervalo = Math.max(100, (duracionMusica - 0.5) * 1000);
  this.loopIntervalId = setInterval(() => {
    if (this.estaIniciado && !this.estaPausado && !this.fadeOutCompleto) {
      programarSiguienteBuffer();
    }
  }, intervalo);
}
```

**Objetivo:**
- Música nunca se detiene (siempre hay al menos un source activo)
- Evita que el navegador detecte "fin de audio" y muestre UI nativa
- Loop continuo sin silencios

### 4.4 Fade-Out y Crossfade

**Ubicación:** `public/js/reloj-meditacion.js` (líneas 573-596, 784-829)

```javascript
iniciarFadeOutMusica() {
  // Fade-out: volumen 1.0 → 0.0 en 2.5 segundos
  const currentTime = this.audioContext.currentTime;
  this.musicGainNode.gain.setValueAtTime(1.0, currentTime);
  this.musicGainNode.gain.linearRampToValueAtTime(0.0, currentTime + 2.5);
  // ⚠️ NO detiene los sources - solo baja el volumen
}

reproducirTonoConCrossfade() {
  // Crear GainNode para tono
  this.toneGainNode = this.audioContext.createGain();
  this.toneGainNode.connect(this.audioContext.destination);
  
  // Cargar y reproducir tono
  const source = this.audioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(this.toneGainNode);
  
  // Crossfade: tono empieza en 0 y sube a 1.0 en 0.3s
  const currentTime = this.audioContext.currentTime;
  this.toneGainNode.gain.setValueAtTime(0, currentTime);
  this.toneGainNode.gain.linearRampToValueAtTime(1.0, currentTime + 0.3);
  
  source.start(0);
}
```

**Transición:**
- Música: fade-out 2.5s (volumen baja)
- Tono: fade-in 0.3s (volumen sube)
- Ambos suenan simultáneamente durante el crossfade

---

## 5. ESTADOS Y CICLO DE VIDA

### 5.1 Estados del Reloj

```
┌─────────────────┐
│  NO INICIADO    │  ← Estado inicial
│  tiempoTotal=0  │
│  Configuración  │
└────────┬────────┘
         │ usuario hace click "Iniciar"
         ▼
┌─────────────────┐
│   INICIADO      │  ← Meditación corriendo
│   Contador ON   │
│   Música ON     │
└────────┬────────┘
         │
         ├─ usuario pausa ──► PAUSADO
         │
         ├─ tiempo termina ──► FINALIZADO
         │
         └─ usuario reinicia ──► NO INICIADO
```

### 5.2 Ciclo de Vida Completo

1. **Inicialización:**
   - Constructor recibe `config` del servidor
   - `init()` carga `localStorage`
   - `render()` muestra UI de configuración
   - `initAudioContext()` crea AudioContext

2. **Configuración:**
   - Usuario ajusta tiempo (minutos)
   - Usuario selecciona música
   - Configuración se guarda en `localStorage`

3. **Inicio:**
   - `iniciar()` valida tiempo mínimo (60s)
   - Resume AudioContext (crítico en móvil)
   - Inicia contador (`setInterval` cada 1s)
   - Inicia música (Web Audio API)

4. **Ejecución:**
   - Contador incrementa `tiempoTranscurrido`
   - Actualiza display cada segundo
   - A los 3s antes del final: inicia fade-out
   - Al llegar a `tiempoTotal`: llama `finalizar()`

5. **Finalización:**
   - `finalizar()` detiene contador
   - Música hace fade-out (ya iniciado)
   - Tono se reproduce con crossfade
   - Muestra overlay interno (no popup nativo)

6. **Cierre:**
   - Usuario cierra overlay
   - `cerrarOverlayFinalizacion()` limpia audio
   - Resetea estado a "NO INICIADO"
   - Vuelve a mostrar configuración

---

## 6. PROBLEMAS IDENTIFICADOS

### 6.1 Problema Crítico: Tiempo Total No Se Pasa del Backend

**Ubicación:** `src/endpoints/practicas-handler.js` (línea 441)

```javascript
// ❌ PROBLEMA: No se pasa tiempoTotal
relojConfig = {
  musicaUrl: musicaUrl,
  musicaDuracion: musicaDuracion,
  musicaIdPorDefecto: musicaIdPorDefecto,
  musicasDisponibles: musicasDisponibles,
  tonoUrl: tonoUrl
  // ⚠️ FALTA: tiempoTotal: totalMinutos * 60
};
```

**Impacto:**
- El backend calcula `totalMinutos` pero no lo pasa al frontend
- El reloj empieza con `tiempoTotal = 0`
- Usuario debe configurar manualmente el tiempo
- No refleja automáticamente los minutos de las prácticas seleccionadas

**Solución propuesta:**
```javascript
relojConfig = {
  tiempoTotal: totalMinutos * 60,  // ← AÑADIR ESTO
  musicaUrl: musicaUrl,
  musicaDuracion: musicaDuracion,
  musicaIdPorDefecto: musicaIdPorDefecto,
  musicasDisponibles: musicasDisponibles,
  tonoUrl: tonoUrl
};
```

Y en el constructor del reloj:
```javascript
constructor(containerId, config) {
  // ...
  this.tiempoTotal = config.tiempoTotal || 0;  // ← Usar tiempo del servidor
  // ...
}
```

### 6.2 Problema: Dependencia de localStorage

**Ubicación:** `public/js/reloj-meditacion.js` (líneas 59-64)

```javascript
init() {
  const saved = this.cargarConfiguracion();
  if (saved && saved.tiempoTotal) {
    this.tiempoTotal = saved.tiempoTotal;  // ⚠️ Solo desde localStorage
  }
  // ...
}
```

**Impacto:**
- Si no hay `localStorage`, `tiempoTotal = 0`
- Si el usuario cambia de prácticas, el reloj usa tiempo anterior
- No hay sincronización con el backend

**Solución propuesta:**
```javascript
init() {
  // Prioridad 1: Configuración del servidor
  if (this.config.tiempoTotal && this.config.tiempoTotal > 0) {
    this.tiempoTotal = this.config.tiempoTotal;
  }
  // Prioridad 2: localStorage (solo si no hay config del servidor)
  else {
    const saved = this.cargarConfiguracion();
    if (saved && saved.tiempoTotal) {
      this.tiempoTotal = saved.tiempoTotal;
    }
  }
  // ...
}
```

### 6.3 Problema: Múltiples Inicializaciones

**Ubicación:** Múltiples archivos HTML

El reloj se inicializa en:
- `ejecucion.html`
- `post-ejecucion.html`
- `post.html`
- `preparacion-practica.html`
- `tecnica-post-practica.html`

**Impacto:**
- Si el usuario navega entre pantallas, puede haber múltiples instancias
- `window.relojMeditacionActual` se sobrescribe
- Puede causar memory leaks

**Solución propuesta:**
```javascript
// Verificar si ya existe instancia
if (window.relojMeditacionActual) {
  window.relojMeditacionActual.destroy();  // Limpiar instancia anterior
}
window.relojMeditacionActual = new RelojMeditacion('reloj-meditacion-unico', config);
```

### 6.4 Problema: Loop de Música Complejo

**Ubicación:** `public/js/reloj-meditacion.js` (líneas 440-509)

El sistema de loop continuo es complejo:
- Múltiples `AudioBufferSourceNode` activos simultáneamente
- `setInterval` que programa nuevos buffers
- Lógica de `fadeOutCompleto` que detiene el intervalo

**Impacto:**
- Difícil de depurar
- Puede causar memory leaks si no se limpia correctamente
- Múltiples sources activos consumen memoria

**Solución propuesta:**
- Simplificar usando un solo source con `loop = true` (si el navegador lo soporta)
- O usar `AudioBufferSourceNode` con `onended` para loop más simple

---

## 7. ANÁLISIS DE CÓDIGO CRÍTICO

### 7.1 Renderizado de UI

**Ubicación:** `public/js/reloj-meditacion.js` (líneas 111-203)

El método `render()` genera HTML dinámicamente basado en estado:

```javascript
render() {
  const minutos = Math.floor(this.tiempoTotal / 60);
  
  // Generar opciones de música
  let opcionesMusica = '<option value="">Sin música</option>';
  if (Array.isArray(musicasDisponibles) && musicasDisponibles.length > 0) {
    opcionesMusica += musicasDisponibles.map(m => {
      // ... generar <option>
    }).join('');
  }
  
  // Renderizar según estado
  this.container.innerHTML = `
    ${this.estaFinalizado ? `
      <!-- Vista de finalización -->
    ` : !this.estaIniciado ? `
      <!-- Vista de configuración -->
    ` : `
      <!-- Vista de ejecución -->
    `}
  `;
}
```

**Problema:**
- `innerHTML` reemplaza todo el contenido
- Event listeners inline (`onclick`) se recrean cada vez
- No hay virtual DOM ni optimización de re-renders

### 7.2 Manejo de Audio en Móvil

**Ubicación:** `public/js/reloj-meditacion.js` (líneas 265-290)

```javascript
iniciar() {
  // CRÍTICO: En móvil, AudioContext debe activarse en gesto del usuario
  if (this.audioContext && this.audioContext.state === 'suspended') {
    this.audioContext.resume().then(() => {
      console.log('[Reloj] audioContext state: running');
    });
  }
  
  // Iniciar música sincrónicamente en el click
  if (this.reproducirMusica && this.musicaSeleccionadaUrl) {
    this.reproducirMusicaMeditacion();
  }
}
```

**Correcto:**
- AudioContext se resume en el click (gesto del usuario)
- Música se inicia inmediatamente después del gesto
- Cumple con políticas de autoplay de navegadores móviles

### 7.3 Overlay de Finalización

**Ubicación:** `public/js/reloj-meditacion.js` (líneas 629-717)

```javascript
mostrarOverlayFinalizacion() {
  // Crear overlay si no existe
  let overlay = document.getElementById('reloj-overlay-finalizacion');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'reloj-overlay-finalizacion';
    overlay.className = 'reloj-overlay-finalizacion';
    overlay.innerHTML = `...`;
    document.body.appendChild(overlay);
  }
  
  overlay.classList.add('mostrar');
  
  // Auto-cierre después de 8 segundos
  setTimeout(() => {
    if (overlay && overlay.classList.contains('mostrar')) {
      this.cerrarOverlayFinalizacion();
    }
  }, 8000);
}
```

**Correcto:**
- Overlay es DIV interno (no popup nativo)
- Se reutiliza si ya existe
- Auto-cierre opcional
- No interrumpe el flujo del navegador

---

## 8. RECOMENDACIONES

### 8.1 Prioridad Alta

1. **Pasar `tiempoTotal` del Backend al Frontend**
   - Modificar `practicas-handler.js` para incluir `tiempoTotal` en `relojConfig`
   - Modificar constructor de `RelojMeditacion` para usar `config.tiempoTotal`
   - Priorizar configuración del servidor sobre `localStorage`

2. **Simplificar Inicialización**
   - Verificar si ya existe instancia antes de crear nueva
   - Limpiar instancia anterior si existe
   - Añadir método `destroy()` para limpieza

3. **Mejorar Manejo de Estado**
   - Separar estado de configuración del estado de ejecución
   - Sincronizar estado con backend cuando sea necesario
   - Limpiar `localStorage` cuando cambian las prácticas

### 8.2 Prioridad Media

4. **Simplificar Loop de Música**
   - Evaluar usar `AudioBufferSourceNode` con `loop = true` si es posible
   - Reducir número de sources activos simultáneamente
   - Mejorar limpieza de recursos

5. **Mejorar Renderizado**
   - Considerar usar framework ligero o virtual DOM
   - Optimizar re-renders (solo actualizar lo necesario)
   - Separar lógica de presentación

6. **Añadir Tests**
   - Tests unitarios para lógica de tiempo
   - Tests de integración para flujo completo
   - Tests de audio (mock AudioContext)

### 8.3 Prioridad Baja

7. **Documentación**
   - Comentar métodos complejos
   - Documentar parámetros y retornos
   - Crear diagramas de flujo

8. **Optimización**
   - Lazy loading de audio
   - Preload de música seleccionada
   - Compresión de assets

---

## 9. RESUMEN EJECUTIVO

### Estado Actual

✅ **Funciona:**
- Inicialización básica del reloj
- Reproducción de música con Web Audio API
- Sistema de fade-out y crossfade
- Overlay interno (sin popups nativos)
- Manejo correcto de AudioContext en móvil

❌ **No Funciona Correctamente:**
- Tiempo total no se pasa del backend
- Reloj depende de `localStorage` para tiempo
- No refleja automáticamente minutos de prácticas seleccionadas
- Posibles múltiples instancias al navegar

### Acción Requerida

**Cambio mínimo y crítico:**

1. En `practicas-handler.js` (línea 441):
```javascript
relojConfig = {
  tiempoTotal: totalMinutos * 60,  // ← AÑADIR
  musicaUrl: musicaUrl,
  // ... resto igual
};
```

2. En `reloj-meditacion.js` constructor (línea 29):
```javascript
this.tiempoTotal = config.tiempoTotal || 0;  // ← Usar del servidor
```

3. En `reloj-meditacion.js` init() (línea 59):
```javascript
init() {
  // Prioridad 1: Configuración del servidor
  if (this.config.tiempoTotal && this.config.tiempoTotal > 0) {
    this.tiempoTotal = this.config.tiempoTotal;
  }
  // Prioridad 2: localStorage
  else {
    const saved = this.cargarConfiguracion();
    if (saved && saved.tiempoTotal) {
      this.tiempoTotal = saved.tiempoTotal;
    }
  }
  // ... resto igual
}
```

**Con estos 3 cambios mínimos, el reloj reflejará automáticamente los minutos calculados en el backend.**

---

**Fin del Diagnóstico**















