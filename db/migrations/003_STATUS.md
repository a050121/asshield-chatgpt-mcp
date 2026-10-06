# Migration 003 status

- `vehicles.vin`: **already present** on production (confirmed via REST).
- `customers` address columns (`street`, `unit`, `city`, `state`, `zip`): **not present** at change time.
  Address is persisted immediately in `quotes.line_details` (`contact_street`, etc.) so the app works without DDL.
  Apply `003_vehicles_vin_and_customer_address.sql` in the Supabase SQL editor when convenient for first-class customer columns.
- Residence + SMS consent are stored in `line_details` (+ `consents` row with `consent_type=sms` when opted in). No DDL required.
