# Asshield Insurance — ChatGPT MCP MVP

A starter Node.js + TypeScript MCP server for an Asshield Insurance quote-intake app.

## What this MVP does

- Starts Auto, Home, Auto + Home, and Renters quote sessions
- Saves customer contact information
- Adds drivers
- Adds vehicles
- Saves current-policy details
- Records explicit quote/SMS/email consent
- Checks quote completeness
- Submits a quote request to Asshield
- Tracks the lead source as `CHATGPT / ASSHIELD_CHATGPT_APP`

This MVP intentionally **does not bind insurance coverage** and does not include carrier rating credentials.

## Storage modes

**Memory mode (default):** If `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` is missing, the server uses an in-memory Map store persisted to `./data/store.json`. No database setup is required to run or deploy.

**Supabase mode:** When both Supabase env vars are set, the server uses the Supabase Postgres client instead.

**Lead notifications:** After a successful `submit_quote`, the server posts JSON to `CRM_WEBHOOK_URL` (if set) and/or emails `LEAD_NOTIFY_EMAIL` via Resend or SMTP. Configure at least one channel in production so Asshield receives the lead. Details: `docs/SUPABASE_AND_ALERTS_SETUP.md`.

## Project structure

```text
asshield-chatgpt-mvp/
├── src/
│   ├── config.ts
│   ├── db.ts
│   ├── memory-store.ts
│   ├── notify.ts              # CRM webhook + Resend/SMTP on submit
│   ├── quote-service.ts
│   ├── server.ts
│   └── types.ts
├── db/
│   └── migrations/
│       └── 001_init.sql
├── public/
│   └── quote-widget.html
├── chatgpt-plugin/
│   └── asshield-insurance/      # Public ChatGPT/Codex plugin package (ZIP source)
│       ├── plugin.json
│       ├── mcp.json
│       ├── skills/asshield-quote-intake/SKILL.md
│       └── assets/
├── docs/                        # Privacy / terms / support page drafts
├── scripts/build-plugin-zip.sh
├── SUBMISSION.md                # Directory submission checklist + blockers
├── Dockerfile
├── render.yaml
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

## 1. Configure environment (optional Supabase)

Copy `.env.example` to `.env`.

```bash
cp .env.example .env
```

Minimum for local / memory mode:

```text
PORT=8787
```

Optional Supabase (both required to leave memory mode):

```text
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Lead notifications (production — at least one channel):

```text
CRM_WEBHOOK_URL=https://hooks.example.com/asshield-leads
LEAD_NOTIFY_EMAIL=insurancelexky@gmail.com
RESEND_API_KEY=re_...          # or SMTP_HOST/SMTP_USER/SMTP_PASS for Gmail
```

If using Supabase, create a project, run `db/migrations/001_init.sql` in the SQL editor, then set the Project URL and service-role key. Never expose the service-role key in frontend/browser code. Full ops checklist: `docs/SUPABASE_AND_ALERTS_SETUP.md`.

## 2. Install and run

```bash
npm install
npm run dev
```

Health check:

```text
http://localhost:8787/health
```

MCP endpoint:

```text
http://localhost:8787/mcp
```

## 3. Deploy (Render)

`render.yaml` defines a web service named `asshield-chatgpt-mcp` on port 8787 with health check `/health`. Or build from the included `Dockerfile` (`node:20-alpine`, exposes 8787).

## 4. Test with MCP Inspector

```bash
npx @modelcontextprotocol/inspector@latest
```

Choose Streamable HTTP and connect to:

```text
http://localhost:8787/mcp
```

## 5. Connect to ChatGPT during development

Expose the local server through an HTTPS tunnel such as ngrok:

```bash
ngrok http 8787
```

Then use:

```text
https://YOUR-NGROK-DOMAIN/mcp
```

as the MCP URL in ChatGPT Developer Mode (private testing only; see "Publishing to the ChatGPT directory" below for the public app).

OpenAI's current quickstart uses the same basic pattern: an MCP server exposed through a public HTTPS `/mcp` endpoint and connected in ChatGPT Developer Mode.

## Publishing to the ChatGPT directory (public app)

Production MCP endpoint: `https://mcp.asshield.com/mcp` (health: `/health`).

OpenAI now distributes Apps SDK apps as **plugins** in one directory shared by ChatGPT and Codex. The package is in `chatgpt-plugin/asshield-insurance/`:

