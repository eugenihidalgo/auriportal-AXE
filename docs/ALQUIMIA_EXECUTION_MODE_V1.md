# ALQUIMIA EXECUTION MODE v1

## 📋 Resumen

Este documento describe el sistema de **execution_mode** en Alquimia, que permite diferenciar entre limpiezas idempotentes (APPLY) y certificaciones MASTER no idempotentes (CERTIFY).

---

## 🎯 Objetivo

Implementar una acción soberana del MASTER:

**"Marcar esto como hecho AHORA para todos, independientemente del estado previo."**

Esta acción:
- ✅ Cuenta siempre como ejecutada
- ✅ No omite nunca
- ✅ No genera errores por duplicados
- ✅ No rompe APPLY ni SHARED

---

## 🔧 Conceptos

### execution_mode

Parámetro opcional que indica el modo de ejecución de una limpieza.

**Valores permitidos:**
- `APPLY` → Limpieza normal (idempotente, comportamiento por defecto)
- `CERTIFY` → Certificación MASTER (no idempotente, siempre ejecuta)

**Por defecto:** `APPLY` (todo sigue funcionando igual sin cambios)

**Uso de CERTIFY:** Solo en acciones MASTER explícitas (botones "Marcar como hecho AHORA para todos")

---

## 📐 Semántica

### APPLY (Idempotente)

- **Comportamiento:** Limpieza normal con idempotencia
- **execution_key:** `{action_type}:{item_ref}:{student_uuid}:{date}` (basado en día)
- **Idempotencia:** Sí (mismo execution_key en el mismo día = no se ejecuta dos veces)
- **Estado previo:** Se considera (si ya está limpio, no se vuelve a limpiar)
- **Uso:** Todas las acciones normales (limpieza individual, automatizaciones, etc.)

### CERTIFY (No Idempotente)

- **Comportamiento:** Certificación MASTER que siempre ejecuta
- **execution_key:** `certify:{item_ref}:{student_uuid}:{timestamp}` (timestamp completo)
- **Idempotencia:** No (cada ejecución genera un execution_key único)
- **Estado previo:** No se considera (siempre se ejecuta, incluso si ya está limpio)
- **Uso:** Solo acciones MASTER explícitas:
  - Botón "Marcar como hecho AHORA para todos" (mark-clean-all)
  - Botón PDE Clean (mark-pde-clean-all)

---

## 🔍 Ejemplos

### Ejemplo 1: APPLY (Idempotente)

```javascript
// Primera ejecución
await markCleanAllStudents({
  item_ref: 'item-123',
  execution_mode: 'APPLY', // o se omite (default)
  // ...
});
// Resultado: updated=10, skipped=0

// Segunda ejecución (mismo día)
await markCleanAllStudents({
  item_ref: 'item-123',
  execution_mode: 'APPLY',
  // ...
});
// Resultado: updated=0, skipped=10 (idempotencia: ya estaba limpio)
```

### Ejemplo 2: CERTIFY (No Idempotente)

```javascript
// Primera ejecución
await markCleanAllStudents({
  item_ref: 'item-123',
  execution_mode: 'CERTIFY',
  // ...
});
// Resultado: updated=10, skipped=0

// Segunda ejecución (mismo día, inmediatamente después)
await markCleanAllStudents({
  item_ref: 'item-123',
  execution_mode: 'CERTIFY',
  // ...
});
// Resultado: updated=10, skipped=0 (CERTIFY siempre ejecuta)
```

---

## 🏗️ Arquitectura

### Backend - Cleaning Engine Service

**Archivo:** `src/core/master/services/cleaning-engine-service.js`

**Función `generateExecutionKey`:**
```javascript
function generateExecutionKey(actionType, itemRef, studentUuid, timestamp = new Date(), executionMode = 'APPLY') {
  if (executionMode === 'CERTIFY') {
    // CERTIFY: usar timestamp completo para garantizar unicidad
    const timestampStr = timestamp.toISOString().replace(/[:.]/g, '-');
    return `certify:${itemRef}:${studentUuid}:${timestampStr}`;
  }
  // APPLY: usar día para idempotencia
  const day = timestamp.toISOString().split('T')[0];
  return `${actionType}:${itemRef}:${studentUuid}:${day}`;
}
```

**Función `markCleanStudent`:**
- Acepta `execution_mode?: 'APPLY' | 'CERTIFY'` (opcional, default: 'APPLY')
- Genera execution_key según el modo
- En CERTIFY, NO retorna early por idempotencia (siempre ejecuta)

