# 🚀 Comandos Exactos para Conectar AuriPortal a GitHub

**Versión:** 4.3.0  
**Propósito:** Guía rápida con comandos copiar-pegar

---

## ⚡ Inicio Rápido

### Opción 1: Script Automático (Recomendado)

```bash
cd /var/www/aurelinportal
./SETUP_GITHUB.sh
```

El script te guiará paso a paso y verificará la seguridad.

---

## 📝 Opción 2: Comandos Manuales (Paso a Paso)

### Paso 1: Preparar el Repositorio Local

```bash
# Ir al directorio del proyecto
cd /var/www/aurelinportal

# Verificar estado actual
git status

# Si hay cambios importantes, commitearlos:
git add .
git commit -m "chore: preparar repo para GitHub (tests y CI configurados)"

# Si hay cambios que no quieres, descartarlos:
git restore .  # ⚠️ CUIDADO: esto elimina cambios no commitados
```

### Paso 2: Renombrar Rama Master → Main

```bash
# Ver en qué rama estás
git branch

# Si estás en 'master', renombrar a 'main'
git branch -m master main

# Verificar el cambio
git branch
# Debe mostrar: * main
```

### Paso 3: Verificar Seguridad (CRÍTICO)

```bash
# Verificar que .env NO está siendo rastreado
git ls-files | grep "^\.env$"

# Si aparece algo, ERROR: eliminar del tracking
git rm --cached .env

# Verificar que .env.example SÍ existe y está rastreado
git ls-files | grep "\.env.example"
# Debe mostrar: .env.example

# Verificar que .gitignore protege .env
grep "^\.env$" .gitignore
# Debe mostrar: .env
```

### Paso 4: Crear Repositorio en GitHub

**Acción manual en el navegador:**

1. Abre: https://github.com/new
2. Completa:
   - **Repository name:** `auriportal`
   - **Description:** `Portal de Aurelín - Sistema de gestión v4.3.0`
   - **Visibility:** ✅ **Private**
   - ❌ NO marques "Add a README file"
   - ❌ NO marques "Add .gitignore"
   - ❌ NO marques "Choose a license"
3. Haz clic en **"Create repository"**

### Paso 5: Conectar Repositorio Local con GitHub

**Reemplaza `TU_USUARIO` con tu nombre de usuario de GitHub:**

```bash
# Añadir el remoto
git remote add origin https://github.com/TU_USUARIO/auriportal.git

# Verificar que se añadió correctamente
git remote -v
# Debe mostrar:
# origin  https://github.com/TU_USUARIO/auriportal.git (fetch)
# origin  https://github.com/TU_USUARIO/auriportal.git (push)
```

**Si ya existe un remoto 'origin':**

```bash
# Ver el remoto actual
git remote get-url origin

# Cambiarlo si es necesario
git remote set-url origin https://github.com/TU_USUARIO/auriportal.git
```

### Paso 6: Primer Push a GitHub

```bash
# Subir la rama main a GitHub
git push -u origin main
```

**Si te pide credenciales:**

- **Username:** Tu nombre de usuario de GitHub
- **Password:** Usa un **Personal Access Token** (NO tu contraseña)

**Cómo crear un Personal Access Token:**

1. Ve a: https://github.com/settings/tokens
2. Click en **"Generate new token"** → **"Generate new token (classic)"**
3. Configura:
   - **Note:** `AuriPortal - Acceso repositorio`
   - **Expiration:** Elige según tu preferencia (90 días, 1 año, sin expiración)
   - **Scopes:** ✅ Marca `repo` (esto da acceso completo a repositorios)
4. Haz clic en **"Generate token"**
5. **COPIA EL TOKEN INMEDIATAMENTE** (solo se muestra una vez)
6. Úsalo como contraseña al hacer push

---

## 🛡️ Configurar Protecciones de Rama (UNA SOLA VEZ)

**IMPORTANTE:** Haz esto DESPUÉS del primer push, directamente en GitHub.

### Paso 1: Acceder a Configuración de Ramas

1. Ve a tu repositorio: https://github.com/TU_USUARIO/auriportal
2. Click en **Settings** (arriba a la derecha)
3. En el menú lateral izquierdo, click en **Branches**
4. En "Branch protection rules", click en **"Add branch protection rule"**

### Paso 2: Configurar la Regla

**Branch name pattern:**
```
main
```

**Activar estas opciones:**

✅ **Require a pull request before merging**
   - ✅ Require approvals: `1`
   - ✅ Dismiss stale pull request approvals when new commits are pushed
   
✅ **Require status checks to pass before merging**
   - ✅ Require branches to be up to date before merging
   - En el dropdown "Status checks that are required", busca y selecciona:
     - `test / Tests y Linter (18.x)`
     - `test / Tests y Linter (20.x)` (si aparece después del primer push)
   
