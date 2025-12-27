// src/endpoints/admin-theme-studio-canon-ui.js
// Theme Studio Canon v1 - UI Handler
// Usa renderAdminPage para consistencia con otras pantallas admin

import { requireAdminContext } from '../core/auth-context.js';
import { renderAdminPage } from '../core/admin/admin-page-renderer.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar template HTML
let themeStudioCanonTemplate = null;
function getThemeStudioCanonTemplate() {
  if (!themeStudioCanonTemplate) {
    try {
      const templatePath = join(__dirname, '../core/html/admin/theme-studio-canon/theme-studio-canon.html');
      themeStudioCanonTemplate = readFileSync(templatePath, 'utf-8');
    } catch (error) {
      console.error('[ThemeStudioCanon] Error cargando template:', error);
      themeStudioCanonTemplate = '<div>Error cargando Theme Studio Canon</div>';
    }
  }
  return themeStudioCanonTemplate;
}

export default async function adminThemeStudioCanonUIHandler(request, env, ctx) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  const contentHtml = getThemeStudioCanonTemplate();

  return renderAdminPage({
    title: 'Theme Studio · Canon (v1)',
    contentHtml,
    activePath: '/admin/theme-studio-canon',
    extraScripts: ['/js/admin/theme-studio-canon.js']
  });
}
