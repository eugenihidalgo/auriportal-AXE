/**
 * ============================================================================
 * OBTENER TOKEN DE FORMA SIMPLE
 * ============================================================================
 * 
 * Primero necesitas añadir http://localhost:8080/oauth/callback a los
 * Redirect URIs en Google Cloud Console, luego ejecuta este script.
 */

import { google } from 'googleapis';
import http from 'http';
import { URL } from 'url';

const CLIENT_ID = '79274918274-hnn9dup01e6h48dickoi1shf7n4t5dlq.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
const REDIRECT_URI = 'http://localhost:8080/oauth/callback';
const PORT = 8080;

async function main() {
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
  
  console.log('\n🚀 Servidor OAuth local iniciado\n');
  console.log('📋 PASOS:');
  console.log('1. Asegúrate de que http://localhost:8080/oauth/callback esté en Redirect URIs');
  console.log('2. Abre esta URL en tu navegador:\n');
  console.log(`   ${authUrl}\n`);
  console.log('3. Autoriza la aplicación');
  console.log('4. El código se recibirá automáticamente\n');
  console.log(`⏳ Esperando en http://localhost:${PORT}...\n`);
  
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://localhost:${PORT}`);
      
      if (url.pathname === '/oauth/callback') {
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');
        
        if (error) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`<h1>Error: ${error}</h1><p>Cierra esta ventana.</p>`);
          server.close();
          console.error(`\n❌ Error: ${error}`);
          process.exit(1);
          return;
        }
        
        if (!code) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<h1>No se recibió código</h1><p>Cierra esta ventana e intenta de nuevo.</p>');
          server.close();
          console.error('\n❌ No se recibió código');
          process.exit(1);
          return;
        }
        
        console.log('🔄 Intercambiando código por tokens...\n');
        
        try {
          const { tokens } = await oauth2Client.getToken(code);
          
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`
            <html>
              <head><title>Éxito</title></head>
              <body style="font-family: Arial; padding: 40px; text-align: center;">
                <h1 style="color: green;">✅ ¡Autorización exitosa!</h1>
                <p>Puedes cerrar esta ventana.</p>
                <p>Los tokens se mostrarán en la terminal.</p>
              </body>
            </html>
          `);
          
          server.close();
          
          if (!tokens.refresh_token) {
            console.log('⚠️  No se obtuvo refresh_token (puede que ya tengas uno activo)');
          } else {
            console.log('✅ Tokens obtenidos exitosamente!\n');
            console.log('📝 Añade esto a tu archivo .env:\n');
            console.log(`GOOGLE_APPS_SCRIPT_REFRESH_TOKEN=${tokens.refresh_token}\n`);
          }
          
          if (tokens.access_token) {
            console.log('Access Token (temporal):');
            console.log(tokens.access_token.substring(0, 50) + '...\n');
          }
          
          console.log('💡 Próximo paso:');
          console.log('   cd /var/www/aurelinportal/google-worker');
          console.log('   node subir-archivos.js\n');
          
          process.exit(0);
          
        } catch (tokenError) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`<h1>Error al obtener tokens</h1><p>${tokenError.message}</p><p>Cierra esta ventana.</p>`);
          server.close();
          console.error('\n❌ Error al obtener tokens:', tokenError.message);
          if (tokenError.response) {
            console.error('Detalles:', JSON.stringify(tokenError.response.data, null, 2));
          }
          process.exit(1);
        }
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
      }
    } catch (err) {
      console.error('Error:', err);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal server error');
    }
  });
  
  server.listen(PORT, () => {
    console.log(`✅ Servidor escuchando en http://localhost:${PORT}\n`);
  });
  
  process.on('SIGINT', () => {
    console.log('\n\n⚠️  Servidor cerrado');
    server.close();
    process.exit(0);
  });
}

main();

