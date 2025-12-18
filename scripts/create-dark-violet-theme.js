// scripts/create-dark-violet-theme.js
// Script para crear el tema oscuro violeta diseñado intencionalmente
// Design System Lead - AuriPortal Theme Architecture

import { themeRepository } from '../database/theme-repository.js';
import { validateThemeValues, fillMissingVariables } from '../src/core/theme/theme-contract.js';
import { CONTRACT_DEFAULT } from '../src/core/theme/theme-defaults.js';
import { initPostgreSQL } from '../database/pg.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno
dotenv.config({ path: join(__dirname, '..', '.env') });

// Inicializar PostgreSQL
initPostgreSQL();

/**
 * TEMA OSCURO VIOLETA - Diseño Intencional
 * 
 * FILOSOFÍA DE DISEÑO:
 * - Fondo profundo azul/violeta oscuro (ritual, protector, nocturno)
 * - Paneles elevados con sutiles gradientes violetas
 * - Botones violeta luminosos con buen contraste
 * - Alto contraste sin agresividad
 * - Sensación ritual, protectora, nocturna
 * - Hermano del tema claro, mismo contrato, distinta atmósfera
 * 
 * PALETA DE COLORES:
 * - Fondo base: #0d0b1a (azul/violeta muy oscuro, profundo)
 * - Paneles: #151225 (elevado, sutilmente más claro)
 * - Cards: #1a1629 (aún más elevado, con presencia)
 * - Acentos violeta: #8b5cf6 (violeta luminoso, energético)
 * - Acentos secundarios: #a78bfa (violeta suave, complementario)
 * - Texto: #f1f5f9 (blanco suave, legible)
 * - Aura: Gradiente radial violeta suave
 */
const AURI_DARK_VIOLET_VALUES = {
  // Fondos principales - Profundo azul/violeta oscuro
  '--bg-main': '#0d0b1a',           // Fondo base profundo
  '--bg-primary': '#0d0b1a',         // Fondo principal
  '--bg-panel': '#151225',          // Paneles elevados
  '--bg-card': '#1a1629',           // Cards con presencia
  '--bg-card-active': '#211d35',   // Cards activos (más luminosos)
  '--bg-secondary': '#151225',       // Fondos secundarios
  '--bg-elevated': '#1f1b2e',       // Elementos elevados
  '--bg-section': '#151225',         // Secciones
  
  // Fondos semánticos - Mantener transparencias pero con tono violeta
  '--bg-warning': 'rgba(245, 158, 11, 0.15)',
  '--bg-error': 'rgba(248, 113, 113, 0.15)',
  '--bg-success': 'rgba(16, 185, 129, 0.15)',
  '--bg-info': 'rgba(139, 92, 246, 0.15)',      // Violeta para info
  '--bg-muted': '#6c757d',
  
  // Textos - Alto contraste, legible
  '--text-primary': '#f1f5f9',     // Texto principal (blanco suave)
  '--text-secondary': '#cbd5e1',   // Texto secundario (gris claro)
  '--text-muted': '#94a3b8',        // Texto muted (gris medio)
  '--text-accent': '#a78bfa',       // Acento violeta suave
  '--text-streak': '#8b5cf6',       // Racha en violeta luminoso
  '--text-danger': '#f87171',       // Peligro (rojo suave)
  '--text-success': '#10b981',       // Éxito (verde)
  '--text-warning': '#f59e0b',      // Advertencia (amarillo)
  
  // Bordes - Sutiles, con acentos violeta
  '--border-soft': 'rgba(139, 92, 246, 0.15)',    // Borde suave violeta
  '--border-strong': 'rgba(139, 92, 246, 0.25)',  // Borde fuerte violeta
  '--border-color': 'rgba(139, 92, 246, 0.15)',   // Color de borde
  '--border-accent': 'rgba(139, 92, 246, 0.4)',   // Borde acento
  '--border-focus': '#8b5cf6',                     // Focus violeta luminoso
  '--border-subtle': 'rgba(139, 92, 246, 0.08)',  // Borde sutil
  
  // Acentos - Violeta luminoso y energético
  '--accent-primary': '#8b5cf6',    // Violeta luminoso principal
  '--accent-secondary': '#a78bfa',   // Violeta suave secundario
  '--accent-hover': '#9d7af7',     // Hover (intermedio)
  '--accent-warning': '#f59e0b',   // Advertencia
  '--accent-error': '#f87171',     // Error
  '--accent-success': '#10b981',    // Éxito
  '--accent-danger': '#f87171',    // Peligro
  
  // Sombras - Profundas pero no agresivas
  '--shadow-sm': 'rgba(0, 0, 0, 0.5)',
  '--shadow-md': 'rgba(0, 0, 0, 0.6)',
  '--shadow-lg': 'rgba(0, 0, 0, 0.7)',
  '--shadow-xl': 'rgba(0, 0, 0, 0.8)',
  '--shadow-soft': '0 8px 24px rgba(0, 0, 0, 0.6)',
  
  // Gradientes - Violeta ritual, protector, nocturno
  '--gradient-primary': 'linear-gradient(135deg, #8b5cf6, #7c3aed)',      // Botón principal
  '--gradient-hover': 'linear-gradient(135deg, #9d7af7, #8b5cf6)',        // Hover
  '--gradient-header': 'linear-gradient(135deg, #7c3aed, #6d28d9)',        // Header
  '--header-bg': 'linear-gradient(135deg, #7c3aed, #6d28d9)',             // Header bg
  '--aura-gradient': 'radial-gradient(circle, rgba(139, 92, 246, 0.2) 0%, rgba(124, 58, 237, 0.15) 40%, transparent 70%)',  // Aura violeta suave
  '--gradient-accordion': 'linear-gradient(135deg, #1a1629, #211d35)',   // Accordion
  '--gradient-accordion-hover': 'linear-gradient(135deg, #211d35, #2a253d)', // Accordion hover
  '--gradient-success': 'linear-gradient(135deg, #10b981, #059669)',     // Éxito
  '--gradient-error': 'linear-gradient(135deg, #f87171, #ef4444)',       // Error
  
  // Badges y estados - Violeta y colores semánticos
  '--badge-bg-active': '#8b5cf6',      // Badge activo violeta
  '--badge-text-active': '#ffffff',    // Texto badge activo
  '--badge-bg-pending': 'rgba(139, 92, 246, 0.2)',  // Badge pendiente
  '--badge-text-pending': '#a78bfa',   // Texto badge pendiente
  '--badge-bg-obligatory': '#f59e0b',  // Badge obligatorio
  '--badge-text-obligatory': '#ffffff', // Texto badge obligatorio
  
  // Inputs - Fondos oscuros con bordes violeta
  '--input-bg': '#1a1629',              // Fondo input
  '--input-border': 'rgba(139, 92, 246, 0.2)',  // Borde input
  '--input-text': '#f1f5f9',            // Texto input
  '--input-focus-border': '#8b5cf6',    // Borde focus violeta
  
  // Botones - Texto blanco sobre gradiente violeta
  '--button-text-color': '#ffffff',     // Texto botón blanco
  
  // Radios - Mismos valores que el tema claro (no cambian)
  '--radius-sm': '12px',
  '--radius-md': '16px',
  '--radius-lg': '20px',
  '--radius-xl': '24px',
  '--radius-full': '9999px',
  
  // Compatibilidad - Mismos valores que bg-card
  '--card-bg': '#1a1629',
  '--card-bg-active': '#211d35'
};

/**
 * Crea el tema oscuro violeta en la base de datos
 */
async function createDarkVioletTheme() {
  try {
    console.log('🎨 [Design System] Creando tema oscuro violeta...');
    
    // 1. Validar valores
    console.log('📋 Validando valores del tema...');
    const validation = validateThemeValues(AURI_DARK_VIOLET_VALUES);
    
    if (!validation.valid) {
      console.warn('⚠️  Variables faltantes o inválidas:', {
        missing: validation.missing,
        invalid: validation.invalid
      });
      
      // Rellenar faltantes desde CONTRACT_DEFAULT
      console.log('🔧 Rellenando variables faltantes desde CONTRACT_DEFAULT...');
      const completeValues = fillMissingVariables(AURI_DARK_VIOLET_VALUES);
      
      // Validar de nuevo
      const revalidation = validateThemeValues(completeValues);
      if (!revalidation.valid) {
        throw new Error(`Tema inválido después de rellenar: ${JSON.stringify(revalidation)}`);
      }
      
      console.log('✅ Tema validado correctamente después de rellenar');
      
      // Usar valores completos
      Object.assign(AURI_DARK_VIOLET_VALUES, completeValues);
    } else {
      console.log('✅ Tema validado correctamente');
    }
    
    // 2. Verificar si el tema ya existe
    const existing = await themeRepository.findByKey('auri-dark-violet');
    if (existing) {
      console.log('⚠️  El tema auri-dark-violet ya existe. Actualizando...');
      
      const updated = await themeRepository.update(existing.id, {
        name: 'Auri Dark Violet',
        description: 'Tema oscuro ritual violeta del AuriPortal. Diseñado intencionalmente como hermano del tema claro, con fondo profundo azul/violeta, paneles elevados, gradientes suaves y botones violeta luminosos. Alto contraste sin agresividad, sensación ritual, protectora y nocturna.',
        values: AURI_DARK_VIOLET_VALUES,
        status: 'active'
      });
      
      if (updated) {
        console.log('✅ Tema actualizado correctamente');
        console.log(`   ID: ${updated.id}`);
        console.log(`   Key: ${updated.key}`);
        console.log(`   Name: ${updated.name}`);
        return updated;
      } else {
        throw new Error('No se pudo actualizar el tema');
      }
    }
    
    // 3. Crear tema en BD
    console.log('💾 Registrando tema en base de datos...');
    const theme = await themeRepository.create({
      key: 'auri-dark-violet',
      name: 'Auri Dark Violet',
      description: 'Tema oscuro ritual violeta del AuriPortal. Diseñado intencionalmente como hermano del tema claro, con fondo profundo azul/violeta, paneles elevados, gradientes suaves y botones violeta luminosos. Alto contraste sin agresividad, sensación ritual, protectora y nocturna.',
      contractVersion: 'v1',
      values: AURI_DARK_VIOLET_VALUES,
      source: 'custom',
      meta: {
        designedBy: 'Design System Lead',
        designDate: new Date().toISOString().split('T')[0],
        designPhilosophy: 'Tema oscuro ritual violeta, hermano del tema claro, mismo contrato, distinta atmósfera',
        colorPalette: {
          base: '#0d0b1a',
          panels: '#151225',
          cards: '#1a1629',
          accent: '#8b5cf6',
          accentSecondary: '#a78bfa'
        },
        atmosphere: 'ritual, protector, nocturno',
        contrast: 'alto contraste sin agresividad'
      },
      status: 'active'
    });
    
    console.log('✅ Tema creado correctamente');
    console.log(`   ID: ${theme.id}`);
    console.log(`   Key: ${theme.key}`);
    console.log(`   Name: ${theme.name}`);
    console.log(`   Source: ${theme.source}`);
    console.log(`   Status: ${theme.status}`);
    console.log(`   Variables: ${Object.keys(AURI_DARK_VIOLET_VALUES).length}`);
    
    return theme;
    
  } catch (error) {
    console.error('❌ Error creando tema oscuro violeta:', error);
    throw error;
  }
}

// Ejecutar si se llama directamente
const isMainModule = import.meta.url === `file://${process.argv[1]}` || 
                      process.argv[1] && process.argv[1].endsWith('create-dark-violet-theme.js');

if (isMainModule) {
  // Esperar un momento para que PostgreSQL se inicialice
  setTimeout(() => {
    createDarkVioletTheme()
      .then(() => {
        console.log('\n🎉 Tema oscuro violeta creado exitosamente');
        process.exit(0);
      })
      .catch((error) => {
        console.error('\n💥 Error fatal:', error);
        process.exit(1);
      });
  }, 1000);
}

export { createDarkVioletTheme, AURI_DARK_VIOLET_VALUES };

