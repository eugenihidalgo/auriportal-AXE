// src/services/clickup.js
// Servicio centralizado para integración con ClickUp API

import { CLICKUP } from "../config/config.js";

/**
 * Servicio centralizado de ClickUp
 */
export const clickup = {
  /**
   * Obtiene todas las tareas de una lista
   */
  async getTasks(env, listId = CLICKUP.LIST_ID, options = {}) {
    const { archived = false, page = 0 } = options;
    const url = `${CLICKUP.API_BASE}/list/${listId}/task?archived=${archived}&page=${page}`;
    
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: env.CLICKUP_API_TOKEN }
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Error obteniendo tasks:", res.status, err);
      throw new Error(`ClickUp fetch failed: ${res.status}`);
    }

    const data = await res.json();
    return data.tasks || [];
  },

  /**
   * Busca una tarea por email
   * Busca en todas las páginas si es necesario
   */
  async findTaskByEmail(env, email, listId = CLICKUP.LIST_ID) {
    const lower = email.toLowerCase();
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      try {
        const tasks = await this.getTasks(env, listId, { archived: false, page });
        
        if (tasks.length === 0) {
          hasMore = false;
          break;
        }

        // Buscar en esta página
        const found = tasks.find(t => {
          const cfEmail = t.custom_fields?.find(cf => cf.id === CLICKUP.CF_EMAIL)?.value;
          return cfEmail && String(cfEmail).toLowerCase() === lower;
        });

        if (found) {
          return found;
        }

        // Si hay menos de 100 tareas, no hay más páginas
        if (tasks.length < 100) {
          hasMore = false;
        } else {
          page++;
        }
      } catch (err) {
        console.error(`Error buscando tarea por email (página ${page}):`, err);
        break;
      }
    }

    return null;
  },

  /**
   * Crea una nueva tarea
   */
  async createTask(env, listId, taskData) {
    const res = await fetch(
      `${CLICKUP.API_BASE}/list/${listId}/task`,
      {
        method: "POST",
        headers: {
          Authorization: env.CLICKUP_API_TOKEN,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(taskData)
      }
    );

    if (!res.ok) {
      const text = await res.text();
      console.error("Error creando tarea:", res.status, text);
      throw new Error(`ClickUp create task error: ${res.status}`);
    }

    return await res.json();
  },

  /**
   * Actualiza una tarea existente
   */
  async updateTask(env, taskId, updateData) {
    const res = await fetch(`${CLICKUP.API_BASE}/task/${taskId}`, {
      method: "PUT",
      headers: {
        "Authorization": env.CLICKUP_API_TOKEN,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(updateData)
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Error actualizando tarea:", res.status, text);
      throw new Error(`ClickUp update task error: ${res.status}`);
    }

    return await res.json();
  },

  /**
   * Actualiza campos personalizados de una tarea
   * Para campos de tipo short_text, puede requerir formato especial
   */
  async updateCustomFields(env, taskId, fields) {
    // Log para debugging
    const nivelField = fields.find(cf => cf.id === CLICKUP.CF_NIVEL_AURELIN);
    if (nivelField) {
      console.log(`   🔧 [ClickUp] Actualizando campo nivel: ${JSON.stringify(nivelField)}`);
    }
    
    return this.updateTask(env, taskId, { custom_fields: fields });
  },
  
  /**
   * Actualiza un campo personalizado específico usando el endpoint de campos
   * ClickUp espera:
   * - Para campos de tipo "date": timestamp en milisegundos (número)
   * - Para campos de tipo "number": número
   * - Para campos de tipo "short_text": string
   */
  async updateCustomField(env, taskId, fieldId, value) {
    const url = `${CLICKUP.API_BASE}/task/${taskId}/field/${fieldId}`;
    
    // Determinar el formato correcto según el tipo de valor
    // Si es un timestamp grande (> 1000000000000), es una fecha → enviar como número (milisegundos)
    // Si es un número pequeño, es un número → enviar como número
    // Si es string, enviar como string
    let finalValue = value;
    
    if (typeof value === 'number') {
      // Mantener como número (ClickUp espera números para date y number)
      finalValue = value;
    } else if (value instanceof Date) {
      // Convertir Date a timestamp en milisegundos (número)
      finalValue = value.getTime();
    } else if (typeof value === 'string') {
      // Intentar parsear si parece un número o fecha
      const numValue = Number(value);
      if (!isNaN(numValue) && value.trim() !== '') {
        // Si es un string numérico, convertir a número
        finalValue = numValue;
      } else {
        // Mantener como string
        finalValue = value;
      }
    }
    
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": env.CLICKUP_API_TOKEN,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ value: finalValue })
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Error actualizando campo personalizado:", res.status, text);
      throw new Error(`ClickUp update custom field error: ${res.status}`);
    }

    return await res.json();
  },

  /**
   * Obtiene los campos personalizados de una lista
   */
  async getCustomFields(env, listId = CLICKUP.LIST_ID) {
    const url = `${CLICKUP.API_BASE}/list/${listId}/field`;
    
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: env.CLICKUP_API_TOKEN }
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Error obteniendo custom fields:", res.status, err);
      throw new Error(`ClickUp get custom fields failed: ${res.status}`);
    }

    const data = await res.json();
    return data.fields || [];
  },

  /**
   * Añade un comentario a una tarea
   */
  async addComment(env, taskId, comment) {
    const res = await fetch(
      `https://api.clickup.com/api/v2/task/${taskId}/comment`,
      {
        method: "POST",
        headers: {
          Authorization: env.CLICKUP_API_TOKEN,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ comment_text: comment })
      }
    );

    if (!res.ok) {
      const error = await res.text();
      console.error("Error añadiendo comentario:", res.status, error);
      throw new Error(`ClickUp add comment error: ${res.status}`);
    }

    return await res.json();
  }
};


