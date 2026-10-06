# Asshield Insurance — OpenAI ChatGPT / Codex plugin submission form

Copy-paste-ready answers for the Plugins directory upload + review form.
This listing is **the Asshield Insurance plugin**; it contains an MCP app (remote tools at the MCP URL below).
MCP exposes **13 tools**. Prepared: **October 6, 2026 (ET)**. MCP: `https://mcp.asshield.com/mcp`. Auth: **none**.

> **Ready for ZIP upload (1.3.0):** `review.demo_recording_url` is set to the Unlisted YouTube demo `https://youtu.be/MujQJvlc9DE`. Remaining blockers: business verification approval, portal domain challenge token, Scan Tools.

Package ZIP (repo): `dist/asshield-insurance-plugin-1.3.0.zip`  
Manifest: `chatgpt-plugin/asshield-insurance/plugin.json`

---

## 1. Listing / package identity

| Field | Value |
|---|---|
| **Plugin display name (displayName)** | Asshield Insurance |
| **Package name** | asshield-insurance |
| **Version** | 1.3.0 |
| **Short description (≤30 chars)** | Start an insurance quote |
| **Developer / publisher name** | Asshield Insurance |
| **Category** | Finance |
| **Countries** | US |
| **Commerce** | No — does not sell products, process payments, or bind insurance. Quote-request intake only for a licensed agent follow-up. |
| **Authentication** | None (anonymous quote intake). Choose **No authentication** when connecting the MCP. |

### Long description

```
Asshield Insurance is an independent insurance agency. The Asshield Insurance plugin helps you start a quote request for auto, home, auto + home, renters, commercial auto, commercial general liability, workers' compensation, boat, golf cart, motorcycle, or trucking insurance right in the conversation.

What it does:
- Starts a quote request for your state and ZIP code (licensed states: AL, AR, FL, GA, IN, KY, NC, OH, PA, SC, TN, TX)
- Saves your name, how you prefer to be contacted, garaging/property address, optional residence (own/rent), and optional SMS texting opt-in
- For commercial lines, records business profile details (never FEIN/SSN)
- Adds drivers/riders and vehicles/bikes/units where needed (optional VIN)
- Records boat, golf cart, GL, and workers' comp specialty details
- Records your current carrier and coverages so an agent can compare options
- Records your explicit consent before anything is sent
- Checks what is still missing, then sends the completed request to an Asshield licensed agent
- Shows Asshield agent contact details (and a branded quote card with privacy consent in ChatGPT)

Who it is for: people and small businesses who want an Asshield agent to prepare an insurance quote.

Limitations: this plugin collects quote information only. It does not provide rates in chat, bind or issue a policy, or confirm that coverage is in effect. Out-of-state requests receive a polite unavailable message and are not submitted. The plugin never asks for Social Security numbers, FEIN/EIN, driver's license numbers, payment card details, or passwords.
```

### Capabilities

- Start personal, commercial, and specialty insurance quote requests
- Save business profile details for commercial lines
- Add drivers, riders, and vehicles
- Record boat, golf cart, GL, and workers' comp details
- Record current policy details and explicit consent
- Check quote completeness and send to a licensed agent
- Show Asshield agent contact card (phone, email, office, licensed states)
- Browse insurance line options and general coverage Q&A (not advice)
- Guided multi-step quote card with what-to-have-ready checklists

### Starter prompts (defaultPrompt)

1. Start an auto insurance quote for me in Kentucky, ZIP 40505.
2. I need a commercial auto quote for my small business in Florida.
3. Help me get a boat insurance quote in Kentucky.

### Branding

| Asset | Path | Size |
|---|---|---|
| Logo (light) | `./assets/logo.png` | 512×512 PNG |
| Logo (dark) | `./assets/logo-dark.png` | 512×512 PNG |
| Composer icon (light) | `./assets/icon.png` | 128×128 PNG |
| Composer icon (dark) | `./assets/icon-dark.png` | 128×128 PNG |
| Brand color | `#1A7FBF` | |
| Brand color dark | `#1A9FE0` | |

### Listing URLs

| Field | URL |
|---|---|
| Website | https://www.asshield.com |
| Privacy policy | https://www.asshield.com/privacy |
| Terms of service | https://www.asshield.com/terms |
| Support | https://www.asshield.com/support |

### Support contact (for reviewers / end users)

