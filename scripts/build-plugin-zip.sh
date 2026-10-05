#!/usr/bin/env bash
# Builds the ChatGPT/Codex plugin ZIP for upload in the OpenAI Platform Dashboard (Plugins page).
# Output: dist/asshield-insurance-plugin-<version>.zip with plugin.json at the ZIP root.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PKG="$ROOT/chatgpt-plugin/asshield-insurance"
VERSION="$(node -p "require('$PKG/plugin.json').version")"
mkdir -p "$ROOT/dist"
OUT="$ROOT/dist/asshield-insurance-plugin-$VERSION.zip"
rm -f "$OUT"
node -e "JSON.parse(require('fs').readFileSync('$PKG/plugin.json'));JSON.parse(require('fs').readFileSync('$PKG/mcp.json'))"
if grep -RInE '(sk-[A-Za-z0-9]{20,}|SUPABASE_SERVICE_ROLE_KEY=|rnd_[A-Za-z0-9]{20,}|gh[pousr]_[A-Za-z0-9]{20,})' "$PKG" >/dev/null; then
  echo "Refusing to build: possible secret in plugin package" >&2; exit 1
fi
(cd "$PKG" && zip -qr -X "$OUT" plugin.json mcp.json skills assets)
echo "Built $OUT"
unzip -l "$OUT"
