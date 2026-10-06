#!/usr/bin/env bash
# Builds the ChatGPT/Codex plugin ZIP for upload in the OpenAI Platform Dashboard (Plugins page).
# Output: dist/asshield-insurance-plugin-<version>.zip with plugin.json + mcp.json + skills/ + assets/ at the ZIP root.
#
# review.demo_recording_url must be a real URL for a final ZIP.
# Placeholder URLs (example.com / REPLACE-WITH-...) cause this script to FAIL unless you set:
#   ALLOW_PLACEHOLDER_DEMO=1
# Draft builds with the placeholder are for local packaging only — do not upload them for final review.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PKG="$ROOT/chatgpt-plugin/asshield-insurance"
VERSION="$(node -p "require('$PKG/plugin.json').version")"
mkdir -p "$ROOT/dist"
OUT="$ROOT/dist/asshield-insurance-plugin-$VERSION.zip"
rm -f "$OUT"

ALLOW_PLACEHOLDER_DEMO="${ALLOW_PLACEHOLDER_DEMO:-0}"

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
const demo=pj.extensions['com.openai'].review.demo_recording_url||'';
if (!demo) throw new Error('missing review.demo_recording_url');
const placeholder=/example\\.com/i.test(demo) || /REPLACE-WITH/i.test(demo);
if (placeholder && process.env.ALLOW_PLACEHOLDER_DEMO !== '1') {
  console.error('');
  console.error('ERROR: review.demo_recording_url is still a placeholder:');
  console.error('  ' + demo);
  console.error('Do not upload this version for final review.');
  console.error('Replace it with a real demo URL, or set ALLOW_PLACEHOLDER_DEMO=1 for a draft-only ZIP.');
  console.error('');
  process.exit(1);
}
if (placeholder) {
  console.warn('');
  console.warn('WARNING: building DRAFT ZIP with placeholder demo_recording_url — NOT for final review upload.');
  console.warn('  ' + demo);
  console.warn('');
}
if (!mcp.mcpServers || !Object.keys(mcp.mcpServers).length) throw new Error('mcp.json missing mcpServers');
console.log('manifest ok: v'+pj.version+' pos='+pos.length+' neg='+neg.length+(placeholder?' DRAFT_PLACEHOLDER':''));
"

if grep -RInE '(sk-[A-Za-z0-9]{20,}|SUPABASE_SERVICE_ROLE_KEY=|rnd_[A-Za-z0-9]{20,}|gh[pousr]_[A-Za-z0-9]{20,})' "$PKG" >/dev/null; then
  echo "Refusing to build: possible secret in plugin package" >&2; exit 1
fi

test -f "$PKG/plugin.json"
test -f "$PKG/mcp.json"
test -d "$PKG/skills"
test -d "$PKG/assets"
test -f "$PKG/assets/logo.png"
test -f "$PKG/assets/icon.png"

(cd "$PKG" && zip -qr -X "$OUT" plugin.json mcp.json skills assets)
echo "Built $OUT"

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
top={n.split('/')[0] for n in names if n and not n.endswith('/')}
unexpected=[t for t in top if t not in {"plugin.json","mcp.json","skills","assets"}]
if unexpected:
  raise SystemExit(f"Unexpected ZIP root entries: {unexpected}")
print("ZIP root layout OK")
for n in sorted(names):
  print(n)
PY
