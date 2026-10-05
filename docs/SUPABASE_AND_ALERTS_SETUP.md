# Supabase + lead alerts setup (Josh)

Production must leave memory mode and notify Asshield on every `submit_quote`.
This agent could **not** create a Supabase project: the Management API and CLI require
an interactive login / access token (captcha). Do the account steps below once, then
set Render env vars and redeploy.

## A. Create Supabase (human, ~5 minutes)

1. Open https://supabase.com/dashboard and sign in (GitHub is fine).
2. **New project**
   - Name: `asshield-chatgpt-mcp` (or similar)
   - Database password: generate and store in a password manager
   - Region: close to Render Oregon (e.g. West US)
   - Plan: Free is enough to start
3. Wait until the project is healthy.
4. **SQL Editor** → New query → paste the full contents of
   `db/migrations/001_init.sql` → Run.
5. **Project Settings → API**
   - Copy **Project URL** → `SUPABASE_URL`
   - Copy **service_role** key (secret) → `SUPABASE_SERVICE_ROLE_KEY`
   - Never put the service_role key in browser code, the plugin ZIP, or ChatGPT.

Optional CLI later (after you create a personal access token at
https://supabase.com/dashboard/account/tokens ):

```bash
export SUPABASE_ACCESS_TOKEN=sbp_...
npx supabase link --project-ref YOUR_REF
npx supabase db query --file db/migrations/001_init.sql
```

## B. Lead notifications (pick at least one)

`submit_quote` now:

1. Marks the quote `submitted` in memory or Supabase
2. Builds a full lead snapshot (customer, drivers, vehicles, policy, consents)
3. Notifies via configured channels (failures are logged; status is kept)

### Option 1 — Webhook (recommended)

1. Create a Zapier / Make / n8n catch hook that emails `insurancelexky@gmail.com`
   (or posts into your CRM).
2. Set on Render: `CRM_WEBHOOK_URL=https://hooks.zapier.com/...`

POST body shape:

```json
{
  "event": "quote.submitted",
  "received_at": "2026-10-05T18:00:00.000Z",
  "lead": {
    "quote_id": "...",
    "product": "auto",
    "state": "KY",
    "zip": "40502",
    "customer": { "first_name": "...", "last_name": "...", "phone": "...", "email": "..." },
    "drivers": [],
    "vehicles": [],
    "current_policies": [],
    "consents": [],
    "notes": null,
    "source": "CHATGPT",
    "source_detail": "ASSHIELD_CHATGPT_APP",
    "campaign": "CHATGPT_QUOTE"
  }
}
```

### Option 2 — Resend email

1. Sign up at https://resend.com → API Keys → create key.
2. Free tier can send to your own address from `onboarding@resend.dev`.
3. Set on Render:
   - `RESEND_API_KEY=re_...`
   - `LEAD_NOTIFY_EMAIL=insurancelexky@gmail.com`
   - `LEAD_NOTIFY_FROM=Asshield ChatGPT <onboarding@resend.dev>` (optional)

### Option 3 — Gmail SMTP

1. Google Account → Security → App passwords (2FA required).
2. Set on Render:
   - `SMTP_HOST=smtp.gmail.com`
   - `SMTP_PORT=587`
   - `SMTP_USER=insurancelexky@gmail.com`
   - `SMTP_PASS=<16-char app password>`
   - `LEAD_NOTIFY_EMAIL=insurancelexky@gmail.com`
   - `LEAD_NOTIFY_FROM=Asshield ChatGPT <insurancelexky@gmail.com>`

## C. Render env vars (set BEFORE redeploy)

Service: `srv-db1tg8ss728c73e2fe7g` (`asshield-chatgpt-mcp`).

| Key | Required | Notes |
|---|---|---|
| `SUPABASE_URL` | yes (prod) | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | yes (prod) | service_role secret |
| `PUBLIC_BASE_URL` | already set | `https://asshield-chatgpt-mcp.onrender.com` |
| `CRM_WEBHOOK_URL` | one of notify | preferred |
| `LEAD_NOTIFY_EMAIL` | for email | `insurancelexky@gmail.com` |
| `RESEND_API_KEY` | or SMTP | Resend |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | or Resend | Gmail |
| `LEAD_NOTIFY_FROM` | optional | From header |
| `OPENAI_APPS_CHALLENGE_TOKEN` | at submit time | portal token |

Do **not** redeploy until Supabase URL + service role are set, or the instance stays in memory mode and a restart can wipe leads.

## D. Verify after deploy

```bash
curl -sS https://asshield-chatgpt-mcp.onrender.com/health
# expect: "store":"supabase","notifications_configured":true
```

Then run a full quote through MCP Inspector and confirm Josh receives the email/webhook.

## E. Deploy payload (for parent / Josh)

After secrets exist, either use the Render dashboard **Environment → Add** then **Manual Deploy**,
or the API:

```bash
# Pseudocode — replace SECRET values; never commit them
curl -X PUT "https://api.render.com/v1/services/srv-db1tg8ss728c73e2fe7g/env-vars" \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '[
    {"key":"PUBLIC_BASE_URL","value":"https://asshield-chatgpt-mcp.onrender.com"},
    {"key":"NODE_ENV","value":"production"},
    {"key":"SUPABASE_URL","value":"https://XXXX.supabase.co"},
    {"key":"SUPABASE_SERVICE_ROLE_KEY","value":"eyJ..."},
    {"key":"CRM_WEBHOOK_URL","value":"https://hooks.zapier.com/..."},
    {"key":"LEAD_NOTIFY_EMAIL","value":"insurancelexky@gmail.com"},
    {"key":"RESEND_API_KEY","value":"re_..."}
  ]'

curl -X POST "https://api.render.com/v1/services/srv-db1tg8ss728c73e2fe7g/deploys" \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"clearCache":"do_not_clear"}'
```

Note: a bulk PUT replaces the env-var set; include every key you still need.