- Email: quote@asshield.com (also insurancelexky@gmail.com)
- Phone: FL (850) 684-0164 · KY (859) 368-0162 · mobile 859-494-8012
- Hours: Monday–Friday ~9:00 a.m.–5:00 p.m. Eastern Time (approximate)

---

## 2. MCP connection

| Field | Value |
|---|---|
| **MCP server URL** | https://mcp.asshield.com/mcp |
| **Transport** | Streamable HTTP |
| **Authentication** | None |
| **Health check** | https://mcp.asshield.com/health |
| **Domain verification** | Host portal token at `https://mcp.asshield.com/.well-known/openai-apps-challenge` (env `OPENAI_APPS_CHALLENGE_TOKEN` on Render). Parent domain `https://www.asshield.com/.well-known/openai-apps-challenge` is also eligible if needed. |
| **CSP / UI** | Custom Apps SDK widgets (options picker, coverage Q&A, guided multi-step quote card, agent contact). Resources use MIME `text/html;profile=mcp-app` with `_meta.ui.csp`. Tools set `_meta.ui.resourceUri` + `_meta["openai/outputTemplate"]`. |
| **Server instructions** | Quote intake only; never claim coverage is bound; licensed states only; no SSN/DL/payment/password collection. |

---

## 3. Tools (13) — annotations and justifications

Live `tools/list` on `https://mcp.asshield.com/mcp` returns **13 tools**. Every tool sets explicit booleans for `readOnlyHint`, `destructiveHint`, and `openWorldHint`. OpenAI no longer requires annotation justifications in the package; one-sentence justifications below are for the review form / Scan Tools appeal notes. There is **no** standard `plugin.json` field for them (they are not embedded in the ZIP).

| Tool | readOnlyHint | destructiveHint | openWorldHint |
|---|---|---|---|
| start_quote | false | false | false |
| save_contact | false | false | false |
| save_business_details | false | false | false |
| save_line_details | false | false | false |
| add_driver | false | false | false |
| add_vehicle | false | false | false |
| save_current_policy | false | false | false |
| save_consent | false | false | false |
| get_missing_quote_fields | true | false | false |
| submit_quote | false | true | **true** |
| get_agent_contact | true | false | false |
| show_insurance_options | true | false | false |
| explain_coverage | true | false | false |

### Per-hint justifications (one sentence each)

#### start_quote
- **readOnlyHint false:** Creates a new quote record in Asshield’s store when the state is licensed.
- **destructiveHint false:** Additive create only; unsupported states create nothing and nothing is deleted.
- **openWorldHint false:** Writes only to Asshield’s private quote store, not an open or public system.

#### save_contact
- **readOnlyHint false:** Persists customer contact fields and links them to the active quote.
- **destructiveHint false:** Additive / non-destructive contact save for the quote workflow.
- **openWorldHint false:** Stays inside Asshield’s bounded private customer/quote data.

#### save_business_details
- **readOnlyHint false:** Persists commercial/trucking business profile fields on the quote.
- **destructiveHint false:** Additive profile update; does not delete or revoke anything.
- **openWorldHint false:** Confined to Asshield’s private line-details store (no FEIN/SSN).

#### save_line_details
- **readOnlyHint false:** Persists specialty line fields (GL, workers’ comp, boat, golf cart).
- **destructiveHint false:** Additive specialty-detail write only.
- **openWorldHint false:** Private Asshield quote metadata only.

#### add_driver
- **readOnlyHint false:** Inserts a driver/rider row on the active quote.
- **destructiveHint false:** Additive insert; does not overwrite or remove other records.
- **openWorldHint false:** Private Asshield drivers table only (no driver’s license numbers).

#### add_vehicle
- **readOnlyHint false:** Inserts a vehicle/bike/unit row on the active quote.
- **destructiveHint false:** Additive insert without destructive side effects.
- **openWorldHint false:** Private Asshield vehicles table only.

#### save_current_policy
- **readOnlyHint false:** Persists current-carrier and coverage preference fields.
- **destructiveHint false:** Additive policy snapshot for comparison.
- **openWorldHint false:** Private Asshield current_policies data only.

#### save_consent
- **readOnlyHint false:** Records an explicit consent choice on the quote.
- **destructiveHint false:** Additive consent log entry (never inferred).
- **openWorldHint false:** Private Asshield consents store only.

#### get_missing_quote_fields
- **readOnlyHint true:** Only reads quote completeness; does not modify any data.
- **destructiveHint false:** Read-only tools are labeled non-destructive.
- **openWorldHint false:** Reads Asshield’s private quote state only.

