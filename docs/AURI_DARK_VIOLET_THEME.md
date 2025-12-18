# 🎨 Tema Oscuro Violeta - Auri Dark Violet

## 📋 Resumen

Tema oscuro ritual violeta diseñado intencionalmente como hermano del tema claro (`auri-classic`), usando el mismo **Theme Contract v1** pero con una atmósfera completamente diferente.

**Key:** `auri-dark-violet`  
**Nombre:** `Auri Dark Violet`  
**Source:** `custom`  
**Status:** `active`  
**Contract Version:** `v1`

---

## 🎯 Filosofía de Diseño

### Objetivo
Crear un tema oscuro que sea:
- **Ritual**: Sensación de espacio sagrado, protector
- **Nocturno**: Adecuado para uso en horas de oscuridad
- **Protector**: Ambiente que envuelve y protege
- **Alto contraste sin agresividad**: Legible pero suave

### Paleta de Colores

#### Fondos
- **Base profundo**: `#0d0b1a` - Azul/violeta muy oscuro, profundo
- **Paneles elevados**: `#151225` - Sutilmente más claro, con elevación
- **Cards**: `#1a1629` - Aún más elevado, con presencia
- **Cards activos**: `#211d35` - Más luminosos, destacados

#### Acentos
- **Violeta luminoso**: `#8b5cf6` - Principal, energético
- **Violeta suave**: `#a78bfa` - Secundario, complementario
- **Hover**: `#9d7af7` - Intermedio entre ambos

#### Textos
- **Principal**: `#f1f5f9` - Blanco suave, legible
- **Secundario**: `#cbd5e1` - Gris claro
- **Muted**: `#94a3b8` - Gris medio
- **Acento**: `#a78bfa` - Violeta suave
- **Racha**: `#8b5cf6` - Violeta luminoso

---

## 🔄 Relación con el Tema Claro

### Mismo Contrato, Distinta Atmósfera

| Aspecto | Tema Claro (`auri-classic`) | Tema Oscuro (`auri-dark-violet`) |
|---------|----------------------------|----------------------------------|
| **Fondo base** | `#faf7f2` (beige cálido) | `#0d0b1a` (azul/violeta profundo) |
| **Acento principal** | `#ffd86b` (dorado) | `#8b5cf6` (violeta luminoso) |
| **Atmósfera** | Cálida, diurna, energética | Ritual, nocturna, protectora |
| **Contraste** | Medio-alto | Alto (sin agresividad) |
| **Variables** | 66 (Theme Contract v1) | 66 (Theme Contract v1) |

### Garantías
- ✅ **Mismas variables**: Usa exactamente las mismas variables del contrato
- ✅ **Mismo significado semántico**: Cada variable mantiene su propósito
- ✅ **Validación completa**: Pasa `validateThemeValues()`
- ✅ **Fail-open**: Rellena faltantes desde `CONTRACT_DEFAULT` si es necesario

---

## 🎨 Características Visuales

### Gradientes
- **Botones principales**: `linear-gradient(135deg, #8b5cf6, #7c3aed)`
- **Aura**: `radial-gradient(circle, rgba(139, 92, 246, 0.2) 0%, rgba(124, 58, 237, 0.15) 40%, transparent 70%)`
- **Header**: `linear-gradient(135deg, #7c3aed, #6d28d9)`

### Sombras
- Profundas pero no agresivas
- Rangos: `rgba(0, 0, 0, 0.5)` a `rgba(0, 0, 0, 0.8)`

### Bordes
- Sutiles con acentos violeta
- Transparencias: `0.08` a `0.4`

---

## 📊 Validación

### Estado de Validación
- ✅ **Validación completa**: Todas las 66 variables presentes
- ✅ **Sin variables faltantes**: `validateThemeValues()` pasa
- ✅ **Sin variables inválidas**: Todos los valores son válidos
- ✅ **Relleno automático**: Si falta alguna, se rellena desde `CONTRACT_DEFAULT`

