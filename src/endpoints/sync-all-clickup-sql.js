// src/endpoints/sync-all-clickup-sql.js
// Endpoint para sincronización masiva de todos los contactos ClickUp ↔ SQL (LEGACY - DESHABILITADO)
// Este endpoint ha sido deshabilitado porque usa SQLite legacy.
// La sincronización ahora se realiza directamente con PostgreSQL v4.

import { gone } from "../core/http/gone.js";

/**
 * Sincroniza todos los contactos desde ClickUp a SQL
 */
export default async function syncAllClickUpSQLHandler(request, env, ctx) {
  return gone(
    "Este endpoint ha sido deprecado. La sincronización masiva ClickUp ↔ SQLite ya no está disponible. Usa los módulos v4 de PostgreSQL.",
    "sync-all-clickup-sql-disabled",
    request
  );
}







