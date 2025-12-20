# Auditoría de Hardcodes CSS → Tokens (Tarea Futura)

## Objetivo

Identificar y reemplazar valores CSS hardcodeados en templates HTML y archivos CSS por tokens del Theme Contract v1.

## Alcance

- Templates HTML en `src/core/html/*.html`
- Archivos CSS en `public/css/*.css`
- JavaScript inline que use colores/fuentes hardcodeados

## Método

1. Buscar valores hardcodeados (hex, rgb, rgba, nombres de color)
2. Mapear a tokens del contrato apropiados
3. Reemplazar por `var(--token-name)`
4. Validar que el tema funciona correctamente después del cambio

## Prioridad

- **Alta**: Colores de fondo y texto principales
- **Media**: Bordes, sombras, gradientes
- **Baja**: Valores que ya funcionan bien

## Estado

**PENDIENTE** - Esta tarea se realizará después de que el sistema de materialización canónica esté completamente implementado y probado.

---

**Nota**: Este documento es un placeholder para la tarea de auditoría futura.




