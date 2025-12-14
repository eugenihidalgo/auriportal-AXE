#!/usr/bin/env python3
"""
Servidor MCP para AuriPortal
Gestiona recursos del servidor: archivos, servicios, base de datos, logs
"""

import asyncio
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

# Configuración del proyecto
PROJECT_ROOT = Path("/var/www/aurelinportal")
LOGS_DIR = PROJECT_ROOT / "logs"
DATABASE_DIR = PROJECT_ROOT / "database"
SCRIPTS_DIR = PROJECT_ROOT / "scripts"
SRC_DIR = PROJECT_ROOT / "src"


class MCPServer:
    """Servidor MCP para gestionar recursos de AuriPortal"""
    
    def __init__(self):
        self.project_root = PROJECT_ROOT
        
    async def handle_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Maneja las peticiones MCP"""
        method = request.get("method")
        params = request.get("params", {})
        
        if method == "initialize":
            return {
                "jsonrpc": "2.0",
                "id": request.get("id"),
                "result": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {
                        "resources": {},
                        "tools": {}
                    },
                    "serverInfo": {
                        "name": "aurelinportal-mcp-server",
                        "version": "1.0.0"
                    }
                }
            }
        
        elif method == "resources/list":
            return {
                "jsonrpc": "2.0",
                "id": request.get("id"),
                "result": {
                    "resources": await self.list_resources()
                }
            }
        
        elif method == "resources/read":
            uri = params.get("uri")
            return {
                "jsonrpc": "2.0",
                "id": request.get("id"),
                "result": await self.read_resource(uri)
            }
        
        elif method == "tools/list":
            return {
                "jsonrpc": "2.0",
                "id": request.get("id"),
                "result": {
                    "tools": await self.list_tools()
                }
            }
        
        elif method == "tools/call":
            name = params.get("name")
            arguments = params.get("arguments", {})
            return {
                "jsonrpc": "2.0",
                "id": request.get("id"),
                "result": await self.call_tool(name, arguments)
            }
        
        else:
            return {
                "jsonrpc": "2.0",
                "id": request.get("id"),
                "error": {
                    "code": -32601,
                    "message": f"Método no encontrado: {method}"
                }
            }
    
    async def list_resources(self) -> List[Dict[str, Any]]:
        """Lista todos los recursos disponibles"""
        resources = []
        
        # Archivos principales
        main_files = ["server.js", "package.json", ".env"]
        for file in main_files:
            file_path = self.project_root / file
            if file_path.exists():
                resources.append({
                    "uri": f"file://{file_path}",
                    "name": file,
                    "description": f"Archivo {file} del proyecto",
                    "mimeType": self._get_mime_type(file_path)
                })
        
        # Directorio de scripts
        if SCRIPTS_DIR.exists():
            for script in SCRIPTS_DIR.glob("*.js"):
                resources.append({
                    "uri": f"file://{script}",
                    "name": f"scripts/{script.name}",
                    "description": f"Script: {script.name}",
                    "mimeType": "application/javascript"
                })
        
        # Archivos de documentación
        for doc in self.project_root.glob("*.md"):
            resources.append({
                "uri": f"file://{doc}",
                "name": doc.name,
                "description": f"Documentación: {doc.name}",
                "mimeType": "text/markdown"
            })
        
        # Logs
        if LOGS_DIR.exists():
            for log_file in LOGS_DIR.glob("*.log"):
                resources.append({
                    "uri": f"file://{log_file}",
                    "name": f"logs/{log_file.name}",
                    "description": f"Log: {log_file.name}",
                    "mimeType": "text/plain"
                })
        
        # Base de datos
        if DATABASE_DIR.exists():
            for db_file in DATABASE_DIR.glob("*.db"):
                resources.append({
                    "uri": f"file://{db_file}",
                    "name": f"database/{db_file.name}",
                    "description": f"Base de datos: {db_file.name}",
                    "mimeType": "application/x-sqlite3"
                })
        
        return resources
    
    async def read_resource(self, uri: str) -> Dict[str, Any]:
        """Lee un recurso por URI"""
        if not uri.startswith("file://"):
            raise ValueError(f"URI no soportada: {uri}")
        
        file_path = Path(uri.replace("file://", ""))
        
        if not file_path.exists():
            raise FileNotFoundError(f"Archivo no encontrado: {file_path}")
        
        # Verificar que está dentro del proyecto
        try:
            file_path.resolve().relative_to(self.project_root.resolve())
        except ValueError:
            raise PermissionError(f"Acceso denegado: {file_path}")
        
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
            
            return {
                "contents": [
                    {
                        "uri": uri,
                        "mimeType": self._get_mime_type(file_path),
                        "text": content
                    }
                ]
            }
        except Exception as e:
            raise IOError(f"Error leyendo archivo: {e}")
    
    async def list_tools(self) -> List[Dict[str, Any]]:
        """Lista todas las herramientas disponibles"""
        return [
            {
                "name": "pm2_status",
                "description": "Obtiene el estado del servicio PM2 de AuriPortal",
                "inputSchema": {
                    "type": "object",
                    "properties": {}
                }
            },
            {
                "name": "pm2_restart",
                "description": "Reinicia el servicio PM2 de AuriPortal",
                "inputSchema": {
                    "type": "object",
                    "properties": {}
                }
            },
            {
                "name": "pm2_logs",
                "description": "Obtiene los últimos logs del servicio PM2",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "lines": {
                            "type": "number",
                            "description": "Número de líneas a obtener",
                            "default": 50
                        }
                    }
                }
            },
            {
                "name": "nginx_status",
                "description": "Verifica el estado del servicio Nginx",
                "inputSchema": {
                    "type": "object",
                    "properties": {}
                }
            },
            {
                "name": "run_script",
                "description": "Ejecuta un script del proyecto",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "script": {
                            "type": "string",
                            "description": "Nombre del script a ejecutar (sin .js)"
                        }
                    },
                    "required": ["script"]
                }
            },
            {
                "name": "list_files",
                "description": "Lista archivos en un directorio del proyecto",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "directory": {
                            "type": "string",
                            "description": "Directorio relativo al proyecto (ej: 'src', 'scripts')",
                            "default": "."
                        }
                    }
                }
            },
            {
                "name": "read_file",
                "description": "Lee el contenido de un archivo del proyecto",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "path": {
                            "type": "string",
                            "description": "Ruta relativa al proyecto (ej: 'server.js', 'src/router.js')"
                        }
                    },
                    "required": ["path"]
                }
            }
        ]
    
    async def call_tool(self, name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Ejecuta una herramienta"""
        if name == "pm2_status":
            return await self._pm2_status()
        elif name == "pm2_restart":
            return await self._pm2_restart()
        elif name == "pm2_logs":
            lines = arguments.get("lines", 50)
            return await self._pm2_logs(lines)
        elif name == "nginx_status":
            return await self._nginx_status()
        elif name == "run_script":
            script = arguments.get("script")
            return await self._run_script(script)
        elif name == "list_files":
            directory = arguments.get("directory", ".")
            return await self._list_files(directory)
        elif name == "read_file":
            path = arguments.get("path")
            return await self._read_file(path)
        else:
            raise ValueError(f"Herramienta no encontrada: {name}")
    
    async def _pm2_status(self) -> Dict[str, Any]:
        """Obtiene el estado de PM2"""
        try:
            result = subprocess.run(
                ["pm2", "status", "aurelinportal"],
                capture_output=True,
                text=True,
                timeout=10
            )
            return {
                "content": [
                    {
                        "type": "text",
                        "text": result.stdout + result.stderr
                    }
                ]
            }
        except Exception as e:
            return {
                "content": [
                    {
                        "type": "text",
                        "text": f"Error: {str(e)}"
                    }
                ],
                "isError": True
            }
    
    async def _pm2_restart(self) -> Dict[str, Any]:
        """Reinicia el servicio PM2"""
        try:
            result = subprocess.run(
                ["pm2", "restart", "aurelinportal"],
                capture_output=True,
                text=True,
                timeout=30
            )
            return {
                "content": [
                    {
                        "type": "text",
                        "text": result.stdout + result.stderr
                    }
                ]
            }
        except Exception as e:
            return {
                "content": [
                    {
                        "type": "text",
                        "text": f"Error: {str(e)}"
                    }
                ],
                "isError": True
            }
    
    async def _pm2_logs(self, lines: int) -> Dict[str, Any]:
        """Obtiene logs de PM2"""
        try:
            result = subprocess.run(
                ["pm2", "logs", "aurelinportal", "--lines", str(lines), "--nostream"],
                capture_output=True,
                text=True,
                timeout=10
            )
            return {
                "content": [
                    {
                        "type": "text",
                        "text": result.stdout + result.stderr
                    }
                ]
            }
        except Exception as e:
            return {
                "content": [
                    {
                        "type": "text",
                        "text": f"Error: {str(e)}"
                    }
                ],
                "isError": True
            }
    
    async def _nginx_status(self) -> Dict[str, Any]:
        """Verifica el estado de Nginx"""
        try:
            result = subprocess.run(
                ["systemctl", "status", "nginx", "--no-pager"],
                capture_output=True,
                text=True,
                timeout=10
            )
            return {
                "content": [
                    {
                        "type": "text",
                        "text": result.stdout + result.stderr
                    }
                ]
            }
        except Exception as e:
            return {
                "content": [
                    {
                        "type": "text",
                        "text": f"Error: {str(e)}"
                    }
                ],
                "isError": True
            }
    
    async def _run_script(self, script: str) -> Dict[str, Any]:
        """Ejecuta un script del proyecto"""
        script_path = SCRIPTS_DIR / f"{script}.js"
        if not script_path.exists():
            return {
                "content": [
                    {
                        "type": "text",
                        "text": f"Script no encontrado: {script}.js"
                    }
                ],
                "isError": True
            }
        
        try:
            result = subprocess.run(
                ["node", str(script_path)],
                cwd=str(self.project_root),
                capture_output=True,
                text=True,
                timeout=60
            )
            return {
                "content": [
                    {
                        "type": "text",
                        "text": f"Exit code: {result.returncode}\n\nSTDOUT:\n{result.stdout}\n\nSTDERR:\n{result.stderr}"
                    }
                ]
            }
        except Exception as e:
            return {
                "content": [
                    {
                        "type": "text",
                        "text": f"Error: {str(e)}"
                    }
                ],
                "isError": True
            }
    
    async def _list_files(self, directory: str) -> Dict[str, Any]:
        """Lista archivos en un directorio"""
        dir_path = self.project_root / directory
        if not dir_path.exists():
            return {
                "content": [
                    {
                        "type": "text",
                        "text": f"Directorio no encontrado: {directory}"
                    }
                ],
                "isError": True
            }
        
        try:
            files = []
            for item in sorted(dir_path.iterdir()):
                if item.is_file():
                    files.append(f"📄 {item.name}")
                elif item.is_dir():
                    files.append(f"📁 {item.name}/")
            
            return {
                "content": [
                    {
                        "type": "text",
                        "text": "\n".join(files) if files else "Directorio vacío"
                    }
                ]
            }
        except Exception as e:
            return {
                "content": [
                    {
                        "type": "text",
                        "text": f"Error: {str(e)}"
                    }
                ],
                "isError": True
            }
    
    async def _read_file(self, path: str) -> Dict[str, Any]:
        """Lee un archivo del proyecto"""
        file_path = self.project_root / path
        if not file_path.exists():
            return {
                "content": [
                    {
                        "type": "text",
                        "text": f"Archivo no encontrado: {path}"
                    }
                ],
                "isError": True
            }
        
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
            
            return {
                "content": [
                    {
                        "type": "text",
                        "text": content
                    }
                ]
            }
        except Exception as e:
            return {
                "content": [
                    {
                        "type": "text",
                        "text": f"Error: {str(e)}"
                    }
                ],
                "isError": True
            }
    
    def _get_mime_type(self, file_path: Path) -> str:
        """Determina el tipo MIME de un archivo"""
        suffix = file_path.suffix.lower()
        mime_types = {
            ".js": "application/javascript",
            ".json": "application/json",
            ".md": "text/markdown",
            ".txt": "text/plain",
            ".log": "text/plain",
            ".db": "application/x-sqlite3",
            ".sql": "application/sql",
            ".env": "text/plain",
            ".py": "text/x-python",
            ".sh": "text/x-shellscript"
        }
        return mime_types.get(suffix, "application/octet-stream")


async def main():
    """Función principal del servidor MCP"""
    server = MCPServer()
    
    # Leer peticiones desde stdin
    while True:
        try:
            line = await asyncio.get_event_loop().run_in_executor(
                None, sys.stdin.readline
            )
            if not line:
                break
            
            request = json.loads(line.strip())
            response = await server.handle_request(request)
            print(json.dumps(response), flush=True)
        
        except json.JSONDecodeError:
            continue
        except Exception as e:
            error_response = {
                "jsonrpc": "2.0",
                "id": None,
                "error": {
                    "code": -32603,
                    "message": f"Error interno: {str(e)}"
                }
            }
            print(json.dumps(error_response), flush=True)


if __name__ == "__main__":
    asyncio.run(main())

