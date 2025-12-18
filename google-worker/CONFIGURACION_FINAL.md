# ✅ Configuración Final del Google Worker

## 🎉 ¡Despliegue Completado!

Tu Google Apps Script está desplegado y listo para usar.

### 📋 Información del Despliegue

- **URL del Web App:** `<GOOGLE_WORKER_URL>` (obtén la URL real desde Google Apps Script)
- **ID de Implementación:** `<GOOGLE_WORKER_SCRIPT_ID>` (obtén el ID después de desplegar)

---

## 🔐 Paso 1: Configurar SCRIPT_SECRET

1. Ve a tu proyecto en [Google Apps Script](https://script.google.com)
2. Clic en **"Proyecto"** (⚙️) → **"Configuración del proyecto"**
3. Pestaña **"Script properties"**
4. Añade una nueva propiedad:
   - **Clave:** `SCRIPT_SECRET`
   - **Valor:** Genera un token seguro (ejemplo: ejecuta `openssl rand -hex 32`)

**Ejemplo de token:**
```bash
openssl rand -hex 32
```

---

## 🧪 Paso 2: Probar la Conexión

Una vez tengas el `SCRIPT_SECRET` configurado, prueba con:

```bash
curl -X POST '<GOOGLE_WORKER_URL>' \
  -H 'Content-Type: application/json' \
  -d '{"token":"<GOOGLE_WORKER_SECRET>","accion":"ping"}'
```

Deberías recibir:
```json
{
  "status": "ok",
  "message": "Google Worker AuriPortal activo",
  "data": {
    "timestamp": "...",
    "version": "8.0"
  }
}
```

---

## ⚙️ Paso 3: Configurar Variables de Entorno

Añade estas variables a tu archivo `.env`:

```env
# Google Apps Script Worker
GOOGLE_WORKER_URL=<GOOGLE_WORKER_URL>
GOOGLE_WORKER_SECRET=<GOOGLE_WORKER_SECRET>
```

> **⚠️ IMPORTANTE:** 
> - `GOOGLE_WORKER_URL`: Obtén la URL real desde Google Apps Script después de desplegar como Web App
> - `GOOGLE_WORKER_SECRET`: Genera un secreto seguro con `openssl rand -hex 32` y configúralo en Script Properties

---

## 📝 Paso 4: Usar desde Node.js

Ya tienes el archivo `ejemplo-nodejs.js` con ejemplos de uso. 

**Ejemplo rápido:**

```javascript
import fetch from 'node-fetch';

const GOOGLE_WORKER_URL = process.env.GOOGLE_WORKER_URL;
const GOOGLE_WORKER_SECRET = process.env.GOOGLE_WORKER_SECRET;

async function llamarGoogleWorker(accion, datos = {}) {
  const response = await fetch(GOOGLE_WORKER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      token: GOOGLE_WORKER_SECRET,
      accion: accion,
      ...datos
    })
  });
  
  return await response.json();
}

// Test
const resultado = await llamarGoogleWorker('ping', {});
console.log(resultado);
```

---

## ✅ Checklist Final

- [x] Archivos copiados a Google Apps Script
- [ ] SCRIPT_SECRET configurado en Script Properties
- [ ] Test de ping exitoso
- [ ] Variables de entorno configuradas en `.env`
- [ ] Prueba desde Node.js exitosa

---

## 🎯 Acciones Disponibles

Ahora puedes usar todas estas acciones desde tu servidor:

- `ping` - Test de conectividad
- `crear_carpeta` - Crear carpeta en Drive
- `crear_documento` - Crear Google Docs
- `generar_pdf` - Convertir Docs a PDF
- `enviar_email` - Enviar email con Gmail
- `crear_evento_calendar` - Crear evento en Calendar
- `mover_archivo` - Mover archivo entre carpetas
- `crear_estructura_alumno` - Crear estructura de carpetas para alumno
- `crear_informe_aurielin` - Crear informe completo con formato
- `registrar_log` - Registrar acción en hoja de cálculo

¡Todo listo para usar! 🚀















