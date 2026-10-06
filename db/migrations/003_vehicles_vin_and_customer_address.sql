-- 003: vehicles.vin (may already exist) + customer address columns for garaging/property
alter table public.vehicles
  add column if not exists vin text;

comment on column public.vehicles.vin is
  'Optional 17-character VIN (no I/O/Q). Soft-validated by Asshield MCP add_vehicle.';

alter table public.customers
  add column if not exists street text,
  add column if not exists unit text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists zip text;

comment on column public.customers.street is 'Garaging / property street (from quote contact step)';
