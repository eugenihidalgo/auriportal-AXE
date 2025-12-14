// src/services/sync-frases-clickup.js
// Sincronizador diario de frases desde ClickUp a PostgreSQL
// ClickUp es solo entorno creativo, PostgreSQL es la fuente de verdad operativa

import { CLICKUP } from "../config/config.js";
import { clickup } from "./clickup.js";
import { frases } from "../../database/pg.js";

/**
 * Sincroniza todas las frases desde ClickUp a PostgreSQL
 * 
 * Proceso:
 * 1. Lee listas "Nivel 1", "Nivel 2", ... "Nivel 15" de ClickUp
 * 2. Por cada tarea:
 *    - Obtiene título (texto de la frase)
 *    - Obtiene ID (clickup_task_id)
 *    - Determina nivel según lista
 * 3. En PostgreSQL:
 *    - Inserta nuevas frases
 *    - Actualiza frases existentes
 *    - Actualiza nivel si cambió la lista
 *    - Elimina frases que desaparecieron de ClickUp
 */
export async function sincronizarFrasesClickUpAPostgreSQL(env) {
  console.log('🔄 Iniciando sincronización de frases ClickUp → PostgreSQL...');

  try {
    // Obtener todas las listas del espacio/workspace de ClickUp
    // Asumimos que las listas se llaman "Nivel 1", "Nivel 2", etc.
    const listas = await obtenerListasNiveles(env);
    
    if (!listas || listas.length === 0) {
      console.warn('⚠️  No se encontraron listas de niveles en ClickUp');
      return { success: false, error: 'No se encontraron listas' };
    }

    console.log(`📋 Encontradas ${listas.length} listas de niveles`);

    // Obtener todas las frases actuales de PostgreSQL para comparar
    const frasesActuales = await frases.getAll();
    const frasesClickUpIds = new Set();

    let frasesNuevas = 0;
    let frasesActualizadas = 0;
    let errores = 0;

    // Procesar cada lista
    for (const lista of listas) {
      const nivel = extraerNivelDeLista(lista.name);
      if (!nivel || nivel < 1 || nivel > 15) {
        console.warn(`⚠️  Lista "${lista.name}" no tiene nivel válido (${nivel}), saltando...`);
        continue;
      }

      console.log(`📝 Procesando lista "${lista.name}" (Nivel ${nivel})...`);

      try {
        // Obtener todas las tareas de esta lista
        const tasks = await clickup.getTasks(env, lista.id, { archived: false, page: 0 });
        
        // Procesar todas las páginas
        let page = 0;
        let hasMore = true;

        while (hasMore) {
          const tasksPage = await clickup.getTasks(env, lista.id, { archived: false, page });
          
          if (tasksPage.length === 0) {
            hasMore = false;
            break;
          }

          for (const task of tasksPage) {
            try {
              const fraseTexto = task.name || task.text || '';
              const clickupTaskId = task.id;

              if (!fraseTexto || !clickupTaskId) {
                console.warn(`⚠️  Tarea sin texto o ID, saltando: ${task.id}`);
                continue;
              }

              // Marcar que esta frase existe en ClickUp
              frasesClickUpIds.add(clickupTaskId);

              // Buscar si ya existe en PostgreSQL
              const fraseExistente = frasesActuales.find(f => f.clickup_task_id === clickupTaskId);

              if (fraseExistente) {
                // Actualizar si cambió el nivel o el texto
                if (fraseExistente.nivel !== nivel || fraseExistente.frase !== fraseTexto) {
                  await frases.upsert({
                    nivel,
                    frase: fraseTexto,
                    clickup_task_id: clickupTaskId,
                    origen: 'clickup'
                  });
                  frasesActualizadas++;
                  console.log(`   ✅ Actualizada frase: "${fraseTexto.substring(0, 50)}..." (Nivel ${nivel})`);
                }
              } else {
                // Nueva frase
                await frases.upsert({
                  nivel,
                  frase: fraseTexto,
                  clickup_task_id: clickupTaskId,
                  origen: 'clickup'
                });
                frasesNuevas++;
                console.log(`   ➕ Nueva frase: "${fraseTexto.substring(0, 50)}..." (Nivel ${nivel})`);
              }
            } catch (err) {
              console.error(`   ❌ Error procesando tarea ${task.id}:`, err.message);
              errores++;
            }
          }

          // Si hay menos de 100 tareas, no hay más páginas
          if (tasksPage.length < 100) {
            hasMore = false;
          } else {
            page++;
          }
        }
      } catch (err) {
        console.error(`❌ Error procesando lista "${lista.name}":`, err.message);
        errores++;
      }
    }

    // Eliminar frases que ya no existen en ClickUp
    let frasesEliminadas = 0;
    for (const frase of frasesActuales) {
      if (frase.clickup_task_id && !frasesClickUpIds.has(frase.clickup_task_id)) {
        await frases.deleteByClickUpTaskId(frase.clickup_task_id);
        frasesEliminadas++;
        console.log(`   🗑️  Eliminada frase obsoleta: "${frase.frase.substring(0, 50)}..."`);
      }
    }

    console.log(`✅ Sincronización completada:`);
    console.log(`   ➕ Nuevas: ${frasesNuevas}`);
    console.log(`   🔄 Actualizadas: ${frasesActualizadas}`);
    console.log(`   🗑️  Eliminadas: ${frasesEliminadas}`);
    console.log(`   ❌ Errores: ${errores}`);

    return {
      success: true,
      nuevas: frasesNuevas,
      actualizadas: frasesActualizadas,
      eliminadas: frasesEliminadas,
      errores
    };
  } catch (error) {
    console.error('❌ Error en sincronización de frases:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Obtiene todas las listas de niveles de ClickUp desde la carpeta específica
 * Carpeta: https://app.clickup.com/9012227922/v/f/90128582162/90121143321
 */
async function obtenerListasNiveles(env) {
  try {
    // Obtener listas desde folder específico (90128582162)
    const folderId = process.env.CLICKUP_FOLDER_ID || CLICKUP.FOLDER_ID;
    
    if (!folderId) {
      throw new Error('CLICKUP_FOLDER_ID no configurado. Debe ser 90128582162');
    }

    console.log(`📁 Obteniendo listas desde folder: ${folderId}`);
    
    // Obtener listas desde folder
    const url = `${CLICKUP.API_BASE}/folder/${folderId}/list?archived=false`;
    
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: env.CLICKUP_API_TOKEN }
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Error obteniendo listas desde folder: ${res.status} - ${errorText}`);
    }

    const data = await res.json();
    const listas = data.lists || [];
    
    console.log(`📋 Encontradas ${listas.length} listas en el folder`);

    // Filtrar solo las listas que corresponden a niveles
    // Acepta tanto "Nivel" como "Nivell" (catalán) y puede tener texto adicional después
    // Ejemplo: "Nivel 1", "Nivell 1", "Nivel 1: inicial", "Nivell 2: sanación"
    const listasNiveles = listas.filter(lista => {
      const nombre = lista.name || '';
      // Buscar patrones como "Nivel X" o "Nivell X" (con o sin texto adicional)
      return /^Nivell?\s+\d+/i.test(nombre.trim());
    });

    if (listasNiveles.length === 0) {
      console.warn('⚠️  No se encontraron listas de niveles en el folder. Listas encontradas:');
      listas.forEach(lista => console.warn(`   - ${lista.name} (ID: ${lista.id})`));
      throw new Error('No se encontraron listas de niveles en el folder especificado');
    }

    console.log(`✅ Encontradas ${listasNiveles.length} listas de niveles:`);
    listasNiveles.forEach(lista => console.log(`   - ${lista.name} (Nivel ${extraerNivelDeLista(lista.name)})`));

    return listasNiveles;
  } catch (error) {
    console.error('❌ Error obteniendo listas de ClickUp:', error);
    throw error;
  }
}


/**
 * Extrae el nivel numérico del nombre de una lista
 * Ejemplo: "Nivel 5" → 5, "Nivell 1: inicial" → 1
 */
function extraerNivelDeLista(nombreLista) {
  if (!nombreLista) return null;
  
  // Acepta tanto "Nivel" como "Nivell" (catalán)
  const match = nombreLista.match(/nivell?\s+(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

