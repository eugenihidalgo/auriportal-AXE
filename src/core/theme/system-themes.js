// system-themes.js
// Definiciones canónicas de temas del sistema - Theme Definitions v1
// 
// IMPORTANTE: Este archivo es la fuente de verdad para el Theme Resolver.
// Los valores deben mantenerse alineados con public/css/theme-variables.css
// aunque pueden divergir temporalmente durante actualizaciones.
//
// ESTRATEGIA: Opción B (JS canónico) elegida por robustez y fail-open absoluto.
// Si en el futuro se requiere parsear CSS dinámicamente, puede refactorizarse
// manteniendo esta interfaz del registry.

/**
 * Definición completa del tema light-classic
 * Valores extraídos de :root en theme-variables.css
 */
export const LIGHT_CLASSIC_DEFINITION = {
  key: 'light-classic',
  name: 'Light Classic',
  contractVersion: 'v1',
  values: {
    // Fondos principales
    '--bg-main': '#faf7f2',
    '--bg-primary': '#faf7f2',
    '--bg-panel': '#ffffff',
    '--bg-card': '#ffffff',
    '--bg-card-active': '#fff9e6',
    '--bg-secondary': '#ffffff',
    '--bg-elevated': '#fffef8',
    '--bg-section': '#ffffff',
    
    // Fondos semánticos
    '--bg-warning': 'rgba(255, 193, 7, 0.1)',
    '--bg-error': 'rgba(220, 38, 38, 0.1)',
    '--bg-success': 'rgba(16, 185, 129, 0.1)',
    '--bg-info': 'rgba(59, 130, 246, 0.1)',
    '--bg-muted': '#6c757d',
    
    // Textos
    '--text-primary': '#333333',
    '--text-secondary': '#666666',
    '--text-muted': '#8a6b00',
    '--text-accent': '#5a3c00',
    '--text-streak': '#c49000',
    '--text-danger': '#dc2626',
    '--text-success': '#10b981',
    '--text-warning': '#ffc107',
    
    // Bordes
    '--border-soft': '#e3d2b8',
    '--border-strong': '#d4c4a8',
    '--border-color': '#e3d2b8',
    '--border-accent': '#ffd86b',
    '--border-focus': '#ffcd4a',
    '--border-subtle': 'rgba(227, 210, 184, 0.3)',
    
    // Acentos
    '--accent-primary': '#ffd86b',
    '--accent-secondary': '#ffcd4a',
    '--accent-hover': '#ffe395',
    '--accent-warning': '#f59e0b',
    '--accent-error': '#dc2626',
    '--accent-success': '#10b981',
    '--accent-danger': '#dc2626',
    
    // Sombras
    '--shadow-sm': 'rgba(0, 0, 0, 0.08)',
    '--shadow-md': 'rgba(0, 0, 0, 0.12)',
    '--shadow-lg': 'rgba(0, 0, 0, 0.15)',
    '--shadow-xl': 'rgba(0, 0, 0, 0.2)',
    '--shadow-soft': '0 8px 24px rgba(0, 0, 0, 0.5)',
    
    // Gradientes
    '--gradient-primary': 'linear-gradient(135deg, #ffd86b, #ffcd4a)',
    '--gradient-hover': 'linear-gradient(135deg, #ffe395, #ffda5a)',
    '--gradient-header': 'linear-gradient(135deg, #ffd86b, #ffcd4a)',
    '--header-bg': 'linear-gradient(135deg, #ffd86b, #ffcd4a)',
    '--aura-gradient': 'radial-gradient(circle, #ffe9a8 0%, #f8d56d 40%, transparent 70%)',
    '--gradient-accordion': 'linear-gradient(135deg, #fff8e1, #fff3c4)',
    '--gradient-accordion-hover': 'linear-gradient(135deg, #fff3c4, #ffd86b)',
    '--gradient-success': 'linear-gradient(135deg, #22c55e, #16a34a)',
    '--gradient-error': 'linear-gradient(135deg, #ff0000, #cc0000)',
    
    // Badges y estados
    '--badge-bg-active': '#ffd86b',
    '--badge-text-active': '#5a3c00',
    '--badge-bg-pending': '#fef3c7',
    '--badge-text-pending': '#92400e',
    '--badge-bg-obligatory': '#fbbf24',
    '--badge-text-obligatory': '#78350f',
    
    // Inputs
    '--input-bg': '#ffffff',
    '--input-border': '#e3d2b8',
    '--input-text': '#333333',
    '--input-focus-border': '#ffd86b',
    
    // Botones
    '--button-text-color': '#333333',
    
    // Radios
    '--radius-sm': '12px',
    '--radius-md': '16px',
    '--radius-lg': '20px',
    '--radius-xl': '24px',
    '--radius-full': '9999px',
    
    // Compatibilidad
    '--card-bg': '#fff9e6',
    '--card-bg-active': '#fff5d6'
  },
  meta: {
    description: 'Tema claro clásico de AuriPortal con identidad dorada original',
    source: 'theme-variables.css :root',
    createdAt: '2024-01-01'
  }
};

/**
 * Definición completa del tema auri-classic
 * Tema visual actual extraído de pantalla1.html (Ritual Diario)
 * Valores extraídos fielmente de :root en theme-variables.css
 * Este es el tema visual actual que se muestra en la pantalla cliente
 * y que NO debe cambiar visualmente al aplicar esta definición.
 */
export const AURI_CLASSIC_DEFINITION = {
  key: 'auri-classic',
  name: 'Auri Classic',
  contractVersion: 'v1',
  values: {
    // Fondos principales
    '--bg-main': '#faf7f2',
    '--bg-primary': '#faf7f2',
    '--bg-panel': '#ffffff',
    '--bg-card': '#ffffff',
    '--bg-card-active': '#fff9e6',
    '--bg-secondary': '#ffffff',
    '--bg-elevated': '#fffef8',
    '--bg-section': '#ffffff',
    
    // Fondos semánticos
    '--bg-warning': 'rgba(255, 193, 7, 0.1)',
    '--bg-error': 'rgba(220, 38, 38, 0.1)',
    '--bg-success': 'rgba(16, 185, 129, 0.1)',
    '--bg-info': 'rgba(59, 130, 246, 0.1)',
    '--bg-muted': '#6c757d',
    
    // Textos
    '--text-primary': '#333333',
    '--text-secondary': '#666666',
    '--text-muted': '#8a6b00',
    '--text-accent': '#5a3c00',
    '--text-streak': '#c49000',
    '--text-danger': '#dc2626',
    '--text-success': '#10b981',
    '--text-warning': '#ffc107',
    
    // Bordes
    '--border-soft': '#e3d2b8',
    '--border-strong': '#d4c4a8',
    '--border-color': '#e3d2b8',
    '--border-accent': '#ffd86b',
    '--border-focus': '#ffcd4a',
    '--border-subtle': 'rgba(227, 210, 184, 0.3)',
    
    // Acentos
    '--accent-primary': '#ffd86b',
    '--accent-secondary': '#ffcd4a',
    '--accent-hover': '#ffe395',
    '--accent-warning': '#f59e0b',
    '--accent-error': '#dc2626',
    '--accent-success': '#10b981',
    '--accent-danger': '#dc2626',
    
    // Sombras
    '--shadow-sm': 'rgba(0, 0, 0, 0.08)',
    '--shadow-md': 'rgba(0, 0, 0, 0.12)',
    '--shadow-lg': 'rgba(0, 0, 0, 0.15)',
    '--shadow-xl': 'rgba(0, 0, 0, 0.2)',
    '--shadow-soft': '0 8px 24px rgba(0, 0, 0, 0.5)',
    
    // Gradientes
    '--gradient-primary': 'linear-gradient(135deg, #ffd86b, #ffcd4a)',
    '--gradient-hover': 'linear-gradient(135deg, #ffe395, #ffda5a)',
    '--gradient-header': 'linear-gradient(135deg, #ffd86b, #ffcd4a)',
    '--header-bg': 'linear-gradient(135deg, #ffd86b, #ffcd4a)',
    '--aura-gradient': 'radial-gradient(circle, #ffe9a8 0%, #f8d56d 40%, transparent 70%)',
    '--gradient-accordion': 'linear-gradient(135deg, #fff8e1, #fff3c4)',
    '--gradient-accordion-hover': 'linear-gradient(135deg, #fff3c4, #ffd86b)',
    '--gradient-success': 'linear-gradient(135deg, #22c55e, #16a34a)',
    '--gradient-error': 'linear-gradient(135deg, #ff0000, #cc0000)',
    
    // Badges y estados
    '--badge-bg-active': '#ffd86b',
    '--badge-text-active': '#5a3c00',
    '--badge-bg-pending': '#fef3c7',
    '--badge-text-pending': '#92400e',
    '--badge-bg-obligatory': '#fbbf24',
    '--badge-text-obligatory': '#78350f',
    
    // Inputs
    '--input-bg': '#ffffff',
    '--input-border': '#e3d2b8',
    '--input-text': '#333333',
    '--input-focus-border': '#ffd86b',
    
    // Botones
    '--button-text-color': '#333333',
    
    // Radios
    '--radius-sm': '12px',
    '--radius-md': '16px',
    '--radius-lg': '20px',
    '--radius-xl': '24px',
    '--radius-full': '9999px',
    
    // Compatibilidad
    '--card-bg': '#fff9e6',
    '--card-bg-active': '#fff5d6'
  },
  meta: {
    description: 'Tema visual actual de AuriPortal extraído de pantalla1.html (Ritual Diario). Identidad dorada original con fondos cálidos y acentos dorados. Este tema representa el look & feel actual de la pantalla cliente.',
    source: 'theme-variables.css :root (extraído de pantalla1.html)',
    createdAt: '2024-12-19',
    extractedFrom: 'pantalla1.html - Ritual Diario'
  }
};

