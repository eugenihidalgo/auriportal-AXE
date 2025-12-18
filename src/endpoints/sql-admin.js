// src/endpoints/sql-admin.js
// Panel de administración SQL para ver y editar bases de datos de alumnos de Kajabi (LEGACY - DESHABILITADO)
// Este endpoint ha sido deshabilitado porque usa SQLite legacy.
// Usa admin-panel-v4.js para administración con PostgreSQL.

import { gone } from '../core/http/gone.js';

/**
 * Handler principal del panel SQL (DESHABILITADO)
 */
export default async function sqlAdminHandler(request, env, ctx) {
  return gone(
    "Este endpoint ha sido deprecado. El panel SQL admin ya no está disponible. Usa /admin para administración con PostgreSQL v4.",
    "sql-admin-disabled",
    request
  );
}
