// database/db.js
// STUB para compatibilidad con archivos legacy
// AuriPortal v4 usa PostgreSQL, este archivo es solo para evitar errores de import

console.warn('⚠️  database/db.js (SQLite) está deprecado. Usa database/pg.js (PostgreSQL) en su lugar.');

// Exportar funciones stub para compatibilidad
export function getDatabase() {
  throw new Error('SQLite está deprecado. Usa PostgreSQL (database/pg.js) en su lugar.');
}

export const students = {
  find: () => { throw new Error('SQLite está deprecado'); },
  create: () => { throw new Error('SQLite está deprecado'); },
  update: () => { throw new Error('SQLite está deprecado'); }
};

export function initDatabase() {
  console.warn('⚠️  initDatabase() está deprecado. Usa initPostgreSQL() en su lugar.');
}
