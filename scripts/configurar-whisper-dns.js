// scripts/configurar-whisper-dns.js
// Script para configurar el subdominio whispertranscripciones en Cloudflare

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { agregarRegistroDNS } from '../src/services/cloudflare-dns.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno
dotenv.config({ path: join(__dirname, '..', '.env') });

async function configurarDNS() {
  try {
    console.log('🌐 Configurando DNS para whispertranscripciones.eugenihidalgo.work...\n');
    
    // Verificar que existe el token de Cloudflare
    if (!process.env.CLOUDFLARE_API_TOKEN) {
      console.error('❌ Error: CLOUDFLARE_API_TOKEN no está configurado en .env');
      process.exit(1);
    }
    
    // Obtener IP del servidor
    const serverIP = process.env.SERVER_IP || '88.99.173.249';
    console.log(`📡 IP del servidor: ${serverIP}`);
    
    // Configurar registro DNS
    console.log('🔧 Creando registro DNS tipo A...');
    const resultado = await agregarRegistroDNS(
      'eugenihidalgo.work',
      'A',
      'whispertranscripciones',
      serverIP,
      null,
      'auto',
      true // Activar proxy de Cloudflare para SSL automático
    );
    
    if (resultado.success) {
      console.log(`\n✅ DNS configurado correctamente!`);
      console.log(`   Acción: ${resultado.action}`);
      console.log(`   Tipo: A`);
      console.log(`   Nombre: whispertranscripciones`);
      console.log(`   IP: ${serverIP}`);
      console.log(`\n🌐 El subdominio estará disponible en unos minutos:`);
      console.log(`   https://whispertranscripciones.eugenihidalgo.work\n`);
      return { success: true };
    } else {
      console.error(`\n❌ Error configurando DNS: ${resultado.error}`);
      return { success: false, error: resultado.error };
    }
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Ejecutar
configurarDNS().then(result => {
  process.exit(result.success ? 0 : 1);
});

