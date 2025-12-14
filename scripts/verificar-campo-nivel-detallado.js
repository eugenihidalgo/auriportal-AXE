// scripts/verificar-campo-nivel-detallado.js
// Script para verificar en detalle el campo de nivel

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

async function verificar(email) {
  console.log(`🔍 Verificando campo de nivel para: ${email}\n`);
  
  try {
    const task = await obtenerTareaPorEmail(email);
    
    if (!task) {
      console.log('❌ Tarea no encontrada');
      return;
    }
    
    console.log(`✅ Tarea encontrada: ${task.name} (ID: ${task.id})\n`);
    
    // Buscar el campo de nivel
    const nivelField = task.custom_fields?.find(cf => cf.id === CF_NIVEL_AURELIN);
    
    if (!nivelField) {
      console.log('❌ Campo de nivel NO encontrado en los campos personalizados');
      console.log(`\n📋 Campos disponibles (${task.custom_fields?.length || 0}):`);
      for (const cf of task.custom_fields || []) {
        console.log(`   - ${cf.name || 'Sin nombre'} (${cf.type}) - ID: ${cf.id}`);
      }
      return;
    }
    
    console.log('✅ Campo de nivel encontrado:');
    console.log(`   Nombre: ${nivelField.name || 'Sin nombre'}`);
    console.log(`   Tipo: ${nivelField.type}`);
    console.log(`   ID: ${nivelField.id}`);
    console.log(`   Valor: ${nivelField.value}`);
    console.log(`   Valor (tipo): ${typeof nivelField.value}`);
    console.log(`   Valor (JSON): ${JSON.stringify(nivelField)}`);
    
    // Intentar actualizar usando el endpoint específico de campos
    console.log(`\n🔄 Intentando actualizar nivel usando endpoint específico de campos...`);
    const updateRes = await fetch(`https://api.clickup.com/api/v2/task/${task.id}/field/${CF_NIVEL_AURELIN}`, {
      method: "POST",
      headers: {
        "Authorization": CLICKUP_API_TOKEN,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ value: "1" })
    });
    
    if (!updateRes.ok) {
      const errorText = await updateRes.text();
      console.log(`❌ Error actualizando: ${updateRes.status}`);
      console.log(`   Error: ${errorText.substring(0, 500)}`);
    } else {
      const updateData = await updateRes.json();
      console.log(`✅ Actualización exitosa`);
      
      // Verificar en la respuesta
      const nivelFieldAfter = updateData.custom_fields?.find(cf => cf.id === CF_NIVEL_AURELIN);
      if (nivelFieldAfter) {
        console.log(`\n✅ Campo encontrado en respuesta de actualización:`);
        console.log(`   Valor: ${nivelFieldAfter.value}`);
        console.log(`   Tipo: ${typeof nivelFieldAfter.value}`);
        console.log(`   JSON: ${JSON.stringify(nivelFieldAfter)}`);
      } else {
        console.log(`\n⚠️  Campo NO encontrado en respuesta de actualización`);
        console.log(`   Campos en respuesta: ${updateData.custom_fields?.map(cf => cf.id).join(', ') || 'ninguno'}`);
      }
      
      // Esperar y consultar de nuevo
      console.log(`\n⏳ Esperando 3 segundos y consultando tarea de nuevo...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const taskAfter = await obtenerTareaPorEmail(email);
      if (taskAfter) {
        const nivelFieldFinal = taskAfter.custom_fields?.find(cf => cf.id === CF_NIVEL_AURELIN);
        if (nivelFieldFinal) {
          console.log(`\n✅ Campo encontrado después de consultar:`);
          console.log(`   Valor: ${nivelFieldFinal.value}`);
          console.log(`   Tipo: ${typeof nivelFieldFinal.value}`);
          console.log(`   JSON: ${JSON.stringify(nivelFieldFinal)}`);
        } else {
          console.log(`\n❌ Campo aún NO aparece después de consultar`);
        }
      }
    }
    
  } catch (err) {
    console.error('❌ Error:', err);
  }
}

const email = process.argv[2] || 'jporther@gmail.com';
verificar(email)
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });

