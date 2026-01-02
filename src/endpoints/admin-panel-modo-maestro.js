// src/endpoints/admin-panel-modo-maestro.js
// Modo Maestro: Vista completa del alumno usando Student SOT v1
//
// GET /admin/modo-maestro - Lista de alumnos con buscador
// GET /admin/modo-maestro?student_id=X - Universo completo del alumno

import { requireAdminContext } from '../core/auth-context.js';
import { getRequestId } from '../core/observability/request-context.js';
import { renderAdminPage } from '../core/admin/admin-page-renderer.js';
import { logError } from '../core/observability/logger.js';

/**
 * GET /admin/modo-maestro
 * Vista principal: buscador y lista de alumnos
 */
async function renderModoMaestro(request, env, ctx) {
  const traceId = getRequestId();
  
  try {
    const authCtx = await requireAdminContext(request, env);
    if (authCtx instanceof Response) {
      return authCtx;
    }
    
    const url = new URL(request.url);
    const studentId = url.searchParams.get('student_id');
    
    if (studentId) {
      // Mostrar universo del alumno
      return await renderStudentUniverse(parseInt(studentId, 10), traceId);
    } else {
      // Mostrar buscador y lista
      return await renderStudentSearch(traceId);
    }
  } catch (error) {
    logError('AdminModoMaestro', 'Error en renderModoMaestro', {
      error: error.message,
      traceId
    });
    
    return renderAdminPage({
      title: 'Error - Modo Master',
      contentHtml: `
        <div class="p-6">
          <div class="bg-red-900/30 border border-red-700 rounded-lg p-6">
            <h2 class="text-xl font-bold text-red-400 mb-2">Error</h2>
            <p class="text-red-200">${error.message}</p>
            <p class="text-red-300 text-sm mt-2">Trace ID: ${traceId}</p>
          </div>
        </div>
      `,
      activePath: '/admin/modo-maestro',
      userContext: { isAdmin: true }
    });
  }
}

/**
 * Renderiza el buscador de alumnos
 */
async function renderStudentSearch(traceId) {
  const contentHtml = `
    <div class="p-6">
      <div class="mb-6">
        <h1 class="text-3xl font-bold text-white mb-2">🧙 Modo Master</h1>
        <p class="text-slate-300">Busca un alumno para ver su universo completo (Student SOT v1)</p>
      </div>
      
      <!-- Buscador -->
      <div class="bg-slate-800 border border-slate-700 rounded-lg p-6 mb-6">
        <label for="student-search" class="block text-sm font-medium text-slate-300 mb-2">
          Buscar alumno (email o nombre)
        </label>
        <div class="flex gap-2">
          <input
            type="text"
            id="student-search"
            placeholder="Escribe email o nombre..."
            class="flex-1 px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            onkeypress="if(event.key==='Enter') { event.preventDefault(); searchStudents(); }"
          />
          <button
            onclick="searchStudents()"
            class="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Buscar
          </button>
        </div>
      </div>
      
      <!-- Resultados -->
      <div id="search-results" class="space-y-4"></div>
      
      <!-- Loading -->
      <div id="loading" class="hidden text-center py-8">
        <div class="text-slate-400">Buscando...</div>
      </div>
      
      <!-- Error -->
      <div id="error" class="hidden bg-red-900/30 border border-red-700 rounded-lg p-4">
        <p class="text-red-200" id="error-message"></p>
        <p class="text-red-300 text-sm mt-2" id="error-trace"></p>
      </div>
    </div>
    
    <script>
      async function searchStudents() {
        const query = document.getElementById('student-search').value.trim();
        const resultsEl = document.getElementById('search-results');
        const loadingEl = document.getElementById('loading');
        const errorEl = document.getElementById('error');
        
        // Limpiar resultados anteriores
        resultsEl.innerHTML = '';
        errorEl.classList.add('hidden');
        
        if (!query || query.length < 2) {
          return;
        }
        
        loadingEl.classList.remove('hidden');
        
        try {
          const response = await fetch('/admin/api/students/search?q=' + encodeURIComponent(query));
          const data = await response.json();
          
          loadingEl.classList.add('hidden');
          
          if (!data.ok) {
            throw new Error(data.error || 'Error en búsqueda');
          }
          
          if (data.students.length === 0) {
            resultsEl.innerHTML = '<div class="text-center py-8 text-slate-400">No se encontraron alumnos</div>';
            return;
          }
          
          // Renderizar resultados usando DOM API
          const container = document.createElement('div');
          container.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4';
          
          data.students.forEach(student => {
            const card = document.createElement('a');
            card.href = '/admin/modo-maestro?student_id=' + student.id;
            card.className = 'bg-slate-800 border border-slate-700 rounded-lg p-4 hover:border-indigo-500 hover:shadow-xl transition-all block';
            
            const displayName = student.display_name || student.email;
            const estado = student.estado_suscripcion || 'N/A';
            const nivel = student.nivel_actual || 1;
            const streak = student.streak || 0;
            
            card.innerHTML = 
              '<div class="flex items-start justify-between mb-2">' +
                '<h3 class="font-semibold text-lg text-white">' + displayName + '</h3>' +
                '<span class="px-2 py-1 bg-green-900/30 text-green-400 text-xs rounded font-semibold">✓ ' + estado + '</span>' +
              '</div>' +
              (student.email ? '<p class="text-sm text-slate-400 mb-2">' + student.email + '</p>' : '') +
              '<div class="mt-3 space-y-1 text-xs">' +
                '<div class="flex items-center gap-2 text-slate-300">' +
                  '<span class="text-indigo-400">⭐ Nivel ' + nivel + '</span>' +
                  '<span>•</span>' +
                  '<span class="text-yellow-400">🔥 Racha ' + streak + ' días</span>' +
                '</div>' +
              '</div>' +
              '<div class="mt-3 pt-3 border-t border-slate-700">' +
                '<span class="text-indigo-400 text-sm font-medium">→ Ver Universo Completo</span>' +
              '</div>';
            
            container.appendChild(card);
          });
          
          resultsEl.appendChild(container);
        } catch (error) {
          loadingEl.classList.add('hidden');
          errorEl.classList.remove('hidden');
          document.getElementById('error-message').textContent = error.message;
          document.getElementById('error-trace').textContent = 'Trace ID: ' + (data?.trace_id || 'N/A');
        }
      }
    </script>
  `;
  
  return renderAdminPage({
    title: 'Modo Master - Admin',
    contentHtml,
    activePath: '/admin/modo-maestro',
    userContext: { isAdmin: true }
  });
}

