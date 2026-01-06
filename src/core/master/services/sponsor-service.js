// src/core/master/services/sponsor-service.js
// Servicio Canónico de Apadrinados (Sponsors) v1
//
// RESPONSABILIDADES:
// - Lógica de negocio pura (sin UI, sin repos directos)
// - Invariantes: nodo dependiente, archivar si sin vínculos
// - Gestión de cuidados especiales
// - Emisión de señales con TARGET_REF
//
// PROHIBIDO:
// - Lógica de UI
// - Cálculos en frontend
// - Decisiones sin validación

import { getDefaultSponsorCatalogRepo } from '../../../infra/repos/sponsors/sponsor-catalog-repo-pg.js';
import { getDefaultSponsorLinksRepo } from '../../../infra/repos/sponsors/sponsor-links-repo-pg.js';
import { getDefaultSponsorSpecialCareRepo } from '../../../infra/repos/sponsors/sponsor-special-care-repo-pg.js';
import { getDefaultStudentRepo } from '../../../infra/repos/student-repo-pg.js';
import { dispatchSignal } from '../../signals/signal-dispatcher.js';
import { logInfo, logWarn, logError } from '../../observability/logger.js';
import { getRequestId } from '../../observability/request-context.js';

const sponsorCatalogRepo = getDefaultSponsorCatalogRepo();
const sponsorLinksRepo = getDefaultSponsorLinksRepo();
const sponsorCareRepo = getDefaultSponsorSpecialCareRepo();
const studentRepo = getDefaultStudentRepo();

/**
 * Computa target_ref para un sponsor (TARGET_REF_CONTRACT v1)
 */
function computeTargetRef(sponsorId) {
  return {
    target_type: 'sponsor',
    target_id: sponsorId
  };
}

/**
 * Crea un nuevo apadrinado y vincula estudiantes
 * 
 * Invariantes:
 * - Sponsor existe operativamente si tiene >=1 vínculo activo
 * - Si se crea sin vínculos, queda archived
 */
export async function createSponsor(data, options = {}) {
  const { display_name, description = null, student_ids = [], meta = {} } = data;
  const { traceId = null, authCtx = {} } = options;
  const finalTraceId = traceId || getRequestId();

  logInfo('SponsorService', '[SPONSOR][CREATE] Iniciando creación', {
    display_name,
    student_ids_count: student_ids.length,
    traceId: finalTraceId
  });

  try {
    // 1. Crear sponsor
    const sponsor = await sponsorCatalogRepo.create({
      display_name,
      description,
      meta
    });

    // 2. Vincular estudiantes
    const linkedStudents = [];
    for (const studentId of student_ids) {
      try {
        // Verificar que el estudiante existe
        const student = await studentRepo.getById(studentId);
        if (!student) {
          logWarn('SponsorService', '[SPONSOR][CREATE] Estudiante no encontrado, saltando', {
            student_id: studentId,
            sponsor_id: sponsor.id
          });
          continue;
        }

        const link = await sponsorLinksRepo.link(sponsor.id, studentId);
        if (link) {
          linkedStudents.push(studentId);
        }
      } catch (linkError) {
        logError('SponsorService', '[SPONSOR][CREATE] Error vinculando estudiante', {
          student_id: studentId,
          sponsor_id: sponsor.id,
          error: linkError.message
        });
      }
    }

    // 3. Invariante: si no tiene vínculos, archivar
    if (linkedStudents.length === 0) {
      await sponsorCatalogRepo.archive(sponsor.id);
      sponsor.status = 'archived';
      
      logInfo('SponsorService', '[SPONSOR][CREATE] Sponsor archivado (sin vínculos)', {
        sponsor_id: sponsor.id
      });
    }

    // 4. Emitir señal
    const targetRef = computeTargetRef(sponsor.id);
    await dispatchSignal({
      signal_key: 'sponsor.created',
      payload: {
        sponsor_id: sponsor.id,
        target_ref: targetRef,
        display_name: sponsor.display_name,
        student_ids: linkedStudents
      },
      runtime: {
        trace_id: finalTraceId
      },
      context: {}
    }, { source: { type: 'sponsor_service', id: 'create' }, traceId: finalTraceId, authCtx });

    logInfo('SponsorService', '[SPONSOR][CREATE] Sponsor creado', {
      sponsor_id: sponsor.id,
      linked_students: linkedStudents.length,
      traceId: finalTraceId
    });

    return {
      ...sponsor,
      target_ref: targetRef,
      linked_students: linkedStudents
    };
  } catch (error) {
    logError('SponsorService', '[SPONSOR][CREATE] Error creando sponsor', {
      display_name,
      error: error.message,
      traceId: finalTraceId
    });
    throw error;
  }
}