/**
 * Definición completa del tema dark-classic
 * Valores extraídos de body.theme-dark en theme-variables.css
 */
export const DARK_CLASSIC_DEFINITION = {
  key: 'dark-classic',
  name: 'Dark Classic',
  contractVersion: 'v1',
  values: {
    // Fondos principales
    '--bg-main': '#0a0e1a',
    '--bg-primary': '#0a0e1a',
    '--bg-panel': '#0f1422',
    '--bg-card': '#141827',
    '--bg-card-active': '#1a1f2e',
    '--bg-secondary': '#0f1422',
    '--bg-elevated': '#141827',
    '--bg-section': '#0f1422',
    
    // Fondos semánticos
    '--bg-warning': 'rgba(245, 158, 11, 0.1)',
    '--bg-error': 'rgba(248, 113, 113, 0.1)',
    '--bg-success': 'rgba(16, 185, 129, 0.1)',
    '--bg-info': 'rgba(99, 102, 241, 0.1)',
    '--bg-muted': '#6c757d',
    
    // Textos
    '--text-primary': '#f1f5f9',
    '--text-secondary': '#cbd5e1',
    '--text-muted': '#94a3b8',
    '--text-accent': '#a78bfa',
    '--text-streak': '#8b5cf6',
    '--text-danger': '#f87171',
    '--text-success': '#10b981',
    '--text-warning': '#f59e0b',
    
    // Bordes
    '--border-soft': 'rgba(255, 255, 255, 0.05)',
    '--border-strong': 'rgba(255, 255, 255, 0.08)',
    '--border-color': 'rgba(255, 255, 255, 0.05)',
    '--border-accent': 'rgba(124, 58, 237, 0.4)',
    '--border-focus': '#6366f1',
    '--border-subtle': 'rgba(255, 255, 255, 0.03)',
    
    // Acentos
    '--accent-primary': '#7c3aed',
    '--accent-secondary': '#6366f1',
    '--accent-hover': '#8b5cf6',
    '--accent-warning': '#f59e0b',
    '--accent-error': '#f87171',
    '--accent-success': '#10b981',
    '--accent-danger': '#f87171',
    
    // Sombras
    '--shadow-sm': 'rgba(0, 0, 0, 0.4)',
    '--shadow-md': 'rgba(0, 0, 0, 0.5)',
    '--shadow-lg': 'rgba(0, 0, 0, 0.6)',
    '--shadow-xl': 'rgba(0, 0, 0, 0.7)',
    '--shadow-soft': '0 8px 24px rgba(0, 0, 0, 0.5)',
    
    // Gradientes
    '--gradient-primary': 'linear-gradient(135deg, #7c3aed, #6366f1)',
    '--gradient-hover': 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
    '--gradient-header': 'linear-gradient(135deg, #7c3aed, #5b21b6)',
    '--header-bg': 'linear-gradient(135deg, #7c3aed, #5b21b6)',
    '--aura-gradient': 'radial-gradient(circle, rgba(124, 58, 237, 0.15) 0%, rgba(99, 102, 241, 0.1) 40%, transparent 70%)',
    '--gradient-accordion': 'linear-gradient(135deg, #141827, #1a1f2e)',
    '--gradient-accordion-hover': 'linear-gradient(135deg, #1a1f2e, #202635)',
    '--gradient-success': 'linear-gradient(135deg, #10b981, #059669)',
    '--gradient-error': 'linear-gradient(135deg, #f87171, #ef4444)',
    
    // Badges y estados
    '--badge-bg-active': '#10b981',
    '--badge-text-active': '#ffffff',
    '--badge-bg-pending': '#7c3aed',
    '--badge-text-pending': '#f1f5f9',
    '--badge-bg-obligatory': '#f59e0b',
    '--badge-text-obligatory': '#ffffff',
    
    // Inputs
    '--input-bg': '#141827',
    '--input-border': 'rgba(255, 255, 255, 0.08)',
    '--input-text': '#f1f5f9',
    '--input-focus-border': '#6366f1',
    
    // Botones
    '--button-text-color': '#ffffff',
    
    // Radios
    '--radius-sm': '12px',
    '--radius-md': '16px',
    '--radius-lg': '20px',
    '--radius-xl': '24px',
    '--radius-full': '9999px',
    
    // Compatibilidad
    '--card-bg': '#141827',
    '--card-bg-active': '#1a1f2e'
  },
  meta: {
    description: 'Tema oscuro premium con paleta violeta profundo inspirada en AuriPortal Admin',
    source: 'theme-variables.css body.theme-dark',
    createdAt: '2024-01-01'
  }
};



