# INVENTARIO CONSTITUCIONAL — SOURCE OF TRUTH Y UI ADMIN CANÓNICA
## AuriPortal — Estado Documental Completo

**Fecha de inventario:** 2025-01-XX  
**Objetivo:** Identificar y clasificar TODOS los documentos que describen el movimiento estructural hacia Source of Truth canónico y UI Admin canónica  
**Modo:** SOLO INVENTARIO — NO MODIFICACIÓN

---

## RESUMEN EJECUTIVO

Este inventario identifica **110+ documentos** relacionados con el movimiento estructural hacia Source of Truth canónico y UI Admin canónica en AuriPortal, clasificados en **10 ámbitos** principales.

**Estado general:** El movimiento está **ampliamente documentado** con múltiples capas de documentación que cubren desde principios constitucionales hasta implementación técnica. Existen algunas áreas con documentación parcialmente solapada que requerirían unificación futura.

---

## 1. SOURCE OF TRUTH (SOT) CANÓNICO

### 1.1. Documentos Constitucionales (Nivel: CONSTITUCIONAL)

| Ruta | Título | Propósito | Estado |
|------|--------|-----------|--------|
| `CERTIFICACION_SOURCE_OF_TRUTH_FASE1.md` | Certificación Source of Truth - Fase 1 | Declaración constitucional explícita del SOT. Define PostgreSQL como única autoridad, clasificación de entidades (SOT/Mirror/Cache/Legacy), estatuto de legacy, gobierno desde Admin. | ✅ VIGENTE |
| `docs/SOURCE_OF_TRUTH_CERTIFICATION.md` | Source of Truth Certification (SOT-CERT) v1.0 | Definición operativa de SOT. Contrato semántico obligatorio, contrato de filtros canónicos, API mínima obligatoria. Checklist de certificación. | ✅ VIGENTE |
| `PRINCIPIOS_INMUTABLES_AURIPORTAL.md` | Principios Inmutables de AuriPortal | Columna vertebral estructural. Define principios NO NEGOCIABLES: separación dominio/infraestructura, PostgreSQL como autoridad, etc. | ✅ VIGENTE |

### 1.2. Documentos Estructurales (Nivel: ESTRUCTURAL)

| Ruta | Título | Propósito | Estado |
|------|--------|-----------|--------|
| `DIAGNOSTICO_SOURCE_OF_TRUTH_FASE1.md` | Diagnóstico Source of Truth (Fase 1) | Mapeo exhaustivo de TODOS los SOT identificados (25+ entidades). Evalúa robustez, mapea dependencias, documenta zonas estables. | ✅ VIGENTE |
| `docs/SOT_catalog-registry.md` | Source of Truth: Registro de Catálogos PDE | Contrato específico para `pde_catalog_registry`. Esquema BD, contrato de UI, seguridad JavaScript, ejemplos. | ✅ VIGENTE |
| `docs/SOT_tecnicas-limpieza.md` | Source of Truth: Técnicas de Limpieza | Contrato específico para técnicas de limpieza. ROL ONTOLÓGICO, esquema BD, contrato de filtros. | ✅ VIGENTE |
| `docs/SOT_transmutaciones-energeticas.md` | Source of Truth: Transmutaciones Energéticas | Contrato específico para transmutaciones. Similar estructura al anterior. | ✅ VIGENTE |
| `docs/SOT_interactive-resources.md` | Source of Truth: Recursos Interactivos | Contrato específico para recursos interactivos. | ✅ VIGENTE |

### 1.3. Documentos Técnicos (Nivel: TÉCNICO)

| Ruta | Título | Propósito | Estado |
|------|--------|-----------|--------|
| `docs/PDE_CATALOG_REGISTRY_V1.md` | PDE Catalog Registry v1 | Especificación técnica del registro de catálogos. Esquema, API, integración con motores. | ✅ VIGENTE |
| `docs/MIGRATIONS_POLICY.md` | Migrations Policy | Política de migraciones. Proceso canónico para crear, aplicar y verificar migraciones SQL. | ✅ VIGENTE |

### 1.4. Documentos Históricos/Diagnóstico (Nivel: DIAGNÓSTICO)

| Ruta | Título | Propósito | Estado |
|------|--------|-----------|--------|
| `DOCUMENTACION_BD_KAJABI.md` | Documentación: Base de Datos de Kajabi | Documentación histórica del sistema de sincronización con Kajabi. Muestra estado previo (Kajabi como autoridad). | ⚠️ HISTÓRICO |
| `DOCUMENTACION_COMPLETA.md` | Documentación Completa - AuriPortal v3.1 | Documentación histórica de arquitectura anterior (ClickUp como "centro de operaciones", SQLite como caché). | ⚠️ HISTÓRICO |

**Observaciones:**
- `CERTIFICACION_SOURCE_OF_TRUTH_FASE1.md` es el documento **constitucional principal** (LEY OPERATIVA)
- Existe solapamiento entre `CERTIFICACION_SOURCE_OF_TRUTH_FASE1.md` y `docs/SOURCE_OF_TRUTH_CERTIFICATION.md` — el primero es más completo y constitucional
- Los documentos SOT_*.md son específicos por entidad y complementan el documento constitucional

---

## 2. UI ADMIN CANÓNICA

### 2.1. Documentos Constitucionales (Nivel: CONSTITUCIONAL)

| Ruta | Título | Propósito | Estado |
|------|--------|-----------|--------|
| `docs/ADMIN_UI_CONTRACT_V1.md` | Contrato Canónico de UI Admin v1 | Definición ontológica completa. 28 invariantes, 29 garantías, capacidades [CORE] y [READY]. Documento constitucional más completo. | ✅ VIGENTE |
| `PRINCIPIOS_INMUTABLES_AURIPORTAL.md` | Principios Inmutables de AuriPortal | Incluye principios sobre separación dominio/infraestructura que aplican a UI Admin. | ✅ VIGENTE |

### 2.2. Documentos Estructurales (Nivel: ESTRUCTURAL)

| Ruta | Título | Propósito | Estado |
|------|--------|-----------|--------|
| `docs/UI_ADMIN_FACTORY_V1.md` | UI Admin Factory v1 | Definición ontológica del Factory. Pipeline canónico, modo shadow vs enforced, integración con otros sistemas. | ✅ VIGENTE |
| `docs/UI_ADMIN_REGISTRY_V1.md` | UI Admin Registry v1 | Source of Truth canónico para pantallas Admin. Entidades, estados, invariantes, integración con otros sistemas. | ✅ VIGENTE |
| `docs/UI_ADMIN_SCHEMA_V1_README.md` | UI Admin Schema v1 - Guía de Validación | Guía para validar UIs Admin contra el schema. Ejemplos válidos/inválidos, integración con Assembly Check. | ✅ VIGENTE |
| `docs/ADMIN_ROUTER_CONTRACT.md` | Admin Router Contract v1.0 | Principio constitucional: "UI NO RESUELTA = UI INEXISTENTE". Flujo correcto, prohibiciones absolutas, integración con Assembly Check. | ✅ VIGENTE |
| `docs/ADMIN_ROUTER_CANONICAL_RULES.md` | Reglas Canónicas del Router Admin | Reglas constitucionales del router: orden de matching, separación API/UI, APIs siempre JSON. Caso real API_ROUTE_AS_ISLAND. | ✅ VIGENTE |

### 2.3. Documentos Técnicos (Nivel: TÉCNICO)

| Ruta | Título | Propósito | Estado |
|------|--------|-----------|--------|
| `docs/UI_ADMIN_SCHEMA_V1.json` | UI Admin Schema v1 (JSON Schema) | Schema JSON (Draft 2020-12) para validación automática de UIs Admin. | ✅ VIGENTE |
| `docs/UI_ADMIN_REGISTRY_SCHEMA_V1.json` | UI Admin Registry Schema v1 (JSON Schema) | Schema JSON para validar entradas del UI Admin Registry. | ✅ VIGENTE |
| `docs/ADMIN_UI_CREATION_PROTOCOL_V1.md` | Protocolo de Creación de UIs Admin v1 | Protocolo paso a paso para crear nuevas UIs Admin. Checklist, validaciones, ejemplos. | ✅ VIGENTE |
| `docs/ADMIN_HTML_JS_SEPARATION.md` | Admin HTML/JS Separation | Reglas sobre separación HTML/JS en UIs Admin. Seguridad JavaScript, prevención XSS. | ✅ VIGENTE |
| `docs/ADMIN_API_HANDLER_CONTRACT.md` | Admin API Handler Contract | Contrato para handlers API. Validación, estructura de respuesta, manejo de errores. | ✅ VIGENTE |

### 2.4. Documentos de Diagnóstico (Nivel: DIAGNÓSTICO)

| Ruta | Título | Propósito | Estado |
|------|--------|-----------|--------|
| `docs/ADMIN_UI_CREATION_DIAGNOSTIC.md` | Diagnostic: Admin UI Creation | Diagnóstico completo del estado actual de creación de UIs Admin. Identifica problemas, propone soluciones. | ✅ VIGENTE |
| `docs/ADMIN_UI_DIAGNOSTIC_SUMMARY.md` | Admin UI Diagnostic Summary | Resumen del diagnóstico. Estado actual, problemas identificados, plan de acción. | ✅ VIGENTE |
| `docs/DIAGNOSTICO_ROUTER_ADMIN.md` | Diagnóstico Router Admin | Análisis específico del router Admin. Problemas encontrados, soluciones aplicadas. | ✅ VIGENTE |
| `docs/DIAGNOSTICO_SIDEBAR_ADMIN.md` | Diagnóstico Sidebar Admin | Análisis del sidebar Admin. Estado actual, problemas, mejoras propuestas. | ✅ VIGENTE |

**Observaciones:**
- `docs/ADMIN_UI_CONTRACT_V1.md` es el documento **constitucional principal** (más completo)
- `docs/UI_ADMIN_FACTORY_V1.md` y `docs/UI_ADMIN_REGISTRY_V1.md` son complementarios y detallan sistemas específicos
- Los schemas JSON (`*.json`) son artefactos técnicos que implementan las validaciones definidas en los documentos constitucionales

---

## 3. UI FACTORY / REGISTRY / SCHEMA

### 3.1. Documentos Estructurales (Nivel: ESTRUCTURAL)

| Ruta | Título | Propósito | Estado |
|------|--------|-----------|--------|
| `docs/UI_ADMIN_FACTORY_V1.md` | UI Admin Factory v1 | Sistema completo del Factory. Pipeline canónico, modo shadow/enforced, responsabilidades. | ✅ VIGENTE |
| `docs/UI_ADMIN_REGISTRY_V1.md` | UI Admin Registry v1 | Registry completo. Entidades, estados, invariantes, integración con Router/Sidebar/Assembly Check. | ✅ VIGENTE |
| `docs/UI_ADMIN_SCHEMA_V1_README.md` | UI Admin Schema v1 - Guía de Validación | Guía para usar el schema. Cómo validar, ejemplos, integración con Assembly Check. | ✅ VIGENTE |

### 3.2. Documentos Técnicos (Nivel: TÉCNICO)

| Ruta | Título | Propósito | Estado |
|------|--------|-----------|--------|
| `docs/UI_ADMIN_SCHEMA_V1.json` | UI Admin Schema v1 (JSON Schema) | Schema JSON para validación automática. Implementa validaciones del Contrato Canónico v1. | ✅ VIGENTE |
| `docs/UI_ADMIN_REGISTRY_SCHEMA_V1.json` | UI Admin Registry Schema v1 (JSON Schema) | Schema JSON para validar entradas del registry. Implementa REG-INV-001 a REG-INV-009. | ✅ VIGENTE |

**Observaciones:**
- Los tres documentos principales (Factory, Registry, Schema) están bien integrados y referencian entre sí
- Los schemas JSON son la implementación técnica de las validaciones definidas en los documentos estructurales

---

## 4. ASSEMBLY CHECK Y GARANTÍAS

### 4.1. Documentos Estructurales (Nivel: ESTRUCTURAL)

| Ruta | Título | Propósito | Estado |
|------|--------|-----------|--------|
| `docs/ASSEMBLY_CHECKS.md` | Assembly Check System v1.0 | Documentación principal del Assembly Check. Qué verifica, cómo usar, checks detallados, integración CI/CD. | ✅ VIGENTE |
| `docs/ASSEMBLY_CHECK_SYSTEM.md` | Assembly Check System | Documentación complementaria. Sistema de verificación automática para prevenir regresiones. | ✅ VIGENTE |
| `docs/ASSEMBLY_CHECK_SYSTEM_IMPLEMENTATION.md` | Assembly Check System Implementation | Detalles de implementación. Código, arquitectura, extensibilidad. | ✅ VIGENTE |
| `docs/ASSEMBLY_CHECK_SYSTEM_UI.md` | Assembly Check System UI | UI del Assembly Check. Interfaz visual, reportes, diagnóstico. | ✅ VIGENTE |

### 4.2. Documentos Técnicos (Nivel: TÉCNICO)

| Ruta | Título | Propósito | Estado |
|------|--------|-----------|--------|
| `docs/FEATURE_COMPLETION_PROTOCOL.md` | Feature Completion Protocol | Protocolo de completitud. Define qué significa "completado" (no solo "funciona"). | ✅ VIGENTE |
| `docs/ROUTER_BLINDAGE_CERTIFICATION.md` | Router Blindage Certification | Certificación del blindaje del router. Verificaciones automáticas, garantías. | ✅ VIGENTE |
| `docs/ROUTER_ERROR_FIX_2025-01-XX.md` | Router Error Fix | Documentación del fix del bug API_ROUTE_AS_ISLAND. Caso histórico, solución aplicada. | ✅ VIGENTE |

