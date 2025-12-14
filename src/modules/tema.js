// src/modules/tema.js
// Gestión de contadores y objetivos por tema en AuriPortal v3.1

import { CLICKUP } from "../config/config.js";
import { clickup } from "../services/clickup.js";

/* -------------------------------------------------------------------------- */
/*                 MAPA DE TEMAS → CAMPOS PERSONALIZADOS CLICKUP             */
/* -------------------------------------------------------------------------- */

const TOPIC_FIELDS = {
  tema1: {
    id: "tema1",
    nombre: "Limpieza de mis canales perceptivos",
    cfCount: "4df03e10-dd47-450b-b552-8776689c17dc",
    cfGoal: "32b603a3-1479-42d6-a5aa-9dfe2d6b24c5"
  },
  tema2: {
    id: "tema2",
    nombre: "Abundancia",
    cfCount: "54076e3d-a3df-4c58-9160-6306f01825e6",
    cfGoal: "2d52b3e1-5fd7-4e07-811c-1bca1449e932"
  },
  tema3: {
    id: "tema3",
    nombre: "Salud física",
    cfCount: "db17c513-6c3e-4626-aaa3-0ef700556b58",
    cfGoal: "f56f4893-bd78-4f1c-b30d-60f29ed75394"
  }
};

/* -------------------------------------------------------------------------- */
/*                               HELPERS                                      */
/* -------------------------------------------------------------------------- */

function getCustomFieldFromStudent(student, fieldId) {
  const cfList = student.raw?.custom_fields || [];
  const cf = cfList.find(f => f.id === fieldId);
  return cf ? cf.value : null;
}

async function updateClickUpField(env, taskId, fieldId, value) {
  await clickup.updateCustomFields(env, taskId, [{ id: fieldId, value }]);
}

/* -------------------------------------------------------------------------- */
/*                  LECTURA DEL ESTADO DE UN TEMA                             */
/* -------------------------------------------------------------------------- */

export function getTemaState(student, topicId) {
  const config = TOPIC_FIELDS[topicId];
  if (!config) throw new Error(`Tema desconocido: ${topicId}`);

  const rawCount = getCustomFieldFromStudent(student, config.cfCount);
  const rawGoal = getCustomFieldFromStudent(student, config.cfGoal);

  const contador = Number(rawCount) || 0;
  const goalNum = rawGoal != null ? Number(rawGoal) : 0;

  let objetivo = "—";
  let objetivoCumplido = false;

  if (goalNum && goalNum > 0) {
    objetivo = String(goalNum);
    if (contador >= goalNum) objetivoCumplido = true;
  }

  return {
    id: config.id,
    nombre: config.nombre,
    contador,
    objetivo,
    objetivoCumplido
  };
}

/* -------------------------------------------------------------------------- */
/*                 INCREMENTAR CONTADOR DE UN TEMA                            */
/* -------------------------------------------------------------------------- */

export async function incrementarTema(student, env, topicId) {
  const config = TOPIC_FIELDS[topicId];
  if (!config) throw new Error(`Tema desconocido: ${topicId}`);

  const estadoActual = getTemaState(student, topicId);
  const nuevoContador = (estadoActual.contador || 0) + 1;

  await updateClickUpField(env, student.id, config.cfCount, nuevoContador);

  let objetivoCumplido = estadoActual.objetivoCumplido;
  let objetivo = estadoActual.objetivo;

  if (estadoActual.objetivo !== "—") {
    const goalNum = Number(estadoActual.objetivo);
    if (!isNaN(goalNum) && nuevoContador >= goalNum) {
      objetivoCumplido = true;
    }
  }

  return {
    id: config.id,
    nombre: config.nombre,
    contador: nuevoContador,
    objetivo,
    objetivoCumplido
  };
}
