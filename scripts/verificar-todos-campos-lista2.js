// scripts/verificar-todos-campos-lista2.js
// Script para verificar TODOS los campos de la Lista 2

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const CLICKUP_API_TOKEN = process.env.CLICKUP_API_TOKEN;
const LISTA_PRINCIPAL = "901214375878"; // Lista 2

async function obtenerTodosLosCampos() {
  const url = `https://api.clickup.com/api/v2/list/${LISTA_PRINCIPAL}/field`;
  
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: CLICKUP_API_TOKEN }
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Error: ${res.status} - ${err}`);
  }

  const data = await res.json();
  return data.fields || [];
}

async function verificar() {
  console.log('🔍 Verificando TODOS los campos de la Lista 2...\n');
  
  try {
    const fields = await obtenerTodosLosCampos();
    console.log(`✅ Total de campos: ${fields.length}\n`);
    
    console.log('📋 TODOS LOS CAMPOS PERSONALIZADOS:');
    console.log('='.repeat(100));
    
    for (const field of fields) {
      const nombre = field.name || 'Sin nombre';
      const tipo = field.type || 'unknown';
      const id = field.id || 'sin ID';
      
      console.log(`\n📌 ${nombre}`);
      console.log(`   Tipo: ${tipo}`);
      console.log(`   ID: ${id}`);
      
      if (field.type_config) {
        console.log(`   Config: ${JSON.stringify(field.type_config)}`);
      }
      
      // Verificar si coincide con los IDs que buscamos
      if (id === "a30aad86-b7c4-4f72-993f-cd0bab4ca069") {
        console.log(`   ✅✅✅ ESTE ES EL CAMPO DE NIVEL AURELÍN (Lista 1)`);
      }
      if (id === "4da6e22d-06eb-4e55-8c01-14911b6d4758") {
        console.log(`   ✅✅✅ ESTE ES EL CAMPO DE FECHA INSCRIPCIÓN (Lista 1)`);
      }
      if (id === "a92e6b73-ea95-4b50-ae46-ec8290f99cd3") {
        console.log(`   ✅✅✅ ESTE ES EL ID BUSCADO ORIGINALMENTE PARA NIVEL`);
      }
      if (id === "991fdc37-ef8e-4aea-af42-81ddc495e176") {
        console.log(`   ✅✅✅ ESTE ES EL ID BUSCADO ORIGINALMENTE PARA FECHA`);
      }
    }
    
    // Buscar por nombre también
    console.log('\n' + '='.repeat(100));
    console.log('\n🔍 BÚSQUEDA POR NOMBRE:');
    
    const nivelPorNombre = fields.find(f => {
      const nombre = (f.name || '').toLowerCase();
      return nombre.includes('nivel') && (nombre.includes('auri') || nombre.includes('aurelín'));
    });
    
    const fechaPorNombre = fields.find(f => {
      const nombre = (f.name || '').toLowerCase();
      return nombre.includes('fecha') && (nombre.includes('inscrip') || nombre.includes('pde'));
    });
    
    if (nivelPorNombre) {
      console.log(`\n✅ Campo Nivel encontrado por nombre: "${nivelPorNombre.name}"`);
      console.log(`   ID: ${nivelPorNombre.id}`);
      console.log(`   Tipo: ${nivelPorNombre.type}`);
    } else {
      console.log(`\n❌ Campo Nivel NO encontrado por nombre`);
    }
    
    if (fechaPorNombre) {
      console.log(`\n✅ Campo Fecha encontrado por nombre: "${fechaPorNombre.name}"`);
      console.log(`   ID: ${fechaPorNombre.id}`);
      console.log(`   Tipo: ${fechaPorNombre.type}`);
    } else {
      console.log(`\n❌ Campo Fecha NO encontrado por nombre`);
    }
    
  } catch (err) {
    console.error('❌ Error:', err);
  }
}

verificar()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });








