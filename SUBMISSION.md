# Asshield Insurance — ChatGPT directory submission checklist

Status as of **Oct 5, 2026**.

**Do not upload 1.2.0 for final review:** `review.demo_recording_url` is still a placeholder. The listing is **the Asshield Insurance plugin** (it contains an MCP app). Researched against OpenAI's official docs (links at the bottom).

## What changed at OpenAI (read this first)

- "Apps SDK apps" are now **submitted and published as plugins**. One package lands in the universal directory shared by **ChatGPT and Codex**.
- Submission is a **ZIP upload** on the **Plugins** page of the **OpenAI Platform Dashboard** (platform.openai.com), not a ChatGPT setting. The ZIP holds `plugin.json` (Agent Plugins format, with OpenAI fields under `extensions.com.openai`), `mcp.json`, optional `skills/`, and `assets/`.
- There is no `app.json` / `connectors.json`. ZIPs that contain app references (`apps` / `.app.json`) **cannot currently be submitted**. Put the MCP URL in `mcp.json`, then connect it in the dashboard.
- After publication, OpenAI scans the MCP server every day. Tool changes go live once they pass automated checks. Metadata and skill changes need a new ZIP. **Changing the MCP URL after publication requires OpenAI support**, so pick the final hostname before you submit.

## Package in this repo

| Item | Path | State |
|---|---|---|
| Plugin manifest (listing, review cases, publication) | `chatgpt-plugin/asshield-insurance/plugin.json` | Done. Validates against the Agent Plugins 1.0.0 schema |
| MCP config → Render URL | `chatgpt-plugin/asshield-insurance/mcp.json` | Updated to custom domain (`https://mcp.asshield.com/mcp`); DNS must verify before go-live |
| Onboarding skill | `chatgpt-plugin/asshield-insurance/skills/asshield-quote-intake/SKILL.md` | Done |
| Icons/logos (light + dark, square PNG) | `chatgpt-plugin/asshield-insurance/assets/` | Generated from the asshield.com mark. **Josh to approve** |
| ZIP builder | `scripts/build-plugin-zip.sh` → `dist/asshield-insurance-plugin-1.2.0.zip` | Done |
| Tool annotations (`readOnlyHint` / `destructiveHint` / `openWorldHint`) | `src/server.ts` | Done. Required by the guidelines |
| Domain verification endpoint | `GET /.well-known/openai-apps-challenge` (env `OPENAI_APPS_CHALLENGE_TOKEN`) | Code done. Token gets set at submission time |
| Privacy addendum draft | `docs/PRIVACY_CHATGPT_APP_ADDENDUM_DRAFT.md` | Draft. Needs publishing |
| Terms + support page drafts | `docs/TERMS_AND_SUPPORT_PAGES_DRAFT.md` | Draft. Needs publishing |

## Checklist

### 1. Account and identity
- [ ] **Use an OpenAI Platform organization** (platform.openai.com), not the ChatGPT Plus subscription. Your Plus plan doesn't matter for submission. Only org **Owners**, or members with **Apps Management Write** (`api.apps.write`), can create and submit drafts.
- [ ] **Business verification** as *Asshield Insurance*: Settings → Organization → General. The directory shows the name of the verified developer identity. Unverified submissions are rejected.
- [ ] **Testing before submission.** Developer Mode on Plus is inconsistent (Help Center: full write-capable MCP is Business/Enterprise/Edu, and Plus users report a missing toggle). Use these instead:
  - MCP Inspector against the production URL (`npx @modelcontextprotocol/inspector@latest` → Streamable HTTP)
  - Platform **API Playground** → Tools → Add → MCP Server → the Render URL (shows raw request/response logs)

### 2. MCP server and hosting
- [ ] **Final hostname (in progress).** Render custom domain `mcp.asshield.com` added (unverified). `mcp.json` / docs already point at `https://mcp.asshield.com/mcp`. Still need: DNS CNAME at Netlify DNS, then set Render env `PUBLIC_BASE_URL=https://mcp.asshield.com` after verify. Reasons: the URL can't change after publication without support, and public URLs must identify the same publisher.
- [ ] **Persistent storage (BLOCKER — ops).** Code supports Supabase when `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are set; otherwise memory/`data/store.json` (ephemeral on Render). **Josh:** create a Supabase project, run `db/migrations/001_init.sql`, set both env vars on Render, then redeploy. Steps: `docs/SUPABASE_AND_ALERTS_SETUP.md`.
- [ ] **Lead delivery (BLOCKER — ops).** Code notifies on `submit_quote` via `CRM_WEBHOOK_URL` and/or Resend/SMTP (`LEAD_NOTIFY_EMAIL`, `RESEND_API_KEY` or `SMTP_*`). **Josh:** configure at least one channel so leads reach `insurancelexky@gmail.com`. See `docs/SUPABASE_AND_ALERTS_SETUP.md`.
- [ ] **No cold starts.** The Render free plan sleeps when idle, and cold starts can hit reviewer timeouts. Move to a paid instance.
- [x] **Licensed states only.** `start_quote` accepts AL/AR/FL/GA/IN/KY/NC/OH/PA/SC/TN/TX; other states get `supported: false` and no quote record. See `src/licensed-states.ts`.
- [x] **Response minimization.** Trimmed consent `created_at`/`id`, customer `id`, submit `notify`/`submitted_at`, and narrowed `current_policy` select. Keep `quote_id`.
- [ ] **Deploy this commit**, then confirm `tools/list` shows annotations on all **13 tools** (including `get_agent_contact` + widget `_meta`).
- [ ] **Domain verification at submission.** Set `OPENAI_APPS_CHALLENGE_TOKEN` on Render to the exact portal token, redeploy, and check that `https://<mcp-host>/.well-known/openai-apps-challenge` returns only the token.

