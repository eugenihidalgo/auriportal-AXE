# 🚀 Guía Rápida de Releases - AuriPortal

**Para uso diario - Referencia rápida**

---

## 📋 Decisión Rápida: ¿Qué Versión?

| Cambio | Tipo | Ejemplo |
|--------|------|---------|
| Bug corregido | `patch` | 4.3.0 → 4.3.1 |
| Nueva funcionalidad | `minor` | 4.3.0 → 4.4.0 |
| Cambio que rompe compatibilidad | `major` | 4.3.0 → 5.0.0 |

---

## ⚡ Release Rápido (1 comando)

```bash
./scripts/release.sh [patch|minor|major]
```

**Ejemplo:**
```bash
./scripts/release.sh patch
```

El script te guiará paso a paso.

---

## 📝 Proceso Manual (Si prefieres control total)

### 1. Preparar
```bash
git checkout main
git pull origin main
npm test  # Verificar que todo funciona
```

### 2. Actualizar Versión
```bash
# Opción A: Usar npm (recomendado)
npm version patch  # o minor, o major

# Opción B: Editar package.json manualmente
# Cambiar "version": "4.3.0" → "4.3.1"
```

### 3. Actualizar CHANGELOG.md
Añadir al inicio (después de `[Unreleased]`):

```markdown
## [4.3.1] - 2024-01-15

### Fixed
- Descripción del bug corregido
```

### 4. Commit y Tag
```bash
git add package.json CHANGELOG.md
git commit -m "chore: release v4.3.1"
git tag -a v4.3.1 -m "Release v4.3.1: Descripción breve"
```

### 5. Push
```bash
git push origin main
git push origin v4.3.1
```

---

## 🔄 Deploy a Producción

```bash
# En el servidor
cd /var/www/aurelinportal
git fetch --tags
git checkout v4.3.1
npm install
npm run pm2:restart
```

---

## 🔍 Verificar Release

```bash
# Ver tag creado
git tag -l | grep v4.3.1

# Ver versión en package.json
cat package.json | grep version

# Ver commits del release
git log v4.2.0..v4.3.1 --oneline
```

---

## ⏪ Rollback (Si algo sale mal)

```bash
# En el servidor
git checkout v4.2.0  # Versión anterior
npm install
npm run pm2:restart
```

---

## 📚 Documentación Completa

- **Sistema completo:** `VERSIONADO_Y_RELEASES.md`
- **Flujo Git:** `GIT_WORKFLOW.md`
- **CI/CD:** `.github/workflows/ci.yml`

---

## 🆘 Problemas Comunes

### Tag ya existe
```bash
git tag -d v4.3.1
git push origin :refs/tags/v4.3.1
# Reintentar release
```

### Cambios sin commitear
```bash
git status
# Commitear o descartar cambios
git add . && git commit -m "..."  # O
git restore .
```

### No estás en main
```bash
git checkout main
git pull origin main
```

---

**Última actualización:** 2024













