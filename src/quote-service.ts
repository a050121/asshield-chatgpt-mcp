import { config } from "./config.js";
import { db } from "./db.js";
import { memoryStore } from "./memory-store.js";
import { notifyLeadSubmitted, type LeadSnapshot } from "./notify.js";
import {
  buildDetailsSummary,
  SMS_CONSENT_TEXT,
  SMS_CONSENT_VERSION,
  isCommercialProduct,
  legacyDbProduct,
  usesDriversAndVehicles,
  type LineDetails,
  type QuoteProduct
} from "./types.js";
import {
  isLicensedState,
  licensedStatesMessage,
  LICENSED_STATES
} from "./licensed-states.js";

function requireDb() {
  if (!db) throw new Error("Supabase client is not configured");
  return db;
}

/** null = unknown; true = migration 002 applied; false = legacy product check. */
let expandedProductsSupported: boolean | null = null;
let lineDetailsColumnSupported: boolean | null = null;

function isMissingColumnError(err: unknown): boolean {
  const msg = String((err as { message?: string })?.message ?? err);
  const code = String((err as { code?: string })?.code ?? "");
  return (
    code === "PGRST204" ||
    /line_details/i.test(msg) ||
    /Could not find the/i.test(msg) ||
    /column .* does not exist/i.test(msg)
  );
}

function isProductCheckError(err: unknown): boolean {
  const msg = String((err as { message?: string })?.message ?? err);
  const code = String((err as { code?: string })?.code ?? "");
  return code === "23514" || /quotes_product_check/i.test(msg);
}

async function mergeLineDetails(
  quoteId: string,
  patch: LineDetails
): Promise<LineDetails> {
  const existing = await readLineDetails(quoteId);
  const merged: LineDetails = { ...existing, ...patch };
  // Drop undefined keys
  for (const key of Object.keys(merged) as (keyof LineDetails)[]) {
    if (merged[key] === undefined) delete merged[key];
  }

  if (config.useMemoryStore) {
    const quote = memoryStore.getById("quotes", quoteId);
    if (!quote) throw new Error(`Quote not found: ${quoteId}`);
    memoryStore.update("quotes", quoteId, { line_details: merged });
    return merged;
  }

  const client = requireDb();
  if (lineDetailsColumnSupported !== false) {
    const { error } = await client
      .from("quotes")
      .update({ line_details: merged })
      .eq("id", quoteId);
    if (!error) {
      lineDetailsColumnSupported = true;
      return merged;
    }
    if (!isMissingColumnError(error)) throw error;
    lineDetailsColumnSupported = false;
  }

  // Fallback: activities JSON row
  const { error: actErr } = await client.from("activities").insert({
    quote_id: quoteId,
    event_type: "line_details",
    event_data: merged
  });
  if (actErr) throw actErr;
  return merged;
}

async function readLineDetails(quoteId: string): Promise<LineDetails> {
  if (config.useMemoryStore) {
    const quote = memoryStore.getById("quotes", quoteId, ["line_details"]);
    return ((quote?.line_details as LineDetails) ?? {}) || {};
  }

  const client = requireDb();
  if (lineDetailsColumnSupported !== false) {
    const { data, error } = await client
      .from("quotes")
      .select("line_details")
      .eq("id", quoteId)
      .maybeSingle();
    if (!error) {
      lineDetailsColumnSupported = true;
      return ((data?.line_details as LineDetails) ?? {}) || {};
    }
    if (!isMissingColumnError(error)) throw error;
    lineDetailsColumnSupported = false;
  }

  const { data: acts, error: actErr } = await client
    .from("activities")
    .select("event_data, created_at")
    .eq("quote_id", quoteId)
    .eq("event_type", "line_details")
    .order("created_at", { ascending: false })
    .limit(1);
  if (actErr) throw actErr;
  return ((acts?.[0]?.event_data as LineDetails) ?? {}) || {};
}

async function resolveProduct(quoteId: string, dbProduct: string): Promise<string> {
  const details = await readLineDetails(quoteId);
  return String(details.product_line ?? dbProduct);
}

function nextStepAfterContact(product: string): string {
  if (isCommercialProduct(product)) return "business_details";
  if (product === "boat" || product === "golf_cart") return "line_details";
  if (usesDriversAndVehicles(product)) return "drivers";
  return "current_policy_or_coverages";
}

