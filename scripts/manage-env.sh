#!/bin/bash
# ============================================================================
# Script de Gestión de Entornos - AuriPortal
# ============================================================================
# Uso: ./scripts/manage-env.sh [comando] [entorno]
#
# Comandos disponibles:
#   start    - Iniciar un entorno
#   stop     - Detener un entorno
#   restart  - Reiniciar un entorno
#   status   - Ver estado de todos los entornos
#   logs     - Ver logs de un entorno
#   version  - Ver versión de un entorno
#   rollback - Rollback rápido a configuración anterior
# ============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función de ayuda
show_help() {
    echo -e "${BLUE}AuriPortal - Gestión de Entornos${NC}"
    echo ""
    echo "Uso: $0 [comando] [entorno]"
    echo ""
    echo "Comandos:"
    echo "  start [prod|beta|dev]    - Iniciar un entorno"
    echo "  stop [prod|beta|dev]     - Detener un entorno"
    echo "  restart [prod|beta|dev]  - Reiniciar un entorno"
    echo "  status                   - Ver estado de todos los entornos"
    echo "  logs [prod|beta|dev]     - Ver logs de un entorno"
    echo "  version [prod|beta|dev] - Ver versión de un entorno"
    echo "  rollback                 - Rollback rápido a configuración anterior"
    echo "  help                     - Mostrar esta ayuda"
    echo ""
    echo "Ejemplos:"
    echo "  $0 start prod"
    echo "  $0 logs beta"
    echo "  $0 restart dev"
    echo "  $0 status"
}

# Función para obtener nombre PM2 del entorno
get_pm2_name() {
    local env=$1
    case $env in
        prod) echo "aurelinportal-prod" ;;
        beta) echo "aurelinportal-beta" ;;
        dev) echo "aurelinportal-dev" ;;
        *) echo "" ;;
    esac
}

# Función para obtener puerto del entorno
get_port() {
    local env=$1
    case $env in
        prod) echo "3000" ;;
        beta) echo "3002" ;;
        dev) echo "3001" ;;
        *) echo "" ;;
    esac
}

# Función para validar entorno
validate_env() {
    local env=$1
    if [[ ! "$env" =~ ^(prod|beta|dev)$ ]]; then
        echo -e "${RED}Error: Entorno inválido. Debe ser: prod, beta o dev${NC}" >&2
        exit 1
    fi
}

# Comando: start
cmd_start() {
    local env=$1
    validate_env "$env"
    local pm2_name=$(get_pm2_name "$env")
    
    echo -e "${BLUE}Iniciando entorno: ${env}${NC}"
    pm2 start ecosystem.config.js --only "$pm2_name"
    pm2 save
    echo -e "${GREEN}✓ Entorno ${env} iniciado${NC}"
}

# Comando: stop
cmd_stop() {
    local env=$1
    validate_env "$env"
    local pm2_name=$(get_pm2_name "$env")
    
    echo -e "${YELLOW}Deteniendo entorno: ${env}${NC}"
    pm2 stop "$pm2_name"
    pm2 save
    echo -e "${GREEN}✓ Entorno ${env} detenido${NC}"
}

# Comando: restart
cmd_restart() {
    local env=$1
    validate_env "$env"
    local pm2_name=$(get_pm2_name "$env")
    
    echo -e "${BLUE}Reiniciando entorno: ${env}${NC}"
    pm2 restart "$pm2_name"
    echo -e "${GREEN}✓ Entorno ${env} reiniciado${NC}"
}

# Comando: status
cmd_status() {
    echo -e "${BLUE}Estado de Entornos:${NC}"
    echo ""
    pm2 status
    echo ""
    echo -e "${BLUE}Verificando puertos:${NC}"
    for env in prod beta dev; do
        local port=$(get_port "$env")
        local pm2_name=$(get_pm2_name "$env")
        if pm2 describe "$pm2_name" &>/dev/null 2>&1; then
            local status=$(pm2 jlist 2>/dev/null | grep -o "\"name\":\"$pm2_name\"" | head -1 >/dev/null && echo "exists" || echo "none")
            if [ "$status" = "exists" ]; then
                if netstat -tln 2>/dev/null | grep -q ":$port " || ss -tln 2>/dev/null | grep -q ":$port "; then
                    echo -e "  ${GREEN}✓${NC} ${env} (puerto ${port}): ${GREEN}ONLINE${NC}"
                else
                    echo -e "  ${YELLOW}⚠${NC} ${env} (puerto ${port}): ${YELLOW}PROCESO EXISTE PERO PUERTO NO ESCUCHANDO${NC}"
                fi
            else
                echo -e "  ${RED}✗${NC} ${env} (puerto ${port}): ${RED}OFFLINE${NC}"
            fi
        else
            echo -e "  ${RED}✗${NC} ${env} (puerto ${port}): ${RED}OFFLINE${NC}"
        fi
    done
}

