# 🔐 Configurar SSH con Tailscale para Servidor "dani"

## ⚠️ Problema Actual

El sistema no puede conectarse al servidor "dani" porque falta autenticación SSH:
```
Permission denied (publickey,password,keyboard-interactive)
```

## ✅ Solución: Configurar Clave SSH

### Opción 1: Generar Nueva Clave SSH (Recomendado)

1. **Generar clave SSH en el servidor actual:**
```bash
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_dani -N "" -C "clave-para-dani-$(date +%Y%m%d)"
chmod 600 ~/.ssh/id_ed25519_dani
chmod 644 ~/.ssh/id_ed25519_dani.pub
```

2. **Ver la clave pública:**
```bash
cat ~/.ssh/id_ed25519_dani.pub
```

3. **Copiar la clave pública al servidor "dani":**
   - Conéctate manualmente al servidor "dani" por Tailscale
   - Agrega la clave pública a `~/.ssh/authorized_keys` en el servidor dani
   - O usa: `ssh-copy-id -i ~/.ssh/id_ed25519_dani.pub usuari@DESKTOP-ON51NHF`

4. **Configurar en `.env`:**
```env
SSH_DANI_TAILSCALE_HOST=DESKTOP-ON51NHF
SSH_DANI_KEY_PATH=/root/.ssh/id_ed25519_dani
SSH_DANI_USER=usuari
SSH_DANI_PORT=22
```

### Opción 2: Usar Clave SSH Existente

Si ya tienes una clave SSH que funciona con el servidor "dani":

1. **Identificar la clave:**
```bash
# Probar con diferentes claves
ssh -i ~/.ssh/id_rsa usuari@DESKTOP-ON51NHF "echo 'OK'"
ssh -i ~/.ssh/id_ed25519 usuari@DESKTOP-ON51NHF "echo 'OK'"
```

2. **Configurar en `.env`:**
```env
SSH_DANI_TAILSCALE_HOST=DESKTOP-ON51NHF
SSH_DANI_KEY_PATH=/root/.ssh/id_rsa  # O la ruta de tu clave
SSH_DANI_USER=usuari
SSH_DANI_PORT=22
```

### Opción 3: Configurar SSH Config

Crear/editar `~/.ssh/config`:

```bash
Host dani
    HostName DESKTOP-ON51NHF
    User usuari
    Port 22
    IdentityFile ~/.ssh/id_ed25519_dani
    IdentitiesOnly yes
    StrictHostKeyChecking no
    UserKnownHostsFile /dev/null
```

Y luego usar `dani` como hostname en lugar de `DESKTOP-ON51NHF`.

## 🔍 Verificación

Después de configurar, prueba:

```bash
ssh -i ~/.ssh/id_ed25519_dani usuari@DESKTOP-ON51NHF "echo 'Conexión exitosa' && hostname"
```

Si funciona, el sistema podrá conectarse automáticamente.

## 📋 Resumen de Configuración

**Hostname Tailscale:** `DESKTOP-ON51NHF` (o `desktop-on51nhf`)  
**Usuario:** `usuari`  
**Puerto:** `22`  
**Clave SSH:** Necesita estar configurada en `.env` como `SSH_DANI_KEY_PATH`

---

**Una vez configurada la clave SSH, el sistema funcionará automáticamente.**

