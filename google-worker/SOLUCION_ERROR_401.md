# 🔧 Solución al Error 401 - Google Worker

## ❌ Problema

El Google Worker devuelve HTML (error 401) en lugar de JSON. Esto es normal la **primera vez** después de desplegar.

## ✅ Solución

### Paso 1: Ejecutar Manualmente la Primera Vez

Google Apps Script requiere que ejecutes la Web App **una vez manualmente desde el navegador** para activar los permisos.

1. **Abre esta URL en tu navegador:**
   ```
   <GOOGLE_WORKER_URL>
   ```
   
   > **⚠️ IMPORTANTE:** Obtén la URL real desde Google Apps Script después de desplegar el proyecto.

2. **Google pedirá autorización:**
   - Haz clic en "Permitir" o "Allow"
   - Selecciona tu cuenta de Google
   - Autoriza los permisos necesarios

3. **Verás un error (es normal):**
   - Probablemente verás un error porque estás haciendo GET sin parámetros
   - Esto activa los permisos

### Paso 2: Probar con un POST desde el Navegador

Puedes usar las herramientas de desarrollo del navegador:

1. Abre la consola del navegador (F12)
2. Ejecuta:

```javascript
fetch('<GOOGLE_WORKER_URL>', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    token: '<GOOGLE_WORKER_SECRET>',
    accion: 'ping'
  })
}).then(r => r.json()).then(console.log);
```

> **⚠️ IMPORTANTE:** Reemplaza `<GOOGLE_WORKER_URL>` y `<GOOGLE_WORKER_SECRET>` con tus valores reales desde `.env`.

### Paso 3: Verificar en Apps Script

1. Ve a tu proyecto en Apps Script
2. Clic en "Ver" → "Registros de ejecución"
3. Deberías ver ejecuciones recientes
4. Si hay errores, revísalos

### Paso 4: Verificar la Implementación

1. En Apps Script: "Implementar" → "Gestionar implementaciones"
2. Verifica que:
   - Estado: "Activo"
   - Acceso: "Cualquiera" o "Cualquiera con una cuenta de Google"
   - Ejecutar como: "Yo"

### Paso 5: Ejecutar Tests de Nuevo

Después de autorizar manualmente, ejecuta:

```bash
node tests/test-google-worker.js
```

---

## 🔍 Verificación del SCRIPT_SECRET

Si después de autorizar sigue fallando, verifica el token:

1. En Apps Script, ejecuta esta función:

```javascript
function verificarSecret() {
  const props = PropertiesService.getScriptProperties();
  const secret = props.getProperty('SCRIPT_SECRET');
  Logger.log('Secret configurado: ' + (secret ? 'SÍ' : 'NO'));
  if (secret) {
    Logger.log('Longitud: ' + secret.length);
    Logger.log('Primeros 20: ' + secret.substring(0, 20));
    Logger.log('Últimos 20: ' + secret.substring(secret.length - 20));
  }
}
```

2. Verifica que coincida exactamente con el de tu `.env`

---

## 💡 Nota Importante

**La primera ejecución desde tu servidor Node.js también activará los permisos.** Si ejecutas una acción real desde tu código, Google pedirá autorización y luego funcionará.

El problema actual es que las peticiones desde `curl` o el script de tests no pueden completar el flujo de autorización OAuth que Google requiere.

---

## ✅ Solución Temporal

Mientras tanto, puedes probar las acciones directamente desde tu código Node.js en lugar de desde tests, ya que el navegador puede manejar mejor la autorización.


























