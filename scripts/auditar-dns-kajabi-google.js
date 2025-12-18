#!/usr/bin/env node
// Script para auditar y corregir configuración DNS para Kajabi + Google Workspace

import { listarRegistrosDNS, agregarRegistroDNS, eliminarRegistroDNS, actualizarRegistroDNS } from '../src/services/cloudflare-dns.js';
import dotenv from 'dotenv';

dotenv.config();

// SPF correcto requerido
const SPF_CORRECTO = 'v=spf1 include:_spf.google.com include:spf.mtasv.net ~all';

// Función para normalizar nombres de registros
function normalizarNombre(nombre, dominio) {
  if (!nombre) return '';
  // Remover el dominio si está incluido
  let normalizado = nombre.replace(`.${dominio}`, '').replace(dominio, '');
  if (normalizado === '') return '@';
  return normalizado;
}

// Función para detectar si un TXT es SPF
function esSPF(contenido) {
  return typeof contenido === 'string' && contenido.trim().toLowerCase().startsWith('v=spf1');
}

// Función para detectar registros de Kajabi
function esKajabi(registro) {
  const nombre = registro.name?.toLowerCase() || '';
  const contenido = registro.content?.toLowerCase() || '';
  
  // Registros típicos de Kajabi
  return nombre.includes('kajabi') || 
         contenido.includes('kajabi') ||
         nombre.includes('_kajabi') ||
         contenido.includes('kajabi-verification');
}

// Función para detectar registros de Google Workspace
function esGoogleWorkspace(registro) {
  const contenido = registro.content?.toLowerCase() || '';
  const nombre = registro.name?.toLowerCase() || '';
  
  return contenido.includes('google') ||
         contenido.includes('_spf.google.com') ||
         nombre.includes('google') ||
         (registro.type === 'MX' && contenido.includes('google'));
}

// Función para detectar duplicados
function detectarDuplicados(registros) {
  const duplicados = [];
  const vistos = new Map();
  
  for (const registro of registros) {
    const clave = `${registro.type}:${normalizarNombre(registro.name, registro.zone_name || '')}`;
    
    if (vistos.has(clave)) {
      if (!duplicados.find(d => d.clave === clave)) {
        duplicados.push({
          clave,
          registros: [vistos.get(clave), registro]
        });
      } else {
        duplicados.find(d => d.clave === clave).registros.push(registro);
      }
    } else {
      vistos.set(clave, registro);
    }
  }
  
  return duplicados;
}

