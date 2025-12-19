# Screen Template: `screen_limpieza_energetica`

## Resumen

Pantalla núcleo de ejecución de la limpieza energética diaria. Este screen template es **puramente UI** y funciona como **consumidor de contexto**. No implementa lógica de motor.

## Características

- ✅ **Zona A**: Lista de ítems a limpiar con checkboxes
- ✅ **Zona B**: Sección colapsable de técnicas energéticas (opcional)
- ✅ **Validación**: Botón final habilitado solo cuando todos los obligatorios están marcados
- ✅ **Fail-open**: Nunca crashea, muestra mensajes claros si falta contexto
- ✅ **Capture**: Emite `limpieza_completed = true` al completar

## Contrato de Contexto

El screen espera encontrar en `context`:

```json
{
  "items_limpieza": [
    {
      "id": "string",
      "title": "string",
      "description": "string",
      "mandatory": boolean
    }
  ],
  "tecnicas_disponibles": [
    {
      "id": "string",
      "title": "string",
      "description": "string",
      "video_ref": "string"
    }
  ]
}
```

### Comportamiento

- Si `items_limpieza` no existe o está vacío → muestra mensaje de error visible
- Si `tecnicas_disponibles` no existe o está vacío → oculta sección completa
- Nunca crashea, nunca inventa datos

## Capture

El screen emite:

```json
{
  "limpieza_completed": true
}
```

Tipo: `boolean`, required: `true`

## Ejemplo de StepDefinition

```json
{
  "id": "limpieza_energetica",
  "screen_template_id": "screen_limpieza_energetica",
  "props": {
    "title": "Limpieza Energética Diaria",
    "description": "Realiza tu limpieza energética diaria siguiendo los ítems a continuación."
  },
  "capture": {
    "field": "limpieza_completed",
    "value_type": "boolean",
    "required": true
  }
}
```

## Flujo en el Recorrido

El step `limpieza_energetica` debe estar precedido por un step motor que genere el contexto:

```json
{
  "id": "motor_limpieza",
  "type": "motor",
  "motor_key": "limpieza_energetica",
  "motor_version": 1,
  "inputs": {
    "nivel": "context.nivel",
    "racha": "context.racha"
  }
}
```

Y seguido por una transición:

```json
{
  "from_step_id": "limpieza_energetica",
  "to_step_id": "transicion_racha",
  "condition": {
    "type": "capture_equals",
    "params": {
      "field": "limpieza_completed",
      "value": true
    }
  }
}
```

## Archivos Creados

1. **Registry**: `src/core/registry/screen-template-registry.js`
   - Añadido `screen_limpieza_energetica` con schema y capture

2. **HTML Template**: `src/core/html/screens/screen-limpieza-energetica.html`
   - Layout limpio sin sidebar
   - Zona A: Lista de ítems
   - Zona B: Técnicas colapsables
   - Botón final con validación

3. **JavaScript**: `public/js/screens/screen-limpieza-energetica.js`
   - Lógica de renderizado
   - Gestión de checkboxes (mandatory bloqueado)
   - Validación de obligatorios
   - Emisión de capture

## Checklist de Funcionalidad

- [x] Lista de ítems funcional
- [x] Mandatory respected (no se puede desmarcar)
- [x] Técnicas desplegables
- [x] Botón final con validación
- [x] Capture `limpieza_completed`
- [x] Avanza correctamente
- [x] Fail-open absoluto (no crashea)

## Notas Técnicas

- El screen **NO filtra** por nivel
- El screen **NO limita** cantidades
- El screen **NO decide** ítems
- El screen **NO toca** progreso, racha o eventos
- El screen **NO toca** temas

Todo esto es responsabilidad del **Motor PDE** que genera el contexto.



