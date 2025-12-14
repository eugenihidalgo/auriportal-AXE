# 🧪 Instrucciones para Probar las APIs

## 📋 Scripts Disponibles

### 1. **Prueba Completa de Todas las APIs**
```bash
cd /var/www/aurelinportal
node scripts/test-all-apis.js email@ejemplo.com
```

Este script prueba:
- ✅ Variables de entorno
- ✅ API de Kajabi (verificación de acceso y datos completos)
- ✅ Base de datos SQL (inicialización y consultas)
- ✅ Sincronización Kajabi → SQL
- ✅ API de ClickUp (búsqueda y creación de estudiantes)
- ✅ Verificación de existencia de estudiantes

### 2. **Prueba Específica de API de Kajabi**
```bash
cd /var/www/aurelinportal
node scripts/test-kajabi-api.js email@ejemplo.com
```

Este script prueba solo la API de Kajabi con más detalle.

---

## 🚀 Cómo Ejecutar las Pruebas

### Paso 1: Verificar Variables de Entorno

Asegúrate de que el archivo `.env` tenga:
```env
KAJABI_CLIENT_ID=tu_client_id
KAJABI_CLIENT_SECRET=tu_client_secret
CLICKUP_API_TOKEN=tu_token
```

### Paso 2: Ejecutar Prueba Completa

```bash
# Con un email que SÍ tiene "Mundo de Luz"
node scripts/test-all-apis.js usuario-con-acceso@ejemplo.com

# Con un email que NO tiene "Mundo de Luz"
node scripts/test-all-apis.js usuario-sin-acceso@ejemplo.com
```

### Paso 3: Revisar Resultados

El script mostrará:
- ✅ Pruebas exitosas (verde)
- ❌ Pruebas fallidas (rojo)
- ⚠️ Advertencias (amarillo)
- ℹ️ Información (cyan)

---

## 📊 Qué Verificar

### API de Kajabi
- ✅ Obtiene token de acceso correctamente
- ✅ Busca persona por email
- ✅ Verifica compra de "Mundo de Luz"
- ✅ Obtiene ofertas y compras
- ✅ Detecta estado de suscripción

### Base de Datos SQL
- ✅ Se inicializa correctamente
- ✅ Tablas se crean si no existen
- ✅ Puede consultar estudiantes
- ✅ Índices funcionan correctamente

### Sincronización
- ✅ Sincroniza datos de Kajabi a SQL
- ✅ Actualiza información correctamente
- ✅ Cache funciona (24 horas)
- ✅ Fallback a Kajabi cuando es necesario

### API de ClickUp
- ✅ Busca estudiantes por email
- ✅ Crea estudiantes si no existen
- ✅ Obtiene datos correctamente

---

## 🔍 Solución de Problemas

### Error: "KAJABI_CLIENT_ID no configurado"
- Verifica que el archivo `.env` exista
- Verifica que las variables estén correctamente escritas
- Reinicia el servidor si cambiaste el `.env`

### Error: "No se encontraron datos de Kajabi"
- Verifica que el email esté registrado en Kajabi
- Verifica que tenga compra de "Mundo de Luz"
- Revisa los logs para más detalles

### Error: "Base de datos no inicializada"
- Verifica que el directorio `database/` exista
- Verifica permisos de escritura
- Revisa que `better-sqlite3` esté instalado

### Error: "CLICKUP_API_TOKEN no configurado"
- Verifica que el token esté en `.env`
- Verifica que el token sea válido
- Revisa que ClickUp esté accesible

---

## 📝 Ejemplo de Salida Exitosa

```
╔══════════════════════════════════════════════════════════════════════╗
║          PRUEBA COMPLETA DE APIS - AURELINPORTAL                    ║
╚══════════════════════════════════════════════════════════════════════╝

📧 Email de prueba: usuario@ejemplo.com

══════════════════════════════════════════════════════════════════════
  VERIFICACIÓN DE VARIABLES DE ENTORNO
══════════════════════════════════════════════════════════════════════
✅ KAJABI_CLIENT_ID: Configurado (abc123...)
✅ KAJABI_CLIENT_SECRET: Configurado (xyz789...)
✅ CLICKUP_API_TOKEN: Configurado (token123...)

══════════════════════════════════════════════════════════════════════
  TEST 1: API DE KAJABI
══════════════════════════════════════════════════════════════════════
✅ Acceso permitido para usuario@ejemplo.com
ℹ️  Tiene Mundo de Luz: SÍ
ℹ️  Estado suscripción: active

══════════════════════════════════════════════════════════════════════
  TEST 2: BASE DE DATOS SQL
══════════════════════════════════════════════════════════════════════
✅ Base de datos inicializada
ℹ️  Total estudiantes en BD: 15

══════════════════════════════════════════════════════════════════════
  RESUMEN DE PRUEBAS
══════════════════════════════════════════════════════════════════════
  ✅ Variables de Entorno
  ✅ API Kajabi
  ✅ Base de Datos SQL
  ✅ Sincronización SQL
  ✅ API ClickUp
  ✅ Verificación Existencia

🎉 ¡Todas las pruebas pasaron correctamente!
```

---

*Documento generado: $(date)*









