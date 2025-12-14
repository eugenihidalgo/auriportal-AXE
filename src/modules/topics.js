// src/modules/topics.js
// Generación dinámica de temas AuriPortal v3.1

import { getTemaState } from "./tema.js";

// Temas iniciales
export const TEMAS_BASE = [
  { id: "tema1", nombre: "Limpieza de mis canales perceptivos" },
  { id: "tema2", nombre: "Abundancia" },
  { id: "tema3", nombre: "Salud física" }
];

/**
 * Genera el HTML de las tarjetas de tema usando datos reales del alumno
 */
export async function generarTemasHTML(student, env) {
  return TEMAS_BASE.map(t => {
    let estado;
    try {
      estado = getTemaState(student, t.id);
    } catch {
      estado = {
        id: t.id,
        nombre: t.nombre,
        contador: 0,
        objetivo: "—",
        objetivoCumplido: false
      };
    }

    const objetivoTexto = estado.objetivo === "—"
      ? "—"
      : `${estado.objetivo}${estado.objetivoCumplido ? " (cumplido)" : ""}`;

    return `
      <div class="tema-card">
        <div class="tema-title">${estado.nombre}</div>
        <div class="tema-info">
          Veces trabajado: ${estado.contador}<br>
          Objetivo recomendado: ${objetivoTexto}
        </div>
        <button class="boton" onclick="location.href='/topic/${estado.id}'">
          Entrar en este tema
        </button>
      </div>
    `;
  }).join("");
}
