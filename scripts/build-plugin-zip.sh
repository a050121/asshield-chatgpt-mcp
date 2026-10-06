#!/usr/bin/env bash
# Builds the ChatGPT/Codex plugin ZIP for upload in the OpenAI Platform Dashboard (Plugins page).
# Output: dist/asshield-insurance-plugin-<version>.zip with plugin.json + mcp.json + skills/ + assets/ at the ZIP root.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PKG="$ROOT/chatgpt-plugin/asshield-insurance"
VERSION="$(node -p "require('$PKG/plugin.json').version")"
mkdir -p "$ROOT/dist"
OUT="$ROOT/dist/asshield-insurance-plugin-$VERSION.zip"
rm -f "$OUT"

node -e "
const fs=require('fs');
const pj=JSON.parse(fs.readFileSync('$PKG/plugin.json','utf8'));
const mcp=JSON.parse(fs.readFileSync('$PKG/mcp.json','utf8'));
if (!pj.extensions?.['com.openai']?.interface) throw new Error('missing extensions.com.openai.interface');
if (!pj.extensions['com.openai'].review?.test_cases) throw new Error('missing review.test_cases');
const pos=pj.extensions['com.openai'].review.test_cases.positive||[];
const neg=pj.extensions['com.openai'].review.test_cases.negative||[];
if (pos.length!==5) throw new Error('need exactly 5 positive cases, got '+pos.length);
if (neg.length!==3) throw new Error('need exactly 3 negative cases, got '+neg.length);
if (!pj.extensions['com.openai'].review.demo_recording_url) throw new Error('missing review.demo_recording_url');
if (!mcp.mcpServers || !Object.keys(mcp.mcpServers).length) throw new Error('mcp.json missing mcpServers');
console.log('manifest ok: v'+pj.version+' pos='+pos.length+' neg='+neg.length);
"

if grep -RInE '(sk-[A-Za-z0-9]{20,}|SUPABASE_SERVICE_ROLE_KEY=|rnd_[A-Za-z0-9]{20,}|gh[pousr]_[A-Za-z0-9]{20,})' "$PKG" >/dev/null; then
  echo "Refusing to build: possible secret in plugin package" >&2; exit 1
fi

# Require required package files
test -f "$PKG/plugin.json"
test -f "$PKG/mcp.json"
test -d "$PKG/skills"
test -d "$PKG/assets"
test -f "$PKG/assets/logo.png"
test -f "$PKG/assets/icon.png"

(cd "$PKG" && zip -qr -X "$OUT" plugin.json mcp.json skills assets)
echo "Built $OUT"

# Verify ZIP root layout (no nested wrapper directory)
python3 - "$OUT" <<'PY'
import sys, zipfile
zpath=sys.argv[1]
with zipfile.ZipFile(zpath) as z:
  names=z.namelist()
required={"plugin.json","mcp.json"}
missing=required-set(names)
if missing:
  raise SystemExit(f"ZIP missing root files: {missing}")
if not any(n.startswith("skills/") for n in names):
  raise SystemExit("ZIP missing skills/")
if not any(n.startswith("assets/") for n in names):
  raise SystemExit("ZIP missing assets/")
# Fail if everything is nested under a single top-level dir other than skills/assets
top={n.split('/')[0] for n in names if n and not n.endswith('/')}
# top files are plugin.json/mcp.json; dirs skills/assets
unexpected=[t for t in top if t not in {"plugin.json","mcp.json","skills","assets"}]
if unexpected:
  raise SystemExit(f"Unexpected ZIP root entries: {unexpected}")
print("ZIP root layout OK")
for n in sorted(names):
  print(n)
PY
