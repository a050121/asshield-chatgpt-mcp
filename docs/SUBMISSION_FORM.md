# Asshield Insurance — OpenAI ChatGPT / Codex plugin submission form

Copy-paste-ready answers for the Plugins directory upload + review form.
Prepared: **October 5, 2026 (ET)**. MCP: `https://mcp.asshield.com/mcp`. Auth: **none**.

Package ZIP (repo): `dist/asshield-insurance-plugin-1.0.0.zip`  
Manifest: `chatgpt-plugin/asshield-insurance/plugin.json`

---

## 1. Listing / package identity

| Field | Value |
|---|---|
| **App / plugin name (displayName)** | Asshield Insurance |
| **Package name** | asshield-insurance |
| **Version** | 1.0.0 |
| **Short description (≤30 chars)** | Start an insurance quote |
| **Developer / publisher name** | Asshield Insurance |
| **Category** | Finance |
| **Countries** | US |
| **Commerce** | No — does not sell products, process payments, or bind insurance. Quote-request intake only for a licensed agent follow-up. |
| **Authentication** | None (anonymous quote intake). Choose **No authentication** when connecting the MCP. |

### Long description

```
Asshield Insurance is an independent insurance agency. This app helps you start a quote request for auto, home, auto + home, or renters insurance right in the conversation.

What it does:
- Starts a quote request for your state and ZIP code (licensed states: AL, AR, FL, GA, IN, KY, NC, OH, PA, SC, TN, TX)
- Saves your name and how you prefer to be contacted
- Adds drivers and vehicles for auto quotes
- Records your current carrier, premium, renewal date, and main coverages so an agent can compare options
- Records your explicit consent before anything is sent
- Checks what is still missing, then sends the completed request to an Asshield licensed agent

Who it is for: people who want an Asshield agent to prepare an insurance quote for them.

Limitations: this app collects quote information only. It does not provide rates in chat, bind or issue a policy, or confirm that coverage is in effect. Out-of-state requests receive a polite unavailable message and are not submitted. A licensed Asshield agent reviews every request and follows up using your preferred contact method. The app never asks for Social Security numbers, driver's license numbers, payment card details, or passwords.
```

### Capabilities

- Start an insurance quote request
- Add drivers and vehicles
- Record current policy details
- Record explicit contact and quote consent
- Check quote completeness
- Send the quote request to a licensed agent

### Starter prompts (defaultPrompt)

1. Start an auto insurance quote for me in Kentucky, ZIP 40505.
2. I want a home and auto bundle quote in Florida.
3. Help me get a renters insurance quote.

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

## 3. Tools (8) — annotation justifications for the review form

Use these when the dashboard asks for a justification per annotation. Booleans are set in live `tools/list`.

### start_quote

- **Purpose:** Create a new quote intake for Auto / Home / Auto+Home / Renters when the state is licensed; otherwise return a polite unsupported response without creating a quote.
- **Inputs:** `product` (enum), `state` (2-letter), `zip` (US ZIP).
- **readOnlyHint: false** — Creates a persisted quote record when the state is supported.
- **destructiveHint: false** — Additive create only; does not delete or overwrite other records; unsupported states create nothing.
- **openWorldHint: false** — Writes only to Asshield’s private quote store, not a public internet surface.

### save_contact

- **Purpose:** Save name and preferred contact method for an active quote.
- **Inputs:** `quote_id`, `first_name`, `last_name`; optional `phone`, `email`, `preferred_contact_method`.
- **readOnlyHint: false** — Persists customer contact and links it to the quote.
- **destructiveHint: false** — Additive / update of contact fields only.
- **openWorldHint: false** — Private Asshield store only.
- **Data note:** Does not collect SSN, driver’s license numbers, payment cards, or passwords.

### add_driver

- **Purpose:** Add a driver to an auto / auto+home quote.
- **Inputs:** `quote_id`, `first_name`, `last_name`; optional `date_of_birth`, `relationship`, `license_state` (state code only — **not** a license number).
- **readOnlyHint: false** / **destructiveHint: false** / **openWorldHint: false** — Additive private write.
- **Data note:** Explicitly rejects collecting driver’s license numbers.

### add_vehicle

- **Purpose:** Add a vehicle to an auto / auto+home quote.
- **Inputs:** `quote_id`, `year`, `make`, `model`; optional `vin`, `ownership`, `usage`, `annual_mileage`.
- **readOnlyHint: false** / **destructiveHint: false** / **openWorldHint: false** — Additive private write.
- **Data note:** VIN optional; no financing account / payment numbers.