**Función `markCleanAllStudents`:**
- Acepta `execution_mode?: 'APPLY' | 'CERTIFY'` (opcional, default: 'APPLY')
- Pasa execution_mode a markCleanStudent para cada estudiante

### Servicios - Alquimia General Service

**Archivo:** `src/services/alquimia-general-service.js`

**Función `markCleanAll`:**
- Acepta `executionMode = 'APPLY'` (opcional, default: 'APPLY')
- Valida execution_mode
- Pasa execution_mode al Cleaning Engine

**Función `markPdeCleanAll`:**
- Acepta `executionMode = 'APPLY'` (opcional, default: 'APPLY')
- Valida execution_mode
- Pasa execution_mode al Cleaning Engine

### API MASTER

**Archivo:** `src/endpoints/master-api-alquimia-general.js`

**Endpoint `POST /master/api/alquimia-general/items/:item_ref/master/mark-clean-all`:**
- Lee `execution_mode` del body (opcional, default: 'APPLY')
- Valida execution_mode
- Pasa execution_mode al servicio

**Endpoint `POST /master/api/alquimia-general/items/:item_ref/master/mark-pde-clean-all`:**
- Lee `execution_mode` del body (opcional, default: 'APPLY')
- Valida execution_mode
- Pasa execution_mode al servicio

### Frontend

**Archivo:** `public/js/master/master-alquimia-general-client.js`

**Función `handleLimpiarItem`:**
- Envía `execution_mode: 'CERTIFY'` en el body

**Función `handlePdeCleanAll`:**
- Envía `execution_mode: 'CERTIFY'` en el body

---

## 🔒 Reglas Constitucionales

### ✅ OBLIGATORIO

1. **Por defecto APPLY:** Todo sigue siendo APPLY si no se especifica execution_mode
2. **CERTIFY solo en acciones MASTER explícitas:** Botones "Marcar como hecho AHORA para todos"
3. **Validación obligatoria:** execution_mode debe ser 'APPLY' o 'CERTIFY'
4. **No cambiar APPLY:** El comportamiento de APPLY NO debe modificarse
5. **Auditoría perfecta:** CERTIFY genera execution_key único siempre (timestamp completo)

### ❌ PROHIBIDO

1. **No eliminar CERTIFY:** CERTIFY es un concepto permanente
2. **No convertir CERTIFY en APPLY:** Son modos distintos con semántica distinta
3. **No añadir flags alternativos:** Solo APPLY y CERTIFY son válidos
4. **No inferir execution_mode:** Debe ser explícito en el payload
5. **No cambiar constraints existentes:** ON CONFLICT se mantiene en el repositorio

---

## 🧪 Testing

### Verificaciones Obligatorias

1. ✅ **SHARED sigue funcionando igual:** Limpieza individual sigue siendo idempotente
2. ✅ **Limpieza individual sigue funcionando igual:** markCleanStudent con APPLY funciona igual
3. ✅ **CERTIFY nunca devuelve "omitidos":** skipped siempre debe ser 0 en CERTIFY
4. ✅ **Repetir CERTIFY varias veces no falla:** Puede ejecutarse múltiples veces sin errores
5. ✅ **Logs limpios:** No hay errores ni warnings relacionados con execution_mode

### Casos de Prueba

**Caso 1: APPLY idempotencia**
- Ejecutar mark-clean-all dos veces (mismo día)
- Primera vez: updated > 0
- Segunda vez: updated = 0, skipped > 0

**Caso 2: CERTIFY siempre ejecuta**
- Ejecutar mark-clean-all con CERTIFY dos veces
- Primera vez: updated > 0, skipped = 0
- Segunda vez: updated > 0, skipped = 0

**Caso 3: PDE Clean con CERTIFY**
- Ejecutar mark-pde-clean-all con CERTIFY
- Verificar que siempre ejecuta (no omite)

---

## 📚 Referencias

- **Cleaning Engine Service:** `src/core/master/services/cleaning-engine-service.js`
- **Alquimia General Service:** `src/services/alquimia-general-service.js`
- **API MASTER:** `src/endpoints/master-api-alquimia-general.js`
- **Frontend:** `public/js/master/master-alquimia-general-client.js`
- **Repositorio Cleaning Events:** `src/infra/repos/cleaning/cleaning-events-repo-pg.js`
- **Documentación Alquimia:** `docs/ALQUIMIA_CANONICA_V1.md`

---

## 🔄 Versión

**v1.0.0** - 2025-01-13

- Implementación inicial de execution_mode
- Soporte para APPLY (idempotente) y CERTIFY (no idempotente)
- Integración en Cleaning Engine, Servicios, API y Frontend
