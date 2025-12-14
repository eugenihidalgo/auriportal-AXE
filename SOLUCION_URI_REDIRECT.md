# 🔧 Solució: URI de Redirecció

## ❌ Problema

L'URI de redirecció no coincideix amb el configurat a Zoho.

## ✅ Solucions

### Opció 1: Verificar URI Configurada a Zoho

1. Anar a: https://api-console.zoho.com/
2. Clicar a "AurelinPortal Email"
3. Buscar **"Authorized Redirect URIs"**
4. **Copiar exactament** l'URI que hi ha configurada (o les URIs si n'hi ha diverses)

### Opció 2: Afegir Nova URI a Zoho

Si no hi ha cap URI configurada o vols afegir-ne una nova:

1. A Zoho API Console → La teva aplicació
2. Buscar **"Authorized Redirect URIs"**
3. Clicar **"Add"** o **"Edit"**
4. Afegir una d'aquestes URIs:
   - `http://localhost:8080/callback`
   - `https://pdeeugenihidalgo.org/oauth/callback`
   - `urn:ietf:wg:oauth:2.0:oob`
5. **Guardar**

### Opció 3: Usar URI Localhost

Si tens accés al servidor, podem usar localhost:

**Afegir a Zoho:**
```
http://localhost:8080/callback
```

**URL d'autorització:**
```
https://accounts.zoho.com/oauth/v2/auth?client_id=1000.NOSOBATKRVURJKM2O5YOQ1IZSTNV3R&response_type=code&access_type=offline&redirect_uri=http://localhost:8080/callback&prompt=consent
```

Després d'autoritzar, Zoho et redirigirà a `http://localhost:8080/callback?code=...` i podràs copiar el code de la URL.

---

## 🚀 Solució Ràpida: Verificar i Usar URI Existents

**Quina URI tens configurada a Zoho API Console?**

Quan la sàpigues, actualitzaré el script per usar-la.

---

**Verifica a Zoho API Console quina URI tens configurada i digues-me quina és!** 🎯






