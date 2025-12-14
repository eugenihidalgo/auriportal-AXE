# 🚨 Solució: Email Bloquejat per Gmail

## Problema

Gmail està bloquejant els emails perquè el domini `eugenihidalgo.org` no té configurats SPF i DKIM.

**Error**: `550-5.7.26 Your email has been blocked because the sender is unauthenticated`

## Solució Ràpida

Has de configurar **SPF** i **DKIM** al DNS del teu domini `eugenihidalgo.org`.

### Passos Ràpids:

1. **Determinar on està gestionat el domini**:
   - Si està a **Namecheap**: Seguir l'Opció 1 de `CONFIGURAR_SPF_DKIM.md`
   - Si està a **Cloudflare**: Seguir l'Opció 2 de `CONFIGURAR_SPF_DKIM.md`

2. **Configurar SPF**:
   - Afegir registre TXT: `v=spf1 include:spf.privateemail.com ~all`

3. **Configurar DKIM**:
   - Obtenir claus DKIM del panell de PrivateEmail
   - Afegir registre TXT amb la clau DKIM

4. **Esperar propagació** (15-30 minuts)

5. **Provar de nou**:
   ```bash
   cd /var/www/aurelinportal
   # Usa el servicio de email desde tu código
   ```

## Documentació Completa

Per instruccions detallades, veure: **`CONFIGURAR_SPF_DKIM.md`**

## Verificació Ràpida

Després de configurar, verifica:

```bash
# Verificar SPF
dig TXT eugenihidalgo.org +short

# Verificar DKIM (ajusta el nom si és diferent)
dig TXT default._domainkey.eugenihidalgo.org +short
```

---

**Una vegada configurat, els emails arribaran correctament a Gmail!** ✅






