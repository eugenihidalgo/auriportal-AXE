// database/db.js
// ⚠️ SQLITE ELIMINADO DEFINITIVAMENTE - NO USAR
// AuriPortal v4+ usa PostgreSQL como único Source of Truth
// Este archivo existe solo para fail-hard explícito

/**
 * FAIL-HARD: SQLite está eliminado definitivamente
 * NO se debe importar ni usar este archivo bajo ninguna circunstancia
 */
function failHardSQLite() {
  throw new Error(
    'SQLite está eliminado definitivamente. ' +
    'AuriPortal v4+ usa PostgreSQL (database/pg.js) como único Source of Truth. ' +
    'NO se permite importar database/db.js en runtime.'
  );
}

export function getDatabase() {
  failHardSQLite();
}

export const students = {
  find: () => { failHardSQLite(); },
  create: () => { failHardSQLite(); },
  update: () => { failHardSQLite(); }
};

export function initDatabase() {
  failHardSQLite();
}
