# Diagnóstico SSH - Estado Actual

**Fecha:** 2024-12-04  
**Problema:** Permission denied al intentar conectar desde Hetzner a servidor "dani"

## ✅ Lo que SÍ funciona

1. **Red/Tailscale:** ✅ Conectado a `DESKTOP-ON51NHF` (IP: 100.68.108.36)
2. **Clave privada:** ✅ Existe y tiene permisos correctos (`/root/.ssh/id_rsa_eugeni`)
3. **Clave pública:** ✅ Formato correcto (758 caracteres, fingerprint: `SHA256:edqNBQ6bDuNFwZ592rLmM8eScl7G6+2sWr8/GBzjHxI`)
4. **SSH ofrece la clave:** ✅ El cliente SSH está enviando la clave correctamente

## ❌ Lo que NO funciona

1. **Servidor rechaza la clave:** El servidor "dani" rechaza la clave pública aunque está en `authorized_keys`

## 🔍 Información del Log SSH (desde Hetzner)

```
debug1: Offering public key: /root/.ssh/id_rsa_eugeni RSA SHA256:edqNBQ6bDuNFwZ592rLmM8eScl7G6+2sWr8/GBzjHxI explicit
debug1: Authentications that can continue: publickey,password,keyboard-interactive
```

**Interpretación:** El servidor recibe la clave pero la rechaza. No hay mensaje de "Accepted publickey".

## 📋 Información Necesaria del Servidor "dani"

Para identificar el problema exacto, necesitamos ver los logs del servidor "dani" mientras intentamos conectarnos.

### Comando para ejecutar en el servidor "dani":

```bash
# Ver logs en tiempo real
sudo tail -f /var/log/auth.log

# O en algunos sistemas:
sudo journalctl -u ssh -f
```

### Mensajes clave a buscar:

1. **`Failed publickey for usuari from [IP]`**
   - Significa que la clave no coincide exactamente
   - Verificar formato de `authorized_keys`

2. **`Authentication refused: bad ownership or modes`**
   - Significa que los permisos no son correctos
   - Verificar: `ls -la ~/.ssh/` debe mostrar `drwx------` y `-rw-------`

3. **`Connection closed by [IP]`**
   - Significa que el servidor cerró la conexión
   - Puede ser configuración de firewall o SSH

4. **`Accepted publickey for usuari from [IP]`**
   - ✅ Conexión exitosa (esto es lo que queremos ver)

## 🔧 Verificaciones Adicionales en el Servidor "dani"

```bash
# 1. Verificar que la clave está exactamente igual
cat ~/.ssh/authorized_keys | grep "aurelinportal-to-eugeni"

# 2. Verificar fingerprint (debe coincidir)
ssh-keygen -lf ~/.ssh/authorized_keys | grep "edqNBQ6bDuNFwZ592rLmM8eScl7G6+2sWr8/GBzjHxI"

# 3. Verificar que está en UNA SOLA LÍNEA
cat ~/.ssh/authorized_keys | grep "aurelinportal" | wc -l
# Debe mostrar: 1

# 4. Verificar formato exacto (sin espacios extra)
cat ~/.ssh/authorized_keys | grep "aurelinportal" | cat -A
# No debe haber espacios o caracteres raros

# 5. Verificar permisos EXACTOS
ls -la ~/.ssh/
# Debe mostrar:
# drwx------ .ssh
# -rw------- authorized_keys

# 6. Verificar configuración SSH
sudo grep -E "^PubkeyAuthentication|^AuthorizedKeysFile" /etc/ssh/sshd_config
# Debe mostrar:
# PubkeyAuthentication yes
# AuthorizedKeysFile .ssh/authorized_keys

# 7. Reiniciar SSH si se hicieron cambios
sudo systemctl restart ssh
```

## 🎯 Próximos Pasos

1. **En el servidor "dani":** Ejecutar `sudo tail -f /var/log/auth.log`
2. **Desde Hetzner:** Intentar conectar: `ssh -v -i /root/.ssh/id_rsa_eugeni usuari@DESKTOP-ON51NHF "echo OK"`
3. **En los logs del servidor "dani":** Buscar el mensaje exacto que aparece cuando se rechaza la conexión
4. **Compartir el mensaje del log** para identificar la causa exacta

## 📝 Clave Pública que Debe Estar en authorized_keys

```
ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQDWvDFGHVwyDJILDc46r1lJcA8GzJaT0J4A87DC4A4XPCnwWfsBp13BY0bsYEI037H9rtsTgNzulDhelOUNKynkQe672a4+aND0mF1t4oD4nzKL+qnhZZkm/m+SVhmQBgibmzwYVvXqFHbiCNV+Eoa4ndsZrd4Xt9qD1J9axk1HnoW4I5bM8Dna24SR4KEUhaiJwKDhynuLpjCyKHNMeNTGdqkl/4yP/stoW2s6wYDz386YCQ1urgkD4GoDlCAB1LyWdQ2iuZyCetO4basxrXVElGCed+nvmhW8lSlsfqWk50QoUii4przYNDwxogh+efaOKlNykoMadqJW/sq8iHXOUngM4apJ4s9U5o584/ivjHvSRxX2pCPQaLdSfUvyhrIXtYwTj66u14VU65GOAM31/JM+i+/YMToKyOVqRFwTlxFbdHiII2aKcYi2TPyb4Vscc/Aeas9NKTpYW6YYuAW1XlldBQtwnfEdezBzJQMn6NGEHA0U0EQcfGnojF4OqNMmNVTonQNCYkNXAUk6Y2LXkPEBqbuGGAkuCNrjS/nYGmBBIySZLZCAjZNj7kAjB+PFwY1SsDcTZek04Kq/tgUWDkOr3AE8MqcjuMqqdzaaOFaSwzlE+XXI5AsXtcYAwTBu4yXr00IbEQnMzRZaK5Qar0foterJ/cDalzXmKM1HjQ== aurelinportal-to-eugeni-20251204
```

**Fingerprint:** `4096 SHA256:edqNBQ6bDuNFwZ592rLmM8eScl7G6+2sWr8/GBzjHxI`

---

**Nota:** El problema está en el servidor "dani" rechazando la clave. Los logs del servidor mostrarán el motivo exacto.

