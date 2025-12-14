/**
 * ============================================================================
 * SCRIPT PARA SUBIR ARCHIVOS A GOOGLE APPS SCRIPT
 * ============================================================================
 * 
 * Usa las credenciales OAuth2 configuradas para subir todos los archivos .gs
 * 
 * REQUISITOS:
 * 1. Habilitar Google Apps Script API en Google Cloud Console
 * 2. Tener Client ID y Client Secret configurados
 * 3. Tener un refresh_token (se obtiene la primera vez)
 * 
 * USO:
 * node subir-archivos.js [SCRIPT_ID]
 * 
 * Si no proporcionas SCRIPT_ID, se creará un nuevo proyecto.
 */

import { google } from 'googleapis';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================================
// CREDENCIALES OAuth2
// ============================================================================

const CLIENT_ID = '79274918274-hnn9dup01e6h48dickoi1shf7n4t5dlq.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
// Puedes usar localhost si tienes problemas con el dominio verificado
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:8080/oauth/callback';

// Cargar refresh_token desde .env o pedirlo si no existe
import dotenv from 'dotenv';
dotenv.config();

const REFRESH_TOKEN = process.env.GOOGLE_APPS_SCRIPT_REFRESH_TOKEN || null;

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

const SCRIPT_ID = process.argv[2] || null; // ID del script existente, o null para crear nuevo
const FOLDER_PATH = __dirname; // Carpeta donde están los archivos .gs

// ============================================================================
// FUNCIONES PARA LEER ARCHIVOS
// ============================================================================

function getAllGsFiles(dir, basePath = '') {
  const files = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relativePath = join(basePath, entry.name);
    
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
      files.push(...getAllGsFiles(fullPath, relativePath));
    } else if (entry.isFile() && entry.name.endsWith('.gs')) {
      files.push({
        path: fullPath,
        relativePath: relativePath.replace(/\\/g, '/'), // Normalizar separadores
        content: readFileSync(fullPath, 'utf8')
      });
    }
  }
  
  return files;
}

// ============================================================================
// FUNCIONES DE AUTENTICACIÓN
// ============================================================================

function getAuthUrl() {
  const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
  );
  
  const scopes = ['https://www.googleapis.com/auth/script.projects'];
  
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent' // Forzar consent para obtener refresh_token
  });
}

async function getAuthenticatedClient() {
  const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
  );
  
  if (!REFRESH_TOKEN) {
    console.log('\n❌ No se encontró GOOGLE_APPS_SCRIPT_REFRESH_TOKEN');
    console.log('\n📋 Para obtener el refresh token:');
    console.log('1. Abre esta URL en tu navegador:');
    console.log(`\n   ${getAuthUrl()}\n`);
    console.log('2. Autoriza la aplicación');
    console.log('3. Serás redirigido a tu servidor');
    console.log('4. Copia el código de la URL (parámetro "code")');
    console.log('5. Ejecuta: node obtener-refresh-token.js CODIGO_AQUI');
    console.log('\n   O añade el refresh_token a tu .env:');
    console.log('   GOOGLE_APPS_SCRIPT_REFRESH_TOKEN=tu_refresh_token_aqui\n');
    process.exit(1);
  }
  
  oauth2Client.setCredentials({
    refresh_token: REFRESH_TOKEN
  });
  
  return oauth2Client;
}

// ============================================================================
// FUNCIONES PARA SUBIR A APPS SCRIPT
// ============================================================================

