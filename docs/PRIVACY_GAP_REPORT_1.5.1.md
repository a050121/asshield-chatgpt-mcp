# Privacy gap report — Asshield Insurance ChatGPT plugin 1.5.1

Prepared for OpenAI review packaging. Complements `docs/SUBMISSION_FORM.md` and live https://www.asshield.com/privacy.

## Closed in 1.5.1

- No SSN / FEIN / DL number / payment card / password persistence; success-style refusal if volunteered in free text.
- SMS opt-in default **unchecked**; explicit TCPA-style copy when checked.
- Quote authorization required in-widget (`save_consent` private + `consent_nonce`); Submit disabled until accepted.
- Address is customer-typed garaging/property address — not device location.
- Post-submit Asshield estimates labeled with asterisk + full “not a quote / no coverage bound” disclaimer.
- Carrier names text-only; Asshield directly appointed; availability varies (documented for reviewers).
- OpenAI reviewer leads tagged `TEST - OpenAI review` in notify subject/campaign.

## Residual gaps / counsel & ops

1. **Counsel sign-off** on retention period, limitation of liability, and venue language on `/privacy` and `/terms`.
2. **Zapier template:** Confirm `details_summary` (and TEST subject prefix) appear on the next live/test lead email.
3. **Domain challenge token:** Set `OPENAI_APPS_CHALLENGE_TOKEN` when the Plugins portal issues it.
4. **Business verification:** Still pending on platform.openai.com.
5. **Cross-border / subprocessor list:** Privacy page should continue to name hosting (Render) and database (Supabase) at the level counsel prefers; Zapier as optional outbound processor when webhook enabled.
6. **Deletion / access requests:** Rely on Asshield support channels; document turnaround if counsel wants a specific SLA on the privacy page.

## Data flow (high level)

Customer (ChatGPT widget) → MCP `https://mcp.asshield.com` → Supabase quote store → on submit → Zapier webhook and/or email → Asshield agents.

No coverage is bound in ChatGPT. Estimates are agency illustrations only.
