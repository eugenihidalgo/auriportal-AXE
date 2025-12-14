// scripts/configurar-subdominios-cloudflare.js
// Configura todos los subdominios necesarios para AuriPortal v4 en Cloudflare

import { agregarRegistroDNS } from '../src/services/cloudflare-dns.js';
import dotenv from 'dotenv';

dotenv.config();

const DOMINIO = 'pdeeugenihidalgo.org';
// Obtener IPv4 (no IPv6)
const IP_SERVIDOR = process.env.SERVER_IP_IPv4 || '88.99.173.249'; // IP por defecto

// Subdominios a configurar
const SUBDOMINIOS = [
  {
    nombre: 'portal',
    descripcion: 'Portal principal de AuriPortal (/, /enter, /aprender, /topics)',
    tipo: 'A'
  },
  {
    nombre: 'webhook-kajabi',
    descripcion: 'Webhook de Kajabi (/kajabi-webhook)',
    tipo: 'A'
  },
  {
    nombre: 'webhook-typeform',
    descripcion: 'Webhook de Typeform (/typeform-webhook)',
    tipo: 'A'
  },
  {
    nombre: 'admin',
    descripcion: 'Panel de administración (/admin, /health-check)',
    tipo: 'A'
  }
];

async function configurarSubdominios() {
  console.log('🌐 Configurando subdominios para AuriPortal v4...\n');
  console.log(`📋 Dominio: ${DOMINIO}`);
  console.log(`🖥️  IP del servidor: ${IP_SERVIDOR}\n`);

  if (!process.env.CLOUDFLARE_API_TOKEN) {
    console.error('❌ CLOUDFLARE_API_TOKEN no configurado en .env');
    process.exit(1);
  }

  const resultados = [];

  for (const subdominio of SUBDOMINIOS) {
    console.log(`\n📝 Configurando: ${subdominio.nombre}.${DOMINIO}...`);
    console.log(`   Descripción: ${subdominio.descripcion}`);

    try {
      const resultado = await agregarRegistroDNS(
        DOMINIO,
        subdominio.tipo,
        subdominio.nombre,
        IP_SERVIDOR,
        null,
        3600 // TTL: 1 hora
      );

      if (resultado.success) {
        console.log(`   ✅ ${resultado.action === 'created' ? 'Creado' : 'Actualizado'} correctamente`);
        resultados.push({
          subdominio: `${subdominio.nombre}.${DOMINIO}`,
          estado: 'ok',
          accion: resultado.action
        });
      } else {
        console.error(`   ❌ Error: ${resultado.error}`);
        resultados.push({
          subdominio: `${subdominio.nombre}.${DOMINIO}`,
          estado: 'error',
          error: resultado.error
        });
      }
    } catch (error) {
      console.error(`   ❌ Error configurando ${subdominio.nombre}:`, error.message);
      resultados.push({
        subdominio: `${subdominio.nombre}.${DOMINIO}`,
        estado: 'error',
        error: error.message
      });
    }
  }

  console.log('\n\n📊 Resumen de configuración:\n');
  console.log('┌─────────────────────────────────────┬──────────┬────────────┐');
  console.log('│ Subdominio                         │ Estado   │ Acción     │');
  console.log('├─────────────────────────────────────┼──────────┼────────────┤');

  resultados.forEach(r => {
    const estado = r.estado === 'ok' ? '✅ OK' : '❌ ERROR';
    const accion = r.accion || r.error || 'N/A';
    const nombre = r.subdominio.padEnd(35);
    console.log(`│ ${nombre} │ ${estado.padEnd(8)} │ ${accion.padEnd(10)} │`);
  });

  console.log('└─────────────────────────────────────┴──────────┴────────────┘');

  console.log('\n🌐 URLs configuradas:');
  resultados.forEach(r => {
    if (r.estado === 'ok') {
      console.log(`   ✅ https://${r.subdominio}`);
    }
  });

  console.log('\n⚠️  IMPORTANTE:');
  console.log('   1. Los subdominios pueden tardar 1-5 minutos en propagarse');
  console.log('   2. Asegúrate de que el Proxy esté activado en Cloudflare (🟠 Proxied)');
  console.log('   3. Verifica que el servidor esté escuchando en el puerto 3000');
  console.log('   4. Si usas Nginx, configura los virtual hosts para cada subdominio\n');

  const exitosos = resultados.filter(r => r.estado === 'ok').length;
  const total = resultados.length;

  if (exitosos === total) {
    console.log('🎉 ¡Todos los subdominios configurados correctamente!');
    process.exit(0);
  } else {
    console.log(`⚠️  ${exitosos}/${total} subdominios configurados correctamente`);
    process.exit(1);
  }
}

configurarSubdominios().catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});

