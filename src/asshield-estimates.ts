/**
 * Asshield professional coverage proposal + starting-price estimates.
 * Owner figures — illustrations only, never quotes or bound premiums.
 * No carrier is named; branded Asshield Insurance.
 */
import { config } from "./config.js";

/** Single config constant for estimate numbers (Josh / agency owner). */
export const ASSHIELD_ESTIMATES = {
  auto_per_vehicle_monthly: 65,
  homeowners_annual: 965,
  auto_defaults: {
    bodily_injury: "100/300",
    property_damage: "100",
    um_uim: "100/300",
    comprehensive_deductible: "$500",
    collision_deductible: "$500"
  },
  home_defaults: {
    dwelling: "Proposed — dwelling rebuild discussion",
    other_structures: "Proposed — typically 10% of dwelling",
    personal_property: "Proposed — typically 50% of dwelling",
    loss_of_use: "Proposed — typically 20% of dwelling",
    personal_liability: "$300,000",
    medical_payments_to_others: "$1,000",
    deductible: "$1,000"
  },
  disclaimer_lead:
    "*Estimate only. Not a quote or offer of insurance. No coverage is bound.",
  disclaimer_body:
    "Your actual premium is based on the carrier, insurance score, claims history, driving and property records, and other carrier rating factors once your quote is processed by our agency. It may be higher or lower, and we do not represent that this is the price you will be offered once all reports and quotes are complete."
} as const;

export type CoverageLine = {
  name: string;
  limit_or_detail: string;
};

export type VehicleProposal = {
  year: number | string | null;
  make: string | null;
  model: string | null;
  vin_last4: string | null;
  label: string;
  coverages: CoverageLine[];
  estimate_monthly: number;
  estimate_display: string;
};

export type HomeProposal = {
  coverages: CoverageLine[];
  estimate_annual: number;
  estimate_display: string;
};

export type OtherLineProposal = {
  product: string;
  label: string;
  coverages: CoverageLine[];
  pricing_display: string;
};

export type AsshieldEstimatePayload = {
  brand: "Asshield Insurance";
  title: string;
  kind: "professional_proposal";
  proposal_date: string;
  quote_reference: string | null;
  customer_first_name: string | null;
  agent: {
    name: string;
    phone: string;
    email: string;
    website: string;
  };
  product: string;
  product_label: string;
  state: string | null;
  vehicles: VehicleProposal[];
  home: HomeProposal | null;
  other: OtherLineProposal | null;
  totals: {
    auto_monthly: number | null;
    home_annual: number | null;
    auto_display: string | null;
    home_display: string | null;
    other_display: string | null;
  };
  disclaimer_lead: string;
  disclaimer_body: string;
  disclaimer: string;
  estimates_are_not_quotes: true;
  no_coverage_bound: true;
};

function productLabel(product: string): string {
  const map: Record<string, string> = {
    auto: "Auto",
    home: "Homeowners",
    auto_home: "Auto + Home",
    renters: "Renters",
    motorcycle: "Motorcycle",
    commercial_auto: "Commercial Auto",
    commercial_gl: "Commercial GL",
    workers_comp: "Workers Comp",
    trucking: "Trucking",
    boat: "Boat",
    golf_cart: "Golf Cart"
  };
  return map[product] || String(product || "").replace(/_/g, " ");
}

function vinLast4(vin: unknown): string | null {
  const s = String(vin || "").replace(/\s+/g, "");
  if (s.length >= 4) return s.slice(-4).toUpperCase();
  return null;
}

function vehicleLabel(v: Record<string, unknown>, index: number): string {
  const year = v.year ?? "";
  const make = v.make ?? "";
  const model = v.model ?? "";
  const base = [year, make, model].filter(Boolean).join(" ").trim();
  const last4 = vinLast4(v.vin);
  if (base && last4) return `${base} (VIN …${last4})`;
  if (base) return base;
  if (last4) return `Vehicle ${index + 1} (VIN …${last4})`;
  return `Vehicle ${index + 1}`;
}

function medicalOrPip(state: string | null | undefined): CoverageLine {
  const st = String(state || "").toUpperCase();
  if (st === "FL" || st === "KY" || st === "PA") {
    return { name: "Personal Injury Protection (PIP)", limit_or_detail: "Proposed — state minimum / agent confirm" };
  }
  return { name: "Medical Payments", limit_or_detail: "Proposed — agent confirm" };
}

function autoCoverages(state: string | null | undefined): CoverageLine[] {
  const d = ASSHIELD_ESTIMATES.auto_defaults;
  return [
    { name: "Bodily Injury Liability", limit_or_detail: d.bodily_injury },
    { name: "Property Damage Liability", limit_or_detail: d.property_damage },
    { name: "Uninsured / Underinsured Motorist", limit_or_detail: d.um_uim },
    { name: "Comprehensive", limit_or_detail: `${d.comprehensive_deductible} deductible` },
    { name: "Collision", limit_or_detail: `${d.collision_deductible} deductible` },
    { name: "Roadside Assistance", limit_or_detail: "Included in proposal" },
    { name: "Rental Reimbursement", limit_or_detail: "Included in proposal" },
    medicalOrPip(state)
  ];
}