export async function startQuote(input: {
  product: QuoteProduct;
  state: string;
  zip: string;
}) {
  const state = input.state.toUpperCase();
  const product = input.product;

  if (!isLicensedState(state)) {
    return {
      supported: false,
      quote: null,
      state,
      zip: input.zip,
      product,
      licensed_states: [...LICENSED_STATES],
      message:
        `Asshield Insurance is not currently licensed to write insurance in ${state}. ` +
        licensedStatesMessage() +
        " Please contact Asshield if you have questions, or try again with a ZIP in a licensed state. No quote request was submitted."
    };
  }

  const basePayload = {
    state,
    zip: input.zip,
    source: "CHATGPT",
    source_detail: "ASSHIELD_CHATGPT_APP",
    campaign: "CHATGPT_QUOTE",
    status: "started",
    completion_percentage: 5,
    line_details: { product_line: product } satisfies LineDetails
  };
  const selectFields = [
    "id",
    "product",
    "state",
    "zip",
    "status",
    "completion_percentage"
  ];

  if (config.useMemoryStore) {
    const data = memoryStore.insert(
      "quotes",
      { ...basePayload, product },
      selectFields
    );
    return {
      quote: { ...data, product },
      next_step: "customer_contact",
      supported: true
    };
  }

  const client = requireDb();
  const tryInsert = async (dbProduct: string, withLineDetailsCol: boolean) => {
    const row: Record<string, unknown> = {
      product: dbProduct,
      state: basePayload.state,
      zip: basePayload.zip,
      source: basePayload.source,
      source_detail: basePayload.source_detail,
      campaign: basePayload.campaign,
      status: basePayload.status,
      completion_percentage: basePayload.completion_percentage
    };
    if (withLineDetailsCol) row.line_details = basePayload.line_details;
    return client
      .from("quotes")
      .insert(row)
      .select("id, product, state, zip, status, completion_percentage")
      .single();
  };

  // Prefer real product + line_details column
  let data: Record<string, unknown> | null = null;
  let usedLegacyProduct = false;

  if (expandedProductsSupported !== false && lineDetailsColumnSupported !== false) {
    const res = await tryInsert(product, true);
    if (!res.error) {
      data = res.data as unknown as Record<string, unknown>;
      expandedProductsSupported = true;
      lineDetailsColumnSupported = true;
    } else if (isProductCheckError(res.error)) {
      expandedProductsSupported = false;
    } else if (isMissingColumnError(res.error)) {
      lineDetailsColumnSupported = false;
      const res2 = await tryInsert(product, false);
      if (!res2.error) {
        data = res2.data as unknown as Record<string, unknown>;
        expandedProductsSupported = true;
      } else if (isProductCheckError(res2.error)) {
        expandedProductsSupported = false;
      } else {
        throw res2.error;
      }
    } else {
      throw res.error;
    }
  }

  if (!data && expandedProductsSupported === false) {
    const legacy = legacyDbProduct(product);
    usedLegacyProduct = true;
    const withCol = lineDetailsColumnSupported !== false;
    const res = await tryInsert(legacy, withCol);
    if (res.error && withCol && isMissingColumnError(res.error)) {
      lineDetailsColumnSupported = false;
      const res2 = await tryInsert(legacy, false);
      if (res2.error) throw res2.error;
      data = res2.data as unknown as Record<string, unknown>;
    } else if (res.error) {
      throw res.error;
    } else {
      data = res.data as unknown as Record<string, unknown>;
      if (withCol) lineDetailsColumnSupported = true;
    }
  }

  if (!data) throw new Error("Failed to create quote");

  const quoteId = String(data.id);
  // Ensure product_line is stored even when using legacy DB product / no column
  await mergeLineDetails(quoteId, { product_line: product });

  return {
    quote: { ...data, product },
    next_step: "customer_contact",
    supported: true,
    schema_note: usedLegacyProduct
      ? "Database migration 002 not yet applied; product stored with legacy mapping and product_line in line_details."
      : undefined
  };
}

function contactExtrasFromInput(input: {
  street?: string;
  unit?: string;
  city?: string;
  address_state?: string;
  address_zip?: string;
  residence_status?: "own" | "rent" | "other";
  residence_other?: string;
  sms_consent?: boolean;
  callback_preference?: "morning" | "afternoon" | "evening";
  intake_notes?: string;
}): LineDetails {
  const extras: LineDetails = {};
  if (input.street) extras.contact_street = input.street.trim();
  if (input.unit) extras.contact_unit = input.unit.trim();
  if (input.city) extras.contact_city = input.city.trim();
  if (input.address_state) extras.contact_state = input.address_state.toUpperCase();
  if (input.address_zip) extras.contact_zip = input.address_zip;
  if (input.residence_status) extras.residence_status = input.residence_status;
  if (input.residence_other) extras.residence_other = input.residence_other.trim();
  if (input.callback_preference) extras.callback_preference = input.callback_preference;
  if (input.intake_notes) extras.intake_notes = input.intake_notes;
  if (input.sms_consent != null) {
    extras.sms_consent = Boolean(input.sms_consent);
    if (input.sms_consent) {
      extras.sms_consent_at = new Date().toISOString();
      extras.sms_consent_version = SMS_CONSENT_VERSION;
      extras.sms_consent_text = SMS_CONSENT_TEXT;
    }
  }
  return extras;
}

export async function saveContact(input: {
  quote_id: string;
  first_name: string;
  last_name: string;
  phone?: string;
  email?: string;
  preferred_contact_method?: "call" | "text" | "email";
  callback_preference?: "morning" | "afternoon" | "evening";
  intake_notes?: string;
  street?: string;
  unit?: string;
  city?: string;
  address_state?: string;
  address_zip?: string;
  residence_status?: "own" | "rent" | "other";
  residence_other?: string;
  sms_consent?: boolean;
}) {
  const customerPayload = {
    first_name: input.first_name,
    last_name: input.last_name,
    phone: input.phone ?? null,
    email: input.email ?? null,
    preferred_contact_method: input.preferred_contact_method ?? "text"
  };

  if (config.useMemoryStore) {
    const customer = memoryStore.insert("customers", customerPayload, [
      "id",
      "first_name",
      "last_name",
      "phone",
      "email",
      "preferred_contact_method"
    ]);
    const updated = memoryStore.update("quotes", input.quote_id, {
      customer_id: customer.id,
      status: "in_progress",
      completion_percentage: 20
    });
    if (!updated) throw new Error(`Quote not found: ${input.quote_id}`);
    const quoteRow = memoryStore.getById("quotes", input.quote_id, ["product", "line_details"]);
    const product = await resolveProduct(
      input.quote_id,
      String(quoteRow?.product ?? "")
    );
    const extras = contactExtrasFromInput(input);
    if (Object.keys(extras).length) await mergeLineDetails(input.quote_id, extras);
    if (input.sms_consent) {
      await saveConsent({ quote_id: input.quote_id, consent_type: "sms", accepted: true });
    }
    return {
      quote_id: input.quote_id,
      customer: {
        first_name: customer.first_name,
        last_name: customer.last_name,
        phone: customer.phone,
        email: customer.email,
        preferred_contact_method: customer.preferred_contact_method
      },
      address: {
        street: extras.contact_street,
        unit: extras.contact_unit,
        city: extras.contact_city,
        state: extras.contact_state,
        zip: extras.contact_zip
      },
      residence_status: extras.residence_status,
      residence_other: extras.residence_other,
      sms_consent: extras.sms_consent ?? false,
      callback_preference: input.callback_preference,
      intake_notes: input.intake_notes,
      next_step: nextStepAfterContact(product)
    };
  }

  const { data: customer, error: customerError } = await requireDb()
    .from("customers")
    .insert(customerPayload)
    .select("id, first_name, last_name, phone, email, preferred_contact_method")
    .single();
  if (customerError) throw customerError;

  const { error: quoteError } = await requireDb()
    .from("quotes")
    .update({
      customer_id: customer.id,
      status: "in_progress",
      completion_percentage: 20
    })
    .eq("id", input.quote_id);
  if (quoteError) throw quoteError;

  const { data: quoteMeta } = await requireDb()
    .from("quotes")
    .select("product")
    .eq("id", input.quote_id)
    .single();
  const product = await resolveProduct(
    input.quote_id,
    String(quoteMeta?.product ?? "")
  );

  const extras = contactExtrasFromInput(input);
  if (Object.keys(extras).length) await mergeLineDetails(input.quote_id, extras);
  if (input.sms_consent) {
    await saveConsent({ quote_id: input.quote_id, consent_type: "sms", accepted: true });
  }

  return {
    quote_id: input.quote_id,
    customer: {
      first_name: customer.first_name,
      last_name: customer.last_name,
      phone: customer.phone,
      email: customer.email,
      preferred_contact_method: customer.preferred_contact_method
    },
    address: {
      street: extras.contact_street,
      unit: extras.contact_unit,
      city: extras.contact_city,
      state: extras.contact_state,
      zip: extras.contact_zip
    },
    residence_status: extras.residence_status,
    residence_other: extras.residence_other,
    sms_consent: extras.sms_consent ?? false,
    callback_preference: input.callback_preference,
    intake_notes: input.intake_notes,
    next_step: nextStepAfterContact(product)
  };
}

