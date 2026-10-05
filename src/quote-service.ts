import { config } from "./config.js";
import { db } from "./db.js";
import { memoryStore } from "./memory-store.js";
import { notifyLeadSubmitted, type LeadSnapshot } from "./notify.js";
import type { QuoteProduct } from "./types.js";

function requireDb() {
  if (!db) throw new Error("Supabase client is not configured");
  return db;
}

export async function startQuote(input: {
  product: QuoteProduct;
  state: string;
  zip: string;
}) {
  const payload = {
    product: input.product,
    state: input.state.toUpperCase(),
    zip: input.zip,
    source: "CHATGPT",
    source_detail: "ASSHIELD_CHATGPT_APP",
    campaign: "CHATGPT_QUOTE",
    status: "started",
    completion_percentage: 5
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
    const data = memoryStore.insert("quotes", payload, selectFields);
    return {
      quote: data,
      next_step: "customer_contact",
      supported: true
    };
  }

  const { data, error } = await requireDb()
    .from("quotes")
    .insert(payload)
    .select("id, product, state, zip, status, completion_percentage")
    .single();

  if (error) throw error;

  return {
    quote: data,
    next_step: "customer_contact",
    supported: true
  };
}

export async function saveContact(input: {
  quote_id: string;
  first_name: string;
  last_name: string;
  phone?: string;
  email?: string;
  preferred_contact_method?: "call" | "text" | "email";
}) {
  const customerPayload = {
    first_name: input.first_name,
    last_name: input.last_name,
    phone: input.phone ?? null,
    email: input.email ?? null,
    preferred_contact_method: input.preferred_contact_method ?? "text"
  };
  const customerSelect = [
    "id",
    "first_name",
    "last_name",
    "phone",
    "email",
    "preferred_contact_method"
  ];

  if (config.useMemoryStore) {
    const customer = memoryStore.insert("customers", customerPayload, customerSelect);
    const updated = memoryStore.update("quotes", input.quote_id, {
      customer_id: customer.id,
      status: "in_progress",
      completion_percentage: 20
    });
    if (!updated) throw new Error(`Quote not found: ${input.quote_id}`);
    return {
      quote_id: input.quote_id,
      customer,
      next_step: "drivers"
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

  return {
    quote_id: input.quote_id,
    customer,
    next_step: "drivers"
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
  const payload = {
    quote_id: input.quote_id,
    year: input.year,
    make: input.make,
    model: input.model,
    vin: input.vin ?? null,
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
    "ownership",
    "usage",
    "annual_mileage"
  ];

  if (config.useMemoryStore) {
    const data = memoryStore.insert("vehicles", payload, selectFields);
    memoryStore.update("quotes", input.quote_id, { completion_percentage: 60 });
    return { vehicle: data, next_step: "current_policy_or_coverages" };
  }

  const { data, error } = await requireDb()
    .from("vehicles")
    .insert(payload)
    .select("id, quote_id, year, make, model, ownership, usage, annual_mileage")
    .single();

  if (error) throw error;

  await requireDb()
    .from("quotes")
    .update({ completion_percentage: 60 })
    .eq("id", input.quote_id);

  return { vehicle: data, next_step: "current_policy_or_coverages" };
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

  if (config.useMemoryStore) {
    const data = memoryStore.insert("current_policies", payload, ["*"]);
    memoryStore.update("quotes", input.quote_id, { completion_percentage: 75 });
    return { current_policy: data, next_step: "consent" };
  }

  const { data, error } = await requireDb()
    .from("current_policies")
    .insert(payload)
    .select("*")
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
    return { consent: data };
  }

  const { data, error } = await requireDb()
    .from("consents")
    .insert(payload)
    .select("id, quote_id, consent_type, accepted, created_at")
    .single();

  if (error) throw error;

  return { consent: data };
}

export async function getMissingFields(quoteId: string) {
  if (config.useMemoryStore) {
    const quote = memoryStore.getById("quotes", quoteId, [
      "id",
      "customer_id",
      "product",
      "state",
      "zip",
      "status"
    ]);
    if (!quote) throw new Error(`Quote not found: ${quoteId}`);

    const drivers = memoryStore.listByQuoteId("drivers", quoteId, ["id"]);
    const vehicles = memoryStore.listByQuoteId("vehicles", quoteId, ["id"]);
    const policies = memoryStore.listByQuoteId("current_policies", quoteId, ["id"]);
    const consents = memoryStore.listByQuoteId("consents", quoteId, [
      "consent_type",
      "accepted"
    ]);

    const missing: string[] = [];
    if (!quote.customer_id) missing.push("customer_contact");
    if (drivers.length === 0) missing.push("at_least_one_driver");
    if (quote.product === "auto" || quote.product === "auto_home") {
      if (vehicles.length === 0) missing.push("at_least_one_vehicle");
    }
    if (policies.length === 0) missing.push("current_policy_or_coverage_preferences");

    const quoteAuth = consents.find(
      (c) => c.consent_type === "quote_authorization" && c.accepted
    );
    if (!quoteAuth) missing.push("quote_authorization");

    return {
      quote_id: quoteId,
      ready_to_submit: missing.length === 0,
      missing
    };
  }

  const [{ data: quote, error: quoteError }, { data: drivers }, { data: vehicles }, { data: policies }, { data: consents }] =
    await Promise.all([
      requireDb().from("quotes").select("id, customer_id, product, state, zip, status").eq("id", quoteId).single(),
      requireDb().from("drivers").select("id").eq("quote_id", quoteId),
      requireDb().from("vehicles").select("id").eq("quote_id", quoteId),
      requireDb().from("current_policies").select("id").eq("quote_id", quoteId),
      requireDb().from("consents").select("consent_type, accepted").eq("quote_id", quoteId)
    ]);

  if (quoteError) throw quoteError;

  const missing: string[] = [];
  if (!quote.customer_id) missing.push("customer_contact");
  if ((drivers?.length ?? 0) === 0) missing.push("at_least_one_driver");
  if (quote.product === "auto" || quote.product === "auto_home") {
    if ((vehicles?.length ?? 0) === 0) missing.push("at_least_one_vehicle");
  }
  if ((policies?.length ?? 0) === 0) missing.push("current_policy_or_coverage_preferences");

  const quoteAuth = consents?.find((c) => c.consent_type === "quote_authorization" && c.accepted);
  if (!quoteAuth) missing.push("quote_authorization");

  return {
    quote_id: quoteId,
    ready_to_submit: missing.length === 0,
    missing
  };
}

export async function loadLeadSnapshot(quoteId: string): Promise<LeadSnapshot> {
  if (config.useMemoryStore) {
    const quote = memoryStore.getById("quotes", quoteId);
    if (!quote) throw new Error(`Quote not found: ${quoteId}`);
    const customer = quote.customer_id
      ? memoryStore.getById("customers", String(quote.customer_id))
      : null;
    return {
      quote_id: quoteId,
      submitted_at: (quote.submitted_at as string | null) ?? null,
      product: (quote.product as string | null) ?? null,
      state: (quote.state as string | null) ?? null,
      zip: (quote.zip as string | null) ?? null,
      status: (quote.status as string | null) ?? null,
      notes: (quote.notes as string | null) ?? null,
      source: String(quote.source ?? "CHATGPT"),
      source_detail: String(quote.source_detail ?? "ASSHIELD_CHATGPT_APP"),
      campaign: String(quote.campaign ?? "CHATGPT_QUOTE"),
      customer: customer,
      drivers: memoryStore.listByQuoteId("drivers", quoteId),
      vehicles: memoryStore.listByQuoteId("vehicles", quoteId),
      current_policies: memoryStore.listByQuoteId("current_policies", quoteId),
      consents: memoryStore.listByQuoteId("consents", quoteId)
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

  return {
    quote_id: quoteId,
    submitted_at: quote.submitted_at ?? null,
    product: quote.product ?? null,
    state: quote.state ?? null,
    zip: quote.zip ?? null,
    status: quote.status ?? null,
    notes: quote.notes ?? null,
    source: quote.source ?? "CHATGPT",
    source_detail: quote.source_detail ?? "ASSHIELD_CHATGPT_APP",
    campaign: quote.campaign ?? "CHATGPT_QUOTE",
    customer,
    drivers: (drivers ?? []) as Record<string, unknown>[],
    vehicles: (vehicles ?? []) as Record<string, unknown>[],
    current_policies: (policies ?? []) as Record<string, unknown>[],
    consents: (consents ?? []) as Record<string, unknown>[]
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
    quote: quoteRow,
    notify,
    message:
      "Quote request submitted to Asshield. This is not confirmation of coverage or a bound policy."
  };
}
