# ✅ URL Actualizada del Google Worker

## 📋 Nueva Configuración

### URL del Web App:
```
<GOOGLE_WORKER_URL>
```

### ID de Implementación:
```
<GOOGLE_WORKER_SCRIPT_ID>
```

> **⚠️ IMPORTANTE:** Obtén la URL real desde Google Apps Script después de desplegar el proyecto. Ver [README.md](./README.md) para instrucciones.

---

## ⚙️ Configurar en .env

Añade o actualiza estas líneas en tu archivo `.env`:

```env
GOOGLE_WORKER_URL=<GOOGLE_WORKER_URL>
GOOGLE_WORKER_SECRET=<GOOGLE_WORKER_SECRET>
```

> **⚠️ IMPORTANTE:** 
> - `GOOGLE_WORKER_URL`: Obtén la URL real desde Google Apps Script después de desplegar como Web App
> - `GOOGLE_WORKER_SECRET`: Genera un secreto seguro con `openssl rand -hex 32` y configúralo en Script Properties

---

## 🧪 Probar la Conexión

Una vez configurado el SCRIPT_SECRET en Script Properties, prueba con:

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

## ✅ Checklist

- [x] Archivos copiados a Google Apps Script
- [ ] SCRIPT_SECRET configurado en Script Properties
- [ ] Variables añadidas a .env
- [ ] Test de ping exitoso

---

¡Listo para usar! 🚀


