// Función principal de auditoría
async function auditarDNS(dominio) {
  console.log(`\n🔍 Auditing DNS configuration for: ${dominio}\n`);
  console.log('='.repeat(60));
  
  // Obtener todos los registros relevantes
  const tipos = ['TXT', 'MX', 'CNAME'];
  const todosRegistros = [];
  
  for (const tipo of tipos) {
    const resultado = await listarRegistrosDNS(dominio, tipo);
    if (resultado.success) {
      todosRegistros.push(...resultado.registros);
    } else {
      console.error(`❌ Error obteniendo registros ${tipo}:`, resultado.error);
    }
  }
  
  console.log(`\n📋 Total registros encontrados: ${todosRegistros.length}\n`);
  
  // Separar registros por tipo
  const txtRecords = todosRegistros.filter(r => r.type === 'TXT');
  const mxRecords = todosRegistros.filter(r => r.type === 'MX');
  const cnameRecords = todosRegistros.filter(r => r.type === 'CNAME');
  
  // Analizar SPF
  console.log('📧 ANALIZANDO SPF...');
  console.log('-'.repeat(60));
  const spfRecords = txtRecords.filter(r => esSPF(r.content));
  
  if (spfRecords.length === 0) {
    console.log('❌ No se encontró registro SPF');
    console.log('   → Se creará el registro SPF correcto');
  } else if (spfRecords.length === 1) {
    const spf = spfRecords[0];
    const contenido = spf.content.trim();
    if (contenido === SPF_CORRECTO) {
      console.log('✅ SPF correcto:', contenido);
    } else {
      console.log('⚠️  SPF incorrecto:');
      console.log(`   Actual: ${contenido}`);
      console.log(`   Esperado: ${SPF_CORRECTO}`);
      console.log('   → Se actualizará el registro SPF');
    }
  } else {
    console.log(`⚠️  Múltiples registros SPF encontrados (${spfRecords.length})`);
    spfRecords.forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.name}: ${r.content}`);
    });
    console.log('   → Se consolidarán en un solo registro SPF');
  }
  
  // Analizar MX
  console.log('\n📬 ANALIZANDO REGISTROS MX...');
  console.log('-'.repeat(60));
  console.log(`Total registros MX: ${mxRecords.length}`);
  
  const mxGoogle = mxRecords.filter(r => esGoogleWorkspace(r));
  const mxKajabi = mxRecords.filter(r => esKajabi(r));
  const mxOtros = mxRecords.filter(r => !esGoogleWorkspace(r) && !esKajabi(r));
  
  if (mxGoogle.length > 0) {
    console.log(`\n✅ Google Workspace MX (${mxGoogle.length}):`);
    mxGoogle.forEach(mx => {
      console.log(`   - ${mx.name} → ${mx.content} (priority: ${mx.priority})`);
    });
  }
  
  if (mxKajabi.length > 0) {
    console.log(`\n✅ Kajabi MX (${mxKajabi.length}):`);
    mxKajabi.forEach(mx => {
      console.log(`   - ${mx.name} → ${mx.content} (priority: ${mx.priority})`);
    });
  }
  
  if (mxOtros.length > 0) {
    console.log(`\n⚠️  Otros registros MX (${mxOtros.length}):`);
    mxOtros.forEach(mx => {
      console.log(`   - ${mx.name} → ${mx.content} (priority: ${mx.priority})`);
    });
  }
  
  // Analizar TXT de Kajabi
  console.log('\n🔐 ANALIZANDO REGISTROS TXT DE KAJABI...');
  console.log('-'.repeat(60));
  const txtKajabi = txtRecords.filter(r => esKajabi(r));
  
  if (txtKajabi.length === 0) {
    console.log('⚠️  No se encontraron registros TXT de Kajabi');
    console.log('   → Necesitas agregar los registros TXT de verificación de Kajabi');
  } else {
    console.log(`✅ Registros TXT de Kajabi encontrados (${txtKajabi.length}):`);
    txtKajabi.forEach(txt => {
      console.log(`   - ${txt.name}: ${txt.content.substring(0, 80)}...`);
    });
  }
  
  // Analizar DKIM (Kajabi)
  console.log('\n🔑 ANALIZANDO DKIM (KAJABI)...');
  console.log('-'.repeat(60));
  const dkimRecords = txtRecords.filter(r => 
    r.name?.toLowerCase().includes('_domainkey') || 
    r.name?.toLowerCase().includes('dkim')
  );
  
  if (dkimRecords.length === 0) {
    console.log('⚠️  No se encontraron registros DKIM');
    console.log('   → Necesitas agregar el registro DKIM de Kajabi');
  } else {
    console.log(`✅ Registros DKIM encontrados (${dkimRecords.length}):`);
    dkimRecords.forEach(dkim => {
      console.log(`   - ${dkim.name}`);
    });
  }
  
  // Analizar DMARC
  console.log('\n🛡️  ANALIZANDO DMARC...');
  console.log('-'.repeat(60));
  const dmarcRecords = txtRecords.filter(r => 
    normalizarNombre(r.name, dominio) === '_dmarc'
  );
  
  if (dmarcRecords.length === 0) {
    console.log('⚠️  No se encontró registro DMARC');
    console.log('   → Esperando que proporciones el registro DMARC de Kajabi');
  } else if (dmarcRecords.length === 1) {
    console.log('✅ Registro DMARC encontrado:');
    console.log(`   - ${dmarcRecords[0].name}: ${dmarcRecords[0].content}`);
  } else {
    console.log(`⚠️  Múltiples registros DMARC encontrados (${dmarcRecords.length})`);
    dmarcRecords.forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.name}: ${r.content}`);
    });
    console.log('   → Se consolidarán en un solo registro DMARC');
  }
  
  // Detectar duplicados
  console.log('\n🔍 DETECTANDO DUPLICADOS Y CONFLICTOS...');
  console.log('-'.repeat(60));
  const duplicados = detectarDuplicados(todosRegistros);
  
  if (duplicados.length === 0) {
    console.log('✅ No se encontraron duplicados');
  } else {
    console.log(`⚠️  Duplicados encontrados (${duplicados.length}):`);
    duplicados.forEach(dup => {
      console.log(`   - ${dup.clave}: ${dup.registros.length} registros`);
      dup.registros.forEach((r, i) => {
        console.log(`     ${i + 1}. ID: ${r.id}, Name: ${r.name}, Content: ${r.content}`);
      });
    });
  }
  
  // Resumen de cambios necesarios
  console.log('\n📊 RESUMEN DE CAMBIOS NECESARIOS');
  console.log('='.repeat(60));
  
  const cambios = [];
  
  // SPF
  if (spfRecords.length === 0) {
    cambios.push({ tipo: 'SPF', accion: 'crear', valor: SPF_CORRECTO });
  } else if (spfRecords.length > 1 || spfRecords[0].content.trim() !== SPF_CORRECTO) {
    cambios.push({ tipo: 'SPF', accion: 'actualizar', valor: SPF_CORRECTO, registro: spfRecords[0] });
    if (spfRecords.length > 1) {
      cambios.push({ tipo: 'SPF', accion: 'eliminar', registros: spfRecords.slice(1) });
    }
  }
  
  // Duplicados
  duplicados.forEach(dup => {
    cambios.push({ tipo: 'DUPLICADO', accion: 'eliminar', registros: dup.registros.slice(1) });
  });
  
  // DMARC múltiple
  if (dmarcRecords.length > 1) {
    cambios.push({ tipo: 'DMARC', accion: 'eliminar', registros: dmarcRecords.slice(1) });
  }
  
  if (cambios.length === 0) {
    console.log('✅ No se requieren cambios. La configuración DNS está correcta.');
  } else {
    console.log(`\n⚠️  Se requieren ${cambios.length} cambio(s):\n`);
    cambios.forEach((cambio, i) => {
      console.log(`${i + 1}. ${cambio.tipo}: ${cambio.accion.toUpperCase()}`);
      if (cambio.valor) {
        console.log(`   Valor: ${cambio.valor}`);
      }
      if (cambio.registros) {
        console.log(`   Registros a eliminar: ${cambio.registros.length}`);
      }
    });
  }
  
  return {
    dominio,
    registros: todosRegistros,
    spf: spfRecords,
    mx: mxRecords,
    txt: txtRecords,
    cname: cnameRecords,
    dkim: dkimRecords,
    dmarc: dmarcRecords,
    duplicados,
    cambios
  };
}

