# Estructura Completa del Google Worker

## 📁 Archivos Creados

```
google-worker/
│
├── Code.gs                          # Punto de entrada principal (doPost/doGet)
├── router.gs                        # Enrutador de acciones
│
├── utils/
│   ├── response.gs                  # Funciones de respuesta (sendSuccess, sendError)
│   └── validation.gs                # Funciones de validación (validateRequired, etc.)
│
├── actions/
│   ├── drive.gs                     # Acciones de Google Drive
│   │   ├── accionCrearCarpeta()
│   │   ├── accionMoverArchivo()
│   │   └── obtenerOCrearCarpeta() [helper]
│   │
│   ├── docs.gs                      # Acciones de Google Docs
│   │   ├── accionCrearDocumento()
│   │   └── accionGenerarPDF()
│   │
│   ├── email.gs                     # Acciones de Gmail
│   │   └── accionEnviarEmail()
│   │
│   ├── calendar.gs                  # Acciones de Google Calendar
│   │   └── accionCrearEventoCalendar()
│   │
│   ├── aurielin.gs                  # Acciones específicas de Aurielin
│   │   ├── accionCrearEstructuraAlumno()
│   │   └── accionCrearInformeAurielin()
│   │
│   └── logs.gs                      # Sistema de logs
│       ├── accionRegistrarLog()
│       ├── registrarLogInterno() [helper]
│       └── obtenerOCrearSpreadsheetLogs() [helper]
│
├── README.md                        # Documentación principal
├── ejemplo-nodejs.js                # Ejemplos de integración Node.js
└── ESTRUCTURA_COMPLETA.md          # Este archivo
```

## 🔄 Flujo de Ejecución

1. **Cliente Node.js** → POST a Web App URL con JSON
2. **Code.gs** (`doPost`) → Valida token, parsea JSON
3. **router.gs** → Enruta según `accion`
4. **actions/*.gs** → Ejecuta la acción específica
5. **utils/response.gs** → Genera respuesta JSON estándar
6. **Cliente Node.js** → Recibe respuesta

## 📋 Acciones Implementadas

### ✅ Completadas

- ✅ `ping` - Test de conectividad
- ✅ `crear_carpeta` - Crear carpeta en Drive
- ✅ `crear_documento` - Crear Google Docs con contenido
- ✅ `generar_pdf` - Convertir Docs a PDF
- ✅ `enviar_email` - Enviar email con Gmail (HTML + adjuntos)
- ✅ `crear_evento_calendar` - Crear evento en Calendar
- ✅ `mover_archivo` - Mover archivo entre carpetas
- ✅ `crear_estructura_alumno` - Crear estructura completa para alumno
- ✅ `crear_informe_aurielin` - Crear informe formateado + PDF
- ✅ `registrar_log` - Registrar acciones en hoja de cálculo

## 🔐 Seguridad

- ✅ Validación de token secreto en cada petición
- ✅ Token almacenado en Script Properties (no en código)
- ✅ Solo acepta POST (GET solo para health check)
- ✅ Respuestas JSON consistentes con códigos HTTP

## 📝 Formato de Petición

```json
{
  "token": "SECRET_TOKEN",
  "accion": "nombre_accion",
  "parametro1": "valor1",
  "parametro2": "valor2"
}
```

## 📝 Formato de Respuesta

```json
{
  "status": "ok" | "error",
  "message": "Descripción del resultado",
  "data": {
    // Datos específicos según la acción
  }
}
```

## 🚀 Próximos Pasos

1. **Copiar archivos a Google Apps Script:**
   - Crea un nuevo proyecto en script.google.com
   - Copia cada archivo .gs en su ubicación correspondiente
   - Nota: En Apps Script, las "carpetas" se crean con nombres como `utils/response.gs`

2. **Configurar Script Properties:**
   - Proyecto → Configuración → Script properties
   - Añadir: `SCRIPT_SECRET` = `tu_token_secreto`

3. **Desplegar como Web App:**
   - Implementar → Nueva implementación → Aplicación web
   - Ejecutar como: "Yo"
   - Acceso: "Cualquiera"
   - Copiar la URL del Web App

4. **Configurar variables en Node.js:**
   ```env
   GOOGLE_WORKER_URL=https://script.google.com/macros/s/XXX/exec
   GOOGLE_WORKER_SECRET=tu_token_secreto
   ```

5. **Probar conectividad:**
   ```javascript
   await llamarGoogleWorker('ping', {});
   ```

## 🎯 Características Especiales

### Estructura Automática de Alumno
- Crea automáticamente `/Alumnos/{ID}/Eventos`
- Crea automáticamente `/Alumnos/{ID}/Informes`
- Crea automáticamente `/Alumnos/{ID}/Materiales`

### Informe con Formato
- Título centrado y formateado
- Secciones con encabezados
- Conversión automática a PDF
- Guardado en carpeta del alumno

### Sistema de Logs
- Crea automáticamente hoja "Logs_AuriPortal" si no existe
- Formato con encabezados coloreados
- Fecha, hora, acción, usuario, payload
- Primera fila congelada para fácil navegación

## 📚 Documentación Adicional

- **README.md** - Guía completa de instalación y uso
- **ejemplo-nodejs.js** - Ejemplos prácticos de integración

## ✅ Checklist de Implementación

- [ ] Archivos copiados a Google Apps Script
- [ ] Script Properties configurado (SCRIPT_SECRET)
- [ ] Web App desplegada (URL copiada)
- [ ] Permisos otorgados (primera ejecución)
- [ ] Variables de entorno configuradas en Node.js
- [ ] Test de ping exitoso
- [ ] Test de creación de estructura de alumno
- [ ] Test de creación de informe
- [ ] Logs funcionando correctamente

---

**Versión:** 8.0  
**Estado:** ✅ Completo y listo para producción
















