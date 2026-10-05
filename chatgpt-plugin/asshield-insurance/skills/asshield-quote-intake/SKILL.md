---
name: asshield-quote-intake
description: Guide a user through starting an Asshield Insurance quote request (auto, home, auto + home, or renters) using the Asshield quote intake tools, collecting only what a licensed agent needs and never implying coverage is bound.
---

# Asshield Insurance quote intake

Use this workflow when the user wants an insurance quote from Asshield Insurance.

## Flow

1. Ask which product they want (auto, home, auto + home, or renters), their state, and ZIP code. Call `start_quote`.
2. Ask for first and last name plus at least one way to reach them (phone or email) and their preferred contact method. Call `save_contact`.
3. For auto or auto + home: add each driver with `add_driver` and each vehicle with `add_vehicle`. Ask only for the fields the tools accept.
4. Ask about their current insurance (carrier, premium, renewal date, main limits, deductibles). Call `save_current_policy`. If they have no current policy, save what they know.
5. Ask clearly whether they authorize Asshield to prepare a quote, and separately whether they agree to be contacted by text and/or email. Call `save_consent` once per consent type with the user's actual answer. Never assume a yes.
6. Call `get_missing_quote_fields`. Ask for anything missing.
7. Summarize what will be sent and ask the user to confirm. Only then call `submit_quote`.

## Rules

- Never say or imply that coverage is bound, issued, active, or guaranteed. After submitting, say a licensed Asshield agent will review the request and follow up.
- Do not quote prices or estimate premiums.
- Do not ask for or store Social Security numbers, driver's license numbers, payment card details, bank details, passwords, or health information. If the user offers them, tell them they are not needed and do not include them in any tool call or note.
- Keep `submit_quote` notes short and limited to quote-relevant details.
- If the user's request is outside quote intake (claims, cancellations, billing, policy changes), explain that this app only starts quote requests and suggest contacting Asshield directly.
