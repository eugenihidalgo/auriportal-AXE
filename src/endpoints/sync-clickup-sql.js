// src/endpoints/sync-clickup-sql.js
// Endpoint para sincronización bidireccional ClickUp ↔ SQL (LEGACY - DESHABILITADO)
// Este endpoint ha sido deshabilitado porque usa SQLite legacy.
// La sincronización ahora se realiza directamente con PostgreSQL v4.

import { gone } from "../core/http/gone.js";

/**
 * Sincroniza un estudiante desde ClickUp a SQL
 */
export async function sincronizarClickUpASQL(email, env) {
  try {
    // Buscar tarea en ClickUp
    const task = await clickup.findTaskByEmail(env, email);
    if (!task) {
      return { success: false, error: "No encontrado en ClickUp" };
    }

    const db = getDatabase();
    const estudianteSQL = students.findByEmail(email);

    // Extraer datos de ClickUp
    const emailField = task.custom_fields?.find(cf => cf.id === CLICKUP.CF_EMAIL);
    const apodoField = task.custom_fields?.find(cf => cf.id === CLICKUP.CF_APODO);
    const nivelField = task.custom_fields?.find(cf => cf.id === CLICKUP.CF_NIVEL_AURELIN);
    const fechaInscripcionField = task.custom_fields?.find(cf => cf.id === CLICKUP.CF_FECHA_INSCRIPCION);
    const streakField = task.custom_fields?.find(cf => cf.id === CLICKUP.CF_STREAK_GENERAL);
    const lastPracticeField = task.custom_fields?.find(cf => cf.id === CLICKUP.CF_LAST_PRACTICE_DATE);
    
    // Buscar campo de suscripción activa por ID o nombre
    const campoSuscripcionActiva = task.custom_fields?.find(cf => 
      cf.id === CLICKUP.CF_SUSCRIPCION_ACTIVA ||
      (cf.name?.toLowerCase().includes("suscripcion") && 
       cf.name?.toLowerCase().includes("activa"))
    );

    const updates = {};
    let cambios = 0;

    // Actualizar apodo si cambió
    if (apodoField && apodoField.value !== estudianteSQL?.apodo) {
      updates.apodo = apodoField.value || "";
      cambios++;
    }

    // Actualizar nivel si cambió
    // IMPORTANTE: ClickUp es la fuente de verdad para el nivel
    // Solo sincronizamos desde ClickUp a SQL, nunca al revés
    const nivelClickUp = nivelField ? Number(nivelField.value) : null;
    if (nivelClickUp !== null && nivelClickUp !== estudianteSQL?.nivel) {
      updates.nivel = nivelClickUp;
      cambios++;
      console.log(`   📊 ${email}: Sincronizando nivel desde ClickUp (${nivelClickUp}) a SQL`);
    }

    // Actualizar fecha inscripción si cambió
    const fechaInscripcionClickUp = fechaInscripcionField ? Number(fechaInscripcionField.value) : null;
    if (fechaInscripcionClickUp) {
      const fechaISO = new Date(fechaInscripcionClickUp).toISOString();
      if (fechaISO !== estudianteSQL?.fecha_inscripcion) {
        updates.fecha_inscripcion = fechaISO;
        cambios++;
      }
    }

    // Actualizar racha si cambió
    const rachaClickUp = streakField ? Number(streakField.value) : null;
    if (rachaClickUp !== null && rachaClickUp !== estudianteSQL?.racha_actual) {
      updates.racha_actual = rachaClickUp;
      cambios++;
    }

    // Actualizar última práctica si cambió
    const lastPracticeClickUp = lastPracticeField ? lastPracticeField.value : null;
    if (lastPracticeClickUp && lastPracticeClickUp !== estudianteSQL?.ultima_practica_date) {
      updates.ultima_practica_date = lastPracticeClickUp;
      cambios++;
    }

    // Actualizar suscripción activa si cambió
    if (campoSuscripcionActiva) {
      // El valor puede ser boolean, string "true"/"false", o número 1/0
      let suscripcionActivaClickUp = true;
      const valor = campoSuscripcionActiva.value;
      if (typeof valor === 'boolean') {
        suscripcionActivaClickUp = valor;
      } else if (typeof valor === 'string') {
        suscripcionActivaClickUp = valor.toLowerCase() === 'true' || valor === '1';
      } else if (typeof valor === 'number') {
        suscripcionActivaClickUp = valor === 1;
      }
      
      const suscripcionActivaSQL = estudianteSQL?.suscripcion_activa !== undefined 
        ? (estudianteSQL.suscripcion_activa === 1 || estudianteSQL.suscripcion_activa === true)
        : true; // Por defecto activa
      
      if (suscripcionActivaClickUp !== suscripcionActivaSQL) {
        updates.suscripcion_activa = suscripcionActivaClickUp ? 1 : 0;
        cambios++;
      }
    }

    // Actualizar clickup_task_id si no está
    if (!estudianteSQL?.clickup_task_id && task.id) {
      updates.clickup_task_id = task.id;
      cambios++;
    }

    // Aplicar actualizaciones
    if (cambios > 0) {
      if (estudianteSQL) {
        // Actualizar existente
        const setClause = Object.keys(updates).map(k => `${k} = ?`).join(", ");
        const values = [...Object.values(updates), email];
        db.prepare(`UPDATE students SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE email = ?`).run(...values);
        console.log(`✅ Sincronizados ${cambios} campos de ClickUp a SQL para ${email}`);
      } else {
        // Crear nuevo (aunque debería existir por webhook de Typeform)
        // IMPORTANTE: Usar nivel de ClickUp como fuente de verdad
        // Solo calcular automático si no existe en ClickUp
        const nivelFinal = updates.nivel !== undefined 
          ? updates.nivel 
          : (nivelClickUp !== null 
              ? nivelClickUp 
              : calcularNivelAutomatico(fechaInscripcionClickUp || Date.now()));
        
        students.upsert({
          email,
          apodo: updates.apodo || "",
          nivel: nivelFinal,
          fecha_inscripcion: updates.fecha_inscripcion || new Date().toISOString(),
          racha_actual: updates.racha_actual || 0,
          ultima_practica_date: updates.ultima_practica_date || null,
          clickup_task_id: updates.clickup_task_id || task.id
        });
        console.log(`✅ Creado estudiante en SQL desde ClickUp para ${email} (nivel: ${nivelFinal})`);
      }
    }

    return { success: true, cambios, email };
  } catch (err) {
    console.error(`❌ Error sincronizando ClickUp a SQL para ${email}:`, err);
    return { success: false, error: err.message, email };
  }
}

/**
 * Sincroniza un estudiante desde SQL a ClickUp
 */
async function sincronizarSQLAClickUp(email, env) {
  try {
    const estudianteSQL = students.findByEmail(email);
    if (!estudianteSQL) {
      return { success: false, error: "No encontrado en SQL" };
    }

    // Buscar tarea en ClickUp
    const task = await clickup.findTaskByEmail(env, email);
    if (!task) {
      return { success: false, error: "No encontrado en ClickUp" };
    }

    const camposActualizar = [];
    let cambios = 0;

    // Actualizar apodo si cambió
    const apodoClickUp = task.custom_fields?.find(cf => cf.id === CLICKUP.CF_APODO)?.value || "";
    if (estudianteSQL.apodo !== apodoClickUp) {
      camposActualizar.push({ id: CLICKUP.CF_APODO, value: estudianteSQL.apodo || "" });
      cambios++;
    }

    // Actualizar nivel si cambió
    // IMPORTANTE: ClickUp es la fuente de verdad, solo sincronizamos SQL → ClickUp
    // si el nivel en SQL es diferente Y mayor (progresión natural)
    // Esto evita sobrescribir cambios manuales en ClickUp
    const nivelClickUp = Number(task.custom_fields?.find(cf => cf.id === CLICKUP.CF_NIVEL_AURELIN)?.value) || null;
    if (estudianteSQL.nivel !== null && estudianteSQL.nivel !== nivelClickUp) {
      // Solo actualizar ClickUp si el nivel de SQL es mayor (progresión natural)
      // Esto respeta cambios manuales en ClickUp donde se bajó el nivel
      if (estudianteSQL.nivel > nivelClickUp) {
        camposActualizar.push({ id: CLICKUP.CF_NIVEL_AURELIN, value: estudianteSQL.nivel });
        cambios++;
        console.log(`   📊 ${email}: Sincronizando nivel desde SQL (${estudianteSQL.nivel}) a ClickUp (era ${nivelClickUp})`);
      } else {
        console.log(`   📊 ${email}: Manteniendo nivel en ClickUp (${nivelClickUp}) - SQL tiene ${estudianteSQL.nivel} (posible cambio manual en ClickUp)`);
      }
    }

    // Actualizar fecha inscripción si cambió
    const fechaInscripcionSQL = estudianteSQL.fecha_inscripcion ? new Date(estudianteSQL.fecha_inscripcion).getTime() : null;
    const fechaInscripcionClickUp = Number(task.custom_fields?.find(cf => cf.id === CLICKUP.CF_FECHA_INSCRIPCION)?.value) || null;
    if (fechaInscripcionSQL && fechaInscripcionSQL !== fechaInscripcionClickUp) {
      camposActualizar.push({ id: CLICKUP.CF_FECHA_INSCRIPCION, value: fechaInscripcionSQL });
      cambios++;
    }

    // Actualizar racha si cambió
    const rachaClickUp = Number(task.custom_fields?.find(cf => cf.id === CLICKUP.CF_STREAK_GENERAL)?.value) || 0;
    if (estudianteSQL.racha_actual !== null && estudianteSQL.racha_actual !== rachaClickUp) {
      camposActualizar.push({ id: CLICKUP.CF_STREAK_GENERAL, value: estudianteSQL.racha_actual });
      cambios++;
    }

    // Actualizar última práctica si cambió
    const lastPracticeClickUp = task.custom_fields?.find(cf => cf.id === CLICKUP.CF_LAST_PRACTICE_DATE)?.value || null;
    if (estudianteSQL.ultima_practica_date !== lastPracticeClickUp) {
      camposActualizar.push({ id: CLICKUP.CF_LAST_PRACTICE_DATE, value: estudianteSQL.ultima_practica_date || null });
      cambios++;
    }

    // Actualizar suscripción activa si cambió
    const suscripcionActivaSQL = estudianteSQL.suscripcion_activa !== undefined 
      ? (estudianteSQL.suscripcion_activa === 1 || estudianteSQL.suscripcion_activa === true)
      : true; // Por defecto activa
    
    // Buscar campo de suscripción activa en ClickUp por ID o nombre
    const campoSuscripcionActiva = task.custom_fields?.find(cf => 
      cf.id === CLICKUP.CF_SUSCRIPCION_ACTIVA ||
      (cf.name?.toLowerCase().includes("suscripcion") && 
       cf.name?.toLowerCase().includes("activa"))
    );
    
    if (campoSuscripcionActiva) {
      let suscripcionActivaClickUp = true;
      const valor = campoSuscripcionActiva.value;
      if (typeof valor === 'boolean') {
        suscripcionActivaClickUp = valor;
      } else if (typeof valor === 'string') {
        suscripcionActivaClickUp = valor.toLowerCase() === 'true' || valor === '1';
      } else if (typeof valor === 'number') {
        suscripcionActivaClickUp = valor === 1;
      }
      
      if (suscripcionActivaSQL !== suscripcionActivaClickUp) {
        camposActualizar.push({ 
          id: campoSuscripcionActiva.id, 
          value: suscripcionActivaSQL // ClickUp checkbox espera boolean
        });
        cambios++;
      }
    }

    // Aplicar actualizaciones
    if (cambios > 0) {
      await clickup.updateTask(env, task.id, { custom_fields: camposActualizar });
      console.log(`✅ Sincronizados ${cambios} campos de SQL a ClickUp para ${email}`);
    }

    return { success: true, cambios, email };
  } catch (err) {
    console.error(`❌ Error sincronizando SQL a ClickUp para ${email}:`, err);
    return { success: false, error: err.message, email };
  }
}

/**
 * Sincronización bidireccional completa
 */
async function sincronizarBidireccional(email, env) {
  const resultados = {
    email,
    clickUpASQL: null,
    sqlAClickUp: null
  };

  // Primero sincronizar ClickUp → SQL
  resultados.clickUpASQL = await sincronizarClickUpASQL(email, env);

  // Luego sincronizar SQL → ClickUp (por si hay cambios más recientes en SQL)
  resultados.sqlAClickUp = await sincronizarSQLAClickUp(email, env);

  return resultados;
}

export default async function syncClickUpSQLHandler(request, env, ctx) {
  return gone(
    "Este endpoint ha sido deprecado. La sincronización ClickUp ↔ SQLite ya no está disponible. Usa los módulos v4 de PostgreSQL.",
    "sync-clickup-sql-disabled",
    request
  );
}

