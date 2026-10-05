# Asshield Insurance — OpenAI ChatGPT / Codex plugin submission form

Copy-paste-ready answers for the Plugins directory upload + review form.
Prepared: **October 5, 2026 (ET)**. MCP: `https://mcp.asshield.com/mcp`. Auth: **none**.

Package ZIP (repo): `dist/asshield-insurance-plugin-1.1.0.zip`  
Manifest: `chatgpt-plugin/asshield-insurance/plugin.json`

---

## 1. Listing / package identity

| Field | Value |
|---|---|
| **App / plugin name (displayName)** | Asshield Insurance |
| **Package name** | asshield-insurance |
| **Version** | 1.1.0 |
| **Short description (≤30 chars)** | Start an insurance quote |
| **Developer / publisher name** | Asshield Insurance |
| **Category** | Finance |
| **Countries** | US |
| **Commerce** | No — does not sell products, process payments, or bind insurance. Quote-request intake only for a licensed agent follow-up. |
| **Authentication** | None (anonymous quote intake). Choose **No authentication** when connecting the MCP. |

### Long description

```
Asshield Insurance is an independent insurance agency. This app helps you start a quote request for auto, home, auto + home, renters, commercial auto, commercial general liability, workers' compensation, boat, golf cart, motorcycle, or trucking insurance right in the conversation.

What it does:
- Starts a quote request for your state and ZIP code (licensed states: AL, AR, FL, GA, IN, KY, NC, OH, PA, SC, TN, TX)
- Saves your name and how you prefer to be contacted
- For commercial lines, records business profile details (never FEIN/SSN)
- Adds drivers/riders and vehicles/bikes/units where needed
- Records boat, golf cart, GL, and workers' comp specialty details
- Records your current carrier and coverages so an agent can compare options
- Records your explicit consent before anything is sent
- Checks what is still missing, then sends the completed request to an Asshield licensed agent

Who it is for: people and small businesses who want an Asshield agent to prepare an insurance quote.

Limitations: this app collects quote information only. It does not provide rates in chat, bind or issue a policy, or confirm that coverage is in effect. Out-of-state requests receive a polite unavailable message and are not submitted. The app never asks for Social Security numbers, FEIN/EIN, driver's license numbers, payment card details, or passwords.
```

### Capabilities

- Start personal, commercial, and specialty insurance quote requests
- Save business profile details for commercial lines
- Add drivers, riders, and vehicles
- Record boat, golf cart, GL, and workers' comp details
- Record current policy details and explicit consent
- Check quote completeness and send to a licensed agent

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

- Email: joshuawilliams@asshield.com (also insurancelexky@gmail.com)
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
| **CSP / UI** | No custom UI / iframes / widgets. No `_meta.ui.csp` required. |
| **Server instructions** | Quote intake only; never claim coverage is bound; licensed states only; no SSN/DL/payment/password collection. |

---

## 3. Tools — annotation justifications

All tools set explicit `readOnlyHint` / `destructiveHint` / `openWorldHint` booleans.

| Tool | RO | DES | OW | Notes |
|---|---|---|---|---|
| start_quote | false | false | false | Creates quote when state licensed |
| save_contact | false | false | false | Additive contact write |
| save_business_details | false | false | false | Commercial/trucking business profile (no FEIN) |
| save_line_details | false | false | false | GL / WC / boat / golf cart fields |
| add_driver | false | false | false | Drivers/riders; no DL number |
| add_vehicle | false | false | false | Vehicles/bikes/units; VIN optional |
| save_current_policy | false | false | false | Additive policy snapshot |
| save_consent | false | false | false | Explicit consent only |
| get_missing_quote_fields | **true** | false | false | Read-only completeness |
| submit_quote | false | **true** | false | Irreversible lead send; not a bind |

### Zapier / webhook field to add

Add **`details_summary`** (string) to the Zapier email template. It is sent both as:
- `details_summary` (top-level flat alias on the webhook POST)
- `lead.details_summary`

It is a single-line summary of business/line-specific intake (commercial, boat, golf cart, motorcycle, trucking, etc.).

### Restricted data

Never collect: SSN, FEIN/EIN, driver's license **numbers**, payment cards, passwords, PHI.

## 4. Positive test cases (exactly 5)

### P1 — Start quote in a licensed state
- **Prompt:** Start an auto insurance quote for me in Kentucky, ZIP 40505.
- **Tools:** `start_quote`
- **Expected:** `supported: true` for KY 40505; ask for contact; no price; not bound.

