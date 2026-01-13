# UI Projection Model v1 (PDUI)

## Estado
CANÓNICO · CONSTITUCIONAL

## Objetivo
Definir el modelo único, obligatorio y universal de construcción de interfaces
en AuriPortal mediante proyecciones calculadas en backend.

Este modelo es conocido como:

PROJECTION-DRIVEN UI (PDUI)

---

## PRINCIPIO FUNDAMENTAL

La UI NO representa estado.
La UI representa PROYECCIONES.

Toda información visible en una UI debe ser el resultado de una proyección
calculada por el backend a partir de parámetros explícitos.

---

## DEFINICIÓN FORMAL

Toda UI PDUI responde al siguiente esquema:

UI = render( projection( params ) )

Donde:
- params: conjunto explícito de parámetros (view_layer, lista_tipo, context_id, filtros)
- projection: cálculo determinista en backend
- render: función pura de renderizado sin lógica de dominio

---

## AUTORIDAD DE ESTADO

El backend es la ÚNICA autoridad de estado.

El frontend:
- NO calcula estados
- NO infiere estados
- NO decide columnas
- NO combina capas
- NO reutiliza estados previos
- NO deriva progresos
- NO compara fechas
- NO calcula tiempos

Toda decisión de estado pertenece al backend.

---

## OBLIGACIONES DEL BACKEND

El backend DEBE:
1. Aceptar parámetros explícitos
2. Validar dichos parámetros
3. Calcular proyecciones completas
4. Devolver estructuras de estado explícitas (ej: state_by_view_layer)
5. Incluir siempre el contexto de cálculo en la respuesta

Ejemplo mínimo obligatorio:

{
  data: {...},
  context: {
    view_layer: "shared",
    lista_tipo: "recurrente"
  }
}

---

## OBLIGACIONES DEL FRONTEND

El frontend SOLO puede:
- Solicitar datos con parámetros explícitos
- Renderizar la proyección recibida
- Refetchear tras cualquier mutación
- Re-renderizar si la proyección cambia

El frontend NO puede modificar, reinterpretar ni enriquecer el estado.

---

## PROHIBICIONES EXPLÍCITAS EN FRONTEND

Queda prohibido:
- Calcular estados visuales
- Inferir columnas
- Comparar fechas
- Calcular días o progresos
- Combinar capas (shared + pde)
- Recordar estados anteriores
- Decidir efectos post-acción

Cualquier UI que haga esto viola PDUI.

---

## REFRESH OBLIGATORIO

Toda acción que muta estado implica:

POST → persistencia → GET → nueva proyección → render

No se permite actualización optimista basada en inferencias.

---

## RELACIÓN CON CONTEXTOS

Un contexto NO es una UI distinta.

Un contexto es:
context_id → params → projection

Gracias a PDUI, los contextos:
- no duplican pantallas
- no duplican lógica
- no crean deuda técnica

---

## APLICABILIDAD

PDUI aplica a TODO AuriPortal:
- Alquimia
- Progreso
- Widgets
- Paquetes
- Contextos
- GOD
- MASTER
- Cualquier UI futura

---

## VIOLACIÓN CONSTITUCIONAL

Cualquier código que viole este modelo:
- debe ser refactorizado
- no puede considerarse canónico
- no puede servir de base para nuevas features

---

## VERSIONADO

Versión: v1
Estado: ACTIVA
Fecha de certificación: 2026-01
