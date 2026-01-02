/**
 * LayoutRegistry v1 Validator
 * 
 * Valida el LayoutRegistry canónico según las reglas constitucionales.
 * 
 * @param {Object} registry - El objeto registry a validar
 * @returns {{ok: boolean, error?: string, details?: Array<string>}}
 */
export function validateLayoutRegistry(registry) {
  const details = [];

  // 1. Validar schema y versión
  if (!registry.schema || registry.schema !== 'auri.admin.layout_registry.v1') {
    return {
      ok: false,
      error: 'Schema inválido',
      details: [`Esperado: "auri.admin.layout_registry.v1", recibido: "${registry.schema || 'undefined'}"`]
    };
  }

  if (!registry.version || registry.version !== '1.0.0') {
    return {
      ok: false,
      error: 'Versión inválida',
      details: [`Esperado: "1.0.0", recibido: "${registry.version || 'undefined'}"`]
    };
  }

  // 2. Validar estructura básica
  if (!Array.isArray(registry.universes)) {
    return {
      ok: false,
      error: 'universes debe ser un array',
      details: []
    };
  }

  if (!Array.isArray(registry.layouts)) {
    return {
      ok: false,
      error: 'layouts debe ser un array',
      details: []
    };
  }

  if (!Array.isArray(registry.sidebars)) {
    return {
      ok: false,
      error: 'sidebars debe ser un array',
      details: []
    };
  }

  if (!Array.isArray(registry.routes)) {
    return {
      ok: false,
      error: 'routes debe ser un array',
      details: []
    };
  }

  // 3. Validar IDs únicos
  const universeIds = new Set();
  const layoutIds = new Set();
  const sidebarIds = new Set();
  const routeKeys = new Set();

  for (const universe of registry.universes) {
    if (!universe.id) {
      details.push(`Universe sin id: ${JSON.stringify(universe)}`);
      continue;
    }
    if (universeIds.has(universe.id)) {
      details.push(`ID duplicado en universes: ${universe.id}`);
    }
    universeIds.add(universe.id);
  }

  for (const layout of registry.layouts) {
    if (!layout.id) {
      details.push(`Layout sin id: ${JSON.stringify(layout)}`);
      continue;
    }
    if (layoutIds.has(layout.id)) {
      details.push(`ID duplicado en layouts: ${layout.id}`);
    }
    layoutIds.add(layout.id);
  }

  for (const sidebar of registry.sidebars) {
    if (!sidebar.id) {
      details.push(`Sidebar sin id: ${JSON.stringify(sidebar)}`);
      continue;
    }
    if (sidebarIds.has(sidebar.id)) {
      details.push(`ID duplicado en sidebars: ${sidebar.id}`);
    }
    sidebarIds.add(sidebar.id);
  }

  for (const route of registry.routes) {
    if (!route.route_key) {
      details.push(`Route sin route_key: ${JSON.stringify(route)}`);
      continue;
    }
    if (routeKeys.has(route.route_key)) {
      details.push(`route_key duplicado: ${route.route_key}`);
    }
    routeKeys.add(route.route_key);
  }

  // 4. Validar referencias de universes
  for (const universe of registry.universes) {
    if (!universe.layout_id) {
      details.push(`Universe ${universe.id} sin layout_id`);
    } else if (!layoutIds.has(universe.layout_id)) {
      details.push(`Universe ${universe.id} apunta a layout inexistente: ${universe.layout_id}`);
    }

    if (!universe.sidebar_id) {
      details.push(`Universe ${universe.id} sin sidebar_id`);
    } else if (!sidebarIds.has(universe.sidebar_id)) {
      details.push(`Universe ${universe.id} apunta a sidebar inexistente: ${universe.sidebar_id}`);
    }

    if (!universe.entry_route_key) {
      details.push(`Universe ${universe.id} sin entry_route_key`);
    } else if (!routeKeys.has(universe.entry_route_key)) {
      details.push(`Universe ${universe.id} apunta a route inexistente: ${universe.entry_route_key}`);
    }
  }

  // 5. Validar referencias de sidebars
  for (const sidebar of registry.sidebars) {
    if (!sidebar.universe_id) {
      details.push(`Sidebar ${sidebar.id} sin universe_id`);
    } else if (!universeIds.has(sidebar.universe_id)) {
      details.push(`Sidebar ${sidebar.id} apunta a universe inexistente: ${sidebar.universe_id}`);
    }
  }

  // 6. Validar referencias de routes
  for (const route of registry.routes) {
    if (!route.universe_id) {
      details.push(`Route ${route.route_key} sin universe_id`);
    } else if (!universeIds.has(route.universe_id)) {
      details.push(`Route ${route.route_key} apunta a universe inexistente: ${route.universe_id}`);
    }

    if (!route.layout_id) {
      details.push(`Route ${route.route_key} sin layout_id`);
    } else if (!layoutIds.has(route.layout_id)) {
      details.push(`Route ${route.route_key} apunta a layout inexistente: ${route.layout_id}`);
    }
  }

  // 7. Validar required_slots en layouts
  const requiredSlots = registry.diagnostics?.required_slots || ['sidebar', 'main', 'notes_panel', 'diagnostics_panel'];
  for (const layout of registry.layouts) {
    if (!Array.isArray(layout.slots)) {
      details.push(`Layout ${layout.id} sin slots o slots no es array`);
      continue;
    }
    for (const requiredSlot of requiredSlots) {
      if (!layout.slots.includes(requiredSlot)) {
        details.push(`Layout ${layout.id} falta slot requerido: ${requiredSlot}`);
      }
    }
  }

  // 8. Validar required_features en sidebars
  const requiredFeatures = registry.diagnostics?.required_features || ['global_search', 'bookmarks'];
  for (const sidebar of registry.sidebars) {
    if (!Array.isArray(sidebar.features)) {
      details.push(`Sidebar ${sidebar.id} sin features o features no es array`);
      continue;
    }
    // Validar que tenga al menos global_search y bookmarks
    if (!sidebar.features.includes('global_search')) {
      details.push(`Sidebar ${sidebar.id} falta feature requerida: global_search`);
    }
    if (!sidebar.features.includes('bookmarks')) {
      details.push(`Sidebar ${sidebar.id} falta feature requerida: bookmarks`);
    }
  }

  // 9. Validar constraints en layouts
  const forbidden = registry.diagnostics?.forbidden || ['inline_js', 'dynamic_innerHTML', 'html_in_js_strings'];
  for (const layout of registry.layouts) {
    if (!Array.isArray(layout.constraints)) {
      details.push(`Layout ${layout.id} sin constraints o constraints no es array`);
      continue;
    }
    // Verificar que tenga las constraints prohibidas como constraints (para validar que están prohibidas)
    // Esto es más una validación de que el layout declara las constraints correctas
    const expectedConstraints = ['no_inline_js', 'no_dynamic_innerHTML', 'no_html_in_js_strings'];
    for (const expectedConstraint of expectedConstraints) {
      if (!layout.constraints.includes(expectedConstraint)) {
        details.push(`Layout ${layout.id} falta constraint requerida: ${expectedConstraint}`);
      }
    }
  }

  // Si hay detalles de error, retornar error
  if (details.length > 0) {
    return {
      ok: false,
      error: `Validación falló con ${details.length} error(es)`,
      details
    };
  }

  return { ok: true };
}