**Observaciones:**
- `docs/ASSEMBLY_CHECKS.md` es el documento principal y más accesible
- Existe solapamiento entre `ASSEMBLY_CHECK_SYSTEM.md` y `ASSEMBLY_CHECK_SYSTEM_IMPLEMENTATION.md` — podrían unificarse

---

## 5. ROBUSTEZ UI / ADMIN

### 5.1. Documentos Estructurales (Nivel: ESTRUCTURAL)

| Ruta | Título | Propósito | Estado |
|------|--------|-----------|--------|
| `docs/RUNTIME_GUARD.md` | Runtime Guard | Sistema de protección en runtime. Guards, validaciones, prevención de errores silenciosos. | ✅ VIGENTE |
| `docs/ADMIN_ROUTER_CANONICAL_RULES.md` | Reglas Canónicas del Router Admin | Incluye garantías de robustez: orden de matching, separación API/UI, prevención de bugs históricos. | ✅ VIGENTE |

### 5.2. Documentos Técnicos (Nivel: TÉCNICO)

| Ruta | Título | Propósito | Estado |
|------|--------|-----------|--------|
| `docs/ADMIN_HTML_JS_SEPARATION.md` | Admin HTML/JS Separation | Reglas de seguridad JavaScript. Prevención XSS, separación HTML/JS, código seguro. | ✅ VIGENTE |
| `docs/ADMIN_API_HANDLER_CONTRACT.md` | Admin API Handler Contract | Contrato para handlers API. Validación, estructura, manejo de errores. | ✅ VIGENTE |
| `docs/ADMIN_AUTOMATIONS_READ_ONLY_CONTRACT.md` | Admin Automations Read Only Contract | Contrato para UI de automatizaciones (read-only). Validaciones, estructura. | ✅ VIGENTE |
| `docs/ADMIN_AUTOMATIONS_WRITE_EXECUTION_CONTRACT.md` | Admin Automations Write Execution Contract | Contrato para ejecución de automatizaciones desde Admin. Validaciones, auditoría. | ✅ VIGENTE |

**Observaciones:**
- La robustez está distribuida en múltiples documentos de contrato específicos
- No existe un documento unificado de "robustez UI Admin" — está fragmentado

---

## 6. ROUTER REGISTRY Y SEPARACIÓN API/UI

### 6.1. Documentos Constitucionales (Nivel: CONSTITUCIONAL)

| Ruta | Título | Propósito | Estado |
|------|--------|-----------|--------|
| `docs/ADMIN_ROUTER_CONTRACT.md` | Admin Router Contract v1.0 | Principio constitucional: "UI NO RESUELTA = UI INEXISTENTE". Flujo correcto, prohibiciones absolutas. | ✅ VIGENTE |
| `docs/ADMIN_ROUTER_CANONICAL_RULES.md` | Reglas Canónicas del Router Admin | Reglas constitucionales: orden de matching, separación API/UI, APIs siempre JSON. Caso histórico. | ✅ VIGENTE |

### 6.2. Documentos Técnicos (Nivel: TÉCNICO)

| Ruta | Título | Propósito | Estado |
|------|--------|-----------|--------|
| `docs/ROUTER_BLINDAGE_CERTIFICATION.md` | Router Blindage Certification | Certificación del blindaje. Verificaciones automáticas, garantías, integración con Assembly Check. | ✅ VIGENTE |
| `docs/ROUTER_ERROR_FIX_2025-01-XX.md` | Router Error Fix | Fix del bug API_ROUTE_AS_ISLAND. Caso histórico detallado, solución técnica. | ✅ VIGENTE |
| `docs/NGINX_ROUTING_ADMIN.md` | Nginx Routing Admin | Configuración de Nginx para rutas Admin. Proxy, SSL, headers. | ✅ VIGENTE |

**Observaciones:**
- `docs/ADMIN_ROUTER_CONTRACT.md` es el documento constitucional principal
- `docs/ADMIN_ROUTER_CANONICAL_RULES.md` complementa con reglas técnicas específicas
- `docs/ROUTER_ERROR_FIX_2025-01-XX.md` documenta un caso histórico importante

---

## 7. OBSERVABILIDAD, SEÑALES Y TRACE_ID

### 7.1. Documentos Constitucionales (Nivel: CONSTITUCIONAL)

