// src/modules/README.md
# Módulos de AuriPortal V6

## Estructura de Módulos

Cada módulo sigue esta estructura:

```
/src/modules/{modulo}/
  ├── endpoints/      # Endpoints HTTP del módulo
  ├── services/       # Lógica de negocio
  ├── templates/      # HTML templates (si aplica)
  └── index.js        # Exportaciones principales
```

## Módulos Implementados

### 🎮 Gamificación
- **auribosses**: Retos de ascenso de nivel
- **arquetipos**: Sistema dinámico de arquetipos
- **avatar**: Evolución del avatar Aurelín
- **historia**: Narrativa por niveles  
- **aurimapa**: Mapa interior del alumno
- **auriquest**: Viajes guiados multi-día

### 📊 Funcionales
- **informes**: Informes semanales automáticos
- **sorpresas**: Recomendación inteligente de prácticas
- **tokens**: Sistema de tokens AURI (beta)

## Control de Estado

Cada módulo se controla desde:
- `Admin Panel > Configuración > Módulos del Sistema`
- Estados: OFF (desactivado) / BETA (solo admins) / ON (todos)

## Integración

Todos los módulos están integrados con:
- ✅ Analytics (eventos y métricas)
- ✅ PostgreSQL (persistencia)
- ✅ Whisper & Ollama (IA local)
- ✅ Sistema de módulos (activación dinámica)



