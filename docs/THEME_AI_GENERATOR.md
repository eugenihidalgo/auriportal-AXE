# 🎨 Theme AI Generator - Servicio de Generación de Temas con IA

**Versión:** 1.0  
**Fecha:** 2024-12-19  
**Estado:** Implementado  
**Dependencias:** Theme Contract v1, Ollama Client

---

## 📋 Resumen

El **Theme AI Generator** es un servicio que genera propuestas de temas completos usando IA (Ollama local). Estas propuestas son **drafts conceptuales** que pueden ser usadas en el futuro editor de temas para que el usuario las revise, edite y guarde manualmente.

### Principios Fundamentales

1. **Solo Genera Propuestas**: NO persiste, NO registra, NO aplica temas automáticamente
2. **Fail-Open Absoluto**: Si Ollama falla, devuelve array vacío (nunca rompe el sistema)
3. **Validación Estricta**: Solo devuelve propuestas que cumplan Theme Contract v1 completo
4. **No Invasivo**: No modifica temas activos, no toca `system-themes.js`, no afecta `applyTheme()`
5. **Reversible**: Todo es conceptual y puede descartarse sin consecuencias

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│              Theme AI Generator Service                  │
│  ┌─────────────────────────────────────────────────┐   │
│  │  generateThemeProposals({ prompt, count })     │   │
│  │  - Construye prompt estructurado               │   │
│  │  - Llama a Ollama (si está disponible)          │   │
│  │  - Parsea respuesta JSON                        │   │
│  │  - Valida contra Theme Contract v1              │   │
│  │  - Devuelve solo propuestas válidas            │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│              Ollama Client (Fail-Open)                   │
│  - Timeout corto (8s por defecto)                       │
│  - Sin retries                                           │
│  - Si falla → devuelve null                             │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│              Theme Contract Validator                    │
│  - Verifica todas las variables requeridas              │
│  - Descarta propuestas inválidas                        │
│  - Garantiza completitud                                │
└─────────────────────────────────────────────────────────┘
```

---

## 📁 Ubicación

- **Servicio**: `src/core/theme/theme-ai-generator.js`
- **Documentación**: `docs/THEME_AI_GENERATOR.md`

---

## 🔧 API

### `generateThemeProposals({ prompt, count })`

Genera propuestas de temas usando IA.

**Parámetros:**

- `prompt` (string, requerido): Descripción del tema deseado
  - Ejemplos:
    - `"hazme un tema de navidad"`
    - `"tema calmado para sanación"`
    - `"tema luminoso y suave"`
    - `"tema profundo y protector"`
- `count` (number, opcional): Número de propuestas a generar (1-5, default: 1)

**Retorna:**

```typescript
Promise<Array<ThemeProposal>>
```

**Estructura de `ThemeProposal`:**

```javascript
{
  key: 'generated-navidad-01',           // Clave única generada
  name: 'Navidad Suave',                  // Nombre legible
  description: 'Tema navideño cálido...', // Descripción
  contractVersion: 'v1',                  // Versión del contrato
  values: {                               // TODAS las variables del contrato
    '--bg-main': '#0a0e1a',
    '--text-primary': '#f1f5f9',
    // ... todas las 70+ variables
  },
  meta: {
    generatedBy: 'ollama',
    prompt: 'hazme un tema de navidad',
    timestamp: '2024-12-19T10:30:00Z'
  }
}
```

**Ejemplo de uso:**

```javascript
import { generateThemeProposals } from './core/theme/theme-ai-generator.js';

// Generar una propuesta
const proposals = await generateThemeProposals({
  prompt: 'hazme un tema de navidad',
  count: 1
});

if (proposals.length > 0) {
  console.log('Propuesta generada:', proposals[0].name);
  // Usar propuesta en editor (futuro)
} else {
  console.log('No se pudieron generar propuestas (Ollama no disponible)');
}

