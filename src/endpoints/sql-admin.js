// src/endpoints/sql-admin.js
// Panel de administración SQL para ver y editar bases de datos de alumnos de Kajabi

import { getDatabase } from '../../database/db.js';

// Lista blanca de tablas permitidas (seguridad)
const ALLOWED_TABLES = [
  'students',
  'sync_log',
  'practices'
];

/**
 * Valida que el nombre de tabla sea seguro
 */
function validateTableName(tableName) {
  // Solo permitir caracteres alfanuméricos y guiones bajos
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
    return false;
  }
  // Verificar que esté en la lista blanca
  return ALLOWED_TABLES.includes(tableName);
}

/**
 * Obtiene todas las tablas de la base de datos
 */
function getAllTables() {
  const db = getDatabase();
  const tables = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' 
    AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all();
  
  // Filtrar solo tablas permitidas
  return tables
    .map(t => t.name)
    .filter(name => ALLOWED_TABLES.includes(name));
}

/**
 * Obtiene la estructura de una tabla
 */
function getTableSchema(tableName) {
  if (!validateTableName(tableName)) {
    throw new Error('Nombre de tabla inválido');
  }
  
  const db = getDatabase();
  // PRAGMA no acepta parámetros, pero ya validamos el nombre
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  return columns;
}

/**
 * Obtiene todos los registros de una tabla con paginación
 */
function getTableData(tableName, page = 1, limit = 50, search = '') {
  if (!validateTableName(tableName)) {
    throw new Error('Nombre de tabla inválido');
  }
  
  const db = getDatabase();
  const offset = (page - 1) * limit;
  
  // Obtener schema primero
  const columns = getTableSchema(tableName);
  const textColumns = columns
    .filter(col => {
      const type = col.type?.toUpperCase() || '';
      return type.includes('TEXT') || type.includes('VARCHAR') || type.includes('CHAR');
    })
    .map(col => col.name);
  
  // Obtener total de registros
  let countQuery = `SELECT COUNT(*) as total FROM ${tableName}`;
  const countParams = [];
  
  if (search && textColumns.length > 0) {
    // Construir condiciones de búsqueda de forma segura
    const conditions = textColumns.map(col => {
      // Validar nombre de columna (solo alfanuméricos y guiones bajos)
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(col)) {
        return null;
      }
      return `${col} LIKE ?`;
    }).filter(c => c !== null).join(' OR ');
    
    if (conditions) {
      countQuery += ` WHERE ${conditions}`;
      countParams.push(...textColumns.map(() => `%${search}%`));
    }
  }
  
  const total = db.prepare(countQuery).get(...countParams)?.total || 0;
  
  // Obtener registros
  let dataQuery = `SELECT * FROM ${tableName}`;
  const dataParams = [];
  
  if (search && textColumns.length > 0) {
    const conditions = textColumns
      .filter(col => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(col))
      .map(col => `${col} LIKE ?`)
      .join(' OR ');
    
    if (conditions) {
      dataQuery += ` WHERE ${conditions}`;
      dataParams.push(...textColumns.map(() => `%${search}%`));
    }
  }
  
  dataQuery += ` LIMIT ? OFFSET ?`;
  dataParams.push(limit, offset);
  
  const data = db.prepare(dataQuery).all(...dataParams);
  
  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
}

/**
 * Obtiene un registro específico por ID
 */
function getRecordById(tableName, id) {
  if (!validateTableName(tableName)) {
    throw new Error('Nombre de tabla inválido');
  }
  
  const db = getDatabase();
  const schema = getTableSchema(tableName);
  const primaryKey = schema.find(col => col.pk === 1)?.name || 'id';
  
  // Validar nombre de columna
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(primaryKey)) {
    throw new Error('Nombre de columna inválido');
  }
  
  const record = db.prepare(`SELECT * FROM ${tableName} WHERE ${primaryKey} = ?`).get(id);
  return record;
}

/**
 * Actualiza un registro
 */
