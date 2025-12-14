/**
 * ============================================================================
 * OBTENER REFRESH TOKEN (MODO LOCAL)
 * ============================================================================
 * 
 * Este script abre un servidor local temporal para recibir el código OAuth
 * y obtener el refresh_token sin depender del dominio verificado.
 * 
 * USO:
 * node obtener-token-local.js
 */

import { google } from 'googleapis';
import http from 'http';
import { URL } from 'url';

// ============================================================================
// CREDENCIALES
// ============================================================================

const CLIENT_ID = '79274918274-hnn9dup01e6h48dickoi1shf7n4t5dlq.apps.googleusercontent.com';
const CLIENT_SECRET = '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';

// Para modo local, usamos localhost
const REDIRECT_URI = 'http://localhost:8080/oauth/callback';
const PORT = 8080;

// ============================================================================
// FUNCIÓN PRINCIPAL
// ============================================================================

async function main() {
  const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
  );
  
  // Generar URL de autorización
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/script.projects'],
    prompt: 'consent'
  });
  
  console.log('🚀 Iniciando servidor local temporal...\n');
  console.log('📋 INSTRUCCIONES:');
  console.log('1. Abre esta URL en tu navegador:');
  console.log(`\n   ${authUrl}\n`);
  console.log('2. Autoriza la aplicación');
  console.log('3. El código se recibirá automáticamente\n');
  console.log(`⏳ Esperando en http://localhost:${PORT}...\n`);
  
  // Crear servidor HTTP para recibir el código
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://localhost:${PORT}`);
      
      if (url.pathname === '/oauth/callback') {
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');
        
        if (error) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`
            <html>
              <head><title>Error OAuth</title></head>
              <body style="font-family: Arial; padding: 40px; text-align: center;">
                <h1 style="color: red;">❌ Error de Autorización</h1>
                <p>Error: ${error}</p>
                <p>Puedes cerrar esta ventana.</p>
              </body>
            </html>
          `);
          
          server.close();
          console.error(`\n❌ Error: ${error}`);
          process.exit(1);
          return;
        }
        
        if (!code) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`
            <html>
              <head><title>Error</title></head>
              <body style="font-family: Arial; padding: 40px; text-align: center;">
                <h1 style="color: red;">❌ No se recibió código</h1>
                <p>Puedes cerrar esta ventana e intentar de nuevo.</p>
              </body>
            </html>
          `);
          server.close();
          console.error('\n❌ No se recibió código de autorización');
          process.exit(1);
          return;
        }
        
        // Intercambiar código por tokens
        console.log('🔄 Intercambiando código por tokens...\n');
        
        try {
          const { tokens } = await oauth2Client.getToken(code);
          
          // Mostrar respuesta HTML
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`
            <html>
              <head><title>Éxito</title></head>
              <body style="font-family: Arial; padding: 40px; text-align: center; background: #f0f0f0;">
                <div style="background: white; padding: 30px; border-radius: 10px; max-width: 600px; margin: 0 auto; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                  <h1 style="color: green;">✅ ¡Autorización exitosa!</h1>
                  <p>Puedes cerrar esta ventana.</p>
                  <p style="color: #666; margin-top: 20px;">Los tokens se mostrarán en la terminal.</p>
                </div>
              </body>
            </html>
          `);
          
          server.close();
          
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
          
          console.log('💡 También actualiza REDIRECT_URI en subir-archivos.js si quieres usar:');
          console.log(`   https://pdeeugenihidalgo.org/oauth/callback\n`);
          
          process.exit(0);
          
        } catch (tokenError) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`
            <html>
              <head><title>Error</title></head>
              <body style="font-family: Arial; padding: 40px; text-align: center;">
                <h1 style="color: red;">❌ Error al obtener tokens</h1>
                <p>${tokenError.message}</p>
                <p>Puedes cerrar esta ventana.</p>
              </body>
            </html>
          `);
          
          server.close();
          console.error('\n❌ Error al obtener tokens:', tokenError.message);
          process.exit(1);
        }
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
      }
    } catch (err) {
      console.error('Error en servidor:', err);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal server error');
    }
  });
  
  server.listen(PORT, () => {
    console.log(`✅ Servidor escuchando en http://localhost:${PORT}\n`);
  });
  
  // Manejar cierre
  process.on('SIGINT', () => {
    console.log('\n\n⚠️  Servidor cerrado');
    server.close();
    process.exit(0);
  });
}

main();

