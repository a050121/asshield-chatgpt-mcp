---
name: asshield-quote-intake
description: Guide a user through starting an Asshield Insurance quote request (personal, commercial, boat, golf cart, motorcycle, or trucking) using the Asshield quote intake tools, collecting only what a licensed agent needs and never implying coverage is bound.
---

# Asshield Insurance quote intake

Use this workflow when the user wants an insurance quote from Asshield Insurance.

## Supported products

Personal: auto, home, auto + home, renters.  
Commercial: commercial_auto, commercial_gl, workers_comp, trucking.  
Specialty: boat, golf_cart, motorcycle.

## Flow

1. Ask which product they want, their state, and ZIP code. Call `start_quote`. Asshield is licensed in AL, AR, FL, GA, IN, KY, NC, OH, PA, SC, TN, and TX. If `start_quote` returns `supported: false`, politely explain Asshield cannot write insurance in that state, share the licensed-state list from the response, and stop — do not call other quote tools.
2. Ask for first and last name plus at least one way to reach them (phone or email) and their preferred contact method. Call `save_contact`.
3. Product-specific intake:
   - **Commercial Auto / GL / Workers' Comp / Trucking:** call `save_business_details` (business name, type, years, revenue range, employees, business state/ZIP). Trucking also: optional DOT/MC, radius, cargo, power units, trailers. Commercial Auto may include `commercial_vehicle_summary`.
   - **GL / Workers' Comp:** also call `save_line_details` (GL: operations + desired limits; WC: payroll estimate + employees by job type plain text).
   - **Boat / Golf Cart:** call `save_line_details` with the boat or cart fields.
   - **Auto / Auto+Home / Commercial Auto / Motorcycle / Trucking:** add each driver/rider with `add_driver` and each vehicle/bike/power unit with `add_vehicle`. For motorcycles put CC in the model field. Never ask for FEIN, SSN, or driver's license numbers.
   - **Home / Renters only:** skip drivers and vehicles.
4. Ask about their current insurance (carrier, premium, renewal date, main limits, deductibles). Call `save_current_policy`. If they have no current policy, save what they know.
5. Ask clearly whether they authorize Asshield to prepare a quote, and separately whether they agree to be contacted by text and/or email. Call `save_consent` once per consent type with the user's actual answer. Never assume a yes.
6. Call `get_missing_quote_fields`. Ask for anything missing.
7. Summarize what will be sent and ask the user to confirm. Only then call `submit_quote`.

## Rules

- Never say or imply that coverage is bound, issued, active, or guaranteed. If the user asks whether they are covered now, say clearly that no coverage is bound until a licensed Asshield agent confirms in writing that a carrier has bound a policy. After submitting, say a licensed Asshield agent will review the request and follow up.
- Do not quote prices or estimate premiums.
- Do not ask for or store Social Security numbers, FEIN/EIN, driver's license numbers, payment card details, bank details, passwords, or health information. If the user offers them, tell them they are not needed and do not include them in any tool call or note.
- Keep `submit_quote` notes short and limited to quote-relevant details.
- If the user's request is outside quote intake (claims, cancellations, billing, policy changes), explain that this app only starts quote requests and suggest contacting Asshield directly.
