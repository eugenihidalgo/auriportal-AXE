// scripts/obtener-zoho-refresh-token.js
// Script helper per obtenir refresh token de Zoho

import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import http from 'http';
import { URL } from 'url';
import fetch from 'node-fetch';

dotenv.config();

const CLIENT_ID = process.env.ZOHO_CLIENT_ID;
const CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3001/oauth/callback';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ Error: ZOHO_CLIENT_ID i ZOHO_CLIENT_SECRET han d\'estar al .env');
  process.exit(1);
}

console.log('🔐 Obtenir Refresh Token de Zoho');
console.log('==================================\n');

// Generar URL d'autorització
const authUrl = new URL('https://accounts.zoho.com/oauth/v2/auth');
// Scopes correctes per Zoho Mail API
authUrl.searchParams.set('scope', 'ZohoMail.messages.READ,ZohoMail.messages.CREATE,ZohoMail.accounts.READ,ZohoMail.users.READ,ZohoMail.users.CREATE,ZohoMail.settings.READ,ZohoMail.settings.CREATE');
authUrl.searchParams.set('client_id', CLIENT_ID);
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('access_type', 'offline');
authUrl.searchParams.set('redirect_uri', REDIRECT_URI);

console.log('1. Obre aquesta URL al teu navegador:');
console.log(`\n${authUrl.toString()}\n`);
console.log('2. Autoritza l\'aplicació');
console.log('3. Copia el "code" de la URL de redirecció\n');

// Crear servidor temporal per rebre el code
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <html>
        <body>
          <h1>Error</h1>
          <p>${error}</p>
        </body>
      </html>
    `);
    server.close();
    return;
  }

  if (code) {
    // Intercanviar code per refresh token
    fetch('https://accounts.zoho.com/oauth/v2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        code: code
      })
    })
    .then(response => response.json())
    .then(data => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      
      if (data.refresh_token) {
        res.end(`
          <html>
            <body>
              <h1>✅ Refresh Token Obtingut!</h1>
              <p><strong>Refresh Token:</strong></p>
              <pre style="background: #f0f0f0; padding: 10px; word-break: break-all;">${data.refresh_token}</pre>
              <p>Afegeix aquest valor al .env com:</p>
              <pre>ZOHO_REFRESH_TOKEN=${data.refresh_token}</pre>
            </body>
          </html>
        `);
        
        console.log('\n✅ Refresh Token obtingut!');
        console.log(`\nAfegeix al .env:\nZOHO_REFRESH_TOKEN=${data.refresh_token}\n`);
      } else {
        res.end(`
          <html>
            <body>
              <h1>Error</h1>
              <pre>${JSON.stringify(data, null, 2)}</pre>
            </body>
          </html>
        `);
        console.error('❌ Error:', data);
      }
      
      server.close();
    })
    .catch(error => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <html>
          <body>
            <h1>Error</h1>
            <pre>${error.message}</pre>
          </body>
        </html>
      `);
      console.error('❌ Error:', error);
      server.close();
    });
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <html>
        <body>
          <h1>Esperant autorització...</h1>
          <p>Obre la URL que es va mostrar a la consola.</p>
        </body>
      </html>
    `);
  }
});

server.listen(3001, () => {
  console.log('\n🌐 Servidor temporal iniciat a http://localhost:3001');
  console.log('   (S\'aturarà automàticament després d\'obtenir el token)\n');
});

