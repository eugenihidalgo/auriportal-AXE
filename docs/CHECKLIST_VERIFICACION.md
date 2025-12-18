# Checklist de Verificación Manual - Reset Visual AuriPortal


## Objetivo

Verificar que el reset visual funciona correctamente y que el sistema de temas es robusto.

## Pre-requisitos

1. Servidor corriendo
2. Acceso a 3 pantallas clave:
   - Pantalla 1 (racha): `/enter`
   - Pantalla 2 (práctica): `/practicar`
   - Ejecución de práctica: `/practica/1/preparaciones` → ejecutar práctica

---

## ✅ Checklist de Verificación

### 1. Theme Contract - Variables CSS

#### 1.1 Cambiar Variable y Verificar Cambio

**Pasos:**
1. Abrir `public/css/theme-variables.css`
2. Cambiar `--bg-card` en tema claro (línea ~14):
   ```css
   --bg-card: #ff0000; /* Cambiar temporalmente a rojo */
   ```
3. Guardar y recargar servidor (si es necesario)
4. Abrir pantalla 1 (`/enter`) en modo claro
5. **Verificar:** Las cards deben tener fondo rojo
6. Abrir pantalla 2 (`/practicar`)
7. **Verificar:** Las cards también deben tener fondo rojo
8. Abrir ejecución de práctica
9. **Verificar:** Los contenedores también deben tener fondo rojo
10. **Revertir** el cambio en `theme-variables.css`

**Resultado esperado:** ✅ El cambio se refleja en las 3 pantallas

---

### 2. Modo Oscuro Sin Parpadeo

#### 2.1 Verificar Activación Inmediata

**Pasos:**
1. Abrir DevTools (F12) → Network → Deshabilitar cache
2. Abrir pantalla 1 (`/enter`) con tema oscuro
3. **Verificar:** No hay "flash" de modo claro antes del oscuro
4. Recargar la página (F5)
5. **Verificar:** Sigue sin parpadeo
6. Abrir pantalla 2 (`/practicar`)
7. **Verificar:** Modo oscuro activo inmediatamente
8. Abrir ejecución de práctica
9. **Verificar:** Modo oscuro activo inmediatamente

**Resultado esperado:** ✅ No hay parpadeo en ninguna pantalla

#### 2.2 Verificar Script Inline de Tema

**Pasos:**
1. Abrir pantalla 1 en modo oscuro
2. Ver código fuente (Ctrl+U)
3. **Verificar:** Hay un `<script>` inline en `<head>` que activa `theme-dark`
4. **Verificar:** El script se ejecuta antes del render del body

**Resultado esperado:** ✅ Script inline presente y funcional

---

### 3. Práctica con Vídeo y Reloj

#### 3.1 Verificar Vídeo YouTube

**Pasos:**
1. Abrir ejecución de práctica que tenga URL de YouTube
2. **Verificar:** Se muestra un componente `.media-embed` o `.video-container`
3. **Verificar:** El vídeo es responsive (16:9)
4. **Verificar:** Al hacer clic en "Ver vídeo", se muestra el embed de YouTube
5. Cambiar a modo oscuro
6. **Verificar:** El contenedor de vídeo usa variables CSS (no hardcodes)

**Resultado esperado:** ✅ Vídeo se muestra correctamente y es responsive

#### 3.2 Verificar Reloj de Meditación

**Pasos:**
1. Abrir ejecución de práctica
2. **Verificar:** Se muestra el reloj de meditación (si la práctica lo requiere)
3. **Verificar:** El reloj tiene controles (iniciar, pausar, reiniciar)
4. Hacer clic en "Iniciar Meditación"
5. **Verificar:** El contador cuenta hacia atrás correctamente
6. Hacer clic en "Pausar"
7. **Verificar:** El contador se pausa
8. Hacer clic en "Reanudar"
9. **Verificar:** El contador continúa
10. Cambiar a modo oscuro
11. **Verificar:** El reloj usa variables CSS (no hardcodes)

**Resultado esperado:** ✅ Reloj funciona correctamente y usa variables

#### 3.3 Verificar Audio (si aplica)

**Pasos:**
1. Abrir ejecución de práctica que tenga audio
2. **Verificar:** Se muestra un componente `<audio>` con controles
3. **Verificar:** El audio usa estilos con variables CSS
4. Cambiar a modo oscuro
5. **Verificar:** El audio mantiene estilos correctos

**Resultado esperado:** ✅ Audio se muestra correctamente

---

### 4. Linter de Hardcodes

#### 4.1 Ejecutar Linter en Modo Advertencia

**Pasos:**
1. Ejecutar:
   ```bash
   node scripts/lint-theme-hardcodes.js --warn
   ```
2. **Verificar:** Muestra advertencias si hay hardcodes
3. **Verificar:** No falla (código de salida 0)

**Resultado esperado:** ✅ Linter ejecuta sin fallar

#### 4.2 Ejecutar Linter en Modo CI

**Pasos:**
1. Ejecutar:
   ```bash
   node scripts/lint-theme-hardcodes.js
   ```
2. **Verificar:** Si hay hardcodes, falla (código de salida 1)
3. **Verificar:** Muestra archivos y líneas con violaciones

**Resultado esperado:** ✅ Linter detecta violaciones y falla si las hay

#### 4.3 Probar Detección de Hardcode

**Pasos:**
1. Abrir `src/core/html/pantalla1.html`
2. Añadir temporalmente un hardcode:
   ```html
   <div style="color: #fff;">Test</div>
   ```
3. Guardar
4. Ejecutar:
   ```bash
   node scripts/lint-theme-hardcodes.js
   ```
5. **Verificar:** El linter detecta el hardcode
6. **Revertir** el cambio

**Resultado esperado:** ✅ Linter detecta el hardcode añadido

---

### 5. Render Único (renderHtml)

#### 5.1 Verificar Todas las Pantallas Pasan por renderHtml()

**Pasos:**
1. Buscar en código endpoints que devuelvan HTML:
   ```bash
   grep -r "new Response.*html" src/endpoints/
   ```
2. **Verificar:** No hay endpoints que devuelvan HTML directamente sin `renderHtml()`
3. **Verificar:** Todas las pantallas usan `renderHtml()` o funciones que lo usan

**Resultado esperado:** ✅ Todas las pantallas pasan por renderHtml()

#### 5.2 Verificar applyTheme() Inyecta CSS Correctamente

**Pasos:**
1. Abrir pantalla 1
2. Ver código fuente (Ctrl+U)
3. **Verificar:** Hay links a CSS en este orden:
   - `theme-contract.css`
   - `theme-variables.css`
   - `theme-overrides.css`
4. **Verificar:** No hay duplicados

**Resultado esperado:** ✅ CSS se inyecta en orden correcto

---

### 6. Integración Ollama (Preparación)

#### 6.1 Verificar Servicio Ollama Existe

**Pasos:**
1. Verificar que existe:
   ```bash
   ls -la src/core/ai/ollama-client.js
   ```
2. **Verificar:** El archivo existe

**Resultado esperado:** ✅ Servicio Ollama existe

#### 6.2 Verificar Fail-Open

**Pasos:**
1. Verificar que `OLLAMA_ENABLED=off` (por defecto)
2. El cliente debe funcionar aunque Ollama no esté corriendo
3. **Verificar:** No hay errores en logs relacionados con Ollama

**Resultado esperado:** ✅ Fail-open funciona (no rompe si Ollama no está)

---

## 📋 Resumen de Verificación

### ✅ Completado Correctamente

- [ ] Variables CSS cambian en 3 pantallas clave
- [ ] Modo oscuro sin parpadeo
- [ ] Práctica muestra vídeo y reloj
- [ ] Linter detecta hardcode si meto un `#fff` en un template
- [ ] Todas las pantallas pasan por renderHtml()
- [ ] CSS se inyecta en orden correcto
- [ ] Reloj funciona correctamente
- [ ] Audio se muestra correctamente (si aplica)
- [ ] Ollama preparado pero no activo

### ⚠️ Problemas Encontrados

- [ ] Listar problemas encontrados aquí

---

## Notas

- Si encuentras problemas, documentarlos en este checklist
- Revertir cambios temporales después de verificar
- El linter debe ejecutarse antes de cada commit

---

## Comandos Útiles

```bash
# Ejecutar linter
node scripts/lint-theme-hardcodes.js --warn

# Verificar que renderHtml se usa
grep -r "renderHtml" src/endpoints/

# Verificar que applyTheme inyecta CSS
grep -r "theme-contract.css" src/
```

