// src/endpoints/admin-motors.js
// Panel admin para gestionar Diseñador de Motores PDE

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { requireAdminContext } from '../core/auth-context.js';
import { listMotors, getMotorById } from '../services/pde-motors-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const baseTemplate = readFileSync(join(__dirname, '../core/html/admin/base.html'), 'utf-8');

function replace(html, placeholders) {
  let output = html;
  for (const key in placeholders) {
    const value = placeholders[key] ?? "";
    const regex = new RegExp(`{{${key}}}`, "g");
    output = output.replace(regex, value);
  }
  return output;
}

/**
 * Renderiza el listado de motores
 */
export async function renderListadoMotors(request, env) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  let motors = [];
  try {
    motors = await listMotors({ includeDeleted: false });
  } catch (error) {
    console.error('Error al cargar motores:', error);
  }

  // Generar filas de la tabla
  const motorsRows = motors.length > 0 ? motors.map(motor => {
    const nameEscapado = (motor.name || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const motorKeyEscapado = (motor.motor_key || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const statusBadge = motor.status === 'published' 
      ? '<span class="px-2 py-1 bg-green-600 text-white text-xs rounded">Publicado</span>'
      : motor.status === 'archived'
      ? '<span class="px-2 py-1 bg-gray-600 text-white text-xs rounded">Archivado</span>'
      : '<span class="px-2 py-1 bg-yellow-600 text-white text-xs rounded">Borrador</span>';
    
    return `
    <tr class="border-b border-slate-700 hover:bg-slate-700">
      <td class="py-3 px-4 text-white font-medium">${nameEscapado}</td>
      <td class="py-3 px-4 text-slate-300 text-sm">${motorKeyEscapado}</td>
      <td class="py-3 px-4 text-slate-300">${motor.category || '-'}</td>
      <td class="py-3 px-4 text-slate-300">v${motor.version || 1}</td>
      <td class="py-3 px-4">${statusBadge}</td>
      <td class="py-3 px-4">
        <a href="/admin/motors/editar/${motor.id}" class="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded transition-colors inline-block mr-2">Editar</a>
        <button onclick="duplicarMotor('${motor.id}')" class="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded transition-colors inline-block mr-2">Duplicar</button>
        ${motor.status === 'draft' ? `<button onclick="publicarMotor('${motor.id}')" class="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded transition-colors inline-block mr-2">Publicar</button>` : ''}
        <button onclick="eliminarMotor('${motor.id}')" class="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded transition-colors">Eliminar</button>
      </td>
    </tr>
    `;
  }).join('') : `
    <tr>
      <td colspan="6" class="py-8 text-center text-slate-400">No hay motores creados aún. <a href="/admin/motors/editar/nuevo" class="text-indigo-400 hover:text-indigo-300 underline">Crear el primero</a></td>
    </tr>
  `;

  const listadoTemplate = readFileSync(join(__dirname, '../core/html/admin/motors/motors-listado.html'), 'utf-8');
  const content = replace(listadoTemplate, {
    MOTORS_ROWS: motorsRows
  });

  const html = replace(baseTemplate, {
    TITLE: 'Diseñador de Motores',
    CONTENT: content,
    CURRENT_PATH: '/admin/motors'
  });

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=UTF-8' }
  });
}

/**
 * Renderiza el editor de motor
 */
export async function renderEditarMotor(request, env, motorId) {
  const authCtx = await requireAdminContext(request, env);
  if (authCtx instanceof Response) {
    return authCtx;
  }

  let motor = null;
  if (motorId && motorId !== 'nuevo') {
    try {
      motor = await getMotorById(motorId);
    } catch (error) {
      console.error('Error al cargar motor:', error);
    }
  }

  const editarTemplate = readFileSync(join(__dirname, '../core/html/admin/motors/motors-editar.html'), 'utf-8');
  
  // Preparar datos del motor para el template
  const motorData = motor ? {
    id: motor.id,
    motor_key: (motor.motor_key || '').replace(/"/g, '&quot;'),
    name: (motor.name || '').replace(/"/g, '&quot;'),
    description: (motor.description || '').replace(/"/g, '&quot;').replace(/\n/g, '\\n'),
    category: (motor.category || '').replace(/"/g, '&quot;'),
    definition: JSON.stringify(motor.definition || { inputs: [], rules: {}, outputs: { steps: [], edges: [], captures: [] } }, null, 2).replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
    version: motor.version || 1,
    status: motor.status || 'draft',
    isReadonly: motor.status === 'published'
  } : {
    id: 'nuevo',
    motor_key: '',
    name: '',
    description: '',
    category: '',
    definition: JSON.stringify({ inputs: [], rules: {}, outputs: { steps: [], edges: [], captures: [] } }, null, 2).replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
    version: 1,
    status: 'draft',
    isReadonly: false
  };

  const content = replace(editarTemplate, {
    MOTOR_ID: motorData.id,
    MOTOR_KEY: motorData.motor_key,
    MOTOR_KEY_READONLY: motor && motor.id !== 'nuevo' ? 'readonly' : '',
    NAME: motorData.name,
    DESCRIPTION: motorData.description,
    CATEGORY: motorData.category,
    DEFINITION: motorData.definition,
    VERSION: motorData.version,
    STATUS: motorData.status,
    IS_READONLY: motorData.isReadonly ? 'true' : 'false'
  });

  const html = replace(baseTemplate, {
    TITLE: 'Diseñador de Motores',
    CONTENT: content,
    CURRENT_PATH: '/admin/motors'
  });

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=UTF-8' }
  });
}

