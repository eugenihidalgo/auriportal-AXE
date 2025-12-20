// src/core/preview/mock-profiles.js
// Mock Profiles v1 - Presets de PreviewContext para el Admin
//
// PRINCIPIOS:
// - Presets editables almacenados en localStorage
// - No usar base de datos todavía
// - Cada preset genera un PreviewContext base
//
// SPRINT AXE v0.3 - Preview Harness Unificado

import { normalizePreviewContext } from './preview-context.js';
import { logInfo, logWarn } from '../observability/logger.js';

/**
 * Presets por defecto de Mock Profiles
 */
const DEFAULT_PROFILES = {
  'basica': {
    id: 'basica',
    name: 'Básica',
    description: 'Estudiante nuevo, nivel inicial',
    preview_context: {
      student: {
        nivel: "1",
        nivel_efectivo: 1,
        estado: "activo",
        energia: 50,
        racha: 1,
        email: "basica@preview.example.com",
        nombre: "Estudiante Básico"
      },
      fecha_simulada: new Date().toISOString(),
      flags: {},
      preview_mode: true,
      navigation_id: null
    }
  },
  'profunda': {
    id: 'profunda',
    name: 'Profunda',
    description: 'Estudiante intermedio, nivel medio-alto',
    preview_context: {
      student: {
        nivel: "7",
        nivel_efectivo: 7,
        estado: "activo",
        energia: 75,
        racha: 45,
        email: "profunda@preview.example.com",
        nombre: "Estudiante Profundo"
      },
      fecha_simulada: new Date().toISOString(),
      flags: {},
      preview_mode: true,
      navigation_id: null
    }
  },
  'maestro': {
    id: 'maestro',
    name: 'Maestro',
    description: 'Estudiante avanzado, nivel alto',
    preview_context: {
      student: {
        nivel: "12",
        nivel_efectivo: 12,
        estado: "activo",
        energia: 90,
        racha: 200,
        email: "maestro@preview.example.com",
        nombre: "Estudiante Maestro"
      },
      fecha_simulada: new Date().toISOString(),
      flags: {},
      preview_mode: true,
      navigation_id: null
    }
  }
};

const STORAGE_KEY = 'auriportal_mock_profiles_v1';

/**
 * Mock Profile structure
 * @typedef {Object} MockProfile
 * @property {string} id - ID único del profile
 * @property {string} name - Nombre legible
 * @property {string} description - Descripción del profile
 * @property {Object} preview_context - PreviewContext asociado
 * @property {string} updated_at - Timestamp de última actualización (ISO string)
 */

/**
 * Obtiene todos los Mock Profiles desde localStorage
 * Si no existen, inicializa con los defaults
 * @returns {Object<string, MockProfile>} Map de profiles por ID
 */
export function getMockProfiles() {
  if (typeof window === 'undefined' || !window.localStorage) {
    // Server-side: devolver defaults
    logWarn('MockProfiles', 'localStorage no disponible, usando defaults');
    return DEFAULT_PROFILES;
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      // Primera vez: inicializar con defaults
      saveMockProfiles(DEFAULT_PROFILES);
      return DEFAULT_PROFILES;
    }

    const parsed = JSON.parse(stored);
    
    // Merge con defaults para asegurar que siempre existan los presets base
    const merged = { ...DEFAULT_PROFILES, ...parsed };
    
    // Validar que los defaults estén presentes
    for (const [id, defaultProfile] of Object.entries(DEFAULT_PROFILES)) {
      if (!merged[id] || merged[id].id !== id) {
        merged[id] = { ...defaultProfile };
      }
    }

    return merged;
  } catch (error) {
    logWarn('MockProfiles', 'Error leyendo profiles desde localStorage', {
      error: error.message
    });
    return DEFAULT_PROFILES;
  }
}

/**
 * Guarda Mock Profiles en localStorage
 * @param {Object<string, MockProfile>} profiles - Map de profiles
 */