function homeCoverages(details: Record<string, unknown> | null | undefined): CoverageLine[] {
  const d = ASSHIELD_ESTIMATES.home_defaults;
  const dwelling =
    (details?.dwelling_limit as string) ||
    (details?.home_dwelling as string) ||
    d.dwelling;
  const ded =
    (details?.home_deductible as string) ||
    (details?.deductible as string) ||
    d.deductible;
  return [
    { name: "Dwelling", limit_or_detail: String(dwelling) },
    { name: "Other Structures", limit_or_detail: d.other_structures },
    { name: "Personal Property", limit_or_detail: d.personal_property },
    { name: "Loss of Use", limit_or_detail: d.loss_of_use },
    { name: "Personal Liability", limit_or_detail: d.personal_liability },
    { name: "Medical Payments to Others", limit_or_detail: d.medical_payments_to_others },
    { name: "Deductible", limit_or_detail: String(ded) }
  ];
}

function otherCoverages(product: string): CoverageLine[] {
  const label = productLabel(product);
  return [
    { name: `${label} liability / primary covers`, limit_or_detail: "Proposed — agent confirm" },
    { name: "Physical damage / property (if applicable)", limit_or_detail: "Proposed — agent confirm" },
    { name: "Limits & deductibles", limit_or_detail: "To be confirmed with an Asshield licensed agent" }
  ];
}

function todayISODate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function buildAsshieldEstimate(input: {
  product: string;
  state?: string | null;
  quote_id?: string | null;
  customer_first_name?: string | null;
  vehicles?: Record<string, unknown>[];
  line_details?: Record<string, unknown> | null;
  coverage_preference?: string | null;
  deductible_preference?: string | null;
}): AsshieldEstimatePayload {
  const product = String(input.product || "auto");
  const state = input.state ? String(input.state).toUpperCase() : null;
  const vehiclesIn = Array.isArray(input.vehicles) ? input.vehicles : [];
  const wantsAuto =
    product === "auto" || product === "auto_home" || product === "motorcycle";
  const wantsHome = product === "home" || product === "auto_home";

  const vehicles: VehicleProposal[] = [];
  if (wantsAuto) {
    const list = vehiclesIn.length ? vehiclesIn : [{}];
    for (let i = 0; i < list.length; i++) {
      const v = list[i] || {};
      const monthly = ASSHIELD_ESTIMATES.auto_per_vehicle_monthly;
      vehicles.push({
        year: (v.year as number | string) ?? null,
        make: (v.make as string) ?? null,
        model: (v.model as string) ?? null,
        vin_last4: vinLast4(v.vin),
        label: vehicleLabel(v, i),
        coverages: autoCoverages(state),
        estimate_monthly: monthly,
        estimate_display: `Estimated starting at $${monthly}/mo*`
      });
    }
  }

  let home: HomeProposal | null = null;
  if (wantsHome) {
    const annual = ASSHIELD_ESTIMATES.homeowners_annual;
    home = {
      coverages: homeCoverages(input.line_details),
      estimate_annual: annual,
      estimate_display: `Estimated starting at $${annual}/yr*`
    };
  }

  let other: OtherLineProposal | null = null;
  if (!wantsAuto && !wantsHome) {
    other = {
      product,
      label: productLabel(product),
      coverages: otherCoverages(product),
      pricing_display: "Agent will price this"
    };
  }

  const autoMonthly = vehicles.length
    ? vehicles.reduce((s, v) => s + v.estimate_monthly, 0)
    : null;
  const homeAnnual = home ? home.estimate_annual : null;

  const disclaimer = `${ASSHIELD_ESTIMATES.disclaimer_lead} ${ASSHIELD_ESTIMATES.disclaimer_body}`;

  return {
    brand: "Asshield Insurance",
    title: "Professional coverage proposal + estimate",
    kind: "professional_proposal",
    proposal_date: todayISODate(),
    quote_reference: input.quote_id ? String(input.quote_id) : null,
    customer_first_name: input.customer_first_name ? String(input.customer_first_name) : null,
    agent: {
      name: config.agentName,
      phone: config.agentPhone,
      email: config.agentEmail,
      website: config.agencyWebsite.replace(/^https?:\/\//, "")
    },
    product,
    product_label: productLabel(product),
    state,
    vehicles,
    home,
    other,
    totals: {
      auto_monthly: autoMonthly,
      home_annual: homeAnnual,
      auto_display:
        autoMonthly != null
          ? `Auto total — estimated starting at $${autoMonthly}/mo* (${vehicles.length} vehicle${vehicles.length === 1 ? "" : "s"})`
          : null,
      home_display:
        homeAnnual != null ? `Homeowners — estimated starting at $${homeAnnual}/yr*` : null,
      other_display: other ? other.pricing_display : null
    },
    disclaimer_lead: ASSHIELD_ESTIMATES.disclaimer_lead,
    disclaimer_body: ASSHIELD_ESTIMATES.disclaimer_body,
    disclaimer,
    estimates_are_not_quotes: true,
    no_coverage_bound: true
  };
}
