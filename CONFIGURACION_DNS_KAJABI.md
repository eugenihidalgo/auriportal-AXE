# 🌐 Configuración DNS para Kajabi - eugenihidalgo.org

## ✅ Estado Actual

**Registro CNAME configurado:**
- **Tipo**: CNAME
- **Nombre**: `www.eugenihidalgo.org`
- **Destino**: `ssl.kajabi.com`
- **Proxy**: ❌ Desactivado (DNS only) - **Requerido por Kajabi**

## 📋 Configuración Realizada

### Registro CNAME para www

Se ha creado el siguiente registro DNS en Cloudflare:

```
Tipo:     CNAME
Nombre:   www
Contenido: ssl.kajabi.com
Proxy:    DNS only (desactivado)
```

**Importante**: El proxy de Cloudflare está **desactivado** para este registro, como requiere Kajabi.

## 🔍 Verificación

Para verificar que el registro está configurado correctamente:

```bash
dig www.eugenihidalgo.org CNAME +short
```

Debería mostrar: `ssl.kajabi.com`

O usando el script:

```bash
node scripts/modificar-dns-cloudflare.js listar eugenihidalgo.org
```

## 📝 Próximos Pasos en Kajabi

1. **Accede a tu cuenta de Kajabi**
2. Ve a **Configuración** → **Dominio**
3. Selecciona **Configurar dominio personalizado**
4. Elige **"Crear un subdominio para mi sitio de Kajabi"**
5. Ingresa: `www.eugenihidalgo.org`
6. Kajabi verificará automáticamente el registro CNAME
7. Haz clic en **"Hecho, verificar subdominio"**

## ⏱️ Tiempo de Propagación

- **Cloudflare**: Normalmente 1-5 minutos
- **Propagación global**: 15-30 minutos (máximo 24-48 horas)

## 🔄 Redirección del Dominio Raíz (Opcional)

Si quieres que `eugenihidalgo.org` (sin www) también redirija a `www.eugenihidalgo.org`, puedes:

### Opción 1: Usar Cloudflare Page Rules (Recomendado)

1. Ve a Cloudflare Dashboard → **Rules** → **Page Rules**
2. Crea una nueva regla:
   - **URL**: `eugenihidalgo.org/*`
   - **Setting**: **Forwarding URL** → **301 - Permanent Redirect**
   - **Destination URL**: `https://www.eugenihidalgo.org/$1`
3. Guarda la regla

### Opción 2: Configurar en Kajabi

Kajabi también puede manejar el dominio raíz si configuras un registro A adicional, pero esto requiere coordinación con Kajabi.

## ⚠️ Notas Importantes

1. **No actives el proxy de Cloudflare** para el registro CNAME de Kajabi
2. El registro CNAME solo funciona para subdominios (www), no para el dominio raíz (@)
3. Si necesitas usar el dominio raíz, Kajabi puede proporcionar una IP específica para un registro A

## 🆘 Troubleshooting

### El dominio no se verifica en Kajabi

1. Verifica que el registro CNAME esté correcto:
   ```bash
   dig www.eugenihidalgo.org CNAME +short
   ```

2. Asegúrate de que el proxy esté desactivado (DNS only)

3. Espera 15-30 minutos para la propagación DNS

4. Verifica en Cloudflare que el registro esté guardado correctamente

### Error "CNAME already exists"

Si ves este error, significa que ya existe un registro A o CNAME para ese nombre. Elimínalo primero usando el script:

```bash
# Listar registros
node scripts/modificar-dns-cloudflare.js listar eugenihidalgo.org

# Eliminar registro específico
node scripts/modificar-dns-cloudflare.js eliminar RECORD_ID eugenihidalgo.org
```

## 📚 Referencias

- [Documentación de Kajabi sobre dominios personalizados](https://help.kajabi.com/hc/en-us/articles/1260801313510-How-to-Connect-a-Custom-Domain)
- [Cloudflare DNS Records](https://developers.cloudflare.com/dns/manage-dns-records/)

---

**Última actualización**: Configuración completada para `www.eugenihidalgo.org` → `ssl.kajabi.com`






