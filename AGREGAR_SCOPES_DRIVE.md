# 🔧 Agregar Scopes de Drive API a Domain-Wide Delegation

## ⚠️ Problema Actual

El Service Account tiene Domain-Wide Delegation configurado para Gmail, pero **falta agregar los scopes de Drive API**.

## ✅ Solución: Agregar Scopes de Drive

### Paso 1: Ir a Google Admin Console

1. Ve a: **https://admin.google.com/**
2. Inicia sesión como administrador
3. Ve a: **Security** → **API Controls** → **Domain-wide Delegation**

### Paso 2: Editar el Client ID Existente

1. Busca el Client ID: **`115320164248532519199`**
2. Haz clic en **"Edit"** (icono de lápiz)
3. Verás los scopes actuales (probablemente solo Gmail)

### Paso 3: Agregar Scopes de Drive

Agrega estos scopes adicionales (uno por línea):

```
https://www.googleapis.com/auth/drive
https://www.googleapis.com/auth/drive.file
https://www.googleapis.com/auth/drive.readonly
```

**Lista completa de scopes** (incluye los de Gmail que ya tienes):

```
https://www.googleapis.com/auth/gmail.send
https://www.googleapis.com/auth/gmail.readonly
https://www.googleapis.com/auth/drive
https://www.googleapis.com/auth/drive.file
https://www.googleapis.com/auth/drive.readonly
```

4. Haz clic en **"Authorize"** o **"Update"**

### Paso 4: Verificar que Drive API esté Habilitada

1. Ve a: **https://console.cloud.google.com/apis/library/drive.googleapis.com**
2. Selecciona el proyecto: **`pde-aurelin-portal`**
3. Verifica que Drive API esté **"Enabled"**
4. Si no está habilitada, haz clic en **"Enable"**

### Paso 5: Reiniciar y Probar

```bash
cd /var/www/aurelinportal
pm2 restart aurelinportal
sleep 3
npm run transcripcion:forzar-todos
```

---

## 📋 Resumen

**Client ID del Service Account:** `115320164248532519199`

**Scopes a agregar en Domain-Wide Delegation:**
- `https://www.googleapis.com/auth/drive`
- `https://www.googleapis.com/auth/drive.file`
- `https://www.googleapis.com/auth/drive.readonly`

**Usuario de impersonación:** `eugeni@eugenihidalgo.org` (ya configurado ✅)

**Carpeta compartida:** `1HL5gG6eq0mLqifr8eqdiR_GmnHPdmECP` (ya compartida ✅)

---

**Una vez agregados los scopes, el sistema podrá acceder a Google Drive y procesar las transcripciones.**

