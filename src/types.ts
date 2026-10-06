export type QuoteProduct =
  | "auto"
  | "home"
  | "auto_home"
  | "renters"
  | "commercial_auto"
  | "commercial_gl"
  | "workers_comp"
  | "boat"
  | "golf_cart"
  | "motorcycle"
  | "trucking";

export const QUOTE_PRODUCTS = [
  "auto",
  "home",
  "auto_home",
  "renters",
  "commercial_auto",
  "commercial_gl",
  "workers_comp",
  "boat",
  "golf_cart",
  "motorcycle",
  "trucking"
] as const;

/** Pre-migration DB check only allowed these four. */
export const LEGACY_DB_PRODUCTS = ["auto", "home", "auto_home", "renters"] as const;

export type QuoteStatus =
  | "started"
  | "in_progress"
  | "documents_uploaded"
  | "ready_to_quote"
  | "submitted"
  | "rating"
  | "quoted"
  | "contacted"
  | "sold"
  | "lost";

export type LineDetails = {
  /** Canonical product when DB product column is legacy-mapped. */
  product_line?: QuoteProduct;
  // Shared commercial (commercial_auto, commercial_gl, workers_comp, trucking)
  business_name?: string;
  business_type_or_description?: string;
  years_in_business?: number;
  annual_revenue_range?: string;
  number_of_employees?: number;
  business_address_state?: string;
  business_address_zip?: string;
  // Commercial auto summary (vehicles/drivers also via add_*)
  commercial_vehicle_summary?: string;
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
  // Trucking
  dot_mc_number?: string;
  radius_of_operation?: "local" | "intermediate" | "long_haul";
  cargo_type?: string;
  power_unit_count?: number;
  trailer_count?: number;
  // Agent / preference extras (UI)
  callback_preference?: "morning" | "afternoon" | "evening";
  /** One-time nonce for widget-only quote_authorization consent. */
  consent_nonce?: string;
  intake_notes?: string;
  coverage_preference?: "low" | "medium" | "high";
  deductible_preference?: "low" | "medium" | "high";
  selected_coverages?: string[];
  bundle_lines?: string[];
  // Contact / garaging address
  contact_street?: string;
  contact_unit?: string;
  contact_city?: string;
  contact_state?: string;
  contact_zip?: string;
  // Residence
  residence_status?: "own" | "rent" | "other";
  residence_other?: string;
  // SMS TCPA opt-in (optional)
  sms_consent?: boolean;
  sms_consent_at?: string;
  sms_consent_version?: string;
  sms_consent_text?: string;
};

export const SMS_CONSENT_VERSION = "tcpa_v1_2026_10";
export const SMS_CONSENT_TEXT =
  "Yes, Asshield Insurance may text me about my quote at the number provided. Msg & data rates may apply. Msg frequency varies. Reply STOP to opt out, HELP for help. Consent is not a condition of purchase.";


export function isCommercialProduct(product: string): boolean {
  return (
    product === "commercial_auto" ||
    product === "commercial_gl" ||
    product === "workers_comp" ||
    product === "trucking"
  );
}

export function usesDriversAndVehicles(product: string): boolean {
  return (
    product === "auto" ||
    product === "auto_home" ||
    product === "commercial_auto" ||
    product === "motorcycle" ||
    product === "trucking"
  );
}

/** Map expanded products onto legacy DB enum when migration 002 is not applied. */
export function legacyDbProduct(product: QuoteProduct): (typeof LEGACY_DB_PRODUCTS)[number] {
  switch (product) {
    case "auto":
    case "home":
    case "auto_home":
    case "renters":
      return product;
    case "commercial_auto":
    case "motorcycle":
    case "trucking":
    case "boat":
    case "golf_cart":
      return "auto";
    case "commercial_gl":
    case "workers_comp":
      return "home";
    default:
      return "auto";
  }
}

