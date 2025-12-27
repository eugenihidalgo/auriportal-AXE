# CHECKLIST: Mutación de Entidades Vivas
## Verificación Obligatoria para PRs y Cambios

**Referencia**: `CONTRATO_CANONICO_MUTACION_ENTIDADES_VIVAS.md`

---

## ✅ CHECKLIST OBLIGATORIA

### 1. Punto Canónico

- [ ] ¿La mutación pasa por `StudentMutationService`?
- [ ] ¿NO se muta directamente desde endpoint?
- [ ] ¿NO se muta directamente desde módulo de negocio?
- [ ] ¿NO se muta directamente desde repositorio?

**Si alguna respuesta es NO → VIOLACIÓN DEL CONTRATO**

---

### 2. Source of Truth

- [ ] ¿Escribe SOLO en PostgreSQL?
- [ ] ¿NO escribe en ClickUp como autoridad?
- [ ] ¿NO escribe en SQLite como autoridad?
- [ ] ¿NO escribe en Kajabi como autoridad?

**Si alguna respuesta es NO → VIOLACIÓN DEL CONTRATO**

---

### 3. Auditoría

- [ ] ¿Registra evento de auditoría?
- [ ] ¿El evento incluye `eventType` correcto?
- [ ] ¿El evento incluye `actorType` y `actorId`?
- [ ] ¿El evento incluye `estado_anterior` y `estado_nuevo`?
- [ ] ¿La auditoría es fail-open (no bloquea si falla)?

**Si alguna respuesta es NO → VIOLACIÓN DEL CONTRATO**

---

### 4. Señales

- [ ] ¿Prepara señal estructurada?
- [ ] ¿El `signalType` es correcto?
- [ ] ¿El `payload` incluye `old_value` y `new_value`?
- [ ] ¿NO se emite la señal durante la mutación?

**Si alguna respuesta es NO → VIOLACIÓN DEL CONTRATO**

---

### 5. Transacciones

- [ ] ¿Acepta parámetro `client` (opcional)?
- [ ] ¿Si se proporciona `client`, todas las operaciones lo usan?
- [ ] ¿Si no se proporciona, usa pool por defecto?

**Si alguna respuesta es NO → VIOLACIÓN DEL CONTRATO**

---

### 6. Separación de Responsabilidades

- [ ] ¿NO calcula valores (recibe valores ya calculados)?
- [ ] ¿NO decide políticas (la decisión se hace antes)?
- [ ] ¿NO ejecuta consecuencias (se ejecutan después)?
- [ ] ¿NO emite señales (solo prepara)?

**Si alguna respuesta es NO → VIOLACIÓN DEL CONTRATO**

---

### 7. Lectura de Estado Anterior

- [ ] ¿Lee estado anterior desde PostgreSQL?
- [ ] ¿Usa el estado anterior para auditoría?
- [ ] ¿Usa el estado anterior para preparar señal?

**Si alguna respuesta es NO → VIOLACIÓN DEL CONTRATO**

---

### 8. Documentación (Solo para nuevas mutaciones)

- [ ] ¿Se actualizó `CONTRATO_CANONICO_MUTACION_ENTIDADES_VIVAS.md`?
- [ ] ¿Se documentó la nueva mutación en la sección 9?
- [ ] ¿Se añadió método canónico en `StudentMutationService`?

**Si es nueva mutación y alguna respuesta es NO → INCOMPLETO**

---

### 9. Tests (Recomendado)

- [ ] ¿Se añadieron tests mínimos si se tocó mutación?
- [ ] ¿Los tests verifican auditoría?
- [ ] ¿Los tests verifican preparación de señal?
- [ ] ¿Los tests verifican transacciones?

**Recomendado pero no obligatorio para cambios menores**

---

## 🚨 VIOLACIONES COMUNES

### Violación 1: Mutar desde endpoint
```javascript
// ❌ PROHIBIDO
export default async function handler(request, env) {
  const repo = getStudentRepo();
  const alumno = await repo.updateNivel(email, nivel); // VIOLACIÓN
}

// ✅ CORRECTO
export default async function handler(request, env) {
  const { getStudentMutationService } = await import('../core/services/student-mutation-service.js');
  const service = getStudentMutationService();
  const actor = { type: 'admin', id: null };
  const alumno = await service.updateNivel(email, nivel, actor);
}
```

### Violación 2: Mutar sin auditoría
```javascript
// ❌ PROHIBIDO
async updateNivel(email, nivel) {
  const alumno = await this.repo.updateNivel(email, nivel);
  return alumno; // Falta auditoría
}

// ✅ CORRECTO
async updateNivel(email, nivel, actor, client) {
  const alumnoAnterior = await this.studentRepo.getByEmail(email, client);
  const alumno = await this.repo.updateNivel(email, nivel, client);
  await this.auditRepo.recordEvent({...}, client); // Auditoría obligatoria
  return alumno;
}
```

### Violación 3: Mutar calculando
```javascript
// ❌ PROHIBIDO
async updateNivel(email) {
  const nivel = calcularNivel(email); // VIOLACIÓN: calcula
  const alumno = await this.repo.updateNivel(email, nivel);
}

// ✅ CORRECTO
async updateNivel(email, nivel, actor, client) {
  // nivel ya viene calculado
  const alumno = await this.repo.updateNivel(email, nivel, client);
}
```

### Violación 4: Mutar emitiendo señal
```javascript
// ❌ PROHIBIDO
async updateNivel(email, nivel, actor, client) {
  const alumno = await this.repo.updateNivel(email, nivel, client);
  await emitSignal('student.level_changed', {...}); // VIOLACIÓN: emite
}

// ✅ CORRECTO
async updateNivel(email, nivel, actor, client) {
  const alumno = await this.repo.updateNivel(email, nivel, client);
  const signalData = this._prepareSignal('student.level_changed', {...}); // Solo prepara
  // signalData disponible para emisión posterior
}
```

---

## 📋 CÓMO USAR ESTA CHECKLIST

1. **Antes de crear PR**: Revisar todos los items
2. **Si cambias mutación existente**: Verificar items 1-7
3. **Si añades nueva mutación**: Verificar items 1-9
4. **Si detectas violación**: Corregir antes de mergear

---

## 🔍 VERIFICACIÓN AUTOMÁTICA

Ejecutar verificación estática:
```bash
npm run verify:contract:mutations
```

O manualmente:
```bash
node scripts/verify-live-entities-mutation-contract.js
```

---

**Última actualización**: 2025-01-XX  
**Versión del contrato**: 1.0




