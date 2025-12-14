# ✅ Configuración Completa - Google Worker

## 🎉 ¡Todo Configurado!

### ✅ Completado

- [x] Todos los archivos `.gs` copiados a Google Apps Script
- [x] SCRIPT_SECRET configurado en Script Properties
- [x] Web App desplegada
- [x] Variables añadidas a `.env`
- [x] URL configurada: `https://script.google.com/a/macros/eugenihidalgo.org/s/AKfycbzLaclkdXAn8La4GugLmkJYY26FDyHOYPEL8_iCwT6eRcOWOIWBaVXgrNRuv7FFEfp7/exec`

---

## 📝 Variables Configuradas

En tu archivo `.env`:

```env
GOOGLE_WORKER_URL=https://script.google.com/a/macros/eugenihidalgo.org/s/AKfycbzLaclkdXAn8La4GugLmkJYY26FDyHOYPEL8_iCwT6eRcOWOIWBaVXgrNRuv7FFEfp7/exec
GOOGLE_WORKER_SECRET=a6fd6f09f54ee98189acb4037b818e7cd4fe39f9b4c8fc317786d72eac17468d
```

---

## 🚀 Cómo Usar desde Node.js

Ya tienes el archivo `ejemplo-nodejs.js` con ejemplos completos.

**Ejemplo básico:**

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

## 🎯 Acciones Disponibles

1. **`ping`** - Test de conectividad
2. **`crear_carpeta`** - Crear carpeta en Drive
3. **`crear_documento`** - Crear Google Docs
4. **`generar_pdf`** - Convertir Docs a PDF
5. **`enviar_email`** - Enviar email con Gmail
6. **`crear_evento_calendar`** - Crear evento en Calendar
7. **`mover_archivo`** - Mover archivo entre carpetas
8. **`crear_estructura_alumno`** - Crear estructura de carpetas para alumno
9. **`crear_informe_aurielin`** - Crear informe completo con formato
10. **`registrar_log`** - Registrar acción en hoja de cálculo

---

## 📚 Documentación

- **README.md** - Guía completa de uso
- **ejemplo-nodejs.js** - Ejemplos de integración
- **ESTRUCTURA_COMPLETA.md** - Resumen de la estructura

---

## 🔧 Troubleshooting

### Si obtienes error de token:
- Verifica que `SCRIPT_SECRET` en Script Properties coincida con `GOOGLE_WORKER_SECRET` en `.env`
- Asegúrate de haber reiniciado el servidor después de cambiar `.env`

### Si obtienes error de permisos:
- Ve a Apps Script → "Ver" → "Registros de ejecución"
- Revisa los errores y autoriza los permisos necesarios

---

¡Todo listo para usar! 🎉






