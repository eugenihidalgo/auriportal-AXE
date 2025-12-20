// scripts/init-ui-home-main-v1.js
// Script de inicialización para Screen home_main_v1 y Theme aurora_base v1
//
// Este script crea:
// 1. Screen home_main_v1 basado en pantalla1.html y pantalla2.html
// 2. Theme aurora_base v1 con tokens básicos
// 3. Configuración ui_active_config para beta
//
// Ejecutar: node scripts/init-ui-home-main-v1.js

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import getDefaultUIScreenRepo from '../src/infra/repos/ui-screen-repo-pg.js';
import getDefaultUIThemeRepo from '../src/infra/repos/ui-theme-repo-pg.js';
import getDefaultUIActiveConfigRepo from '../src/infra/repos/ui-active-config-repo-pg.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar HTML de pantalla1 y pantalla2
const pantalla1Path = join(__dirname, '..', 'src', 'core', 'html', 'pantalla1.html');
const pantalla2Path = join(__dirname, '..', 'src', 'core', 'html', 'pantalla2.html');
const pantalla1Html = readFileSync(pantalla1Path, 'utf-8');
const pantalla2Html = readFileSync(pantalla2Path, 'utf-8');

// Definición de la Screen home_main_v1
// La pantalla principal combina pantalla1 y pantalla2 según el estado
// Por ahora, usamos pantalla1 como base (se puede extender después)
const screenDefinition = {
  html: pantalla1Html,
  // Variables dinámicas que se reemplazarán en el renderizado
  variables: [
    'TEMA_PREFERIDO',
    'IMAGEN_AURI',
    'STREAK',
    'FRASE_MOTIVACIONAL',
    'URL_SI_PRACTICO',
    'URL_FUEGOS_SAGRADOS',
    'NIVEL',
    'NOMBRE_NIVEL',
    'FASE',
    'MENSAJE_PAUSADA'
  ]
};

// Tokens del Theme aurora_base v1
const themeTokens = {
  // Colores básicos
  background: {
    primary: 'var(--bg-primary)',
    secondary: 'var(--bg-card)',
    muted: 'var(--bg-muted, #6c757d)'
  },
  text: {
    primary: 'var(--text-primary)',
    secondary: 'var(--text-muted)',
    accent: 'var(--text-accent)',
    streak: 'var(--text-streak)'
  },
  primary: {
    color: 'var(--gradient-primary)',
    hover: 'var(--gradient-hover)'
  },
  secondary: {
    color: 'var(--text-muted)',
    hover: 'var(--text-accent)'
  },
  // Bordes y radios
  border: {
    radius: {
      sm: 'var(--radius-sm, 8px)',
      md: 'var(--radius-md, 16px)',
      lg: 'var(--radius-lg, 20px)',
      xl: 'var(--radius-xl, 24px)'
    }
  },
  // Sombras
  shadow: {
    sm: 'var(--shadow-sm)',
    md: 'var(--shadow-md)',
    lg: 'var(--shadow-lg)'
  }
};

async function init() {
  console.log('🚀 Inicializando UI & Experience System v1...\n');

  try {
    // 1. Crear Theme aurora_base v1
    console.log('📦 Creando Theme aurora_base v1...');
    const themeRepo = getDefaultUIThemeRepo();
    const theme = await themeRepo.create({
      themeKey: 'aurora_base',
      version: '1',
      tokens: themeTokens,
      status: 'active'
    });
    console.log(`✅ Theme creado: ${theme.theme_key}@${theme.version}\n`);

    // 2. Crear Screen home_main_v1
    console.log('📱 Creando Screen home_main_v1...');
    const screenRepo = getDefaultUIScreenRepo();
    const screen = await screenRepo.create({
      screenKey: 'home_main',
      version: '1',
      definition: screenDefinition,
      status: 'active'
    });
    console.log(`✅ Screen creado: ${screen.screen_key}@${screen.version}\n`);

    // 3. Configurar ui_active_config para beta
    console.log('⚙️  Configurando ui_active_config para beta...');
    const activeConfigRepo = getDefaultUIActiveConfigRepo();
    const config = await activeConfigRepo.upsert({
      env: 'beta',
      activeThemeKey: 'aurora_base',
      activeThemeVersion: '1',
      enabledLayers: [], // Sin layers por ahora
      updatedBy: 'system'
    });
    console.log(`✅ Configuración activa para beta creada\n`);

    console.log('✨ Inicialización completada exitosamente!');
    console.log('\n📋 Resumen:');
    console.log(`   - Theme: aurora_base@1 (status: active)`);
    console.log(`   - Screen: home_main@1 (status: active)`);
    console.log(`   - Config: beta → theme=aurora_base@1, layers=[]`);
    console.log('\n⚠️  Recordatorio: Activar feature flag ui_experience_v1 en beta para usar el sistema');

  } catch (error) {
    console.error('❌ Error durante la inicialización:', error);
    process.exit(1);
  }
}

init();