| Ruta | Título | Propósito | Estado |
|------|--------|-----------|--------|
| `docs/CONTRATO_CANONICO_SENALES.md` | Contrato Canónico de Señales | Definición formal de señal. Separación de responsabilidades, preparar ≠ emitir, gobierno de señales. | ✅ VIGENTE |
| `CERTIFICACION_SOURCE_OF_TRUTH_FASE1.md` | Certificación Source of Truth - Fase 1 | Incluye sección "Estatuto de Señales y Analíticas" (obligatoriedad, dos carriles, gobierno). | ✅ VIGENTE |

### 7.2. Documentos Estructurales (Nivel: ESTRUCTURAL)

| Ruta | Título | Propósito | Estado |
|------|--------|-----------|--------|
| `docs/ACTION_REGISTRY.md` | Action Registry | Registry de acciones. Integración con señales, automatizaciones. | ✅ VIGENTE |
| `docs/RUNTIME_ACTION_REGISTRY_V1.md` | Runtime Action Registry v1 | Registry de acciones en runtime. Contratos, validaciones. | ✅ VIGENTE |
| `docs/SYSTEM_MODES.md` | System Modes | Modos del sistema (NORMAL, DEGRADED, BROKEN). Derivación desde Coherence Engine. | ✅ VIGENTE |
| `docs/COHERENCE_ENGINE.md` | Coherence Engine | Motor de coherencia. Deriva System Modes, valida contratos. | ✅ VIGENTE |

### 7.3. Documentos Técnicos (Nivel: TÉCNICO)

| Ruta | Título | Propósito | Estado |
|------|--------|-----------|--------|
| `docs/checklists/CHECKLIST_SENALES.md` | Checklist de Señales | Checklist para implementar señales. Verificaciones, validaciones. | ✅ VIGENTE |
| `IMPLEMENTACION_EMISION_SENALES.md` | Implementación Emisión de Señales | Documentación de implementación. Código, ejemplos, integración. | ✅ VIGENTE |
| `DIAGNOSTICO_PAQUETES_SENALES_AUTOMATIZACIONES.md` | Diagnóstico Paquetes Señales Automatizaciones | Análisis del estado actual. Problemas, propuestas. | ✅ VIGENTE |

**Observaciones:**
- `docs/CONTRATO_CANONICO_SENALES.md` es el documento constitucional principal
- La observabilidad está integrada en múltiples documentos (System Modes, Coherence Engine, Runtime Guard)
- No existe un documento unificado de "observabilidad" — está distribuido

---

## 8. MIGRACIÓN PROGRESIVA (SHADOW → ENFORCED)

### 8.1. Documentos Estructurales (Nivel: ESTRUCTURAL)

| Ruta | Título | Propósito | Estado |
|------|--------|-----------|--------|
| `docs/UI_ADMIN_MIGRATION_V1.md` | Migración de UIs Admin al Sistema Canónico v1 | Proceso canónico completo de migración. Fases, descubrimiento, validación, activación gradual. | ✅ VIGENTE |
| `docs/UI_ADMIN_FACTORY_V1.md` | UI Admin Factory v1 | Incluye sección "Modo Shadow vs Modo Enforced" y "Estrategia de Migración" (4 fases). | ✅ VIGENTE |

### 8.2. Documentos de Progreso (Nivel: DIAGNÓSTICO)

| Ruta | Título | Propósito | Estado |
|------|--------|-----------|--------|
| `docs/ADMIN_MIGRATION_PROGRESS.md` | Progreso de Migración Admin - Tipo B | Estado actual de migración de handlers. 8/15 migrados, pendientes listados. | ✅ VIGENTE |
| `docs/ADMIN_MIGRATION_INVENTORY.md` | Inventario de Migración Admin | Clasificación de handlers (Tipo A/B/C). Patrón de migración, priorización. | ✅ VIGENTE |

**Observaciones:**
- `docs/UI_ADMIN_MIGRATION_V1.md` es el documento principal del proceso de migración
- `docs/UI_ADMIN_FACTORY_V1.md` complementa con detalles técnicos del modo shadow/enforced
- Los documentos de progreso son históricos y se actualizan constantemente

---

## 9. ELIMINACIÓN CANÓNICA DE LEGACY

### 9.1. Documentos Constitucionales (Nivel: CONSTITUCIONAL)

| Ruta | Título | Propósito | Estado |
|------|--------|-----------|--------|
| `CERTIFICACION_SOURCE_OF_TRUTH_FASE1.md` | Certificación Source of Truth - Fase 1 | Incluye sección "Estatuto del Legacy y Migraciones": aislamiento, propósito, proceso, prohibición de fallback. | ✅ VIGENTE |

