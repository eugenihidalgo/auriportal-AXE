// src/endpoints/typeform-webhook-v4.js
// Webhook de Typeform para formulario de bienvenida
// AuriPortal v4: Guarda prácticas y datos en PostgreSQL

import { TYPEFORM } from "../config/config.js";
import { query, alumnos, respuestas, aspectosPractica, progresoPedagogico } from "../../database/pg.js";
import { existsForDate, crearPractica } from "../modules/practice-v4.js";
import { calcularNivelAutomatico, getNivelInfo } from "../modules/nivel-v4.js";
import { updateStudentUltimaPractica, updateStudentStreak, findStudentByEmail } from "../modules/student-v4.js";
import { analytics } from "../services/analytics.js";

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

  // Extraer ID del aspecto desde la URL si existe
  const url = new URL(request.url);
  let aspectoId = null;
  if (url.pathname.startsWith('/typeform-webhook/aspecto/')) {
    const match = url.pathname.match(/\/aspecto\/(\d+)-/);
    if (match) {
      aspectoId = parseInt(match[1]);
      console.log(`📌 Webhook recibido para aspecto ID: ${aspectoId}`);
    }
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
  const fechaInscripcion = new Date(submittedAt);

  // Calcular nivel automático
  const nivelCalculado = calcularNivelAutomatico(fechaInscripcion.getTime());

  console.log(`📝 Webhook Typeform recibido para: ${email}`);
  console.log(`   Apodo: ${apodo || "(vacío)"}`);
  console.log(`   Fecha inscripción: ${fechaInscripcion.toISOString()}`);
  console.log(`   Nivel calculado: ${nivelCalculado}`);

  // -----------------------
  // GUARDAR EN POSTGRESQL
  // -----------------------
  try {
    // Crear o actualizar alumno
    const alumno = await alumnos.upsert({
      email,
      apodo: apodo || null,
      fecha_inscripcion: fechaInscripcion,
      nivel_actual: nivelCalculado,
      nivel_manual: null, // No es manual, es automático
      streak: 0,
      estado_suscripcion: 'activa'
    });

    console.log(`✅ Alumno guardado/actualizado en PostgreSQL: ${email} (ID: ${alumno.id})`);

    // Registrar evento de analytics: webhook recibido
    await analytics.registrarEvento({
      alumno_id: alumno.id,
      tipo_evento: 'webhook_typeform',
      metadata: {
        form_id: body.form_response?.form_id || null,
        form_title: body.form_response?.form?.title || null,
        es_nuevo: !alumno.fecha_inscripcion || new Date(alumno.fecha_inscripcion).toISOString() === fechaInscripcion.toISOString()
      }
    });

    // Obtener nivel actual del alumno (puede haber cambiado)
    const student = await findStudentByEmail(env, email);
    const nivelInfo = student ? await getNivelInfo(student) : { nivel: nivelCalculado };
    const nivelPractica = nivelInfo.nivel || nivelCalculado;

    // Obtener form_id y form_title del webhook
    const formId = body.form_response?.form_id || body.form_response?.form?.id || null;
    const formTitle = body.form_response?.form?.title || null;

    // Construir respuesta completa (todas las respuestas del formulario)
    const respuestaCompleta = answers.map(a => {
      const fieldTitle = a.field?.title || a.field?.ref || 'Sin título';
      let valor = '';
      if (a.type === 'text' && a.text) valor = a.text;
      else if (a.type === 'email' && a.email) valor = a.email;
      else if (a.type === 'textarea' && a.text) valor = a.text;
      else if (a.type === 'choice' && a.choice) valor = a.choice.label || a.choice.other || '';
      else if (a.type === 'choices' && a.choices) valor = a.choices.labels?.join(', ') || '';
      return `${fieldTitle}: ${valor}`;
    }).join('\n');

    // Guardar respuesta en histórico
    try {
      await respuestas.create({
        alumno_id: alumno.id,
        email: email,
        apodo: apodo || null,
        respuesta: respuestaCompleta || JSON.stringify(answers),
        nivel_practica: nivelPractica,
        form_id: formId,
        form_title: formTitle,
        submitted_at: new Date(submittedAt)
      });
      console.log(`✅ Respuesta guardada en histórico: ${email} (Nivel ${nivelPractica})`);
    } catch (err) {
      console.error('❌ Error guardando respuesta:', err);
    }

    // Identificar aspecto/practica por webhook o form_id
    // Si tenemos aspectoId de la URL, usarlo directamente
    let aspecto = null;
    if (aspectoId) {
      aspecto = await aspectosPractica.findById(aspectoId);
      if (aspecto) {
        console.log(`✅ Aspecto identificado desde URL: ${aspecto.nombre} (ID: ${aspecto.id})`);
      }
    }
    
    // Si no se encontró por URL, buscar por form_id o webhook
    if (!aspecto && formId) {
      // Buscar por form_id (puede ser el webhook URL o ID del formulario)
      aspecto = await aspectosPractica.findByWebhook(formId);
    }

    // AURIPORTAL V5: El webhook solo se usa para feedback/compartir experiencia
    // NO se crean prácticas aquí (se crean en /practica/registro)
    // Solo se guarda el feedback completo en respuestas
    
    // Intentar relacionar con práctica existente (match por timestamp y aspecto)
    let practicaRelacionada = null;
    if (aspectoId) {
      const fechaWebhook = new Date(submittedAt);
      
      const practicaExistente = await existsForDate(
        alumno.id,
        fechaWebhook,
        aspectoId
      );
      
      if (practicaExistente) {
        practicaRelacionada = practicaExistente.id;
        console.log(`✅ Feedback relacionado con práctica existente: ${practicaRelacionada}`);
      }
    }
    
    // Registrar evento analytics con has_feedback = true
    await analytics.registrarEvento({
      alumno_id: alumno.id,
      tipo_evento: 'webhook_typeform',
      metadata: {
        form_id: formId,
        form_title: formTitle,
        has_feedback: true,
        practica_relacionada: practicaRelacionada,
        aspecto_id: aspectoId || null
      }
    });
    
    console.log(`✅ Feedback de Typeform guardado para: ${email} (form_id: ${formId})`);
    
    // Responder éxito
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Feedback registrado correctamente',
      alumno_id: alumno.id 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('❌ Error procesando webhook de Typeform:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