/**
 * Actualiza un sponsor
 */
export async function updateSponsor(id, patch, options = {}) {
  const { traceId = null, authCtx = {} } = options;
  const finalTraceId = traceId || getRequestId();

  logInfo('SponsorService', '[SPONSOR][UPDATE] Iniciando actualización', {
    sponsor_id: id,
    traceId: finalTraceId
  });

  try {
    const sponsor = await sponsorCatalogRepo.getById(id);
    if (!sponsor) {
      throw new Error(`Sponsor no encontrado: ${id}`);
    }

    const updated = await sponsorCatalogRepo.update(id, patch);
    if (!updated) {
      throw new Error(`Error actualizando sponsor: ${id}`);
    }

    // Emitir señal
    const targetRef = computeTargetRef(id);
    await dispatchSignal({
      signal_key: 'sponsor.updated',
      payload: {
        sponsor_id: id,
        target_ref: targetRef,
        changes: Object.keys(patch)
      },
      runtime: {
        trace_id: finalTraceId
      },
      context: {}
    }, { source: { type: 'sponsor_service', id: 'update' }, traceId: finalTraceId, authCtx });

    return {
      ...updated,
      target_ref: targetRef
    };
  } catch (error) {
    logError('SponsorService', '[SPONSOR][UPDATE] Error actualizando sponsor', {
      sponsor_id: id,
      error: error.message,
      traceId: finalTraceId
    });
    throw error;
  }
}

/**
 * Archiva un sponsor
 */
export async function archiveSponsor(id, options = {}) {
  const { traceId = null, authCtx = {} } = options;
  const finalTraceId = traceId || getRequestId();

  logInfo('SponsorService', '[SPONSOR][ARCHIVE] Iniciando archivado', {
    sponsor_id: id,
    traceId: finalTraceId
  });

  try {
    const sponsor = await sponsorCatalogRepo.getById(id);
    if (!sponsor) {
      throw new Error(`Sponsor no encontrado: ${id}`);
    }

    const archived = await sponsorCatalogRepo.archive(id);
    if (!archived) {
      throw new Error(`Error archivando sponsor: ${id}`);
    }

    // Emitir señal
    const targetRef = computeTargetRef(id);
    await dispatchSignal({
      signal_key: 'sponsor.archived',
      payload: {
        sponsor_id: id,
        target_ref: targetRef
      },
      runtime: {
        trace_id: finalTraceId
      },
      context: {}
    }, { source: { type: 'sponsor_service', id: 'archive' }, traceId: finalTraceId, authCtx });

    return {
      ...archived,
      target_ref: targetRef
    };
  } catch (error) {
    logError('SponsorService', '[SPONSOR][ARCHIVE] Error archivando sponsor', {
      sponsor_id: id,
      error: error.message,
      traceId: finalTraceId
    });
    throw error;
  }
}

/**
 * Vincula un estudiante a un sponsor
 * 
 * Invariante: si el sponsor estaba archived y ahora tiene vínculos, reactivarlo
 */
