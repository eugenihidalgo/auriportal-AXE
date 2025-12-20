// src/core/config/progress-ux.config.js
// Configuración pasiva para experiencia UX de progreso
//
// PRINCIPIO: Configuración estática, sin lógica condicional compleja.
// Solo textos y descripciones que se mezclan con datos del motor.
//
// Fail-open: Si no existe una clave, se usan defaults seguros.

export default {
  default: {
    nivel_nombre_prefix: "Nivel",
    mensaje_corto: "Sigues avanzando",
    mensaje_largo: "Tu proceso continúa paso a paso."
  },
  
  fases: {
    // Clave = fase_id (coincide con fase_efectiva.id del motor)
    // Ejemplo de estructura (extensible):
    // sanacion: {
    //   descripcion: "Fase inicial de sanación y conexión.",
    //   mensaje_corto: "Comenzando tu camino",
    //   mensaje_largo: "Esta fase te permite establecer las bases de tu proceso de sanación."
    // },
    // sanacion_avanzada: {
    //   descripcion: "Integración y consolidación del trabajo previo.",
    //   mensaje_corto: "Integrando lo aprendido",
    //   mensaje_largo: "Esta fase consolida lo trabajado en fases anteriores."
    // },
    // canalizacion: {
    //   descripcion: "Fase de canalización y conexión espiritual.",
    //   mensaje_corto: "Canalizando energía",
    //   mensaje_largo: "En esta fase desarrollas tu capacidad de canalización."
    // }
  },
  
  niveles: {
    // Opcional: configuración por nivel exacto (clave = string del número)
    // Ejemplo:
    // "1": {
    //   descripcion: "Nivel inicial de tu proceso."
    // },
    // "7": {
    //   descripcion: "Consolidación del proceso."
    // }
  }
};













