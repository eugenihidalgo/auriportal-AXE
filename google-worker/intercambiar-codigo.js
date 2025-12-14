/**
 * ============================================================================
 * INTERCAMBIAR CÓDIGO POR TOKEN
 * ============================================================================
 * 
 * Intercambia el código OAuth que ya tienes por el refresh_token
 * 
 * USO:
 * node intercambiar-codigo.js CODIGO_AQUI
 * 
 * Ejemplo:
 * node intercambiar-codigo.js 4/0ATX87lNDmG4ZeOyJpocCGG9Jm85tMprbAUVgsu7cfxaoDW-tQHAsGutxSPc7T8HM7bWmMA
 */

import { google } from 'googleapis';

// ============================================================================
// CREDENCIALES
// ============================================================================

const CLIENT_ID = '79274918274-hnn9dup01e6h48dickoi1shf7n4t5dlq.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
// IMPORTANTE: Debe coincidir exactamente con el redirect_uri usado en la autorización
const REDIRECT_URI = 'https://pdeeugenihidalgo.org/oauth/callback';

// ============================================================================
// FUNCIÓN PRINCIPAL
// ============================================================================

async function main() {
  const code = process.argv[2];
  
  if (!code) {
    console.log('❌ Falta el código de autorización');
    console.log('\n📋 Uso:');
    console.log('  node intercambiar-codigo.js CODIGO_AQUI\n');
    console.log('El código viene de la URL después de autorizar:');
    console.log('https://pdeeugenihidalgo.org/oauth/apps-script?code=CODIGO_AQUI\n');
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
      console.log('   Si necesitas uno nuevo, revoca los permisos y autoriza de nuevo.\n');
    }
    
    console.log('✅ Tokens obtenidos exitosamente!\n');
    console.log('📝 Añade esto a tu archivo .env:\n');
    console.log(`GOOGLE_APPS_SCRIPT_REFRESH_TOKEN=${tokens.refresh_token || tokens.access_token}\n`);
    
    if (tokens.access_token) {
      console.log('Access Token (temporal, expira en 1 hora):');
      console.log(tokens.access_token.substring(0, 50) + '...\n');
    }
    
    console.log('💡 Próximo paso:');
    console.log('   cd /var/www/aurelinportal/google-worker');
    console.log('   node subir-archivos.js\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response && error.response.data) {
      console.error('Detalles:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

main();