### 9.2. Documentos Estructurales (Nivel: ESTRUCTURAL)

| Ruta | Título | Propósito | Estado |
|------|--------|-----------|--------|
| `docs/MIGRATIONS_POLICY.md` | Migrations Policy | Política de migraciones. Proceso canónico para migrar datos de legacy a PostgreSQL. | ✅ VIGENTE |
| `docs/DB_OWNERSHIP_POLICY.md` | DB Ownership Policy | Política de propiedad de BD. Reglas sobre qué sistemas pueden escribir dónde. | ✅ VIGENTE |
| `docs/DB_OWNERSHIP_AUDIT.md` | DB Ownership Audit | Auditoría de propiedad de BD. Análisis de qué código escribe dónde. | ✅ VIGENTE |
| `docs/DB_OWNERSHIP_REMEDIATION.md` | DB Ownership Remediation | Plan de remediación. Cómo corregir violaciones de propiedad de BD. | ✅ VIGENTE |

**Observaciones:**
- El estatuto del legacy está bien definido en `CERTIFICACION_SOURCE_OF_TRUTH_FASE1.md`
- Existen políticas complementarias de migración y ownership
- No existe un documento unificado de "eliminación de legacy" — está fragmentado

---

## 10. PRINCIPIOS CONSTITUCIONALES DEL SISTEMA

### 10.1. Documentos Constitucionales (Nivel: CONSTITUCIONAL)

| Ruta | Título | Propósito | Estado |
|------|--------|-----------|--------|
| `PRINCIPIOS_INMUTABLES_AURIPORTAL.md` | Principios Inmutables de AuriPortal | Columna vertebral estructural. 9 principios inmutables, 8 reglas obligatorias, filosofía de evolución. | ✅ VIGENTE |
| `CERTIFICACION_SOURCE_OF_TRUTH_FASE1.md` | Certificación Source of Truth - Fase 1 | Principios constitucionales del SOT. Soberanía única, inmutabilidad de decisiones, clasificación de entidades. | ✅ VIGENTE |
| `docs/CONTRACT_OF_CONTRACTS.md` | Contract of Contracts | Sistema de contratos. Relación entre contratos, jerarquía, cumplimiento. | ✅ VIGENTE |

### 10.2. Documentos Estructurales (Nivel: ESTRUCTURAL)

| Ruta | Título | Propósito | Estado |
|------|--------|-----------|--------|
| `docs/ADMIN_UI_CONTRACT_V1.md` | Contrato Canónico de UI Admin v1 | Principios constitucionales de UI Admin. 28 invariantes, 29 garantías, capacidades. | ✅ VIGENTE |
| `docs/UI_ADMIN_FACTORY_V1.md` | UI Admin Factory v1 | Principios del Factory. Responsabilidades, no-responsabilidades, integración. | ✅ VIGENTE |
| `docs/UI_ADMIN_REGISTRY_V1.md` | UI Admin Registry v1 | Principios del Registry. Invariantes, estados, integración. | ✅ VIGENTE |

**Observaciones:**
- `PRINCIPIOS_INMUTABLES_AURIPORTAL.md` es el documento constitucional **más general** (columna vertebral)
- Los documentos de contrato (SOT, UI Admin) son constitucionales pero específicos a sus dominios
- `docs/CONTRACT_OF_CONTRACTS.md` proporciona el marco general para todos los contratos

---

## MAPA DE "QUÉ EXPLICA QUÉ"

### Jerarquía Constitucional

```
1. PRINCIPIOS_INMUTABLES_AURIPORTAL.md
   └─ Columna vertebral general
   
2. CERTIFICACION_SOURCE_OF_TRUTH_FASE1.md
   └─ Principios constitucionales SOT
   
3. docs/ADMIN_UI_CONTRACT_V1.md
   └─ Principios constitucionales UI Admin
   
4. docs/CONTRACT_OF_CONTRACTS.md
   └─ Sistema de contratos (marco general)
```

### Especializaciones por Dominio