export async function linkStudent(id, studentId, options = {}) {
  const { traceId = null, authCtx = {} } = options;
  const finalTraceId = traceId || getRequestId();

  logInfo('SponsorService', '[SPONSOR][LINK] Iniciando vinculación', {
    sponsor_id: id,
    student_id: studentId,
    traceId: finalTraceId
  });

  try {
    const sponsor = await sponsorCatalogRepo.getById(id);
    if (!sponsor) {
      throw new Error(`Sponsor no encontrado: ${id}`);
    }

    const student = await studentRepo.getById(studentId);
    if (!student) {
      throw new Error(`Estudiante no encontrado: ${studentId}`);
    }

    const link = await sponsorLinksRepo.link(id, studentId);
    if (!link) {
      throw new Error(`Error vinculando estudiante ${studentId} a sponsor ${id}`);
    }

    // Invariante: si estaba archived y ahora tiene vínculos, reactivar
    if (sponsor.status === 'archived') {
      const activeCount = await sponsorLinksRepo.countActiveLinks(id);
      if (activeCount > 0) {
        await sponsorCatalogRepo.update(id, { status: 'active' });
        logInfo('SponsorService', '[SPONSOR][LINK] Sponsor reactivado', {
          sponsor_id: id,
          active_links: activeCount
        });
      }
    }

    // Emitir señal
    const targetRef = computeTargetRef(id);
    await dispatchSignal({
      signal_key: 'sponsor.linked',
      payload: {
        sponsor_id: id,
        target_ref: targetRef,
        student_id: studentId
      },
      runtime: {
        trace_id: finalTraceId
      },
      context: {}
    }, { source: { type: 'sponsor_service', id: 'link' }, traceId: finalTraceId, authCtx });

    return link;
  } catch (error) {
    logError('SponsorService', '[SPONSOR][LINK] Error vinculando estudiante', {
      sponsor_id: id,
      student_id: studentId,
      error: error.message,
      traceId: finalTraceId
    });
    throw error;
  }
}

/**
 * Desvincula un estudiante de un sponsor
 * 
 * Invariante: si el sponsor queda sin vínculos activos, archivarlo
 */
export async function unlinkStudent(id, studentId, reason = null, options = {}) {
  const { traceId = null, authCtx = {} } = options;
  const finalTraceId = traceId || getRequestId();

  logInfo('SponsorService', '[SPONSOR][UNLINK] Iniciando desvinculación', {
    sponsor_id: id,
    student_id: studentId,
    reason,
    traceId: finalTraceId
  });

  try {
    const sponsor = await sponsorCatalogRepo.getById(id);
    if (!sponsor) {
      throw new Error(`Sponsor no encontrado: ${id}`);
    }

    const unlinked = await sponsorLinksRepo.unlink(id, studentId);
    if (!unlinked) {
      throw new Error(`Error desvinculando estudiante ${studentId} de sponsor ${id}`);
    }

    // Invariante: verificar si quedan vínculos activos
    const activeCount = await sponsorLinksRepo.countActiveLinks(id);
    if (activeCount === 0) {
      await sponsorCatalogRepo.archive(id);
      logInfo('SponsorService', '[SPONSOR][UNLINK] Sponsor archivado (sin vínculos)', {
        sponsor_id: id
      });
    }

    // Emitir señal
    const targetRef = computeTargetRef(id);
    await dispatchSignal({
      signal_key: 'sponsor.unlinked',
      payload: {
        sponsor_id: id,
        target_ref: targetRef,
        student_id: studentId,
        reason
      },
      runtime: {
        trace_id: finalTraceId
      },
      context: {}
    }, { source: { type: 'sponsor_service', id: 'unlink' }, traceId: finalTraceId, authCtx });

    return unlinked;
  } catch (error) {
    logError('SponsorService', '[SPONSOR][UNLINK] Error desvinculando estudiante', {
      sponsor_id: id,
      student_id: studentId,
      error: error.message,
      traceId: finalTraceId
    });
    throw error;
  }
}

/**
 * Obtiene un sponsor con sus vínculos y cuidados activos
 */
