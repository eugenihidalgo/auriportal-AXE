// Resolvers Studio v2 - JavaScript
// Editor de Decisiones con 5 tabs: Entradas, Reglas, Avanzado, Preview, Asistente GPT

let currentTab = 'draft';
let currentResolver = null;
let currentEditorTab = 'entradas';
let autosaveTimer = null;
let availablePackages = [];
let availableContexts = [];

// Inicializar al cargar
document.addEventListener('DOMContentLoaded', () => {
  loadResolvers();
  setupTabs();
  loadAvailableData();
});

// Cargar datos disponibles (packages y contextos) - SIN CACHE
async function loadAvailableData() {
  try {
    // Forzar refetch sin cache
    const [packagesRes, contextsRes] = await Promise.all([
      fetch('/admin/api/packages?t=' + Date.now(), { cache: 'no-store' }),
      fetch('/admin/api/packages/contexts?t=' + Date.now(), { cache: 'no-store' })
    ]);
    
    if (packagesRes.ok) {
      const packagesData = await packagesRes.json();
      availablePackages = packagesData.packages || [];
    }
    
    if (contextsRes.ok) {
      const contextsData = await contextsRes.json();
      availableContexts = contextsData.contexts || [];
    }
  } catch (error) {
    console.error('Error cargando datos disponibles:', error);
  }
}

// Configurar tabs de lista
function setupTabs() {
  const tabs = document.querySelectorAll('[data-tab]');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      switchTab(tabName);
    });
  });
}

// Cambiar tab de lista
function switchTab(tabName) {
  currentTab = tabName;
  
  document.querySelectorAll('[data-tab]').forEach(t => {
    if (t.dataset.tab === tabName) {
      t.classList.add('active');
    } else {
      t.classList.remove('active');
    }
  });
  
  loadResolvers();
}

// Cargar lista de resolvers
async function loadResolvers() {
  const listEl = document.getElementById('resolver-list');
  if (!listEl) return;
  
  try {
    const status = currentTab === 'draft' ? 'draft' : currentTab === 'published' ? 'published' : 'archived';
    const response = await fetch(`/admin/api/resolvers?status=${status}&t=${Date.now()}`, { cache: 'no-store' });
    const data = await response.json();
    
    listEl.textContent = '';
    
    if (!data.resolvers || data.resolvers.length === 0) {
      const emptyMsg = document.createElement('p');
      emptyMsg.textContent = 'No hay resolvers en este estado';
      emptyMsg.className = 'loading';
      listEl.appendChild(emptyMsg);
      return;
    }
    
    data.resolvers.forEach(resolver => {
      const item = createResolverItem(resolver);
      listEl.appendChild(item);
    });
  } catch (error) {
    console.error('Error cargando resolvers:', error);
    const errorMsg = document.createElement('p');
    errorMsg.textContent = 'Error cargando resolvers';
    errorMsg.className = 'error';
    listEl.textContent = '';
    listEl.appendChild(errorMsg);
  }
}

// Crear item de resolver (formato lista)
function createResolverItem(resolver) {
  const item = document.createElement('div');
  item.className = 'resolver-item';
  item.dataset.id = resolver.id;
  
  // Contenedor principal
  const content = document.createElement('div');
  content.className = 'resolver-item-content';
  
  const h3 = document.createElement('h3');
  h3.textContent = resolver.label || 'Sin nombre';
  content.appendChild(h3);
  
  const key = document.createElement('div');
  key.className = 'resolver-key';
  key.textContent = resolver.resolver_key || 'sin-key';
  content.appendChild(key);
  
  if (resolver.description) {
    const desc = document.createElement('p');
    desc.className = 'resolver-description';
    desc.textContent = resolver.description;
    content.appendChild(desc);
  }
  
  item.appendChild(content);
  
  // Acciones (badge + botón eliminar)
  const actions = document.createElement('div');
  actions.className = 'resolver-item-actions';
  
  const badge = document.createElement('span');
  badge.className = `status-badge ${resolver.status}`;
  badge.textContent = resolver.status || 'draft';
  actions.appendChild(badge);
  
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn btn-danger';
  deleteBtn.textContent = 'Eliminar';
  deleteBtn.style.padding = '6px 12px';
  deleteBtn.style.fontSize = '0.85rem';
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Evitar que se seleccione el resolver
    deleteResolverItem(resolver);
  });
  actions.appendChild(deleteBtn);
  
  item.appendChild(actions);
  
  item.addEventListener('click', () => {
    selectResolver(resolver);
  });
  
  return item;
}