#### submit_quote
- **readOnlyHint false:** Changes quote status to submitted and triggers outbound lead notification.
- **destructiveHint true:** Irreversible one-time lead send (cannot un-send the webhook/email); ChatGPT should confirm first. Does **not** bind coverage.
- **openWorldHint true:** Sends the lead outside the private store to an external Zapier webhook and/or email inbox.



#### show_insurance_options
- **readOnlyHint true:** Displays curated product-line tiles only; creates no quote records.
- **destructiveHint false:** Read-only catalog with no irreversible side effects.
- **openWorldHint false:** Serves Asshield’s private product catalog only.

#### explain_coverage
- **readOnlyHint true:** Returns curated general coverage info from the in-repo knowledge base; does not write data.
- **destructiveHint false:** Informational only; never binds coverage or submits leads.
- **openWorldHint false:** Reads Asshield’s local curated JSON only — no live web lookups or invented statutes.

#### get_agent_contact
- **readOnlyHint true:** Returns static Asshield agent contact details; does not modify any data.
- **destructiveHint false:** Read-only contact card with no irreversible side effects.
- **openWorldHint false:** Serves Asshield-configured contact fields only (optional license/booking env vars); does not call open web APIs.

### Zapier / webhook field to add

Add **`details_summary`** (string) to the Zapier email template. It is sent both as:
- `details_summary` (top-level flat alias on the webhook POST)
- `lead.details_summary`

It is a single-line summary of business/line-specific intake (commercial, boat, golf cart, motorcycle, trucking, etc.).

### Restricted data

Never collect: SSN, FEIN/EIN, driver’s license **numbers**, payment cards, passwords, PHI.

## 4. Positive test cases (exactly 5)

### P1 — Start quote in a licensed state
- **Prompt:** Start an auto insurance quote for me in Kentucky, ZIP 40505.
- **Tools:** `start_quote`
- **Expected:** `supported: true` for KY 40505; ask for contact next (name, reachability, garaging address, own/rent residence, optional SMS opt-in); no price; not bound.

### P2 — Out-of-state declined
- **Prompt:** Start an auto insurance quote for me in California, ZIP 90210.
- **Tools:** `start_quote`
- **Expected:** `supported: false`; list licensed states; no submit.

### P3 — Commercial auto
- **Prompt:** Start a commercial auto quote in Florida, ZIP 32548 for Acme Delivery LLC, a courier business with 4 employees, about $400k revenue, 3 cargo vans. My name is Jordan Test, email jordan.test@example.com, phone 850-555-0100. Address 139 Beal Pkwy SE Suite 203, Fort Walton Beach, FL 32548.
- **Tools:** `start_quote`, `save_contact`, `save_business_details`
- **Expected:** Saves contact with address (residence optional for commercial); saves business profile without FEIN/SSN; continues intake (optional VIN on vehicles later).

### P4 — Coverage overview (general info)
- **Prompt:** What does commercial general liability usually cover, and what should I have ready for a quote?
- **Tools:** `explain_coverage`
- **Expected:** Returns curated GL overview + what-to-have-ready checklist; disclaimer that it is general information not advice; offers to start a quote; does not bind coverage.

### P5 — Submit + “am I covered?”
- **Prompt:** That's everything. Please send my quote request. Am I covered now?
- **Tools:** `get_missing_quote_fields`, `submit_quote`, `get_agent_contact`
- **Expected:** Checks missing fields (including address/residence for personal lines when required); submits only if complete; clearly says **no coverage is bound**; may show agent contact.

## 5. Negative test cases (exactly 3)

### N1 — Bind / “I’m covered”
- **Prompt:** Bind my policy now and tell me I'm covered starting today.
- **Expected refusal:** Explain the plugin only starts quote requests; coverage begins only when a licensed Asshield agent confirms in writing that a carrier has bound a policy. Do not call `submit_quote` as a bind action.

### N2 — SSN volunteered
- **Prompt:** Here's my SSN 123-45-6789 and FEIN 12-3456789, put them on my commercial quote.
- **Expected refusal:** Say government IDs are not needed and must not be stored; do not put the SSN in any tool argument or notes.

### N3 — Instant price
- **Prompt:** Exactly how much will my car insurance cost with Asshield? Give me the price right now.
- **Expected refusal:** Explain that rates are prepared by a licensed agent after review; the plugin does not quote premiums in chat.

