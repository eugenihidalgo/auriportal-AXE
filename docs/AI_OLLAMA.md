# Integración Ollama Local - AuriPortal

## Estado

**PREPARADO PERO NO ACTIVO** - El servicio está listo pero no se usa en pantallas cliente todavía.

## Objetivo

Integrar Ollama local para:
- Generar tags/sugerencias para prácticas (admin)
- Resumir transcripciones o contenido
- Búsqueda semántica (futuro)

## Configuración

### Variables de Entorno

```env
# Habilitar Ollama (por defecto: 'off')
OLLAMA_ENABLED=off

# URL base de Ollama (por defecto: http://localhost:11434)
OLLAMA_BASE_URL=http://localhost:11434

# Modelo a usar (por defecto: llama2)
OLLAMA_MODEL=llama2

# Timeout en milisegundos (por defecto: 5000)
OLLAMA_TIMEOUT_MS=5000
```

### Instalación de Ollama

1. **Instalar Ollama:**
   ```bash
   curl -fsSL https://ollama.ai/install.sh | sh
   ```

2. **Descargar modelo:**
   ```bash
   ollama pull llama2
   # o
   ollama pull mistral
   ```

3. **Verificar que funciona:**
   ```bash
   ollama run llama2 "Hola"
   ```

4. **Habilitar en AuriPortal:**
   ```env
   OLLAMA_ENABLED=on
   OLLAMA_MODEL=llama2
   ```

## Uso

### Llamada Básica

```javascript
import { callOllama } from './core/ai/ollama-client.js';

const result = await callOllama({
  model: 'llama2',
  prompt: 'Resume este texto: ...',
  timeoutMs: 5000
});

if (result) {
  console.log('Respuesta:', result);
} else {
  console.log('Ollama no disponible o falló');
}
```

### Generar Tags

```javascript
import { generarTagsPractica } from './core/ai/ollama-client.js';

const tags = await generarTagsPractica('Contenido de la práctica...');
// tags: ['meditación', 'energía', 'limpieza'] o null
```

### Generar Resumen

```javascript
import { generarResumenTranscripcion } from './core/ai/ollama-client.js';

const resumen = await generarResumenTranscripcion('Transcripción completa...');
// resumen: 'Resumen en 2-3 frases...' o null
```

### Verificar Disponibilidad

```javascript
import { verificarOllamaDisponible } from './core/ai/ollama-client.js';

const disponible = await verificarOllamaDisponible();
if (disponible) {
  console.log('Ollama está disponible');
} else {
  console.log('Ollama no está disponible');
}
```

## Fail-Open

**CRÍTICO**: El sistema está diseñado para **fail-open**:

- Si Ollama falla, devuelve `null` (no lanza error)
- Si Ollama no está disponible, el cliente sigue funcionando
- Si hay timeout, se loguea pero no rompe el flujo

Esto garantiza que:
- El cliente funciona aunque Ollama no esté corriendo
- No hay errores 500 si Ollama falla
- La UX no se ve afectada si Ollama cae

## Casos de Uso

### 1. Generar Tags para Prácticas (Admin)

```javascript
// En endpoint admin
import { generarTagsPractica } from './core/ai/ollama-client.js';

const tags = await generarTagsPractica(preparacion.contenido);
if (tags) {
  // Guardar tags en BD
  await guardarTags(preparacion.id, tags);
}
```

### 2. Resumir Transcripciones

```javascript
// En endpoint de transcripciones
import { generarResumenTranscripcion } from './core/ai/ollama-client.js';

const resumen = await generarResumenTranscripcion(transcripcion.texto);
if (resumen) {
  // Guardar resumen en BD
  await guardarResumen(transcripcion.id, resumen);
}
```

### 3. Búsqueda Semántica (Futuro)

```javascript
// Futuro: búsqueda semántica
const resultados = await buscarSemantico(query, {
  model: 'llama2',
  contexto: 'prácticas'
});
```

## Modelos Recomendados

- **llama2**: General, rápido, buena calidad
- **mistral**: Mejor calidad, más lento
- **codellama**: Para código (si se necesita)

## Performance

- **Timeouts cortos**: 3-5 segundos por defecto
- **Sin retries**: 0 retries por defecto (fail-fast)
- **No bloqueante**: Las llamadas son async y no bloquean el servidor

## Seguridad

- **Solo local**: Ollama corre en localhost (no expuesto)
- **Sin datos sensibles**: No se envían datos sensibles a Ollama
- **Fail-open**: Si falla, no expone información

## Troubleshooting

### Ollama no responde

1. Verificar que Ollama está corriendo:
   ```bash
   curl http://localhost:11434/api/tags
   ```

2. Verificar logs:
   ```bash
   pm2 logs aurelinportal | grep Ollama
   ```

3. Verificar variables de entorno:
   ```bash
   echo $OLLAMA_ENABLED
   echo $OLLAMA_BASE_URL
   ```

### Timeouts frecuentes

1. Aumentar timeout:
   ```env
   OLLAMA_TIMEOUT_MS=10000
   ```

2. Usar modelo más rápido:
   ```env
   OLLAMA_MODEL=llama2
   ```

### Respuestas vacías

1. Verificar que el modelo está descargado:
   ```bash
   ollama list
   ```

2. Probar el modelo directamente:
   ```bash
   ollama run llama2 "Test"
   ```

## Referencias

- [Ollama Documentation](https://github.com/ollama/ollama)
- `src/core/ai/ollama-client.js` - Implementación del cliente










