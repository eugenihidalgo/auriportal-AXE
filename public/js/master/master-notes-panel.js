/**
 * MASTER NOTES PANEL v1 - AuriPortal Master
 * 
 * Panel de notas persistente para Master Layout.
 * 
 * GUARD IDEMPOTENTE: Solo se ejecuta una vez
 */

// Guard idempotente
if (window.__AP_MASTER_NOTES_PANEL_LOADED__) {
  console.warn('[MasterNotesPanel] Ya cargado, ignorando carga duplicada');
} else {
  window.__AP_MASTER_NOTES_PANEL_LOADED__ = true;
  
  const STORAGE_KEY = 'ap_master_notes_v1';
  const PANEL_ID = 'master-notes-panel';
  const BUTTON_ID = 'master-notes-toggle';
  
  /**
   * Obtiene las notas guardadas
   * @returns {string} Contenido de las notas
   */
  function getStoredNotes() {
    try {
      return localStorage.getItem(STORAGE_KEY) || '';
    } catch (error) {
      console.error('[MasterNotesPanel] Error leyendo notas:', error);
      return '';
    }
  }
  
  /**
   * Guarda las notas
   * @param {string} content - Contenido a guardar
   */
  function saveNotes(content) {
    try {
      localStorage.setItem(STORAGE_KEY, content);
    } catch (error) {
      console.error('[MasterNotesPanel] Error guardando notas:', error);
    }
  }
  
  /**
   * Crea el botón flotante
   * @returns {HTMLElement} Botón flotante
   */
  function createToggleButton() {
    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.type = 'button';
    button.setAttribute('aria-label', 'Abrir/Cerrar panel de notas');
    
    // Estilos inline (permitido para elementos dinámicos)
    button.style.cssText = `
      position: fixed;
      bottom: 2rem;
      right: 2rem;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background-color: #4f46e5;
      color: white;
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      z-index: 1000;
      font-size: 1.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s, box-shadow 0.2s;
    `;
    
    button.textContent = '📝';
    
    button.addEventListener('mouseenter', () => {
      button.style.transform = 'scale(1.1)';
    });
    
    button.addEventListener('mouseleave', () => {
      button.style.transform = 'scale(1)';
    });
    
    return button;
  }
  
  /**
   * Crea el textarea del panel
   * @returns {HTMLElement} Textarea
   */
  function createNotesTextarea() {
    const textarea = document.createElement('textarea');
    textarea.id = 'master-notes-content';
    textarea.setAttribute('placeholder', 'Escribe tus notas aquí...');
    textarea.value = getStoredNotes();
    
    // Estilos
    textarea.style.cssText = `
      width: 100%;
      height: 100%;
      padding: 1rem;
      background-color: #1e293b;
      color: #f1f5f9;
      border: none;
      resize: none;
      font-family: inherit;
      font-size: 0.875rem;
      line-height: 1.5;
    `;
    
    // Guardar automáticamente al escribir
    textarea.addEventListener('input', (e) => {
      saveNotes(e.target.value);
    });
    
    return textarea;
  }
  
  /**
   * Inicializa el panel de notas
   */
  function initNotesPanel() {
    if (typeof document === 'undefined') return;
    
    const panel = document.getElementById(PANEL_ID);
    if (!panel) {
      console.warn('[MasterNotesPanel] Panel no encontrado:', PANEL_ID);
      return;
    }
    
    // Crear textarea
    const textarea = createNotesTextarea();
    panel.appendChild(textarea);
    
    // Crear botón flotante
    const button = createToggleButton();
    document.body.appendChild(button);
    
    // Estado inicial: cerrado (a menos que esté guardado como abierto)
    const wasOpen = localStorage.getItem('ap_master_notes_open_v1') === 'true';
    if (wasOpen) {
      panel.classList.add('visible');
      button.textContent = '✕';
    }
    
    // Toggle al hacer clic en el botón
    button.addEventListener('click', () => {
      const isVisible = panel.classList.contains('visible');
      
      if (isVisible) {
        panel.classList.remove('visible');
        button.textContent = '📝';
        localStorage.setItem('ap_master_notes_open_v1', 'false');
      } else {
        panel.classList.add('visible');
        button.textContent = '✕';
        localStorage.setItem('ap_master_notes_open_v1', 'true');
      }
    });
  }
  
  // Auto-inicializar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNotesPanel);
  } else {
    initNotesPanel();
  }
}