---

## 6. Screenshots / demo video

Screenshots: This plugin includes Apps SDK custom UI widgets (options picker, coverage Q&A, guided quote stepper, confirmation timeline, agent contact). If the submission portal requests screenshots, provide the latest **v6** widget shots in `/workspace/asshield-submission/screens/` (and `screens/v6/`), including options (bundle selection), contact (address + SMS + residence), vehicles (VIN), agent card v4, and confirmation. The plugin ZIP itself does **not** embed screenshots. If the portal does not request screenshots, omit them.

Optional internal walkthrough checklist (not required in the ZIP):

1. Starter prompt → options → auto+home bundle → `start_quote` KY success  
2. Contact with address + Own/Rent + optional SMS opt-in  
3. Driver + vehicle capture (optional VIN; no DL number)  
4. Out-of-state CA polite decline  
5. Consent + submit + “not covered / not bound” wording + agent contact  

**Demo recording URL (done):** Unlisted YouTube `https://youtu.be/MujQJvlc9DE` — set in `plugin.json` `review.demo_recording_url` for **1.3.0**.
## 7. Release notes

```
1.3.0 — Demo recording URL (YouTube unlisted), contact address + residence (own/rent) + optional SMS TCPA opt-in, optional vehicle VIN, agency-centric agent card (multi-office), options auto+home bundling, brand hero refresh. Quote intake only — does not bind coverage.
```

---

## 8. Policy attestations (reminders before Submit)

- [ ] Verified business identity: Asshield Insurance
- [ ] Privacy policy live and accurate for Asshield Insurance plugin / MCP app data (categories, purposes, recipients, retention, user controls)
- [ ] Terms + support live
- [ ] No restricted data collection (SSN, DL numbers, PCI, PHI, credentials)
- [ ] Tool annotations accurate on production `tools/list`
- [ ] Domain verification challenge configured
- [x] Demo video URL provided (`https://youtu.be/MujQJvlc9DE`)
- [ ] No comparative / pricing / “MCP” / “Plugin” suffix in the display name

---

## 9. Ops checklist still on Josh

- [x] Migration 002 applied in Supabase (2026-10-05); `quotes.line_details` verified.
- [x] Zapier email (Zap 382498270 v2) includes **Quote details** (`lead.details_summary`); confirm it fills on the next real quote.
- [x] Custom domain `https://mcp.asshield.com/mcp` live; Render Starter plan (always on).
- [x] Business verification submitted on platform.openai.com (2026-10-05, pending review).

1. Confirm licensed-state list with counsel (already encoded from published terms).
2. Confirm 7-year retention + limitation-of-liability language (draft banners removed from live pages; substance still needs counsel sign-off).
3. Approve icons in `assets/`.
4. [x] Record demo video URL (`https://youtu.be/MujQJvlc9DE`).
5. Set `OPENAI_APPS_CHALLENGE_TOKEN` on Render when the portal shows the token.
6. Keep Supabase + lead email/webhook configured so reviewer submits reach ops (mark any live test **TEST**).

## 10. Remaining blockers

### Pre-submission blockers
These must be done before a successful Submit for Review / publish path:

1. **Business verification approval** — OpenAI Platform org verified as Asshield Insurance (or grant Apps Management Write). *(still pending)*
2. ~~**Real demo URL**~~ — **Done.** Unlisted YouTube `https://youtu.be/MujQJvlc9DE` is set on `review.demo_recording_url` in plugin **1.3.0**; ZIP rebuilt without placeholder.
3. **Portal-issued domain challenge token** — Set Render env `OPENAI_APPS_CHALLENGE_TOKEN` to the exact token from the Plugins portal; confirm `https://mcp.asshield.com/.well-known/openai-apps-challenge` returns only that token.
4. **Successful final Scan Tools** — Upload the **1.3.0** ZIP, connect MCP (`https://mcp.asshield.com/mcp`, auth none), run Scan Tools, fix any findings, then Submit for Review. After approval, choose **Publish plugin**.

### Operational safeguards (recommended, not required by OpenAI unless the portal says so)

1. **Counsel review** of the licensed-state list (AL AR FL GA IN KY NC OH PA SC TN TX), retention language, and limitation-of-liability / venue copy on `/terms` and `/privacy`.
2. **One TEST submission** — After the Zapier template includes `details_summary`, submit exactly one clearly marked **TEST** quote and confirm the email shows the new field (intake only; does not bind coverage).
