# Regla Constitucional: Theme Capability Registry

**Versión**: 1.0.0  
**Fecha**: 2025-01-XX  
**Estado**: Activa

---

## PRINCIPIO FUNDAMENTAL

> **No feature UI sin ThemeCapabilityRegistry**

No se puede crear una nueva feature UI que requiera estilos sin registrar primero una **ThemeCapability** en el registry.

---

## REGLA

**Cualquier feature UI que requiera tokens CSS debe:**

1. **Tener una ThemeCapability registrada** en `src/core/theme/capabilities/*.capability.js`
2. **Definir tokens** con `key`, `type`, `default`, `description`
3. **Incluir preview** (opcional pero recomendado)
4. **Versionar** la capability (`version: '1.0.0'`)

---

## EXCEPCIONES

Ninguna. Esta regla es absoluta.

**No hay excepciones para:**
- Features temporales
- Features experimentales
- Features internas
- Features legacy (deben migrarse)

---

## CONSECUENCIAS

Si una feature UI usa tokens CSS sin capability registrada:

- ❌ **No puede ser themeable** por usuarios
- ❌ **No aparece en Theme Studio**
- ❌ **No tiene preview en Mega Playground**
- ❌ **No puede validarse** contra el registry

---

## PROCESO

### 1. Crear Capability

```javascript
// src/core/theme/capabilities/mi-feature.capability.js
export default {
  capability_key: 'mi-feature',
  version: '1.0.0',
  category: 'widgets',
  name: 'Mi Feature',
  description: 'Descripción de mi feature',
  tokens: [
    {
      key: '--ap-mi-feature-bg',
      type: 'color',
      default: '#ffffff',
      description: 'Fondo de mi feature'
    }
  ],
  preview: null
};
```

### 2. Registrar en Index

```javascript
// src/core/theme/capabilities/index.js
import miFeature from './mi-feature.capability.js';

export const ALL_CAPABILITIES = [
  // ... otras capabilities
  miFeature
];
```

### 3. Usar en Feature

```javascript
// En tu feature UI
const style = {
  background: 'var(--ap-mi-feature-bg, #ffffff)'
};
```

---

## AUDITORÍA

El sistema valida automáticamente:

- ✅ Capabilities sin duplicados
- ✅ Tokens sin duplicados
- ✅ Tipos válidos
- ✅ Defaults definidos

Si falla: `THEME_CAPS_FAIL_HARD=1` detiene el servidor.

---

## REFERENCIAS

- `src/core/theme/theme-capability-registry-v2.js` - Registry
- `src/core/theme/capabilities/` - Carpeta de capabilities
- `docs/THEME_STUDIO_V_NEXT.md` - Documentación completa

---

**Última actualización**: 2025-01-XX