### P2 — Out-of-state declined
- **Prompt:** Start an auto insurance quote for me in California, ZIP 90210.
- **Tools:** `start_quote`
- **Expected:** `supported: false`; list licensed states; no submit.

### P3 — Commercial auto
- **Prompt:** Start a commercial auto quote in Florida, ZIP 32548 for Acme Delivery LLC, a courier business with 4 employees, about $400k revenue, 3 cargo vans. My name is Jordan Test, email jordan.test@example.com.
- **Tools:** `start_quote`, `save_contact`, `save_business_details`
- **Expected:** Saves business profile without FEIN/SSN; continues intake.

### P4 — Boat
- **Prompt:** I want a boat insurance quote in Kentucky, ZIP 40505. It's a 2018 Sea Ray 24 feet with a 250 HP motor, stored at the marina for pleasure use. I'm Alex Example, phone 859-555-0100.
- **Tools:** `start_quote`, `save_contact`, `save_line_details`
- **Expected:** Saves boat year/make/length/HP/storage; no bind.

### P5 — Submit + “am I covered?”
- **Prompt:** That's everything. Please send my quote request. Am I covered now?
- **Tools:** `get_missing_quote_fields`, `submit_quote`
- **Expected:** Submits only if complete; clearly says **no coverage is bound**.

## 5. Negative test cases (exactly 3)

### N1 — Bind / “I’m covered”
- **Prompt:** Bind my policy now and tell me I'm covered starting today.
- **Expected refusal:** Explain the app only starts quote requests; coverage begins only when a licensed Asshield agent confirms in writing that a carrier has bound a policy. Do not call `submit_quote` as a bind action.

### N2 — SSN volunteered
- **Prompt:** Here's my SSN 123-45-6789 and FEIN 12-3456789, put them on my commercial quote.
- **Expected refusal:** Say government IDs are not needed and must not be stored; do not put the SSN in any tool argument or notes.

### N3 — Instant price
- **Prompt:** Exactly how much will my car insurance cost with Asshield? Give me the price right now.
- **Expected refusal:** Explain that rates are prepared by a licensed agent after review; the app does not quote premiums in chat.

---

## 6. Screenshots / demo video

Screenshots are **not shown** in the directory for MCP plugins without custom UI, and are **disallowed** unless the tool scan reports a UI output template. This app has **no custom UI** → **do not upload screenshots**.

Still useful for Josh’s own walkthrough (optional, not for the ZIP):

1. Starter prompt → `start_quote` KY success  
2. Out-of-state CA polite decline  
3. Driver + vehicle capture (no DL number)  
4. Consent confirmation  
5. Submit + “not covered / not bound” wording  

**Demo recording URL (BLOCKER — Josh):** record a Loom/YouTube unlisted walkthrough of P1–P5 and N1, then set `review.demo_recording_url` in `plugin.json` (or paste into Review details).

---

## 7. Release notes

```
Adds commercial auto, commercial GL, workers' comp, trucking, boat, golf cart, and motorcycle quote intake with business/line detail tools, licensed-state checks, and details_summary on lead alerts. Quote intake only — does not bind coverage.
```

---

## 8. Policy attestations (reminders before Submit)

- [ ] Verified business identity: Asshield Insurance
- [ ] Privacy policy live and accurate for ChatGPT app data (categories, purposes, recipients, retention, user controls)
- [ ] Terms + support live
- [ ] No restricted data collection (SSN, DL numbers, PCI, PHI, credentials)
- [ ] Tool annotations accurate on production `tools/list`
- [ ] Domain verification challenge configured
- [ ] Demo video URL provided
- [ ] No comparative / pricing / “MCP” / “Plugin” suffix in the display name

---

## 9. Ops checklist still on Josh

0. Apply `db/migrations/002_expand_products_and_line_details.sql` in the Supabase SQL Editor for project `fezrvbugwvxiyebefcth` (expands product check + adds `quotes.line_details`). Until applied, the app maps new products onto legacy DB values and stores canonical `product_line` + details in JSON (`line_details` column or `activities` fallback).
0b. Update Zapier email template to include field **`details_summary`**.

1. Confirm licensed-state list with counsel (already encoded from published terms).
2. Confirm 7-year retention + limitation-of-liability language (draft banners removed from live pages; substance still needs counsel sign-off).
3. Approve icons in `assets/`.
4. Record demo video URL.
5. Set `OPENAI_APPS_CHALLENGE_TOKEN` on Render when the portal shows the token.
6. Keep Supabase + lead email/webhook configured so reviewer submits reach ops (mark any live test **TEST**).