// Eliminar resolver desde la lista
async function deleteResolverItem(resolver) {
  if (!confirm(`¿Eliminar el resolver "${resolver.label || resolver.resolver_key}"?`)) {
    return;
  }
  
  try {
    const response = await fetch(`/admin/api/resolvers/${resolver.id}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      // Recargar lista
      loadResolvers();
      
      // Si era el resolver actual, limpiar editor
      if (currentResolver && currentResolver.id === resolver.id) {
        currentResolver = null;
        const container = document.getElementById('editor-container');
        if (container) {
          container.innerHTML = '<p style="color: #94a3b8; text-align: center; padding: 24px;">Selecciona un resolver de la lista para editarlo</p>';
        }
      }
    } else {
      const data = await response.json();
      alert('Error: ' + (data.error || 'Error desconocido'));
    }
  } catch (error) {
    console.error('Error eliminando:', error);
    alert('Error eliminando resolver');
  }
}

// Seleccionar resolver
async function selectResolver(resolver) {
  document.querySelectorAll('.resolver-item').forEach(item => {
    item.classList.remove('active');
  });
  const item = document.querySelector(`[data-id="${resolver.id}"]`);
  if (item) item.classList.add('active');
  
  currentResolver = resolver;
  await renderEditor(resolver);
}

// Renderizar editor con 5 tabs
async function renderEditor(resolver) {
  const container = document.getElementById('editor-container');
  if (!container) return;
  
  container.textContent = '';
  
  // Header con título y botón eliminar
  const headerDiv = document.createElement('div');
  headerDiv.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding-bottom: 16px; border-bottom: 2px solid #334155;';
  
  const titleDiv = document.createElement('div');
  const title = document.createElement('h2');
  title.textContent = resolver.label || resolver.resolver_key || 'Resolver';
  title.style.cssText = 'color: #fff; margin: 0; font-size: 1.5rem;';
  titleDiv.appendChild(title);
  
  const keySpan = document.createElement('span');
  keySpan.textContent = resolver.resolver_key || 'sin-key';
  keySpan.style.cssText = 'color: #94a3b8; font-family: "Courier New", monospace; font-size: 0.9rem; margin-left: 12px;';
  titleDiv.appendChild(keySpan);
  
  headerDiv.appendChild(titleDiv);
  
  const actionsDiv = document.createElement('div');
  actionsDiv.style.cssText = 'display: flex; gap: 12px; align-items: center;';
  
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn btn-danger';
  deleteBtn.textContent = 'Eliminar Resolver';
  deleteBtn.addEventListener('click', () => deleteResolver());
  actionsDiv.appendChild(deleteBtn);
  
  headerDiv.appendChild(actionsDiv);
  container.appendChild(headerDiv);
  
  // Tabs del editor
  const tabsDiv = document.createElement('div');
  tabsDiv.className = 'tabs';
  
  const tabs = [
    { key: 'entradas', label: '🟦 Entradas' },
    { key: 'reglas', label: '🟩 Reglas' },
    { key: 'avanzado', label: '🟨 Avanzado' },
    { key: 'preview', label: '🟪 Preview' },
    { key: 'gpt', label: '🧠 Asistente GPT' }
  ];
  
  tabs.forEach(tab => {
    const tabBtn = document.createElement('button');
    tabBtn.className = 'tab';
    tabBtn.textContent = tab.label;
    tabBtn.dataset.editorTab = tab.key;
    if (tab.key === 'entradas') tabBtn.classList.add('active');
    tabBtn.addEventListener('click', () => switchEditorTab(tab.key));
    tabsDiv.appendChild(tabBtn);
  });
  
  container.appendChild(tabsDiv);
  
  // Contenedor de contenido
  const contentDiv = document.createElement('div');
  contentDiv.id = 'editor-content';
  container.appendChild(contentDiv);
  
  // Renderizar tab inicial
  await renderEntradasTab(contentDiv, resolver);
}

// Cambiar tab del editor
async function switchEditorTab(tabName) {
  currentEditorTab = tabName;
  
  document.querySelectorAll('[data-editor-tab]').forEach(t => {
    if (t.dataset.editorTab === tabName) {
      t.classList.add('active');
    } else {
      t.classList.remove('active');
    }
  });
  
  const contentDiv = document.getElementById('editor-content');
  if (!contentDiv) return;
  
  contentDiv.textContent = '';
  
  if (tabName === 'entradas') {
    await renderEntradasTab(contentDiv, currentResolver);
  } else if (tabName === 'reglas') {
    renderReglasTab(contentDiv, currentResolver);
  } else if (tabName === 'avanzado') {
    renderAvanzadoTab(contentDiv, currentResolver);
  } else if (tabName === 'preview') {
    await renderPreviewTab(contentDiv, currentResolver);
  } else if (tabName === 'gpt') {
    renderGPTTab(contentDiv, currentResolver);
  }
}

// TAB 1: Entradas
async function renderEntradasTab(container, resolver) {
  // Recargar datos sin cache
  await loadAvailableData();
  
  const info = document.createElement('div');
  info.className = 'info-box';
  info.innerHTML = '<h4>📥 Entradas del Resolver</h4><p>Estos son los datos disponibles cuando el resolver se ejecute. Los contextos marcados como <strong>obligatorios</strong> deben estar presentes, los <strong>sistema</strong> son inyectados automáticamente por el runtime.</p>';
  container.appendChild(info);
  
  // Selector de package
  const packageGroup = document.createElement('div');
  packageGroup.className = 'form-group';
  const packageLabel = document.createElement('label');
  packageLabel.textContent = 'Package que este resolver puede resolver';
  packageGroup.appendChild(packageLabel);
  const packageSelect = document.createElement('select');
  packageSelect.id = 'package-select';
  packageSelect.innerHTML = '<option value="">Seleccionar package...</option>';
  availablePackages.forEach(pkg => {
    const option = document.createElement('option');
    option.value = pkg.package_key || pkg.id;
    option.textContent = `${pkg.name || pkg.package_key} (${pkg.package_key || pkg.id})`;
    if (resolver.definition?.package_key === option.value) {
      option.selected = true;
    }
    packageSelect.appendChild(option);
  });
  packageGroup.appendChild(packageSelect);
  container.appendChild(packageGroup);
  
  // Contextos disponibles
  const contextsTitle = document.createElement('h3');
  contextsTitle.textContent = 'Contextos Disponibles';
  contextsTitle.style.cssText = 'color: #fff; margin-top: 24px; margin-bottom: 16px;';
  container.appendChild(contextsTitle);
  
  const contextsList = document.createElement('div');
  contextsList.className = 'context-list';
  
  if (availableContexts.length === 0) {
    const emptyMsg = document.createElement('p');
    emptyMsg.textContent = 'No hay contextos disponibles';
    emptyMsg.className = 'loading';
    contextsList.appendChild(emptyMsg);
  } else {
    // Separar por scope
    const packageContexts = availableContexts.filter(c => (c.scope || c.definition?.scope) === 'package');
    const systemContexts = availableContexts.filter(c => (c.scope || c.definition?.scope) === 'system');
    
    // Contextos del package
    if (packageContexts.length > 0) {
      const sectionTitle = document.createElement('h4');
      sectionTitle.textContent = 'Contextos del Package';
      sectionTitle.style.cssText = 'color: #94a3b8; margin-top: 16px; margin-bottom: 8px; font-size: 0.9rem;';
      contextsList.appendChild(sectionTitle);
      
      packageContexts.forEach(ctx => {
        const item = createContextItem(ctx, 'package');
        contextsList.appendChild(item);
      });
    }
    
    // Contextos del sistema
    if (systemContexts.length > 0) {
      const sectionTitle = document.createElement('h4');
      sectionTitle.textContent = 'Contextos del Sistema (inyectados por runtime)';
      sectionTitle.style.cssText = 'color: #94a3b8; margin-top: 16px; margin-bottom: 8px; font-size: 0.9rem;';
      contextsList.appendChild(sectionTitle);
      
      systemContexts.forEach(ctx => {
        const item = createContextItem(ctx, 'system');
        contextsList.appendChild(item);
      });
    }
  }
  
  container.appendChild(contextsList);
}

// Crear item de contexto
function createContextItem(ctx, scope) {
  const item = document.createElement('div');
  item.className = 'context-item';
  
  if (scope === 'system') {
    item.classList.add('system');
  }
  
  const h4 = document.createElement('h4');
  h4.textContent = ctx.label || ctx.context_key;
  item.appendChild(h4);
  
  const key = document.createElement('div');
  key.className = 'context-key';
  key.textContent = `context_key: ${ctx.context_key}`;
  item.appendChild(key);
  
  const badges = document.createElement('div');
  
  if (scope === 'system') {
    const badge = document.createElement('span');
    badge.className = 'context-badge system';
    badge.textContent = 'Sistema (read-only)';
    badges.appendChild(badge);
  } else {
    const badge = document.createElement('span');
    badge.className = 'context-badge optional';
    badge.textContent = 'Opcional';
    badges.appendChild(badge);
  }
  
  const typeBadge = document.createElement('span');
  typeBadge.className = 'context-badge optional';
  typeBadge.textContent = `Tipo: ${ctx.type || ctx.definition?.type || 'string'}`;
  badges.appendChild(typeBadge);
  
  item.appendChild(badges);
  
  if (ctx.description || ctx.definition?.description) {
    const desc = document.createElement('p');
    desc.textContent = ctx.description || ctx.definition?.description;
    desc.style.cssText = 'color: #94a3b8; font-size: 0.85rem; margin-top: 8px; margin-bottom: 0;';
    item.appendChild(desc);
  }
  
  return item;
}

// TAB 2: Reglas Semánticas
function renderReglasTab(container, resolver) {
  const info = document.createElement('div');
  info.className = 'info-box';
  info.innerHTML = '<h4>🟩 Reglas Semánticas</h4><p>Define decisiones humanas usando reglas tipo IF/THEN. Estas reglas se convertirán automáticamente en la policy JSON.</p>';
  container.appendChild(info);
  
  const rulesDiv = document.createElement('div');
  rulesDiv.id = 'rules-container';
  
  const policy = resolver.definition?.policy || {};
  const rules = policy.rules || [];
  
  if (rules.length === 0) {
    const emptyMsg = document.createElement('p');
    emptyMsg.textContent = 'No hay reglas definidas. Usa el botón "Añadir Regla" para crear una.';
    emptyMsg.className = 'loading';
    rulesDiv.appendChild(emptyMsg);
  } else {
    rules.forEach((rule, index) => {
      const ruleItem = createRuleItem(rule, index);
      rulesDiv.appendChild(ruleItem);
    });
  }
  
  container.appendChild(rulesDiv);
  
  const addBtn = document.createElement('button');
  addBtn.className = 'btn btn-primary';
  addBtn.textContent = '+ Añadir Regla';
  addBtn.style.marginTop = '16px';
  addBtn.addEventListener('click', () => addNewRule());
  container.appendChild(addBtn);
  
  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn btn-secondary';
  saveBtn.textContent = 'Guardar Reglas';
  saveBtn.style.marginTop = '8px';
  saveBtn.addEventListener('click', () => saveRules());
  container.appendChild(saveBtn);
}

// Crear item de regla
function createRuleItem(rule, index) {
  const item = document.createElement('div');
  item.className = 'rule-item';
  item.dataset.index = index;
  
  const header = document.createElement('div');
  header.className = 'rule-header';
  
  const title = document.createElement('h4');
  title.className = 'rule-title';
  title.textContent = `Regla ${index + 1}`;
  header.appendChild(title);
  
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn btn-danger';
  deleteBtn.textContent = 'Eliminar';
  deleteBtn.style.padding = '4px 12px';
  deleteBtn.style.fontSize = '0.85rem';
  deleteBtn.addEventListener('click', () => deleteRule(index));
  header.appendChild(deleteBtn);
  
  item.appendChild(header);
  
  // Condición
  const condition = document.createElement('div');
  condition.className = 'rule-condition';
  condition.textContent = `IF: ${JSON.stringify(rule.match || rule.condition || {})}`;
  item.appendChild(condition);
  
  // Acción
  const action = document.createElement('div');
  action.className = 'rule-action';
  action.textContent = `THEN: ${JSON.stringify(rule.action || rule.result || {})}`;
  item.appendChild(action);
  
  return item;
}

// Añadir nueva regla
function addNewRule() {
  if (!currentResolver) return;
  
  const policy = currentResolver.definition?.policy || { rules: [] };
  if (!policy.rules) policy.rules = [];
  
  policy.rules.push({
    match: { tipo_limpieza: 'basica' },
    action: { max_items: 10 }
  });
  
  currentResolver.definition = currentResolver.definition || {};
  currentResolver.definition.policy = policy;
  
  renderReglasTab(document.getElementById('editor-content'), currentResolver);
}

// Eliminar regla
function deleteRule(index) {
  if (!currentResolver) return;
  
  const policy = currentResolver.definition?.policy || { rules: [] };
  if (policy.rules) {
    policy.rules.splice(index, 1);
  }
  
  currentResolver.definition = currentResolver.definition || {};
  currentResolver.definition.policy = policy;
  
  renderReglasTab(document.getElementById('editor-content'), currentResolver);
}

// Guardar reglas
async function saveRules() {
  if (!currentResolver) return;
  
  await saveResolver(true);
  alert('Reglas guardadas correctamente');
}

// TAB 3: Avanzado (Policy JSON)
function renderAvanzadoTab(container, resolver) {
  const info = document.createElement('div');
  info.className = 'info-box warning';
  info.innerHTML = '<h4>⚠️ Modo Avanzado</h4><p>Cambiar aquí puede invalidar las reglas semánticas. Usa con precaución.</p>';
  container.appendChild(info);
  
  const textarea = document.createElement('textarea');
  textarea.className = 'json-editor';
  textarea.id = 'policy-json';
  textarea.value = JSON.stringify(resolver.definition?.policy || {}, null, 2);
  container.appendChild(textarea);
  
  const btn = document.createElement('button');
  btn.className = 'btn btn-primary';
  btn.textContent = 'Aplicar Policy JSON';
  btn.style.marginTop = '16px';
  btn.addEventListener('click', () => {
    try {
      const policy = JSON.parse(textarea.value);
      if (currentResolver) {
        currentResolver.definition = currentResolver.definition || {};
        currentResolver.definition.policy = policy;
        saveResolver();
        alert('Policy JSON aplicado correctamente');
      }
    } catch (e) {
      alert('JSON inválido: ' + e.message);
    }
  });
  container.appendChild(btn);
}

// TAB 4: Preview Real
async function renderPreviewTab(container, resolver) {
  const info = document.createElement('div');
  info.className = 'info-box';
  info.innerHTML = '<h4>🟪 Preview Real</h4><p>Selecciona un package y valores de contextos para ver qué devuelve el resolver.</p>';
  container.appendChild(info);
  
  // Selector de package
  const packageGroup = document.createElement('div');
  packageGroup.className = 'form-group';
  const packageLabel = document.createElement('label');
  packageLabel.textContent = 'Package';
  packageGroup.appendChild(packageLabel);
  const packageSelect = document.createElement('select');
  packageSelect.id = 'preview-package-select';
  packageSelect.innerHTML = '<option value="">Seleccionar package...</option>';
  availablePackages.forEach(pkg => {
    const option = document.createElement('option');
    option.value = pkg.package_key || pkg.id;
    option.textContent = `${pkg.name || pkg.package_key} (${pkg.package_key || pkg.id})`;
    packageSelect.appendChild(option);
  });
  packageGroup.appendChild(packageSelect);
  container.appendChild(packageGroup);
  
  // Inputs de contextos
  const contextsGroup = document.createElement('div');
  contextsGroup.className = 'form-group';
  const contextsLabel = document.createElement('label');
  contextsLabel.textContent = 'Valores de Contextos (JSON)';
  contextsGroup.appendChild(contextsLabel);
  const contextsInput = document.createElement('textarea');
  contextsInput.id = 'preview-contexts';
  contextsInput.value = JSON.stringify({ nivel_efectivo: 1, tipo_limpieza: 'basica' }, null, 2);
  contextsInput.style.minHeight = '150px';
  contextsGroup.appendChild(contextsInput);
  container.appendChild(contextsGroup);
  
  // Botón ejecutar
  const executeBtn = document.createElement('button');
  executeBtn.className = 'btn btn-primary';
  executeBtn.textContent = 'Ejecutar Preview';
  executeBtn.addEventListener('click', () => executePreview());
  container.appendChild(executeBtn);
  
  // Resultado
  const resultDiv = document.createElement('div');
  resultDiv.id = 'preview-result';
  resultDiv.className = 'preview-result';
  resultDiv.style.marginTop = '24px';
  resultDiv.style.display = 'none';
  container.appendChild(resultDiv);
}

// Ejecutar preview
async function executePreview() {
  if (!currentResolver) {
    alert('No hay resolver seleccionado');
    return;
  }
  
  const packageSelect = document.getElementById('preview-package-select');
  const contextsInput = document.getElementById('preview-contexts');
  const resultDiv = document.getElementById('preview-result');
  
  if (!packageSelect.value) {
    alert('Selecciona un package');
    return;
  }
  
  let contextOverrides = {};
  try {
    contextOverrides = JSON.parse(contextsInput.value);
  } catch (e) {
    alert('JSON de contextos inválido: ' + e.message);
    return;
  }
  
  resultDiv.style.display = 'block';
  resultDiv.innerHTML = '<p class="loading">Ejecutando preview...</p>';
  
  try {
    const response = await fetch(`/admin/api/resolvers/${currentResolver.id}/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        package_key: packageSelect.value,
        context_overrides: contextOverrides
      })
    });
    
    const data = await response.json();
    
    if (data.ok === false) {
      resultDiv.innerHTML = `<div class="error">Error: ${data.error || 'Error desconocido'}</div>`;
      return;
    }
    
    // Mostrar resultado estructurado
    let html = '<h4>ResolvedPackage</h4>';
    
    if (data.items && Array.isArray(data.items)) {
      html += `<div class="preview-item"><strong>Items (${data.items.length}):</strong><pre style="color: #e2e8f0; margin-top: 8px;">${JSON.stringify(data.items, null, 2)}</pre></div>`;
    }
    
    if (data.metadata) {
      html += `<div class="preview-item"><strong>Metadata:</strong><pre style="color: #e2e8f0; margin-top: 8px;">${JSON.stringify(data.metadata, null, 2)}</pre></div>`;
    }
    
    if (data.hints) {
      html += `<div class="preview-item"><strong>Hints:</strong><pre style="color: #e2e8f0; margin-top: 8px;">${JSON.stringify(data.hints, null, 2)}</pre></div>`;
    }
    
    if (!data.items && !data.metadata && !data.hints) {
      html += `<pre style="color: #e2e8f0;">${JSON.stringify(data, null, 2)}</pre>`;
    }
    
    resultDiv.innerHTML = html;
  } catch (error) {
    resultDiv.innerHTML = `<div class="error">Error ejecutando preview: ${error.message}</div>`;
  }
}

