// scripts/obtener-clickup-space-id.js
// Obtiene el SPACE_ID de ClickUp necesario para sincronizar frases

import dotenv from 'dotenv';
dotenv.config();

const CLICKUP_API_TOKEN = process.env.CLICKUP_API_TOKEN;
const CLICKUP_API_BASE = "https://api.clickup.com/api/v2";

async function obtenerSpaceId() {
  if (!CLICKUP_API_TOKEN) {
    console.error('❌ CLOUDFLARE_API_TOKEN no configurado');
    process.exit(1);
  }

  try {
    // Obtener todos los espacios
    const response = await fetch(`${CLICKUP_API_BASE}/team`, {
      headers: { Authorization: CLICKUP_API_TOKEN }
    });

    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }

    const data = await response.json();
    const teams = data.teams || [];

    if (teams.length === 0) {
      console.error('❌ No se encontraron teams en ClickUp');
      process.exit(1);
    }

    // Obtener espacios del primer team
    const teamId = teams[0].id;
    console.log(`📋 Team ID: ${teamId}`);

    const spacesResponse = await fetch(`${CLICKUP_API_BASE}/team/${teamId}/space?archived=false`, {
      headers: { Authorization: CLICKUP_API_TOKEN }
    });

    if (!spacesResponse.ok) {
      throw new Error(`Error obteniendo espacios: ${spacesResponse.status}`);
    }

    const spacesData = await spacesResponse.json();
    const spaces = spacesData.spaces || [];

    console.log(`\n📦 Espacios encontrados (${spaces.length}):\n`);
    spaces.forEach((space, index) => {
      console.log(`${index + 1}. ${space.name}`);
      console.log(`   ID: ${space.id}`);
      console.log(`   Privado: ${space.private ? 'Sí' : 'No'}`);
      console.log('');
    });

    // Buscar espacio que contenga "PDE" o "Aurelín"
    const espacioPDE = spaces.find(s => 
      s.name.toLowerCase().includes('pde') || 
      s.name.toLowerCase().includes('aurelín') ||
      s.name.toLowerCase().includes('aurelin')
    );

    if (espacioPDE) {
      console.log(`✅ Espacio encontrado: ${espacioPDE.name}`);
      console.log(`   SPACE_ID: ${espacioPDE.id}\n`);
      
      // Obtener listas de este espacio
      const listasResponse = await fetch(`${CLICKUP_API_BASE}/space/${espacioPDE.id}/list?archived=false`, {
        headers: { Authorization: CLICKUP_API_TOKEN }
      });

      if (listasResponse.ok) {
        const listasData = await listasResponse.json();
        const listas = listasData.lists || [];
        
        console.log(`📋 Listas encontradas (${listas.length}):\n`);
        const listasNiveles = listas.filter(l => /^Nivel\s+\d+$/i.test(l.name || ''));
        
        if (listasNiveles.length > 0) {
          console.log('✅ Listas de niveles encontradas:');
          listasNiveles.forEach(lista => {
            const nivel = lista.name.match(/\d+/)?.[0] || '?';
            console.log(`   - ${lista.name} (ID: ${lista.id}) → Nivel ${nivel}`);
          });
        } else {
          console.log('⚠️  No se encontraron listas con formato "Nivel X"');
          console.log('\n📋 Todas las listas:');
          listas.slice(0, 10).forEach(lista => {
            console.log(`   - ${lista.name} (ID: ${lista.id})`);
          });
        }
      }

      console.log(`\n💡 Agrega esto a tu .env:`);
      console.log(`CLICKUP_SPACE_ID=${espacioPDE.id}\n`);
      
      return espacioPDE.id;
    } else {
      console.log('⚠️  No se encontró un espacio específico de PDE/Aurelín');
      console.log('   Usando el primer espacio disponible\n');
      console.log(`💡 Agrega esto a tu .env:`);
      console.log(`CLICKUP_SPACE_ID=${spaces[0].id}\n`);
      return spaces[0].id;
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

obtenerSpaceId();