export async function saveBusinessDetails(input: {
  quote_id: string;
  business_name: string;
  business_type_or_description?: string;
  years_in_business?: number;
  annual_revenue_range?: string;
  number_of_employees?: number;
  business_address_state?: string;
  business_address_zip?: string;
  // Trucking extras
  dot_mc_number?: string;
  radius_of_operation?: "local" | "intermediate" | "long_haul";
  cargo_type?: string;
  power_unit_count?: number;
  trailer_count?: number;
  // Commercial auto summary
  commercial_vehicle_summary?: string;
}) {
  const patch: LineDetails = {
    business_name: input.business_name,
    business_type_or_description: input.business_type_or_description,
    years_in_business: input.years_in_business,
    annual_revenue_range: input.annual_revenue_range,
    number_of_employees: input.number_of_employees,
    business_address_state: input.business_address_state?.toUpperCase(),
    business_address_zip: input.business_address_zip,
    dot_mc_number: input.dot_mc_number,
    radius_of_operation: input.radius_of_operation,
    cargo_type: input.cargo_type,
    power_unit_count: input.power_unit_count,
    trailer_count: input.trailer_count,
    commercial_vehicle_summary: input.commercial_vehicle_summary
  };

  const details = await mergeLineDetails(input.quote_id, patch);
  const product = String(details.product_line ?? "");

  if (config.useMemoryStore) {
    memoryStore.update("quotes", input.quote_id, { completion_percentage: 45 });
  } else {
    await requireDb()
      .from("quotes")
      .update({ completion_percentage: 45 })
      .eq("id", input.quote_id);
  }

  let next_step = "current_policy_or_coverages";
  if (product === "commercial_gl" || product === "workers_comp") next_step = "line_details";
  else if (usesDriversAndVehicles(product)) next_step = "drivers";

  return {
    quote_id: input.quote_id,
    business: {
      business_name: details.business_name,
      business_type_or_description: details.business_type_or_description,
      years_in_business: details.years_in_business,
      annual_revenue_range: details.annual_revenue_range,
      number_of_employees: details.number_of_employees,
      business_address_state: details.business_address_state,
      business_address_zip: details.business_address_zip,
      dot_mc_number: details.dot_mc_number,
      radius_of_operation: details.radius_of_operation,
      cargo_type: details.cargo_type,
      power_unit_count: details.power_unit_count,
      trailer_count: details.trailer_count,
      commercial_vehicle_summary: details.commercial_vehicle_summary
    },
    next_step
  };
}

export async function saveLineDetails(input: {
  quote_id: string;
  // GL
  operations_description?: string;
  desired_limits?: string;
  // Workers' comp
  annual_payroll_estimate?: string;
  employees_by_job_type?: string;
  // Boat
  boat_year?: number;
  boat_make?: string;
  boat_length_ft?: number;
  motor_hp?: number;
  boat_storage_or_usage?: string;
  // Golf cart
  cart_year?: number;
  cart_make?: string;
  street_legal?: boolean;
  cart_usage?: string;
  // Commercial auto summary (optional here too)
  commercial_vehicle_summary?: string;
}) {
  const patch: LineDetails = {
    operations_description: input.operations_description,
    desired_limits: input.desired_limits,
    annual_payroll_estimate: input.annual_payroll_estimate,
    employees_by_job_type: input.employees_by_job_type,
    boat_year: input.boat_year,
    boat_make: input.boat_make,
    boat_length_ft: input.boat_length_ft,
    motor_hp: input.motor_hp,
    boat_storage_or_usage: input.boat_storage_or_usage,
    cart_year: input.cart_year,
    cart_make: input.cart_make,
    street_legal: input.street_legal,
    cart_usage: input.cart_usage,
    commercial_vehicle_summary: input.commercial_vehicle_summary
  };

  const details = await mergeLineDetails(input.quote_id, patch);

  if (config.useMemoryStore) {
    memoryStore.update("quotes", input.quote_id, { completion_percentage: 55 });
  } else {
    await requireDb()
      .from("quotes")
      .update({ completion_percentage: 55 })
      .eq("id", input.quote_id);
  }

  return {
    quote_id: input.quote_id,
    line_details: patch,
    next_step: "current_policy_or_coverages"
  };
}

export async function addDriver(input: {
  quote_id: string;
  first_name: string;
  last_name: string;
  date_of_birth?: string;
  relationship?: string;
  license_state?: string;
}) {
  const payload = {
    quote_id: input.quote_id,
    first_name: input.first_name,
    last_name: input.last_name,
    date_of_birth: input.date_of_birth ?? null,
    relationship: input.relationship ?? null,
    license_state: input.license_state?.toUpperCase() ?? null
  };
  const selectFields = [
    "id",
    "quote_id",
    "first_name",
    "last_name",
    "date_of_birth",
    "relationship",
    "license_state"
  ];

  if (config.useMemoryStore) {
    const data = memoryStore.insert("drivers", payload, selectFields);
    memoryStore.update("quotes", input.quote_id, { completion_percentage: 40 });
    return { driver: data, next_step: "vehicles" };
  }

  const { data, error } = await requireDb()
    .from("drivers")
    .insert(payload)
    .select("id, quote_id, first_name, last_name, date_of_birth, relationship, license_state")
    .single();
  if (error) throw error;

  await requireDb()
    .from("quotes")
    .update({ completion_percentage: 40 })
    .eq("id", input.quote_id);

  return { driver: data, next_step: "vehicles" };
}

/** Soft VIN normalize: uppercase, strip spaces; keep only valid 17-char (no I/O/Q). */
function normalizeVin(raw?: string | null): string | null {
  if (!raw) return null;
  const v = String(raw).toUpperCase().replace(/\s+/g, "");
  if (v.length !== 17) return null;
  if (/[IOQ]/.test(v)) return null;
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(v)) return null;
  return v;
}

export async function addVehicle(input: {
  quote_id: string;
  year: number;
  make: string;
  model: string;
  vin?: string;
  ownership?: "owned" | "financed" | "leased";
  usage?: "pleasure" | "commute" | "business";
  annual_mileage?: number;
}) {
  const vin = normalizeVin(input.vin);
  const payload = {
    quote_id: input.quote_id,
    year: input.year,
    make: input.make,
    model: input.model,
    vin,
    ownership: input.ownership ?? null,
    usage: input.usage ?? null,
    annual_mileage: input.annual_mileage ?? null
  };
  const selectFields = [
    "id",
    "quote_id",
    "year",
    "make",
    "model",
    "vin",
    "ownership",
    "usage",
    "annual_mileage"
  ];

  if (config.useMemoryStore) {
    const data = memoryStore.insert("vehicles", payload, selectFields);
    memoryStore.update("quotes", input.quote_id, { completion_percentage: 60 });
    return { vehicle: data, next_step: "current_policy_or_coverages", vin_accepted: Boolean(vin) };
  }

  const { data, error } = await requireDb()
    .from("vehicles")
    .insert(payload)
    .select("id, quote_id, year, make, model, vin, ownership, usage, annual_mileage")
    .single();
  if (error) throw error;

  await requireDb()
    .from("quotes")
    .update({ completion_percentage: 60 })
    .eq("id", input.quote_id);

  return { vehicle: data, next_step: "current_policy_or_coverages", vin_accepted: Boolean(vin) };
}

export async function saveCurrentPolicy(input: {
  quote_id: string;
  carrier?: string;
  current_premium?: number;
  premium_frequency?: "monthly" | "6_month" | "annual";
  renewal_date?: string;
  bodily_injury_limit?: string;
  property_damage_limit?: string;
  comp_deductible?: number;
  collision_deductible?: number;
}) {
  const payload = {
    quote_id: input.quote_id,
    carrier: input.carrier ?? null,
    current_premium: input.current_premium ?? null,
    premium_frequency: input.premium_frequency ?? null,
    renewal_date: input.renewal_date ?? null,
    bodily_injury_limit: input.bodily_injury_limit ?? null,
    property_damage_limit: input.property_damage_limit ?? null,
    comp_deductible: input.comp_deductible ?? null,
    collision_deductible: input.collision_deductible ?? null
  };

  const policySelect = [
    "quote_id",
    "carrier",
    "current_premium",
    "premium_frequency",
    "renewal_date",
    "bodily_injury_limit",
    "property_damage_limit",
    "comp_deductible",
    "collision_deductible"
  ];

  if (config.useMemoryStore) {
    const data = memoryStore.insert("current_policies", payload, policySelect);
    memoryStore.update("quotes", input.quote_id, { completion_percentage: 75 });
    return { current_policy: data, next_step: "consent" };
  }

  const { data, error } = await requireDb()
    .from("current_policies")
    .insert(payload)
    .select(
      "quote_id, carrier, current_premium, premium_frequency, renewal_date, bodily_injury_limit, property_damage_limit, comp_deductible, collision_deductible"
    )
    .single();
  if (error) throw error;

  await requireDb()
    .from("quotes")
    .update({ completion_percentage: 75 })
    .eq("id", input.quote_id);

  return { current_policy: data, next_step: "consent" };
}

export async function saveConsent(input: {
  quote_id: string;
  consent_type: "quote_authorization" | "sms" | "email";
  accepted: boolean;
}) {
  const payload = {
    quote_id: input.quote_id,
    consent_type: input.consent_type,
    accepted: input.accepted
  };
  const selectFields = ["id", "quote_id", "consent_type", "accepted", "created_at"];

  if (config.useMemoryStore) {
    const data = memoryStore.insert("consents", payload, selectFields);
    return {
      consent: {
        quote_id: data.quote_id,
        consent_type: data.consent_type,
        accepted: data.accepted
      }
    };
  }

  const { data, error } = await requireDb()
    .from("consents")
    .insert(payload)
    .select("quote_id, consent_type, accepted")
    .single();
  if (error) throw error;

  return { consent: data };
}

function collectMissing(
  product: string,
  opts: {
    hasCustomer: boolean;
    driverCount: number;
    vehicleCount: number;
    policyCount: number;
    hasQuoteAuth: boolean;
    details: LineDetails;
  }
): string[] {
  const missing: string[] = [];
  if (!opts.hasCustomer) missing.push("customer_contact");

  const needsAddress =
    product === "auto" ||
    product === "home" ||
    product === "auto_home" ||
    product === "renters" ||
    product === "motorcycle" ||
    product === "boat" ||
    product === "golf_cart" ||
    isCommercialProduct(product);
  if (needsAddress) {
    if (!opts.details.contact_street) missing.push("contact_street");
    if (!opts.details.contact_city) missing.push("contact_city");
    if (!opts.details.contact_state) missing.push("contact_state");
    if (!opts.details.contact_zip) missing.push("contact_zip");
  }

  const needsResidence =
    product === "auto" ||
    product === "home" ||
    product === "auto_home" ||
    product === "renters" ||
    product === "motorcycle";
  if (needsResidence && !opts.details.residence_status) {
    missing.push("residence_status");
  }

  if (isCommercialProduct(product)) {
    if (!opts.details.business_name) missing.push("business_name");
    if (!opts.details.business_type_or_description) missing.push("business_type_or_description");
    if (!opts.details.business_address_state || !opts.details.business_address_zip) {
      missing.push("business_address_state_zip");
    }
  }

  if (product === "commercial_gl") {
    if (!opts.details.operations_description) missing.push("operations_description");
  }
  if (product === "workers_comp") {
    if (!opts.details.annual_payroll_estimate) missing.push("annual_payroll_estimate");
    if (!opts.details.employees_by_job_type) missing.push("employees_by_job_type");
  }
  if (product === "boat") {
    if (!opts.details.boat_year || !opts.details.boat_make) missing.push("boat_year_make");
    if (opts.details.boat_length_ft == null) missing.push("boat_length_ft");
  }
  if (product === "golf_cart") {
    if (!opts.details.cart_year || !opts.details.cart_make) missing.push("cart_year_make");
    if (opts.details.street_legal == null) missing.push("street_legal");
  }
  if (product === "trucking") {
    if (!opts.details.radius_of_operation) missing.push("radius_of_operation");
    if (!opts.details.cargo_type) missing.push("cargo_type");
    if (opts.details.power_unit_count == null) missing.push("power_unit_count");
  }
  if (product === "commercial_auto") {
    if (!opts.details.commercial_vehicle_summary && opts.vehicleCount === 0) {
      missing.push("commercial_vehicles");
    }
  }

  if (usesDriversAndVehicles(product)) {
    if (opts.driverCount === 0) missing.push("at_least_one_driver");
    if (opts.vehicleCount === 0 && product !== "commercial_auto") {
      // commercial_auto can satisfy via commercial_vehicle_summary OR vehicles
      missing.push("at_least_one_vehicle");
    }
    if (product === "commercial_auto" && opts.vehicleCount === 0 && !opts.details.commercial_vehicle_summary) {
      missing.push("at_least_one_vehicle");
    }
  }

  if (opts.policyCount === 0) missing.push("current_policy_or_coverage_preferences");
  if (!opts.hasQuoteAuth) missing.push("quote_authorization");
  return missing;
}

export async function getMissingFields(quoteId: string) {
  if (config.useMemoryStore) {
    const quote = memoryStore.getById("quotes", quoteId, [
      "id",
      "customer_id",
      "product",
      "state",
      "zip",
      "status",
      "line_details"
    ]);
    if (!quote) throw new Error(`Quote not found: ${quoteId}`);
    const details = (quote.line_details as LineDetails) ?? {};
    const product = String(details.product_line ?? quote.product);
    const drivers = memoryStore.listByQuoteId("drivers", quoteId, ["id"]);
    const vehicles = memoryStore.listByQuoteId("vehicles", quoteId, ["id"]);
    const policies = memoryStore.listByQuoteId("current_policies", quoteId, ["id"]);
    const consents = memoryStore.listByQuoteId("consents", quoteId, [
      "consent_type",
      "accepted"
    ]);
    const missing = collectMissing(product, {
      hasCustomer: Boolean(quote.customer_id),
      driverCount: drivers.length,
      vehicleCount: vehicles.length,
      policyCount: policies.length,
      hasQuoteAuth: Boolean(
        consents.find((c) => c.consent_type === "quote_authorization" && c.accepted)
      ),
      details
    });
    return { quote_id: quoteId, product, ready_to_submit: missing.length === 0, missing };
  }

  const client = requireDb();
  const [{ data: quote, error: quoteError }, { data: drivers }, { data: vehicles }, { data: policies }, { data: consents }] =
    await Promise.all([
      client.from("quotes").select("id, customer_id, product, state, zip, status").eq("id", quoteId).single(),
      client.from("drivers").select("id").eq("quote_id", quoteId),
      client.from("vehicles").select("id").eq("quote_id", quoteId),
      client.from("current_policies").select("id").eq("quote_id", quoteId),
      client.from("consents").select("consent_type, accepted").eq("quote_id", quoteId)
    ]);
  if (quoteError) throw quoteError;

  const details = await readLineDetails(quoteId);
  const product = String(details.product_line ?? quote.product);
  const missing = collectMissing(product, {
    hasCustomer: Boolean(quote.customer_id),
    driverCount: drivers?.length ?? 0,
    vehicleCount: vehicles?.length ?? 0,
    policyCount: policies?.length ?? 0,
    hasQuoteAuth: Boolean(
      consents?.find((c) => c.consent_type === "quote_authorization" && c.accepted)
    ),
    details
  });

  return { quote_id: quoteId, product, ready_to_submit: missing.length === 0, missing };
}

export async function loadLeadSnapshot(quoteId: string): Promise<LeadSnapshot> {
  if (config.useMemoryStore) {
    const quote = memoryStore.getById("quotes", quoteId);
    if (!quote) throw new Error(`Quote not found: ${quoteId}`);
    const customer = quote.customer_id
      ? memoryStore.getById("customers", String(quote.customer_id))
      : null;
    const details = (quote.line_details as LineDetails) ?? {};
    const product = String(details.product_line ?? quote.product ?? "");
    const drivers = memoryStore.listByQuoteId("drivers", quoteId);
    const vehicles = memoryStore.listByQuoteId("vehicles", quoteId);
    const current_policies = memoryStore.listByQuoteId("current_policies", quoteId);
    const consents = memoryStore.listByQuoteId("consents", quoteId);
    const details_summary = buildDetailsSummary(product, details, { drivers, vehicles });
    return {
      quote_id: quoteId,
      submitted_at: (quote.submitted_at as string | null) ?? null,
      product,
      state: (quote.state as string | null) ?? null,
      zip: (quote.zip as string | null) ?? null,
      status: (quote.status as string | null) ?? null,
      notes: (quote.notes as string | null) ?? null,
      source: String(quote.source ?? "CHATGPT"),
      source_detail: String(quote.source_detail ?? "ASSHIELD_CHATGPT_APP"),
      campaign: String(quote.campaign ?? "CHATGPT_QUOTE"),
      customer,
      drivers,
      vehicles,
      current_policies,
      consents,
      line_details: details,
      details_summary
    };
  }

  const client = requireDb();
  const { data: quote, error: quoteError } = await client
    .from("quotes")
    .select(
      "id, submitted_at, product, state, zip, status, notes, source, source_detail, campaign, customer_id"
    )
    .eq("id", quoteId)
    .single();
  if (quoteError) throw quoteError;

  let customer: Record<string, unknown> | null = null;
  if (quote.customer_id) {
    const { data, error } = await client
      .from("customers")
      .select("id, first_name, last_name, phone, email, preferred_contact_method")
      .eq("id", quote.customer_id)
      .single();
    if (error) throw error;
    customer = data as Record<string, unknown>;
  }

  const [
    { data: drivers },
    { data: vehicles },
    { data: policies },
    { data: consents }
  ] = await Promise.all([
    client.from("drivers").select("*").eq("quote_id", quoteId),
    client.from("vehicles").select("*").eq("quote_id", quoteId),
    client.from("current_policies").select("*").eq("quote_id", quoteId),
    client.from("consents").select("consent_type, accepted, created_at").eq("quote_id", quoteId)
  ]);

  const details = await readLineDetails(quoteId);
  const product = String(details.product_line ?? quote.product ?? "");
  const driverRows = (drivers ?? []) as Record<string, unknown>[];
  const vehicleRows = (vehicles ?? []) as Record<string, unknown>[];
  const details_summary = buildDetailsSummary(product, details, {
    drivers: driverRows,
    vehicles: vehicleRows
  });

  return {
    quote_id: quoteId,
    submitted_at: quote.submitted_at ?? null,
    product,
    state: quote.state ?? null,
    zip: quote.zip ?? null,
    status: quote.status ?? null,
    notes: quote.notes ?? null,
    source: quote.source ?? "CHATGPT",
    source_detail: quote.source_detail ?? "ASSHIELD_CHATGPT_APP",
    campaign: quote.campaign ?? "CHATGPT_QUOTE",
    customer,
    drivers: driverRows,
    vehicles: vehicleRows,
    current_policies: (policies ?? []) as Record<string, unknown>[],
    consents: (consents ?? []) as Record<string, unknown>[],
    line_details: details,
    details_summary
  };
}

export async function submitQuote(input: {
  quote_id: string;
  notes?: string;
}) {
  const readiness = await getMissingFields(input.quote_id);
  if (!readiness.ready_to_submit) {
    return {
      submitted: false,
      ...readiness
    };
  }

  const patch = {
    status: "submitted",
    completion_percentage: 100,
    submitted_at: new Date().toISOString(),
    notes: input.notes ?? null
  };
  const selectFields = ["id", "status", "submitted_at"];

  let quoteRow: Record<string, unknown>;

  if (config.useMemoryStore) {
    const data = memoryStore.update("quotes", input.quote_id, patch, selectFields);
    if (!data) throw new Error(`Quote not found: ${input.quote_id}`);
    quoteRow = data;
  } else {
    const { data, error } = await requireDb()
      .from("quotes")
      .update(patch)
      .eq("id", input.quote_id)
      .select("id, status, submitted_at")
      .single();
    if (error) throw error;
    quoteRow = data as Record<string, unknown>;
  }

  let notify: Awaited<ReturnType<typeof notifyLeadSubmitted>> | null = null;
  try {
    const lead = await loadLeadSnapshot(input.quote_id);
    notify = await notifyLeadSubmitted(lead);

    if (!config.useMemoryStore) {
      try {
        await requireDb()
          .from("activities")
          .insert({
            quote_id: input.quote_id,
            event_type: "lead_notified",
            event_data: notify
          });
      } catch (activityErr) {
        console.error("[submit_quote] activity log failed:", activityErr);
      }
    }
  } catch (notifyErr) {
    console.error("[submit_quote] notify failed:", notifyErr);
    notify = {
      webhook: { attempted: false, ok: false, error: "snapshot_or_notify_threw" },
      email: { attempted: false, ok: false, error: String(notifyErr) }
    };
  }

  return {
    submitted: true,
    quote: {
      id: quoteRow.id,
      status: quoteRow.status
    },
    message:
      "Quote request submitted to Asshield. This is not confirmation of coverage or a bound policy. A licensed Asshield agent will follow up using your preferred contact method."
  };
}