function updateRecord(tableName, id, updates) {
  if (!validateTableName(tableName)) {
    throw new Error('Nombre de tabla inválido');
  }
  
  const db = getDatabase();
  const schema = getTableSchema(tableName);
  const primaryKey = schema.find(col => col.pk === 1)?.name || 'id';
  
  // Validar nombre de columna primaria
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(primaryKey)) {
    throw new Error('Nombre de columna primaria inválido');
  }
  
  // Filtrar solo campos que existen en la tabla y validar nombres
  const validColumns = schema.map(col => col.name);
  const validUpdates = {};
  
  for (const [key, value] of Object.entries(updates)) {
    // Validar nombre de columna
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
      continue;
    }
    
    if (validColumns.includes(key) && key !== primaryKey) {
      // No permitir actualizar campos de sistema críticos
      if (key.includes('_local') || key === 'created_at' || key === 'kajabi_id') {
        continue;
      }
      validUpdates[key] = value;
    }
  }
  
  if (Object.keys(validUpdates).length === 0) {
    return { success: false, error: 'No hay campos válidos para actualizar' };
  }
  
  // Construir SET clause de forma segura
  const setClause = Object.keys(validUpdates)
    .map(key => `${key} = ?`)
    .join(', ');
  
  const values = Object.values(validUpdates);
  values.push(id);
  
  try {
    // Intentar actualizar updated_at si existe, sino no incluir
    const hasUpdatedAt = validColumns.includes('updated_at');
    let updateQuery = `UPDATE ${tableName} SET ${setClause}`;
    if (hasUpdatedAt) {
      updateQuery += `, updated_at = CURRENT_TIMESTAMP`;
    }
    updateQuery += ` WHERE ${primaryKey} = ?`;
    
    const result = db.prepare(updateQuery).run(...values);
    
    return {
      success: true,
      changes: result.changes,
      record: getRecordById(tableName, id)
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Handler principal del panel SQL
 */
export default async function sqlAdminHandler(request, env, ctx) {
  const url = new URL(request.url);
  let path = url.pathname;
  const method = request.method;
  
  // Normalizar path: remover /sql-admin si está presente
  if (path.startsWith('/sql-admin')) {
    path = path.replace('/sql-admin', '') || '/';
  }
  
  // Si el path está vacío después de normalizar, establecerlo como '/'
  if (path === '') {
    path = '/';
  }
  
  // Endpoint de sincronización ClickUp ↔ SQL
  if (path === '/sync-clickup-sql') {
    // Importar y llamar al handler de sincronización
    const syncClickUpSQLHandler = (await import('./sync-clickup-sql.js')).default;
    return syncClickUpSQLHandler(request, env, ctx);
  }
  
  // Endpoint de sincronización masiva
  if (path === '/sync-all-clickup-sql') {
    const syncAllClickUpSQLHandler = (await import('./sync-all-clickup-sql.js')).default;
    return syncAllClickUpSQLHandler(request, env, ctx);
  }
  
  // API endpoints
  if (path === '/api/tables') {
    try {
      const tables = getAllTables();
      return new Response(JSON.stringify({ tables }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  if (path.startsWith('/api/table/')) {
    // Extraer partes del path: /api/table/{tableName}/{action}/{recordId?}
    const pathParts = path.split('/').filter(p => p); // ['api', 'table', 'tableName', 'action', 'recordId?']
    
    if (pathParts.length < 3) {
      return new Response(JSON.stringify({ error: 'Ruta API inválida' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const tableName = pathParts[2]; // 'students', 'practices', etc.
    
    // Validar nombre de tabla
    if (!validateTableName(tableName)) {
      return new Response(JSON.stringify({ error: 'Nombre de tabla inválido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Extraer la acción (schema, data, record) del path normalizado
    const action = pathParts.length > 3 ? pathParts[3] : null;
    
    if (action === 'schema') {
      try {
        const schema = getTableSchema(tableName);
        return new Response(JSON.stringify({ schema }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    if (action === 'data') {
      try {
        const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
        const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50')));
        const search = (url.searchParams.get('search') || '').substring(0, 100); // Limitar búsqueda
        
        const result = getTableData(tableName, page, limit, search);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    if (action === 'record' && method === 'GET') {
      try {
        const recordId = pathParts.length > 4 ? pathParts[4] : null;
        if (!recordId || isNaN(parseInt(recordId))) {
          return new Response(JSON.stringify({ error: 'ID de registro inválido' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        const record = getRecordById(tableName, recordId);
        
        if (!record) {
          return new Response(JSON.stringify({ error: 'Registro no encontrado' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        return new Response(JSON.stringify({ record }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    if (action === 'record' && method === 'PUT') {
      try {
        const recordId = pathParts.length > 4 ? pathParts[4] : null;
        if (!recordId || isNaN(parseInt(recordId))) {
          return new Response(JSON.stringify({ error: 'ID de registro inválido' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        const updates = await request.json();
        
        // Validar que updates sea un objeto
        if (typeof updates !== 'object' || Array.isArray(updates)) {
          return new Response(JSON.stringify({ error: 'Datos de actualización inválidos' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        const result = updateRecord(tableName, recordId, updates);
        
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' },
          status: result.success ? 200 : 400
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
  }
  
  // Página principal
  return new Response(getHTML(), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

/**
 * Genera el HTML de la interfaz
 */
function getHTML() {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Panel SQL - Estudiantes Aurelín</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
      color: #333;
    }
    
    .container {
      max-width: 1400px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      overflow: hidden;
    }
    
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      text-align: center;
    }
    
    .header h1 {
      font-size: 2.5em;
      margin-bottom: 10px;
    }
    
    .header p {
      opacity: 0.9;
      font-size: 1.1em;
    }
    
    .content {
      padding: 30px;
    }
    
    .tables-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    
    .table-card {
      background: #f8f9fa;
      border: 2px solid #e9ecef;
      border-radius: 8px;
      padding: 20px;
      cursor: pointer;
      transition: all 0.3s ease;
    }
    
    .table-card:hover {
      border-color: #667eea;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
    }
    
    .table-card.active {
      border-color: #667eea;
      background: #e7f0ff;
    }
    
    .table-card h3 {
      color: #667eea;
      margin-bottom: 10px;
      font-size: 1.2em;
    }
    
    .table-card p {
      color: #666;
      font-size: 0.9em;
    }
    
    .data-section {
      display: none;
    }
    
    .data-section.active {
      display: block;
    }
    
    .controls {
      display: flex;
      gap: 15px;
      margin-bottom: 20px;
      flex-wrap: wrap;
      align-items: center;
    }
    
    .search-box {
      flex: 1;
      min-width: 200px;
      padding: 12px;
      border: 2px solid #e9ecef;
      border-radius: 6px;
      font-size: 1em;
    }
    
    .search-box:focus {
      outline: none;
      border-color: #667eea;
    }
    
    .btn {
      padding: 12px 24px;
      border: none;
      border-radius: 6px;
      font-size: 1em;
      cursor: pointer;
      transition: all 0.3s ease;
      font-weight: 500;
    }
    
    .btn-primary {
      background: #667eea;
      color: white;
    }
    
    .btn-primary:hover {
      background: #5568d3;
    }
    
    .btn-secondary {
      background: #6c757d;
      color: white;
    }
    
    .btn-secondary:hover {
      background: #5a6268;
    }
    
    .btn-success {
      background: #28a745;
      color: white;
    }
    
    .btn-success:hover {
      background: #218838;
    }
    
    .btn-success:disabled {
      background: #6c757d;
      opacity: 0.6;
      cursor: not-allowed;
    }
    
    .table-wrapper {
      overflow-x: auto;
      border: 1px solid #e9ecef;
      border-radius: 8px;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      background: white;
    }
    
    thead {
      background: #f8f9fa;
    }
    
    th {
      padding: 15px;
      text-align: left;
      font-weight: 600;
      color: #495057;
      border-bottom: 2px solid #dee2e6;
      position: sticky;
      top: 0;
      background: #f8f9fa;
    }
    
    td {
      padding: 12px 15px;
      border-bottom: 1px solid #e9ecef;
    }
    
    td button {
      margin-right: 5px;
    }
    
    td button:last-child {
      margin-right: 0;
    }
    
    tr:hover {
      background: #f8f9fa;
    }
    
    .editable {
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
      transition: background 0.2s;
    }
    
    .editable:hover {
      background: #e7f0ff;
    }
    
    .editable.editing {
      background: #fff3cd;
    }
    
    input[type="text"], input[type="number"], input[type="email"], select {
      width: 100%;
      padding: 6px;
      border: 1px solid #ced4da;
      border-radius: 4px;
      font-size: 0.9em;
    }
    
    .pagination {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 10px;
      margin-top: 20px;
    }
    
    .pagination button {
      padding: 8px 16px;
      border: 1px solid #dee2e6;
      background: white;
      border-radius: 4px;
      cursor: pointer;
    }
    
    .pagination button:hover:not(:disabled) {
      background: #f8f9fa;
    }
    
    .pagination button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .pagination .page-info {
      padding: 8px 16px;
    }
    
    .loading {
      text-align: center;
      padding: 40px;
      color: #667eea;
    }
    
    .error {
      background: #f8d7da;
      color: #721c24;
      padding: 15px;
      border-radius: 6px;
      margin-bottom: 20px;
    }
    
    .success {
      background: #d4edda;
      color: #155724;
      padding: 15px;
      border-radius: 6px;
      margin-bottom: 20px;
    }
    
    .modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.5);
      z-index: 1000;
      align-items: center;
      justify-content: center;
    }
    
    .modal.active {
      display: flex;
    }
    
    .modal-content {
      background: white;
      border-radius: 12px;
      padding: 30px;
      max-width: 600px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
    }
    
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    
    .modal-header h2 {
      color: #667eea;
    }
    
    .close-btn {
      background: none;
      border: none;
      font-size: 2em;
      cursor: pointer;
      color: #999;
    }
    
    .close-btn:hover {
      color: #333;
    }
    
    .form-group {
      margin-bottom: 20px;
    }
    
    .form-group label {
      display: block;
      margin-bottom: 5px;
      font-weight: 500;
      color: #495057;
    }
    
    .form-group input, .form-group select {
      width: 100%;
      padding: 10px;
      border: 1px solid #ced4da;
      border-radius: 6px;
      font-size: 1em;
    }
    
    .form-actions {
      display: flex;
      gap: 10px;
      justify-content: flex-end;
      margin-top: 30px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div style="display: flex; align-items: center; justify-content: center; gap: 20px; flex-wrap: wrap;">
        <img src="https://images.typeform.com/images/tXs4JibWTbvb" alt="Aurelín" style="width: 120px; height: 120px; border-radius: 50%; border: 4px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
        <div>
          <h1>Panel SQL - Estudiantes Aurelín</h1>
          <p>Gestión completa de bases de datos de estudiantes</p>
        </div>
      </div>
    </div>
    
    <div class="content">
      <div id="tables-container" class="tables-grid">
        <div class="loading">Cargando tablas...</div>
      </div>
      
      <div id="data-container"></div>
    </div>
  </div>
  
  <div id="edit-modal" class="modal">
    <div class="modal-content">
      <div class="modal-header">
        <h2>Editar Registro</h2>
        <button class="close-btn" id="modal-close-btn">&times;</button>
      </div>
      <div id="edit-form"></div>
    </div>
  </div>
  
  <script>
    // Variables globales
    let currentTable = null;
    let currentPage = 1;
    let currentSearch = '';
    
    // Hacer funciones globales
    window.currentTable = currentTable;
    window.currentPage = currentPage;
    window.currentSearch = currentSearch;
    
    // Función para detectar el path base correcto
    function getBasePath() {
      // Si estamos en el subdominio SQL, no necesitamos basePath
      const hostname = window.location.hostname;
      const pathname = window.location.pathname;
      
      // Si estamos en el subdominio SQL, usar path vacío
      if (hostname.includes('sqlpdeaurelin')) {
        return '';
      }
      
      // Si estamos en la ruta /sql-admin, usar ese prefijo
      if (pathname.startsWith('/sql-admin')) {
        return '/sql-admin';
      }
      
      // Por defecto, no usar prefijo
      return '';
    }
    
    // Cargar tablas al iniciar
    async function loadTables() {
      try {
        // Detectar la ruta base correcta
        const basePath = getBasePath();
        const url = basePath + '/api/tables';
        console.log('Cargando tablas desde: ' + url + ' hostname: ' + window.location.hostname);
        const response = await fetch(url);
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Error HTTP: ' + response.status + ' - ' + errorText.substring(0, 200));
          throw new Error('Error HTTP: ' + response.status + ' - ' + errorText.substring(0, 100));
        }
        const data = await response.json();
        console.log('Tablas recibidas: ' + JSON.stringify(data));
        renderTables(data.tables);
      } catch (error) {
        console.error('Error cargando tablas: ' + error.message);
        document.getElementById('tables-container').innerHTML = 
          '<div class="error">Error cargando tablas: ' + error.message + '</div>';
      }
    }
    window.loadTables = loadTables;
    
    function renderTables(tables) {
      const container = document.getElementById('tables-container');
      container.innerHTML = tables.map(table => {
        const safeTable = table.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        return '<div class="table-card" data-table="' + safeTable + '">' +
          '<h3>' + table.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</h3>' +
          '<p>Ver y editar datos</p>' +
        '</div>';
      }).join('');
      
      // Agregar event listeners a las tarjetas
      container.querySelectorAll('.table-card').forEach(card => {
        card.addEventListener('click', function() {
          const tableName = this.getAttribute('data-table');
          selectTableHandler(this, tableName);
        });
      });
    }
    window.renderTables = renderTables;
    
    async function selectTableHandler(element, tableName) {
      currentTable = tableName;
      currentPage = 1;
      currentSearch = '';
      
      // Actualizar UI
      document.querySelectorAll('.table-card').forEach(card => {
        card.classList.remove('active');
      });
      if (element) {
        element.classList.add('active');
      }
      
      // Cargar datos
      await loadTableData();
    }
    window.selectTableHandler = selectTableHandler;
    
    async function loadTableData() {
      if (!currentTable) return;
      
      const container = document.getElementById('data-container');
      container.innerHTML = '<div class="loading">Cargando datos...</div>';
      
      try {
        // Detectar la ruta base correcta
        const basePath = getBasePath();
        const url = basePath + '/api/table/' + currentTable + '/data?page=' + currentPage + '&limit=50&search=' + encodeURIComponent(currentSearch);
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('Error HTTP: ' + response.status);
        }
        const data = await response.json();
        
        renderTableData(data);
      } catch (error) {
        container.innerHTML = '<div class="error">Error cargando datos: ' + error.message + '</div>';
      }
    }
    window.loadTableData = loadTableData;
    
    async function renderTableData(data) {
      if (data.data.length === 0) {
        document.getElementById('data-container').innerHTML = 
          '<div class="error">No se encontraron registros</div>';
        return;
      }
      
      // Obtener schema para saber qué columnas mostrar
      const basePath = getBasePath();
      const schemaResponse = await fetch(basePath + '/api/table/' + currentTable + '/schema');
      if (!schemaResponse.ok) {
        throw new Error('Error obteniendo schema: ' + schemaResponse.status);
      }
      const schemaData = await schemaResponse.json();
      const columns = schemaData.schema;
      
      const primaryKeyCol = columns.find(c => c.pk === 1);
      const primaryKeyName = primaryKeyCol ? primaryKeyCol.name : 'id';
      
      const isStudentsTable = currentTable === 'students';
      const syncAllButton = isStudentsTable ? 
        '<button class="btn btn-success" id="sync-all-btn" title="Sincronizar todos los contactos desde ClickUp">Sincronizar Todos</button>' : '';
      
      let html = '<div class="data-section active">' +
        '<div class="controls">' +
          '<input type="text" class="search-box" id="search-input" placeholder="Buscar..." value="' + (currentSearch || '') + '">' +
          '<button class="btn btn-primary" id="search-btn">Buscar</button>' +
          '<button class="btn btn-secondary" id="refresh-btn">Actualizar</button>' +
          (syncAllButton ? ' ' + syncAllButton : '') +
        '</div>' +
        '<div class="table-wrapper">' +
          '<table>' +
            '<thead><tr>' +
              columns.map(col => '<th>' + col.name + '</th>').join('') +
              '<th>Acciones</th>' +
            '</tr></thead>' +
            '<tbody>' +
              data.data.map(record => {
                const recordId = record.id || record[primaryKeyName];
                const safeRecordId = String(recordId || '').replace(/[^0-9]/g, '');
                const email = record.email || '';
                const safeEmail = email.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
                const isStudentsTable = currentTable === 'students';
                // Mostrar botón de sincronizar siempre para la tabla students, incluso si no hay email (se deshabilitará)
                const syncButton = isStudentsTable ? 
                  '<button class="btn btn-success sync-btn" data-email="' + safeEmail + '" title="Sincronizar con ClickUp"' + (email ? '' : ' disabled') + '>Sincronizar</button>' : '';
                return '<tr>' +
                  columns.map(col => {
                    const value = record[col.name];
                    if (value === null || value === undefined) {
                      return '<td><em>null</em></td>';
                    }
                    const strValue = String(value);
                    if (strValue.length > 50) {
                      return '<td title="' + strValue.replace(/"/g, '&quot;').replace(/'/g, '&#39;') + '">' + strValue.substring(0, 50).replace(/</g, '&lt;').replace(/>/g, '&gt;') + '...</td>';
                    }
                    return '<td>' + strValue.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;') + '</td>';
                  }).join('') +
                  '<td style="white-space: nowrap;">' +
                    '<button class="btn btn-primary edit-btn" data-record-id="' + safeRecordId + '">Editar</button>' +
                    (syncButton ? ' ' + syncButton : '') +
                  '</td>' +
                '</tr>';
              }).join('') +
            '</tbody>' +
          '</table>' +
        '</div>' +
        '<div class="pagination">' +
          '<button class="page-btn" data-page="' + (data.page - 1) + '"' + (data.page === 1 ? ' disabled' : '') + '>Anterior</button>' +
          '<span class="page-info">Página ' + data.page + ' de ' + data.totalPages + ' (' + data.total + ' registros)</span>' +
          '<button class="page-btn" data-page="' + (data.page + 1) + '"' + (data.page >= data.totalPages ? ' disabled' : '') + '>Siguiente</button>' +
        '</div>' +
      '</div>';
      
      document.getElementById('data-container').innerHTML = html;
      
      // Agregar event listeners después de renderizar
      const searchInput = document.getElementById('search-input');
      const searchBtn = document.getElementById('search-btn');
      const refreshBtn = document.getElementById('refresh-btn');
      
      if (searchInput) {
        searchInput.addEventListener('keyup', function(e) {
          if (e.key === 'Enter') {
            handleSearch(e);
          }
        });
      }
      
      if (searchBtn) {
        searchBtn.addEventListener('click', function() {
          const input = document.getElementById('search-input');
          if (input) {
            currentSearch = input.value;
            currentPage = 1;
            loadTableData();
          }
        });
      }
      
      if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshData);
      }
      
      // Event listener para botón de sincronización masiva
      const syncAllBtn = document.getElementById('sync-all-btn');
      if (syncAllBtn) {
        syncAllBtn.addEventListener('click', syncAllClickUpSQL);
      }
      
      // Event listeners para botones de editar
      document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          const recordId = this.getAttribute('data-record-id');
          editRecord(recordId);
        });
      });
      
      // Event listeners para botones de sincronización
      document.querySelectorAll('.sync-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          const email = this.getAttribute('data-email');
          if (email) {
            syncClickUpSQL(email, this);
          }
        });
      });
      
      // Event listeners para paginación
      document.querySelectorAll('.page-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          if (!this.disabled) {
            const page = parseInt(this.getAttribute('data-page'));
            changePage(page);
          }
        });
      });
    }
    
    function changePage(page) {
      currentPage = page;
      loadTableData();
    }
    window.changePage = changePage;
    
    function handleSearch(event) {
      if (event && event.key === 'Enter') {
        currentSearch = event.target.value;
        currentPage = 1;
        loadTableData();
      }
    }
    window.handleSearch = handleSearch;
    
    function refreshData() {
      loadTableData();
    }
    window.refreshData = refreshData;
    
    async function syncClickUpSQL(email, buttonElement) {
      if (!email) {
        alert('No se puede sincronizar: falta email');
        return;
      }
      
      // Deshabilitar botón mientras se sincroniza
      if (buttonElement) {
        buttonElement.disabled = true;
        buttonElement.textContent = 'Sincronizando...';
      }
      
      try {
        // Detectar la ruta base correcta
        const basePath = getBasePath();
        const response = await fetch(basePath + '/sync-clickup-sql?email=' + encodeURIComponent(email) + '&direccion=bidireccional');
        const data = await response.json();
        
        if (data.success && data.resultado) {
          const resultado = data.resultado;
          let mensaje = 'Sincronización completada';
          
          if (resultado.clickUpASQL && resultado.clickUpASQL.cambios > 0) {
            mensaje += ' (ClickUp → SQL: ' + resultado.clickUpASQL.cambios + ' cambios)';
          }
          if (resultado.sqlAClickUp && resultado.sqlAClickUp.cambios > 0) {
            mensaje += ' (SQL → ClickUp: ' + resultado.sqlAClickUp.cambios + ' cambios)';
          }
          
          if ((!resultado.clickUpASQL || resultado.clickUpASQL.cambios === 0) && 
              (!resultado.sqlAClickUp || resultado.sqlAClickUp.cambios === 0)) {
            mensaje = 'No hay cambios para sincronizar';
          }
          
          showMessage(mensaje, 'success');
          
          // Recargar datos después de sincronizar
          setTimeout(() => {
            loadTableData();
          }, 1000);
        } else {
          const errorMsg = data.error || 'Error desconocido';
          showMessage('Error sincronizando: ' + errorMsg, 'error');
        }
      } catch (error) {
        showMessage('❌ Error sincronizando: ' + error.message, 'error');
      } finally {
        // Rehabilitar botón
        if (buttonElement) {
          buttonElement.disabled = false;
          buttonElement.textContent = 'Sincronizar';
        }
      }
    }
    window.syncClickUpSQL = syncClickUpSQL;
    
    async function syncAllClickUpSQL() {
      const buttonElement = document.getElementById('sync-all-btn');
      if (!buttonElement) return;
      
      // Confirmar acción
      if (!confirm('¿Sincronizar todos los contactos desde ClickUp? Esto puede tardar varios minutos.')) {
        return;
      }
      
      // Deshabilitar botón mientras se sincroniza
      buttonElement.disabled = true;
      buttonElement.textContent = '⏳ Sincronizando...';
      
      try {
        // Detectar la ruta base correcta
        const basePath = getBasePath();
        const response = await fetch(basePath + '/sync-all-clickup-sql?direccion=clickup-sql');
        const data = await response.json();
        
        if (data.success && data.resultados) {
          const resultados = data.resultados;
          let mensaje = 'Sincronización masiva completada: Total: ' + resultados.total + 
            ', Exitosos: ' + resultados.exitosos + 
            ', Fallidos: ' + resultados.fallidos + 
            ', Sin email: ' + resultados.sinEmail;
          
          if (resultados.detalles && resultados.detalles.length > 0) {
            const actualizados = resultados.detalles.filter(d => d.estado === 'actualizado').length;
            if (actualizados > 0) {
              mensaje += ', Actualizados: ' + actualizados;
            }
          }
          
          showMessage(mensaje, 'success');
          
          // Recargar datos después de sincronizar
          setTimeout(() => {
            loadTableData();
          }, 2000);
        } else {
          const errorMsg = data.error || 'Error desconocido';
          showMessage('Error en sincronización masiva: ' + errorMsg, 'error');
        }
      } catch (error) {
        showMessage('❌ Error sincronizando: ' + error.message, 'error');
      } finally {
        // Rehabilitar botón
        buttonElement.disabled = false;
        buttonElement.textContent = 'Sincronizar Todos';
      }
    }
    window.syncAllClickUpSQL = syncAllClickUpSQL;
    
    async function editRecord(recordId) {
      try {
        const basePath = getBasePath();
        const response = await fetch(basePath + '/api/table/' + currentTable + '/record/' + recordId);
        const data = await response.json();
        
        if (!data.record) {
          alert('Registro no encontrado');
          return;
        }
        
        // Obtener schema
        const schemaResponse = await fetch(basePath + '/api/table/' + currentTable + '/schema');
        if (!schemaResponse.ok) {
          throw new Error('Error obteniendo schema: ' + schemaResponse.status);
        }
        const schemaData = await schemaResponse.json();
        const columns = schemaData.schema;
        const primaryKey = columns.find(col => col.pk === 1)?.name || 'id';
        
        // Crear formulario
        const formHtml = columns
          .filter(col => col.name !== primaryKey && !col.name.includes('_local') && col.name !== 'created_at')
          .map(col => {
            const value = data.record[col.name] || '';
            const strValue = String(value).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
            const isBoolean = col.type && col.type.toUpperCase().includes('INTEGER') && 
                            (col.name.includes('tiene_') || col.name.includes('suscripcion_') || 
                             col.name.includes('activa') || col.name.includes('pausada'));
            
            if (isBoolean) {
              const selected0 = (value === 0 || value === '0') ? ' selected' : '';
              const selected1 = (value === 1 || value === '1') ? ' selected' : '';
              return '<div class="form-group">' +
                '<label>' + col.name + '</label>' +
                '<select id="field-' + col.name + '">' +
                  '<option value="0"' + selected0 + '>No (0)</option>' +
                  '<option value="1"' + selected1 + '>Sí (1)</option>' +
                '</select>' +
              '</div>';
            }
            
            return '<div class="form-group">' +
              '<label>' + col.name + '</label>' +
              '<input type="text" id="field-' + col.name + '" value="' + strValue + '">' +
            '</div>';
          }).join('');
        
        document.getElementById('edit-form').innerHTML = formHtml +
          '<div class="form-actions">' +
            '<button class="btn btn-secondary" id="cancel-btn">Cancelar</button>' +
            '<button class="btn btn-primary" id="save-btn" data-record-id="' + recordId + '">Guardar</button>' +
          '</div>';
        
        document.getElementById('edit-modal').classList.add('active');
        
        // Agregar event listeners a los botones del modal
        const cancelBtn = document.getElementById('cancel-btn');
        const saveBtn = document.getElementById('save-btn');
        
        if (cancelBtn) {
          cancelBtn.addEventListener('click', closeModal);
        }
        
        if (saveBtn) {
          saveBtn.addEventListener('click', function() {
            const recordId = this.getAttribute('data-record-id');
            saveRecord(recordId);
          });
        }
      } catch (error) {
        alert('Error cargando registro: ' + error.message);
      }
    }
    window.editRecord = editRecord;
    
    async function saveRecord(recordId) {
      const basePath = getBasePath();
      const schemaResponse = await fetch(basePath + '/api/table/' + currentTable + '/schema');
      const schemaData = await schemaResponse.json();
      const columns = schemaData.schema;
      const primaryKey = columns.find(col => col.pk === 1)?.name || 'id';
      
      const updates = {};
      columns
        .filter(col => col.name !== primaryKey && !col.name.includes('_local') && col.name !== 'created_at')
        .forEach(col => {
          const input = document.getElementById('field-' + col.name);
          if (input) {
            updates[col.name] = input.value;
          }
        });
      
      try {
        const response = await fetch(basePath + '/api/table/' + currentTable + '/record/' + recordId, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(updates)
        });
        
        const result = await response.json();
        
        if (result.success) {
          closeModal();
          loadTableData();
          showMessage('Registro actualizado correctamente', 'success');
        } else {
          alert('Error: ' + result.error);
        }
      } catch (error) {
        alert('Error guardando: ' + error.message);
      }
    }
    window.saveRecord = saveRecord;
    
    function closeModal() {
      document.getElementById('edit-modal').classList.remove('active');
    }
    window.closeModal = closeModal;
    
    function showMessage(message, type) {
      const container = document.getElementById('data-container');
      const messageDiv = document.createElement('div');
      messageDiv.className = type;
      messageDiv.textContent = message;
      container.insertBefore(messageDiv, container.firstChild);
      
      setTimeout(() => {
        messageDiv.remove();
      }, 3000);
    }
    window.showMessage = showMessage;
    
    // Cerrar modal al hacer clic fuera
    const editModal = document.getElementById('edit-modal');
    if (editModal) {
      editModal.addEventListener('click', function(e) {
        if (e.target === this) {
          closeModal();
        }
      });
    }
    
    // Botón de cerrar modal
    const modalCloseBtn = document.getElementById('modal-close-btn');
    if (modalCloseBtn) {
      modalCloseBtn.addEventListener('click', closeModal);
    }
    
    // Inicializar
    loadTables();
  </script>
</body>
</html>`;
}