### Variables del Contrato
El tema incluye todas las variables del **Theme Contract v1**:
- Fondos principales (8)
- Fondos semánticos (5)
- Textos (8)
- Bordes (6)
- Acentos (7)
- Sombras (5)
- Gradientes (9)
- Badges y estados (6)
- Inputs (4)
- Botones (1)
- Radios (5)
- Compatibilidad (2)

**Total: 66 variables**

---

## 🗄️ Registro en Base de Datos

### Tabla: `theme_definitions`

```sql
SELECT * FROM theme_definitions WHERE key = 'auri-dark-violet';
```

**Campos:**
- `id`: ID único (auto-increment)
- `key`: `'auri-dark-violet'`
- `name`: `'Auri Dark Violet'`
- `description`: Descripción completa del tema
- `contract_version`: `'v1'`
- `values`: JSONB con todas las 66 variables CSS
- `source`: `'custom'`
- `meta`: Metadata con filosofía de diseño, paleta, atmósfera
- `status`: `'active'`
- `created_at`: Timestamp de creación
- `updated_at`: Timestamp de actualización

---

## 🎯 Uso en el Editor

### Disponibilidad
El tema aparece automáticamente en el editor de temas (`/admin/themes`) porque:
- ✅ Está registrado en `theme_definitions` con `status = 'active'`
- ✅ El endpoint `/admin/themes` usa `themeRepository.findAll()`
- ✅ No requiere cambios en `system-themes.js` (es tema custom)

### Preview
El tema puede previsualizarse usando el sistema de preview:
- **Pantalla 1**: `/admin/themes/preview?theme_id={id}&screen=pantalla1`
- **Ejecución**: `/admin/themes/preview?theme_id={id}&screen=ejecucion`
- **Limpieza Básica**: `/admin/themes/preview?theme_id={id}&screen=limpieza-basica`
- **Limpieza Profunda**: `/admin/themes/preview?theme_id={id}&screen=limpieza-profunda`

---

## 🔧 Script de Creación

### Ubicación
`scripts/create-dark-violet-theme.js`

### Uso
```bash
node scripts/create-dark-violet-theme.js
```

### Funcionalidad
1. Valida valores con `validateThemeValues()`
2. Rellena faltantes desde `CONTRACT_DEFAULT` si es necesario
3. Verifica si el tema ya existe (actualiza si existe)
4. Crea/actualiza el tema en la base de datos
5. Muestra confirmación con detalles

---

## 📝 Metadata

### Meta JSON
```json
{
  "designedBy": "Design System Lead",
  "designDate": "2025-12-16",
  "designPhilosophy": "Tema oscuro ritual violeta, hermano del tema claro, mismo contrato, distinta atmósfera",
  "colorPalette": {
    "base": "#0d0b1a",
    "panels": "#151225",
    "cards": "#1a1629",
    "accent": "#8b5cf6",
    "accentSecondary": "#a78bfa"
  },
  "atmosphere": "ritual, protector, nocturno",
  "contrast": "alto contraste sin agresividad"
}
```

---

## ✅ Checklist de Implementación

- [x] Diseñar valores del tema usando Theme Contract v1
- [x] Validar valores con `validateThemeValues()`
- [x] Rellenar faltantes desde `CONTRACT_DEFAULT` si es necesario
- [x] Registrar tema en BD usando `themeRepository.create()`
- [x] Verificar que aparece en el editor de temas
- [x] Probar preview en Pantalla 1 y Ejecución
- [x] Documentar filosofía de diseño
- [x] Confirmar que ambos temas conviven correctamente

---

## 🎉 Resultado

El tema **Auri Dark Violet** está completamente implementado y disponible en el editor de temas. Es un tema hermano del tema claro, usando el mismo contrato pero con una atmósfera completamente diferente: ritual, protectora y nocturna.

**Ambos temas conviven correctamente** y pueden ser seleccionados y previsualizados desde el editor de temas.

---

**Versión:** v1.0  
**Fecha:** 2025-12-16  
**Estado:** ✅ Completado y Activo




