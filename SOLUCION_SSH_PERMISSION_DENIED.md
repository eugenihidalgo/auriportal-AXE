# Solución: Permission Denied en SSH

## 🔍 Diagnóstico Actual

- ✅ Clave privada existe: `/root/.ssh/id_rsa_eugeni`
- ✅ Clave pública coincide con la de `authorized_keys`
- ✅ Permisos correctos (600 para clave, 700 para .ssh)
- ✅ Tailscale conectado a `DESKTOP-ON51NHF`
- ❌ SSH rechaza la conexión: "Permission denied (publickey,password,keyboard-interactive)"

## 🔧 Soluciones a Probar en el Servidor "dani"

### 1. Verificar y Corregir el Formato de `authorized_keys`

En el servidor dani, ejecuta:

```bash
# Verificar el contenido exacto
cat ~/.ssh/authorized_keys

# Verificar que cada línea termina correctamente (sin espacios extra)
cat ~/.ssh/authorized_keys | od -c | tail -5

# Si hay problemas, recrear el archivo
cd ~/.ssh
cp authorized_keys authorized_keys.backup
# Editar manualmente para asegurar que cada clave está en una sola línea
nano authorized_keys
# Guardar y verificar permisos
chmod 600 authorized_keys
```

### 2. Verificar Configuración SSH del Servidor

```bash
# Verificar que PubkeyAuthentication está habilitado
sudo grep -E "^PubkeyAuthentication|^#PubkeyAuthentication" /etc/ssh/sshd_config
# Debe mostrar: PubkeyAuthentication yes (sin #)

# Verificar AuthorizedKeysFile
sudo grep -E "^AuthorizedKeysFile|^#AuthorizedKeysFile" /etc/ssh/sshd_config
# Debe mostrar: AuthorizedKeysFile .ssh/authorized_keys (o similar)

# Verificar que el usuario tiene permisos
ls -la ~/.ssh/
# Debe mostrar:
# drwx------ .ssh
# -rw------- authorized_keys
```

### 3. Reiniciar el Servicio SSH

```bash
# Reiniciar SSH (esto aplica cambios de configuración)
sudo systemctl restart ssh
# O en algunos sistemas:
sudo systemctl restart sshd
```

### 4. Verificar Logs de Autenticación

Mientras intentas conectarte desde Hetzner, en el servidor dani ejecuta:

```bash
# Ver logs en tiempo real
sudo tail -f /var/log/auth.log
# O en algunos sistemas:
sudo journalctl -u ssh -f
```

Busca mensajes como:
- `Accepted publickey for usuari`
- `Failed publickey for usuari`
- `Authentication refused: bad ownership or modes`

### 5. Verificar que la Clave Pública Está Correctamente Formateada

En el servidor dani:

```bash
# Verificar que la clave está en una sola línea
cat ~/.ssh/authorized_keys | grep "aurelinportal-to-eugeni" | wc -l
# Debe mostrar: 1

# Verificar que no hay espacios extra al inicio/final
cat ~/.ssh/authorized_keys | grep "aurelinportal-to-eugeni" | cat -A
# No debe haber espacios o caracteres extraños

# Verificar el fingerprint
ssh-keygen -lf ~/.ssh/authorized_keys | grep "aurelinportal"
# Debe mostrar: 4096 SHA256:edqNBQ6bDuNFwZ592rLmM8eScl7G6+2sWr8/GBzjHxI
```

### 6. Probar con ssh-copy-id (Alternativa)

Si todo lo anterior falla, intenta desde el servidor de Hetzner:

```bash
# Esto debería agregar la clave automáticamente
ssh-copy-id -i /root/.ssh/id_rsa_eugeni.pub usuari@DESKTOP-ON51NHF
```

**Nota:** Esto requerirá autenticación por contraseña la primera vez.

## 🔍 Verificación desde el Servidor de Hetzner

Después de hacer cambios en el servidor dani, prueba:

```bash
# Prueba básica
ssh -i /root/.ssh/id_rsa_eugeni usuari@DESKTOP-ON51NHF "echo 'OK'"

# Prueba con más verbosidad
ssh -vv -i /root/.ssh/id_rsa_eugeni usuari@DESKTOP-ON51NHF "echo 'OK'" 2>&1 | grep -E "(Offering|Accepted|Failed|Permission)"
```

## 📋 Checklist Final

- [ ] `authorized_keys` tiene formato correcto (una línea por clave)
- [ ] Permisos de `~/.ssh` son `700` (drwx------)
- [ ] Permisos de `authorized_keys` son `600` (-rw-------)
- [ ] `PubkeyAuthentication yes` en `/etc/ssh/sshd_config`
- [ ] Servicio SSH reiniciado después de cambios
- [ ] Logs de SSH verificados para ver el error exacto
- [ ] Clave pública coincide exactamente (sin espacios extra)

## 🚨 Si Nada Funciona

Si después de todos estos pasos sigue fallando, puede ser necesario:

1. **Verificar que el usuario `usuari` existe y tiene shell válido:**
   ```bash
   grep usuari /etc/passwd
   ```

2. **Verificar que no hay restricciones de IP en SSH:**
   ```bash
   sudo grep -E "AllowUsers|DenyUsers|AllowGroups|DenyGroups" /etc/ssh/sshd_config
   ```

3. **Probar con otra clave temporal:**
   ```bash
   # En Hetzner: generar nueva clave
   ssh-keygen -t ed25519 -f /root/.ssh/id_ed25519_test -N ""
   
   # En dani: agregar la nueva clave
   cat /root/.ssh/id_ed25519_test.pub >> ~/.ssh/authorized_keys
   
   # Probar conexión
   ssh -i /root/.ssh/id_ed25519_test usuari@DESKTOP-ON51NHF "echo OK"
   ```

---

**Última actualización:** 2024-12-04

