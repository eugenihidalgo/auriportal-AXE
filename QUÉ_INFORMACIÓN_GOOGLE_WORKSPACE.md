# 📋 Qué Información Necesito de tu Google Workspace

Para configurar todas las APIs de Google Workspace en el servidor AuriPortal, necesito la siguiente información:

## 🎯 Información Requerida

### **1. Service Account JSON (Recomendado)** ⭐

**¿Qué es?** Un archivo JSON con las credenciales del Service Account que permite al servidor acceder a todas las APIs.

**¿Cómo obtenerlo?**

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Selecciona o crea un proyecto
3. Ve a **APIs & Services** → **Credentials**
4. Click en **+ CREATE CREDENTIALS** → **Service Account**
5. Completa:
   - **Name**: `auriportal-workspace`
   - **Description**: `Service account para AuriPortal`
6. Click en **CREATE AND CONTINUE**
7. Asigna rol **Editor** (o **Owner** si tienes permisos)
8. Click en **DONE**
9. Click en el Service Account creado
10. Ve a **KEYS** → **ADD KEY** → **Create new key** → **JSON**
11. Descarga el archivo JSON

**¿Qué contiene?** El JSON tiene esta estructura:
```json
{
  "type": "service_account",
  "project_id": "tu-project-id",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "auriportal-workspace@tu-project.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "..."
}
```

**⚠️ IMPORTANTE:** 
- Este archivo es SENSIBLE - no lo compartas públicamente
- Guárdalo de forma segura
- No lo subas a Git (ya está en `.gitignore`)

---

### **2. Project ID (Opcional pero Recomendado)**

**¿Qué es?** El ID único de tu proyecto en Google Cloud.

**¿Dónde encontrarlo?**
- En el archivo JSON del Service Account: campo `"project_id"`
- En Google Cloud Console: aparece en la parte superior
- Ejemplo: `mi-proyecto-auriportal-123456`

**¿Para qué sirve?** Para identificar el proyecto donde se habilitarán las APIs.

---

### **3. Dominio de Google Workspace (Opcional pero Útil)**

**¿Qué es?** El dominio de tu organización en Google Workspace.

**Ejemplos:**
- `eugenihidalgo.org`
- `tudominio.com`
- `empresa.com`

**¿Para qué sirve?** Para gestionar usuarios, grupos y configuraciones del dominio.

---

### **4. Email de Administrador (Opcional - Solo si usas Domain-Wide Delegation)**

**¿Qué es?** El email de un administrador del dominio que el Service Account puede "impersonar".

**Ejemplos:**
- `admin@tudominio.com`
- `administrador@tudominio.com`

**¿Para qué sirve?** Permite que el Service Account actúe como ese usuario para operaciones que requieren permisos de administrador.

**⚠️ Solo necesario si:**
- Quieres gestionar usuarios del dominio
- Quieres gestionar grupos
- Necesitas permisos administrativos

---

## 📝 Resumen: Qué Necesito

### **Mínimo Requerido:**
1. ✅ **Service Account JSON** (archivo completo)

### **Recomendado:**
2. ✅ **Project ID** (si no está en el JSON o quieres especificarlo)
3. ✅ **Dominio de Google Workspace** (para gestión de usuarios/grupos)

### **Opcional:**
4. ⚠️ **Email de Administrador** (solo si necesitas Domain-Wide Delegation)

---

## 🔧 Cómo Configurarlo en el Servidor

Una vez que tengas la información, agrega esto a tu archivo `.env`:

```env
# Google Workspace - Service Account (REQUERIDO)
GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"tu-project-id",...}'

# Google Workspace - Project ID (OPCIONAL - se obtiene del JSON si no se especifica)
GOOGLE_PROJECT_ID=tu-project-id

# Google Workspace - Dominio (OPCIONAL pero recomendado)
GOOGLE_WORKSPACE_DOMAIN=tudominio.com

# Google Workspace - Impersonación (OPCIONAL - solo si necesitas Domain-Wide Delegation)
GOOGLE_SERVICE_ACCOUNT_IMPERSONATE=admin@tudominio.com

# Email desde el cual enviar (OPCIONAL)
EMAIL_FROM=noreply@tudominio.com
```

---

## 🚀 Una Vez Configurado

El servidor podrá:

1. **Habilitar automáticamente todas las APIs necesarias**
2. **Gestionar emails** (Gmail API)
3. **Gestionar archivos** (Drive API)
4. **Gestionar calendarios** (Calendar API)
5. **Gestionar hojas de cálculo** (Sheets API)
6. **Gestionar documentos** (Docs API)
7. **Gestionar usuarios** (Admin SDK)
8. **Gestionar grupos** (Groups API)
9. **Y mucho más...**

---

## 📞 ¿Necesitas Ayuda?

Si tienes dudas sobre cómo obtener alguna de estas credenciales:

1. **Service Account JSON**: Consulta [CONFIGURAR_GOOGLE_WORKSPACE.md](./CONFIGURAR_GOOGLE_WORKSPACE.md)
2. **Project ID**: Aparece en Google Cloud Console en la parte superior
3. **Dominio**: Es el dominio de tu organización (ej: `@tudominio.com`)

---

## ✅ Checklist

Antes de continuar, asegúrate de tener:

- [ ] Service Account JSON descargado
- [ ] Project ID anotado (o está en el JSON)
- [ ] Dominio de Google Workspace (si lo tienes)
- [ ] Email de administrador (solo si necesitas Domain-Wide Delegation)

---

*Guía creada: $(date)*
*Versión: AuriPortal v3.1*



