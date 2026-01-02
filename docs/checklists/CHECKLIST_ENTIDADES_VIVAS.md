# CHECKLIST: Creación de Entidades Vivas
## Verificación Obligatoria para PRs y Cambios

**Referencia**: `CONTRATO_CANONICO_CREACION_ENTIDADES_VIVAS.md`

---

## ✅ CHECKLIST OBLIGATORIA

### 1. Punto Canónico

- [ ] ¿La creación pasa por `StudentMutationService`?
- [ ] ¿NO se crea directamente desde endpoint?
- [ ] ¿NO se crea directamente desde módulo de negocio?
- [ ] ¿NO se crea directamente desde repositorio?

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
- [ ] ¿El evento incluye datos mínimos (entidad, valores clave)?
- [ ] ¿La auditoría es fail-open (no bloquea si falla)?

**Si alguna respuesta es NO → VIOLACIÓN DEL CONTRATO**

---

### 4. Señales

- [ ] ¿Prepara señal estructurada?
- [ ] ¿El `signalType` es correcto?
- [ ] ¿El `payload` incluye datos necesarios?
- [ ] ¿NO se emite la señal durante la creación?

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

**Si alguna respuesta es NO → VIOLACIÓN DEL CONTRATO**

---

### 7. Documentación (Solo para nuevas entidades)

- [ ] ¿Se actualizó `CONTRATO_CANONICO_CREACION_ENTIDADES_VIVAS.md`?
- [ ] ¿Se documentó la nueva entidad en la sección 9?
- [ ] ¿Se añadió método canónico en `StudentMutationService`?

**Si es nueva entidad y alguna respuesta es NO → INCOMPLETO**

---

### 8. Tests (Recomendado)

- [ ] ¿Se añadieron tests mínimos si se tocó creación?
- [ ] ¿Los tests verifican auditoría?
- [ ] ¿Los tests verifican preparación de señal?
- [ ] ¿Los tests verifican transacciones?

**Recomendado pero no obligatorio para cambios menores**

---

## 🚨 VIOLACIONES COMUNES

### Violación 1: Crear desde endpoint
```javascript
// ❌ PROHIBIDO
export default async function handler(request, env) {
  const repo = getStudentRepo();
  const alumno = await repo.create(data); // VIOLACIÓN
}

// ✅ CORRECTO
export default async function handler(request, env) {
  const { getStudentMutationService } = await import('../core/services/student-mutation-service.js');
  const service = getStudentMutationService();
  const alumno = await service.createStudent(env, data, actor);
}
```

### Violación 2: Crear sin auditoría
```javascript
// ❌ PROHIBIDO
async createStudent(data) {
  const alumno = await this.repo.create(data);
  return alumno; // Falta auditoría
}

// ✅ CORRECTO
async createStudent(env, data, actor, client) {
  const alumno = await this.repo.create(data, client);
  await this.auditRepo.recordEvent({...}, client); // Auditoría obligatoria
  return alumno;
}
```

### Violación 3: Crear calculando
```javascript
// ❌ PROHIBIDO
async createStudent(data) {
  const nivel = calcularNivel(data); // VIOLACIÓN: calcula
  const alumno = await this.repo.create({...data, nivel});
}

// ✅ CORRECTO
async createStudent(env, data, actor, client) {
  // nivel ya viene calculado en data
  const alumno = await this.repo.create(data, client);
}
```

---

## 📋 CÓMO USAR ESTA CHECKLIST

1. **Antes de crear PR**: Revisar todos los items
2. **Si cambias creación existente**: Verificar items 1-6
3. **Si añades nueva entidad**: Verificar items 1-8
4. **Si detectas violación**: Corregir antes de mergear

---

## 🔍 VERIFICACIÓN AUTOMÁTICA

Ejecutar verificación estática:
```bash
npm run verify:contract:entities
```

O manualmente:
```bash
node scripts/verify-live-entities-contract.js
```

---

**Última actualización**: 2025-01-XX  
**Versión del contrato**: 1.0










