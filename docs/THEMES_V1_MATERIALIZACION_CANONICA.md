# Theme Materialización Canónica v1.0

## Decisión Arquitectónica

**Un tema solo existe si sus tokens se materializan como CSS variables dinámicas en SSR.**

## Principio Fundamental

El sistema de temas v1.0 se basa en la materialización canónica de tokens CSS en tiempo de renderizado (SSR). Un tema no es solo datos almacenados; es la aplicación efectiva de variables CSS en el HTML servido al cliente.

## Forma Canónica: `<style id="ap-theme-tokens">`

La forma canónica de materializar un tema es mediante un tag `<style>` con identificador único:

```html
<style id="ap-theme-tokens" data-theme-id="dark-classic" data-theme-version="1">
:root {
  --bg-main: #0a0e1a;
  --text-primary: #f1f5f9;
  /* ... todas las 102 variables del contrato ... */
}
</style>
```

Este tag:
- Debe estar en `<head>` para evitar FOUC (Flash of Unstyled Content)
- Tiene `id="ap-theme-tokens"` para identificarlo unívocamente
- Incluye `data-theme-id` y `data-theme-version` para trazabilidad
- Contiene TODAS las variables del Theme Contract v1 (102 variables)

## Pipeline Unificado: Preview == Producción

**Preview y Producción usan EXACTAMENTE el mismo pipeline de materialización.**

- **Preview**: Usa `applyTheme()` con `theme_id` explícito → materializa tokens dinámicos
- **Producción**: Usa `applyTheme()` con `student` → materializa tokens dinámicos

No hay hacks, no hay rutas especiales. La misma función, el mismo comportamiento.

## Resolver como Fuente de Verdad

- **Theme Resolver v1** (`theme-resolver.js`) resuelve el tema efectivo desde múltiples fuentes
- El resolver devuelve un objeto con todos los tokens del contrato (102 variables)
- Si faltan tokens, se rellenan desde `CONTRACT_DEFAULT` (fail-open)
- El resolver es la única fuente de verdad para qué tema usar

## Tema Solo como Datos

- Los temas se almacenan en BD (`themes`, `theme_drafts`, `theme_versions`)
- Un tema guardado NO afecta al runtime hasta que se publica
- Los drafts son solo datos; no se usan en runtime real
- Solo las versiones publicadas se aplican en producción

## Runtime Solo Materializa

- El runtime NO modifica temas
- El runtime NO crea temas
- El runtime SOLO materializa tokens → CSS variables usando el resolver

## Draft vs Published

- **Draft**: Se puede editar libremente, se usa solo en preview
- **Published**: Versión inmutable que se aplica en runtime real
- El draft nunca afecta a usuarios reales
- Solo published se usa en producción

## Legacy `theme_definitions`

La tabla `theme_definitions` se considera **fósil**:
- NO se usa por el runtime v1
- Solo lectura para migración futura
- NO se debe borrar aún (mantener por compatibilidad)
- La fuente de verdad es el nuevo sistema (`themes` + `theme_drafts` + `theme_versions`)

## Compatibilidad Legacy

El sistema mantiene compatibilidad con:
- `data-theme="dark/light"` (mapeado a temas del sistema)
- Clases CSS `theme-dark` (para compatibilidad)
- Pero la fuente de verdad son los tokens CSS dinámicos

## Fail-Open Absoluto

Si TODO falla (resolver, registry, BD):
- Se usa `CONTRACT_DEFAULT` (valores seguros)
- El cliente NUNCA se rompe
- Se logean warnings pero no se bloquea el renderizado

---

**Fecha de decisión**: v5.10.0-themes-live-preview  
**Estado**: Implementado  
**Versión del contrato**: v1 (102 variables)











