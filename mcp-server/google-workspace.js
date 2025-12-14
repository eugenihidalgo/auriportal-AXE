#!/usr/bin/env node
/**
 * MCP Server para Google Workspace
 * Expone las APIs de Google Workspace (Gmail, Drive, Calendar, Sheets, Docs, Admin SDK)
 * 
 * Uso:
 *   node mcp-server/google-workspace.js
 * 
 * O configurar en Cursor como servidor MCP:
 *   {
 *     "mcpServers": {
 *       "google-workspace": {
 *         "command": "node",
 *         "args": ["/var/www/aurelinportal/mcp-server/google-workspace.js"]
 *       }
 *     }
 *   }
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Cargar variables de entorno
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

// Importar servicios de Google Workspace
import {
  // Gmail
  enviarEmailGmail,
  listarEmailsGmail,
  obtenerEmailGmail,
  obtenerClienteGmail,
  // Drive
  listarArchivosDrive,
  obtenerArchivoDrive,
  crearArchivoDrive,
  descargarArchivoDrive,
  buscarCarpetaDrive,
  crearCarpetaDrive,
  listarArchivosEnCarpeta,
  obtenerClienteDrive,
  // Calendar
  listarEventosCalendar,
  crearEventoCalendar,
  obtenerClienteCalendar,
  // Sheets
  leerDatosSheets,
  escribirDatosSheets,
  obtenerClienteSheets,
  // Docs
  obtenerDocumentoDocs,
  crearDocumentoDocs,
  obtenerClienteDocs,
  // Admin SDK
  listarUsuariosAdmin,
  obtenerUsuarioAdmin,
  crearUsuarioAdmin,
  listarGruposAdmin,
  obtenerGrupoAdmin,
  listarMiembrosGrupo,
  agregarMiembroGrupo,
  // Utilidades
  verificarConexionGoogle,
} from '../src/services/google-workspace.js';

// Crear objeto env con las variables de entorno
const env = {
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_REFRESH_TOKEN: process.env.GOOGLE_REFRESH_TOKEN,
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
  GOOGLE_SERVICE_ACCOUNT_KEY: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
  GOOGLE_SERVICE_ACCOUNT_IMPERSONATE: process.env.GOOGLE_SERVICE_ACCOUNT_IMPERSONATE,
  GOOGLE_PROJECT_ID: process.env.GOOGLE_PROJECT_ID,
  GOOGLE_WORKSPACE_DOMAIN: process.env.GOOGLE_WORKSPACE_DOMAIN,
  EMAIL_FROM: process.env.EMAIL_FROM,
};

// Crear servidor MCP
const server = new Server(
  {
    name: 'google-workspace',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// ============================================
// RECURSOS (Resources)
// ============================================

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: 'google://connection-status',
        name: 'Estado de Conexión',
        description: 'Estado de la conexión con Google Workspace',
        mimeType: 'application/json',
      },
      {
        uri: 'google://profile',
        name: 'Perfil de Usuario',
        description: 'Información del perfil de usuario de Google',
        mimeType: 'application/json',
      },
    ],
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  if (uri === 'google://connection-status') {
    try {
      const status = await verificarConexionGoogle(env);
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(status, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({ error: error.message }, null, 2),
          },
        ],
      };
    }
  }

  if (uri === 'google://profile') {
    try {
      const gmail = obtenerClienteGmail(env);
      const profile = await gmail.users.getProfile({ userId: 'me' });
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(profile.data, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({ error: error.message }, null, 2),
          },
        ],
      };
    }
  }

  throw new Error(`Recurso desconocido: ${uri}`);
});

// ============================================
// HERRAMIENTAS (Tools)
// ============================================

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // Gmail
      {
        name: 'gmail_send',
        description: 'Envía un email usando Gmail API',
        inputSchema: {
          type: 'object',
          properties: {
            destinatario: {
              type: 'string',
              description: 'Email del destinatario',
            },
            asunto: {
              type: 'string',
              description: 'Asunto del email',
            },
            texto: {
              type: 'string',
              description: 'Contenido del email en texto plano',
            },
            html: {
              type: 'string',
              description: 'Contenido del email en HTML (opcional)',
            },
            remitente: {
              type: 'string',
              description: 'Email del remitente (default: "me")',
              default: 'me',
            },
          },
          required: ['destinatario', 'asunto', 'texto'],
        },
      },
      {
        name: 'gmail_list',
        description: 'Lista emails de la bandeja de entrada',
        inputSchema: {
          type: 'object',
          properties: {
            maxResults: {
              type: 'number',
              description: 'Número máximo de resultados (default: 10)',
              default: 10,
            },
            query: {
              type: 'string',
              description: 'Query de búsqueda de Gmail (opcional)',
            },
          },
        },
      },
      {
        name: 'gmail_get',
        description: 'Obtiene un email completo por su ID',
        inputSchema: {
          type: 'object',
          properties: {
            messageId: {
              type: 'string',
              description: 'ID del mensaje',
            },
          },
          required: ['messageId'],
        },
      },
      // Drive
      {
        name: 'drive_list',
        description: 'Lista archivos en Google Drive',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Query de búsqueda (opcional)',
            },
            maxResults: {
              type: 'number',
              description: 'Número máximo de resultados (default: 100)',
              default: 100,
            },
          },
        },
      },
      {
        name: 'drive_get',
        description: 'Obtiene información de un archivo de Drive por ID',
        inputSchema: {
          type: 'object',
          properties: {
            fileId: {
              type: 'string',
              description: 'ID del archivo',
            },
          },
          required: ['fileId'],
        },
      },
      {
        name: 'drive_list_folder',
        description: 'Lista archivos en una carpeta específica de Drive',
        inputSchema: {
          type: 'object',
          properties: {
            folderId: {
              type: 'string',
              description: 'ID de la carpeta',
            },
            maxResults: {
              type: 'number',
              description: 'Número máximo de resultados (default: 100)',
              default: 100,
            },
          },
          required: ['folderId'],
        },
      },
      {
        name: 'drive_create_file',
        description: 'Crea un archivo en Google Drive',
        inputSchema: {
          type: 'object',
          properties: {
            nombre: {
              type: 'string',
              description: 'Nombre del archivo',
            },
            contenido: {
              type: 'string',
              description: 'Contenido del archivo',
            },
            mimeType: {
              type: 'string',
              description: 'Tipo MIME del archivo (default: text/plain)',
              default: 'text/plain',
            },
          },
          required: ['nombre', 'contenido'],
        },
      },
      {
        name: 'drive_create_folder',
        description: 'Crea una carpeta en Google Drive',
        inputSchema: {
          type: 'object',
          properties: {
            nombre: {
              type: 'string',
              description: 'Nombre de la carpeta',
            },
            parentId: {
              type: 'string',
              description: 'ID de la carpeta padre (opcional)',
            },
          },
          required: ['nombre'],
        },
      },
      {
        name: 'drive_find_folder',
        description: 'Busca una carpeta por nombre en Google Drive',
        inputSchema: {
          type: 'object',
          properties: {
            nombre: {
              type: 'string',
              description: 'Nombre de la carpeta',
            },
            parentId: {
              type: 'string',
              description: 'ID de la carpeta padre (opcional)',
            },
          },
          required: ['nombre'],
        },
      },
      // Calendar
      {
        name: 'calendar_list',
        description: 'Lista eventos del calendario',
        inputSchema: {
          type: 'object',
          properties: {
            calendarId: {
              type: 'string',
              description: 'ID del calendario (default: "primary")',
              default: 'primary',
            },
            maxResults: {
              type: 'number',
              description: 'Número máximo de resultados (default: 10)',
              default: 10,
            },
          },
        },
      },
      {
        name: 'calendar_create',
        description: 'Crea un evento en el calendario',
        inputSchema: {
          type: 'object',
          properties: {
            resumen: {
              type: 'string',
              description: 'Título del evento',
            },
            descripcion: {
              type: 'string',
              description: 'Descripción del evento',
            },
            inicio: {
              type: 'string',
              description: 'Fecha/hora de inicio (ISO 8601)',
            },
            fin: {
              type: 'string',
              description: 'Fecha/hora de fin (ISO 8601)',
            },
            calendarId: {
              type: 'string',
              description: 'ID del calendario (default: "primary")',
              default: 'primary',
            },
          },
          required: ['resumen', 'descripcion', 'inicio', 'fin'],
        },
      },
      // Sheets
      {
        name: 'sheets_read',
        description: 'Lee datos de una hoja de cálculo',
        inputSchema: {
          type: 'object',
          properties: {
            spreadsheetId: {
              type: 'string',
              description: 'ID de la hoja de cálculo',
            },
            rango: {
              type: 'string',
              description: 'Rango a leer (ej: "A1:C10" o "Sheet1!A1:C10")',
            },
          },
          required: ['spreadsheetId', 'rango'],
        },
      },
      {
        name: 'sheets_write',
        description: 'Escribe datos en una hoja de cálculo',
        inputSchema: {
          type: 'object',
          properties: {
            spreadsheetId: {
              type: 'string',
              description: 'ID de la hoja de cálculo',
            },
            rango: {
              type: 'string',
              description: 'Rango a escribir (ej: "A1:C10" o "Sheet1!A1:C10")',
            },
            valores: {
              type: 'array',
              items: {
                type: 'array',
                items: {
                  type: 'string',
                },
              },
              description: 'Array bidimensional de valores',
            },
          },
          required: ['spreadsheetId', 'rango', 'valores'],
        },
      },
      // Docs
      {
        name: 'docs_get',
        description: 'Obtiene un documento de Google Docs',
        inputSchema: {
          type: 'object',
          properties: {
            documentId: {
              type: 'string',
              description: 'ID del documento',
            },
          },
          required: ['documentId'],
        },
      },
      {
        name: 'docs_create',
        description: 'Crea un nuevo documento de Google Docs',
        inputSchema: {
          type: 'object',
          properties: {
            titulo: {
              type: 'string',
              description: 'Título del documento',
            },
          },
          required: ['titulo'],
        },
      },
      // Admin SDK - Usuarios
      {
        name: 'admin_list_users',
        description: 'Lista usuarios de Google Workspace',
        inputSchema: {
          type: 'object',
          properties: {
            dominio: {
              type: 'string',
              description: 'Dominio a filtrar (opcional)',
            },
            maxResults: {
              type: 'number',
              description: 'Número máximo de resultados (default: 100)',
              default: 100,
            },
          },
        },
      },
      {
        name: 'admin_get_user',
        description: 'Obtiene un usuario por email',
        inputSchema: {
          type: 'object',
          properties: {
            emailUsuario: {
              type: 'string',
              description: 'Email del usuario',
            },
          },
          required: ['emailUsuario'],
        },
      },
      {
        name: 'admin_create_user',
        description: 'Crea un nuevo usuario en Google Workspace',
        inputSchema: {
          type: 'object',
          properties: {
            emailUsuario: {
              type: 'string',
              description: 'Email del nuevo usuario',
            },
            nombre: {
              type: 'string',
              description: 'Nombre del usuario',
            },
            apellido: {
              type: 'string',
              description: 'Apellido del usuario',
            },
            password: {
              type: 'string',
              description: 'Contraseña del usuario',
            },
          },
          required: ['emailUsuario', 'nombre', 'apellido', 'password'],
        },
      },
      // Admin SDK - Grupos
      {
        name: 'admin_list_groups',
        description: 'Lista grupos de Google Workspace',
        inputSchema: {
          type: 'object',
          properties: {
            dominio: {
              type: 'string',
              description: 'Dominio a filtrar (opcional)',
            },
            maxResults: {
              type: 'number',
              description: 'Número máximo de resultados (default: 100)',
              default: 100,
            },
          },
        },
      },
      {
        name: 'admin_get_group',
        description: 'Obtiene un grupo por email',
        inputSchema: {
          type: 'object',
          properties: {
            emailGrupo: {
              type: 'string',
              description: 'Email del grupo',
            },
          },
          required: ['emailGrupo'],
        },
      },
      {
        name: 'admin_list_group_members',
        description: 'Lista miembros de un grupo',
        inputSchema: {
          type: 'object',
          properties: {
            emailGrupo: {
              type: 'string',
              description: 'Email del grupo',
            },
          },
          required: ['emailGrupo'],
        },
      },
      {
        name: 'admin_add_group_member',
        description: 'Agrega un miembro a un grupo',
        inputSchema: {
          type: 'object',
          properties: {
            emailGrupo: {
              type: 'string',
              description: 'Email del grupo',
            },
            emailMiembro: {
              type: 'string',
              description: 'Email del miembro a agregar',
            },
            rol: {
              type: 'string',
              description: 'Rol del miembro (MEMBER, OWNER, MANAGER)',
              default: 'MEMBER',
              enum: ['MEMBER', 'OWNER', 'MANAGER'],
            },
          },
          required: ['emailGrupo', 'emailMiembro'],
        },
      },
      // Utilidades
      {
        name: 'google_verify_connection',
        description: 'Verifica la conexión con Google Workspace',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

// Manejar llamadas a herramientas
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      // Gmail
      case 'gmail_send': {
        const result = await enviarEmailGmail(
          env,
          args.destinatario,
          args.asunto,
          args.texto,
          args.html || null,
          args.remitente || 'me'
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }
      case 'gmail_list': {
        const emails = await listarEmailsGmail(
          env,
          'me',
          args.maxResults || 10,
          args.query || null
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(emails, null, 2),
            },
          ],
        };
      }
      case 'gmail_get': {
        const email = await obtenerEmailGmail(env, args.messageId, 'me');
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(email, null, 2),
            },
          ],
        };
      }
      // Drive
      case 'drive_list': {
        const archivos = await listarArchivosDrive(
          env,
          args.query || null,
          args.maxResults || 100
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(archivos, null, 2),
            },
          ],
        };
      }
      case 'drive_get': {
        const archivo = await obtenerArchivoDrive(env, args.fileId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(archivo, null, 2),
            },
          ],
        };
      }
      case 'drive_list_folder': {
        const archivos = await listarArchivosEnCarpeta(
          env,
          args.folderId,
          args.maxResults || 100
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(archivos, null, 2),
            },
          ],
        };
      }
      case 'drive_create_file': {
        const archivo = await crearArchivoDrive(
          env,
          args.nombre,
          args.contenido,
          args.mimeType || 'text/plain'
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(archivo, null, 2),
            },
          ],
        };
      }
      case 'drive_create_folder': {
        const carpeta = await crearCarpetaDrive(
          env,
          args.nombre,
          args.parentId || null
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(carpeta, null, 2),
            },
          ],
        };
      }
      case 'drive_find_folder': {
        const carpeta = await buscarCarpetaDrive(
          env,
          args.nombre,
          args.parentId || null
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(carpeta, null, 2),
            },
          ],
        };
      }
      // Calendar
      case 'calendar_list': {
        const eventos = await listarEventosCalendar(
          env,
          args.calendarId || 'primary',
          args.maxResults || 10
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(eventos, null, 2),
            },
          ],
        };
      }
      case 'calendar_create': {
        const evento = await crearEventoCalendar(
          env,
          args.resumen,
          args.descripcion,
          args.inicio,
          args.fin,
          args.calendarId || 'primary'
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(evento, null, 2),
            },
          ],
        };
      }
      // Sheets
      case 'sheets_read': {
        const datos = await leerDatosSheets(env, args.spreadsheetId, args.rango);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(datos, null, 2),
            },
          ],
        };
      }
      case 'sheets_write': {
        const resultado = await escribirDatosSheets(
          env,
          args.spreadsheetId,
          args.rango,
          args.valores
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(resultado, null, 2),
            },
          ],
        };
      }
      // Docs
      case 'docs_get': {
        const documento = await obtenerDocumentoDocs(env, args.documentId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(documento, null, 2),
            },
          ],
        };
      }
      case 'docs_create': {
        const documento = await crearDocumentoDocs(env, args.titulo);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(documento, null, 2),
            },
          ],
        };
      }
      // Admin SDK - Usuarios
      case 'admin_list_users': {
        const usuarios = await listarUsuariosAdmin(
          env,
          args.dominio || null,
          args.maxResults || 100
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(usuarios, null, 2),
            },
          ],
        };
      }
      case 'admin_get_user': {
        const usuario = await obtenerUsuarioAdmin(env, args.emailUsuario);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(usuario, null, 2),
            },
          ],
        };
      }
      case 'admin_create_user': {
        const usuario = await crearUsuarioAdmin(
          env,
          args.emailUsuario,
          args.nombre,
          args.apellido,
          args.password
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(usuario, null, 2),
            },
          ],
        };
      }
      // Admin SDK - Grupos
      case 'admin_list_groups': {
        const grupos = await listarGruposAdmin(
          env,
          args.dominio || null,
          args.maxResults || 100
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(grupos, null, 2),
            },
          ],
        };
      }
      case 'admin_get_group': {
        const grupo = await obtenerGrupoAdmin(env, args.emailGrupo);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(grupo, null, 2),
            },
          ],
        };
      }
      case 'admin_list_group_members': {
        const miembros = await listarMiembrosGrupo(env, args.emailGrupo);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(miembros, null, 2),
            },
          ],
        };
      }
      case 'admin_add_group_member': {
        const resultado = await agregarMiembroGrupo(
          env,
          args.emailGrupo,
          args.emailMiembro,
          args.rol || 'MEMBER'
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(resultado, null, 2),
            },
          ],
        };
      }
      // Utilidades
      case 'google_verify_connection': {
        const status = await verificarConexionGoogle(env);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(status, null, 2),
            },
          ],
        };
      }
      default:
        throw new Error(`Herramienta desconocida: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              error: error.message,
              stack: error.stack,
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
});

// Iniciar servidor
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('🚀 Servidor MCP de Google Workspace iniciado');
}

main().catch((error) => {
  console.error('❌ Error iniciando servidor MCP:', error);
  process.exit(1);
});

