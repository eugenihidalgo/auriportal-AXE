// src/infra/repos/pause-profiles-repo-pg.js
// Implementación PostgreSQL del Repositorio de Perfiles de Pausa

import { query } from '../../../database/pg.js';

/**
 * Repositorio de Perfiles de Pausa - Implementación PostgreSQL
 */
export class PauseProfilesRepoPg {
  async getByKey(profileKey, client = null) {
    if (!profileKey) return null;

    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'SELECT * FROM pause_profiles WHERE profile_key = $1 AND status = $2',
      [profileKey, 'active']
    );
    return result.rows[0] || null;
  }

  async listActive(client = null) {
    const queryFn = client ? client.query.bind(client) : query;
    const result = await queryFn(
      'SELECT * FROM pause_profiles WHERE status = $1 ORDER BY profile_key',
      ['active']
    );
    return result.rows || [];
  }
}

// Exportar instancia singleton por defecto
let defaultInstance = null;
export function getDefaultPauseProfilesRepo() {
  if (!defaultInstance) {
    defaultInstance = new PauseProfilesRepoPg();
  }
  return defaultInstance;
}

export default getDefaultPauseProfilesRepo();


