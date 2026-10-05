create extension if not exists pgcrypto;

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  phone text,
  email text,
  preferred_contact_method text check (preferred_contact_method in ('call','text','email')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists quotes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) on delete set null,
  product text not null check (product in ('auto','home','auto_home','renters')),
  status text not null default 'started'
    check (status in ('started','in_progress','documents_uploaded','ready_to_quote','submitted','rating','quoted','contacted','sold','lost')),
  source text not null default 'CHATGPT',
  source_detail text not null default 'ASSHIELD_CHATGPT_APP',
  campaign text not null default 'CHATGPT_QUOTE',
  state char(2) not null,
  zip text not null,
  completion_percentage int not null default 0 check (completion_percentage between 0 and 100),
  assigned_agent_id uuid,
  notes text,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists drivers (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  date_of_birth date,
  relationship text,
  license_state char(2),
  created_at timestamptz not null default now()
);

create table if not exists vehicles (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes(id) on delete cascade,
  year int not null,
  make text not null,
  model text not null,
  vin text,
  ownership text check (ownership in ('owned','financed','leased')),
  usage text check (usage in ('pleasure','commute','business')),
  annual_mileage int,
  created_at timestamptz not null default now()
);

create table if not exists current_policies (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes(id) on delete cascade,
  carrier text,
  current_premium numeric(12,2),
  premium_frequency text check (premium_frequency in ('monthly','6_month','annual')),
  renewal_date date,
  bodily_injury_limit text,
  property_damage_limit text,
  comp_deductible numeric(12,2),
  collision_deductible numeric(12,2),
  created_at timestamptz not null default now()
);

create table if not exists consents (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes(id) on delete cascade,
  consent_type text not null check (consent_type in ('quote_authorization','sms','email')),
  accepted boolean not null,
  created_at timestamptz not null default now()
);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes(id) on delete cascade,
  storage_key text not null,
  document_type text not null default 'declarations_page',
  status text not null default 'uploaded',
  created_at timestamptz not null default now()
);

create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes(id) on delete cascade,
  event_type text not null,
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_quotes_customer_id on quotes(customer_id);
create index if not exists idx_quotes_status on quotes(status);
create index if not exists idx_drivers_quote_id on drivers(quote_id);
create index if not exists idx_vehicles_quote_id on vehicles(quote_id);
create index if not exists idx_current_policies_quote_id on current_policies(quote_id);
create index if not exists idx_consents_quote_id on consents(quote_id);
create index if not exists idx_documents_quote_id on documents(quote_id);

-- IMPORTANT:
-- This starter uses a server-side Supabase service-role key.
-- Do not expose that key to browser/client code.
-- Add Row Level Security policies before exposing any Supabase client directly to consumers.
