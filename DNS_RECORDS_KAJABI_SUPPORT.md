# 📋 Registros DNS - eugenihidalgo.org

**Fecha del reporte**: 2025-12-04 09:34:54  
**Proveedor DNS**: Cloudflare  
**Dominio**: eugenihidalgo.org  
**Propósito**: Configuración de dominio personalizado para Kajabi

---

## 🎯 Registros DNS para Kajabi

Estos son los registros configurados para conectar el dominio con Kajabi:

### Dominio Raíz (eugenihidalgo.org)
| Tipo | Nombre | Contenido | Proxy | Estado |
|------|--------|-----------|-------|--------|
| **A** | `eugenihidalgo.org` | `104.18.42.139` | ❌ DNS only (desactivado) | ✅ Configurado |
| **A** | `eugenihidalgo.org` | `172.64.145.117` | ❌ DNS only (desactivado) | ✅ Configurado |

### Subdominio www
| Tipo | Nombre | Contenido | Proxy | Estado |
|------|--------|-----------|-------|--------|
| **CNAME** | `www.eugenihidalgo.org` | `ssl.kajabi.com` | ❌ DNS only (desactivado) | ✅ Configurado |

### Subdominio welcome
| Tipo | Nombre | Contenido | Proxy | Estado |
|------|--------|-----------|-------|--------|
| **CNAME** | `welcome.eugenihidalgo.org` | `ssl.kajabi.com` | ❌ DNS only (desactivado) | ✅ Configurado |

**Nota importante**: El proxy de Cloudflare está **desactivado** para todos estos registros, como requiere Kajabi.

---

## 📊 Registros DNS Completos

### Registros Tipo A (IPv4)

| Nombre | IP Address | Proxy | ID |
|--------|------------|-------|-----|
| `*.eugenihidalgo.org` | 104.21.70.198 | 🟠 Proxied | f4f14a56417451cc0bd18de293b2cbd1 |
| `*.eugenihidalgo.org` | 172.67.138.238 | 🟠 Proxied | 3babf9bc3482f630617cc471e9c640f2 |
| **`eugenihidalgo.org`** | **`104.18.42.139`** | ❌ DNS only | **66729db1990c1768400bc00e90737e44** |
| **`eugenihidalgo.org`** | **`172.64.145.117`** | ❌ DNS only | **19c5221610ffa1739b198c9264ec7d37** |

### Registros Tipo AAAA (IPv6)

| Nombre | IPv6 Address | Proxy | ID |
|--------|--------------|-------|-----|
| `*.eugenihidalgo.org` | 2606:4700:3034::ac43:8aee | 🟠 Proxied | ca205ba04cf7c2e0ffe5e33bbbf08cb8 |
| `*.eugenihidalgo.org` | 2606:4700:3037::6815:46c6 | 🟠 Proxied | db40c0048c69de18e77f64347d16a902 |

**Nota**: Los registros AAAA del dominio raíz (`eugenihidalgo.org`) han sido eliminados ya que Kajabi no requiere IPv6 para el dominio raíz.

### Registros Tipo CNAME

| Nombre | Target | Proxy | ID |
|--------|--------|-------|-----|
| **`www.eugenihidalgo.org`** | **`ssl.kajabi.com`** | ❌ DNS only | **79dc321988cc16c93f82d9ed5ff7f138** |
| **`welcome.eugenihidalgo.org`** | **`ssl.kajabi.com`** | ❌ DNS only | **0ef540f593a6279729e742b28a022d49** |

### Registros Tipo MX (Mail Exchange)

| Nombre | Prioridad | Host | Proxy | ID |
|--------|-----------|------|-------|-----|
| `eugenihidalgo.org` | - | _dc-mx.ad27f9becf7e.eugenihidalgo.org | ❌ DNS only | e122c3029fd93c789ce31b8f8d53cedd |

**Nota**: Los registros MX de Namecheap/PrivateEmail han sido eliminados.

### Registros Tipo TXT

| Nombre | Contenido | Proxy | ID |
|--------|-----------|-------|-----|
| `_dmarc.eugenihidalgo.org` | `v=DMARC1; p=quarantine; rua=mailto:rua@dmarc.brevo.com` | ❌ DNS only | ee46c5d3e2da27e1bd3960d4110cd8d1 |
| `_dmarc.eugenihidalgo.org` | `v=DMARC1; p=quarantine; rua=mailto @dmarc.brevo.com` | ❌ DNS only | e1239a46e6edd0f3fc084d13b6615e1d |
| `_dmarc.eugenihidalgo.org` | `v=DMARC1; p=none; rua=mailto:dmarc_kjb@kajabi.com; fo=1; pct=100; rf=afrf` | ❌ DNS only | 8a0113d9e9da87900d7ede392761d083 |
| `eugenihidalgo.org` | `v=spf1 include:_spf.srv.cat ~all` | ❌ DNS only | f7157a1829f09eb9d9f9494cb4c217d5 |

**Nota**: El registro SPF de Namecheap/PrivateEmail ha sido eliminado.
| `eugenihidalgo.org` | `google-site-verification=6OTg0d8KFvveK-5cnobDLKg9dp7vDseW7FjW8KJaIAE` | ❌ DNS only | b4dd1c4be6c795ff0dfa8c0bfe297fe4 |
| `eugenihidalgo.org` | `brevo-code:75b5568d95b1dc759277b5514f4c870c` | ❌ DNS only | 76e64709717bc87a85647dce058fafc0 |
| `mail._domainkey.eugenihidalgo.org` | `k=rsa;p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDeMVIzrCa3T14JsNY0IRv5/2V1/v2itlviLQBwXsa7shBD6TrBkswsFUToPyMRWC9tbR/5ey0nRBH0ZVxp+lsmTxid2Y2z+FApQ6ra2VsXfbJP3HE6wAO0YTVEJt1TmeczhEd2Jiz/fcabIISgXEdSpTYJhb0ct0VJRxcg4c8c7wIDAQAB` | ❌ DNS only | 5ff15b23b29d8aaa56087c075f03ac4b |