export function saveMockProfiles(profiles) {
  if (typeof window === 'undefined' || !window.localStorage) {
    logWarn('MockProfiles', 'localStorage no disponible, no se puede guardar');
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
    logInfo('MockProfiles', 'Profiles guardados en localStorage', {
      count: Object.keys(profiles).length
    });
  } catch (error) {
    logWarn('MockProfiles', 'Error guardando profiles en localStorage', {
      error: error.message
    });
  }
}

/**
 * Obtiene un Mock Profile por ID
 * @param {string} profileId - ID del profile
 * @returns {MockProfile|null} Profile o null si no existe
 */
export function getMockProfile(profileId) {
  const profiles = getMockProfiles();
  return profiles[profileId] || null;
}

/**
 * Crea o actualiza un Mock Profile
 * @param {MockProfile} profile - Profile a guardar
 * @returns {MockProfile} Profile guardado (normalizado)
 */
export function saveMockProfile(profile) {
  if (!profile || !profile.id) {
    throw new Error('Profile debe tener id');
  }

  const profiles = getMockProfiles();
  
  // Normalizar preview_context
  const { context: normalizedContext, warnings } = normalizePreviewContext(
    profile.preview_context || {}
  );

  if (warnings.length > 0) {
    logWarn('MockProfiles', 'Warnings al normalizar preview_context', {
      profile_id: profile.id,
      warnings
    });
  }

  const updatedProfile = {
    ...profile,
    preview_context: normalizedContext,
    updated_at: new Date().toISOString()
  };

  profiles[profile.id] = updatedProfile;
  saveMockProfiles(profiles);

  logInfo('MockProfiles', 'Profile guardado', {
    profile_id: profile.id,
    name: profile.name
  });

  return updatedProfile;
}

/**
 * Elimina un Mock Profile (solo si no es un preset por defecto)
 * @param {string} profileId - ID del profile a eliminar
 * @returns {boolean} true si se eliminó, false si no existe o es preset
 */
export function deleteMockProfile(profileId) {
  if (DEFAULT_PROFILES[profileId]) {
    logWarn('MockProfiles', 'No se puede eliminar un preset por defecto', {
      profile_id: profileId
    });
    return false;
  }

  const profiles = getMockProfiles();
  if (!profiles[profileId]) {
    return false;
  }

  delete profiles[profileId];
  saveMockProfiles(profiles);

  logInfo('MockProfiles', 'Profile eliminado', {
    profile_id: profileId
  });

  return true;
}

/**
 * Crea un PreviewContext desde un Mock Profile ID
 * @param {string} profileId - ID del profile
 * @returns {{context: PreviewContext, warnings: string[]}}
 */
export function createPreviewContextFromProfileId(profileId) {
  const profile = getMockProfile(profileId);
  
  if (!profile) {
    logWarn('MockProfiles', 'Profile no encontrado, usando default', {
      profile_id: profileId
    });
    return normalizePreviewContext(DEFAULT_PROFILES.basica.preview_context);
  }

  return normalizePreviewContext(profile.preview_context);
}

/**
 * Lista todos los Mock Profiles (para UI)
 * @returns {MockProfile[]} Array de profiles
 */
export function listMockProfiles() {
  const profiles = getMockProfiles();
  return Object.values(profiles).sort((a, b) => {
    // Presets primero (orden: basica, profunda, maestro)
    const presetOrder = { 'basica': 0, 'profunda': 1, 'maestro': 2 };
    const aOrder = presetOrder[a.id] !== undefined ? presetOrder[a.id] : 999;
    const bOrder = presetOrder[b.id] !== undefined ? presetOrder[b.id] : 999;
    
    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }
    
    // Luego por nombre
    return (a.name || '').localeCompare(b.name || '');
  });
}

export default {
  getMockProfiles,
  saveMockProfiles,
  getMockProfile,
  saveMockProfile,
  deleteMockProfile,
  createPreviewContextFromProfileId,
  listMockProfiles,
  DEFAULT_PROFILES
};