// TAB 5: Asistente GPT
function renderGPTTab(container, resolver) {
  const info = document.createElement('div');
  info.className = 'info-box';
  info.innerHTML = '<h4>🧠 Asistente GPT</h4><p>Estos son los datos y contextos disponibles. Son obligatorios para generar políticas. Tenlos en cuenta. Pregúntame primero qué quieres conseguir. Luego propón reglas claras y explícitas. Yo decidiré.</p>';
  container.appendChild(info);
  
  const assistantDiv = document.createElement('div');
  assistantDiv.className = 'gpt-assistant';
  
  // Prompt base
  const promptDiv = document.createElement('div');
  promptDiv.className = 'form-group';
  const promptLabel = document.createElement('label');
  promptLabel.textContent = 'Prompt para GPT';
  promptDiv.appendChild(promptLabel);
  const promptTextarea = document.createElement('textarea');
  promptTextarea.className = 'gpt-prompt';
  promptTextarea.id = 'gpt-prompt';
  promptTextarea.value = generateGPTPrompt(resolver);
  promptTextarea.readOnly = true;
  promptDiv.appendChild(promptTextarea);
  assistantDiv.appendChild(promptDiv);
  
  // Respuesta de GPT
  const responseDiv = document.createElement('div');
  responseDiv.className = 'form-group';
  const responseLabel = document.createElement('label');
  responseLabel.textContent = 'Respuesta de GPT (pega aquí)';
  responseDiv.appendChild(responseLabel);
  const responseTextarea = document.createElement('textarea');
  responseTextarea.className = 'gpt-response';
  responseTextarea.id = 'gpt-response';
  responseTextarea.placeholder = 'Pega aquí la respuesta de GPT...';
  responseDiv.appendChild(responseTextarea);
  assistantDiv.appendChild(responseDiv);
  
  // Botones
  const buttonsDiv = document.createElement('div');
  buttonsDiv.style.cssText = 'display: flex; gap: 12px; margin-top: 16px;';
  
  const copyBtn = document.createElement('button');
  copyBtn.className = 'btn btn-secondary';
  copyBtn.textContent = 'Copiar Prompt';
  copyBtn.addEventListener('click', () => copyGPTPrompt());
  buttonsDiv.appendChild(copyBtn);
  
  const convertBtn = document.createElement('button');
  convertBtn.className = 'btn btn-primary';
  convertBtn.textContent = 'Convertir a Reglas';
  convertBtn.addEventListener('click', () => convertGPTResponse());
  buttonsDiv.appendChild(convertBtn);
  
  assistantDiv.appendChild(buttonsDiv);
  container.appendChild(assistantDiv);
}

// Generar prompt GPT
function generateGPTPrompt(resolver) {
  const packageInfo = availablePackages.find(p => 
    (p.package_key || p.id) === (resolver.definition?.package_key)
  );
  
  const contextsInfo = availableContexts.map(ctx => ({
    key: ctx.context_key,
    label: ctx.label,
    type: ctx.type || ctx.definition?.type,
    scope: ctx.scope || ctx.definition?.scope,
    required: (ctx.scope || ctx.definition?.scope) === 'package'
  }));
  
  return `Genera un ResolverDefinition.policy válido para el resolver "${resolver.label || resolver.resolver_key}".

PACKAGE:
${packageInfo ? JSON.stringify(packageInfo, null, 2) : 'No especificado'}

CONTEXTOS DISPONIBLES:
${JSON.stringify(contextsInfo, null, 2)}

INSTRUCCIONES:
- Devuelve SOLO el JSON de policy (sin markdown, sin explicaciones)
- Formato: { "policy": { "mode": "per_source", "global": {...}, "rules": [...] } }
- Incluye reglas de matching por contexto y nivel
- Define max_items por source según corresponda

CONTEXTO DEL RESOLVER:
${JSON.stringify(resolver.definition || {}, null, 2)}`;
}

// Copiar prompt GPT
async function copyGPTPrompt() {
  const textarea = document.getElementById('gpt-prompt');
  if (!textarea) return;
  
  try {
    await navigator.clipboard.writeText(textarea.value);
    alert('Prompt copiado al portapapeles');
  } catch (error) {
    console.error('Error copiando:', error);
    alert('Error copiando al portapapeles');
  }
}

