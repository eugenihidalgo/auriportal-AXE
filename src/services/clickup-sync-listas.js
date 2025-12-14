// src/services/clickup-sync-listas.js
// Sincronización entre Lista 1 (Importación) y Lista 2 (Principal Aurelín)

import { CLICKUP } from "../config/config.js";
import { clickup } from "./clickup.js";
import { calcularNivelAutomatico } from "../modules/nivel.js";
import { findStudentByEmail } from "../modules/student.js";

// IDs de las listas
const LISTA_IMPORT = "901214540219"; // Lista de importación
const LISTA_PRINCIPAL = "901214375878"; // Lista principal Aurelín

/**
 * Obtiene el nombre desde la Lista 1 (Importación) por email
 */
async function obtenerNombreDesdeLista1(email, env) {
  try {
    const tasks = await clickup.getTasks(env, LISTA_IMPORT, { archived: false, page: 0 });
    const emailLower = email.toLowerCase();
    
    const task = tasks.find(t => {
      const cfEmail = t.custom_fields?.find(cf => cf.id === CLICKUP.CF_EMAIL)?.value;
      return cfEmail && String(cfEmail).toLowerCase() === emailLower;
    });
    
    if (task) {
      // Prioridad: nombre de tarea > apodo > email
      return task.name || 
             task.custom_fields?.find(cf => cf.id === CLICKUP.CF_APODO)?.value ||
             email;
    }
    
    return null;
  } catch (err) {
    console.error(`Error obteniendo nombre desde Lista 1 para ${email}:`, err);
    return null;
  }
}

/**
 * Obtiene la fecha de inscripción desde la Lista 1 por email
 */
async function obtenerFechaInscripcionDesdeLista1(email, env) {
  try {
    const tasks = await clickup.getTasks(env, LISTA_IMPORT, { archived: false, page: 0 });
    const emailLower = email.toLowerCase();
    
    const task = tasks.find(t => {
      const cfEmail = t.custom_fields?.find(cf => cf.id === CLICKUP.CF_EMAIL)?.value;
      return cfEmail && String(cfEmail).toLowerCase() === emailLower;
    });
    
    if (task) {
      const fechaField = task.custom_fields?.find(cf => cf.id === CLICKUP.CF_FECHA_INSCRIPCION);
      const fechaValue = fechaField?.value;
      if (fechaValue) {
        try {
          // La fecha puede venir como texto (YYYY-MM-DD o MM/DD/YYYY) o como timestamp
          let fechaTimestamp = null;
          
          if (typeof fechaValue === 'string') {
            // Intentar parsear como fecha
            const fechaParsed = new Date(fechaValue);
            if (!isNaN(fechaParsed.getTime())) {
              fechaTimestamp = fechaParsed.getTime();
            }
          } else {
            // Es timestamp numérico
            const timestamp = Number(fechaValue);
            if (!isNaN(timestamp) && timestamp > 0) {
              fechaTimestamp = timestamp;
            }
          }
          
          if (fechaTimestamp) {
            console.log(`   📅 ${email}: Fecha encontrada en Lista 1 = ${new Date(fechaTimestamp).toISOString()}`);
            return fechaTimestamp;
          } else {
            console.log(`   ⚠️  ${email}: Fecha en Lista 1 no es válida: ${fechaValue}`);
          }
        } catch (err) {
          console.warn(`   ⚠️  Error parseando fecha de Lista 1 para ${email}: ${err.message}`);
        }
      } else {
        console.log(`   ⚠️  ${email}: Tarea encontrada en Lista 1 pero sin fecha de inscripción`);
      }
    } else {
      console.log(`   ⚠️  ${email}: No encontrado en Lista 1`);
    }
    
    return null;
  } catch (err) {
    console.error(`Error obteniendo fecha inscripción desde Lista 1 para ${email}:`, err);
    return null;
  }
}

/**
 * Sincroniza un contacto en la Lista 2 (Principal Aurelín)
 * Esta es la lista operacional donde el pedagogo trabaja
 */
export async function sincronizarListaPrincipalAurelin(email, env) {
  try {
    console.log(`🔄 Sincronizando ${email} en Lista Principal Aurelín...`);
    
    // 1. Buscar tarea en Lista 2 por email
    const tasks = await clickup.getTasks(env, LISTA_PRINCIPAL, { archived: false, page: 0 });
    const emailLower = email.toLowerCase();
    
    let taskPrincipal = tasks.find(t => {
      const cfEmail = t.custom_fields?.find(cf => cf.id === CLICKUP.CF_EMAIL)?.value;
      return cfEmail && String(cfEmail).toLowerCase() === emailLower;
    });
    
    // 2. Obtener datos desde múltiples fuentes
    const nombreLista1 = await obtenerNombreDesdeLista1(email, env);
    const fechaInscripcionLista1 = await obtenerFechaInscripcionDesdeLista1(email, env);
    
    // 3. Integración con Kajabi eliminada
    // 4. Usar fecha de inscripción (prioridad: Lista 1 > Lista 2 > Student)
    let fechaInscripcionFinal = fechaInscripcionLista1;
    
    // 5. Obtener datos del estudiante desde ClickUp (Lista 2) si existe
    let student = null;
    let fechaUltimaPractica = null;
    let nivelActual = null;
    let apodoActual = null;
    
    if (taskPrincipal) {
      // Leer datos existentes de la tarea
      fechaUltimaPractica = taskPrincipal.custom_fields?.find(
        cf => cf.id === CLICKUP.CF_LAST_PRACTICE_DATE
      )?.value || null;
      
      const nivelField = taskPrincipal.custom_fields?.find(
        cf => cf.id === CLICKUP.CF_NIVEL_AURELIN
      );
      nivelActual = nivelField?.value !== undefined && nivelField?.value !== null 
        ? Number(nivelField.value) 
        : null;
      
      console.log(`   📊 ${email}: Nivel actual en ClickUp = ${nivelActual !== null ? nivelActual : 'no existe'}`);
      
      const apodoField = taskPrincipal.custom_fields?.find(
        cf => cf.id === CLICKUP.CF_APODO
      );
      apodoActual = apodoField?.value || null;
      
      // Intentar obtener desde student module
      try {
        student = await findStudentByEmail(env, email);
        if (student) {
          // Usar fecha última práctica del student si está disponible
          if (student.lastPractice) {
            const fecha = new Date(student.lastPractice);
            fechaUltimaPractica = fecha.getTime();
          }
          
        }
      } catch (err) {
        // Continuar sin student
      }
      
      // También intentar obtener fecha desde la Lista 2 misma
      if (taskPrincipal) {
        const fechaFieldLista2 = taskPrincipal.custom_fields?.find(
          cf => cf.id === CLICKUP.CF_FECHA_INSCRIPCION
        );
        if (fechaFieldLista2?.value) {
          try {
            const fechaValue = fechaFieldLista2.value;
            let fechaTimestamp = null;
            
            if (typeof fechaValue === 'string') {
              // Intentar diferentes formatos de fecha
              let fechaParsed = null;
              
              // Formato ISO (YYYY-MM-DD)
              if (fechaValue.includes('-') && fechaValue.length >= 10) {
                fechaParsed = new Date(fechaValue);
              }
              // Formato MM/DD/YYYY o DD/MM/YYYY
              else if (fechaValue.includes('/')) {
                const partes = fechaValue.split('/');
                if (partes.length === 3) {
                  const mes = parseInt(partes[0], 10);
                  const dia = parseInt(partes[1], 10);
                  const año = parseInt(partes[2], 10);
                  if (mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31 && año > 2000) {
                    fechaParsed = new Date(año, mes - 1, dia);
                  }
                }
              }
              // Intentar parsear directamente
              if (!fechaParsed || isNaN(fechaParsed.getTime())) {
                fechaParsed = new Date(fechaValue);
              }
              
              if (fechaParsed && !isNaN(fechaParsed.getTime())) {
                fechaTimestamp = fechaParsed.getTime();
              }
            } else {
              // Es timestamp numérico
              const timestamp = Number(fechaValue);
              if (!isNaN(timestamp) && timestamp > 0) {
                fechaTimestamp = timestamp;
              }
            }
            
            if (fechaTimestamp && !isNaN(fechaTimestamp)) {
              const ahora = Date.now();
              const fechaMinima = new Date('2020-01-01').getTime();
              const esFechaFutura = fechaTimestamp > ahora;
              const esFechaMuyAntigua = fechaTimestamp < fechaMinima;
              
              // Validar fecha: no futuras y no muy antiguas (antes de 2020)
              if (esFechaFutura || esFechaMuyAntigua) {
                console.warn(`   ⚠️  ${email}: Fecha de Lista 2 inválida (${new Date(fechaTimestamp).toISOString()}): ${esFechaFutura ? 'futura' : 'muy antigua'}`);
                // Fecha inválida - no usar
              } else {
                // Fecha válida
                if (!fechaInscripcionFinal) {
                  // Si no tenemos fecha final y la de Lista 2 es válida, usarla
                  fechaInscripcionFinal = fechaTimestamp;
                  console.log(`   📅 ${email}: Usando fecha inscripción de Lista 2 = ${new Date(fechaTimestamp).toISOString()}`);
                } else if (fechaTimestamp < fechaInscripcionFinal) {
                  // Si la fecha de Lista 2 es más antigua y válida, usarla
                  fechaInscripcionFinal = fechaTimestamp;
                  console.log(`   📅 ${email}: Usando fecha inscripción de Lista 2 (más antigua) = ${new Date(fechaTimestamp).toISOString()}`);
                }
              }
            }
          } catch (err) {
            console.warn(`   ⚠️  Error parseando fecha de Lista 2 para ${email}: ${err.message}`);
          }
        }
      }
      
      // Si aún no tenemos fecha, intentar desde student (con validación)
      if (!fechaInscripcionFinal && student && student.fechaInscripcion) {
        const fechaStudent = Number(student.fechaInscripcion);
        const ahora = Date.now();
        const fechaMinima = new Date('2020-01-01').getTime();
        // Validar fecha: no futuras y no muy antiguas (antes de 2020)
        if (!isNaN(fechaStudent) && fechaStudent <= ahora && fechaStudent >= fechaMinima) {
          console.log(`   📅 ${email}: Usando fecha inscripción del student = ${new Date(fechaStudent).toISOString()}`);
          fechaInscripcionFinal = fechaStudent;
        } else {
          console.warn(`   ⚠️  ${email}: Fecha del student rechazada (${new Date(fechaStudent).toISOString()}): ${fechaStudent > ahora ? 'futura' : 'muy antigua'}`);
        }
      }
    }
    
    // 6. Calcular nivel basado en fecha de inscripción (DESPUÉS de obtener todas las fechas posibles)
    const nivelCalculado = fechaInscripcionFinal 
      ? calcularNivelAutomatico(fechaInscripcionFinal)
      : 1;
    
    console.log(`   📊 ${email}: Fecha inscripción final = ${fechaInscripcionFinal ? new Date(fechaInscripcionFinal).toISOString() : 'N/A'}, Nivel calculado = ${nivelCalculado}`);
    
    // 7. Preparar campos a actualizar
    const camposActualizar = [];
    let actualizarNombreTarea = false;
    let nuevoNombreTarea = null;
    
    // Nombre: usar de Lista 1 si está disponible, sino mantener el actual
    if (nombreLista1 && nombreLista1 !== email) {
      const nombreActual = taskPrincipal?.name || "";
      if (nombreActual !== nombreLista1 && !nombreActual.includes("@")) {
        actualizarNombreTarea = true;
        nuevoNombreTarea = nombreLista1;
      }
    }
    
    // Email: asegurar que está presente
    const emailField = taskPrincipal?.custom_fields?.find(
      cf => cf.id === CLICKUP.CF_EMAIL
    );
    if (!emailField || emailField.value !== email) {
      camposActualizar.push({
        id: CLICKUP.CF_EMAIL,
        value: email
      });
    }
    
    // Fecha inscripción PDE: actualizar si hay nueva información (como TEXTO)
    if (fechaInscripcionFinal) {
      const fechaActual = taskPrincipal?.custom_fields?.find(
        cf => cf.id === CLICKUP.CF_FECHA_INSCRIPCION
      )?.value;

      // Convertir fecha a string (formato ISO legible YYYY-MM-DD)
      const fechaString = new Date(fechaInscripcionFinal).toISOString().split('T')[0];
      
      // Comparar fechas: si fechaActual es texto, convertir a timestamp para comparar
      let fechaActualTimestamp = null;
      if (fechaActual) {
        try {
          if (typeof fechaActual === 'string') {
            // Intentar diferentes formatos de fecha
            let fechaParsed = null;
            
            // Formato ISO (YYYY-MM-DD)
            if (fechaActual.includes('-') && fechaActual.length >= 10) {
              fechaParsed = new Date(fechaActual);
            }
            // Formato MM/DD/YYYY o DD/MM/YYYY
            else if (fechaActual.includes('/')) {
              const partes = fechaActual.split('/');
              if (partes.length === 3) {
                // Intentar como MM/DD/YYYY primero
                const mes = parseInt(partes[0], 10);
                const dia = parseInt(partes[1], 10);
                const año = parseInt(partes[2], 10);
                if (mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31 && año > 2000) {
                  fechaParsed = new Date(año, mes - 1, dia);
                }
              }
            }
            // Intentar parsear directamente
            if (!fechaParsed || isNaN(fechaParsed.getTime())) {
              fechaParsed = new Date(fechaActual);
            }
            
            if (fechaParsed && !isNaN(fechaParsed.getTime())) {
              fechaActualTimestamp = fechaParsed.getTime();
            }
          } else {
            const timestamp = Number(fechaActual);
            if (!isNaN(timestamp) && timestamp > 0) {
              fechaActualTimestamp = timestamp;
            }
          }
        } catch (err) {
          console.warn(`   ⚠️  Error parseando fecha actual para ${email}: ${err.message}`);
        }
      }
      
      // Verificar si la fecha actual es futura (incorrecta)
      const ahora = Date.now();
      const fechaActualEsFutura = fechaActualTimestamp && !isNaN(fechaActualTimestamp) && fechaActualTimestamp > ahora;
      
      // Actualizar si:
      // 1. No hay fecha actual
      // 2. La fecha nueva es más antigua (mejor)
      // 3. La fecha actual es futura (incorrecta) - SIEMPRE actualizar en este caso
      const debeActualizar = !fechaActual || 
                             (fechaActualTimestamp && !isNaN(fechaActualTimestamp) && fechaInscripcionFinal < fechaActualTimestamp && !fechaActualEsFutura) ||
                             fechaActualEsFutura;
      
      console.log(`   🔍 ${email}: Evaluando actualización de fecha:`);
      console.log(`      Fecha actual: ${fechaActual ? (fechaActualTimestamp && !isNaN(fechaActualTimestamp) ? new Date(fechaActualTimestamp).toISOString() : `INVÁLIDA (${fechaActual})`) : 'N/A'}`);
      console.log(`      Fecha nueva: ${new Date(fechaInscripcionFinal).toISOString()}`);
      console.log(`      Fecha actual es futura: ${fechaActualEsFutura}`);
      console.log(`      Debe actualizar: ${debeActualizar}`);
      
      if (debeActualizar) {
        camposActualizar.push({
          id: CLICKUP.CF_FECHA_INSCRIPCION,
          value: fechaInscripcionFinal // Enviar como timestamp (milisegundos)
        });
        if (fechaActualEsFutura) {
          console.log(`   📅 ${email}: Actualizando fecha inscripción (fecha anterior era futura: ${new Date(fechaActualTimestamp).toISOString()}) a: ${fechaString}`);
        } else {
          console.log(`   📅 ${email}: Actualizando fecha inscripción a: ${fechaString}`);
        }
      } else {
        console.log(`   ℹ️  ${email}: No se actualiza fecha (actual: ${fechaActual ? new Date(fechaActualTimestamp).toISOString() : 'N/A'}, nueva: ${new Date(fechaInscripcionFinal).toISOString()})`);
      }
    }
    
    // Nivel: actualizar si:
    // 1. No existe nivel actual (null o undefined)
    // 2. El nivel calculado es mayor (progresión natural)
    // IMPORTANTE: NO sobrescribir niveles manuales en ClickUp
    // Si el nivel actual es mayor que el calculado, probablemente fue establecido manualmente
    const debeActualizarNivel = nivelActual === null || 
                                 nivelActual === undefined || 
                                 nivelCalculado > nivelActual;
    
    if (debeActualizarNivel) {
      console.log(`   📊 ${email}: Actualizando nivel de ${nivelActual ?? 'N/A'} a ${nivelCalculado} (progresión automática)`);
      // Enviar nivel como NÚMERO
      camposActualizar.push({
        id: CLICKUP.CF_NIVEL_AURELIN,
        value: nivelCalculado
      });
      console.log(`   🔧 ${email}: Enviando nivel como número: ${nivelCalculado}`);
    } else {
      if (nivelActual > nivelCalculado) {
        console.log(`   📊 ${email}: Manteniendo nivel manual ${nivelActual} (calculado: ${nivelCalculado}) - respetando cambio manual en ClickUp`);
      } else {
        console.log(`   📊 ${email}: Manteniendo nivel actual ${nivelActual} (calculado: ${nivelCalculado})`);
      }
    }
    
    // Apodo: mantener el actual si existe, sino usar nombre de Lista 1
    if (apodoActual) {
      // Mantener apodo existente (viene de Typeform o cambios manuales)
      const apodoField = taskPrincipal?.custom_fields?.find(
        cf => cf.id === CLICKUP.CF_APODO
      );
      if (!apodoField || apodoField.value !== apodoActual) {
        camposActualizar.push({
          id: CLICKUP.CF_APODO,
          value: apodoActual
        });
      }
    } else if (nombreLista1 && nombreLista1 !== email) {
      // Si no hay apodo, usar nombre de Lista 1
      camposActualizar.push({
        id: CLICKUP.CF_APODO,
        value: nombreLista1
      });
    }
    
    // Fecha última práctica: mantener la actual (se actualiza cuando practica)
    // No la modificamos aquí, se actualiza en streak.js
    
    // 8. Crear o actualizar tarea
    if (!taskPrincipal) {
      // Crear nueva tarea en Lista 2
        const body = {
          name: nuevoNombreTarea || nombreLista1 || email,
          custom_fields: [
            { id: CLICKUP.CF_EMAIL, value: email },
            ...(fechaInscripcionFinal ? [{
              id: CLICKUP.CF_FECHA_INSCRIPCION,
              value: fechaInscripcionFinal // Formato timestamp (milisegundos)
            }] : []),
            {
              id: CLICKUP.CF_NIVEL_AURELIN,
              value: nivelCalculado // Enviar como número
            },
          ...(nombreLista1 && nombreLista1 !== email ? [{
            id: CLICKUP.CF_APODO,
            value: nombreLista1
          }] : [])
        ]
      };
      
      const newTask = await clickup.createTask(env, LISTA_PRINCIPAL, body);
      console.log(`   ✅ Tarea creada en Lista Principal para ${email} (ID: ${newTask.id})`);
      
      return {
        success: true,
        action: "creado",
        taskId: newTask.id,
        nivel: nivelCalculado,
        fechaInscripcion: fechaInscripcionFinal
      };
    } else {
      // Actualizar tarea existente
      if (camposActualizar.length > 0 || actualizarNombreTarea) {
        // Separar campos short_text que requieren endpoint específico
        const nivelField = camposActualizar.find(cf => cf.id === CLICKUP.CF_NIVEL_AURELIN);
        const fechaField = camposActualizar.find(cf => cf.id === CLICKUP.CF_FECHA_INSCRIPCION);
        const otrosCampos = camposActualizar.filter(cf => 
          cf.id !== CLICKUP.CF_NIVEL_AURELIN && cf.id !== CLICKUP.CF_FECHA_INSCRIPCION
        );
        
        // Actualizar nivel usando endpoint específico (short_text)
        if (nivelField) {
          try {
            await clickup.updateCustomField(env, taskPrincipal.id, CLICKUP.CF_NIVEL_AURELIN, nivelField.value);
            console.log(`   ✅ Campo nivel actualizado: ${nivelField.value} (número)`);
          } catch (err) {
            console.warn(`   ⚠️  Error actualizando nivel con endpoint específico: ${err.message}`);
            // Reintentar con método general
            otrosCampos.push(nivelField);
          }
        }
        
        // Actualizar fecha usando endpoint específico (short_text)
        if (fechaField) {
          try {
            await clickup.updateCustomField(env, taskPrincipal.id, CLICKUP.CF_FECHA_INSCRIPCION, fechaField.value);
            console.log(`   ✅ Campo fecha inscripción actualizado: ${new Date(fechaField.value).toISOString()} (timestamp: ${fechaField.value})`);
          } catch (err) {
            console.warn(`   ⚠️  Error actualizando fecha con endpoint específico: ${err.message}`);
            // Reintentar con método general
            otrosCampos.push(fechaField);
          }
        }
        
        // Actualizar otros campos y nombre usando método general
        if (otrosCampos.length > 0 || actualizarNombreTarea) {
          const updateBody = {};
          
          if (otrosCampos.length > 0) {
            updateBody.custom_fields = otrosCampos;
          }
          
          if (actualizarNombreTarea && nuevoNombreTarea) {
            updateBody.name = nuevoNombreTarea;
          }
          
          await clickup.updateTask(env, taskPrincipal.id, updateBody);
        }
        
        const totalCampos = (nivelField ? 1 : 0) + (fechaField ? 1 : 0) + otrosCampos.length;
        console.log(`   ✅ Tarea actualizada en Lista Principal para ${email} (${totalCampos} campos)`);
        console.log(`   📋 Campos actualizados: ${[
          nivelField ? `Nivel=${nivelField.value}` : null,
          fechaField ? `Fecha Inscripción=${fechaField.value}` : null,
          ...otrosCampos.map(cf => {
            const fieldName = cf.id === CLICKUP.CF_EMAIL ? 'Email' :
                             cf.id === CLICKUP.CF_APODO ? 'Apodo' : cf.id;
            return `${fieldName}=${cf.value}`;
          })
        ].filter(Boolean).join(', ')}`);
        
        return {
          success: true,
          action: "actualizado",
          taskId: taskPrincipal.id,
          nivel: nivelCalculado,
          fechaInscripcion: fechaInscripcionFinal,
          camposActualizados: camposActualizar.length + (actualizarNombreTarea ? 1 : 0),
          campos: camposActualizar.map(cf => cf.id)
        };
      } else {
        console.log(`   ℹ️  No hay cambios para ${email} en Lista Principal`);
        return {
          success: true,
          action: "sin_cambios",
          taskId: taskPrincipal.id
        };
      }
    }
    
  } catch (err) {
    console.error(`❌ Error sincronizando ${email} en Lista Principal:`, err);
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * Sincroniza múltiples emails en la Lista 2
 */
export async function sincronizarMultiplesListaPrincipal(emails, env, options = {}) {
  const { delay = 200 } = options;
  const resultados = {
    total: emails.length,
    exitosos: 0,
    fallidos: 0,
    creados: 0,
    actualizados: 0,
    errores: []
  };
  
  for (const email of emails) {
    try {
      const resultado = await sincronizarListaPrincipalAurelin(email, env);
      
      if (resultado.success) {
        resultados.exitosos++;
        if (resultado.action === "creado") {
          resultados.creados++;
        } else if (resultado.action === "actualizado") {
          resultados.actualizados++;
        }
      } else {
        resultados.fallidos++;
        resultados.errores.push({ email, error: resultado.error });
      }
      
      // Pausa entre sincronizaciones
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (err) {
      resultados.fallidos++;
      resultados.errores.push({ email, error: err.message });
    }
  }
  
  return resultados;
}