export async function getSponsor(id, options = {}) {
  const { traceId = null } = options;
  const finalTraceId = traceId || getRequestId();

  try {
    const sponsor = await sponsorCatalogRepo.getById(id);
    if (!sponsor) {
      return null;
    }

    const links = await sponsorLinksRepo.listBySponsor(id);
    const now = new Date();
    const activeCare = await sponsorCareRepo.listActiveCareBySponsor(id, now);

    // Enriquecer cuidados con listas
    const careWithLists = await Promise.all(
      activeCare.map(async (care) => {
        const lists = await sponsorCareRepo.getCareLists(care.id);
        return {
          ...care,
          lists
        };
      })
    );

    const targetRef = computeTargetRef(id);
    return {
      ...sponsor,
      target_ref: targetRef,
      links,
      active_care: careWithLists
    };
  } catch (error) {
    logError('SponsorService', '[SPONSOR][GET] Error obteniendo sponsor', {
      sponsor_id: id,
      error: error.message,
      traceId: finalTraceId
    });
    throw error;
  }
}

/**
 * Lista sponsors con filtros
 */
export async function listSponsors(options = {}) {
  const { search, includeArchived = false, orderPipeline, paging } = options;
  const { traceId = null } = options;
  const finalTraceId = traceId || getRequestId();

  try {
    const sponsors = await sponsorCatalogRepo.list({
      search,
      status: includeArchived ? null : 'active',
      includeArchived,
      orderPipeline,
      paging
    });

    // Enriquecer con conteo de vínculos y target_ref
    const enriched = await Promise.all(
      sponsors.map(async (sponsor) => {
        const linkCount = await sponsorLinksRepo.countActiveLinks(sponsor.id);
        const targetRef = computeTargetRef(sponsor.id);
        return {
          ...sponsor,
          target_ref: targetRef,
          links_count: linkCount
        };
      })
    );

    return enriched;
  } catch (error) {
    logError('SponsorService', '[SPONSOR][LIST] Error listando sponsors', {
      error: error.message,
      traceId: finalTraceId
    });
    throw error;
  }
}

/**
 * Obtiene sponsors vinculados a un estudiante
 */
export async function getSponsorsByStudent(studentId, options = {}) {
  const { traceId = null } = options;
  const finalTraceId = traceId || getRequestId();

  try {
    const links = await sponsorLinksRepo.listByStudent(studentId);
    
    // Enriquecer con target_ref
    return links.map(link => ({
      ...link,
      target_ref: computeTargetRef(link.sponsor_id)
    }));
  } catch (error) {
    logError('SponsorService', '[SPONSOR][GET_BY_STUDENT] Error obteniendo sponsors', {
      student_id: studentId,
      error: error.message,
      traceId: finalTraceId
    });
    throw error;
  }
}

/**
 * Añade un cuidado especial a un sponsor
 * 
 * Invariante: no permitir duplicado activo por categoría
 */
