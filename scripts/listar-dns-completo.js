#!/usr/bin/env node
// Script para listar todos los registros DNS de forma detallada

import { listarRegistrosDNS } from '../src/services/cloudflare-dns.js';
import dotenv from 'dotenv';

dotenv.config();

async function listarDNSCompleto(dominio) {
  console.log(`\n📋 LISTADO COMPLETO DE REGISTROS DNS`);
  console.log(`Dominio: ${dominio}\n`);
  console.log('='.repeat(80));
  
  // Obtener todos los tipos de registros
  const tipos = ['TXT', 'MX', 'CNAME', 'A', 'AAAA', 'NS'];
  const todosRegistros = [];
  
  for (const tipo of tipos) {
    const resultado = await listarRegistrosDNS(dominio, tipo);
    if (resultado.success) {
      todosRegistros.push(...resultado.registros);
    }
  }
  
  // Ordenar por tipo y nombre
  todosRegistros.sort((a, b) => {
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    return a.name.localeCompare(b.name);
  });
  
  // Agrupar por tipo
  const porTipo = {};
  todosRegistros.forEach(registro => {
    if (!porTipo[registro.type]) {
      porTipo[registro.type] = [];
    }
    porTipo[registro.type].push(registro);
  });
  
  // Mostrar por tipo
  for (const tipo of Object.keys(porTipo).sort()) {
    console.log(`\n📌 ${tipo} RECORDS (${porTipo[tipo].length}):`);
    console.log('-'.repeat(80));
    
    porTipo[tipo].forEach((registro, i) => {
      console.log(`\n${i + 1}. ${registro.name}`);
      console.log(`   Content: ${registro.content}`);
      if (registro.priority !== undefined) {
        console.log(`   Priority: ${registro.priority}`);
      }
      console.log(`   TTL: ${registro.ttl === 1 ? 'Auto' : registro.ttl}`);
      console.log(`   Proxied: ${registro.proxied ? 'Yes 🟠' : 'No'}`);
      console.log(`   ID: ${registro.id}`);
    });
  }
  
  // Resumen
  console.log('\n' + '='.repeat(80));
  console.log('\n📊 RESUMEN:');
  console.log('-'.repeat(80));
  Object.keys(porTipo).forEach(tipo => {
    console.log(`   ${tipo}: ${porTipo[tipo].length} registro(s)`);
  });
  console.log(`   TOTAL: ${todosRegistros.length} registro(s)\n`);
  
  return todosRegistros;
}

async function main() {
  const dominio = process.argv[2];
  
  if (!dominio) {
    console.error('❌ Error: Debes proporcionar el dominio como argumento');
    console.log('\nUso: node scripts/listar-dns-completo.js <dominio>');
    console.log('Ejemplo: node scripts/listar-dns-completo.js pdeeugenihidalgo.org');
    process.exit(1);
  }
  
  if (!process.env.CLOUDFLARE_API_TOKEN) {
    console.error('❌ Error: CLOUDFLARE_API_TOKEN no está configurado en .env');
    process.exit(1);
  }
  
  try {
    await listarDNSCompleto(dominio);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();































