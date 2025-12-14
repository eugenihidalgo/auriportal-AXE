# 📋 Plan Completo de Sincronización ClickUp ↔ Servidor

## 🎯 Objetivos

1. **Sincronización masiva diaria** de Kajabi → SQL
2. **Sincronización individual** cuando alguien entra (ya funciona)
3. **Arreglar Lista 1 (901214540219)**: Añadir fecha inscripción y nivel
4. **Arreglar Lista 2 (901214375878)**: Sincronización completa en tiempo real
5. **Sincronización bidireccional** ClickUp ↔ Servidor

---

## 📊 Situación Actual

### **Lista 1: Importación Kajabi (901214540219)**
- ✅ **Funciona**: Se crean tareas con contactos de Kajabi que tienen "Mundo de Luz"
- ❌ **Falta**: 
  - Fecha inscripción PDE (campo: `991fdc37-ef8e-4aea-af42-81ddc495e176`)
  - Nivel Auri (campo: `a92e6b73-ea95-4b50-ae46-ec8290f99cd3`)

### **Lista 2: Lista Principal Aurelín (901214375878)**
- ❌ **NO funciona bien**: Esta es la lista operacional
- ❌ **Falta**:
  - Nombre desde Lista 1 (sincronizar por email)
  - Nivel (campo: `a92e6b73-ea95-4b50-ae46-ec8290f99cd3`) - numérico
  - Fecha última práctica (campo: `53fd4a14-da9c-4a75-a310-704bcf7dc262`) - cada día
  - Fecha inscripción PDE (campo: `991fdc37-ef8e-4aea-af42-81ddc495e176`)
  - Sincronización en tiempo real con servidor

---

## 🔄 Plan de Implementación

### **FASE 1: Sincronización Masiva Diaria**

#### **1.1. Crear Cron Job**
- Configurar cron job para ejecutar `/sync-kajabi-all` cada día a las 3 AM
- Guardar logs de ejecución

#### **1.2. Mantener Sincronización Individual**
- Ya funciona en `enter.js` cuando alguien entra
- No cambiar nada, solo asegurar que sigue funcionando

---

### **FASE 2: Arreglar Lista 1 (Importación Kajabi)**

#### **2.1. Modificar `import-kajabi.js`**
- Al crear tarea en Lista 1, añadir:
  - **Fecha inscripción PDE**: Desde `fechaCompraMundoDeLuz` de Kajabi
  - **Nivel Auri**: Calcular basado en fecha inscripción usando `calcularNivelAutomatico()`

#### **2.2. Actualizar Campos Personalizados**
- Usar campos:
  - `991fdc37-ef8e-4aea-af42-81ddc495e176` (Fecha inscripción PDE) - formato timestamp
  - `a92e6b73-ea95-4b50-ae46-ec8290f99cd3` (Nivel Auri) - formato numérico

---

### **FASE 3: Arreglar Lista 2 (Lista Principal Aurelín)**

#### **3.1. Crear Nueva Función de Sincronización**
- **Función**: `sincronizarListaPrincipalAurelin(email, env)`
- **Qué hace**:
  1. Busca tarea en Lista 2 por email
  2. Si no existe, la crea
  3. Sincroniza desde múltiples fuentes:
     - **Nombre**: Desde Lista 1 (buscar por email)
     - **Email**: Mantener
     - **Nivel**: Calcular desde fecha inscripción
     - **Fecha inscripción PDE**: Desde Lista 1 o Kajabi
     - **Fecha última práctica**: Desde ClickUp (se actualiza cuando practica)
     - **Apodo**: Desde ClickUp (se actualiza desde Typeform)

#### **3.2. Sincronización en Tiempo Real**
- **Cuando alguien entra** (`enter.js`):
  - Sincronizar Lista 2 después de actualizar racha
  - Asegurar que nivel, fecha inscripción y nombre estén actualizados

- **Cuando alguien practica** (`streak.js`):
  - Ya actualiza `CF_LAST_PRACTICE_DATE` en Lista 2
  - Asegurar que también sincronice nivel si cambió

#### **3.3. Sincronización Bidireccional**
- **ClickUp → Servidor**: 
  - Leer cambios manuales del pedagogo (nivel, apodo, etc.)
  - Actualizar base de datos SQL local
  
- **Servidor → ClickUp**:
  - Actualizar nivel automático (si es mayor)
  - Actualizar fecha última práctica
  - Actualizar fecha inscripción (si cambió en Kajabi)

---

### **FASE 4: Mejorar Sincronización Existente**

