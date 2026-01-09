# MASTER ALQUIMIA ALUMNO UNA_VEZ UI v1
**AuriPortal / Aurelín — Dominio MASTER**  
**Fecha:** 2026-01-08  
**Estado:** CANÓNICO

---

## RESUMEN

UI canónica para visualización y acción de items `tipo='una_vez'` en Alquimia del Alumno.

---

## COMPONENTES UI

### 1. Render de Item

**Ubicación:** `public/js/master/master-alquimia-alumno-client.js`

**Función:** `renderItem(item, isReviewed = false)`

#### Metadata Mostrada

Para items `una_vez`:
- **Nombre:** `item.item_nombre`
- **Descripción:** `item.item_descripcion` (si existe)
- **Nivel:** `item.item_nivel`
- **Progreso:** `item.progress_realizadas / item.progress_requeridas` (formato: "X / Y")
- **Marca visual:** Si `realizadas > 0`, mostrar "✓ Trabajado" (sin ocultar)

Para items recurrentes:
- **Nombre:** `item.item_nombre`
- **Descripción:** `item.item_descripcion` (si existe)
- **Nivel:** `item.item_nivel`
- **Recurrencia:** `Cada ${item.item_frecuencia_dias} días`

---

### 2. Botón Limpiar

**Comportamiento:**

Para items `una_vez`:
- **Visible:** SIEMPRE (incluso si está trabajado)
- **Texto:** "Limpiar"
- **Tooltip:** `Progreso: X / Y`
- **Confirmación:** `¿Limpiar "{nombre}"? (Progreso: X / Y)`

Para items recurrentes:
- **Visible:** Solo si `item.state !== 'reviewed'`
- **Texto:** "Marcar como revisado"
- **Tooltip:** `Limpiar item (SHARED) - acción inmediata`
- **Confirmación:** `¿Marcar "{nombre}" como revisado?`

**Código:**
```javascript
const shouldShowCleanButton = item.lista_tipo === 'una_vez' || item.state !== 'reviewed';

if (shouldShowCleanButton) {
  const cleanBtn = document.createElement('button');
  // ... renderizar botón
}
```

---

### 3. Botón Historial

**Comportamiento:**
- **Visible:** SIEMPRE (para todos los items)
- **Texto:** "Historial"
- **Tooltip:** `Ver historial completo de limpiezas`
- **Acción:** Abre modal con dos paneles (técnico colapsado + humano visible)

---

### 4. Agrupación por Estado

Los items `una_vez` se agrupan igual que los recurrentes:
- `never`: Nunca trabajado
- `pending`: Parcialmente trabajado
- `reviewed_by_student`: Completado por alumno
- `reviewed_by_master`: Completado por master

---

## FLUJO DE USUARIO

### Limpiar Item una_vez

1. Usuario ve item `una_vez` con progreso "0 / 1" (ejemplo)
2. Usuario hace clic en "Limpiar"
3. Confirmación: "¿Limpiar 'Nombre del item'? (Progreso: 0 / 1)"
4. Usuario confirma
5. Backend ejecuta limpieza:
   - Incrementa `clean_count`
   - Decrementa `remaining`
   - Recalcula `completed`
6. UI refresca megalist:
   - Progreso actualizado: "1 / 1"
   - Marca visual "✓ Trabajado" aparece
   - Botón "Limpiar" sigue visible (permite múltiples limpiezas)

---

## ESTADOS VISUALES

### Item nunca trabajado
- Progreso: "0 / Y"
- Sin marca visual
- Botón "Limpiar" visible

### Item parcialmente trabajado
- Progreso: "X / Y" (donde X < Y)
- Marca visual "✓ Trabajado" visible
- Botón "Limpiar" visible

### Item completado
- Progreso: "Y / Y" (donde X = Y)
- Marca visual "✓ Trabajado" visible
- Botón "Limpiar" visible (permite más limpiezas)

---

## DATOS REQUERIDOS

El servicio megalist debe proporcionar:
```javascript
{
  item_nombre: string,
  item_descripcion: string | null,
  item_nivel: number | null,
  lista_tipo: 'una_vez' | 'recurrente',
  progress_realizadas: number | null,  // Para una_vez
  progress_requeridas: number | null,  // Para una_vez
  state: 'never' | 'pending' | 'reviewed',
  // ... otros campos
}
```

---

## REFERENCIAS

- Constitución: `docs/CONSTITUTION_ALQUIMIA_UNA_VEZ_V1.md`
- Engine: `docs/MASTER_ALQUIMIA_UNA_VEZ_ENGINE_V1.md`
- UI: `public/js/master/master-alquimia-alumno-client.js`

---

**FIN DEL DOCUMENTO**
