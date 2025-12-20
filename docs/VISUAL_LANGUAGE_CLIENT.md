# LVCC v1 - Lenguaje Visual Canónico del Cliente

## ¿Qué es LVCC v1?

LVCC v1 (Lenguaje Visual Canónico del Cliente) es un sistema de semántica visual que establece unidades canónicas para estructurar interfaces cliente en AuriPortal. No define estilos gráficos (colores, tamaños), sino **semántica de layout y jerarquía visual** para garantizar robustez y facilitar futuros editores/builders visuales.

## Unidades Visuales Canónicas

### `.container`

**Definición:** Contenedor principal canónico que envuelve toda la pantalla.

**DO:**
- Usar una sola vez por pantalla como wrapper principal
- Aplicar max-width y centrado cuando corresponda

**DON'T:**
- Anidar múltiples `.container` dentro de otros
- Usar para elementos internos (usar `.panel` o `.card`)

### `.panel`

**Definición:** Bloque de agrupación informativa (instrucciones, resúmenes, estados).

**DO:**
- Agrupar información relacionada (resúmenes de tiempo, instrucciones, estados)
- Combinar con clases legacy existentes (ej: `elementos-container panel`)

**DON'T:**
- Usar para entidades con identidad propia (usar `.card`)
- Usar para contenido interno de otra unidad (usar `.content-block`)

### `.card`

**Definición:** Entidad con identidad propia que representa un objeto de dominio (preparación, elemento de práctica, técnica).

**DO:**
- Marcar elementos que son entidades independientes
- Combinar con clases legacy existentes (ej: `elemento-practica card`)

**DON'T:**
- Usar para agrupaciones informativas (usar `.panel`)
- Usar para bloques internos de contenido (usar `.content-block`)

### `.content-block`

**Definición:** Bloque interno de contenido dentro de otra unidad (texto, vídeo, reloj, componentes).

**DO:**
- Marcar contenido interno dentro de `.card` o `.panel`
- Usar para componentes embebidos (reloj, vídeo, texto)

**DON'T:**
- Usar como contenedor principal (usar `.container`)
- Usar para entidades completas (usar `.card`)

### `.action-primary`

**Definición:** Acción principal única de la pantalla (botón de continuar, acción principal del flujo).

**DO:**
- Usar una sola vez por pantalla
- Marcar el botón/acción que representa el siguiente paso principal

**DON'T:**
- Usar múltiples `.action-primary` en la misma pantalla
- Usar para acciones secundarias o de navegación

## Reglas Globales

1. **Solo una `.action-primary` por pantalla:** Garantiza jerarquía visual clara.

2. **Las clases canónicas se AÑADEN sin borrar clases legacy:** Las clases LVCC complementan las existentes, no las reemplazan. Ejemplo: `class="elementos-container panel"`.

3. **No inline styles nuevos:** Los estilos visuales deben venir del Theme Contract (variables CSS) o clases CSS existentes.

4. **No hardcodes:** Apoyarse en el Theme Contract (`--bg-card`, `--text-primary`, etc.) para todos los valores visuales.

## Ejemplo Real

Snippet de `src/core/html/practicas/ejecucion.html`:

```html
<!-- LVCC v1: Contenedor principal canónico -->
<div class="container">
  <!-- LVCC v1: Panel - Bloque de agrupación informativa -->
  <div class="elementos-container panel">
    <!-- LVCC v1: Card - Entidad con identidad propia -->
    <div class="elemento-practica card">
      <!-- LVCC v1: Content-block - Bloque interno de contenido -->
      <div class="elemento-contenido content-block">...</div>
    </div>
  </div>
  
  <!-- LVCC v1: Action-primary - Acción principal única -->
  <a href="/limpieza" class="boton-continuar action-primary">Continuar →</a>
</div>
```

**Lectura del snippet:** El `.container` envuelve toda la pantalla. Dentro, un `.panel` agrupa los elementos de práctica. Cada elemento es una `.card` (entidad independiente) que contiene `.content-block` para su contenido interno. Al final, una sola `.action-primary` marca la acción principal. Las clases legacy (`elementos-container`, `elemento-practica`, `boton-continuar`) se mantienen para compatibilidad.

## Nota de Compatibilidad

LVCC v1 es **puramente semántico visual** y no afecta la lógica ni el backend. Las clases canónicas se añaden junto a las clases legacy existentes, garantizando compatibilidad total. Este sistema establece una base sólida para futuros editores/builders visuales que puedan interpretar la estructura semántica sin depender de nombres de clases específicos del dominio.










