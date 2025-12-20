# 📊 Modelos Ollama - Capacidad del Servidor

## 🖥️ Recursos Disponibles

- **RAM Total**: 15GB
- **RAM Disponible**: ~13GB (después de servicios base)
- **CPU**: 8 cores
- **Modelo Actual**: llama3:latest (4.7GB)

---

## 📋 Modelos Ollama Disponibles y Requisitos

### Modelos Pequeños (7B parámetros)

| Modelo | Tamaño | RAM Necesaria | Estado |
|--------|--------|---------------|--------|
| **llama3:8b** | ~4.7GB | ~6-8GB | ✅ **Instalado** |
| **mistral:7b** | ~4.1GB | ~6-8GB | ✅ Viable |
| **codellama:7b** | ~3.8GB | ~6-8GB | ✅ Viable |
| **qwen:7b** | ~4.3GB | ~6-8GB | ✅ Viable |

### Modelos Medianos (13B parámetros)

| Modelo | Tamaño | RAM Necesaria | Estado |
|--------|--------|---------------|--------|
| **llama3.1:8b** | ~4.7GB | ~6-8GB | ✅ Viable |
| **mistral:13b** | ~7.2GB | ~10-12GB | ⚠️ **Límite** |
| **codellama:13b** | ~7.1GB | ~10-12GB | ⚠️ **Límite** |
| **qwen:14b** | ~7.8GB | ~10-12GB | ⚠️ **Límite** |

### Modelos Grandes (70B parámetros)

| Modelo | Tamaño | RAM Necesaria | Estado |
|--------|--------|---------------|--------|
| **llama3:70b** | ~40GB | ~48-50GB | ❌ **No viable** |
| **mistral:70b** | ~39GB | ~48-50GB | ❌ **No viable** |
| **qwen:72b** | ~41GB | ~48-50GB | ❌ **No viable** |

---

## ✅ Recomendación: Modelo Más Grande Viable

### **llama3.1:8b** o **mistral:13b**

**llama3.1:8b** (Recomendado):
- ✅ Tamaño: ~4.7GB
- ✅ RAM necesaria: ~6-8GB
- ✅ Mejor rendimiento que llama3:8b
- ✅ Calidad excelente
- ✅ Funciona perfectamente con 15GB RAM

**mistral:13b** (Alternativa):
- ⚠️ Tamaño: ~7.2GB
- ⚠️ RAM necesaria: ~10-12GB
- ⚠️ Funciona pero cerca del límite
- ✅ Mejor calidad que modelos 7B
- ⚠️ Puede ser lento con 15GB RAM

---

## 🎯 Instalación de Modelos

### Instalar llama3.1:8b (Recomendado)

```bash
ollama pull llama3.1:8b
```

### Instalar mistral:13b (Alternativa)

```bash
ollama pull mistral:13b
```

### Ver modelos instalados

```bash
ollama list
```

---

## 📊 Comparativa de Modelos

| Modelo | Tamaño | RAM | Calidad | Velocidad | Recomendación |
|--------|--------|-----|---------|-----------|---------------|
| llama3:8b | 4.7GB | 6-8GB | Buena | Rápida | ✅ Actual |
| llama3.1:8b | 4.7GB | 6-8GB | Excelente | Rápida | ⭐ **Mejor opción** |
| mistral:7b | 4.1GB | 6-8GB | Buena | Rápida | ✅ Alternativa |
| mistral:13b | 7.2GB | 10-12GB | Excelente | Media | ⚠️ Límite |
| llama3:70b | 40GB | 48-50GB | Superior | Muy lenta | ❌ No viable |

---

## 🔧 Configuración en AuriPortal

Para cambiar el modelo de Ollama, edita `.env`:

```env
OLLAMA_MODEL=llama3.1:8b
```

O usa el modelo actual:

```env
OLLAMA_MODEL=llama3:latest
```

---

## 💡 Recomendación Final

**Para tu servidor con 15GB RAM:**

1. **Mejor opción**: `llama3.1:8b`
   - Mejor calidad que llama3:8b
   - Mismo tamaño y requisitos
   - Excelente rendimiento

2. **Si necesitas más calidad**: `mistral:13b`
   - Mejor calidad pero más lento
   - Funciona pero cerca del límite
   - Solo si realmente necesitas más calidad

3. **No recomendado**: Modelos 70B
   - Requieren 48-50GB RAM
   - No caben en tu servidor

---

**Última actualización**: Diciembre 2024



