export function buildDetailsSummary(
  product: string,
  details: LineDetails,
  extras?: {
    drivers?: Record<string, unknown>[];
    vehicles?: Record<string, unknown>[];
  }
): string {
  const parts: string[] = [`Product: ${product}`];
  const d = details || {};

  if (isCommercialProduct(product) || d.business_name) {
    const biz = [
      d.business_name && `Business: ${d.business_name}`,
      d.business_type_or_description && `Type: ${d.business_type_or_description}`,
      d.years_in_business != null && `Years in business: ${d.years_in_business}`,
      d.annual_revenue_range && `Revenue range: ${d.annual_revenue_range}`,
      d.number_of_employees != null && `Employees: ${d.number_of_employees}`,
      (d.business_address_state || d.business_address_zip) &&
        `Biz address: ${d.business_address_state ?? ""} ${d.business_address_zip ?? ""}`.trim()
    ].filter(Boolean);
    if (biz.length) parts.push(biz.join("; "));
  }

  if (product === "commercial_auto" && d.commercial_vehicle_summary) {
    parts.push(`Commercial vehicles: ${d.commercial_vehicle_summary}`);
  }
  if (product === "commercial_gl") {
    if (d.operations_description) parts.push(`Operations: ${d.operations_description}`);
    if (d.desired_limits) parts.push(`Desired limits: ${d.desired_limits}`);
  }
  if (product === "workers_comp") {
    if (d.annual_payroll_estimate) parts.push(`Payroll estimate: ${d.annual_payroll_estimate}`);
    if (d.employees_by_job_type) parts.push(`Employees by job type: ${d.employees_by_job_type}`);
  }
  if (product === "boat") {
    parts.push(
      [
        d.boat_year,
        d.boat_make,
        d.boat_length_ft != null ? `${d.boat_length_ft} ft` : null,
        d.motor_hp != null ? `${d.motor_hp} HP` : null,
        d.boat_storage_or_usage
      ]
        .filter((x) => x != null && x !== "")
        .join(" / ")
    );
  }
  if (product === "golf_cart") {
    parts.push(
      [
        d.cart_year,
        d.cart_make,
        d.street_legal == null ? null : d.street_legal ? "street-legal" : "not street-legal",
        d.cart_usage
      ]
        .filter((x) => x != null && x !== "")
        .join(" / ")
    );
  }
  if (product === "trucking") {
    const t = [
      d.dot_mc_number && `DOT/MC: ${d.dot_mc_number}`,
      d.radius_of_operation && `Radius: ${d.radius_of_operation}`,
      d.cargo_type && `Cargo: ${d.cargo_type}`,
      d.power_unit_count != null && `Power units: ${d.power_unit_count}`,
      d.trailer_count != null && `Trailers: ${d.trailer_count}`
    ].filter(Boolean);
    if (t.length) parts.push(t.join("; "));
  }

  if (extras?.drivers?.length) {
    parts.push(
      `Drivers (${extras.drivers.length}): ` +
        extras.drivers
          .map((x) => `${x.first_name ?? ""} ${x.last_name ?? ""}`.trim())
          .filter(Boolean)
          .join(", ")
    );
  }
  if (extras?.vehicles?.length) {
    parts.push(
      `Units (${extras.vehicles.length}): ` +
        extras.vehicles
          .map((x) => {
            const base = `${x.year ?? ""} ${x.make ?? ""} ${x.model ?? ""}`.trim();
            return x.vin ? `${base} VIN ${x.vin}` : base;
          })
          .filter(Boolean)
          .join(", ")
    );
  }

  const addr = [
    d.contact_street,
    d.contact_unit,
    [d.contact_city, d.contact_state, d.contact_zip].filter(Boolean).join(" ")
  ]
    .filter(Boolean)
    .join(", ");
  if (addr) parts.push(`Address: ${addr}`);

  if (d.residence_status) {
    const res =
      d.residence_status === "other" && d.residence_other
        ? `Other (${d.residence_other})`
        : d.residence_status === "own"
          ? "Own"
          : d.residence_status === "rent"
            ? "Rent"
            : "Other";
    parts.push(`Residence: ${res}`);
  }

  if (d.sms_consent != null) {
    parts.push(`Text OK: ${d.sms_consent ? "Yes" : "No"}`);
  }

  return parts.filter((p) => p && p !== "Product: ").length
    ? parts.join(" | ")
    : `Product: ${product}`;
}