// Generar múltiples propuestas
const multipleProposals = await generateThemeProposals({
  prompt: 'tema calmado para sanación',
  count: 3
});
```

---

## 🛡️ Fail-Open y Seguridad

### Comportamiento Fail-Open

1. **Ollama no disponible**: Devuelve `[]` (array vacío)
2. **Ollama timeout**: Devuelve `[]` (array vacío)
3. **Ollama error**: Devuelve `[]` (array vacío)
4. **Respuesta inválida**: Descarta propuestas inválidas, devuelve solo válidas
5. **Todas inválidas**: Devuelve `[]` (array vacío)

### Garantías

- ✅ **Nunca rompe el sistema**: Si falla, devuelve array vacío
- ✅ **Nunca persiste**: Las propuestas son solo en memoria
- ✅ **Nunca registra**: No toca `system-themes.js` ni el registry
- ✅ **Nunca aplica**: No modifica `applyTheme()` ni temas activos
- ✅ **Siempre válidas**: Solo devuelve propuestas que cumplan Theme Contract v1

### Timeouts y Retries

- **Timeout**: 8 segundos por defecto (configurable)
- **Retries**: 0 (fail-fast)
- **Logs**: Solo en modo debug/development

---

## ✅ Validación

Cada propuesta generada se valida contra Theme Contract v1:

1. **Completitud**: Debe tener TODAS las variables del contrato (70+ variables)
2. **Formato**: Valores CSS válidos (hex, rgb, rgba, hsl, gradientes, etc.)
3. **No vacíos**: No acepta valores `null`, `undefined`, o strings vacíos

**Si una propuesta falla la validación:**
- Se descarta silenciosamente
- No se incluye en el resultado
- No se loguea (fail-open)

**Si todas fallan:**
- Se devuelve array vacío `[]`
- El sistema sigue funcionando normalmente

---

## 🔮 Uso Futuro en Editor de Temas

Este servicio está diseñado para ser usado en el **futuro editor de temas**:

### Flujo Propuesto

1. **Usuario escribe prompt**: "hazme un tema de navidad"
2. **Editor llama a `generateThemeProposals()`**: Genera 1-3 propuestas
3. **Editor muestra propuestas**: Usuario puede ver preview de cada una
4. **Usuario selecciona/edita**: Puede elegir una y editarla manualmente
5. **Usuario guarda**: Guarda en BD como tema personalizado (fuera del scope de este servicio)

### Integración con Editor

```javascript
// En el futuro editor de temas
async function handleGenerateTheme(prompt) {
  // Mostrar loading
  setLoading(true);
  
  // Generar propuestas
  const proposals = await generateThemeProposals({
    prompt,
    count: 3
  });
  
  if (proposals.length === 0) {
    // Mostrar mensaje: "No se pudieron generar propuestas. Ollama no está disponible."
    showMessage('Ollama no está disponible. Intenta más tarde.');
    return;
  }
  
  // Mostrar propuestas en UI
  setProposals(proposals);
  
  // Usuario puede:
  // - Ver preview de cada propuesta
  // - Seleccionar una para editar
  // - Editar manualmente
  // - Guardar como tema personalizado
}
```

---

## ⚙️ Configuración

### Variables de Entorno

El servicio usa las mismas variables que el cliente Ollama:

```env
# Habilitar Ollama (requerido para que funcione)
OLLAMA_ENABLED=on

# URL base de Ollama (default: http://localhost:11434)
OLLAMA_BASE_URL=http://localhost:11434

# Modelo a usar (default: llama2)
OLLAMA_MODEL=llama2
```

### Timeout

El timeout por defecto es 8 segundos, pero puede configurarse:

```javascript
const proposals = await generateThemeProposals({
  prompt: 'tema calmado',
  count: 1,
  timeoutMs: 10000 // 10 segundos
});
```

---

## 🧪 Testing

### Verificación Manual

1. **Verificar que Ollama está disponible:**
   ```bash
   curl http://localhost:11434/api/tags
   ```

2. **Probar generación:**
   ```javascript
   import { generateThemeProposals } from './core/theme/theme-ai-generator.js';
   
   const proposals = await generateThemeProposals({
     prompt: 'tema de navidad',
     count: 1
   });
   
   console.log('Propuestas:', proposals.length);
   if (proposals.length > 0) {
     console.log('Primera propuesta:', proposals[0].name);
     console.log('Variables:', Object.keys(proposals[0].values).length);
   }
   ```

3. **Verificar validación:**
   - Las propuestas deben tener todas las variables del contrato
   - Puedes verificar con `validateThemeValues()` de `theme-contract.js`

### Casos de Prueba

- ✅ **Ollama disponible**: Genera propuestas válidas
- ✅ **Ollama no disponible**: Devuelve `[]`
- ✅ **Ollama timeout**: Devuelve `[]`
- ✅ **Prompt inválido**: Devuelve `[]`
- ✅ **Propuestas inválidas**: Descarta inválidas, devuelve solo válidas
- ✅ **Todas inválidas**: Devuelve `[]`

---

## 🚫 Qué NO Hace

Este servicio **NO**:

- ❌ Persiste temas en base de datos
- ❌ Registra temas en `system-themes.js`
- ❌ Aplica temas automáticamente
- ❌ Modifica `applyTheme()` o `resolveTheme()`
- ❌ Afecta temas activos del sistema
- ❌ Crea UI o endpoints
- ❌ Requiere permisos especiales
- ❌ Bloquea el servidor si Ollama falla

---

## 📚 Referencias

- **Theme Contract v1**: `docs/THEME_CONTRACT.md`
- **Theme Definitions v1**: `docs/THEME_DEFINITIONS_V1.md`
- **Theme Resolver**: `docs/THEME_RESOLVER_DESIGN.md`
- **Ollama Client**: `docs/AI_OLLAMA.md`
- **Código fuente**: `src/core/theme/theme-ai-generator.js`

---

## ✅ Checklist de Verificación

Después de implementar cambios:

- [ ] Servicio genera propuestas cuando Ollama está disponible
- [ ] Servicio devuelve `[]` cuando Ollama no está disponible (fail-open)
- [ ] Propuestas generadas tienen TODAS las variables del contrato
- [ ] Propuestas inválidas se descartan silenciosamente
- [ ] No se modifica `system-themes.js`
- [ ] No se modifica `applyTheme()`
- [ ] No se persisten temas automáticamente
- [ ] Logs solo en modo debug/development

---

**Última actualización**: 2024-12-19










