// theme-selector-v1.js
// Selector de tema reutilizable (componente JS sin framework)
// Puede insertarse en cualquier editor/pantalla admin sin acoplarse al layout

/**
 * Crea un selector de tema reutilizable
 * 
 * @param {Object} opts - Opciones
 * @param {string} opts.scope_type - Tipo de scope ('global', 'environment', 'editor', 'screen', 'user')
 * @param {string} opts.scope_key - Clave del scope
 * @param {HTMLElement} opts.containerEl - Elemento contenedor donde insertar el selector
 * @returns {HTMLElement} Elemento del selector creado
 */
export function createThemeSelector({ scope_type, scope_key, containerEl }) {
  if (!containerEl) {
    throw new Error('containerEl es requerido');
  }

  // Crear contenedor del selector
  const selector = document.createElement('div');
  selector.className = 'ap-theme-selector';
  selector.style.cssText = `
    display: inline-flex;
    gap: 10px;
    align-items: center;
    padding: 8px 12px;
    background: var(--ap-bg-panel, #3a3a3a);
    border: 1px solid var(--ap-border-subtle, #404040);
    border-radius: var(--ap-radius-md, 8px);
  `;

  // Label
  const label = document.createElement('span');
  label.textContent = 'Tema:';
  label.style.cssText = 'font-size: 14px; color: var(--ap-text-muted, #aaaaaa);';

  // Dropdown de themes
  const themeSelect = document.createElement('select');
  themeSelect.id = `ap-theme-select-${scope_type}-${scope_key}`;
  themeSelect.style.cssText = `
    padding: 6px 12px;
    background: var(--ap-bg-surface, #2d2d2d);
    color: var(--ap-text-primary, #ffffff);
    border: 1px solid var(--ap-border-subtle, #404040);
    border-radius: var(--ap-radius-sm, 4px);
    font-size: 14px;
    cursor: pointer;
  `;

  // Dropdown de modo
  const modeSelect = document.createElement('select');
  modeSelect.id = `ap-mode-select-${scope_type}-${scope_key}`;
  modeSelect.style.cssText = themeSelect.style.cssText;

  // Botón guardar
  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Aplicar';
  saveBtn.className = 'ap-theme-selector-save';
  saveBtn.style.cssText = `
    padding: 6px 12px;
    background: var(--ap-accent-primary, #007bff);
    color: var(--ap-text-inverse, #ffffff);
    border: none;
    border-radius: var(--ap-radius-sm, 4px);
    font-size: 14px;
    cursor: pointer;
  `;

  // Ensamblar
  selector.appendChild(label);
  selector.appendChild(themeSelect);
  selector.appendChild(modeSelect);
  selector.appendChild(saveBtn);
  containerEl.appendChild(selector);

  // Cargar temas
  loadThemes(themeSelect);

  // Cargar binding actual
  loadCurrentBinding(scope_type, scope_key, themeSelect, modeSelect);

  // Handler de guardar
  saveBtn.addEventListener('click', async () => {
    const themeKey = themeSelect.value;
    const modePref = modeSelect.value;

    try {
      const res = await fetch('/admin/api/theme-bindings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope_type,
          scope_key,
          theme_key: themeKey,
          mode_pref: modePref
        })
      });

      const data = await res.json();
      if (data.ok) {
        alert('Tema aplicado correctamente. Recarga la página para ver los cambios.');
      } else {
        alert('Error: ' + (data.error || 'Error aplicando tema'));
      }
    } catch (error) {
      alert('Error: ' + error.message);
    }
  });

  return selector;
}

/**
 * Carga la lista de temas en el select
 */
async function loadThemes(selectEl) {
  try {
    const res = await fetch('/admin/api/themes');
    const data = await res.json();
    
    if (data.ok && data.themes) {
      selectEl.innerHTML = '<option value="">-- Seleccionar --</option>';
      data.themes.forEach(theme => {
        const option = document.createElement('option');
        option.value = theme.theme_key || theme.id;
        option.textContent = theme.name || theme.theme_key || theme.id;
        selectEl.appendChild(option);
      });
    }
  } catch (error) {
    console.error('Error cargando temas:', error);
    selectEl.innerHTML = '<option value="">Error cargando temas</option>';
  }
}

/**
 * Carga el binding actual
 */
async function loadCurrentBinding(scope_type, scope_key, themeSelect, modeSelect) {
  try {
    const res = await fetch(`/admin/api/theme-bindings?scope_type=${scope_type}&scope_key=${scope_key}`);
    const data = await res.json();
    
    if (data.ok && data.binding) {
      themeSelect.value = data.binding.theme_key || '';
      modeSelect.value = data.binding.mode_pref || 'auto';
    }
  } catch (error) {
    console.error('Error cargando binding:', error);
  }

  // Añadir opciones de modo
  modeSelect.innerHTML = `
    <option value="auto">Auto</option>
    <option value="light">Light</option>
    <option value="dark">Dark</option>
  `;
}

