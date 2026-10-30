#!/usr/bin/env bash
# Instalador del MCP de Operaciones Planner para Claude Desktop (macOS / Linux)
#
# Uso:
#   bash install.sh
#   bash install.sh --api-url http://192.168.25.7:3001
#   bash install.sh --uninstall

set -euo pipefail

API_URL="http://192.168.25.7:3001"
UNINSTALL=0
INSTALL_DIR="$HOME/.local/share/operaciones-planner-mcp"
ENTRY="$INSTALL_DIR/index.js"
DOWNLOAD_URL="https://github.com/Kohwal/operaciones-planner/releases/latest/download/operaciones-planner-mcp.js"

while [ $# -gt 0 ]; do
  case "$1" in
    --api-url) API_URL="$2"; shift 2 ;;
    --uninstall) UNINSTALL=1; shift ;;
    *) echo "Opcion desconocida: $1"; exit 1 ;;
  esac
done

if ! command -v node >/dev/null 2>&1; then
  echo "Falta Node.js. Instala la version LTS desde https://nodejs.org/es/download"
  exit 1
fi

NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "Node.js $(node -v) es demasiado antiguo. Se requiere Node.js 20 o superior."
  exit 1
fi

if [ "$UNINSTALL" -eq 1 ]; then
  if [ -f "$ENTRY" ]; then
    node "$ENTRY" --uninstall
  fi
  rm -rf "$INSTALL_DIR"
  echo "MCP de Operaciones Planner desinstalado. Reinicia Claude Desktop."
  exit 0
fi

mkdir -p "$INSTALL_DIR"
echo "Descargando servidor MCP..."
if command -v curl >/dev/null 2>&1; then
  curl -fsSL "$DOWNLOAD_URL" -o "$ENTRY"
else
  wget -q "$DOWNLOAD_URL" -O "$ENTRY"
fi
chmod +x "$ENTRY"

echo ""
echo "Iniciando sesion con tu cuenta de Operaciones Planner..."
node "$ENTRY" --login --api-url "$API_URL"

echo ""
echo "Listo. Cierra y vuelve a abrir Claude Desktop para usar el servidor 'operaciones-planner'."
echo "Puedes comprobar la sesion con: node \"$ENTRY\" --status"
