/**
 * ============================================================================
 * SCRIPT PARA OBTENER REFRESH TOKEN
 * ============================================================================
 * 
 * Ejecuta este script después de autorizar la aplicación en el navegador
 * 
 * USO:
 * node obtener-refresh-token.js CODIGO_DE_LA_URL
 * 
 * El código viene de la URL después de autorizar:
 * https://pdeeugenihidalgo.org/oauth/callback?code=CODIGO_AQUI&scope=...
 */

import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

// ============================================================================
// CREDENCIALES
// ============================================================================

const CLIENT_ID = '79274918274-hnn9dup01e6h48dickoi1shf7n4t5dlq.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
const REDIRECT_URI = 'https://pdeeugenihidalgo.org/oauth/callback';

// ============================================================================
// FUNCIÓN PRINCIPAL
// ============================================================================

async function main() {
  const code = process.argv[2];
  
  if (!code) {
    console.log('❌ Falta el código de autorización');
    console.log('\n📋 Uso:');
    console.log('  node obtener-refresh-token.js CODIGO_DE_LA_URL\n');
    console.log('El código viene de la URL después de autorizar:');
    console.log('https://pdeeugenihidalgo.org/oauth/callback?code=CODIGO_AQUI\n');
    
    // Mostrar URL de autorización
    const oauth2Client = new google.auth.OAuth2(
      CLIENT_ID,
      CLIENT_SECRET,
      REDIRECT_URI
    );
    
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/script.projects'],
    prompt: 'consent'
  });
  
  console.log('🔗 URL de autorización para Apps Script API:');
    
    console.log('🔗 URL de autorización:');
    console.log(`\n${authUrl}\n`);
    process.exit(1);
  }
  
  try {
    const oauth2Client = new google.auth.OAuth2(
      CLIENT_ID,
      CLIENT_SECRET,
      REDIRECT_URI
    );
    
    console.log('🔄 Intercambiando código por tokens...\n');
    
    const { tokens } = await oauth2Client.getToken(code);
    
    if (!tokens.refresh_token) {
      console.log('⚠️  No se obtuvo refresh_token');
      console.log('   Esto puede pasar si ya autorizaste antes.');
      console.log('   Intenta revocar permisos y autorizar de nuevo.\n');
    }
    
    console.log('✅ Tokens obtenidos exitosamente!\n');
    console.log('📝 Añade esto a tu archivo .env:\n');
    console.log(`GOOGLE_APPS_SCRIPT_REFRESH_TOKEN=${tokens.refresh_token || tokens.access_token}\n`);
    
    if (tokens.access_token) {
      console.log('Access Token (opcional):');
      console.log(`GOOGLE_APPS_SCRIPT_ACCESS_TOKEN=${tokens.access_token}\n`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Detalles:', error.response.data);
    }
    process.exit(1);
  }
}

main();