# Comando: logs
cmd_logs() {
    local env=$1
    if [ -z "$env" ]; then
        echo -e "${BLUE}Mostrando logs de todos los entornos:${NC}"
        pm2 logs
    else
        validate_env "$env"
        local pm2_name=$(get_pm2_name "$env")
        echo -e "${BLUE}Logs de entorno: ${env}${NC}"
        pm2 logs "$pm2_name" --lines 50
    fi
}

# Comando: version
cmd_version() {
    local env=$1
    validate_env "$env"
    local port=$(get_port "$env")
    
    echo -e "${BLUE}Información de versión - Entorno: ${env}${NC}"
    echo ""
    
    if curl -s "http://localhost:${port}/__version" > /dev/null 2>&1; then
        curl -s "http://localhost:${port}/__version" | python3 -m json.tool 2>/dev/null || curl -s "http://localhost:${port}/__version"
    else
        echo -e "${RED}Error: No se pudo conectar al entorno ${env} en puerto ${port}${NC}"
        exit 1
    fi
}

# Comando: rollback
cmd_rollback() {
    echo -e "${YELLOW}⚠️  ROLLBACK - Restaurando configuración anterior${NC}"
    echo ""
    
    # Encontrar backup más reciente
    local backup_file=$(ls -t /etc/nginx/sites-available/aurelinportal.backup.* 2>/dev/null | head -1)
    
    if [ -z "$backup_file" ]; then
        echo -e "${RED}Error: No se encontró archivo de backup${NC}"
        exit 1
    fi
    
    echo -e "${BLUE}Backup encontrado: ${backup_file}${NC}"
    read -p "¿Continuar con el rollback? (s/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Ss]$ ]]; then
        echo -e "${YELLOW}Rollback cancelado${NC}"
        exit 0
    fi
    
    # Restaurar Nginx
    echo -e "${BLUE}Restaurando configuración Nginx...${NC}"
    sudo cp "$backup_file" /etc/nginx/sites-available/aurelinportal
    sudo nginx -t && sudo systemctl reload nginx
    echo -e "${GREEN}✓ Nginx restaurado${NC}"
    
    # Detener entornos nuevos
    echo -e "${BLUE}Deteniendo entornos nuevos...${NC}"
    pm2 stop aurelinportal-prod aurelinportal-beta aurelinportal-dev 2>/dev/null || true
    pm2 delete aurelinportal-prod aurelinportal-beta aurelinportal-dev 2>/dev/null || true
    
    # Iniciar proceso anterior
    echo -e "${BLUE}Iniciando proceso anterior...${NC}"
    pm2 start server.js --name aurelinportal || true
    pm2 save
    
    echo -e "${GREEN}✓ Rollback completado${NC}"
}

# Main
COMMAND=$1
ENV=$2

case $COMMAND in
    start)
        if [ -z "$ENV" ]; then
            echo -e "${RED}Error: Especifica un entorno (prod, beta, dev)${NC}" >&2
            exit 1
        fi
        cmd_start "$ENV"
        ;;
    stop)
        if [ -z "$ENV" ]; then
            echo -e "${RED}Error: Especifica un entorno (prod, beta, dev)${NC}" >&2
            exit 1
        fi
        cmd_stop "$ENV"
        ;;
    restart)
        if [ -z "$ENV" ]; then
            echo -e "${RED}Error: Especifica un entorno (prod, beta, dev)${NC}" >&2
            exit 1
        fi
        cmd_restart "$ENV"
        ;;
    status)
        cmd_status
        ;;
    logs)
        cmd_logs "$ENV"
        ;;
    version)
        if [ -z "$ENV" ]; then
            echo -e "${RED}Error: Especifica un entorno (prod, beta, dev)${NC}" >&2
            exit 1
        fi
        cmd_version "$ENV"
        ;;
    rollback)
        cmd_rollback
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo -e "${RED}Error: Comando desconocido: ${COMMAND}${NC}" >&2
        echo ""
        show_help
        exit 1
        ;;
esac






















