# ✅ URL Actualizada del Google Worker

## 📋 Nueva Configuración

### URL del Web App:
```
https://script.google.com/a/macros/eugenihidalgo.org/s/AKfycbzLaclkdXAn8La4GugLmkJYY26FDyHOYPEL8_iCwT6eRcOWOIWBaVXgrNRuv7FFEfp7/exec
```

### ID de Implementación:
```
AKfycbzLaclkdXAn8La4GugLmkJYY26FDyHOYPEL8_iCwT6eRcOWOIWBaVXgrNRuv7FFEfp7
```

---

## ⚙️ Configurar en .env

Añade o actualiza estas líneas en tu archivo `.env`:

```env
GOOGLE_WORKER_URL=https://script.google.com/a/macros/eugenihidalgo.org/s/AKfycbzLaclkdXAn8La4GugLmkJYY26FDyHOYPEL8_iCwT6eRcOWOIWBaVXgrNRuv7FFEfp7/exec
GOOGLE_WORKER_SECRET=a6fd6f09f54ee98189acb4037b818e7cd4fe39f9b4c8fc317786d72eac17468d
```

---

## 🧪 Probar la Conexión

Una vez configurado el SCRIPT_SECRET en Script Properties, prueba con:

```bash
curl -X POST 'https://script.google.com/a/macros/eugenihidalgo.org/s/AKfycbzLaclkdXAn8La4GugLmkJYY26FDyHOYPEL8_iCwT6eRcOWOIWBaVXgrNRuv7FFEfp7/exec' \
  -H 'Content-Type: application/json' \
  -d '{"token":"a6fd6f09f54ee98189acb4037b818e7cd4fe39f9b4c8fc317786d72eac17468d","accion":"ping"}'
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