export async function addSpecialCare(data, options = {}) {
  const { 
    sponsorId, 
    category_term_id, 
    duration_days, 
    priority = 0, 
    notes = null, 
    list_ids = [] 
  } = data;
  const { traceId = null, authCtx = {} } = options;
  const finalTraceId = traceId || getRequestId();

  logInfo('SponsorService', '[SPONSOR][CARE][ADD] Iniciando cuidado especial', {
    sponsor_id: sponsorId,
    category_term_id,
    duration_days,
    traceId: finalTraceId
  });

  try {
    const sponsor = await sponsorCatalogRepo.getById(sponsorId);
    if (!sponsor) {
      throw new Error(`Sponsor no encontrado: ${sponsorId}`);
    }

    // Invariante: verificar si ya existe un cuidado activo para esta categoría
    const now = new Date();
    const activeCare = await sponsorCareRepo.listActiveCareBySponsor(sponsorId, now);
    const existingCare = activeCare.find(care => care.category_term_id === category_term_id);
    
    if (existingCare) {
      throw new Error(`Ya existe un cuidado activo para esta categoría. Use extendSpecialCare para extenderlo.`);
    }

    // Calcular fechas
    const startsAt = new Date();
    const endsAt = new Date(startsAt.getTime() + (duration_days * 24 * 60 * 60 * 1000));

    // Crear cuidado
    const care = await sponsorCareRepo.createCare({
      sponsor_id: sponsorId,
      category_term_id,
      starts_at: startsAt,
      ends_at: endsAt,
      priority,
      notes
    });

    // Asociar listas si se proporcionan
    if (list_ids && list_ids.length > 0) {
      await sponsorCareRepo.setCareLists(care.id, list_ids);
    }

    // Emitir señal
    const targetRef = computeTargetRef(sponsorId);
    await dispatchSignal({
      signal_key: 'sponsor.special_care.started',
      payload: {
        sponsor_id: sponsorId,
        target_ref: targetRef,
        care_id: care.id,
        category_term_id,
        duration_days,
        ends_at: endsAt.toISOString()
      },
      runtime: {
        trace_id: finalTraceId
      },
      context: {}
    }, { source: { type: 'sponsor_service', id: 'add_care' }, traceId: finalTraceId, authCtx });

    // Enriquecer con listas
    const lists = await sponsorCareRepo.getCareLists(care.id);
    
    return {
      ...care,
      lists
    };
  } catch (error) {
    logError('SponsorService', '[SPONSOR][CARE][ADD] Error añadiendo cuidado', {
      sponsor_id: sponsorId,
      category_term_id,
      error: error.message,
      traceId: finalTraceId
    });
    throw error;
  }
}

/**
 * Extiende un cuidado especial
 * 
 * Opciones:
 * - add_days: añade días a ends_at actual
 * - set_days: establece ends_at a starts_at + días totales
 */
export async function extendSpecialCare(data, options = {}) {
  const { careId, add_days = null, set_days = null } = data;
  const { traceId = null, authCtx = {} } = options;
  const finalTraceId = traceId || getRequestId();

  logInfo('SponsorService', '[SPONSOR][CARE][EXTEND] Iniciando extensión', {
    care_id: careId,
    add_days,
    set_days,
    traceId: finalTraceId
  });

  try {
    const care = await sponsorCareRepo.getCareById(careId);
    if (!care) {
      throw new Error(`Cuidado no encontrado: ${careId}`);
    }

    let newEndsAt;
    if (add_days !== null) {
      newEndsAt = new Date(new Date(care.ends_at).getTime() + (add_days * 24 * 60 * 60 * 1000));
    } else if (set_days !== null) {
      newEndsAt = new Date(new Date(care.starts_at).getTime() + (set_days * 24 * 60 * 60 * 1000));
    } else {
      throw new Error('Debe proporcionar add_days o set_days');
    }

    const updated = await sponsorCareRepo.updateCare(careId, { ends_at: newEndsAt });
    if (!updated) {
      throw new Error(`Error extendiendo cuidado: ${careId}`);
    }

    // Emitir señal
    const targetRef = computeTargetRef(care.sponsor_id);
    await dispatchSignal({
      signal_key: 'sponsor.special_care.extended',
      payload: {
        sponsor_id: care.sponsor_id,
        target_ref: targetRef,
        care_id: careId,
        category_term_id: care.category_term_id,
        new_ends_at: newEndsAt.toISOString(),
        add_days,
        set_days
      },
      runtime: {
        trace_id: finalTraceId
      },
      context: {}
    }, { source: { type: 'sponsor_service', id: 'extend_care' }, traceId: finalTraceId, authCtx });

    return updated;
  } catch (error) {
    logError('SponsorService', '[SPONSOR][CARE][EXTEND] Error extendiendo cuidado', {
      care_id: careId,
      error: error.message,
      traceId: finalTraceId
    });
    throw error;
  }
}

/**
 * Finaliza un cuidado especial
 */
