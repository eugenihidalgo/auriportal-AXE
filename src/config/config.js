// src/config/config.js
// Configuración global de ClickUp y Typeform para AuriPortal v3.1

export const CLICKUP = {
  API_BASE: "https://api.clickup.com/api/v2",
  // SOLO para sincronización de frases - NO para contactos/alumnos
  FOLDER_ID: process.env.CLICKUP_FOLDER_ID || "90128582162", // Folder ID donde están las listas de frases
  TEAM_ID: process.env.CLICKUP_TEAM_ID || "9012227922", // Team ID
  // NOTA: Ya no se usan LIST_ID, SPACE_ID ni campos personalizados para contactos
  // ClickUp solo se usa para sincronizar frases desde la carpeta específica
};

export const TYPEFORM = {
  BASE: "https://form.typeform.com/to/",

  // Onboarding (formulario de pruebas)
  ONBOARDING_ID: "GR5IErrl",

  // Campos Typeform del formulario de bienvenida
  REF_APODO: "36587773-fda9-4327-ad6a-ef121a4d11e1", // Bloque de apodo
  REF_QUE_GUSTARIA_HACER: "9170a4bf-782a-4c5d-85d5-9bc865f62af5", // Campo "qué les gustaría hacer"
  REF_IDEA_NUEVA: "9597166d-f16a-43a4-8589-544c9c750f67", // Campo "idea nueva"
  REF_EMAIL: "cbc121f0-233f-4dde-b62d-f4e8618a0c52", // Email (si existe en el formulario)

  // Mapeo de niveles a Typeforms de aprendizaje
  // Formato: nivel -> ID del Typeform
  // Si el usuario tiene nivel 3, va al nivel 3. Si tiene nivel 2, va al nivel 2, etc.
  NIVELES_TYPEFORM: {
    1: "AKNmWNrd", // Nivel 1 - Sanación PDE Mundo de luz
    2: "AKNmWNrd", // Nivel 2 (por defecto usa nivel 1 hasta que se configure)
    3: "AKNmWNrd", // Nivel 3 (por defecto usa nivel 1 hasta que se configure)
    // Añadir más niveles según se vayan creando los Typeforms
    // Ejemplo: 4: "ID_DEL_TYPEFORM_NIVEL_4",
    //          5: "ID_DEL_TYPEFORM_NIVEL_5",
  }
};

// Imagen principal de Auri
export const AURI = {
  IMAGE_URL: "https://images.typeform.com/images/tXs4JibWTbvb"
};
