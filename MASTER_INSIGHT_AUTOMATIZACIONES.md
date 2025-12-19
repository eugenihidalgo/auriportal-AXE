# MASTER INSIGHT y AUTOMATIZACIONES - Documentación

**Fecha de implementación:** 2024-12-19  
**Estado:** ✅ IMPLEMENTADO

---

## 📋 Resumen

Se han creado dos nuevos módulos principales en el panel de administración:

1. **🧠 MASTER INSIGHT** - Sistema de análisis y visualización del sistema energético
2. **⚙️ AUTOMATIZACIONES** - Prototipo de sistema de automatizaciones configurable

---

## 🧠 MASTER INSIGHT

### Estado de las Secciones

#### ✅ ACTIVO
- **Visión General** (`/admin/master-insight/overview`)
  - Implementación completa y funcional
  - Muestra estadísticas reales desde `energy_subject_state` y `energy_events`
  - Tarjetas principales: alumnos activos/pausa, total sujetos, % limpios, % iluminados, eventos
  - Bloques: últimos eventos, sujetos más trabajados, sujetos más olvidados, alertas básicas

#### 🚧 EN DESARROLLO
Todas las demás secciones muestran placeholder con estado "EN DESARROLLO":
- Alertas Inteligentes
- Sugerencias del Sistema
- Salud Energética Global
- Patrones Emergentes
- Lugares (Insight)
- Proyectos (Insight)
- Apadrinados (Insight)
- Ritmos y Recurrencias
- Eventos Especiales
- Historial del Master
- Configuración de Criterios

### Datos Utilizados

La sección **Visión General** consulta:
- `energy_subject_state` - Proyecciones del estado energético
- `energy_events` - Eventos energéticos (event sourcing)
- `alumnos` - Tabla de alumnos para estadísticas de suscripción

### Endpoints

- `GET /admin/master-insight/overview` - Página principal con estadísticas
- `GET /admin/master-insight/*` - Placeholders para otras secciones

---

## ⚙️ AUTOMATIZACIONES

### Estado: PROTOTIPO

**⚠️ IMPORTANTE:** Las automatizaciones están en modo prototipo. No ejecutan acciones reales, solo permiten:
- Definir reglas
- Simular ejecución (preview)
- Ver estado ON/OFF
- Logs simulados

### Estructura de una Automatización

```javascript
{
  id: number,
  name: string,
  trigger_type: 'evento_energetico' | 'patron' | 'tiempo' | 'nivel',
  trigger_config: object,
  condition: object,
  action_type: 'sugerir_practica' | 'marcar_alerta' | 'recomendar_intervencion' | 'registrar_nota' | 'disparar_evento',
  action_config: object,
  enabled: boolean,
  created_at: string
}
```

### Triggers Permitidos (por ahora)

1. **Evento energético** - Se dispara cuando ocurre un evento (cleaning, illumination, etc.)
2. **Conteo de iluminación** - Basado en `illumination_count`
3. **Estado limpio / no limpio** - Basado en `is_clean`
4. **Paso de X días** - Basado en tiempo transcurrido
5. **Nivel del alumno** - Basado en nivel actual

### Acciones Disponibles (solo preview)

1. **Sugerir práctica** - Mensaje sugerido al alumno
2. **Marcar alerta** - Alerta con severidad (low/medium/high)
3. **Recomendar intervención Master** - Sugerencia para intervención manual
4. **Registrar nota interna** - Nota automática en sistema
5. **Disparar evento simulado** - Evento simulado (no real)

### Endpoints API

- `GET /admin/api/automations` - Listar todas las automatizaciones
- `POST /admin/api/automations` - Crear nueva automatización (mock)
- `PUT /admin/api/automations/:id` - Actualizar automatización (mock)
- `GET /admin/api/automations/:id/preview` - Preview de ejecución (simulación)

### Rutas UI

- `GET /admin/automations` - Overview principal
- `GET /admin/automations/eventos-energeticos` - Reglas por eventos
- `GET /admin/automations/patrones` - Reglas por patrones
- `GET /admin/automations/tiempo` - Reglas por tiempo/recurrencia
- `GET /admin/automations/acciones` - Preview de acciones
- `GET /admin/automations/logs` - Logs simulados
- `GET /admin/automations/configuracion` - Configuración global

### Persistencia

Actualmente en **memoria** (array JavaScript). En producción debería:
- Crear tabla `automations` en PostgreSQL
- Migrar datos existentes
- Implementar CRUD completo con validaciones

---

## 🎨 UI/UX

### Estilo

- Panel Master elegante y poderoso
- Visualmente superior al sistema antiguo
- Tarjetas con colores con intención (no gris aburrido)
- Badges de estado claros: ACTIVO / EN DESARROLLO / PROTOTIPO

### Sensación

> "Estoy dominando el sistema energético"

---

## 📝 Próximos Pasos

### MASTER INSIGHT

1. Implementar **Alertas Inteligentes** con detección automática
2. Implementar **Sugerencias del Sistema** basadas en patrones
3. Implementar **Salud Energética Global** con métricas agregadas
4. Implementar **Patrones Emergentes** con análisis de tendencias
5. Implementar secciones específicas (Lugares, Proyectos, Apadrinados)
6. Implementar **Ritmos y Recurrencias** con análisis temporal
7. Implementar **Eventos Especiales** con detección de anomalías
8. Implementar **Historial del Master** con auditoría completa
9. Implementar **Configuración de Criterios** para personalizar alertas

### AUTOMATIZACIONES

1. Migrar persistencia a PostgreSQL
2. Implementar ejecutor real (no solo preview)
3. Añadir más tipos de triggers
4. Añadir más tipos de acciones
5. Implementar sistema de logs real
6. Añadir validaciones y tests
7. Implementar sistema de permisos

---

## 🔒 Reglas Estrictas Seguidas

✅ NO se cambió lógica energética existente  
✅ NO se modificaron tablas legacy  
✅ NO se implementaron automatizaciones reales (solo prototipo)  
✅ NO se optimizó prematuramente  
✅ SÍ se creó UI clara y estructurada  
✅ SÍ se crearon endpoints READ  
✅ SÍ se mantuvo código limpio y extensible  

---

## 📍 Ubicación de Archivos

- Sidebar: `src/core/html/admin/base.html`
- Master Insight: `src/endpoints/admin-master-insight.js`
- Automatizaciones: `src/endpoints/admin-automations.js`
- Rutas: `src/endpoints/admin-panel-v4.js`

---

**Sistema implementado y listo para uso.** ✅










