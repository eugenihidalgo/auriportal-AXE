/**
 * MASTER ALUMNOS POSTGRESQL - AuriPortal Master
 * 
 * Pantalla técnica canónica: Tabla PostgreSQL Alumnos.
 * Vista diagnóstica del Source of Truth del sistema.
 */

import { renderMasterPage } from '../core/master/layout/master-page-renderer.js';

export default async function masterAlumnosPostgresqlHandler(request, env, ctx) {
  const url = new URL(request.url);
  const activePath = url.pathname;
  
  return renderMasterPage({
    title: 'PostgreSQL Alumnos — Tabla Canónica Técnica',
    contentHtml: `
      <div id="master-alumnos-content" style="padding: 2rem;">
        <h1>PostgreSQL Alumnos — Tabla Canónica Técnica</h1>
        <p style="color: #666; margin-bottom: 1.5rem;">
          Vista diagnóstica del Source of Truth del sistema: muestra todos los campos reales de PostgreSQL de la tabla <code>alumnos</code>.
          Click en una fila para ver el registro completo en formato JSON.
        </p>
      </div>
    `,
    activePath,
    universeId: 'u_alumnos',
    extraStyles: [
      `<style>
        /* Estilos técnicos para tabla diagnóstica - Override consciente */
        .ap-table-diagnostic {
          background: #ffffff !important;
          color: #333333 !important;
          border: 1px solid #cccccc !important;
        }
        .ap-table-diagnostic table {
          background: #ffffff !important;
          color: #333333 !important;
          border-collapse: collapse;
        }
        .ap-table-diagnostic thead {
          background: #f0f0f0 !important;
          color: #000000 !important;
        }
        .ap-table-diagnostic th {
          background: #f0f0f0 !important;
          color: #000000 !important;
          border: 1px solid #cccccc !important;
          padding: 0.5rem;
          text-align: left;
          font-weight: bold;
        }
        .ap-table-diagnostic td {
          background: #ffffff !important;
          color: #333333 !important;
          border: 1px solid #cccccc !important;
          padding: 0.5rem;
        }
        .ap-table-diagnostic tr:nth-child(even) {
          background: #fafafa !important;
        }
        .ap-table-diagnostic tr:hover {
          background: #f5f5f5 !important;
        }
        #master-alumnos-content {
          background: #ffffff !important;
          color: #333333 !important;
        }
      </style>`
    ]
  });
}