```
SOURCE OF TRUTH:
├─ docs/SOURCE_OF_TRUTH_CERTIFICATION.md (operativo)
├─ docs/SOT_*.md (específicos por entidad)
└─ DIAGNOSTICO_SOURCE_OF_TRUTH_FASE1.md (diagnóstico)

UI ADMIN:
├─ docs/UI_ADMIN_FACTORY_V1.md (Factory)
├─ docs/UI_ADMIN_REGISTRY_V1.md (Registry)
├─ docs/UI_ADMIN_SCHEMA_V1_README.md (Schema)
└─ docs/ADMIN_ROUTER_CONTRACT.md (Router)

MIGRACIÓN:
├─ docs/UI_ADMIN_MIGRATION_V1.md (proceso)
├─ docs/ADMIN_MIGRATION_PROGRESS.md (progreso)
└─ docs/ADMIN_MIGRATION_INVENTORY.md (inventario)
```

### Relaciones entre Documentos

1. **SOT → UI Admin**: La certificación SOT establece que Admin es el panel de gobierno (sección 8)
2. **UI Admin Contract → Factory/Registry/Schema**: El contrato define invariantes que implementan Factory/Registry/Schema
3. **Assembly Check → Factory/Registry**: Assembly Check valida que Factory y Registry cumplen schemas
4. **Router Contract → Router Rules**: El contrato establece principios; las reglas detallan implementación
5. **Señales → Automatizaciones**: El contrato de señales conecta con automatizaciones (referencias cruzadas)

---

## HUECOS DETECTADOS

### 1. Observabilidad Unificada
**Problema:** No existe un documento unificado que explique el sistema completo de observabilidad (trace_id, logging estructurado, señales, System Modes, Coherence Engine).  
**Estado actual:** Fragmentado en múltiples documentos.  
**Propuesta:** Crear `docs/OBSERVABILIDAD_SISTEMA_V1.md` que unifique y referencie documentos específicos.

### 2. Robustez UI Admin Unificada
**Problema:** La robustez de UI Admin está fragmentada en múltiples contratos específicos (HTML/JS separation, API handlers, automatizaciones).  
**Estado actual:** Cada aspecto tiene su contrato, pero no hay visión unificada.  
**Propuesta:** Podría añadirse una sección en `docs/ADMIN_UI_CONTRACT_V1.md` que unifique estos aspectos.

### 3. Eliminación de Legacy Unificada
**Problema:** El estatuto del legacy está en la certificación SOT, pero el proceso de eliminación está fragmentado (migrations policy, DB ownership, etc.).  
**Estado actual:** Bien definido conceptualmente, pero proceso fragmentado.  
**Propuesta:** Crear `docs/LEGACY_ELIMINATION_PROCESS.md` que unifique el proceso completo.

### 4. Relación SOT ↔ UI Admin Explícita
**Problema:** Aunque `CERTIFICACION_SOURCE_OF_TRUTH_FASE1.md` menciona que Admin es el panel de gobierno (sección 8), no existe un documento que explique explícitamente cómo UI Admin interactúa con SOT.  
**Estado actual:** Implícito en múltiples documentos.  
**Propuesta:** Añadir sección en `docs/ADMIN_UI_CONTRACT_V1.md` o crear documento específico.

### 5. Trace_ID y Propagación
**Problema:** Aunque trace_id se menciona en múltiples documentos (observabilidad, señales, errores), no existe un documento que explique explícitamente el sistema completo de trace_id y propagación.  
**Estado actual:** Mencionado pero no unificado.  
**Propuesta:** Crear `docs/TRACE_ID_SYSTEM_V1.md` o añadir a documento de observabilidad.

---

## PROPUESTA DE ORDEN CANÓNICO FUTURO

### Documentos "Constitución" (Nivel 1)

Estos documentos son **LEY OPERATIVA** y deben referenciarse siempre:

1. **`PRINCIPIOS_INMUTABLES_AURIPORTAL.md`**
   - Columna vertebral general
   - Principios NO NEGOCIABLES
   - Referencia: Siempre

2. **`CERTIFICACION_SOURCE_OF_TRUTH_FASE1.md`**
   - Certificación constitucional SOT
   - Referencia: Para cualquier trabajo sobre SOT

3. **`docs/ADMIN_UI_CONTRACT_V1.md`**
   - Contrato canónico UI Admin
   - Referencia: Para cualquier trabajo sobre UI Admin

4. **`docs/CONTRACT_OF_CONTRACTS.md`**
   - Sistema de contratos
   - Referencia: Para entender la relación entre contratos

### Documentos "Estructurales" (Nivel 2)

Estos documentos definen **arquitectura** y deben referenciarse según el dominio:

1. **Source of Truth:**
   - `docs/SOURCE_OF_TRUTH_CERTIFICATION.md` (operativo)
   - `docs/SOT_*.md` (específicos por entidad)