#### **4.1. Modificar `kajabi-sync.js`**
- Asegurar que sincroniza a **Lista 2** (no solo Lista 1)
- Añadir sincronización de nivel
- Añadir sincronización de fecha inscripción

#### **4.2. Modificar `sync-all.js`**
- Sincronizar **ambas listas**:
  - Lista 1: Actualizar fecha inscripción y nivel
  - Lista 2: Sincronización completa

---

### **FASE 5: Panel de Control**

#### **5.1. Actualizar Panel Admin**
- Añadir botón: "Sincronizar Lista Principal Aurelín"
- Añadir estadísticas:
  - Contactos en Lista 1
  - Contactos en Lista 2
  - Contactos sin sincronizar
  - Última sincronización

---

## 🔧 Cambios Técnicos Detallados

### **1. Nuevo Servicio: `clickup-sync-listas.js`**

```javascript
// Funciones principales:
- sincronizarLista1(email, env) // Lista importación
- sincronizarLista2(email, env) // Lista principal
- sincronizarAmbasListas(email, env)
- obtenerNombreDesdeLista1(email, env)
- crearTareaEnLista2(email, env, datos)
- actualizarTareaEnLista2(taskId, env, datos)
```

### **2. Modificar `import-kajabi.js`**
- Añadir fecha inscripción al crear tarea
- Añadir nivel calculado al crear tarea

### **3. Modificar `enter.js`**
- Llamar a `sincronizarLista2()` después de actualizar racha
- Asegurar sincronización completa

### **4. Modificar `streak.js`**
- Ya actualiza `CF_LAST_PRACTICE_DATE` ✅
- Añadir verificación de nivel después de actualizar práctica

### **5. Modificar `nivel.js`**
- Asegurar que `actualizarNivelSiNecesario()` actualiza en **Lista 2**
- Verificar que respeta cambios manuales del pedagogo

### **6. Crear Cron Job**
```bash
# Añadir a crontab
0 3 * * * curl -X GET "https://controlauriportal.eugenihidalgo.work/sync-kajabi-all?password=kaketes7897" > /var/log/aurelinportal-sync.log 2>&1
```

---

## 📝 Campos ClickUp a Usar

### **Lista 1 (901214540219) - Importación**
- `991fdc37-ef8e-4aea-af42-81ddc495e176` - Fecha inscripción PDE (timestamp)
- `a92e6b73-ea95-4b50-ae46-ec8290f99cd3` - Nivel Auri (numérico)

### **Lista 2 (901214375878) - Principal**
- `becf7138-3276-4d69-b062-40eb98977d86` - Email
- `6534f362-f296-40d7-81d1-a8c1d4d68b40` - Apodo
- `991fdc37-ef8e-4aea-af42-81ddc495e176` - Fecha inscripción PDE (timestamp)
- `a92e6b73-ea95-4b50-ae46-ec8290f99cd3` - Nivel Auri (numérico)
- `53fd4a14-da9c-4a75-a310-704bcf7dc262` - Fecha última práctica (date)
- `c3460eaa-92e5-4106-bdc0-e62644d45b8f` - Racha general (numérico)

---

## ✅ Checklist de Implementación

### **Fase 1: Sincronización Diaria**
- [ ] Crear script de cron job
- [ ] Probar ejecución manual
- [ ] Configurar en crontab
- [ ] Verificar logs

### **Fase 2: Lista 1**
- [ ] Modificar `import-kajabi.js` para añadir fecha inscripción
- [ ] Modificar `import-kajabi.js` para añadir nivel
- [ ] Probar importación completa
- [ ] Verificar campos en ClickUp

### **Fase 3: Lista 2**
- [ ] Crear `clickup-sync-listas.js`
- [ ] Implementar `sincronizarLista2()`
- [ ] Integrar en `enter.js`
- [ ] Integrar en `streak.js`
- [ ] Probar sincronización completa
- [ ] Verificar sincronización bidireccional

### **Fase 4: Mejoras**
- [ ] Modificar `kajabi-sync.js` para Lista 2
- [ ] Modificar `sync-all.js` para ambas listas
- [ ] Probar sincronización masiva
- [ ] Verificar que respeta cambios manuales

### **Fase 5: Panel**
- [ ] Añadir botón sincronización Lista 2
- [ ] Añadir estadísticas
- [ ] Probar panel completo

---

## 🚀 Orden de Implementación

1. **Primero**: Arreglar Lista 1 (más simple)
2. **Segundo**: Crear sincronización Lista 2
3. **Tercero**: Integrar en flujo existente
4. **Cuarto**: Configurar cron job
5. **Quinto**: Actualizar panel

---

*Plan creado: $(date)*