export async function endSpecialCare(data, options = {}) {
  const { careId } = data;
  const { traceId = null, authCtx = {} } = options;
  const finalTraceId = traceId || getRequestId();

  logInfo('SponsorService', '[SPONSOR][CARE][END] Iniciando finalización', {
    care_id: careId,
    traceId: finalTraceId
  });

  try {
    const care = await sponsorCareRepo.getCareById(careId);
    if (!care) {
      throw new Error(`Cuidado no encontrado: ${careId}`);
    }

    const ended = await sponsorCareRepo.endCare(careId);
    if (!ended) {
      throw new Error(`Error finalizando cuidado: ${careId}`);
    }

    // Emitir señal
    const targetRef = computeTargetRef(care.sponsor_id);
    await dispatchSignal({
      signal_key: 'sponsor.special_care.ended',
      payload: {
        sponsor_id: care.sponsor_id,
        target_ref: targetRef,
        care_id: careId,
        category_term_id: care.category_term_id
      },
      runtime: {
        trace_id: finalTraceId
      },
      context: {}
    }, { source: { type: 'sponsor_service', id: 'end_care' }, traceId: finalTraceId, authCtx });

    return ended;
  } catch (error) {
    logError('SponsorService', '[SPONSOR][CARE][END] Error finalizando cuidado', {
      care_id: careId,
      error: error.message,
      traceId: finalTraceId
    });
    throw error;
  }
}

/**
 * Obtiene la cola de cuidados especiales
 */
export async function getCareQueue(options = {}) {
  const { horizon_days = 14, category_term_id = null, orderPipeline = null } = options;
  const { traceId = null } = options;
  const finalTraceId = traceId || getRequestId();

  try {
    const queue = await sponsorCareRepo.listQueue({
      horizon_days,
      category_term_id,
      orderPipeline
    });

    // Enriquecer con listas y target_ref
    const enriched = await Promise.all(
      queue.map(async (item) => {
        const lists = await sponsorCareRepo.getCareLists(item.id);
        const targetRef = computeTargetRef(item.sponsor_id);
        return {
          ...item,
          target_ref: targetRef,
          lists
        };
      })
    );

    return enriched;
  } catch (error) {
    logError('SponsorService', '[SPONSOR][CARE][QUEUE] Error obteniendo cola', {
      error: error.message,
      traceId: finalTraceId
    });
    throw error;
  }
}

/**
 * Maneja pausa o baja de suscripción de un estudiante
 * 
 * Regla: desvincular todos los sponsors y archivar los que queden sin vínculos
 */
export async function handleStudentPauseOrUnsubscribe(studentId, reason = null, options = {}) {
  const { traceId = null, authCtx = {} } = options;
  const finalTraceId = traceId || getRequestId();

  logInfo('SponsorService', '[SPONSOR][CLEANUP_STUDENT] Iniciando limpieza', {
    student_id: studentId,
    reason,
    traceId: finalTraceId
  });

  try {
    // 1. Obtener todos los sponsors vinculados
    const links = await sponsorLinksRepo.listByStudent(studentId);
    
    // 2. Desvincular todos
    const unlinkedSponsors = [];
    for (const link of links) {
      try {
        await unlinkStudent(link.sponsor_id, studentId, reason || 'student_pause_or_unsubscribe', {
          traceId: finalTraceId,
          authCtx
        });
        unlinkedSponsors.push(link.sponsor_id);
      } catch (unlinkError) {
        logError('SponsorService', '[SPONSOR][CLEANUP_STUDENT] Error desvinculando', {
          sponsor_id: link.sponsor_id,
          student_id: studentId,
          error: unlinkError.message
        });
      }
    }

    logInfo('SponsorService', '[SPONSOR][CLEANUP_STUDENT] Limpieza completada', {
      student_id: studentId,
      unlinked_sponsors: unlinkedSponsors.length,
      traceId: finalTraceId
    });

    return {
      unlinked_count: unlinkedSponsors.length,
      unlinked_sponsors: unlinkedSponsors
    };
  } catch (error) {
    logError('SponsorService', '[SPONSOR][CLEANUP_STUDENT] Error en limpieza', {
      student_id: studentId,
      error: error.message,
      traceId: finalTraceId
    });
    throw error;
  }
}