// Función para aplicar correcciones
async function aplicarCorrecciones(dominio, auditoria) {
  console.log('\n🔧 APLICANDO CORRECCIONES...');
  console.log('='.repeat(60));
  
  const resultados = [];
  
  for (const cambio of auditoria.cambios) {
    try {
      if (cambio.tipo === 'SPF') {
        if (cambio.accion === 'crear') {
          console.log(`\n📝 Creando registro SPF...`);
          const resultado = await agregarRegistroDNS(dominio, 'TXT', '@', cambio.valor, null, 3600, false);
          if (resultado.success) {
            console.log('✅ SPF creado correctamente');
            resultados.push({ tipo: 'SPF', accion: 'creado', exito: true });
          } else {
            console.log(`❌ Error creando SPF: ${resultado.error}`);
            resultados.push({ tipo: 'SPF', accion: 'crear', exito: false, error: resultado.error });
          }
        } else if (cambio.accion === 'actualizar') {
          console.log(`\n📝 Actualizando registro SPF...`);
          const resultado = await actualizarRegistroDNS(
            dominio,
            cambio.registro.id,
            'TXT',
            cambio.registro.name,
            cambio.valor,
            null,
            3600,
            false
          );
          if (resultado.success) {
            console.log('✅ SPF actualizado correctamente');
            resultados.push({ tipo: 'SPF', accion: 'actualizado', exito: true });
          } else {
            console.log(`❌ Error actualizando SPF: ${resultado.error}`);
            resultados.push({ tipo: 'SPF', accion: 'actualizar', exito: false, error: resultado.error });
          }
        }
      } else if (cambio.accion === 'eliminar') {
        console.log(`\n🗑️  Eliminando ${cambio.registros.length} registro(s) duplicado(s)...`);
        for (const registro of cambio.registros) {
          const resultado = await eliminarRegistroDNS(dominio, registro.id);
          if (resultado.success) {
            console.log(`✅ Eliminado: ${registro.name} (${registro.type})`);
            resultados.push({ tipo: cambio.tipo, accion: 'eliminado', registro: registro.name, exito: true });
          } else {
            console.log(`❌ Error eliminando ${registro.name}: ${resultado.error}`);
            resultados.push({ tipo: cambio.tipo, accion: 'eliminar', registro: registro.name, exito: false, error: resultado.error });
          }
        }
      }
    } catch (error) {
      console.error(`❌ Error procesando cambio ${cambio.tipo}:`, error.message);
      resultados.push({ tipo: cambio.tipo, accion: cambio.accion, exito: false, error: error.message });
    }
  }
  
  return resultados;
}

