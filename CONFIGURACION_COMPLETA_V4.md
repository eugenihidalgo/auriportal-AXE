# ✅ Configuración Completa AuriPortal v4

## 🎉 Estado: OPERATIVO

### 📋 Subdominios Configurados

Todos los subdominios están configurados en Cloudflare para `pdeeugenihidalgo.org`:

1. **portal.pdeeugenihidalgo.org**
   - Portal principal de AuriPortal
   - Rutas: `/`, `/enter`, `/aprender`, `/topics`, `/topic/*`, `/onboarding-complete`
   - IP: 88.99.173.249

2. **webhook-kajabi.pdeeugenihidalgo.org**
   - Webhook de Kajabi para eventos de suscripción
   - Ruta: `/kajabi-webhook`
   - IP: 88.99.173.249

3. **webhook-typeform.pdeeugenihidalgo.org**
   - Webhook de Typeform para prácticas
   - Ruta: `/typeform-webhook`
   - IP: 88.99.173.249

4. **admin.pdeeugenihidalgo.org**
   - Panel de administración
   - Rutas: `/admin`, `/health-check`, `/status`
   - IP: 88.99.173.249

### 🔧 Configuración de ClickUp

**IDs Configurados:**
- **Team ID:** `9012227922`
- **Folder ID:** `90128582162` (carpeta donde están las listas de frases)
- **Listas de frases encontradas:**
  - Nivell 1: inicial (ID: 901214598757)
  - Nivell 2: sanación canalización creación y servicio (ID: 901214598787)
  - Nivell 3: paradigmas imperantes transmutación (ID: 901214598780)
  - Nivell 4: kybalión (ID: 901214598806)
  - Nivell 5: karma, registros (ID: 901214598812)
  - Nivell 6: sollos (ID: 901214598815)
  - Nivell 7: fractalidad (ID: 901214598822)

**Variables de entorno (.env):**
```env
CLICKUP_API_TOKEN=pk_43724253_WFDCGWI31SV4JJLMS9USKEO14EDN7RY4
CLICKUP_FOLDER_ID=90128582162
CLICKUP_TEAM_ID=9012227922
CLICKUP_SPACE_ID=901214375878
```

### 🗄️ PostgreSQL

**Base de datos:** `aurelinportal`
**Usuario:** `aurelinportal`
**Host:** `localhost:5432`

**Tablas creadas:**
- ✅ `alumnos` - Información de alumnos
- ✅ `pausas` - Registro de pausas
- ✅ `practicas` - Registro de prácticas
- ✅ `frases_nivel` - Frases por nivel (sincronizadas desde ClickUp)
- ✅ `niveles_fases` - Fases del sistema (5 fases configuradas)

**Fases configuradas:**
- sanación (niveles 1-6)
- sanación avanzada (niveles 7-9)
- canalización (niveles 10-15)
- creación (sin límites)
- servicio (sin límites)

### 🔄 Sincronización de Frases

**Estado:** ✅ Funcionando

El sistema sincroniza automáticamente las frases desde ClickUp a PostgreSQL:
- **Frecuencia:** Diaria a las 4:00 AM (configurado en scheduler)
- **Proceso:** Lee todas las listas "Nivell X" desde el folder configurado
- **Resultado:** 5 frases sincronizadas exitosamente en la prueba

**Comando manual para sincronizar:**
```bash
cd /var/www/aurelinportal
node scripts/test-sincronizacion-frases.js
```

### 🌐 URLs Operativas

- **Portal:** https://portal.pdeeugenihidalgo.org
- **Webhook Kajabi:** https://webhook-kajabi.pdeeugenihidalgo.org/kajabi-webhook
- **Webhook Typeform:** https://webhook-typeform.pdeeugenihidalgo.org/typeform-webhook
- **Admin:** https://admin.pdeeugenihidalgo.org/health-check

### 📝 Notas Importantes

1. **Propagación DNS:** Los subdominios pueden tardar 1-5 minutos en propagarse completamente
2. **Proxy Cloudflare:** Todos los subdominios deben tener el proxy activado (🟠 Proxied) para SSL automático
3. **Sincronización de frases:** Se ejecuta automáticamente cada día a las 4:00 AM
4. **Router:** El router detecta automáticamente los subdominios y enruta las peticiones correctamente

### 🚀 Próximos Pasos

1. **Configurar webhooks en Kajabi:**
   - URL: `https://webhook-kajabi.pdeeugenihidalgo.org/kajabi-webhook`
   - Eventos: `purchase`, `subscription_activated`, `subscription_deactivated`, `subscription_cancelled`

2. **Configurar webhook en Typeform:**
   - URL: `https://webhook-typeform.pdeeugenihidalgo.org/typeform-webhook`
   - Evento: `form_response`

3. **Verificar subdominios:**
   ```bash
   curl https://portal.pdeeugenihidalgo.org/health-check
   curl https://admin.pdeeugenihidalgo.org/health-check
   ```

4. **Probar sincronización de frases:**
   ```bash
   cd /var/www/aurelinportal
   node scripts/test-sincronizacion-frases.js
   ```

---

### 🔒 Estado del Repositorio Git

**Versión:** 4.3.0  
**Estado:** ✅ Repositorio limpio y profesional

**Configuración Git:**
- ✅ `node_modules/` y artefactos locales NO se versionan
- ✅ Variables de entorno (`.env*`) excluidas del control de versiones
- ✅ Logs y archivos temporales ignorados
- ✅ Repositorio preparado para trabajo continuo con Cursor y agentes IA
- ✅ `.gitignore` completo y defensivo

**Verificación:**
- Working tree limpio
- Sin archivos sensibles trackeados
- Tamaño del repositorio optimizado

---

**Fecha de configuración:** $(date)  
**Versión:** 4.0.0  
**Estado:** ✅ OPERATIVO

