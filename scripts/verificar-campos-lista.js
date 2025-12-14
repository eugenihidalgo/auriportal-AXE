// scripts/verificar-campos-lista.js
// Script para verificar todos los campos personalizados de una lista

import { CLICKUP } from '../src/config/config.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const CLICKUP_API_TOKEN = process.env.CLICKUP_API_TOKEN;
const LISTA_PRINCIPAL = CLICKUP.LIST_ID; // "901214375878"
const LISTA_IMPORT = "901214540219"; // Lista 1 - Importación

async function obtenerCamposLista() {
  const url = `https://api.clickup.com/api/v2/list/${LISTA_PRINCIPAL}/field`;
  
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: CLICKUP_API_TOKEN }
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Error obteniendo campos: ${res.status} - ${err}`);
  }

  const data = await res.json();
  return data.fields || [];
}

async function verificarCamposLista(listId, nombreLista) {
  const url = `https://api.clickup.com/api/v2/list/${listId}/field`;
  
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: CLICKUP_API_TOKEN }
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Error obteniendo campos: ${res.status} - ${err}`);
  }

  const data = await res.json();
  return data.fields || [];
}

async function verificarCampos() {
  console.log('🔍 Verificando campos personalizados de ambas listas...\n');
  
  try {
    console.log('📋 LISTA 1 (Importación - 901214540219):');
    console.log('='.repeat(80));
    const fieldsLista1 = await verificarCamposLista(LISTA_IMPORT, "Lista 1");
    console.log(`✅ Encontrados ${fieldsLista1.length} campos personalizados\n`);
    
    // Mostrar todos los campos de Lista 1
    for (const field of fieldsLista1) {
      const nombreLower = (field.name || '').toLowerCase();
      if (nombreLower.includes('nivel') || nombreLower.includes('auri') || 
          nombreLower.includes('fecha') || nombreLower.includes('inscrip') ||
          nombreLower.includes('pde')) {
        console.log(`   📌 ${field.name} (${field.type}) - ID: ${field.id}`);
      }
    }
    
    const nivelField1 = fieldsLista1.find(f => f.id === CLICKUP.CF_NIVEL_AURELIN);
    const fechaField1 = fieldsLista1.find(f => f.id === CLICKUP.CF_FECHA_INSCRIPCION);
    
    if (nivelField1) {
      console.log(`\n✅ Campo Nivel encontrado en Lista 1: ${nivelField1.name} (${nivelField1.type})`);
    } else {
      console.log(`\n⚠️  Campo Nivel NO encontrado en Lista 1`);
      // Buscar por nombre
      const nivelPorNombre = fieldsLista1.find(f => {
        const nombre = (f.name || '').toLowerCase();
        return nombre.includes('nivel') || nombre.includes('auri');
      });
      if (nivelPorNombre) {
        console.log(`   💡 Campo similar encontrado: "${nivelPorNombre.name}" (ID: ${nivelPorNombre.id})`);
      }
    }
    
    if (fechaField1) {
      console.log(`✅ Campo Fecha encontrado en Lista 1: ${fechaField1.name} (${fechaField1.type})`);
    } else {
      console.log(`⚠️  Campo Fecha NO encontrado en Lista 1`);
      // Buscar por nombre
      const fechaPorNombre = fieldsLista1.find(f => {
        const nombre = (f.name || '').toLowerCase();
        return nombre.includes('fecha') && (nombre.includes('inscrip') || nombre.includes('pde'));
      });
      if (fechaPorNombre) {
        console.log(`   💡 Campo similar encontrado: "${fechaPorNombre.name}" (ID: ${fechaPorNombre.id})`);
      }
    }
    
    console.log('\n📋 LISTA 2 (Principal - 901214375878):');
    console.log('='.repeat(80));
    const fields = await obtenerCamposLista();
    console.log(`✅ Encontrados ${fields.length} campos personalizados\n`);
    
    console.log('📋 CAMPOS PERSONALIZADOS:');
    console.log('='.repeat(80));
    
    for (const field of fields) {
      if (field.type === 'number' || field.type === 'text' || field.type === 'date') {
        console.log(`\n📌 ${field.name} (${field.type})`);
        console.log(`   ID: ${field.id}`);
        console.log(`   Tipo: ${field.type}`);
        if (field.type_config) {
          console.log(`   Config: ${JSON.stringify(field.type_config)}`);
        }
        
        // Verificar si es el campo que buscamos
        if (field.id === CLICKUP.CF_NIVEL_AURELIN) {
          console.log(`   ✅ ESTE ES EL CAMPO DE NIVEL AURELÍN`);
        }
        if (field.id === CLICKUP.CF_FECHA_INSCRIPCION) {
          console.log(`   ✅ ESTE ES EL CAMPO DE FECHA INSCRIPCIÓN`);
        }
      }
    }
    
    console.log(`✅ Encontrados ${fields.length} campos personalizados\n`);
    
    const nivelField2 = fields.find(f => f.id === CLICKUP.CF_NIVEL_AURELIN);
    const fechaField2 = fields.find(f => f.id === CLICKUP.CF_FECHA_INSCRIPCION);
    
    if (nivelField2) {
      console.log(`✅ Campo Nivel encontrado en Lista 2: ${nivelField2.name} (${nivelField2.type})`);
    } else {
      console.log(`⚠️  Campo Nivel NO encontrado en Lista 2`);
    }
    
    if (fechaField2) {
      console.log(`✅ Campo Fecha encontrado en Lista 2: ${fechaField2.name} (${fechaField2.type})`);
    } else {
      console.log(`⚠️  Campo Fecha NO encontrado en Lista 2`);
    }
    
    console.log('\n' + '='.repeat(80));
    console.log(`\n🎯 ID buscado para Nivel: ${CLICKUP.CF_NIVEL_AURELIN}`);
    console.log(`🎯 ID buscado para Fecha: ${CLICKUP.CF_FECHA_INSCRIPCION}`);
    
    console.log(`\n📊 RESUMEN:`);
    console.log(`   Lista 1 - Nivel: ${nivelField1 ? '✅' : '❌'}`);
    console.log(`   Lista 1 - Fecha: ${fechaField1 ? '✅' : '❌'}`);
    console.log(`   Lista 2 - Nivel: ${nivelField2 ? '✅' : '❌'}`);
    console.log(`   Lista 2 - Fecha: ${fechaField2 ? '✅' : '❌'}`);
    
    if (!nivelField2 && !fechaField2) {
      console.log(`\n⚠️  IMPORTANTE: Los campos NO están en la Lista 2.`);
      console.log(`   Necesitas crear estos campos en la Lista 2 (Principal) como campos de TEXTO.`);
    }
    
  } catch (err) {
    console.error('❌ Error:', err);
  }
}

verificarCampos()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });

