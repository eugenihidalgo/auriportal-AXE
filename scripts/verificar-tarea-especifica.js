// scripts/verificar-tarea-especifica.js
// Script para verificar una tarea específica en ClickUp

import { CLICKUP } from '../src/config/config.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const CLICKUP_API_TOKEN = process.env.CLICKUP_API_TOKEN;
const LISTA_PRINCIPAL = CLICKUP.LIST_ID;
const CF_NIVEL_AURELIN = CLICKUP.CF_NIVEL_AURELIN;

async function obtenerTareaPorEmail(email) {
  const url = `https://api.clickup.com/api/v2/list/${LISTA_PRINCIPAL}/task?archived=false&page=0`;
  
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: CLICKUP_API_TOKEN }
  });

  if (!res.ok) {
    throw new Error(`Error: ${res.status}`);
  }

  const data = await res.json();
  const tasks = data.tasks || [];
  
  return tasks.find(t => {
    const cfEmail = t.custom_fields?.find(cf => cf.id === CLICKUP.CF_EMAIL)?.value;
    return cfEmail && String(cfEmail).toLowerCase() === email.toLowerCase();
  });
}

async function verificarTarea(email) {
  console.log(`🔍 Verificando tarea para: ${email}\n`);
  
  try {
    const task = await obtenerTareaPorEmail(email);
    
    if (!task) {
      console.log('❌ Tarea no encontrada');
      return;
    }
    
    console.log(`✅ Tarea encontrada: ${task.name} (ID: ${task.id})\n`);
    console.log('📋 Campos personalizados:');
    
    for (const cf of task.custom_fields || []) {
      if (cf.id === CF_NIVEL_AURELIN) {
        console.log(`\n🎯 CAMPO NIVEL AURELÍN (${CF_NIVEL_AURELIN}):`);
        console.log(`   Tipo: ${cf.type}`);
        console.log(`   Valor: ${cf.value}`);
        console.log(`   Valor (tipo): ${typeof cf.value}`);
        console.log(`   Valor (JSON completo): ${JSON.stringify(cf, null, 2)}`);
      } else if (cf.id === CLICKUP.CF_EMAIL) {
        console.log(`   Email: ${cf.value}`);
      } else if (cf.id === CLICKUP.CF_FECHA_INSCRIPCION) {
        const fechaValue = cf.value;
        if (fechaValue) {
          if (typeof fechaValue === 'string' && fechaValue.includes('-')) {
            console.log(`   Fecha inscripción (texto): ${fechaValue}`);
          } else {
            console.log(`   Fecha inscripción (timestamp): ${new Date(Number(fechaValue)).toISOString()}`);
          }
        } else {
          console.log(`   Fecha inscripción: null`);
        }
      }
    }
    
    // Intentar actualizar el nivel manualmente (como TEXTO)
    console.log('\n🔄 Intentando actualizar nivel a "1" (como texto)...');
    const updateRes = await fetch(`https://api.clickup.com/api/v2/task/${task.id}`, {
      method: "PUT",
      headers: {
        "Authorization": CLICKUP_API_TOKEN,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        custom_fields: [
          {
            id: CF_NIVEL_AURELIN,
            value: "1"  // Enviar como texto
          }
        ]
      })
    });
    
    if (!updateRes.ok) {
      const errorText = await updateRes.text();
      console.log(`❌ Error actualizando: ${updateRes.status}`);
      console.log(`   Error: ${errorText}`);
    } else {
      const updateData = await updateRes.json();
      console.log(`✅ Actualización exitosa`);
      
      // Verificar si el campo se guardó
      console.log(`\n🔍 Verificando campo después de actualizar...`);
      const nivelFieldAfter = updateData.custom_fields?.find(cf => cf.id === CF_NIVEL_AURELIN);
      if (nivelFieldAfter) {
        console.log(`   ✅ Campo encontrado en respuesta: ${JSON.stringify(nivelFieldAfter)}`);
      } else {
        console.log(`   ⚠️  Campo no encontrado en respuesta`);
        console.log(`   Campos disponibles: ${updateData.custom_fields?.map(cf => cf.id).join(', ') || 'ninguno'}`);
      }
      
      // Esperar un momento y volver a consultar la tarea
      console.log(`\n⏳ Esperando 2 segundos y consultando tarea de nuevo...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const taskAfter = await obtenerTareaPorEmail(email);
      if (taskAfter) {
        const nivelFieldFinal = taskAfter.custom_fields?.find(cf => cf.id === CF_NIVEL_AURELIN);
        if (nivelFieldFinal) {
          console.log(`   ✅ Campo encontrado después de consultar: ${JSON.stringify(nivelFieldFinal)}`);
        } else {
          console.log(`   ⚠️  Campo aún no aparece después de consultar`);
        }
      }
    }
    
  } catch (err) {
    console.error('❌ Error:', err);
  }
}

const email = process.argv[2] || 'jporther@gmail.com';
verificarTarea(email)
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });

