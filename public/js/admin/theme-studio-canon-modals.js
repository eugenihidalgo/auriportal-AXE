/**
 * Theme Studio Canon - Sistema de Modales Interno
 * 
 * Reemplaza alert/confirm/prompt del navegador con modales internos del Admin.
 * 
 * PRINCIPIO:
 * - NO usar window.alert, window.confirm, window.prompt
 * - SIEMPRE usar modales internos con estilo AuriPortal
 * - DOM API pura (sin innerHTML dinámico)
 */

/**
 * Muestra un modal simple (reemplaza alert)
 * @param {string} message - Mensaje a mostrar
 * @param {Object} options - { title, onClose }
 */
function showModalAlert(message, options = {}) {
  const { title = 'Información', onClose } = options;
  
  const overlay = document.getElementById('modalOverlay');
  const titleEl = document.getElementById('modalTitle');
  const bodyEl = document.getElementById('modalBody');
  const footerEl = document.getElementById('modalFooter');
  
  if (!overlay || !titleEl || !bodyEl || !footerEl) {
    console.error('[Modal] Elementos del modal no encontrados');
    return;
  }
  
  // Limpiar contenido anterior
  titleEl.textContent = title;
  bodyEl.innerHTML = '';
  footerEl.innerHTML = '';
  
  // Crear mensaje
  const messageEl = document.createElement('p');
  messageEl.textContent = message;
  messageEl.style.margin = '0';
  messageEl.style.color = 'var(--ap-text-primary, #fff)';
  bodyEl.appendChild(messageEl);
  
  // Crear botón OK
  const okBtn = document.createElement('button');
  okBtn.className = 'btn btn-primary';
  okBtn.textContent = 'OK';
  okBtn.onclick = () => {
    closeModal();
    if (onClose) onClose();
  };
  footerEl.appendChild(okBtn);
  
  // Mostrar modal
  overlay.style.display = 'flex';
  
  // Cerrar con ESC
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closeModal();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

/**
 * Muestra un modal de confirmación (reemplaza confirm)
 * @param {string} message - Mensaje a mostrar
 * @param {Object} options - { title, onConfirm, onCancel }
 * @returns {Promise<boolean>} true si se confirma, false si se cancela
 */
function showModalConfirm(message, options = {}) {
  return new Promise((resolve) => {
    const { title = 'Confirmar', onConfirm, onCancel } = options;
    
    const overlay = document.getElementById('modalOverlay');
    const titleEl = document.getElementById('modalTitle');
    const bodyEl = document.getElementById('modalBody');
    const footerEl = document.getElementById('modalFooter');
    
    if (!overlay || !titleEl || !bodyEl || !footerEl) {
      console.error('[Modal] Elementos del modal no encontrados');
      resolve(false);
      return;
    }
    
    // Limpiar contenido anterior
    titleEl.textContent = title;
    bodyEl.innerHTML = '';
    footerEl.innerHTML = '';
    
    // Crear mensaje
    const messageEl = document.createElement('p');
    messageEl.textContent = message;
    messageEl.style.margin = '0';
    messageEl.style.color = 'var(--ap-text-primary, #fff)';
    bodyEl.appendChild(messageEl);
    
    // Crear botones
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = 'Cancelar';
    cancelBtn.onclick = () => {
      closeModal();
      if (onCancel) onCancel();
      resolve(false);
    };
    
    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'btn btn-primary';
    confirmBtn.textContent = 'Confirmar';
    confirmBtn.onclick = () => {
      closeModal();
      if (onConfirm) onConfirm();
      resolve(true);
    };
    
    footerEl.appendChild(cancelBtn);
    footerEl.appendChild(confirmBtn);
    
    // Mostrar modal
    overlay.style.display = 'flex';
    
    // Cerrar con ESC
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', escHandler);
        resolve(false);
      }
    };
    document.addEventListener('keydown', escHandler);
  });
}

/**
 * Muestra un modal de input (reemplaza prompt)
 * @param {string} label - Etiqueta del input
 * @param {Object} options - { title, defaultValue, placeholder, validate, onConfirm, onCancel }
 * @returns {Promise<string|null>} Valor ingresado o null si se cancela
 */
function showModalPrompt(label, options = {}) {
  return new Promise((resolve) => {
    const { 
      title = 'Ingresar valor', 
      defaultValue = '', 
      placeholder = '',
      validate = null,
      onConfirm,
      onCancel 
    } = options;
    
    const overlay = document.getElementById('modalOverlay');
    const titleEl = document.getElementById('modalTitle');
    const bodyEl = document.getElementById('modalBody');
    const footerEl = document.getElementById('modalFooter');
    
    if (!overlay || !titleEl || !bodyEl || !footerEl) {
      console.error('[Modal] Elementos del modal no encontrados');
      resolve(null);
      return;
    }
    
    // Limpiar contenido anterior
    titleEl.textContent = title;
    bodyEl.innerHTML = '';
    footerEl.innerHTML = '';
    
    // Crear label
    const labelEl = document.createElement('label');
    labelEl.textContent = label;
    labelEl.style.display = 'block';
    labelEl.style.marginBottom = '8px';
    labelEl.style.color = 'var(--ap-text-secondary, #aaa)';
    labelEl.style.fontSize = '14px';
    bodyEl.appendChild(labelEl);
    
    // Crear input
    const inputEl = document.createElement('input');
    inputEl.type = 'text';
    inputEl.className = 'form-input';
    inputEl.value = defaultValue;
    inputEl.placeholder = placeholder;
    inputEl.style.marginBottom = '16px';
    bodyEl.appendChild(inputEl);
    
    // Mensaje de error (inicialmente oculto)
    const errorEl = document.createElement('div');
    errorEl.className = 'form-error';
    errorEl.style.color = 'var(--ap-danger-base, #dc3545)';
    errorEl.style.fontSize = '12px';
    errorEl.style.marginTop = '-12px';
    errorEl.style.marginBottom = '12px';
    errorEl.style.display = 'none';
    bodyEl.appendChild(errorEl);
    
    // Función de validación
    const validateInput = () => {
      const value = inputEl.value.trim();
      if (validate) {
        const validationResult = validate(value);
        if (validationResult !== true) {
          errorEl.textContent = validationResult || 'Valor inválido';
          errorEl.style.display = 'block';
          inputEl.style.borderColor = 'var(--ap-danger-base, #dc3545)';
          return false;
        }
      }
      errorEl.style.display = 'none';
      inputEl.style.borderColor = '';
      return true;
    };
    
    // Validar en tiempo real
    inputEl.addEventListener('input', validateInput);
    
    // Crear botones
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = 'Cancelar';
    cancelBtn.onclick = () => {
      closeModal();
      if (onCancel) onCancel();
      resolve(null);
    };
    
    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'btn btn-primary';
    confirmBtn.textContent = 'Aceptar';
    confirmBtn.onclick = () => {
      if (validateInput()) {
        const value = inputEl.value.trim();
        closeModal();
        if (onConfirm) onConfirm(value);
        resolve(value);
      }
    };
    
    footerEl.appendChild(cancelBtn);
    footerEl.appendChild(confirmBtn);
    
    // Mostrar modal
    overlay.style.display = 'flex';
    
    // Focus en input y seleccionar texto si hay defaultValue
    inputEl.focus();
    if (defaultValue) {
      inputEl.select();
    }
    
    // Enter para confirmar, ESC para cancelar
    const keyHandler = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        confirmBtn.click();
      } else if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', keyHandler);
        resolve(null);
      }
    };
    document.addEventListener('keydown', keyHandler);
  });
}

/**
 * Cierra el modal
 */
function closeModal() {
  const overlay = document.getElementById('modalOverlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
}

/**
 * Modal específico para crear nuevo tema
 * @returns {Promise<Object|null>} { id, name, description } o null si se cancela
 */
function showNewThemeModal() {
  return new Promise((resolve) => {
    const overlay = document.getElementById('modalOverlay');
    const titleEl = document.getElementById('modalTitle');
    const bodyEl = document.getElementById('modalBody');
    const footerEl = document.getElementById('modalFooter');
    
    if (!overlay || !titleEl || !bodyEl || !footerEl) {
      console.error('[Modal] Elementos del modal no encontrados');
      resolve(null);
      return;
    }
    
    // Limpiar contenido anterior
    titleEl.textContent = 'Crear nuevo tema';
    bodyEl.innerHTML = '';
    footerEl.innerHTML = '';
    
    // Crear formulario
    const form = document.createElement('form');
    form.style.display = 'flex';
    form.style.flexDirection = 'column';
    form.style.gap = '16px';
    
    // Theme Key (ID)
    const keyGroup = document.createElement('div');
    keyGroup.className = 'form-group';
    
    const keyLabel = document.createElement('label');
    keyLabel.textContent = 'ID del tema (requerido)';
    keyLabel.style.display = 'block';
    keyLabel.style.marginBottom = '6px';
    keyLabel.style.color = 'var(--ap-text-secondary, #aaa)';
    keyLabel.style.fontSize = '14px';
    
    const keyInput = document.createElement('input');
    keyInput.type = 'text';
    keyInput.className = 'form-input';
    keyInput.placeholder = 'ej: my-custom-theme';
    keyInput.required = true;
    
    const keyError = document.createElement('div');
    keyError.className = 'form-error';
    keyError.style.color = 'var(--ap-danger-base, #dc3545)';
    keyError.style.fontSize = '12px';
    keyError.style.marginTop = '4px';
    keyError.style.display = 'none';
    
    keyGroup.appendChild(keyLabel);
    keyGroup.appendChild(keyInput);
    keyGroup.appendChild(keyError);
    
    // Name
    const nameGroup = document.createElement('div');
    nameGroup.className = 'form-group';
    
    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Nombre (requerido)';
    nameLabel.style.display = 'block';
    nameLabel.style.marginBottom = '6px';
    nameLabel.style.color = 'var(--ap-text-secondary, #aaa)';
    nameLabel.style.fontSize = '14px';
    
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'form-input';
    nameInput.placeholder = 'ej: Mi Tema Personalizado';
    nameInput.required = true;
    
    nameGroup.appendChild(nameLabel);
    nameGroup.appendChild(nameInput);
    
    // Description (opcional)
    const descGroup = document.createElement('div');
    descGroup.className = 'form-group';
    
    const descLabel = document.createElement('label');
    descLabel.textContent = 'Descripción (opcional)';
    descLabel.style.display = 'block';
    descLabel.style.marginBottom = '6px';
    descLabel.style.color = 'var(--ap-text-secondary, #aaa)';
    descLabel.style.fontSize = '14px';
    
    const descInput = document.createElement('textarea');
    descInput.className = 'form-textarea';
    descInput.rows = 3;
    descInput.placeholder = 'Descripción del tema...';
    
    descGroup.appendChild(descLabel);
    descGroup.appendChild(descInput);
    
    form.appendChild(keyGroup);
    form.appendChild(nameGroup);
    form.appendChild(descGroup);
    bodyEl.appendChild(form);
    
    // Validación del key
    const validateKey = (value) => {
      const trimmed = value.trim();
      if (!trimmed) {
        return 'El ID es requerido';
      }
      if (!/^[a-z0-9-]+$/.test(trimmed)) {
        return 'El ID solo puede contener letras minúsculas, números y guiones';
      }
      if (trimmed.length < 3) {
        return 'El ID debe tener al menos 3 caracteres';
      }
      return true;
    };
    
    keyInput.addEventListener('input', () => {
      const value = keyInput.value.trim();
      const validation = validateKey(value);
      if (validation !== true) {
        keyError.textContent = validation;
        keyError.style.display = 'block';
        keyInput.style.borderColor = 'var(--ap-danger-base, #dc3545)';
      } else {
        keyError.style.display = 'none';
        keyInput.style.borderColor = '';
      }
    });
    
    // Crear botones
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = 'Cancelar';
    cancelBtn.onclick = () => {
      closeModal();
      resolve(null);
    };
    
    const createBtn = document.createElement('button');
    createBtn.type = 'button';
    createBtn.className = 'btn btn-primary';
    createBtn.textContent = 'Crear';
    createBtn.onclick = () => {
      const key = keyInput.value.trim();
      const name = nameInput.value.trim();
      const description = descInput.value.trim();
      
      // Validar
      const keyValidation = validateKey(key);
      if (keyValidation !== true) {
        keyError.textContent = keyValidation;
        keyError.style.display = 'block';
        keyInput.style.borderColor = 'var(--ap-danger-base, #dc3545)';
        keyInput.focus();
        return;
      }
      
      if (!name) {
        nameInput.style.borderColor = 'var(--ap-danger-base, #dc3545)';
        nameInput.focus();
        return;
      }
      
      closeModal();
      resolve({
        id: key,
        name: name,
        description: description || undefined
      });
    };
    
    footerEl.appendChild(cancelBtn);
    footerEl.appendChild(createBtn);
    
    // Mostrar modal
    overlay.style.display = 'flex';
    
    // Focus en primer input
    keyInput.focus();
    
    // Enter en form para crear
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      createBtn.click();
    });
    
    // ESC para cancelar
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', escHandler);
        resolve(null);
      }
    };
    document.addEventListener('keydown', escHandler);
  });
}

