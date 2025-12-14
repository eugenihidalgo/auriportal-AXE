// scripts/verificar-niveles-clickup.js
// Script para verificar los niveles actualizados en ClickUp

import { CLICKUP } from '../src/config/config.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno
dotenv.config({ path: join(__dirname, '..', '.env') });

const CLICKUP_API_TOKEN = process.env.CLICKUP_API_TOKEN;
const LISTA_PRINCIPAL = CLICKUP.LIST_ID; // "901214375878"
const CF_NIVEL_AURELIN = CLICKUP.CF_NIVEL_AURELIN; // "a92e6b73-ea95-4b50-ae46-ec8290f99cd3"
const CF_EMAIL = CLICKUP.CF_EMAIL;
const CF_FECHA_INSCRIPCION = CLICKUP.CF_FECHA_INSCRIPCION;

async function obtenerTareasClickUp() {
  const url = `https://api.clickup.com/api/v2/list/${LISTA_PRINCIPAL}/task?archived=false&page=0`;
  
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: CLICKUP_API_TOKEN }
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Error obteniendo tareas: ${res.status} - ${err}`);
  }

  const data = await res.json();
  return data.tasks || [];
}

async function verificarNiveles() {
  console.log('🔍 Verificando niveles en ClickUp (Lista Principal)...\n');
  
  try {
    const tasks = await obtenerTareasClickUp();
    console.log(`✅ Encontradas ${tasks.length} tareas en ClickUp\n`);
    
    const resultados = {
      total: tasks.length,
      conNivel: 0,
      sinNivel: 0,
      nivel1: 0,
      nivel2: 0,
      nivel3: 0,
      nivel4: 0,
      nivel5: 0,
      nivel6Plus: 0,
      conFecha: 0,
      sinFecha: 0,
      detalles: []
    };
    
    for (const task of tasks) {
      const email = task.custom_fields?.find(cf => cf.id === CF_EMAIL)?.value || 'sin email';
      const nivelField = task.custom_fields?.find(cf => cf.id === CF_NIVEL_AURELIN);
      // Leer nivel como texto y convertir a número
      const nivel = nivelField?.value !== undefined && nivelField?.value !== null && nivelField?.value !== ""
        ? Number(String(nivelField.value).trim()) 
        : null;
      
      const fechaField = task.custom_fields?.find(cf => cf.id === CF_FECHA_INSCRIPCION);
      // Leer fecha como texto (formato YYYY-MM-DD o timestamp)
      const fecha = fechaField?.value || null;
      
      if (nivel !== null) {
        resultados.conNivel++;
        if (nivel === 1) resultados.nivel1++;
        else if (nivel === 2) resultados.nivel2++;
        else if (nivel === 3) resultados.nivel3++;
        else if (nivel === 4) resultados.nivel4++;
        else if (nivel === 5) resultados.nivel5++;
        else if (nivel >= 6) resultados.nivel6Plus++;
      } else {
        resultados.sinNivel++;
      }
      
      if (fecha) {
        resultados.conFecha++;
      } else {
        resultados.sinFecha++;
      }
      
      resultados.detalles.push({
        email,
        nombre: task.name,
        nivel,
        fecha: fecha ? (typeof fecha === 'string' && fecha.includes('-') ? fecha : (Number(fecha) && !isNaN(Number(fecha)) ? new Date(Number(fecha)).toISOString().split('T')[0] : fecha)) : null,
        taskId: task.id
      });
    }
    
    // Mostrar resumen
    console.log('📊 RESUMEN DE NIVELES:');
    console.log('='.repeat(60));
    console.log(`Total de tareas: ${resultados.total}`);
    console.log(`Con nivel asignado: ${resultados.conNivel} (${((resultados.conNivel/resultados.total)*100).toFixed(1)}%)`);
    console.log(`Sin nivel: ${resultados.sinNivel} (${((resultados.sinNivel/resultados.total)*100).toFixed(1)}%)`);
    console.log(`\nDistribución por niveles:`);
    console.log(`  Nivel 1: ${resultados.nivel1}`);
    console.log(`  Nivel 2: ${resultados.nivel2}`);
    console.log(`  Nivel 3: ${resultados.nivel3}`);
    console.log(`  Nivel 4: ${resultados.nivel4}`);
    console.log(`  Nivel 5: ${resultados.nivel5}`);
    console.log(`  Nivel 6+: ${resultados.nivel6Plus}`);
    console.log(`\nFechas de inscripción:`);
    console.log(`  Con fecha: ${resultados.conFecha} (${((resultados.conFecha/resultados.total)*100).toFixed(1)}%)`);
    console.log(`  Sin fecha: ${resultados.sinFecha} (${((resultados.sinFecha/resultados.total)*100).toFixed(1)}%)`);
    console.log('='.repeat(60));
    
    // Mostrar algunos ejemplos
    console.log('\n📋 EJEMPLOS (primeros 10 con nivel):');
    const conNivel = resultados.detalles.filter(d => d.nivel !== null).slice(0, 10);
    for (const detalle of conNivel) {
      console.log(`  ${detalle.email}: Nivel ${detalle.nivel}${detalle.fecha ? ` (Inscripción: ${detalle.fecha})` : ' (Sin fecha)'}`);
    }
    
    if (resultados.sinNivel > 0) {
      console.log('\n⚠️  TAREAS SIN NIVEL (primeros 10):');
      const sinNivel = resultados.detalles.filter(d => d.nivel === null).slice(0, 10);
      for (const detalle of sinNivel) {
        console.log(`  ${detalle.email}: Sin nivel${detalle.fecha ? ` (Inscripción: ${detalle.fecha})` : ' (Sin fecha)'}`);
      }
    }
    
    return resultados;
    
  } catch (err) {
    console.error('❌ Error verificando niveles:', err);
    throw err;
  }
}

// Ejecutar
verificarNiveles()
  .then(() => {
    console.log('\n✅ Verificación completada');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });

