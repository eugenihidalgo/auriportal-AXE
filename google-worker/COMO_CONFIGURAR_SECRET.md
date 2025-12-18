# 🔐 Cómo Configurar SCRIPT_SECRET

## Opción 1: Desde la Interfaz (Recomendada)

1. Ve a tu proyecto en [Google Apps Script](https://script.google.com)
2. Clic en **"Proyecto"** (⚙️) → **"Configuración del proyecto"**
3. Busca la sección **"Propiedades de secuencia de comandos"**
4. Si ves un botón **"+ Agregar propiedad de script"** o similar, haz clic
5. Añade:
   - **Clave:** `SCRIPT_SECRET`
   - **Valor:** Tu token secreto (ver abajo para generar uno)

## Opción 2: Desde el Código (Si no ves el botón)

1. En Google Apps Script, crea un nuevo archivo temporal (puedes llamarlo `configurar-secret.gs`)
2. Copia este código:

```javascript
function configurarScriptSecret() {
  const scriptProperties = PropertiesService.getScriptProperties();
  
  // REEMPLAZA esto con tu secret real
  const SECRET = 'TU_SECRET_AQUI';
  
  scriptProperties.setProperty('SCRIPT_SECRET', SECRET);
  Logger.log('✅ SCRIPT_SECRET configurado correctamente');
}

function verificarScriptSecret() {
  const scriptProperties = PropertiesService.getScriptProperties();
  const secret = scriptProperties.getProperty('SCRIPT_SECRET');
  
  if (secret) {
    Logger.log('✅ SCRIPT_SECRET está configurado');
  } else {
    Logger.log('❌ SCRIPT_SECRET NO está configurado');
  }
}
```

3. Reemplaza `'TU_SECRET_AQUI'` con un secret real (ver abajo)
4. Ejecuta la función `configurarScriptSecret`:
   - Selecciona `configurarScriptSecret` en el menú desplegable de funciones
   - Haz clic en el botón "Ejecutar" (▶️)
   - Revisa los logs (Ver → Registros de ejecución) para confirmar que se configuró
5. Ejecuta `verificarScriptSecret()` para confirmar
6. **ELIMINA el archivo temporal** después de configurarlo (por seguridad)

---

## 🔑 Generar un Secret Seguro

Ejecuta en tu terminal:

```bash
openssl rand -hex 32
```

Esto generará algo como:
```
a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
```

Usa ese valor como tu SCRIPT_SECRET.

---

## ⚠️ Importante

- El mismo secret que uses aquí debe ir en tu `.env` como `GOOGLE_WORKER_SECRET`
- No compartas este secret
- Si lo olvidas, simplemente genera uno nuevo y actualiza tanto Script Properties como `.env`

---

## ✅ Verificación

Después de configurar, prueba con:

```bash
curl -X POST '<GOOGLE_WORKER_URL>' \
  -H 'Content-Type: application/json' \
  -d '{"token":"<GOOGLE_WORKER_SECRET>","accion":"ping"}'
```

> **⚠️ IMPORTANTE:** Reemplaza `<GOOGLE_WORKER_URL>` y `<GOOGLE_WORKER_SECRET>` con tus valores reales desde `.env`.

Si funciona, deberías recibir una respuesta con `"status": "ok"`.
