- `plugin.json`: Agent Plugins manifest. OpenAI listing fields, 5 positive / 3 negative review cases, and publication settings live under `extensions.com.openai`.
- `mcp.json`: points to the production MCP URL at `https://mcp.asshield.com/mcp` (`streamable-http`).
- `skills/asshield-quote-intake/SKILL.md`: onboarding workflow that enforces the "never bound" rule.
- `assets/`: light and dark logos and composer icons.

Build the upload ZIP:

```bash
./scripts/build-plugin-zip.sh   # -> dist/asshield-insurance-plugin-1.0.0.zip
```

Upload it on the Plugins page of the OpenAI Platform Dashboard. See **[SUBMISSION.md](SUBMISSION.md)** for the full checklist and current blockers.

### Published app vs. private Developer Mode MCP

| | Private Developer Mode MCP | Published app (plugin) |
|---|---|---|
| Who can use it | Only the account that added it (Developer Mode). Full write-capable MCP is officially Business/Enterprise/Edu; Plus access is inconsistent | Any ChatGPT/Codex user in the listed countries, found by searching the directory |
| How it's added | ChatGPT → Plugins → + → Create custom MCP server, paste the URL | ZIP upload on platform.openai.com → automated checks → human review → Publish |
| Identity | None | Verified individual or business (Asshield Insurance) in the Platform org |
| Required listing material | None | Name, subtitle, description, logo, website/support/privacy/terms URLs, test cases, demo video |
| Server URL | Any HTTPS URL, tunnels allowed | Stable public HTTPS, domain-verified via `/.well-known/openai-apps-challenge`. Can't change after publication without OpenAI support |
| Tool metadata | Anything that works | Clear descriptions plus explicit `readOnlyHint` / `destructiveHint` / `openWorldHint` on every tool (added in `src/server.ts`) |
| Updates | Click Refresh in ChatGPT | Daily automated scan of the MCP server. New or changed tools go live after automated checks. Manifest or skill changes need a new ZIP and review |
| Policy | Developer's own risk | Must follow OpenAI's plugin guidelines: privacy policy, data minimization, no restricted data, suitable for ages 13+, no ads or upsells |

The MCP server code is the same in both cases. Publishing adds the package, verification, policy pages, and review.

### Domain verification

Set `OPENAI_APPS_CHALLENGE_TOKEN` on Render to the token shown in the plugin portal. The server then returns it as plain text at `/.well-known/openai-apps-challenge` (404 when unset).

## MCP tools included

### `start_quote`

Creates a new quote record.

Example intent:

```text
Start an auto quote in Kentucky, ZIP 40509.
```

### `save_contact`

Adds the customer to the active quote.

### `add_driver`

Adds a driver. This MVP deliberately does not collect the driver's license number.

### `add_vehicle`

Adds year, make, model, optional VIN, use, ownership, and annual mileage.

### `save_current_policy`

Stores carrier, premium, renewal date, main limits, and deductibles.

### `save_consent`

Records explicit consent. Do not infer consent.

### `get_missing_quote_fields`

Checks whether the minimum intake is complete.

### `submit_quote`

Marks the intake submitted. It never represents the policy as bound or effective.

## Recommended next build steps

1. Add server-side authentication for Asshield staff.
2. Add phone/email verification for consumers.
3. Add secure declarations-page upload.
4. Add document extraction into a staging table.
5. Require user confirmation before extracted information becomes quote data.
6. Add CRM webhook integration.
7. Add EZLynx integration only through an authorized API/workflow.
8. Add licensed-agent routing by state.
9. Add abandonment events and follow-up workflows.
10. Add a richer MCP App UI.

## Security / insurance notes

This is a software starter, not legal/compliance advice.

Before production:

- Encrypt sensitive PII at rest and in transit.
- Minimize sensitive data returned to the model.
- Do not return SSNs or full driver's-license values in tool responses.
- Add audit logging.
- Add data-retention policies.
- Add explicit consent for quoting and messaging.
- Add state/licensing eligibility rules.
- Review TCPA and insurance privacy requirements with counsel/compliance.
- Do not state that coverage is active until a carrier/authorized agency workflow confirms binding.
- Do not scrape carrier portals or automate access that is not contractually/API authorized.

## Suggested phase-2 tools

```text
upload_policy_document
analyze_policy_document
confirm_extracted_policy
create_crm_lead
assign_agent
request_callback
request_text
get_quote_status
```

## Suggested source fields

Every ChatGPT-originated lead should retain:

```text
source = CHATGPT
source_detail = ASSHIELD_CHATGPT_APP
campaign = CHATGPT_QUOTE
```

This gives you clean conversion reporting later.