✅ **Do not allow bypassing the above settings**
   
✅ **Include administrators**

### Paso 3: Guardar

Click en **"Create"** o **"Save changes"**

---

## ✅ Verificación Final

### Verificar que Todo Está Bien

```bash
# 1. Verificar que estás en main
git branch
# Debe mostrar: * main

# 2. Verificar remoto configurado
git remote -v
# Debe mostrar origin con la URL de GitHub

# 3. Verificar que .env NO está rastreado
git ls-files | grep "^\.env$"
# No debe mostrar nada

# 4. Verificar que .env.example SÍ está rastreado
git ls-files | grep "\.env.example"
# Debe mostrar: .env.example

# 5. Sincronizar con GitHub
git fetch origin
git status
# Debe mostrar: "Your branch is up to date with 'origin/main'"
```

### Verificar en GitHub (Navegador)

1. Ve a: https://github.com/TU_USUARIO/auriportal
2. Verifica:
   - ✅ Todos los archivos están visibles
   - ✅ La rama principal se llama `main` (no `master`)
   - ✅ El archivo `.env.example` está visible
   - ✅ El archivo `.env` **NO** está visible (correcto)
   - ✅ En Settings → Branches, hay una regla de protección para `main`

---

## 🔄 Comandos de Uso Diario

### Crear una Nueva Funcionalidad

```bash
# 1. Actualizar main
git checkout main
git pull origin main

# 2. Crear rama nueva
git checkout -b feature/nombre-funcionalidad

# 3. Desarrollar y commitear
git add .
git commit -m "feat: descripción de la funcionalidad"

# 4. Subir a GitHub
git push -u origin feature/nombre-funcionalidad

# 5. Crear Pull Request en GitHub (en el navegador)
# 6. Después de fusionar, actualizar local
git checkout main
git pull origin main
```

### Hacer un Hotfix Urgente

```bash
# 1. Actualizar main
git checkout main
git pull origin main

# 2. Crear rama hotfix
git checkout -b hotfix/descripcion-bug

# 3. Corregir bug y commitear
git add .
git commit -m "fix: descripción del bug corregido"

# 4. Subir y crear PR
git push -u origin hotfix/descripcion-bug
```

---

## 🆘 Solución de Problemas Comunes

### Error: "remote origin already exists"

```bash
# Ver el remoto actual
git remote get-url origin

# Si necesitas cambiarlo
git remote set-url origin https://github.com/TU_USUARIO/auriportal.git
```

### Error: "Updates were rejected because the remote contains work"

```bash
# Descargar cambios de GitHub primero
git pull origin main --rebase

# Si hay conflictos, resolverlos, luego:
git push origin main
```

### Error: "fatal: refusing to merge unrelated histories"

```bash
git pull origin main --allow-unrelated-histories
```

### Error: "Permission denied (publickey)" o problemas de autenticación

**Opción 1: Usar HTTPS con Personal Access Token (Recomendado)**
- Ya configurado arriba en Paso 6

**Opción 2: Configurar SSH (Alternativa)**
```bash
# Verificar si tienes clave SSH
ls -la ~/.ssh/id_rsa.pub

# Si no existe, generar una
ssh-keygen -t ed25519 -C "tu-email@ejemplo.com"

# Ver la clave pública
cat ~/.ssh/id_rsa.pub

# Copiar y añadir en GitHub: Settings → SSH and GPG keys → New SSH key

# Cambiar remoto a SSH
git remote set-url origin git@github.com:TU_USUARIO/auriportal.git
```

### Accidentally subí .env o un secreto

**PASO 1: ELIMINAR DEL REPOSITORIO (URGENTE)**

```bash
# Eliminar del historial de Git (mantiene el archivo local)
git rm --cached .env

# Commitear el cambio
git commit -m "chore: remover .env del tracking"

# Hacer push
git push origin main
```

**PASO 2: ROTAR TODOS LOS SECRETOS EXPUESTOS**
- Cambiar TODOS los tokens, contraseñas y claves que estaban en el archivo
- Actualizar en tu `.env` local
- Actualizar en el servidor de producción

**PASO 3: LIMPIAR HISTORIAL (Opcional, avanzado)**
- Requiere `git filter-branch` o `git filter-repo`
- Solo si el secreto estaba en commits antiguos
- Consulta documentación de GitHub para eliminar datos sensibles

---

## 📚 Referencias

- **Guía completa:** `GIT_WORKFLOW.md`
- **Script automático:** `./SETUP_GITHUB.sh`
- **GitHub Docs:** https://docs.github.com
- **Git Handbook:** https://guides.github.com/introduction/git-handbook/

---

**Última actualización:** 2024













