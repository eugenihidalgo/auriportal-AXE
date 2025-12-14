// scripts/obtener-listas-frases.js
// Obtiene las listas de frases desde la carpeta específica de ClickUp

import dotenv from 'dotenv';
dotenv.config();

const CLICKUP_API_TOKEN = process.env.CLICKUP_API_TOKEN;
const CLICKUP_API_BASE = "https://api.clickup.com/api/v2";

// IDs extraídos de la URL
const TEAM_ID = "9012227922";
const FOLDER_ID = "90128582162";

async function obtenerListasFrases() {
  if (!CLICKUP_API_TOKEN) {
    console.error('❌ CLICKUP_API_TOKEN no configurado');
    process.exit(1);
  }

  try {
    console.log('🔍 Obteniendo listas desde la carpeta de frases...\n');
    console.log(`📁 Folder ID: ${FOLDER_ID}`);
    console.log(`👥 Team ID: ${TEAM_ID}\n`);

    // Obtener listas del folder
    const response = await fetch(`${CLICKUP_API_BASE}/folder/${FOLDER_ID}/list?archived=false`, {
      headers: { Authorization: CLICKUP_API_TOKEN }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error obteniendo listas: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const listas = data.lists || [];

    console.log(`📋 Listas encontradas: ${listas.length}\n`);

    // Filtrar listas de niveles (acepta "Nivel" y "Nivell")
    const listasNiveles = listas.filter(lista => {
      const nombre = lista.name || '';
      return /^Nivell?\s+\d+/i.test(nombre.trim());
    });

    if (listasNiveles.length > 0) {
      console.log('✅ Listas de niveles encontradas:\n');
      listasNiveles.forEach(lista => {
        const nivel = lista.name.match(/\d+/)?.[0] || '?';
        console.log(`   Nivel ${nivel.padStart(2, '0')}: ${lista.name}`);
        console.log(`   └─ List ID: ${lista.id}`);
        console.log('');
      });

      // Obtener algunas tareas de ejemplo de cada lista
      console.log('📝 Verificando tareas en las listas...\n');
      for (const lista of listasNiveles.slice(0, 3)) { // Solo las primeras 3 para no saturar
        try {
          const tasksResponse = await fetch(
            `${CLICKUP_API_BASE}/list/${lista.id}/task?archived=false&page=0`,
            { headers: { Authorization: CLICKUP_API_TOKEN } }
          );
          
          if (tasksResponse.ok) {
            const tasksData = await tasksResponse.json();
            const tasks = tasksData.tasks || [];
            console.log(`   ${lista.name}: ${tasks.length} tareas`);
            if (tasks.length > 0) {
              console.log(`   └─ Ejemplo: "${tasks[0].name?.substring(0, 50) || 'Sin nombre'}..."`);
            }
          }
        } catch (err) {
          console.log(`   ⚠️  Error obteniendo tareas de ${lista.name}: ${err.message}`);
        }
      }
    } else {
      console.log('⚠️  No se encontraron listas con formato "Nivel X"');
      console.log('\n📋 Todas las listas encontradas:\n');
      listas.forEach(lista => {
        console.log(`   - ${lista.name} (ID: ${lista.id})`);
      });
    }

    console.log('\n💡 Configuración recomendada para .env:\n');
    console.log(`CLICKUP_SPACE_ID=${FOLDER_ID}  # Folder ID donde están las listas`);
    console.log(`CLICKUP_FOLDER_ID=${FOLDER_ID}  # Folder ID específico`);
    console.log(`CLICKUP_TEAM_ID=${TEAM_ID}  # Team ID\n`);

    return {
      folderId: FOLDER_ID,
      teamId: TEAM_ID,
      listas: listasNiveles
    };
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

obtenerListasFrases();

