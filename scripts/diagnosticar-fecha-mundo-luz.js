// scripts/diagnosticar-fecha-mundo-luz.js
// Script para diagnosticar por qué no se obtiene la fecha correcta de Mundo de Luz

import { obtenerDatosCompletosPersona } from '../src/services/kajabi.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const OFERTAS_MUNDO_DE_LUZ_TOKENS = [
  "uriUhsHt",
  "qibUv2Fu", 
  "bgLUBFjc",
  "L8wjafVK",
  "r9LbHwqk"
];

async function diagnosticar(email) {
  console.log(`🔍 Diagnosticando fecha de Mundo de Luz para: ${email}\n`);
  
  try {
    // Primero, buscar todos los contactos similares
    console.log('📋 Buscando contactos similares...\n');
    const { buscarPersonaPorEmail } = await import('../src/services/kajabi.js');
    const contacto = await buscarPersonaPorEmail(
      email,
      process.env.KAJABI_CLIENT_ID,
      process.env.KAJABI_CLIENT_SECRET
    );
    
    if (!contacto) {
      console.log(`❌ No se encontró contacto para ${email}`);
      return;
    }
    
    console.log(`✅ Contacto encontrado: ${contacto.email} (ID: ${contacto.id})\n`);
    
    const datos = await obtenerDatosCompletosPersona(
      contacto.email, // Usar el email encontrado
      process.env.KAJABI_CLIENT_ID,
      process.env.KAJABI_CLIENT_SECRET
    );
    
    console.log('📊 DATOS OBTENIDOS:');
    console.log('='.repeat(80));
    console.log(`Email: ${datos.email}`);
    console.log(`Nombre: ${datos.nombre || 'N/A'}`);
    console.log(`Fecha compra Mundo de Luz: ${datos.fechaCompraMundoDeLuz || 'NO ENCONTRADA'}`);
    console.log(`Tiene acceso: ${datos.tieneAcceso ? 'SÍ' : 'NO'}`);
    
    console.log(`\n📦 COMPRAS (${datos.compras?.length || 0}):`);
    if (datos.compras && datos.compras.length > 0) {
      for (const compra of datos.compras) {
        console.log(`\n   Compra:`);
        console.log(`     ID: ${compra.id || 'N/A'}`);
        console.log(`     Nombre: ${compra.product_name || compra.course_name || compra.name || compra.title || 'N/A'}`);
        console.log(`     Token: ${compra.offer_token || compra.offer_data?.attributes?.token || compra.offer_data?.token || 'N/A'}`);
        console.log(`     Fecha: ${compra.created_at || compra.purchased_at || compra.date || compra.purchase_date || compra.purchased_on || 'N/A'}`);
        console.log(`     JSON completo: ${JSON.stringify(compra, null, 2).substring(0, 500)}`);
        
        const tokenCompra = compra.offer_token || 
                           compra.offer_data?.attributes?.token || 
                           compra.offer_data?.token || "";
        const nombreCompra = (compra.product_name || 
                             compra.course_name || 
                             compra.name || 
                             compra.title || 
                             compra.offer_data?.attributes?.title ||
                             compra.offer_data?.title || "").toLowerCase();
        
        const esMundoDeLuz = OFERTAS_MUNDO_DE_LUZ_TOKENS.includes(tokenCompra) ||
                             nombreCompra.includes("mundo de luz") || 
                             nombreCompra.includes("plataforma de desarrollo espiritual") ||
                             nombreCompra.includes("pde");
        
        if (esMundoDeLuz) {
          console.log(`     ✅ ESTA ES UNA COMPRA DE MUNDO DE LUZ`);
        } else {
          console.log(`     ❌ NO es Mundo de Luz (token: "${tokenCompra}", nombre: "${nombreCompra}")`);
        }
      }
    } else {
      console.log(`   ⚠️  No hay compras`);
    }
    
    console.log(`\n🎁 OFERTAS (${datos.ofertas?.length || 0}):`);
    if (datos.ofertas && datos.ofertas.length > 0) {
      for (const oferta of datos.ofertas) {
        console.log(`\n   Oferta:`);
        console.log(`     ID: ${oferta.id || oferta.offer_id || 'N/A'}`);
        console.log(`     Nombre: ${oferta.product_name || oferta.course_name || oferta.name || oferta.title || oferta.attributes?.title || 'N/A'}`);
        console.log(`     Token: ${oferta.token || oferta.attributes?.token || oferta.attributes?.attributes?.token || 'N/A'}`);
        console.log(`     Fecha: ${oferta.created_at || oferta.started_at || oferta.date || oferta.started_on || oferta.activated_at || oferta.attributes?.created_at || oferta.attributes?.started_at || 'N/A'}`);
        console.log(`     JSON completo: ${JSON.stringify(oferta, null, 2).substring(0, 500)}`);
        
        const token = oferta.token || 
                     oferta.attributes?.token || 
                     oferta.attributes?.attributes?.token || "";
        const titulo = (oferta.product_name || 
                       oferta.course_name || 
                       oferta.name || 
                       oferta.title || 
                       oferta.attributes?.title || 
                       oferta.attributes?.attributes?.title || "").toLowerCase();
        
        const esMundoDeLuz = OFERTAS_MUNDO_DE_LUZ_TOKENS.includes(token) ||
                             titulo.includes("mundo de luz") ||
                             titulo.includes("plataforma de desarrollo espiritual");
        
        if (esMundoDeLuz) {
          console.log(`     ✅ ESTA ES UNA OFERTA DE MUNDO DE LUZ`);
        } else {
          console.log(`     ❌ NO es Mundo de Luz (token: "${token}", título: "${titulo}")`);
        }
      }
    } else {
      console.log(`   ⚠️  No hay ofertas`);
    }
    
    console.log('\n' + '='.repeat(80));
    console.log(`\n🎯 TOKENS BUSCADOS: ${OFERTAS_MUNDO_DE_LUZ_TOKENS.join(', ')}`);
    console.log(`\n💡 Si ves ofertas/compras con tokens diferentes que deberían ser Mundo de Luz,`);
    console.log(`   necesitamos añadir esos tokens a la lista.`);
    
  } catch (err) {
    console.error('❌ Error:', err);
  }
}

// Buscar email de Eugeni o usar el proporcionado
const email = process.argv[2] || 'eugeni@eugenihidalgo.work';

diagnosticar(email)
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });

