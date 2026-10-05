-- Expand quote products for commercial + specialty lines and add line_details JSON.
-- Project: fezrvbugwvxiyebefcth
-- Apply in Supabase SQL Editor if CLI/Management API DDL is unavailable.

alter table quotes drop constraint if exists quotes_product_check;

alter table quotes
  add constraint quotes_product_check
  check (product in (
    'auto',
    'home',
    'auto_home',
    'renters',
    'commercial_auto',
    'commercial_gl',
    'workers_comp',
    'boat',
    'golf_cart',
    'motorcycle',
    'trucking'
  ));

alter table quotes
  add column if not exists line_details jsonb not null default '{}'::jsonb;

comment on column quotes.line_details is
  'Line-specific intake fields (business profile, GL/WC/boat/golf cart/trucking details). No SSN/FEIN/DL numbers/payment data.';
