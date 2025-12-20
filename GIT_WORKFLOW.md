# 🔄 Guía de Flujo de Trabajo Git - AuriPortal

**Versión:** 4.3.0  
**Última actualización:** 2024

---

## 📋 Tabla de Contenidos

1. [Introducción](#introducción)
2. [Estructura del Repositorio](#estructura-del-repositorio)
3. [Configuración Inicial](#configuración-inicial)
4. [Flujo de Trabajo Diario](#flujo-de-trabajo-diario)
5. [Protecciones de Rama](#protecciones-de-rama)
6. [Gestión de Secretos](#gestión-de-secretos)
7. [Comandos Útiles](#comandos-útiles)
8. [Solución de Problemas](#solución-de-problemas)

---

## 🎯 Introducción

Este documento explica cómo trabajar con Git y GitHub en AuriPortal de forma profesional y segura. Está diseñado para personas **no expertas** en Git, con explicaciones claras paso a paso.

### ¿Qué es Git?

Git es un sistema de control de versiones que:
- Guarda el historial de todos los cambios en tu código
- Permite trabajar en equipo sin conflictos
- Permite volver atrás si algo sale mal
- Mantiene sincronizado tu código local con GitHub

### ¿Qué es GitHub?

GitHub es un servicio en la nube que:
- Almacena una copia de tu código (backup)
- Permite trabajar en equipo
- Ejecuta tests automáticamente antes de aceptar cambios
- Protege el código de cambios accidentales

---

## 🏗️ Estructura del Repositorio

### Visibilidad del Repositorio

- **Tipo:** Repositorio **PRIVADO** 🔒
- Solo personas autorizadas pueden ver el código
- Los secretos y configuraciones sensibles están protegidos

### Ramas del Proyecto

El proyecto usa tres tipos de ramas:

#### 1. **`main`** (Rama Principal)
- ✅ Contiene el código **estable y funcionando**
- ✅ **NUNCA** se modifica directamente
- ✅ Solo se actualiza mediante Pull Requests (PRs) aprobados
- ✅ Protegida con tests obligatorios

#### 2. **`feature/`** (Ramas de Funcionalidades)
- Para desarrollar nuevas funcionalidades
- Ejemplos: `feature/nueva-funcionalidad`, `feature/mejora-login`
- Se crean desde `main`
- Se fusionan de vuelta a `main` mediante PR

#### 3. **`hotfix/`** (Ramas de Correcciones Urgentes)
- Para corregir bugs críticos en producción
- Ejemplos: `hotfix/correccion-bug-critico`
- Se crean desde `main`
- Se fusionan rápidamente a `main` después de pruebas

### Convención de Nombres

```
main                          # Rama principal (siempre estable)
feature/nombre-funcionalidad  # Nueva funcionalidad
hotfix/nombre-correccion      # Corrección urgente
```

---

## 🚀 Configuración Inicial

### Paso 1: Crear el Repositorio en GitHub

**Opción A: Desde la línea de comandos (recomendado)**

1. Inicia sesión en GitHub: https://github.com
2. Ve a tu perfil → "Repositories" → "New"
3. Configura el repositorio:
   - **Name:** `auriportal` (o el nombre que prefieras)
   - **Visibility:** ✅ **Private** (IMPORTANTE)
   - **Description:** "Portal de Aurelín - Sistema de gestión v4.3.0"
   - ❌ **NO marques** "Initialize with README" (ya tenemos código local)
   - ❌ **NO marques** "Add .gitignore" (ya tenemos uno)
   - ❌ **NO marques** "Choose a license" (ya lo configuramos)
4. Haz clic en "Create repository"

**Opción B: Usando GitHub CLI (si lo tienes instalado)**

```bash
gh repo create auriportal --private --source=. --remote=origin --push
```

### Paso 2: Preparar el Repositorio Local

**A) Verificar que no haya cambios sin guardar:**

```bash
cd /var/www/aurelinportal
git status
```

Si hay archivos modificados, decide:
- **Commitearlos** si están listos
- **Descartarlos** si no son importantes
- **Guardarlos temporalmente** con `git stash`

**B) Renombrar la rama `master` a `main`:**

```bash
# Renombrar la rama local
git branch -m master main

# Verificar el cambio
git branch
# Debe mostrar: * main
```

**C) Commitear cambios pendientes (si los hay):**

```bash
# Agregar los cambios
git add .

# Crear commit con mensaje descriptivo
git commit -m "chore: preparar repo para GitHub (tests y CI configurados)"
```

### Paso 3: Conectar con GitHub

**A) Añadir el remoto GitHub:**

Reemplaza `TU_USUARIO` con tu nombre de usuario de GitHub:

```bash
git remote add origin https://github.com/TU_USUARIO/auriportal.git
```

**B) Verificar que el remoto se añadió:**

```bash
git remote -v
```

Deberías ver algo como:
```
origin  https://github.com/TU_USUARIO/auriportal.git (fetch)
origin  https://github.com/TU_USUARIO/auriportal.git (push)
```

### Paso 4: Hacer el Primer Push

**A) Subir la rama main a GitHub:**

```bash
git push -u origin main
```

Si te pide credenciales:
- **Username:** Tu nombre de usuario de GitHub
- **Password:** Usa un **Personal Access Token** (NO tu contraseña normal)
  - Cómo crear un token: https://github.com/settings/tokens
  - Permisos necesarios: `repo` (acceso completo a repositorios privados)

**B) Verificar en GitHub:**

Ve a https://github.com/TU_USUARIO/auriportal y verifica que:
- ✅ Todos los archivos están ahí
- ✅ La rama se llama `main` (no `master`)
- ✅ El archivo `.env.example` está visible
- ✅ El archivo `.env` **NO** está visible (correcto, debe estar ignorado)

---

## 🔄 Flujo de Trabajo Diario

### Trabajar en una Nueva Funcionalidad

**1. Asegúrate de estar en `main` y actualizado:**

```bash
git checkout main
git pull origin main
```

**2. Crea una nueva rama para tu funcionalidad:**

```bash
git checkout -b feature/nombre-de-tu-funcionalidad
```

Ejemplo:
```bash
git checkout -b feature/mejora-panel-admin
```

**3. Desarrolla y haz commits:**

```bash
# Edita tus archivos...

# Agrega los cambios
git add archivo1.js archivo2.js

# O agrega todos los cambios
git add .

# Crea un commit con mensaje descriptivo
git commit -m "feat: añadir nueva funcionalidad X"
```

**Tipos de mensajes de commit:**
- `feat:` Nueva funcionalidad
- `fix:` Corrección de bug
- `chore:` Tareas de mantenimiento (config, dependencias)
- `docs:` Documentación
- `refactor:` Refactorización de código
- `test:` Tests

**4. Sube la rama a GitHub:**

```bash
git push -u origin feature/nombre-de-tu-funcionalidad
```

**5. Crea un Pull Request (PR) en GitHub:**

1. Ve a https://github.com/TU_USUARIO/auriportal
2. Verás un botón "Compare & pull request"
3. Completa:
   - **Título:** Breve descripción (ej: "Mejora del panel de administración")
   - **Descripción:** Explica qué cambios hiciste y por qué
4. Haz clic en "Create pull request"

**6. Espera a que pasen los tests:**

- GitHub ejecutará automáticamente los tests
- Si pasan ✅ → Puedes hacer "merge"
- Si fallan ❌ → Corrige los errores y vuelve a hacer push

**7. Fusiona el PR:**

- Una vez que los tests pasen y el código esté revisado
- Haz clic en "Merge pull request" → "Confirm merge"
- Elimina la rama en GitHub (aparecerá un botón)

**8. Actualiza tu código local:**

```bash
git checkout main
git pull origin main
```

---

### Trabajar en una Corrección Urgente (Hotfix)

**1. Crear rama desde `main`:**

```bash
git checkout main
git pull origin main
git checkout -b hotfix/correccion-bug-critico
```

**2. Corregir el bug y commitear:**

```bash
# Corrige el bug...

git add .
git commit -m "fix: corregir bug crítico en [descripción]"
git push -u origin hotfix/correccion-bug-critico
```

**3. Crear PR y fusionar rápidamente:**

- Crea el PR
- Espera tests (deben pasar rápido)
- Fusiona inmediatamente

**4. Actualizar `main` local:**

```bash
git checkout main
git pull origin main
```

---

## 🛡️ Protecciones de Rama

### ¿Qué son las Protecciones?

Las protecciones son reglas que **protegen** la rama `main` de cambios accidentales o malos.

### Configurar Protecciones en GitHub

**IMPORTANTE:** Haz esto DESPUÉS del primer push, una sola vez.

1. Ve a tu repositorio en GitHub
2. Ve a **Settings** → **Branches**
3. En "Branch protection rules", haz clic en **"Add branch protection rule"**
4. En "Branch name pattern", escribe: `main`
5. Activa estas opciones:

   ✅ **Require a pull request before merging**
   - ✅ Require approvals: `1` (al menos una aprobación)
   - ✅ Dismiss stale pull request approvals when new commits are pushed
   
   ✅ **Require status checks to pass before merging**
   - ✅ Require branches to be up to date before merging
   - En "Status checks that are required", selecciona:
     - `test / Tests y Linter (18.x)`
     - `test / Tests y Linter (20.x)` (si aparece)
   
   ✅ **Do not allow bypassing the above settings** (para administradores también)
   
   ✅ **Include administrators** (aplica a todos, incluso admins)

6. Haz clic en **"Create"**

### ¿Qué Significa Esto?

- ❌ **NO puedes hacer push directo a `main`**
- ✅ **DEBES crear un Pull Request siempre**
- ✅ **Los tests DEBEN pasar antes de fusionar**
- ✅ **Necesitas al menos una aprobación** (puedes auto-aprobarte si eres el único)

---

## 🔐 Gestión de Secretos

### ⚠️ REGLA DE ORO: NUNCA subas secretos a GitHub

### Archivos que NUNCA deben subirse:

- ❌ `.env` (contiene secretos reales)
- ❌ `*.key`, `*.pem`, `*.cert` (certificados)
- ❌ Cualquier archivo con contraseñas, tokens, o claves API reales

### Archivos que SÍ deben subirse:

- ✅ `.env.example` (solo tiene placeholders como `<TOKEN>`)
- ✅ Archivos de configuración públicos
- ✅ Scripts y código

### Verificar antes de hacer Push

**Comando para verificar qué archivos se van a subir:**

```bash
git status
```

**Si ves `.env` o archivos de secretos:**

```bash
# Agrega .env al .gitignore (si no está ya)
echo ".env" >> .gitignore

# Elimina el archivo del tracking de Git (NO lo borra de tu disco)
git rm --cached .env

# Verifica que ya no aparece
git status
```

**Si accidentalmente subiste un secreto:**

1. **INMEDIATO:** Ve a GitHub y elimina el commit (puede requerir forzar push)
2. **ROTAR:** Cambia TODOS los secretos expuestos (tokens, contraseñas, etc.)
3. **NOTIFICAR:** Si es crítico, notifica a tu equipo

---

## 📝 Comandos Útiles

### Ver Estado Actual

```bash
# Ver archivos modificados
git status

# Ver historial de commits
git log --oneline -10

# Ver diferencias en archivos modificados
git diff
```

### Trabajar con Ramas

```bash
# Ver todas las ramas
git branch -a

# Cambiar a otra rama
git checkout nombre-rama

# Eliminar rama local (después de fusionar)
git branch -d nombre-rama
```

### Deshacer Cambios

```bash
# Descartar cambios en un archivo (CUIDADO: se pierden)
git restore archivo.js

# Descartar TODOS los cambios no commitados
git restore .

# Deshacer el último commit (mantiene los cambios)
git reset --soft HEAD~1

# Deshacer el último commit (elimina los cambios)
git reset --hard HEAD~1  # ⚠️ CUIDADO: esto elimina cambios permanentemente
```

### Sincronizar con GitHub

```bash
# Descargar cambios de GitHub
git pull origin main

# Subir cambios a GitHub
git push origin nombre-rama

# Forzar push (SOLO en casos excepcionales, muy peligroso)
git push --force origin nombre-rama  # ⚠️ NUNCA en main
```

---

## 🔧 Solución de Problemas

### Error: "Updates were rejected"

**Problema:** Intentas hacer push pero GitHub rechaza porque hay cambios remotos.

**Solución:**

```bash
# 1. Descarga los cambios de GitHub
git pull origin main

# 2. Si hay conflictos, resuélvelos manualmente
# (Git te indicará qué archivos tienen conflictos)

# 3. Vuelve a intentar push
git push origin main
```

### Error: "fatal: refusing to merge unrelated histories"

**Problema:** El repositorio local y remoto tienen historiales diferentes.

**Solución:**

```bash
git pull origin main --allow-unrelated-histories
```

### Error: "Your branch is ahead of 'origin/main'"

**Problema:** Tienes commits locales que no están en GitHub.

**Solución:**

```bash
git push origin main
```

### Cambié de Rama por Error

**Problema:** Estás en la rama equivocada.

**Solución:**

```bash
# Ver en qué rama estás
git branch

# Cambiar a la rama correcta
git checkout main

# Si tienes cambios sin commitear, Git te avisará
# Opción 1: Guardarlos temporalmente
git stash

# Opción 2: Descartarlos (si no son importantes)
git restore .
```

### Eliminar un Commit que Accidentalmente Subió Secretos

**⚠️ ADVERTENCIA:** Esto requiere forzar push y es peligroso. Hacerlo solo si es absolutamente necesario.

```bash
# 1. Eliminar el commit del historial local
git reset --hard HEAD~1  # Elimina el último commit

# 2. Forzar push (peligroso)
git push --force origin main

# 3. IMPORTANTE: Rota TODOS los secretos expuestos
```

---

## ✅ Checklist Antes de Hacer Push

Antes de hacer `git push`, verifica:

- [ ] ✅ No hay archivos `.env` o secretos en `git status`
- [ ] ✅ Los cambios están commitados (`git status` muestra "nothing to commit")
- [ ] ✅ Estás en la rama correcta (no en `main` directamente)
- [ ] ✅ El mensaje de commit es descriptivo
- [ ] ✅ Has probado el código localmente (si es posible)
- [ ] ✅ No hay errores de sintaxis obvios

---

## 📚 Recursos Adicionales

- **Git Handbook oficial:** https://guides.github.com/introduction/git-handbook/
- **GitHub Docs:** https://docs.github.com
- **Git Cheat Sheet:** https://education.github.com/git-cheat-sheet-education.pdf

---

## 🆘 ¿Necesitas Ayuda?

Si algo no funciona:

1. Revisa este documento primero
2. Verifica los mensajes de error (Git suele dar pistas útiles)
3. Busca en Google el mensaje de error exacto
4. Consulta con el equipo o un desarrollador senior

---

**Última actualización:** 2024  
**Mantenido por:** Equipo AuriPortal