// Convertir respuesta GPT a reglas
function convertGPTResponse() {
  const responseTextarea = document.getElementById('gpt-response');
  if (!responseTextarea || !responseTextarea.value.trim()) {
    alert('No hay respuesta de GPT para convertir');
    return;
  }
  
  try {
    let policy = JSON.parse(responseTextarea.value);
    
    // Si viene envuelto en "policy", extraerlo
    if (policy.policy) {
      policy = policy.policy;
    }
    
    if (!currentResolver) {
      alert('No hay resolver seleccionado');
      return;
    }
    
    currentResolver.definition = currentResolver.definition || {};
    currentResolver.definition.policy = policy;
    
    saveResolver();
    alert('Reglas convertidas y guardadas. Revisa el tab "Reglas" o "Avanzado".');
    
    // Cambiar a tab de reglas
    switchEditorTab('reglas');
  } catch (e) {
    alert('Error parseando respuesta de GPT: ' + e.message + '\n\nAsegúrate de que sea JSON válido.');
  }
}

// Guardar resolver
async function saveResolver(silent = false) {
  if (!currentResolver) return;
  
  const key = document.getElementById('resolver-key')?.value || currentResolver.resolver_key;
  const label = document.getElementById('resolver-label')?.value || currentResolver.label;
  const description = document.getElementById('resolver-description')?.value || currentResolver.description;
  
  if (!key || !label) {
    if (!silent) alert('Resolver key y label son requeridos');
    return;
  }
  
  try {
    const response = await fetch(`/admin/api/resolvers/${currentResolver.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label,
        description,
        definition: currentResolver.definition
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      currentResolver = data.resolver || currentResolver;
      if (!silent) {
        alert('Guardado correctamente');
        loadResolvers();
      }
    } else {
      const data = await response.json();
      alert('Error: ' + (data.error || 'Error desconocido'));
    }
  } catch (error) {
    console.error('Error guardando:', error);
    if (!silent) alert('Error guardando resolver');
  }
}

// Publicar resolver
async function publishResolver() {
  if (!currentResolver) return;
  
  if (!confirm('¿Publicar este resolver? No podrás editarlo después.')) return;
  
  try {
    const response = await fetch(`/admin/api/resolvers/${currentResolver.id}/publish`, {
      method: 'POST'
    });
    
    if (response.ok) {
      alert('Resolver publicado correctamente');
      loadResolvers();
      currentResolver = null;
      document.getElementById('editor-container').textContent = '';
    } else {
      const data = await response.json();
      alert('Error: ' + (data.error || 'Error desconocido'));
    }
  } catch (error) {
    console.error('Error publicando:', error);
    alert('Error publicando resolver');
  }
}

// Duplicar resolver
async function duplicateResolver() {
  if (!currentResolver) return;
  
  try {
    const response = await fetch(`/admin/api/resolvers/${currentResolver.id}/duplicate`, {
      method: 'POST'
    });
    
    if (response.ok) {
      alert('Resolver duplicado correctamente');
      loadResolvers();
    } else {
      const data = await response.json();
      alert('Error: ' + (data.error || 'Error desconocido'));
    }
  } catch (error) {
    console.error('Error duplicando:', error);
    alert('Error duplicando resolver');
  }
}

// Eliminar resolver (desde el editor)
async function deleteResolver() {
  if (!currentResolver) return;
  
  if (!confirm(`¿Eliminar el resolver "${currentResolver.label || currentResolver.resolver_key}"?`)) return;
  
  try {
    const response = await fetch(`/admin/api/resolvers/${currentResolver.id}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      alert('Resolver eliminado correctamente');
      loadResolvers();
      currentResolver = null;
      const container = document.getElementById('editor-container');
      if (container) {
        container.innerHTML = '<p style="color: #94a3b8; text-align: center; padding: 24px;">Selecciona un resolver de la lista para editarlo</p>';
      }
    } else {
      const data = await response.json();
      alert('Error: ' + (data.error || 'Error desconocido'));
    }
  } catch (error) {
    console.error('Error eliminando:', error);
    alert('Error eliminando resolver');
  }
}

// Crear nuevo resolver
function createNewResolver() {
  const key = prompt('Resolver Key:');
  if (!key) return;
  
  const label = prompt('Label:');
  if (!label) return;
  
  const defaultDefinition = {
    resolver_key: key,
    label,
    description: '',
    policy: {
      mode: 'per_source',
      global: {
        seed: 'stable',
        ordering: 'canonical',
        default_max_items: null
      },
      rules: []
    },
    meta: {
      created_by: 'admin',
      notes: ''
    }
  };
  
  fetch('/admin/api/resolvers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      resolver_key: key,
      label,
      description: '',
      definition: defaultDefinition
    })
  })
  .then(res => res.json())
  .then(data => {
    if (data.resolver) {
      alert('Resolver creado correctamente');
      loadResolvers();
      selectResolver(data.resolver);
    } else {
      alert('Error: ' + (data.error || 'Error desconocido'));
    }
  })
  .catch(error => {
    console.error('Error creando:', error);
    alert('Error creando resolver');
  });
}
