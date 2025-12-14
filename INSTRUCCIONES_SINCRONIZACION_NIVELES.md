# 🔧 Instrucciones para Sincronizar Niveles en ClickUp

## ⚠️ Problema Identificado

Los niveles no se están sincronizando correctamente porque **falta la fecha de inscripción** en la Lista 1 (Importación Kajabi).

## ✅ Solución: Pasos a Seguir

### **Paso 1: Importar/Actualizar Lista 1 con Fechas de Inscripción**

La Lista 1 necesita tener las fechas de inscripción para poder calcular los niveles correctamente.

**Opción A: Desde el Panel de Control**
1. Ir a: `https://controlauriportal.eugenihidalgo.work/admin?password=kaketes7897`
2. Clic en: **"📥 Importar Kajabi → ClickUp"**
3. Esperar a que termine (puede tardar varios minutos)

**Opción B: Directamente**
```bash
curl -X GET "https://controlauriportal.eugenihidalgo.work/import-kajabi?password=kaketes7897"
```

### **Paso 2: Sincronizar Lista Principal**

Una vez que la Lista 1 tenga las fechas, sincronizar la Lista Principal:

**Opción A: Desde el Panel de Control**
1. Clic en: **"🔄 Sincronizar Lista Principal Aurelín"**
2. Esperar a que termine

**Opción B: Directamente**
```bash
curl -X GET "https://controlauriportal.eugenihidalgo.work/sync-lista-principal?password=kaketes7897"
```

### **Paso 3: Verificar Resultados**

1. **Ver logs en tiempo real:**
```bash
pm2 logs aurelinportal --lines 100
```

2. **Buscar en los logs:**
   - `📅 Fecha encontrada en Lista 1` - Confirma que se encontró la fecha
   - `📊 Nivel calculado = X` - Muestra el nivel calculado
   - `✅ Tarea actualizada` - Confirma que se actualizó

3. **Verificar en ClickUp:**
   - Lista 1 (901214540219): Debe tener fecha inscripción y nivel
   - Lista 2 (901214375878): Debe tener nivel calculado correctamente

## 🔍 Diagnóstico

Si los niveles siguen en 1, verificar:

1. **¿La Lista 1 tiene fechas de inscripción?**
   - Revisar en ClickUp si las tareas tienen el campo "Fecha inscripción PDE" lleno
   - Si no, ejecutar la importación de nuevo

2. **¿Se están encontrando las fechas en los logs?**
   - Buscar: `📅 Fecha encontrada en Lista 1`
   - Si no aparece, la Lista 1 no tiene fechas

3. **¿Kajabi está devolviendo fechas?**
   - Los logs mostrarán si hay errores de rate limiting
   - Si hay muchos errores 429, esperar y reintentar

## 📊 Orden de Prioridad para Fecha de Inscripción

El sistema busca la fecha en este orden:
1. **Lista 1** (Importación Kajabi) - Prioridad más alta
2. **Lista 2** (Principal Aurelín) - Si ya existe
3. **Student Module** (desde ClickUp) - Si está disponible
4. **Kajabi API** - Como último recurso

## 🚀 Ejecución Automática

Para ejecutar todo automáticamente:

```bash
# 1. Importar Kajabi (actualizar Lista 1)
curl -X GET "https://controlauriportal.eugenihidalgo.work/import-kajabi?password=kaketes7897"

# Esperar 2-3 minutos...

# 2. Sincronizar Lista Principal
curl -X GET "https://controlauriportal.eugenihidalgo.work/sync-lista-principal?password=kaketes7897"
```

## ⚙️ Mejoras Implementadas

1. ✅ **Búsqueda mejorada de fechas**: Ahora busca en múltiples fuentes
2. ✅ **Logging detallado**: Muestra exactamente dónde se encuentra cada fecha
3. ✅ **Actualización de nivel mejorada**: Actualiza incluso si el nivel actual es 0 o 1
4. ✅ **Fallback a múltiples fuentes**: Si no encuentra en Lista 1, busca en otras fuentes

---

*Última actualización: $(date)*