/**
 * Renderiza el universo completo del alumno
 */
async function renderStudentUniverse(studentId, traceId) {
  try {
    // Usar servicios directamente (estamos en el servidor)
    const { getStudent } = await import('../services/student-sot-service.js');
    const { getDefaultStudentDomainPolicyRepo } = await import('../infra/repos/student-domain-policy-repo-pg.js');
    const { getDefaultStudentItemStateRepo } = await import('../infra/repos/student-item-state-repo-pg.js');
    const { getDefaultStudentAuditRepo } = await import('../infra/repos/student-audit-repo-pg.js');
    const { query } = await import('../../database/pg.js');
    
    const student = await getStudent(studentId);
    if (!student) {
      return renderAdminPage({
        title: 'Alumno no encontrado - Modo Master',
        contentHtml: `
          <div class="p-6">
            <div class="bg-red-900/30 border border-red-700 rounded-lg p-6">
              <h2 class="text-xl font-bold text-red-400 mb-2">Alumno no encontrado</h2>
              <p class="text-red-200">El alumno con ID ${studentId} no existe.</p>
              <a href="/admin/modo-maestro" class="inline-block mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                ← Volver a búsqueda
              </a>
            </div>
          </div>
        `,
        activePath: '/admin/modo-maestro',
        userContext: { isAdmin: true }
      });
    }
    
    // Obtener productos
    const productsResult = await query(
      'SELECT * FROM student_product_memberships WHERE student_id = $1',
      [studentId]
    );
    const products = productsResult.rows || [];
    
    // Obtener dominios
    const domains = {};
    const domainKeys = ['transmutaciones_energeticas', 'proyectos', 'lugares', 'apadrinados'];
    const policyRepo = getDefaultStudentDomainPolicyRepo();
    const stateRepo = getDefaultStudentItemStateRepo();
    
    for (const domainKey of domainKeys) {
      const policy = await policyRepo.getPolicy(studentId, domainKey);
      const activeItems = await stateRepo.listStates(studentId, domainKey, { isActive: true });
      const allItems = await stateRepo.listStates(studentId, domainKey);
      const activeCount = await stateRepo.countActiveItems(studentId, domainKey);
      
      const limit = policy?.active_limit_override ?? policy?.active_limit_default ?? 1;
      
      domains[domainKey] = {
        active_limit: limit,
        active_limit_override: policy?.active_limit_override,
        can_activate_multiple: policy?.can_activate_multiple || false,
        active_count: activeCount,
        active_items: activeItems,
        all_items: allItems,
        warnings: activeCount > limit ? [`Límite excedido: ${activeCount} > ${limit}`] : []
      };
    }
    
    // Obtener overrides
    const allPolicies = await policyRepo.listPolicies(studentId);
    const overrides = allPolicies.filter(p => p.active_limit_override !== null);
    
    // Obtener auditoría reciente
    const auditRepo = getDefaultStudentAuditRepo();
    const auditRecent = await auditRepo.listAuditEvents(studentId, { limit: 10, offset: 0 });
    
    // Renderizar HTML
    const domainNames = {
      transmutaciones_energeticas: 'Transmutaciones Energéticas',
      proyectos: 'Proyectos',
      lugares: 'Lugares',
      apadrinados: 'Apadrinados'
    };
    
    // Construir HTML de dominios
    let domainsHtml = '';
    for (const [key, domain] of Object.entries(domains)) {
      const domainName = domainNames[key] || key;
      const overrideText = domain.active_limit_override ? ` (override: ${domain.active_limit_override})` : '';
      const activeCountClass = domain.active_count > domain.active_limit ? 'text-red-400' : 'text-green-400';
      const warningsHtml = domain.warnings.length > 0 
        ? `<div class="bg-yellow-900/30 border border-yellow-700 rounded p-2 text-yellow-200 text-sm">⚠️ ${domain.warnings.join(', ')}</div>`
        : '';
      
      let activeItemsHtml = '';
      if (domain.active_items.length > 0) {
        activeItemsHtml = '<div class="space-y-2"><h4 class="text-sm font-semibold text-slate-400 mb-2">Ítems Activos:</h4>';
        for (const item of domain.active_items) {
          const cleanClass = item.is_clean ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400';
          const cleanText = item.is_clean ? '✓ Limpio' : '⚠ Pendiente';
          const lastCleaned = item.last_cleaned_at ? new Date(item.last_cleaned_at).toLocaleDateString('es-ES') : 'N/A';
          const cleanCountHtml = item.clean_count > 0 
            ? `<div class="text-slate-400 mt-1">Limpiezas: ${item.clean_count} | Última: ${lastCleaned}</div>`
            : '';
          
          activeItemsHtml += `
            <div class="bg-slate-900 border border-slate-700 rounded p-3 text-sm">
              <div class="flex items-center justify-between">
                <span class="text-white">Item ID: ${item.item_id}</span>
                <span class="px-2 py-1 rounded text-xs ${cleanClass}">${cleanText}</span>
              </div>
              ${cleanCountHtml}
            </div>
          `;
        }
        activeItemsHtml += '</div>';
      } else {
        activeItemsHtml = '<p class="text-slate-400 text-sm">Sin ítems activos</p>';
      }
      
      domainsHtml += `
        <div class="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-xl font-bold text-white">${domainName}</h3>
            <div class="text-sm text-slate-400">
              Límite: <span class="font-semibold text-indigo-400">${domain.active_limit}</span>${overrideText}
            </div>
          </div>
          <div class="mb-4">
            <div class="text-sm text-slate-300 mb-2">
              Activos: <span class="font-semibold ${activeCountClass}">${domain.active_count}</span> / ${domain.active_limit}
            </div>
            ${warningsHtml}
          </div>
          ${activeItemsHtml}
        </div>
      `;
    }
    
    // Construir HTML de overrides
    let overridesHtml = '';
    if (overrides.length > 0) {
      overridesHtml = '<div class="bg-slate-800 border border-slate-700 rounded-lg p-6"><h3 class="text-xl font-bold text-white mb-4">Overrides Activos</h3><div class="space-y-2">';
      for (const override of overrides) {
        const overrideDomainName = domainNames[override.domain_key] || override.domain_key;
        const reasonHtml = override.reason ? `<p class="text-slate-400 text-sm mt-1">${override.reason}</p>` : '';
        overridesHtml += `
          <div class="bg-slate-900 border border-slate-700 rounded p-3">
            <div class="flex items-center justify-between">
              <div>
                <span class="text-white font-semibold">${overrideDomainName}</span>
                <span class="text-slate-400 text-sm ml-2">Límite: ${override.active_limit_override}</span>
              </div>
              <button
                onclick="removeOverride(${studentId}, '${override.id}')"
                class="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
              >
                Retirar
              </button>
            </div>
            ${reasonHtml}
          </div>
        `;
      }
      overridesHtml += '</div></div>';
    } else {
      overridesHtml = '<div class="bg-slate-800 border border-slate-700 rounded-lg p-6"><p class="text-slate-400">Sin overrides activos</p></div>';
    }
    
    // Construir HTML de auditoría
    let auditHtml = '';
    if (auditRecent.length > 0) {
      auditHtml = '<div class="bg-slate-800 border border-slate-700 rounded-lg p-6"><h3 class="text-xl font-bold text-white mb-4">Auditoría Reciente</h3><div class="space-y-2 max-h-96 overflow-y-auto">';
      for (const audit of auditRecent) {
        const auditDate = new Date(audit.created_at).toLocaleString('es-ES');
        auditHtml += `
          <div class="bg-slate-900 border border-slate-700 rounded p-3 text-sm">
            <div class="flex items-center justify-between mb-1">
              <span class="text-white font-semibold">${audit.action}</span>
              <span class="text-slate-400">${auditDate}</span>
            </div>
            <div class="text-slate-400">
              Dominio: ${audit.domain_key} | Item: ${audit.item_id} | Actor: ${audit.actor_type}
            </div>
          </div>
        `;
      }
      auditHtml += '</div></div>';
    } else {
      auditHtml = '<div class="bg-slate-800 border border-slate-700 rounded-lg p-6"><p class="text-slate-400">Sin eventos de auditoría</p></div>';
    }
    
    const contentHtml = `
      <div class="p-6">
        <div class="mb-6">
          <a href="/admin/modo-maestro" class="text-indigo-400 hover:text-indigo-300 text-sm mb-2 inline-block">← Volver a búsqueda</a>
          <h1 class="text-3xl font-bold text-white mt-2">🧙 Universo del Alumno</h1>
          <div class="mt-4 bg-slate-800 border border-slate-700 rounded-lg p-4">
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div class="text-slate-400">Email</div>
                <div class="text-white font-semibold">${student.email || 'N/A'}</div>
              </div>
              <div>
                <div class="text-slate-400">Nombre</div>
                <div class="text-white font-semibold">${student.apodo || student.email || 'N/A'}</div>
              </div>
              <div>
                <div class="text-slate-400">Nivel</div>
                <div class="text-indigo-400 font-semibold text-xl">${student.nivel_actual || 1}</div>
              </div>
              <div>
                <div class="text-slate-400">Racha</div>
                <div class="text-yellow-400 font-semibold text-xl">${student.streak || 0} días</div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="space-y-6">
          <div>
            <h2 class="text-2xl font-bold text-white mb-4">Dominios Energéticos</h2>
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
              ${domainsHtml}
            </div>
          </div>
          
          <div>
            <h2 class="text-2xl font-bold text-white mb-4">Overrides del Master</h2>
            ${overridesHtml}
          </div>
          
          <div>
            <h2 class="text-2xl font-bold text-white mb-4">Auditoría</h2>
            ${auditHtml}
          </div>
        </div>
      </div>
      
      <script>
        async function removeOverride(studentId, overrideId) {
          if (!confirm('¿Retirar este override?')) return;
          
          try {
            const response = await fetch('/admin/api/students/' + studentId + '/overrides/' + overrideId, {
              method: 'DELETE'
            });
            const data = await response.json();
            
            if (data.ok) {
              alert('Override retirado correctamente');
              window.location.reload();
            } else {
              alert('Error: ' + (data.error || 'Error desconocido'));
            }
          } catch (error) {
            alert('Error: ' + error.message);
          }
        }
      </script>
    `;
    
    const studentName = student.apodo || student.email || 'N/A';
    return renderAdminPage({
      title: `Modo Master: ${studentName} - Admin`,
      contentHtml,
      activePath: '/admin/modo-maestro',
      userContext: { isAdmin: true }
    });
  } catch (error) {
    logError('AdminModoMaestro', 'Error en renderStudentUniverse', {
      studentId,
      error: error.message,
      traceId
    });
    
    const errorHtml = `
      <div class="p-6">
        <div class="bg-red-900/30 border border-red-700 rounded-lg p-6">
          <h2 class="text-xl font-bold text-red-400 mb-2">Error</h2>
          <p class="text-red-200">${error.message}</p>
          <p class="text-red-300 text-sm mt-2">Trace ID: ${traceId}</p>
          <a href="/admin/modo-maestro" class="inline-block mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
            ← Volver
          </a>
        </div>
      </div>
    `;
    
    return renderAdminPage({
      title: 'Error - Modo Master',
      contentHtml: errorHtml,
      activePath: '/admin/modo-maestro',
      userContext: { isAdmin: true }
    });
  }
}
export default renderModoMaestro;
