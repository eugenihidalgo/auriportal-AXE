# 📊 Flujo de Niveles - ClickUp como Fuente de Verdad

## 🎯 Principio Fundamental

**ClickUp es la ÚNICA fuente de verdad para el nivel de los estudiantes.**

SQL es solo un **caché** que se sincroniza desde ClickUp para lecturas rápidas.

---

## 🔄 Flujo de Sincronización

### 1. **Lectura del Nivel (Mostrar al Usuario)**

```
Usuario → Cookie → findStudentByEmail(env, email) → ClickUp API → normalizeStudent() → getNivelInfo()
```

**Archivos involucrados:**
- `src/modules/student.js`: `findStudentByEmail()` obtiene datos de ClickUp
- `src/modules/nivel.js`: `getNivelInfo()` usa el nivel del objeto student (que viene de ClickUp)

**Regla:** Siempre obtener el estudiante desde ClickUp usando `findStudentByEmail()` o `getOrCreateStudent()`. Nunca leer el nivel directamente desde SQL.

---

### 2. **Actualización Automática del Nivel**

```
actualizarNivelSiNecesario() → Calcular nivel automático → Comparar con ClickUp → Actualizar ClickUp → Sincronizar SQL
```

**Archivo:** `src/modules/nivel.js`

**Reglas:**
- Solo actualiza ClickUp si el nivel automático es **MAYOR** que el actual
- Respeta cambios manuales en ClickUp (si alguien bajó el nivel manualmente, no lo sobrescribe)
- NO actualiza si la suscripción está pausada
- Después de actualizar ClickUp, sincroniza SQL como caché

**Ejemplo:**
```javascript
// ClickUp tiene nivel 5 (manual)
// Nivel automático calculado: 3
// Resultado: NO actualiza (respeta el cambio manual)

// ClickUp tiene nivel 3
// Nivel automático calculado: 5
// Resultado: Actualiza ClickUp a 5, luego sincroniza SQL
```

---

### 3. **Sincronización ClickUp → SQL**

**Archivo:** `src/endpoints/sync-clickup-sql.js` - Función `sincronizarClickUpASQL()`

**Reglas:**
- Lee el nivel desde ClickUp
- Actualiza SQL solo si el nivel cambió
- **NUNCA** calcula el nivel automático aquí (usa el de ClickUp)

**Flujo:**
```
ClickUp → Extraer nivel → Comparar con SQL → Actualizar SQL si diferente
```

---

### 4. **Sincronización SQL → ClickUp**

**Archivo:** `src/endpoints/sync-clickup-sql.js` - Función `sincronizarSQLAClickUp()`

**Reglas:**
- Solo sincroniza SQL → ClickUp si el nivel en SQL es **MAYOR** que en ClickUp
- Esto evita sobrescribir cambios manuales en ClickUp
- Si ClickUp tiene nivel 5 y SQL tiene nivel 3, NO actualiza ClickUp

**Flujo:**
```
SQL → Comparar con ClickUp → Solo actualizar si SQL > ClickUp
```

---

### 5. **Sincronización de Lista Principal**

**Archivo:** `src/services/clickup-sync-listas.js` - Función `sincronizarListaPrincipalAurelin()`

**Reglas:**
- Calcula el nivel automático basado en fecha de inscripción
- Solo actualiza ClickUp si:
  - No existe nivel actual (null/undefined)
  - El nivel calculado es **MAYOR** que el actual
- **NO** sobrescribe niveles manuales (si el nivel actual es mayor que el calculado, lo respeta)

**Ejemplo:**
```javascript
// ClickUp tiene nivel 8 (manual)
// Nivel calculado: 5
// Resultado: Mantiene nivel 8 (respeta cambio manual)
```

---

### 6. **Webhook Typeform (Creación de Estudiante)**

**Archivo:** `src/endpoints/typeform-webhook.js`

**Reglas:**
- Calcula el nivel automático basado en fecha de inscripción
- Guarda el nivel en **ClickUp PRIMERO**
- Luego sincroniza SQL con el nivel de ClickUp

**Flujo:**
```
Typeform → Calcular nivel → Crear/Actualizar ClickUp → Sincronizar SQL
```

---

## ⚠️ Reglas Críticas

### ✅ HACER

1. **Siempre obtener el estudiante desde ClickUp** usando `findStudentByEmail()` o `getOrCreateStudent()`
2. **Usar el nivel del objeto student** que viene de ClickUp (normalizado por `normalizeStudent()`)
3. **Sincronizar ClickUp → SQL** cuando se actualiza el nivel en ClickUp
4. **Respeta cambios manuales** en ClickUp (nunca sobrescribir si el nivel actual es mayor que el calculado)

### ❌ NO HACER

1. **NO leer el nivel directamente desde SQL** para mostrar al usuario
2. **NO calcular el nivel automático** en `sincronizarClickUpASQL()` (usar el de ClickUp)
3. **NO sobrescribir niveles manuales** en ClickUp con cálculos automáticos
4. **NO actualizar ClickUp desde SQL** si el nivel en SQL es menor que en ClickUp

---

## 📝 Archivos Clave

| Archivo | Función | Responsabilidad |
|---------|---------|-----------------|
| `src/modules/student.js` | `findStudentByEmail()` | Obtener estudiante desde ClickUp |
| `src/modules/nivel.js` | `getNivelInfo()` | Obtener información del nivel (usa nivel de ClickUp) |
| `src/modules/nivel.js` | `actualizarNivelSiNecesario()` | Actualizar nivel en ClickUp si es necesario |
| `src/endpoints/sync-clickup-sql.js` | `sincronizarClickUpASQL()` | Sincronizar nivel desde ClickUp a SQL |
| `src/endpoints/sync-clickup-sql.js` | `sincronizarSQLAClickUp()` | Sincronizar nivel desde SQL a ClickUp (solo si mayor) |
| `src/services/clickup-sync-listas.js` | `sincronizarListaPrincipalAurelin()` | Sincronizar lista principal (respeta niveles manuales) |
| `src/endpoints/typeform-webhook.js` | `typeformWebhookHandler()` | Crear estudiante con nivel inicial |

---

## 🔍 Verificación

Para verificar que el flujo funciona correctamente:

1. **Verificar que el nivel se lee desde ClickUp:**
   ```javascript
   // ✅ CORRECTO
   const student = await findStudentByEmail(env, email);
   const nivelInfo = getNivelInfo(student); // Usa student.nivel que viene de ClickUp
   
   // ❌ INCORRECTO
   const studentSQL = students.findByEmail(email);
   const nivel = studentSQL.nivel; // NO usar directamente desde SQL
   ```

2. **Verificar que las actualizaciones van a ClickUp primero:**
   ```javascript
   // ✅ CORRECTO
   await clickup.updateCustomFields(env, student.id, [
     { id: CLICKUP.CF_NIVEL_AURELIN, value: nuevoNivel }
   ]);
   // Luego sincronizar SQL
   
   // ❌ INCORRECTO
   db.prepare('UPDATE students SET nivel = ?').run(nuevoNivel);
   // Sin actualizar ClickUp primero
   ```

---

## 📌 Resumen

**ClickUp = Fuente de Verdad**  
**SQL = Caché (solo lectura rápida)**

Todas las operaciones de lectura y escritura del nivel deben pasar por ClickUp. SQL se sincroniza automáticamente como caché para mejorar el rendimiento.

