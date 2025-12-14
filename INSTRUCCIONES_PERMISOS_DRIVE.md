# 🔐 Instrucciones para Configurar Permisos de Google Drive

## ⚠️ Error: "Insufficient Permission"

Si ves el error `Insufficient Permission` al intentar acceder a la carpeta de Google Drive, necesitas:

### 1. Verificar Scopes del Service Account

El Service Account necesita tener estos scopes habilitados:
- `https://www.googleapis.com/auth/drive`
- `https://www.googleapis.com/auth/drive.file`
- `https://www.googleapis.com/auth/drive.readonly`

**Ya están configurados en el código**, pero verifica que el Service Account tenga estos permisos en Google Cloud Console.

### 2. Compartir la Carpeta con el Service Account

**PASO CRÍTICO:** Debes compartir la carpeta `1HL5gG6eq0mLqifr8eqdiR_GmnHPdmECP` con el email del Service Account.

#### Pasos:

1. **Obtener el email del Service Account:**
   - Ve a Google Cloud Console: https://console.cloud.google.com/
   - Selecciona tu proyecto
   - Ve a "IAM & Admin" > "Service Accounts"
   - Encuentra tu Service Account y copia el email (algo como: `auriportal-workspace@tu-proyecto.iam.gserviceaccount.com`)

2. **Compartir la carpeta en Google Drive:**
   - Abre Google Drive: https://drive.google.com/
   - Navega a la carpeta `1HL5gG6eq0mLqifr8eqdiR_GmnHPdmECP`
   - Haz clic derecho en la carpeta > "Compartir"
   - Pega el email del Service Account
   - Dale permisos de **"Editor"** o **"Lector"** (Editor si quieres que pueda crear la subcarpeta "transcripciones")
   - Haz clic en "Enviar"

3. **Verificar permisos:**
   - Asegúrate de que el Service Account tenga acceso a la carpeta
   - Puedes verificar esto en Google Drive > Carpeta > "Compartir" > Ver lista de personas con acceso

### 3. Verificar Domain-Wide Delegation (Opcional)

Si usas Domain-Wide Delegation, asegúrate de que los scopes estén configurados correctamente en Google Admin Console.

### 4. Probar de Nuevo

Después de compartir la carpeta, ejecuta de nuevo:

```bash
cd /var/www/aurelinportal
npm run transcripcion:forzar-todos
```

O desde el endpoint:

```
https://controlauriportal.eugenihidalgo.work/transcription-process?password=kaketes7897&todos=true&forzar=true
```

---

## 📋 Resumen Rápido

1. ✅ Scopes ya configurados en el código
2. ⚠️ **COMPARTIR la carpeta con el Service Account** (email del Service Account)
3. ✅ Dar permisos de "Editor" al Service Account
4. ✅ Probar de nuevo

---

## 🔍 Cómo Encontrar el Email del Service Account

Si no sabes cuál es el email del Service Account, puedes encontrarlo en:

1. **En el archivo `.env`:**
   - Busca `GOOGLE_SERVICE_ACCOUNT_KEY`
   - Es un JSON, busca el campo `client_email`
   - Ejemplo: `"client_email": "auriportal-workspace@mi-proyecto.iam.gserviceaccount.com"`

2. **En Google Cloud Console:**
   - https://console.cloud.google.com/iam-admin/serviceaccounts
   - Selecciona tu proyecto
   - Verás la lista de Service Accounts con sus emails

---

**Una vez compartida la carpeta, el sistema podrá acceder y procesar los archivos.**



