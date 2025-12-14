// scripts/diagnostico-carpeta-drive.js
// Script para diagnosticar qué hay en la carpeta de Google Drive

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '.env') });

import { obtenerClienteDrive } from '../src/services/google-workspace.js';
import { listarArchivosEnCarpeta } from '../src/services/google-workspace.js';

const env = {
  GOOGLE_SERVICE_ACCOUNT_KEY: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
  GOOGLE_SERVICE_ACCOUNT_IMPERSONATE: process.env.GOOGLE_SERVICE_ACCOUNT_IMPERSONATE
};

const folderId = '1KA1auw4OMZsDOEQD8U_pqH6UNZdwBxko';

async function diagnosticar() {
  console.log('🔍 Diagnóstico de carpeta Google Drive\n');
  console.log(`📁 ID de carpeta: ${folderId}\n`);
  
  try {
    const archivos = await listarArchivosEnCarpeta(env, folderId, 1000);
    
    console.log(`📊 Total de elementos: ${archivos.length}\n`);
    
    const carpetas = archivos.filter(f => f.mimeType === 'application/vnd.google-apps.folder');
    const archivosNormales = archivos.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');
    
    console.log(`📁 Carpetas: ${carpetas.length}`);
    carpetas.forEach(c => {
      console.log(`   - ${c.name} (ID: ${c.id})`);
    });
    
    console.log(`\n📄 Archivos: ${archivosNormales.length}`);
    archivosNormales.forEach(a => {
      const tamaño = a.size ? `(${(a.size / 1024 / 1024).toFixed(2)} MB)` : '';
      console.log(`   - ${a.name} ${tamaño} [${a.mimeType}]`);
    });
    
    // Buscar en subcarpetas
    if (carpetas.length > 0) {
      console.log(`\n🔍 Buscando en subcarpetas...\n`);
      for (const carpeta of carpetas) {
        if (carpeta.name.toLowerCase() !== 'transcripciones' && 
            carpeta.name.toLowerCase() !== 'transcripcions') {
          console.log(`📁 Carpeta: ${carpeta.name}`);
          const subArchivos = await listarArchivosEnCarpeta(env, carpeta.id, 1000);
          const subCarpetas = subArchivos.filter(f => f.mimeType === 'application/vnd.google-apps.folder');
          const subArchivosNormales = subArchivos.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');
          
          console.log(`   📁 Subcarpetas: ${subCarpetas.length}`);
          subCarpetas.forEach(sc => console.log(`      - ${sc.name} (ID: ${sc.id})`));
          
          console.log(`   📄 Archivos: ${subArchivosNormales.length}`);
          subArchivosNormales.forEach(sa => {
            const tamaño = sa.size ? `(${(sa.size / 1024 / 1024).toFixed(2)} MB)` : '';
            console.log(`      - ${sa.name} ${tamaño} [${sa.mimeType}]`);
          });
          console.log('');
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

diagnosticar();