async function createOrGetProject(script, title = 'AuriPortal Google Worker') {
  if (SCRIPT_ID) {
    console.log(`📂 Usando proyecto existente: ${SCRIPT_ID}`);
    try {
      const project = await script.projects.get({
        scriptId: SCRIPT_ID
      });
      console.log(`✅ Proyecto encontrado: ${project.data.title || title}`);
    } catch (e) {
      throw new Error(`No se pudo acceder al proyecto ${SCRIPT_ID}. Verifica el ID y los permisos.`);
    }
    return SCRIPT_ID;
  }
  
  console.log('📝 Creando nuevo proyecto...');
  try {
    const response = await script.projects.create({
      requestBody: {
        title: title
      }
    });
    
    const newScriptId = response.data.scriptId;
    console.log(`✅ Proyecto creado: ${newScriptId}`);
    console.log(`📎 URL: https://script.google.com/home/projects/${newScriptId}/edit`);
    return newScriptId;
  } catch (error) {
    throw new Error(`Error al crear proyecto: ${error.message}`);
  }
}

async function uploadFiles(script, scriptId, files) {
  console.log(`\n📤 Subiendo ${files.length} archivos...\n`);
  
  // Preparar las actualizaciones de archivos
  const updates = [];
  
  for (const file of files) {
    console.log(`  📄 ${file.relativePath}`);
    
    // Determinar el tipo de archivo según la ruta
    let name = file.relativePath;
    
    // Remover extensión .gs
    name = name.replace(/\.gs$/, '');
    
    // Apps Script espera un formato específico
    // Para archivos en carpetas, usar el formato carpeta/archivo
    // El nombre "Code" es especial para el archivo principal
    if (name === 'Code') {
      name = 'Code';
    }
    
    updates.push({
      name: name,
      type: 'SERVER_JS',
      source: file.content
    });
  }
  
  // Actualizar el contenido del proyecto
  try {
    console.log('\n⏳ Subiendo a Google Apps Script...');
    await script.projects.updateContent({
      scriptId: scriptId,
      requestBody: {
        files: updates
      }
    });
    
    console.log(`\n✅ Todos los archivos subidos exitosamente`);
  } catch (error) {
    console.error('\n❌ Error al subir archivos:', error.message);
    if (error.response && error.response.data) {
      console.error('Detalles:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}

// ============================================================================
// FUNCIÓN PRINCIPAL
// ============================================================================

async function main() {
  try {
    console.log('🚀 Iniciando subida a Google Apps Script...\n');
    
    // Autenticar
    console.log('🔐 Autenticando...');
    const auth = await getAuthenticatedClient();
    
    // Inicializar API de Apps Script
    const script = google.script('v1', { auth });
    
    // Obtener archivos .gs
    console.log('📂 Buscando archivos .gs...');
    const files = getAllGsFiles(FOLDER_PATH);
    
    if (files.length === 0) {
      throw new Error('No se encontraron archivos .gs en la carpeta');
    }
    
    console.log(`✅ Encontrados ${files.length} archivos:\n`);
    files.forEach(f => console.log(`  - ${f.relativePath}`));
    
    // Crear o obtener proyecto
    const scriptId = await createOrGetProject(script);
    
    // Subir archivos
    await uploadFiles(script, scriptId, files);
    
    // Obtener URL del proyecto
    const projectUrl = `https://script.google.com/home/projects/${scriptId}/edit`;
    console.log(`\n🎉 ¡Completado!`);
    console.log(`\n📎 URL del proyecto: ${projectUrl}`);
    console.log(`\n📋 Próximos pasos:`);
    console.log(`  1. Abre el proyecto en Apps Script`);
    console.log(`  2. Configura SCRIPT_SECRET en Script Properties`);
    console.log(`  3. Despliega como Web App`);
    console.log(`  4. Copia la URL del Web App\n`);
    console.log(`📝 Script ID: ${scriptId}\n`);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      console.error('\n💡 Asegúrate de:');
      console.error('  - Tener conexión a internet');
      console.error('  - Tener habilitada la Google Apps Script API');
    } else if (error.message.includes('invalid_grant')) {
      console.error('\n💡 El refresh_token ha expirado o es inválido.');
      console.error('   Ejecuta de nuevo para obtener un nuevo token.');
    }
    process.exit(1);
  }
}

// Ejecutar
main();