2. **UI Admin:**
   - `docs/UI_ADMIN_FACTORY_V1.md`
   - `docs/UI_ADMIN_REGISTRY_V1.md`
   - `docs/UI_ADMIN_SCHEMA_V1_README.md`
   - `docs/ADMIN_ROUTER_CONTRACT.md`
   - `docs/ADMIN_ROUTER_CANONICAL_RULES.md`

3. **Observabilidad:**
   - `docs/CONTRATO_CANONICO_SENALES.md`
   - `docs/SYSTEM_MODES.md`
   - `docs/COHERENCE_ENGINE.md`
   - `docs/RUNTIME_GUARD.md`

4. **Migración:**
   - `docs/UI_ADMIN_MIGRATION_V1.md`
   - `docs/MIGRATIONS_POLICY.md`

### Documentos "Técnicos" (Nivel 3)

Estos documentos son **implementación** y referencias técnicas:

1. Schemas JSON: `docs/*.json`
2. Checklists: `docs/checklists/*.md`
3. Protocolos: `docs/*_PROTOCOL*.md`
4. Contratos específicos: `docs/ADMIN_*_CONTRACT.md`

### Documentos "Históricos/Diagnóstico" (Nivel 4)

Estos documentos son **referencia histórica** o **diagnóstico**:

1. Diagnósticos: `*DIAGNOSTICO*.md`
2. Documentación histórica: `DOCUMENTACION_*.md` (v3.1, etc.)
3. Progreso: `*_PROGRESS.md`, `*_INVENTORY.md`

### Fusiones Propuestas

1. **`docs/ASSEMBLY_CHECK_SYSTEM.md` + `docs/ASSEMBLY_CHECK_SYSTEM_IMPLEMENTATION.md`**
   - Fusionar en un solo documento con secciones claras

2. **`docs/SOURCE_OF_TRUTH_CERTIFICATION.md` → Integrar en `CERTIFICACION_SOURCE_OF_TRUTH_FASE1.md`**
   - El segundo es más completo y constitucional
   - El primero puede convertirse en sección o eliminarse

3. **Documentos de observabilidad → `docs/OBSERVABILIDAD_SISTEMA_V1.md`**
   - Unificar señales, trace_id, System Modes, logging
   - Referenciar documentos específicos

---

## ESTADO DOCUMENTAL POR ÁMBITO

| Ámbito | Documentos | Estado | Complejidad |
|--------|-----------|--------|-------------|
| 1. SOT Canónico | 10 | ✅ Excelente | Media |
| 2. UI Admin Canónica | 15 | ✅ Excelente | Alta |
| 3. Factory/Registry/Schema | 5 | ✅ Excelente | Media |
| 4. Assembly Check | 6 | ✅ Bueno | Baja |
| 5. Robustez UI | 5 | ⚠️ Fragmentado | Media |
| 6. Router Registry | 5 | ✅ Excelente | Media |
| 7. Observabilidad | 8 | ⚠️ Fragmentado | Alta |
| 8. Migración Progresiva | 4 | ✅ Bueno | Baja |
| 9. Eliminación Legacy | 5 | ✅ Bueno | Media |
| 10. Principios Constitucionales | 6 | ✅ Excelente | Alta |

**Leyenda:**
- ✅ Excelente: Documentación completa, bien estructurada, fácil de seguir
- ✅ Bueno: Documentación suficiente, algunos huecos menores
- ⚠️ Fragmentado: Documentación existente pero distribuida, necesita unificación

---

## CONCLUSIÓN

El movimiento estructural hacia Source of Truth canónico y UI Admin canónica está **ampliamente documentado** en AuriPortal. Existen **110+ documentos** relevantes distribuidos en múltiples capas (constitucional, estructural, técnico, diagnóstico).

**Fortalezas:**
- Documentación constitucional sólida (`PRINCIPIOS_INMUTABLES_AURIPORTAL.md`, `CERTIFICACION_SOURCE_OF_TRUTH_FASE1.md`, `docs/ADMIN_UI_CONTRACT_V1.md`)
- Documentación estructural detallada (Factory, Registry, Schema, Router)
- Documentación técnica completa (schemas JSON, contratos específicos)
- Documentación de migración y progreso activa

**Áreas de mejora:**
- Unificación de observabilidad (señales, trace_id, System Modes)
- Unificación de robustez UI Admin
- Clarificación de relación SOT ↔ UI Admin
- Algunas fusiones propuestas de documentos solapados

**Prioridad de unificaciones:**
1. Alta: Observabilidad unificada
2. Media: Robustez UI Admin unificada
3. Baja: Fusiones de documentos solapados (Assembly Check, SOT Certification)

---

**Fin del Inventario Constitucional**



