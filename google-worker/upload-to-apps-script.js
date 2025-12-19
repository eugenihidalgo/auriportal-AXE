/**
 * ============================================================================
 * SCRIPT PARA SUBIR ARCHIVOS A GOOGLE APPS SCRIPT
 * ============================================================================
 * 
 * Este script sube todos los archivos .gs a Google Apps Script usando la API.
 * 
 * REQUISITOS:
 * 1. Habilitar Google Apps Script API en Google Cloud Console
 * 2. Configurar credenciales OAuth2 o Service Account
 * 3. Instalar dependencias: npm install googleapis
 * 
 * USO:
 * node upload-to-apps-script.js [SCRIPT_ID]
 * 
 * Si no proporcionas SCRIPT_ID, se creará un nuevo proyecto.
 */

import { google } from 'googleapis';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

const SCRIPT_ID = process.argv[2] || null; // ID del script existente, o null para crear nuevo
const FOLDER_PATH = __dirname; // Carpeta donde están los archivos .gs

// Cargar credenciales desde .env o variables de entorno
import dotenv from 'dotenv';
dotenv.config();

// ============================================================================
// FUNCIONES DE AUTENTICACIÓN
// ============================================================================

async function getAuth() {
  // Opción 1: Service Account
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    const serviceAccountKey = typeof process.env.GOOGLE_SERVICE_ACCOUNT_KEY === 'string'
      ? JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)
      : process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    
    const auth = new google.auth.JWT(
      serviceAccountKey.client_email,
      null,
      serviceAccountKey.private_key,
      ['https://www.googleapis.com/auth/script.projects']
    );
    
    return auth;
  }
  
  // Opción 2: OAuth2
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth/callback'
    );
    
    if (!process.env.GOOGLE_REFRESH_TOKEN) {
      throw new Error('GOOGLE_REFRESH_TOKEN es requerido para OAuth2. Ejecuta el flujo OAuth primero.');
    }
    
    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN
    });
    
    return oauth2Client;
  }
  
  throw new Error('Se requiere GOOGLE_SERVICE_ACCOUNT_KEY o (GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET + GOOGLE_REFRESH_TOKEN)');
}

// ============================================================================
// FUNCIONES PARA LEER ARCHIVOS
// ============================================================================

function getAllGsFiles(dir, basePath = '') {
  const files = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relativePath = join(basePath, entry.name);
    
    if (entry.isDirectory() && entry.name !== 'node_modules') {
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
// FUNCIONES PARA SUBIR A APPS SCRIPT
// ============================================================================

async function createOrGetProject(script, title = 'AuriPortal Google Worker') {
  if (SCRIPT_ID) {
    console.log(`📂 Usando proyecto existente: ${SCRIPT_ID}`);
    return SCRIPT_ID;
  }
  
  console.log('📝 Creando nuevo proyecto...');
  const response = await script.projects.create({
    requestBody: {
      title: title
    }
  });
  
  const newScriptId = response.data.scriptId;
  console.log(`✅ Proyecto creado: ${newScriptId}`);
  return newScriptId;
}

async function uploadFiles(script, scriptId, files) {
  console.log(`\n📤 Subiendo ${files.length} archivos...\n`);
  
  // Preparar las actualizaciones de archivos
  const updates = [];
  
  for (const file of files) {
    console.log(`  📄 ${file.relativePath}`);
    
    // Determinar el tipo de archivo según la ruta
    let name = file.relativePath;
    let type = 'SERVER_JS'; // Por defecto
    
    // Apps Script usa nombres especiales para ciertos archivos
    if (name === 'Code.gs') {
      name = 'Code';
    } else {
      // Remover extensión .gs y usar la ruta como nombre
      name = name.replace(/\.gs$/, '');
    }
    
    updates.push({
      name: name,
      type: type,
      source: file.content
    });
  }
  
  // Actualizar el contenido del proyecto
  try {
    await script.projects.updateContent({
      scriptId: scriptId,
      requestBody: {
        files: updates
      }
    });
    
    console.log(`\n✅ Todos los archivos subidos exitosamente`);
  } catch (error) {
    console.error('\n❌ Error al subir archivos:', error.message);
    if (error.response) {
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
    const auth = await getAuth();
    
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
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      console.error('\n💡 Asegúrate de:');
      console.error('  - Tener conexión a internet');
      console.error('  - Tener habilitada la Google Apps Script API');
      console.error('  - Tener las credenciales configuradas correctamente');
    }
    process.exit(1);
  }
}

// Ejecutar
main();


