### 3. Auth / OAuth
- [ ] **Decision: no auth (anonymous quote intake).** The docs allow anonymous servers. OAuth 2.1 is only needed to expose customer-specific data. With no auth, **no reviewer test account is needed**. Choose "No authentication" when connecting the MCP in the dashboard.
- [ ] **Abuse hardening (recommended).** Add per-IP rate limiting and payload limits. The quote UUID currently acts as the only access key for writes.
- [ ] **Future customer reads need OAuth.** Tools like `get_quote_status` would require OAuth 2.1 per the MCP authorization spec: protected-resource metadata, PKCE S256, CIMD or DCR, and a hosted IdP such as Auth0. You would then also need reviewer credentials that work without MFA.

### 4. Listing URLs (all four are required for MCP review, HTTPS only)
- [x] Website: `https://www.asshield.com`. Live.
- [x] **Privacy / terms / support:** live at `/privacy`, `/terms`, `/support` with ChatGPT addendum. Draft/counsel banners removed Oct 5, 2026; counsel should still confirm retention + liability substance.
- [x] Submission form copy: `docs/SUBMISSION_FORM.md` (also `/workspace/asshield-submission/SUBMISSION_FORM.md`).

### 5. Branding and listing
- [ ] Approve the icons in `assets/` (512px logo + 128px composer icon, light and dark). Swap in official files if preferred: square, at least 48px, no larger than 5 MiB.
- [ ] Display name "Asshield Insurance". Subtitle "Start an insurance quote" (30 character limit). Category "Finance". Confirm the category exists in the dashboard picker.
- [ ] **Review risk: the brand name.** Plugins must suit general audiences, including ages 13–17. A reviewer may question the name. Be ready to explain that it's a trademarked, state-licensed agency name (FL #L120146, KY #867084).
- [ ] Screenshots: Custom Apps SDK widgets are present. If the portal requests screenshots, provide widget screenshots from `/workspace/asshield-submission/screens/v4/` (options, coverage, guided steps, confirmation timeline, agent; light/dark).
- [ ] No pricing, discounts, or comparative claims in the listing (already compliant). No Lexington emphasis (compliant).

### 6. Review materials
- [x] 5 positive and 3 negative test cases in `plugin.json` (imported automatically from the ZIP).
- [ ] **Run all 5 positive + 3 negative test cases** against the production server before submitting. Correct `expected_behavior` if the results differ.
- [ ] **Demo video URL (OpenAI hard blocker).** Record a walkthrough of the test cases and host it unlisted (YouTube/Loom). Add it as `review.demo_recording_url` in `plugin.json` or enter it in Review details. Until then, do not upload 1.2.0 for final review.
- [ ] Release notes: done (`publication.release_notes`).
- [ ] Countries: `["US"]`.

### 7. Compliance language (already built in; keep it consistent everywhere)
- Never says or implies coverage is bound, issued, active, or guaranteed. `submit_quote` returns "not confirmation of coverage or a bound policy."
- Quote intake only. A licensed agent prepares the quote; post-submit Asshield estimates (when shown) are illustrations with a full disclaimer, not carrier quotes.
- Restricted data the guidelines forbid is **never collected**: SSNs and other government IDs, driver's license numbers, payment card data, credentials, health info. Date of birth is collected for drivers only and must be disclosed in the privacy policy.
- Consent is explicit and recorded per type (`quote_authorization`, `sms`, `email`) and never inferred. SMS consent language should be TCPA-aligned (counsel).
- `submit_quote` is marked `destructiveHint: true` (a one-time outbound send), so ChatGPT asks the user to confirm.
- No ads, no upsells, no checkout (`commerce: false`).

### 8. Submit
1. `./scripts/build-plugin-zip.sh` → `dist/asshield-insurance-plugin-1.2.0.zip`
2. Platform Dashboard → **Plugins** → *Upload new or existing plugin* → pick the verified identity → upload the ZIP.
3. **Metadata & Skills**: fix any findings, then re-upload a corrected ZIP if needed.
4. **MCPs** → Connect → URL, Authentication: none → domain challenge (step 2 above) → wait for the tool scan → fix issues → Rescan.
5. **Review details**: confirm the imported cases and the video URL.
6. **Submit for review**, accept the attestations, and keep the Case ID from the email.
7. Once approved: **Publish plugin**. It's then searchable by exact name. Featured placement is at OpenAI's discretion.

## Docs used
- Submit / upload plugin and manifest field reference: https://developers.openai.com/apps-sdk/deploy/submission (now https://developers.openai.com/plugins/deploy/submission)
- Plugin submission guidelines: https://developers.openai.com/apps-sdk/app-submission-guidelines
- Package your plugin: https://developers.openai.com/plugins/build/plugins
- Authentication: https://developers.openai.com/apps-sdk/build/auth
- Connect and test: https://developers.openai.com/apps-sdk/deploy/connect-chatgpt
- Build an MCP server (production endpoint): https://developers.openai.com/plugins/build/mcp-server
- Developer mode: https://developers.openai.com/api/docs/guides/developer-mode and https://help.openai.com/en/articles/12584461
- App Developer Terms: https://openai.com/policies/developer-apps-terms/
- Agent Plugins spec and schemas: https://github.com/agentplugins/agent-plugins-spec
