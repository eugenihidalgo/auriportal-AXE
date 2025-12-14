// scripts/generate-html-report.js
// Genera un archivo HTML estático con todos los datos de Kajabi
// Puedes abrirlo directamente en tu navegador sin servidor

import Database from 'better-sqlite3';
import { writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = process.env.DB_PATH || join(__dirname, '..', 'database', 'aurelinportal.db');
const OUTPUT_PATH = join(__dirname, '..', 'kajabi-data-report.html');

if (!existsSync(DB_PATH)) {
  console.error(`❌ Base de datos no encontrada en: ${DB_PATH}`);
  console.error(`   Copia la base de datos desde el servidor primero.`);
  process.exit(1);
}

console.log('📊 Generando reporte HTML de datos de Kajabi...');

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

// Obtener estadísticas
const stats = {
  contacts: db.prepare("SELECT COUNT(*) as total FROM kajabi_contacts").get().total || 0,
  purchases: db.prepare("SELECT COUNT(*) as total FROM kajabi_purchases_complete").get().total || 0,
  purchasesActive: db.prepare("SELECT COUNT(*) as total FROM kajabi_purchases_complete WHERE is_active = 1").get().total || 0,
  purchasesInactive: db.prepare("SELECT COUNT(*) as total FROM kajabi_purchases_complete WHERE is_active = 0").get().total || 0,
  transactions: db.prepare("SELECT COUNT(*) as total FROM kajabi_transactions").get().total || 0,
  products: db.prepare("SELECT COUNT(*) as total FROM kajabi_products_catalog").get().total || 0,
  courses: db.prepare("SELECT COUNT(*) as total FROM kajabi_courses_catalog").get().total || 0,
  offers: db.prepare("SELECT COUNT(*) as total FROM kajabi_offers_catalog").get().total || 0
};

// Obtener datos
const contacts = db.prepare("SELECT * FROM kajabi_contacts ORDER BY created_at DESC LIMIT 200").all();
const purchases = db.prepare(`
  SELECT p.*, c.email, c.name 
  FROM kajabi_purchases_complete p
  LEFT JOIN kajabi_contacts c ON p.contact_id = c.id
  ORDER BY p.created_at DESC LIMIT 200
`).all();
const subscriptions = db.prepare(`
  SELECT p.*, c.email, c.name 
  FROM kajabi_purchases_complete p
  LEFT JOIN kajabi_contacts c ON p.contact_id = c.id
  WHERE p.is_subscription = 1
  ORDER BY p.deactivated_at DESC LIMIT 200
`).all();
const transactions = db.prepare("SELECT * FROM kajabi_transactions ORDER BY created_at DESC LIMIT 200").all();
const products = db.prepare("SELECT * FROM kajabi_products_catalog ORDER BY title LIMIT 100").all();
const courses = db.prepare("SELECT * FROM kajabi_courses_catalog ORDER BY title LIMIT 100").all();
const offers = db.prepare("SELECT * FROM kajabi_offers_catalog ORDER BY title LIMIT 100").all();

// Generar HTML
const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reporte Completo - Datos de Kajabi</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
    }
    .header {
      background: white;
      border-radius: 12px;
      padding: 30px;
      margin-bottom: 30px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .header h1 {
      color: #333;
      margin-bottom: 10px;
      font-size: 2rem;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .stat-card {
      background: white;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      text-align: center;
    }
    .stat-card .number {
      font-size: 2.5rem;
      font-weight: bold;
      color: #667eea;
      margin-bottom: 10px;
    }
    .stat-card .label {
      color: #666;
      font-size: 0.9rem;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .section {
      background: white;
      border-radius: 12px;
      padding: 30px;
      margin-bottom: 30px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .section h2 {
      color: #333;
      margin-bottom: 20px;
      font-size: 1.5rem;
      padding-bottom: 10px;
      border-bottom: 2px solid #667eea;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #eee;
    }
    th {
      background: #f8f9fa;
      font-weight: 600;
      color: #333;
      position: sticky;
      top: 0;
    }
    tr:hover {
      background: #f8f9fa;
    }
    .badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 0.8rem;
      font-weight: 600;
    }
    .badge-success {
      background: #d4edda;
      color: #155724;
    }
    .badge-danger {
      background: #f8d7da;
      color: #721c24;
    }
    .badge-warning {
      background: #fff3cd;
      color: #856404;
    }
    .toc {
      background: white;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 30px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .toc h2 {
      margin-bottom: 15px;
      color: #333;
    }
    .toc a {
      display: block;
      padding: 8px 0;
      color: #667eea;
      text-decoration: none;
      border-bottom: 1px solid #eee;
    }
    .toc a:hover {
      color: #764ba2;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 Reporte Completo - Datos de Kajabi</h1>
      <p>Generado el ${new Date().toLocaleString('es-ES')}</p>
    </div>
    
    <div class="stats-grid">
      <div class="stat-card">
        <div class="number">${stats.contacts}</div>
        <div class="label">Contactos</div>
      </div>
      <div class="stat-card">
        <div class="number">${stats.purchases}</div>
        <div class="label">Compras</div>
      </div>
      <div class="stat-card">
        <div class="number">${stats.purchasesActive}</div>
        <div class="label">Suscripciones Activas</div>
      </div>
      <div class="stat-card">
        <div class="number">${stats.purchasesInactive}</div>
        <div class="label">Suscripciones Inactivas</div>
      </div>
      <div class="stat-card">
        <div class="number">${stats.transactions}</div>
        <div class="label">Transacciones</div>
      </div>
      <div class="stat-card">
        <div class="number">${stats.products}</div>
        <div class="label">Productos</div>
      </div>
      <div class="stat-card">
        <div class="number">${stats.courses}</div>
        <div class="label">Cursos</div>
      </div>
      <div class="stat-card">
        <div class="number">${stats.offers}</div>
        <div class="label">Ofertas</div>
      </div>
    </div>
    
    <div class="toc">
      <h2>📑 Índice</h2>
      <a href="#contacts">👥 Contactos</a>
      <a href="#purchases">🛒 Compras</a>
      <a href="#subscriptions">💳 Suscripciones</a>
      <a href="#transactions">💰 Transacciones</a>
      <a href="#catalog">📦 Catálogo</a>
    </div>
    
    <div id="contacts" class="section">
      <h2>👥 Contactos (${contacts.length})</h2>
      <table>
        <thead>
          <tr>
            <th>Email</th>
            <th>Nombre</th>
            <th>Teléfono</th>
            <th>Ciudad</th>
            <th>País</th>
            <th>Mundo de Luz</th>
            <th>Creado</th>
          </tr>
        </thead>
        <tbody>
          ${contacts.map(c => `
            <tr>
              <td>${c.email || 'N/A'}</td>
              <td>${c.name || 'N/A'}</td>
              <td>${c.phone || 'N/A'}</td>
              <td>${c.city || 'N/A'}</td>
              <td>${c.country || 'N/A'}</td>
              <td>${c.tiene_mundo_de_luz ? '✅' : '❌'}</td>
              <td>${c.created_at ? new Date(c.created_at).toLocaleString('es-ES') : 'N/A'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    
    <div id="purchases" class="section">
      <h2>🛒 Compras (${purchases.length})</h2>
      <table>
        <thead>
          <tr>
            <th>Email</th>
            <th>Nombre</th>
            <th>Monto</th>
            <th>Estado</th>
            <th>Tipo</th>
            <th>Desactivada</th>
            <th>Razón</th>
            <th>Creada</th>
          </tr>
        </thead>
        <tbody>
          ${purchases.map(p => `
            <tr>
              <td>${p.email || 'N/A'}</td>
              <td>${p.name || 'N/A'}</td>
              <td>${p.amount_in_cents ? (p.amount_in_cents / 100).toFixed(2) + ' ' + (p.currency || 'USD') : 'N/A'}</td>
              <td><span class="badge ${p.is_active ? 'badge-success' : 'badge-danger'}">${p.is_active ? 'Activa' : 'Inactiva'}</span></td>
              <td>${p.is_subscription ? 'Suscripción' : 'Pago único'}</td>
              <td>${p.deactivated_at ? new Date(p.deactivated_at).toLocaleString('es-ES') : '-'}</td>
              <td>${p.deactivation_reason || '-'}</td>
              <td>${p.created_at ? new Date(p.created_at).toLocaleString('es-ES') : 'N/A'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    
    <div id="subscriptions" class="section">
      <h2>💳 Suscripciones (${subscriptions.length})</h2>
      <table>
        <thead>
          <tr>
            <th>Email</th>
            <th>Nombre</th>
            <th>Monto</th>
            <th>Estado</th>
            <th>Inicio</th>
            <th>Desactivada</th>
            <th>Razón</th>
          </tr>
        </thead>
        <tbody>
          ${subscriptions.map(p => `
            <tr>
              <td>${p.email || 'N/A'}</td>
              <td>${p.name || 'N/A'}</td>
              <td>${p.amount_in_cents ? (p.amount_in_cents / 100).toFixed(2) + ' ' + (p.currency || 'USD') : 'N/A'}</td>
              <td><span class="badge ${p.is_active ? 'badge-success' : 'badge-danger'}">${p.is_active ? '✅ Activa' : '❌ Inactiva'}</span></td>
              <td>${p.effective_start_at ? new Date(p.effective_start_at).toLocaleString('es-ES') : 'N/A'}</td>
              <td>${p.deactivated_at ? new Date(p.deactivated_at).toLocaleString('es-ES') : '-'}</td>
              <td><span class="badge badge-danger">${p.deactivation_reason || '-'}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    
    <div id="transactions" class="section">
      <h2>💰 Transacciones (${transactions.length})</h2>
      <table>
        <thead>
          <tr>
            <th>Acción</th>
            <th>Estado</th>
            <th>Monto</th>
            <th>Tipo Pago</th>
            <th>Fecha</th>
          </tr>
        </thead>
        <tbody>
          ${transactions.map(t => `
            <tr>
              <td>${t.action || 'N/A'}</td>
              <td><span class="badge ${t.state === 'succeeded' ? 'badge-success' : t.state === 'failed' ? 'badge-danger' : 'badge-warning'}">${t.state || 'N/A'}</span></td>
              <td>${t.formatted_amount || (t.amount_in_cents ? (t.amount_in_cents / 100).toFixed(2) + ' ' + (t.currency || 'USD') : 'N/A')}</td>
              <td>${t.payment_type || 'N/A'}</td>
              <td>${t.created_at ? new Date(t.created_at).toLocaleString('es-ES') : 'N/A'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    
    <div id="catalog" class="section">
      <h2>📦 Catálogo</h2>
      
      <h3 style="margin-top: 30px; margin-bottom: 15px;">Productos (${products.length})</h3>
      <table>
        <thead>
          <tr>
            <th>Título</th>
            <th>Estado</th>
            <th>Publicación</th>
            <th>Miembros</th>
          </tr>
        </thead>
        <tbody>
          ${products.map(p => `
            <tr>
              <td>${p.title || 'N/A'}</td>
              <td>${p.status || 'N/A'}</td>
              <td>${p.publish_status || 'N/A'}</td>
              <td>${p.members_aggregate_count || 0}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <h3 style="margin-top: 30px; margin-bottom: 15px;">Cursos (${courses.length})</h3>
      <table>
        <thead>
          <tr>
            <th>Título</th>
            <th>Estado</th>
            <th>Publicación</th>
          </tr>
        </thead>
        <tbody>
          ${courses.map(c => `
            <tr>
              <td>${c.title || 'N/A'}</td>
              <td>${c.status || 'N/A'}</td>
              <td>${c.publish_status || 'N/A'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <h3 style="margin-top: 30px; margin-bottom: 15px;">Ofertas (${offers.length})</h3>
      <table>
        <thead>
          <tr>
            <th>Título</th>
            <th>Precio</th>
            <th>Tipo</th>
            <th>Suscripción</th>
          </tr>
        </thead>
        <tbody>
          ${offers.map(o => `
            <tr>
              <td>${o.title || 'N/A'}</td>
              <td>${o.price_in_cents ? (o.price_in_cents / 100).toFixed(2) + ' ' + (o.currency || 'USD') : 'N/A'}</td>
              <td>${o.one_time ? 'Pago único' : o.subscription ? 'Suscripción' : 'N/A'}</td>
              <td>${o.subscription ? '✅' : '❌'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>
`;

writeFileSync(OUTPUT_PATH, html);
console.log(`✅ Reporte HTML generado: ${OUTPUT_PATH}`);
console.log(`📄 Abre el archivo en tu navegador para ver todos los datos.`);

db.close();






