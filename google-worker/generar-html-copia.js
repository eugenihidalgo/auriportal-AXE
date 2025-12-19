/**
 * Script para generar un archivo HTML con todos los contenidos para copiar fácilmente
 * Ejecutar: node generar-html-copia.js
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const archivos = [
  { nombre: 'Code.gs', ruta: 'Code.gs' },
  { nombre: 'router.gs', ruta: 'router.gs' },
  { nombre: 'utils/response.gs', ruta: 'utils/response.gs' },
  { nombre: 'utils/validation.gs', ruta: 'utils/validation.gs' },
  { nombre: 'actions/drive.gs', ruta: 'actions/drive.gs' },
  { nombre: 'actions/docs.gs', ruta: 'actions/docs.gs' },
  { nombre: 'actions/email.gs', ruta: 'actions/email.gs' },
  { nombre: 'actions/calendar.gs', ruta: 'actions/calendar.gs' },
  { nombre: 'actions/aurielin.gs', ruta: 'actions/aurielin.gs' },
  { nombre: 'actions/logs.gs', ruta: 'actions/logs.gs' }
];

// Leer todos los archivos
const archivosLeidos = [];
archivos.forEach(archivo => {
  try {
    const contenido = readFileSync(join(__dirname, archivo.ruta), 'utf8');
    archivosLeidos.push({
      nombre: archivo.nombre,
      contenido: contenido
    });
  } catch (error) {
    console.error(`Error leyendo ${archivo.ruta}:`, error.message);
  }
});

// Generar HTML
let html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AuriPortal Google Worker - Copiar Archivos</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: #1e1e1e;
      color: #d4d4d4;
      padding: 20px;
      line-height: 1.6;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    h1 {
      color: #4CAF50;
      margin-bottom: 10px;
      font-size: 2em;
    }
    .subtitle {
      color: #888;
      margin-bottom: 30px;
    }
    .archivo {
      background: #252526;
      border: 1px solid #3e3e42;
      border-radius: 8px;
      margin-bottom: 30px;
      overflow: hidden;
    }
    .archivo-header {
      background: #2d2d30;
      padding: 15px 20px;
      border-bottom: 1px solid #3e3e42;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .archivo-nombre {
      font-family: 'Consolas', 'Monaco', monospace;
      color: #4EC9B0;
      font-size: 1.1em;
      font-weight: bold;
    }
    .boton-copiar {
      background: #0e639c;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.9em;
      transition: background 0.2s;
    }
    .boton-copiar:hover {
      background: #1177bb;
    }
    .boton-copiar.copiado {
      background: #4CAF50;
    }
    .archivo-contenido {
      padding: 20px;
      position: relative;
    }
    pre {
      background: #1e1e1e;
      border: 1px solid #3e3e42;
      border-radius: 4px;
      padding: 15px;
      overflow-x: auto;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 0.9em;
      line-height: 1.5;
      margin: 0;
    }
    .instrucciones {
      background: #2d2d30;
      border-left: 4px solid #4CAF50;
      padding: 20px;
      margin-bottom: 30px;
      border-radius: 4px;
    }
    .instrucciones h2 {
      color: #4CAF50;
      margin-bottom: 15px;
    }
    .instrucciones ol {
      margin-left: 20px;
    }
    .instrucciones li {
      margin-bottom: 10px;
    }
    .badge {
      display: inline-block;
      background: #4CAF50;
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 0.8em;
      margin-left: 10px;
    }
    code { color: #d4d4d4; }
    a { color: #4CAF50; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🚀 AuriPortal Google Worker - Copiar Archivos</h1>
    <p class="subtitle">Total: ${archivosLeidos.length} archivos · Clic en "Copiar" para copiar el contenido</p>
    
    <div class="instrucciones">
      <h2>📋 Instrucciones</h2>
      <ol>
        <li>Ve a <a href="https://script.google.com" target="_blank">script.google.com</a> y crea un nuevo proyecto</li>
        <li>Para cada archivo:
          <ul style="margin-top: 10px; margin-left: 20px;">
            <li>Clic en <strong>"Copiar"</strong></li>
            <li>En Apps Script: "+" → "Script"</li>
            <li>Para carpetas usa nombre completo: <code>utils/response.gs</code></li>
            <li>Pega (Ctrl+V)</li>
          </ul>
        </li>
        <li>Configura SCRIPT_SECRET en Script Properties</li>
        <li>Despliega como Web App</li>
      </ol>
    </div>

`;

archivosLeidos.forEach((archivo, index) => {
  const contenidoEscapado = archivo.contenido
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
  
  html += `
    <div class="archivo">
      <div class="archivo-header">
        <div>
          <span class="archivo-nombre">${archivo.nombre}</span>
          <span class="badge">${index + 1}/${archivosLeidos.length}</span>
        </div>
        <button class="boton-copiar" onclick="copiarArchivo(${index})" data-index="${index}">📋 Copiar</button>
      </div>
      <div class="archivo-contenido">
        <pre><code id="contenido-${index}">${contenidoEscapado}</code></pre>
      </div>
    </div>
    `;
});

// Crear array de contenidos para JavaScript
const contenidosJS = archivosLeidos.map(archivo => 
  JSON.stringify(archivo.contenido)
).join(',\n    ');

html += `
  </div>

  <script>
    const contenidos = [
    ${contenidosJS}
    ];

    function copiarArchivo(index) {
      const contenido = contenidos[index];
      if (!contenido) {
        alert('Error: No se pudo leer el archivo');
        return;
      }
      
      navigator.clipboard.writeText(contenido).then(() => {
        const boton = document.querySelector(\`[data-index="\${index}"]\`);
        const textoOriginal = boton.textContent;
        boton.textContent = '✅ ¡Copiado!';
        boton.classList.add('copiado');
        
        setTimeout(() => {
          boton.textContent = textoOriginal;
          boton.classList.remove('copiado');
        }, 2000);
      }).catch(err => {
        // Fallback para navegadores antiguos
        const textarea = document.createElement('textarea');
        textarea.value = contenido;
        document.body.appendChild(textarea);
        textarea.select();
        try {
          document.execCommand('copy');
          const boton = document.querySelector(\`[data-index="\${index}"]\`);
          boton.textContent = '✅ ¡Copiado!';
          boton.classList.add('copiado');
          setTimeout(() => {
            boton.textContent = '📋 Copiar';
            boton.classList.remove('copiado');
          }, 2000);
        } catch (e) {
          alert('Error al copiar. Copia manualmente desde el código.');
        }
        document.body.removeChild(textarea);
      });
    }
  </script>
</body>
</html>`;

const archivoHTML = join(__dirname, 'copiar-archivos.html');
writeFileSync(archivoHTML, html);

console.log('✅ Archivo HTML generado exitosamente!');
console.log(`📄 Archivo: ${archivoHTML}`);
console.log('');
console.log('🌐 Siguiente paso:');
console.log('   1. Abre el archivo "copiar-archivos.html" en tu navegador');
console.log('   2. Clic en "Copiar" para cada archivo');
console.log('   3. Pega el contenido en Google Apps Script');
console.log('');
console.log('💡 También puedes abrirlo desde aquí:');
console.log(`   file://${archivoHTML}`);


