### save_current_policy

- **Purpose:** Record current carrier, premium, renewal, limits, deductibles for comparison.
- **Inputs:** `quote_id` plus optional policy fields.
- **readOnlyHint: false** / **destructiveHint: false** / **openWorldHint: false** — Additive private write.

### save_consent

- **Purpose:** Record explicit consent (`quote_authorization`, `sms`, or `email`) with `accepted` reflecting the user’s real choice (never inferred).
- **readOnlyHint: false** / **destructiveHint: false** / **openWorldHint: false** — Additive private write of consent records.

### get_missing_quote_fields

- **Purpose:** Read-only completeness check before submit.
- **Inputs:** `quote_id`.
- **readOnlyHint: true** — Does not modify data.
- **destructiveHint: false** — Read-only tools use false.
- **openWorldHint: false** — Reads private Asshield quote data only.

### submit_quote

- **Purpose:** One-time handoff of a complete quote request to Asshield for licensed-agent review. Does **not** bind, issue, or guarantee coverage or price.
- **Inputs:** `quote_id`; optional `notes` (≤2000 chars).
- **readOnlyHint: false** — Changes quote status to submitted and triggers internal lead notification.
- **destructiveHint: true** — Irreversible outbound send / status change (cannot un-send the lead alert). ChatGPT should confirm with the user.
- **openWorldHint: false** — Notification goes to Asshield’s first-party ops inbox / CRM webhook, not a public internet post.

---

## 4. Positive test cases (exactly 5)

### P1 — Start quote in a licensed state
- **Prompt:** Start an auto insurance quote for me in Kentucky, ZIP 40505.
- **Tools:** `start_quote`
- **Expected:** `supported: true`, quote created for KY 40505; asks for name/contact next; no price; no claim that coverage is in effect.

### P2 — Out-of-state declined
- **Prompt:** Start an auto insurance quote for me in California, ZIP 90210.
- **Tools:** `start_quote`
- **Expected:** `supported: false`; polite message that Asshield is not licensed in CA; lists licensed states; **no** further write tools; nothing submitted.

### P3 — Contact + driver + vehicle
- **Prompt:** My name is Jordan Test, email jordan.test@example.com, prefer email. Add me as a driver, born 1990-04-12, licensed in KY. I drive a 2021 Toyota Camry that I own and use to commute about 12,000 miles a year.
- **Tools:** `save_contact`, `add_driver`, `add_vehicle`
- **Expected:** Saves contact/driver/vehicle; does **not** ask for SSN or driver’s license number.

### P4 — Current policy + explicit consent
- **Prompt:** I'm with State Farm now, paying $780 every 6 months, renewing 2026-12-01, 100/300 limits, $500 deductibles. Yes, I authorize Asshield to prepare a quote and email me.
- **Tools:** `save_current_policy`, `save_consent`
- **Expected:** Saves policy; records `quote_authorization` and `email` consent only because the user explicitly agreed.

### P5 — Completeness check, submit, and “am I covered?”
- **Prompt:** That's everything. Please send my quote request. Am I covered now?
- **Tools:** `get_missing_quote_fields`, `submit_quote`
- **Expected:** Checks missing fields, confirms, submits; states a licensed agent will follow up; **clearly says no coverage is bound / not in effect**.

---

## 5. Negative test cases (exactly 3)

### N1 — Bind / “I’m covered”
- **Prompt:** Bind my policy now and tell me I'm covered starting today.
- **Expected refusal:** Explain the app only starts quote requests; coverage begins only when a licensed Asshield agent confirms in writing that a carrier has bound a policy. Do not call `submit_quote` as a bind action.

### N2 — SSN volunteered
- **Prompt:** Here's my SSN 123-45-6789, put it on my quote.
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
Initial release: insurance quote intake for auto, home, auto + home, and renters with licensed-state checks (AL, AR, FL, GA, IN, KY, NC, OH, PA, SC, TN, TX), explicit consent capture, completeness check, and handoff to an Asshield licensed agent. Does not bind coverage or return prices in chat.
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

1. Confirm licensed-state list with counsel (already encoded from published terms).
2. Confirm 7-year retention + limitation-of-liability language (draft banners removed from live pages; substance still needs counsel sign-off).
3. Approve icons in `assets/`.
4. Record demo video URL.
5. Set `OPENAI_APPS_CHALLENGE_TOKEN` on Render when the portal shows the token.
6. Keep Supabase + lead email/webhook configured so reviewer submits reach ops (mark any live test **TEST**).
