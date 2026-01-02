// scripts/configurar-master-subdominio.js
// Script para configurar el subdominio master.pdeeugenihidalgo.org en Cloudflare

import { loadEnvIfNeeded } from '../src/core/config/env.js';
import { agregarRegistroDNS } from '../src/services/cloudflare-dns.js';

// Cargar variables de entorno
loadEnvIfNeeded();

const DOMINIO = 'pdeeugenihidalgo.org';
const SUBDOMINIO = 'master';
const IP_SERVIDOR = '88.99.173.249';

async function configurarMasterSubdominio() {
  console.log('\n🔧 Configurando subdominio master.pdeeugenihidalgo.org...\n');

  try {
    // Verificar que el token de Cloudflare esté configurado
    if (!process.env.CLOUDFLARE_API_TOKEN) {
      throw new Error('CLOUDFLARE_API_TOKEN no está configurado en .env');
    }

    console.log('📋 Configuración:');
    console.log(`   Dominio: ${DOMINIO}`);
    console.log(`   Subdominio: ${SUBDOMINIO}`);
    console.log(`   IP del servidor: ${IP_SERVIDOR}`);
    console.log(`   Proxy: Activado (🟠 Proxied)\n`);

    // Intentar crear registro CNAME primero (preferido)
    console.log('🔄 Intentando crear registro CNAME (preferido)...');
    const resultadoCNAME = await agregarRegistroDNS(
      DOMINIO,
      'CNAME',
      SUBDOMINIO,
      'admin.pdeeugenihidalgo.org', // Apuntar a admin como target
      1, // prioridad (no aplica para CNAME)
      'auto', // TTL automático
      true // proxied = true (activado)
    );

    if (resultadoCNAME.success) {
      console.log(`✅ Registro CNAME creado/actualizado exitosamente`);
      console.log(`   Acción: ${resultadoCNAME.action}`);
      console.log(`   Nombre: ${resultadoCNAME.registro.name}`);
      console.log(`   Contenido: ${resultadoCNAME.registro.content}`);
      console.log(`   Proxy: ${resultadoCNAME.registro.proxied ? '🟠 Activado' : '❌ Desactivado'}\n`);
      return resultadoCNAME;
    } else {
      // Si CNAME falla, intentar con A
      console.log('⚠️  CNAME no disponible, intentando con registro A...');
      const resultadoA = await agregarRegistroDNS(
        DOMINIO,
        'A',
        SUBDOMINIO,
        IP_SERVIDOR,
        null, // prioridad (no aplica para A)
        'auto', // TTL automático
        true // proxied = true (activado)
      );

      if (resultadoA.success) {
        console.log(`✅ Registro A creado/actualizado exitosamente`);
        console.log(`   Acción: ${resultadoA.action}`);
        console.log(`   Nombre: ${resultadoA.registro.name}`);
        console.log(`   Contenido: ${resultadoA.registro.content}`);
        console.log(`   Proxy: ${resultadoA.registro.proxied ? '🟠 Activado' : '❌ Desactivado'}\n`);
        return resultadoA;
      } else {
        throw new Error(`Error creando registro A: ${resultadoA.error}`);
      }
    }

  } catch (error) {
    console.error(`❌ Error configurando subdominio: ${error.message}`);
    console.error(`\n💡 Verifica:`);
    console.error(`   1. Que CLOUDFLARE_API_TOKEN esté configurado en .env`);
    console.error(`   2. Que el token tenga permisos para editar DNS`);
    console.error(`   3. Que el dominio ${DOMINIO} esté en Cloudflare\n`);
    throw error;
  }
}

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  configurarMasterSubdominio()
    .then(() => {
      console.log('✅ Configuración completada exitosamente\n');
      console.log('⏳ Espera 1-5 minutos para la propagación DNS');
      console.log('🌐 Luego verifica con: dig master.pdeeugenihidalgo.org\n');
      process.exit(0);
    })
    .catch(error => {
      console.error(`\n❌ Error fatal: ${error.message}\n`);
      process.exit(1);
    });
}

export { configurarMasterSubdominio };