// Función para generar resumen final
function generarResumen(auditoria, correcciones) {
  console.log('\n\n📋 RESUMEN FINAL DE AUDITORÍA DNS');
  console.log('='.repeat(60));
  console.log(`\nDominio: ${auditoria.dominio}`);
  
  console.log('\n📊 ESTADO DE REGISTROS:');
  console.log('-'.repeat(60));
  
  // SPF
  const spfCorrecto = auditoria.spf.length === 1 && 
                     auditoria.spf[0].content.trim() === SPF_CORRECTO;
  console.log(`SPF: ${spfCorrecto ? '✅ Correcto' : '⚠️  Requiere corrección'}`);
  if (auditoria.spf.length > 0) {
    console.log(`   Registro actual: ${auditoria.spf[0].content}`);
  }
  
  // DKIM
  console.log(`DKIM (Kajabi): ${auditoria.dkim.length > 0 ? '✅ Configurado' : '⚠️  No encontrado'}`);
  if (auditoria.dkim.length > 0) {
    auditoria.dkim.forEach(dkim => {
      console.log(`   - ${dkim.name}`);
    });
  }
  
  // MX
  const mxGoogle = auditoria.mx.filter(r => esGoogleWorkspace(r));
  const mxKajabi = auditoria.mx.filter(r => esKajabi(r));
  console.log(`MX (Google Workspace): ${mxGoogle.length > 0 ? '✅ Configurado' : '⚠️  No encontrado'}`);
  console.log(`MX (Kajabi): ${mxKajabi.length > 0 ? '✅ Configurado' : '⚠️  No encontrado'}`);
  
  // DMARC
  console.log(`DMARC: ${auditoria.dmarc.length === 1 ? '✅ Configurado' : auditoria.dmarc.length === 0 ? '⏳ Esperando registro' : '⚠️  Múltiples registros'}`);
  if (auditoria.dmarc.length > 0) {
    auditoria.dmarc.forEach(dmarc => {
      console.log(`   - ${dmarc.name}: ${dmarc.content}`);
    });
  }
  
  // Duplicados
  console.log(`Duplicados: ${auditoria.duplicados.length === 0 ? '✅ No hay duplicados' : `⚠️  ${auditoria.duplicados.length} duplicado(s) encontrado(s)`}`);
  
  // Cambios aplicados
  if (correcciones && correcciones.length > 0) {
    console.log('\n🔧 CAMBIOS APLICADOS:');
    console.log('-'.repeat(60));
    correcciones.forEach((cambio, i) => {
      const icono = cambio.exito ? '✅' : '❌';
      console.log(`${i + 1}. ${icono} ${cambio.tipo}: ${cambio.accion}`);
      if (cambio.registro) {
        console.log(`   Registro: ${cambio.registro}`);
      }
      if (cambio.error) {
        console.log(`   Error: ${cambio.error}`);
      }
    });
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('\n💡 PRÓXIMOS PASOS:');
  console.log('-'.repeat(60));
  
  if (auditoria.dmarc.length === 0) {
    console.log('1. Proporciona el registro DMARC de Kajabi (después de habilitar Strict DMARC)');
    console.log('2. Ejecuta este script nuevamente para agregar el DMARC');
  }
  
  if (auditoria.dkim.length === 0) {
    console.log('2. Verifica que los registros DKIM de Kajabi estén configurados');
  }
  
  if (auditoria.txt.filter(r => esKajabi(r)).length === 0) {
    console.log('3. Verifica que los registros TXT de verificación de Kajabi estén configurados');
  }
  
  console.log('\n');
}

// Función principal
async function main() {
  const dominio = process.argv[2];
  
  if (!dominio) {
    console.error('❌ Error: Debes proporcionar el dominio como argumento');
    console.log('\nUso: node scripts/auditar-dns-kajabi-google.js <dominio>');
    console.log('Ejemplo: node scripts/auditar-dns-kajabi-google.js pdeeugenihidalgo.org');
    process.exit(1);
  }
  
  if (!process.env.CLOUDFLARE_API_TOKEN) {
    console.error('❌ Error: CLOUDFLARE_API_TOKEN no está configurado en .env');
    process.exit(1);
  }
  
  try {
    // Realizar auditoría
    const auditoria = await auditarDNS(dominio);
    
    // Preguntar si aplicar correcciones
    if (auditoria.cambios.length > 0) {
      console.log('\n⚠️  ¿Deseas aplicar las correcciones automáticamente?');
      console.log('   (Esto modificará tu configuración DNS en Cloudflare)');
      console.log('\n   Para aplicar cambios, ejecuta:');
      console.log(`   node scripts/auditar-dns-kajabi-google.js ${dominio} --apply\n`);
      
      if (process.argv.includes('--apply')) {
        const correcciones = await aplicarCorrecciones(dominio, auditoria);
        generarResumen(auditoria, correcciones);
      } else {
        generarResumen(auditoria, null);
      }
    } else {
      generarResumen(auditoria, null);
    }
    
  } catch (error) {
    console.error('\n❌ Error durante la auditoría:', error.message);
    process.exit(1);
  }
}

main();



























