# 📊 Análisis Completo: Experiencia del Cliente en AurelinPortal

## 🎯 Resumen Ejecutivo

AurelinPortal es una aplicación web de seguimiento de práctica diaria que integra:
- **Sistema de rachas** (streaks) para motivar la práctica diaria
- **Sistema de niveles** automático basado en días desde inscripción
- **Sistema de temas** con contadores individuales y objetivos
- **Integración con Kajabi** para validar acceso y sincronizar datos
- **Integración con ClickUp** como base de datos principal
- **Onboarding mediante Typeform**

---

## 🔄 FLUJOS PRINCIPALES DE EXPERIENCIA DEL CLIENTE

### **FLUJO 1: Nuevo Usuario (Primera Vez)**

```
1. Usuario visita la raíz "/"
   ↓
2. Sistema detecta que NO hay cookie de sesión
   ↓
3. Redirige automáticamente a Typeform de onboarding
   URL: https://pdeeugenihidalgo.typeform.com/to/GR5IErrl
   ↓
4. Usuario completa Typeform (email + apodo)
   ↓
5. Typeform envía webhook POST a /typeform-webhook
   ↓
6. Sistema:
   - Extrae email y apodo del Typeform
   - Busca contacto en Kajabi por email
   - Verifica que tenga compra de "Mundo de Luz"
   - Crea/actualiza tarea en ClickUp
   - Sincroniza datos de Kajabi (nombre, fecha inscripción)
   - Establece nivel inicial (1 - Sanación - Inicial)
   ↓
7. Typeform redirige a /onboarding-complete?email=...
   ↓
8. Sistema:
   - Valida acceso con Kajabi
   - Crea/obtiene estudiante en ClickUp
   - Sincroniza datos de Kajabi a ClickUp
   - Calcula nivel basado en fecha de inscripción
   - Establece cookie de sesión (válida 1 año)
   - Registra acceso en logs
   ↓
9. Redirige a /enter
   ↓
10. Usuario ve PANTALLA 1 (no ha practicado hoy)
    - Muestra racha: 0 días
    - Muestra nivel actual
    - Botón "Sí, hoy practico"
```

**Puntos Clave:**
- ✅ Validación de acceso obligatoria (debe tener "Mundo de Luz" en Kajabi)
- ✅ Sincronización automática de datos de Kajabi
- ✅ Nivel inicial calculado automáticamente según fecha de inscripción
- ✅ Cookie establecida para futuras visitas

---

### **FLUJO 2: Usuario Existente - Primera Práctica del Día**

```
1. Usuario visita /enter (con cookie válida)
   ↓
2. Sistema:
   - Lee cookie de sesión
   - Valida acceso con Kajabi
   - Obtiene estudiante de ClickUp
   - Sincroniza datos de Kajabi (background)
   - Gestiona estado de suscripción (pausa/reactivación)
   - Verifica última práctica
   ↓
3. Si NO ha practicado hoy:
   → Muestra PANTALLA 1
   - Racha actual (ej: 5 días)
   - Frase motivacional según racha
   - Nivel actual
   - Botón "Sí, hoy practico"
   ↓
4. Usuario hace clic en "Sí, hoy practico"
   → URL: /enter?practico=si
   ↓
5. Sistema:
   - Verifica estado de suscripción (no debe estar pausada)
   - Si está pausada → muestra mensaje de pausa
   - Si está activa:
     * Calcula nueva racha:
       - Si última práctica fue AYER → suma 1
       - Si rompió racha (más de 1 día) → resetea a 1
       - Si es primera vez → establece en 1
     * Actualiza fecha de última práctica (hoy)
     * Actualiza racha en ClickUp
     * Actualiza nivel si es necesario
     * Detecta si alcanzó un hito (25, 50, 75, 100, 150, 200, 365 días)
   ↓
6. Muestra PANTALLA 2 (ya practicó hoy)
   - Mensaje especial si alcanzó hito
   - Racha actualizada
   - Nivel actual
   - Botón "¡Voy a aprender con Aurelín!" → /aprender → /topics
   - Botón "Quiero trabajar un tema específico" → /topics
```

**Puntos Clave:**
- ✅ Validación de suscripción antes de permitir practicar
- ✅ Cálculo inteligente de racha (continúa o resetea)
- ✅ Detección automática de hitos
- ✅ Actualización de nivel si corresponde

---

### **FLUJO 3: Usuario Existente - Ya Practicó Hoy**

```
1. Usuario visita /enter (con cookie válida)
   ↓
2. Sistema verifica última práctica
   ↓
3. Si YA practicó hoy:
   → Muestra PANTALLA 2 directamente
   - Racha actual
   - Nivel actual
   - Mensaje de hito si corresponde
   - Opciones para aprender o trabajar temas
```

**Puntos Clave:**
- ✅ No permite practicar dos veces el mismo día
- ✅ Muestra opciones de aprendizaje inmediatamente

---

### **FLUJO 4: Usuario Recupera Sesión (Sin Cookie)**

```
1. Usuario visita /enter sin cookie
   ↓
2. Sistema muestra PANTALLA 0
   - Formulario para ingresar email
   - Link a Typeform para nuevos usuarios
   ↓
3. Usuario ingresa email y envía formulario
   → POST /enter
   ↓
4. Sistema:
   - Valida acceso con Kajabi
   - Verifica que tenga "Mundo de Luz"
   - Obtiene/crea estudiante en ClickUp
   - Sincroniza datos de Kajabi
   ↓
5. Si tiene acceso:
   - Establece cookie de sesión
   - Redirige a /enter
   - Continúa con flujo normal (Pantalla 1 o 2)
   
6. Si NO tiene acceso:
   - Muestra mensaje de error 403
   - No establece cookie
```

**Puntos Clave:**
- ✅ Validación de acceso en cada recuperación de sesión
- ✅ Sincronización de datos al recuperar sesión

---

### **FLUJO 5: Trabajar con Temas Específicos**

```
1. Usuario hace clic en "Quiero trabajar un tema específico"
   → URL: /topics
   ↓
2. Sistema muestra PANTALLA 4
   - Lista de temas disponibles:
     * Tema 1: Limpieza de mis canales perceptivos
     * Tema 2: Abundancia
     * Tema 3: Salud física
   - Para cada tema muestra:
     * Veces trabajado: X
     * Objetivo recomendado: Y (o "—")
     * Botón "Entrar en este tema"
   ↓
3. Usuario hace clic en un tema
   → URL: /topic/tema1 (ejemplo)
   ↓
4. Sistema muestra PANTALLA 3
   - Nombre del tema
   - Contador actual
   - Objetivo (si existe)
   - Botón "Practicar este tema"
   ↓
5. Usuario hace clic en "Practicar este tema"
   → URL: /topic/tema1?practicar=si
   ↓
6. Sistema:
   - Incrementa contador del tema en ClickUp
   - Verifica si se cumplió el objetivo
   - Muestra PANTALLA 3 actualizada con nuevo contador
```

**Puntos Clave:**
- ✅ Contadores independientes por tema
- ✅ Objetivos personalizables por tema
- ✅ Seguimiento de cumplimiento de objetivos

---

### **FLUJO 6: Suscripción Pausada**

```
1. Usuario visita /enter
   ↓
2. Sistema:
   - Verifica estado de suscripción en Kajabi
   - Detecta que está pausada
   ↓
3. Sistema pausa la racha automáticamente
   ↓
4. Muestra PANTALLA 1 con mensaje especial:
   - Racha actual (congelada)
   - Mensaje: "⏸️ Tu suscripción está pausada..."
   - Botón "Sí, hoy practico" DESHABILITADO o muestra error
   ↓
5. Si usuario intenta practicar:
   - Sistema detecta suscripción pausada
   - Muestra mensaje de pausa
   - NO incrementa racha
```

**Puntos Clave:**
- ✅ Verificación automática de estado de suscripción
- ✅ Bloqueo de práctica si está pausada
- ✅ Mensaje claro al usuario

---

### **FLUJO 7: Reactivación de Suscripción**

```
1. Usuario con suscripción pausada visita /enter
   ↓
2. Sistema:
   - Verifica estado en Kajabi
   - Detecta que se reactivó
   ↓
3. Sistema reactiva la racha
   ↓
4. Usuario puede practicar normalmente
   - La racha continúa desde donde estaba
   - No se resetea
```

**Puntos Clave:**
- ✅ Detección automática de reactivación
- ✅ Continuidad de racha (no se pierde)

---

## 🎨 PANTALLAS Y ESTADOS DE LA APLICACIÓN

### **PANTALLA 0: Recuperación de Sesión**
**Cuándo se muestra:**
- Usuario sin cookie visita `/enter` explícitamente
- Usuario pierde sesión

**Elementos:**
- Imagen de Aurelín
- Título: "Hola de nuevo ✨"
- Formulario de email
- Link a Typeform para nuevos usuarios

**Acciones:**
- Ingresar email → POST /enter → Validación → Cookie → Redirección

---

### **PANTALLA 1: No Ha Practicado Hoy**
**Cuándo se muestra:**
- Usuario logueado
- Última práctica NO fue hoy
- Suscripción activa (o pausada con mensaje)

**Elementos:**
- Círculo de aura animado
- Racha actual: "Racha actual: X días"
- Frase motivacional según racha:
  - ≤3 días: "Hoy enciendes tu luz interior."
  - ≤10 días: "Tu constancia está despertando un fuego nuevo."
  - ≤30 días: "Tu energía ya sostiene un ritmo sagrado."
  - >30 días: "Tu compromiso ilumina caminos invisibles."
- Nivel: "Nivel X - Nombre"
- Botón: "Sí, hoy practico" → `/enter?practico=si`

**Variante (Suscripción Pausada):**
- Mensaje: "⏸️ Tu suscripción está pausada..."
- Botón deshabilitado o con mensaje de error

---

### **PANTALLA 2: Ya Practicó Hoy**
**Cuándo se muestra:**
- Usuario logueado
- Última práctica fue HOY
- O después de hacer clic en "Sí, hoy practico"

**Elementos:**
- Círculo de aura animado
- **Bloque de Hito** (si alcanzó 25, 50, 75, 100, 150, 200, 365 días):
  - Mensaje especial: "✨ Hoy alcanzas los X días de racha. Auri se ilumina contigo."
- Nivel: "Nivel X - Nombre"
- Racha: "Racha general: X días"
- Botón: "¡Voy a aprender con Aurelín!" → `/aprender` → `/topics`
- Botón: "Quiero trabajar un tema específico" → `/topics`

**Puntos Clave:**
- ✅ Mensaje especial en hitos
- ✅ Opciones claras para continuar aprendizaje

---

### **PANTALLA 3: Vista de Tema Individual**
**Cuándo se muestra:**
- Usuario visita `/topic/{temaId}`
- Después de practicar un tema

**Elementos:**
- Imagen de Aurelín
- Nombre del tema
- Contador: "Veces trabajado: X"
- Objetivo: "Objetivo recomendado: Y" (o "—")
- Indicador si objetivo cumplido
- Botón: "Practicar este tema" → `/topic/{temaId}?practicar=si`

**Después de practicar:**
- Contador incrementado
- Verificación de objetivo cumplido

---

### **PANTALLA 4: Lista de Temas**
**Cuándo se muestra:**
- Usuario visita `/topics` o `/aprender`

**Elementos:**
- Imagen de Aurelín
- Lista de tarjetas de temas:
  - Tema 1: Limpieza de mis canales perceptivos
  - Tema 2: Abundancia
  - Tema 3: Salud física
- Cada tarjeta muestra:
  - Nombre del tema
  - Veces trabajado: X
  - Objetivo recomendado: Y (o "—")
  - Botón: "Entrar en este tema" → `/topic/{temaId}`

---

## 🔐 SISTEMA DE AUTENTICACIÓN Y VALIDACIÓN

### **Cookies de Sesión**
- **Nombre:** `auri_user`
- **Duración:** 1 año
- **Seguridad:** HttpOnly, Secure (en producción)
- **Contenido:** Email del usuario (encriptado)

### **Validación de Acceso**
1. **Verificación con Kajabi:**
   - Busca contacto por email
   - Verifica que tenga compra de "Mundo de Luz"
   - Obtiene datos completos (nombre, fecha inscripción, suscripciones)

2. **Estados posibles:**
   - ✅ `hasAccess: true` → Acceso permitido
   - ❌ `hasAccess: false` → Acceso denegado (muestra error 403)
   - ⚠️ `skipValidation: true` → Modo desarrollo (permite acceso sin validar)

3. **Sincronización:**
   - Datos de Kajabi se sincronizan a ClickUp automáticamente
   - Incluye: nombre, fecha inscripción, estado de suscripción

---

## 📊 SISTEMA DE RACHAS (STREAKS)

### **Lógica de Cálculo**

1. **Primera Práctica:**
   - Si `lastPractice` es `null` → Establece racha en 1

2. **Práctica Consecutiva:**
   - Si última práctica fue AYER → Incrementa racha +1

3. **Racha Rota:**
   - Si última práctica fue hace >1 día → Resetea racha a 1

4. **Ya Practicó Hoy:**
   - Si última práctica fue HOY → No incrementa, mantiene racha

### **Hitos Especiales**
- Detecta automáticamente: 25, 50, 75, 100, 150, 200, 365 días
- Muestra mensaje especial en Pantalla 2

### **Gestión de Suscripción**
- **Suscripción Pausada:**
  - No permite practicar
  - Congela racha (no se resetea automáticamente)
  - Muestra mensaje de pausa

- **Suscripción Reactivada:**
  - Permite practicar
  - Racha continúa desde donde estaba

---

## 🎓 SISTEMA DE NIVELES

### **Cálculo Automático**
Basado en **días desde fecha de inscripción**:

**Sanación (Niveles 1-9):**
- Nivel 1: 0 días (Sanación - Inicial)
- Nivel 2: 40 días
- Nivel 3: 60 días
- Nivel 4: 90 días
- Nivel 5: 120 días
- Nivel 6: 150 días
- Nivel 7: 180 días
- Nivel 8: 230 días
- Nivel 9: 260 días

**Canalización (Niveles 10-15):**
- Nivel 10: 290 días
- Nivel 11: 320 días
- Nivel 12: 350 días
- Nivel 13: 380 días
- Nivel 14: 410 días
- Nivel 15: 440 días

### **Reglas de Actualización**
- Solo actualiza si nivel automático > nivel actual
- Respeta cambios manuales en ClickUp
- Se recalcula en cada acceso y práctica

---

## 🎯 SISTEMA DE TEMAS

### **Temas Disponibles**
1. **Tema 1:** Limpieza de mis canales perceptivos
2. **Tema 2:** Abundancia
3. **Tema 3:** Salud física

### **Contadores y Objetivos**
- Cada tema tiene contador independiente en ClickUp
- Objetivos personalizables por tema
- Sistema detecta cuando se cumple un objetivo
- Objetivo puede ser "—" (sin objetivo)

### **Flujo de Práctica de Tema**
1. Usuario selecciona tema
2. Ve contador actual y objetivo
3. Hace clic en "Practicar este tema"
4. Contador se incrementa en ClickUp
5. Sistema verifica si se cumplió objetivo
6. Muestra pantalla actualizada

---

## 🔄 SINCRONIZACIÓN DE DATOS

### **Kajabi → ClickUp**
**Datos sincronizados:**
- Nombre completo
- Fecha de inscripción
- Estado de suscripción
- Ofertas activas

**Cuándo se sincroniza:**
- Al completar onboarding
- Al recuperar sesión
- En cada acceso (background, no bloquea)
- Al verificar acceso

### **ClickUp → Aplicación**
**Datos leídos:**
- Racha general
- Fecha de última práctica
- Nivel actual
- Contadores de temas
- Objetivos de temas
- Apodo (del Typeform)
- Nombre (de Kajabi o Typeform)

---

## ⚠️ CASOS ESPECIALES Y ERRORES

### **Acceso Denegado**
- **Causa:** No tiene compra de "Mundo de Luz" en Kajabi
- **Acción:** Muestra error 403, limpia cookie
- **Mensaje:** "Acceso no autorizado"

### **Estudiante No Existe**
- **Causa:** Email no está en ClickUp
- **Acción:** Redirige a Typeform para onboarding

### **Error de Sincronización**
- **Causa:** Error al sincronizar con Kajabi o ClickUp
- **Acción:** Continúa con datos disponibles, registra error en logs

### **Suscripción Pausada**
- **Causa:** Suscripción pausada en Kajabi
- **Acción:** Bloquea práctica, muestra mensaje, congela racha

---

## 📈 MÉTRICAS Y LOGS

### **Registro de Accesos**
- Cada acceso se registra en base de datos local
- Incluye: email, fecha, hora

### **Logs del Sistema**
- Errores de sincronización
- Cambios de estado de suscripción
- Actualizaciones de racha
- Actualizaciones de nivel

---

## 🎯 RESUMEN DE LA EXPERIENCIA DEL CLIENTE

### **Primera Vez:**
1. Redirección automática a Typeform
2. Completar formulario
3. Validación de acceso
4. Creación de cuenta
5. Primera práctica

### **Visitas Diarias:**
1. Acceso con cookie (o recuperación con email)
2. Ver racha y nivel
3. Practicar (si no lo ha hecho hoy)
4. Ver opciones de aprendizaje
5. Trabajar temas específicos

### **Elementos Motivacionales:**
- ✅ Rachas diarias
- ✅ Frases motivacionales según racha
- ✅ Hitos especiales (25, 50, 75, 100+ días)
- ✅ Sistema de niveles progresivo
- ✅ Contadores de temas con objetivos
- ✅ Mensajes de celebración en hitos

### **Elementos de Control:**
- ✅ Validación de acceso obligatoria
- ✅ Gestión automática de suscripciones
- ✅ Sincronización de datos
- ✅ Registro de actividad

---

## 🔍 PUNTOS DE MEJORA IDENTIFICADOS

1. **Pantalla 1 con Suscripción Pausada:**
   - El botón "Sí, hoy practico" debería estar deshabilitado visualmente
   - O mostrar mensaje más claro antes de hacer clic

2. **Manejo de Errores:**
   - Algunos errores de sincronización son silenciosos
   - Podría mostrar mensajes más informativos al usuario

3. **Experiencia de Temas:**
   - No hay feedback visual inmediato al practicar un tema
   - Podría mostrar animación o mensaje de éxito

4. **Navegación:**
   - No hay forma de volver a /enter desde /topics
   - Podría añadir navegación consistente

5. **Onboarding:**
   - Si el webhook de Typeform falla, el usuario queda en estado inconsistente
   - Podría tener mejor manejo de errores

---

## ✅ FORTALEZAS DEL SISTEMA

1. **Integración Robusta:**
   - Sincronización automática con Kajabi y ClickUp
   - Validación de acceso en múltiples puntos

2. **Experiencia Fluida:**
   - Cookies de larga duración
   - Recuperación de sesión simple
   - Navegación intuitiva

3. **Sistema Motivacional:**
   - Rachas, niveles, hitos, objetivos
   - Mensajes personalizados según progreso

4. **Gestión Automática:**
   - Niveles automáticos
   - Gestión de suscripciones
   - Sincronización en background

---

*Documento generado el: $(date)*
*Versión de la aplicación: AuriPortal v3.1*









