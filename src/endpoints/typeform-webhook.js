// src/endpoints/typeform-webhook.js
// Webhook de Typeform para formulario de bienvenida
// Envía datos a ClickUp y SQL

import { CLICKUP, TYPEFORM } from "../config/config.js";
import { clickup } from "../services/clickup.js";
import { getDatabase, students } from "../../database/db.js";
import { calcularNivelAutomatico } from "../modules/nivel.js";

/**
 * Extrae el valor de una respuesta de Typeform por field ref
 */
function extraerValorPorRef(answers, fieldRef) {
  const answer = answers.find(a => a.field?.ref === fieldRef);
  if (!answer) return null;
  
  // Diferentes tipos de respuestas
  if (answer.type === 'text' && answer.text) return answer.text.trim();
  if (answer.type === 'email' && answer.email) return answer.email.trim().toLowerCase();
  if (answer.type === 'textarea' && answer.text) return answer.text.trim();
  if (answer.type === 'choice' && answer.choice) return answer.choice.label || answer.choice.other || null;
  if (answer.type === 'choices' && answer.choices) return answer.choices.labels?.join(', ') || null;
  
  return null;
}

export default async function typeformWebhookHandler(request, env, ctx) {
  if (request.method !== "POST") {
    return new Response(
      `Método no permitido. Este endpoint solo acepta POST. Método recibido: ${request.method}`,
      { 
        status: 405,
        headers: { "Content-Type": "text/plain" }
      }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch (err) {
    console.error("Error parseando JSON del webhook:", err);
    return new Response("JSON inválido", { status: 400 });
  }

  const formResponse = body.form_response || {};
  const answers = formResponse.answers || [];
  const hidden = formResponse.hidden || {};
  const submittedAt = formResponse.submitted_at || new Date().toISOString();

  // -----------------------
  // EXTRAER DATOS DEL FORMULARIO
  // -----------------------
  
  // Email (prioridad: hidden field > campo email del formulario)
  // El email viene como hidden field desde la redirección, Typeform ya no lo pide
  let email = 
    hidden.email ||
    extraerValorPorRef(answers, TYPEFORM.REF_EMAIL) ||
    null;

  if (email) email = email.trim().toLowerCase();
  if (!email) {
    console.error("❌ Webhook Typeform: Falta email");
    return new Response(JSON.stringify({ error: "Falta email" }), { 
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  // Apodo
  const apodo = extraerValorPorRef(answers, TYPEFORM.REF_APODO) || "";

  // Qué les gustaría hacer
  const queGustariaHacer = extraerValorPorRef(answers, TYPEFORM.REF_QUE_GUSTARIA_HACER) || "";

  // Idea nueva
  const ideaNueva = extraerValorPorRef(answers, TYPEFORM.REF_IDEA_NUEVA) || "";

  // Fecha de inscripción = fecha de envío del formulario
  const fechaInscripcion = new Date(submittedAt).getTime(); // Timestamp en milisegundos

  // Calcular nivel automático
  const nivelCalculado = calcularNivelAutomatico(fechaInscripcion);

  console.log(`📝 Webhook Typeform recibido para: ${email}`);
  console.log(`   Apodo: ${apodo || "(vacío)"}`);
  console.log(`   Fecha inscripción: ${new Date(fechaInscripcion).toISOString()}`);
  console.log(`   Nivel calculado: ${nivelCalculado}`);

  // -----------------------
  // GUARDAR EN SQL
  // -----------------------
  try {
    const db = getDatabase();
    students.upsert({
      email,
      apodo,
      nivel: nivelCalculado,
      nivel_manual: 0, // No es manual, es automático
      fecha_inscripcion: new Date(fechaInscripcion).toISOString(),
      que_gustaria_hacer: queGustariaHacer,
      idea_nueva: ideaNueva,
      racha_actual: 0,
      ultima_practica_date: null
    });
    console.log(`✅ Estudiante guardado/actualizado en SQL: ${email}`);
  } catch (err) {
    console.error(`❌ Error guardando en SQL:`, err);
    // Continuar aunque falle SQL
  }

  // -----------------------
  // CREAR/ACTUALIZAR EN CLICKUP
  // -----------------------
  try {
    // Buscar tarea existente por email
    const tasks = await clickup.getTasks(env, CLICKUP.LIST_ID, { archived: false, page: 0 });
    const taskExistente = tasks.find(t => {
      const emailField = t.custom_fields?.find(cf => cf.id === CLICKUP.CF_EMAIL);
      return emailField && String(emailField.value).toLowerCase() === email;
    });

    const nombreTarea = apodo || email;

    if (taskExistente) {
      // Actualizar tarea existente
      const updateBody = {
        name: nombreTarea,
        custom_fields: [
          { id: CLICKUP.CF_EMAIL, value: email },
          { id: CLICKUP.CF_APODO, value: apodo || "" },
          { id: CLICKUP.CF_FECHA_INSCRIPCION, value: fechaInscripcion },
          { id: CLICKUP.CF_NIVEL_AURELIN, value: nivelCalculado }
        ]
      };

      await clickup.updateTask(env, taskExistente.id, updateBody);
      
      // Actualizar clickup_task_id en SQL
      const db = getDatabase();
      db.prepare('UPDATE students SET clickup_task_id = ? WHERE email = ?').run(taskExistente.id, email);
      
      console.log(`✅ Tarea actualizada en ClickUp: ${taskExistente.id}`);
      
      return new Response(JSON.stringify({ 
        status: "ok", 
        action: "updated",
        email, 
        apodo,
        nivel: nivelCalculado,
        fechaInscripcion: new Date(fechaInscripcion).toISOString(),
        clickupTaskId: taskExistente.id,
        message: "Estudiante actualizado exitosamente"
      }), {
        headers: { "Content-Type": "application/json" }
      });
    } else {
      // Crear nueva tarea
      const createBody = {
        name: nombreTarea,
        custom_fields: [
          { id: CLICKUP.CF_EMAIL, value: email },
          { id: CLICKUP.CF_APODO, value: apodo || "" },
          { id: CLICKUP.CF_FECHA_INSCRIPCION, value: fechaInscripcion },
          { id: CLICKUP.CF_NIVEL_AURELIN, value: nivelCalculado },
          { id: CLICKUP.CF_STREAK_GENERAL, value: 0 }
        ]
      };

      const newTask = await clickup.createTask(env, CLICKUP.LIST_ID, createBody);
      
      // Actualizar clickup_task_id en SQL
      const db = getDatabase();
      db.prepare('UPDATE students SET clickup_task_id = ? WHERE email = ?').run(newTask.id, email);
      
      console.log(`✅ Nueva tarea creada en ClickUp: ${newTask.id}`);
      
      return new Response(JSON.stringify({ 
        status: "ok", 
        action: "created",
        email, 
        apodo,
        nivel: nivelCalculado,
        fechaInscripcion: new Date(fechaInscripcion).toISOString(),
        clickupTaskId: newTask.id,
        message: "Estudiante creado exitosamente"
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }
  } catch (err) {
    console.error("❌ Error procesando webhook en ClickUp:", err);
    return new Response(JSON.stringify({ 
      error: "Error procesando webhook", 
      details: err.message 
    }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
