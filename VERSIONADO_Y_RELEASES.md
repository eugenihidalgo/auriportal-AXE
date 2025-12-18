# 🏷️ Sistema de Versionado y Releases - AuriPortal

**Versión del Sistema:** 1.0  
**Última actualización:** 2024

---

## 📋 Tabla de Contenidos

1. [Estrategia de Versionado](#estrategia-de-versionado)
2. [Política de Releases](#política-de-releases)
3. [Flujo de Release](#flujo-de-release)
4. [Estructura y Convenciones](#estructura-y-convenciones)
5. [Proceso Paso a Paso](#proceso-paso-a-paso)
6. [Principios Fundamentales](#principios-fundamentales)

---

## 🎯 Estrategia de Versionado

### SemVer Adaptado para AuriPortal

AuriPortal usa **Semantic Versioning (SemVer)** con el formato: `vMAJOR.MINOR.PATCH`

**Formato:** `v4.x.y`

- **MAJOR (4)**: Versión principal del proyecto
  - Cambios incompatibles con versiones anteriores
  - Cambios arquitectónicos mayores
  - Migraciones de base de datos que requieren acción manual
  - Cambios en APIs públicas que rompen compatibilidad
  - **Ejemplo:** v4.0.0 → v5.0.0 (refactorización completa)

- **MINOR (x)**: Nuevas funcionalidades compatibles
  - Nuevas funcionalidades que no rompen compatibilidad
  - Mejoras significativas en funcionalidades existentes
  - Nuevos módulos o servicios
  - Cambios en UI/UX importantes
  - **Ejemplo:** v4.2.0 → v4.3.0 (nuevo módulo de arquetipos)

- **PATCH (y)**: Correcciones y mejoras menores
  - Corrección de bugs
  - Mejoras de rendimiento menores
  - Ajustes de UI/UX menores
  - Actualizaciones de dependencias (sin cambios de API)
  - Correcciones de seguridad
  - **Ejemplo:** v4.3.0 → v4.3.1 (corrección de bug en login)

### Regla de Oro: ¿Qué Versión Incrementar?

**Pregúntate:**
1. ¿Rompe compatibilidad con versiones anteriores? → **MAJOR**
2. ¿Añade funcionalidad nueva sin romper nada? → **MINOR**
3. ¿Solo corrige o mejora algo existente? → **PATCH**

---

## 📦 Política de Releases

### ¿Cuándo se Crea una Versión?

Una versión se crea cuando:

✅ **SÍ se versiona:**
- Se completa una funcionalidad nueva (MINOR)
- Se corrige un bug crítico (PATCH)
- Se implementa una mejora significativa (MINOR o PATCH según alcance)
- Se necesita un punto de referencia estable para producción
- Se requiere rollback a una versión conocida
- Se publican cambios que afectan a usuarios finales

❌ **NO se versiona:**
- Commits de documentación únicamente
- Cambios en tests sin cambios en código de producción
- Refactorizaciones internas sin impacto visible
- Cambios en scripts de desarrollo
- Ajustes de configuración local
- WIP (Work In Progress) incompletos

### ¿Qué Entra en una Versión?

**Una versión debe contener:**
- ✅ Código funcional y probado
- ✅ Tests pasando (CI verde)
- ✅ Documentación actualizada (si aplica)
- ✅ CHANGELOG actualizado
- ✅ Versión actualizada en `package.json`

**Una versión NO debe contener:**
- ❌ Código con bugs conocidos críticos
- ❌ Tests fallando
- ❌ Cambios incompletos o comentados
- ❌ Secretos o configuraciones sensibles
- ❌ Código experimental sin documentar

### Frecuencia de Releases

**Recomendado:**
- **PATCH**: Cuando sea necesario (bugs críticos, correcciones urgentes)
- **MINOR**: Cada 1-2 semanas (acumulación de features)
- **MAJOR**: Cuando sea necesario (cambios arquitectónicos)

**Flexibilidad:** No hay presión por fechas. Se versiona cuando hay valor que entregar.

---

## 🔄 Flujo de Release

### Diagrama del Flujo

```
┌─────────────────┐
│ Feature Branch  │
│  (desarrollo)   │
└────────┬────────┘
         │
         │ PR + Tests ✅
         ▼
┌─────────────────┐
│   main (Git)    │
│  (código base)  │
└────────┬────────┘
         │
         │ Preparar Release
         │ (actualizar versiones)
         ▼
┌─────────────────┐
│  Tag Git (vX.Y.Z)│
│  (punto fijo)   │
└────────┬────────┘
         │
         │ Deploy
         ▼
┌─────────────────┐
│  Producción     │
│  (servidor)     │
└─────────────────┘
```

### Flujo Detallado

#### 1. Desarrollo en Feature Branch

```bash
# Crear rama desde main actualizada
git checkout main
git pull origin main
git checkout -b feature/nueva-funcionalidad

# Desarrollar y commitear
git add .
git commit -m "feat: añadir nueva funcionalidad X"
git push -u origin feature/nueva-funcionalidad
```

#### 2. Pull Request y Merge a Main

- Crear PR en GitHub
- Esperar que pasen los tests (CI)
- Revisar y aprobar
- Merge a `main`

#### 3. Preparar Release

**Opción A: Script Automático (Recomendado)**

```bash
./scripts/release.sh [major|minor|patch]
```

**Opción B: Manual**

Ver sección [Proceso Paso a Paso](#proceso-paso-a-paso)

#### 4. Crear Tag y Release

```bash
# El script automático lo hace, o manualmente:
git tag -a v4.3.1 -m "Release v4.3.1: Corrección de bug en login"
git push origin v4.3.1
```

#### 5. Deploy a Producción

```bash
# En el servidor
git fetch --tags
git checkout v4.3.1
npm install
npm run pm2:restart
```

---

## 📝 Estructura y Convenciones

### CHANGELOG.md

El `CHANGELOG.md` sigue el formato [Keep a Changelog](https://keepachangelog.com/):

```markdown
## [4.3.1] - 2024-01-15

### Fixed
- Corrección de bug en autenticación con Kajabi
- Ajuste de timeouts en sincronización con ClickUp

### Changed
- Mejora de rendimiento en carga de dashboard

## [4.3.0] - 2024-01-10

### Added
- Nuevo módulo de arquetipos
- Sistema de notificaciones mejorado

### Changed
- Actualización de dependencias de seguridad
```

**Categorías:**
- `Added`: Nuevas funcionalidades
- `Changed`: Cambios en funcionalidades existentes
- `Deprecated`: Funcionalidades que se eliminarán
- `Removed`: Funcionalidades eliminadas
- `Fixed`: Corrección de bugs
- `Security`: Correcciones de seguridad

### Tags Git

**Formato:** `vMAJOR.MINOR.PATCH`

**Ejemplos:**
- `v4.3.1` - Release patch
- `v4.3.0` - Release minor
- `v4.0.0` - Release major

**Mensaje del tag:**
```
Release v4.3.1: Corrección de bug en login
```

### Convención de Mensajes de Commit

Ya establecida en `GIT_WORKFLOW.md`:

- `feat:` Nueva funcionalidad → **MINOR**
- `fix:` Corrección de bug → **PATCH**
- `chore:` Mantenimiento → **PATCH** (si no afecta funcionalidad)
- `docs:` Documentación → **No versiona** (solo si es parte de un release)
- `refactor:` Refactorización → **PATCH** o **MINOR** según alcance
- `test:` Tests → **No versiona** (solo si es parte de un release)
- `perf:` Mejora de rendimiento → **PATCH**
- `security:` Corrección de seguridad → **PATCH** o **MINOR**

---

## 🚀 Proceso Paso a Paso

### Release Manual (Sin Script)

#### Paso 1: Verificar Estado

```bash
# Asegúrate de estar en main y actualizado
git checkout main
git pull origin main

# Verifica que no hay cambios sin commitear
git status

# Verifica que los tests pasan
npm test
```

#### Paso 2: Decidir Tipo de Versión

Revisa los commits desde el último tag:

```bash
# Ver último tag
git describe --tags --abbrev=0

# Ver commits desde último tag
git log $(git describe --tags --abbrev=0)..HEAD --oneline
```

Decide: **major**, **minor**, o **patch**

#### Paso 3: Actualizar Versiones

**A) Actualizar `package.json`:**

```bash
# Editar package.json manualmente o usar npm version
npm version patch  # o minor, o major
# Esto actualiza package.json y crea un commit
```

**B) Actualizar `CHANGELOG.md`:**

Añade una nueva sección al inicio:

```markdown
## [4.3.1] - 2024-01-15

### Fixed
- Descripción del bug corregido

### Changed
- Descripción de cambios
```

#### Paso 4: Commit de Release

```bash
git add package.json CHANGELOG.md
git commit -m "chore: release v4.3.1"
```

#### Paso 5: Crear Tag

```bash
git tag -a v4.3.1 -m "Release v4.3.1: Descripción breve"
```

#### Paso 6: Push a GitHub

```bash
git push origin main
git push origin v4.3.1
```

#### Paso 7: Deploy (Opcional)

```bash
# En el servidor
git fetch --tags
git checkout v4.3.1
npm install
npm run pm2:restart
```

### Release con Script (Recomendado)

```bash
# Ver ayuda
./scripts/release.sh --help

# Release patch
./scripts/release.sh patch

# Release minor
./scripts/release.sh minor

# Release major
./scripts/release.sh major
```

El script automatiza todos los pasos anteriores.

---

## 🎯 Principios Fundamentales

### 1. Incremental

- ✅ Cada release añade valor sin romper lo existente
- ✅ Cambios pequeños y frecuentes son mejores que cambios grandes
- ✅ Cada versión es un paso hacia adelante

### 2. Reversible

- ✅ Cada tag es un punto de rollback seguro
- ✅ Siempre se puede volver a una versión anterior
- ✅ Los tags nunca se eliminan (solo se añaden)

**Rollback:**

```bash
# Ver todas las versiones
git tag -l

# Volver a una versión anterior
git checkout v4.2.0
npm install
npm run pm2:restart
```

### 3. Auditabilidad Total

- ✅ Cada release tiene un tag Git
- ✅ Cada release tiene entrada en CHANGELOG
- ✅ Cada release tiene commits asociados
- ✅ Historial completo en Git

**Auditar un release:**

```bash
# Ver qué hay en un tag
git show v4.3.1

# Ver commits de un release
git log v4.2.0..v4.3.1 --oneline

# Ver diferencias entre versiones
git diff v4.2.0..v4.3.1
```

---

## 📊 Ejemplos Prácticos

### Ejemplo 1: Release Patch (Bug Fix)

**Situación:** Se corrige un bug en el login.

```bash
# 1. Bug corregido y mergeado a main
# 2. Preparar release
./scripts/release.sh patch

# Resultado:
# - package.json: 4.3.0 → 4.3.1
# - Tag: v4.3.1
# - CHANGELOG actualizado
```

### Ejemplo 2: Release Minor (Nueva Funcionalidad)

**Situación:** Se añade un nuevo módulo de arquetipos.

```bash
# 1. Feature completa y mergeada a main
# 2. Preparar release
./scripts/release.sh minor

# Resultado:
# - package.json: 4.2.0 → 4.3.0
# - Tag: v4.3.0
# - CHANGELOG actualizado
```

### Ejemplo 3: Release Major (Refactorización)

**Situación:** Migración completa de SQLite a PostgreSQL.

```bash
# 1. Refactorización completa y mergeada a main
# 2. Preparar release
./scripts/release.sh major

# Resultado:
# - package.json: 4.3.0 → 5.0.0
# - Tag: v5.0.0
# - CHANGELOG actualizado
```

---

## 🔍 Verificación Post-Release

Después de crear un release, verifica:

```bash
# 1. Tag creado correctamente
git tag -l | grep v4.3.1

# 2. Tag en GitHub
# Ir a: https://github.com/TU_USUARIO/auriportal/releases

# 3. Versión en package.json
cat package.json | grep version

# 4. CHANGELOG actualizado
head -20 CHANGELOG.md
```

---

## 🆘 Solución de Problemas

### Error: Tag ya existe

```bash
# Eliminar tag local
git tag -d v4.3.1

# Eliminar tag remoto (solo si no se ha usado)
git push origin :refs/tags/v4.3.1

# Reintentar release
./scripts/release.sh patch
```

### Error: Versión incorrecta en package.json

```bash
# Corregir manualmente
# Editar package.json
# Hacer commit
git add package.json
git commit -m "chore: corregir versión a 4.3.1"
git push origin main
```

### Necesito hacer rollback

```bash
# En el servidor
git fetch --tags
git checkout v4.2.0  # Versión anterior estable
npm install
npm run pm2:restart
```

---

## 📚 Recursos Adicionales

- **Semantic Versioning:** https://semver.org/
- **Keep a Changelog:** https://keepachangelog.com/
- **Git Workflow:** Ver `GIT_WORKFLOW.md`
- **CI/CD:** Ver `.github/workflows/ci.yml`

---

**Última actualización:** 2024  
**Mantenido por:** Equipo AuriPortal










