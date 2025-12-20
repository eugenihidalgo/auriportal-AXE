// Script para ejecutar la migración de columnas de la Fase 1
// Ejecutar: node scripts/migrate-fase1-columns.js

import { initPostgreSQL, query } from '../database/pg.js';

async function migrateColumns() {
  try {
    console.log('🔄 Iniciando migración de columnas Fase 1...');
    
    initPostgreSQL();
    
    // Esperar un momento para que se establezca la conexión
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // A) Migración: Añadir nuevos campos a preparaciones_practica
    console.log('📝 Añadiendo campos a preparaciones_practica...');
    await query(`
      DO $$
      BEGIN
        -- Añadir campo tipo
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='preparaciones_practica' AND column_name='tipo') THEN
          ALTER TABLE preparaciones_practica ADD COLUMN tipo VARCHAR(20) DEFAULT 'consigna';
          RAISE NOTICE 'Campo tipo añadido';
        END IF;
        
        -- Añadir campo posicion
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='preparaciones_practica' AND column_name='posicion') THEN
          ALTER TABLE preparaciones_practica ADD COLUMN posicion VARCHAR(20) DEFAULT 'inicio';
          RAISE NOTICE 'Campo posicion añadido';
        END IF;
        
        -- Añadir campo orden
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='preparaciones_practica' AND column_name='orden') THEN
          ALTER TABLE preparaciones_practica ADD COLUMN orden INT DEFAULT 0;
          RAISE NOTICE 'Campo orden añadido';
        END IF;
        
        -- Añadir campo obligatoria_global
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='preparaciones_practica' AND column_name='obligatoria_global') THEN
          ALTER TABLE preparaciones_practica ADD COLUMN obligatoria_global BOOLEAN DEFAULT false;
          RAISE NOTICE 'Campo obligatoria_global añadido';
        END IF;
        
        -- Añadir campo obligatoria_por_nivel
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='preparaciones_practica' AND column_name='obligatoria_por_nivel') THEN
          ALTER TABLE preparaciones_practica ADD COLUMN obligatoria_por_nivel JSONB DEFAULT '{}';
          RAISE NOTICE 'Campo obligatoria_por_nivel añadido';
        END IF;
        
        -- Añadir campo minutos
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='preparaciones_practica' AND column_name='minutos') THEN
          ALTER TABLE preparaciones_practica ADD COLUMN minutos INT DEFAULT NULL;
          RAISE NOTICE 'Campo minutos añadido';
        END IF;
        
        -- Añadir campo tiene_video
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='preparaciones_practica' AND column_name='tiene_video') THEN
          ALTER TABLE preparaciones_practica ADD COLUMN tiene_video BOOLEAN DEFAULT false;
          RAISE NOTICE 'Campo tiene_video añadido';
        END IF;
        
        -- Añadir campo contenido_html
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='preparaciones_practica' AND column_name='contenido_html') THEN
          ALTER TABLE preparaciones_practica ADD COLUMN contenido_html TEXT DEFAULT NULL;
          RAISE NOTICE 'Campo contenido_html añadido';
        END IF;
      END $$;
    `);
    console.log('✅ Campos añadidos/verificados en preparaciones_practica');

    // B) Migración: Añadir nuevos campos a tecnicas_post_practica
    console.log('📝 Añadiendo campos a tecnicas_post_practica...');
    await query(`
      DO $$
      BEGIN
        -- Añadir campo tipo
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='tecnicas_post_practica' AND column_name='tipo') THEN
          ALTER TABLE tecnicas_post_practica ADD COLUMN tipo VARCHAR(20) DEFAULT 'consigna';
          RAISE NOTICE 'Campo tipo añadido';
        END IF;
        
        -- Añadir campo posicion
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='tecnicas_post_practica' AND column_name='posicion') THEN
          ALTER TABLE tecnicas_post_practica ADD COLUMN posicion VARCHAR(20) DEFAULT 'inicio';
          RAISE NOTICE 'Campo posicion añadido';
        END IF;
        
        -- Añadir campo orden
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='tecnicas_post_practica' AND column_name='orden') THEN
          ALTER TABLE tecnicas_post_practica ADD COLUMN orden INT DEFAULT 0;
          RAISE NOTICE 'Campo orden añadido';
        END IF;
        
        -- Añadir campo obligatoria_global
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='tecnicas_post_practica' AND column_name='obligatoria_global') THEN
          ALTER TABLE tecnicas_post_practica ADD COLUMN obligatoria_global BOOLEAN DEFAULT false;
          RAISE NOTICE 'Campo obligatoria_global añadido';
        END IF;
        
        -- Añadir campo obligatoria_por_nivel
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='tecnicas_post_practica' AND column_name='obligatoria_por_nivel') THEN
          ALTER TABLE tecnicas_post_practica ADD COLUMN obligatoria_por_nivel JSONB DEFAULT '{}';
          RAISE NOTICE 'Campo obligatoria_por_nivel añadido';
        END IF;
        
        -- Añadir campo minutos
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='tecnicas_post_practica' AND column_name='minutos') THEN
          ALTER TABLE tecnicas_post_practica ADD COLUMN minutos INT DEFAULT NULL;
          RAISE NOTICE 'Campo minutos añadido';
        END IF;
        
        -- Añadir campo tiene_video
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='tecnicas_post_practica' AND column_name='tiene_video') THEN
          ALTER TABLE tecnicas_post_practica ADD COLUMN tiene_video BOOLEAN DEFAULT false;
          RAISE NOTICE 'Campo tiene_video añadido';
        END IF;
        
        -- Añadir campo contenido_html
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='tecnicas_post_practica' AND column_name='contenido_html') THEN
          ALTER TABLE tecnicas_post_practica ADD COLUMN contenido_html TEXT DEFAULT NULL;
          RAISE NOTICE 'Campo contenido_html añadido';
        END IF;
      END $$;
    `);
    console.log('✅ Campos añadidos/verificados en tecnicas_post_practica');

    // C) Migración: Añadir campo tema_preferido a alumnos
    console.log('📝 Añadiendo campo tema_preferido a alumnos...');
    await query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='alumnos' AND column_name='tema_preferido') THEN
          ALTER TABLE alumnos ADD COLUMN tema_preferido VARCHAR(20) DEFAULT 'light';
          RAISE NOTICE 'Campo tema_preferido añadido';
        END IF;
      END $$;
    `);
    console.log('✅ Campo tema_preferido añadido/verificado en alumnos');

    console.log('✅ Migración completada exitosamente');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error en la migración:', error);
    process.exit(1);
  }
}

migrateColumns();



















