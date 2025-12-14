// src/services/clickup-nuevo-alumno.js
// Servicio para crear tarea en ClickUp cuando se registra un nuevo alumno (V7)

import { clickup } from './clickup.js';
import { CLICKUP } from '../config/config.js';

/**
 * Crea tarea en ClickUp para cargar carta astral y diseño humano
 * @param {Object} env - Variables de entorno
 * @param {Object} datosAlumno - Datos del nuevo alumno
 * @returns {Promise<Object>}
 */
export async function crearTareaClickUpNuevoAlumno(env, datosAlumno) {
  try {
    const {
      email,
      nombre_completo,
      apodo,
      fecha_nacimiento,
      lugar_nacimiento,
      hora_nacimiento
    } = datosAlumno;

    // Título de la tarea
    const titulo = `Nuevo alumno – cargar carta astral y diseño humano`;
    
    // Descripción con todos los datos
    const descripcion = `
**Datos del alumno:**

- **Email:** ${email}
- **Nombre completo:** ${nombre_completo || 'No especificado'}
- **Apodo:** ${apodo || 'No especificado'}
- **Fecha de nacimiento:** ${fecha_nacimiento || 'No especificada'}
- **Lugar de nacimiento:** ${lugar_nacimiento || 'No especificado'}
- **Hora de nacimiento:** ${hora_nacimiento || 'No especificada'}

---

**Necesario subir:**

- [ ] Carta astral (imagen)
- [ ] Diseño humano (imagen)
- [ ] Añadir notas si es necesario

---

**Acciones:**

1. Subir carta astral en Admin Panel → /admin/astral?alumno_id=...
2. Subir diseño humano en Admin Panel → /admin/disenohumano?alumno_id=...
3. Completar tarea cuando ambos estén subidos
    `.trim();

    // Body de la tarea
    const body = {
      name: titulo,
      description: descripcion,
      custom_fields: [
        { id: CLICKUP.CF_EMAIL, value: email }
      ],
      assignees: [], // Se asignará a Eugeni manualmente o por configuración
      status: 'to do', // Estado inicial
      priority: {
        priority: 'high' // Alta prioridad
      }
    };

    // Crear tarea en ClickUp
    const nuevaTarea = await clickup.createTask(env, CLICKUP.LIST_ID, body);

    console.log(`✅ Tarea ClickUp creada para nuevo alumno ${email}: ${nuevaTarea.id}`);

    return {
      success: true,
      taskId: nuevaTarea.id,
      taskUrl: nuevaTarea.url || `https://app.clickup.com/t/${nuevaTarea.id}`
    };
  } catch (error) {
    console.error('Error creando tarea ClickUp para nuevo alumno:', error);
    return {
      success: false,
      error: error.message
    };
  }
}



