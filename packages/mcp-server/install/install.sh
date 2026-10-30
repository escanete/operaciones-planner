#!/usr/bin/env bash
# Instalador del MCP de Operaciones Planner para Claude Desktop (macOS / Linux)
#
# Uso:
#   bash install.sh
#   bash install.sh --api-url http://192.168.25.7:3001
#   bash install.sh --bundle-url /ruta/local/operaciones-planner-mcp.js
#   bash install.sh --uninstall

set -euo pipefail

API_URL="http://192.168.25.7:3001"
BUNDLE_URL=""
LOGIN_EMAIL=""
LOGIN_PASSWORD=""
UNINSTALL=0
INSTALL_DIR="$HOME/.local/share/operaciones-planner-mcp"
ENTRY="$INSTALL_DIR/index.js"

while [ $# -gt 0 ]; do
  case "$1" in
    --api-url) API_URL="$2"; shift 2 ;;
    --bundle-url) BUNDLE_URL="$2"; shift 2 ;;
    --email) LOGIN_EMAIL="$2"; shift 2 ;;
    --password) LOGIN_PASSWORD="$2"; shift 2 ;;
    --uninstall) UNINSTALL=1; shift ;;
    *) echo "Opcion desconocida: $1"; exit 1 ;;
  esac
done

API_URL="${API_URL%/}"
if [ -z "$BUNDLE_URL" ]; then
  DOWNLOAD_URL="$API_URL/api/mcp/operaciones-planner-mcp.js"
else
  DOWNLOAD_URL="$BUNDLE_URL"
fi

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
echo "Descargando servidor MCP desde $DOWNLOAD_URL ..."

case "$DOWNLOAD_URL" in
  http://*|https://*)
    if command -v curl >/dev/null 2>&1; then
      curl -fsSL "$DOWNLOAD_URL" -o "$ENTRY"
    else
      wget -q "$DOWNLOAD_URL" -O "$ENTRY"
    fi
    ;;
  *)
    cp "$DOWNLOAD_URL" "$ENTRY"
    ;;
esac

if ! head -n 3 "$ENTRY" | grep -q node; then
  echo "El archivo descargado no parece un servidor MCP valido. Pide soporte de TI."
  exit 1
fi
chmod +x "$ENTRY"

echo ""
echo "Iniciando sesion con tu cuenta de Operaciones Planner..."
if [ -n "$LOGIN_EMAIL" ] && [ -n "$LOGIN_PASSWORD" ]; then
  node "$ENTRY" --login --api-url "$API_URL" --email "$LOGIN_EMAIL" --password "$LOGIN_PASSWORD"
else
  node "$ENTRY" --login --api-url "$API_URL"
fi

echo ""
echo "Listo. Cierra y vuelve a abrir Claude Desktop para usar el servidor 'operaciones-planner'."
echo "Puedes comprobar la sesion con: node \"$ENTRY\" --status"