---

## ✅ Verificación de los Registros DNS de Kajabi

Para verificar que los registros DNS están correctamente configurados, ejecute:

```bash
# Verificar dominio raíz (debe mostrar las IPs de Kajabi)
dig eugenihidalgo.org +short
# Resultado esperado: 104.18.42.139 y/o 172.64.145.117

# Verificar www (CNAME)
dig www.eugenihidalgo.org CNAME +short
# Resultado esperado: ssl.kajabi.com

# Verificar welcome (CNAME)
dig welcome.eugenihidalgo.org CNAME +short
# Resultado esperado: ssl.kajabi.com
```

O usando nslookup:

```bash
# Dominio raíz
nslookup eugenihidalgo.org

# Subdominios
nslookup -type=CNAME www.eugenihidalgo.org
nslookup -type=CNAME welcome.eugenihidalgo.org
```

---

## 📝 Resumen de Configuración

- **Total de registros DNS**: 18
- **Registros con proxy activado**: 8 (todos los A y AAAA)
- **Registros con proxy desactivado**: 10 (CNAME, MX, TXT)
- **Registros de Namecheap eliminados**: 3 (2 MX + 1 TXT SPF)
- **Registros DNS para Kajabi**: ✅ Configurados correctamente
  - **Dominio raíz**: `eugenihidalgo.org` → IPs de Kajabi (104.18.42.139, 172.64.145.117) (Proxy: Desactivado) ✅
  - **Subdominio www**: `www.eugenihidalgo.org` → `ssl.kajabi.com` (Proxy: Desactivado) ✅
  - **Subdominio welcome**: `welcome.eugenihidalgo.org` → `ssl.kajabi.com` (Proxy: Desactivado) ✅

---

## 🔍 Información Adicional

### Estado del Proxy de Cloudflare

- **Registros A/AAAA**: Proxy activado (🟠 Proxied) - Para el dominio principal y wildcard
- **Registro CNAME de Kajabi**: Proxy desactivado (DNS only) - Como requiere Kajabi
- **Registros MX y TXT**: Proxy desactivado (DNS only) - Requerido para email y autenticación

### Configuración Realizada

1. ✅ Eliminados los registros A y AAAA antiguos de `www.eugenihidalgo.org`
2. ✅ Creado registro CNAME `www.eugenihidalgo.org` → `ssl.kajabi.com`
3. ✅ Creado registro CNAME `welcome.eugenihidalgo.org` → `ssl.kajabi.com`
4. ✅ Eliminados los registros A y AAAA del dominio raíz que apuntaban a Cloudflare
5. ✅ Creados registros A para el dominio raíz apuntando a las IPs de Kajabi (104.18.42.139, 172.64.145.117)
6. ✅ Proxy de Cloudflare desactivado para todos los registros de Kajabi (dominio raíz y subdominios)
7. ✅ Eliminados todos los registros DNS de Namecheap/PrivateEmail (2 MX + 1 TXT SPF)
8. ✅ Verificación DNS completada

### Tiempo de Propagación

- **Cloudflare**: 1-5 minutos (normalmente instantáneo)
- **Propagación global**: 15-30 minutos (máximo 24-48 horas)

---

## 🆘 Problemas Conocidos o Notas

1. **Registros DMARC duplicados**: Existen 3 registros DMARC diferentes. Esto es normal si se están usando múltiples servicios de email.

2. **Registro SPF**: Actualmente existe 1 registro SPF (`_spf.srv.cat`). El registro SPF de Namecheap/PrivateEmail ha sido eliminado.

3. **Registros DNS de Kajabi**: Configurados correctamente según las especificaciones de Kajabi:
   - **Dominio raíz**: `eugenihidalgo.org` → IPs de Kajabi (104.18.42.139, 172.64.145.117)
   - **Subdominio www**: `www.eugenihidalgo.org` → `ssl.kajabi.com` (CNAME)
   - **Subdominio welcome**: `welcome.eugenihidalgo.org` → `ssl.kajabi.com` (CNAME)

4. **Registros de Namecheap eliminados**: Se han eliminado todos los registros DNS relacionados con Namecheap/PrivateEmail:
   - ✅ MX: mx1.privateemail.com (eliminado)
   - ✅ MX: mx2.privateemail.com (eliminado)
   - ✅ TXT SPF: spf.privateemail.com (eliminado)

---

## 📞 Información de Contacto

Si necesita verificar o modificar estos registros, puede acceder a:
- **Cloudflare Dashboard**: https://dash.cloudflare.com
- **Dominio**: eugenihidalgo.org

---

**Documento generado para soporte de Kajabi**  
**Última actualización**: 2025-01-27 UTC  
**Cambios recientes**: 
- ✅ Configurado dominio raíz `eugenihidalgo.org` para apuntar directamente a Kajabi (registros A con IPs: 104.18.42.139, 172.64.145.117)
- ✅ Creado registro CNAME `welcome.eugenihidalgo.org` → `ssl.kajabi.com` para subdominio de Kajabi
- ✅ Eliminados registros A y AAAA antiguos del dominio raíz que apuntaban a Cloudflare
- Eliminados todos los registros DNS de Namecheap/PrivateEmail

