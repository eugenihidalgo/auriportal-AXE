# Client Content Builder - Base para Editor Diario

## Estado

**NO ACTIVO** - Preparado para futuro uso.

Este módulo está preparado para el futuro editor diario de pantallas, pero **NO se usa en runtime** salvo detrás de feature flag `CLIENT_BUILDER_V1='off'` (por defecto).

## Estructura

```
src/core/client-content/
├── README.md           # Este archivo
├── templates.js        # Plantillas de pantallas (futuro)
├── flows.js            # Definiciones de flujos (futuro)
└── builder.js          # Builder de pantallas (futuro)
```

## Contrato

El sistema está diseñado para:

1. **Screen Templates**: Plantillas de pantallas almacenables en JSON
2. **Flow Definitions**: Definiciones de flujos de usuario en JSON
3. **Builder API**: Endpoints admin READ-ONLY o prototipo para editar pantallas/workflows

## Uso Futuro

Cuando se active el editor:

1. Las pantallas se construirán desde templates JSON
2. Los flujos se definirán en flows JSON
3. El builder permitirá editar sin tocar HTML directamente

## Feature Flag

```javascript
// En código
if (process.env.CLIENT_BUILDER_V1 === 'on') {
  // Usar builder
} else {
  // Usar HTML tradicional
}
```

Por defecto: `CLIENT_BUILDER_V1='off'`







