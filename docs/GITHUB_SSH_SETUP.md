# Configuración SSH para GitHub - AuriPortal

## Fecha de Configuración
Configurado el: $(date +"%Y-%m-%d %H:%M:%S")

## Resumen
Este servidor está configurado para acceder al repositorio GitHub `auriportal-AXE` mediante SSH, permitiendo operaciones `git pull`, `git push` y `git tag push` sin requerir credenciales.

## Clave SSH Utilizada
- **Tipo**: ED25519
- **Archivo privado**: `~/.ssh/id_ed25519_auriportal`
- **Archivo público**: `~/.ssh/id_ed25519_auriportal.pub`
- **Comentario**: `auriportal-server`
- **Fingerprint**: `SHA256:Yt4m/9vEVrpd3mBJ9LsGTf9pGAu/VckyQbk3OrUAAPo`

## Clave Pública para GitHub

**IMPORTANTE**: Esta clave debe estar agregada en GitHub → Settings → SSH Keys → New key

```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAINnzKsdPNojHjWudtSpgzSjv6HFjN+lhuJ3X139pIU6C auriportal-server
```

## Configuración SSH

El archivo `~/.ssh/config` incluye la siguiente configuración para GitHub:

```
Host github.com
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519_auriportal
    IdentitiesOnly yes
    StrictHostKeyChecking accept-new
```

## Remote del Repositorio

El repositorio está configurado con el siguiente remote:

```bash
origin  git@github.com:eugenihidalgo/auriportal-AXE.git (fetch)
origin  git@github.com:eugenihidalgo/auriportal-AXE.git (push)
```

## Verificación

Para verificar que la configuración funciona:

```bash
# Probar conexión SSH
ssh -T git@github.com

# Verificar remote
cd /var/www/aurelinportal
git remote -v

# Verificar que ssh-agent tiene la clave
ssh-add -l
```

## Operaciones Disponibles

Una vez configurada la clave en GitHub, el servidor puede realizar:

- ✅ `git pull` - Sin pedir credenciales
- ✅ `git push` - Sin pedir credenciales
- ✅ `git push --tags` - Sin pedir credenciales
- ✅ Operaciones desde Cursor IDE - Sin intervención humana

## Notas Importantes

1. **No requiere tokens**: Esta configuración usa SSH, no requiere tokens de acceso personal (PAT)
2. **Sin passphrase**: La clave no tiene passphrase para permitir operaciones automáticas
3. **Clave dedicada**: Esta clave está dedicada exclusivamente para este servidor y el repositorio AuriPortal
4. **Seguridad**: La clave privada (`id_ed25519_auriportal`) nunca debe compartirse ni exponerse

## Troubleshooting

### Si `git push` falla con "Permission denied"

1. Verificar que la clave pública está agregada en GitHub
2. Verificar que ssh-agent tiene la clave cargada: `ssh-add -l`
3. Si no está cargada: `ssh-add ~/.ssh/id_ed25519_auriportal`
4. Probar conexión: `ssh -T git@github.com`

### Si ssh-agent no persiste entre sesiones

Agregar al `~/.bashrc` o `~/.profile`:

```bash
eval "$(ssh-agent -s)" > /dev/null
ssh-add ~/.ssh/id_ed25519_auriportal 2>/dev/null
```

## Estado Actual

- ✅ Clave SSH creada
- ✅ SSH config configurado
- ✅ Remote del repo configurado
- ⏳ **PENDIENTE**: Agregar clave pública en GitHub
- ⏳ **PENDIENTE**: Verificar push de prueba

---

**Última actualización**: $(date +"%Y-%m-%d %H:%M:%S")




