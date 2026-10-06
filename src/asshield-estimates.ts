/**
 * Asshield starting-price estimates (agency owner figures).
 * Not quotes, offers, or bound premiums — intake illustration only.
 */
export const ASSHIELD_ESTIMATES = {
  /** Estimated starting monthly premium per vehicle (auto and motorcycle). */
  auto_per_vehicle_monthly: 65,
  /** Estimated starting annual premium for homeowners. */
  homeowners_annual: 965,
  /** Short lead line for the disclosure panel (bold). */
  disclaimer_lead:
    "*Estimate only. Not a quote or offer of insurance. No coverage is bound.",
  /** Fine print under the lead line. */
  disclaimer_body:
    "Your actual premium is based on the carrier, insurance score, claims history, driving and property records, and other carrier rating factors once your quote is processed by our agency. It may be higher or lower, and we do not represent that this is the price you will be offered once all reports and quotes are complete."
} as const;

export type EstimateLine = {
  product: string;
  label: string;
  kind: "priced" | "agent_will_price";
  amount: number | null;
  frequency: "month" | "year" | null;
  unit: "per_vehicle" | "policy" | null;
  display: string;
  asterisk: boolean;
};

export type ProposalItem = {
  name: string;
  limit_or_detail: string;
};

export type AsshieldEstimatePayload = {
  brand: "Asshield Insurance";
  title: string;
  lines: EstimateLine[];
  proposal: ProposalItem[];
  coverage_preference: string | null;
  deductible_preference: string | null;
  vehicle_count: number;
  disclaimer_lead: string;
  disclaimer_body: string;
  /** Combined for ChatGPT / text consumers. */
  disclaimer: string;
  estimates_are_not_quotes: true;
  no_coverage_bound: true;
};

const PREF_LIMITS: Record<string, { auto_bi: string; auto_pd: string; home_dwelling: string; home_liability: string; ded: string }> = {
  low: {
    auto_bi: "50/100",
    auto_pd: "$50,000",
    home_dwelling: "Dwelling — essential rebuild discussion",
    home_liability: "$100,000 personal liability",
    ded: "$1,000"
  },
  medium: {
    auto_bi: "100/300",
    auto_pd: "$100,000",
    home_dwelling: "Dwelling — balanced rebuild discussion",
    home_liability: "$300,000 personal liability",
    ded: "$1,000"
  },
  high: {
    auto_bi: "250/500",
    auto_pd: "$100,000",
    home_dwelling: "Dwelling — enhanced rebuild discussion",
    home_liability: "$500,000 personal liability",
    ded: "$500"
  }
};

function prefKey(v: string | null | undefined): "low" | "medium" | "high" {
  if (v === "low" || v === "high") return v;
  return "medium";
}

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
  return map[product] || product.replace(/_/g, " ");
}

function pricedLine(
  product: string,
  label: string,
  amount: number,
  frequency: "month" | "year",
  unit: "per_vehicle" | "policy",
  display: string
): EstimateLine {
  return {
    product,
    label,
    kind: "priced",
    amount,
    frequency,
    unit,
    display,
    asterisk: true
  };
}

function agentPriced(product: string, label: string): EstimateLine {
  return {
    product,
    label,
    kind: "agent_will_price",
    amount: null,
    frequency: null,
    unit: null,
    display: "Agent will price this",
    asterisk: false
  };
}

function proposalFor(
  product: string,
  coveragePref: string | null | undefined,
  deductiblePref: string | null | undefined,
  vehicleCount: number
): ProposalItem[] {
  const p = prefKey(coveragePref);
  const limits = PREF_LIMITS[p];
  const ded =
    deductiblePref === "low" ? "$500" : deductiblePref === "high" ? "$2,500" : limits.ded;
  const items: ProposalItem[] = [];

  const wantsAuto =
    product === "auto" || product === "auto_home" || product === "motorcycle";
  const wantsHome = product === "home" || product === "auto_home";

  if (wantsAuto) {
    items.push(
      { name: "Bodily injury liability", limit_or_detail: `${limits.auto_bi} (per person / per accident)` },
      { name: "Property damage liability", limit_or_detail: limits.auto_pd },
      { name: "Uninsured / underinsured motorist", limit_or_detail: `Match BI ${limits.auto_bi} (discussion)` },
      { name: "Comprehensive & collision", limit_or_detail: `Subject to ${ded} deductible` },
      {
        name: product === "motorcycle" ? "Motorcycles on request" : "Vehicles on request",
        limit_or_detail: `${Math.max(1, vehicleCount)} unit(s)`
      }
    );
  }
  if (wantsHome) {
    items.push(
      { name: "Dwelling", limit_or_detail: limits.home_dwelling },
      { name: "Personal property", limit_or_detail: "Included subject to policy terms" },
      { name: "Personal liability", limit_or_detail: limits.home_liability },
      { name: "Home deductible", limit_or_detail: ded }
    );
  }
  if (!wantsAuto && !wantsHome) {
    items.push(
      { name: "Line", limit_or_detail: productLabel(product) },
      { name: "Coverages & limits", limit_or_detail: "An Asshield licensed agent will confirm options after review" },
      { name: "Preference noted", limit_or_detail: `Coverage ${prefKey(coveragePref)} · deductible ${deductiblePref || "medium"}` }
    );
  }
  return items;
}

export function buildAsshieldEstimate(input: {
  product: string;
  vehicle_count?: number;
  coverage_preference?: string | null;
  deductible_preference?: string | null;
}): AsshieldEstimatePayload {
  const product = String(input.product || "auto");
  const vehicleCount = Math.max(1, Number(input.vehicle_count) || 1);
  const coveragePref = input.coverage_preference ?? "medium";
  const deductiblePref = input.deductible_preference ?? "medium";
  const lines: EstimateLine[] = [];

  if (product === "auto" || product === "motorcycle") {
    const monthly = ASSHIELD_ESTIMATES.auto_per_vehicle_monthly * vehicleCount;
    lines.push(
      pricedLine(
        product,
        product === "motorcycle" ? "Motorcycle" : "Auto",
        monthly,
        "month",
        "per_vehicle",
        `Estimated starting at $${ASSHIELD_ESTIMATES.auto_per_vehicle_monthly}/mo per vehicle · $${monthly}/mo for ${vehicleCount} vehicle${vehicleCount === 1 ? "" : "s"}*`
      )
    );
  } else if (product === "home") {
    lines.push(
      pricedLine(
        "home",
        "Homeowners",
        ASSHIELD_ESTIMATES.homeowners_annual,
        "year",
        "policy",
        `Estimated starting at $${ASSHIELD_ESTIMATES.homeowners_annual}/yr*`
      )
    );
  } else if (product === "auto_home") {
    const monthly = ASSHIELD_ESTIMATES.auto_per_vehicle_monthly * vehicleCount;
    lines.push(
      pricedLine(
        "auto",
        "Auto",
        monthly,
        "month",
        "per_vehicle",
        `Auto — estimated starting at $${ASSHIELD_ESTIMATES.auto_per_vehicle_monthly}/mo per vehicle · $${monthly}/mo for ${vehicleCount} vehicle${vehicleCount === 1 ? "" : "s"}*`
      ),
      pricedLine(
        "home",
        "Homeowners",
        ASSHIELD_ESTIMATES.homeowners_annual,
        "year",
        "policy",
        `Homeowners — estimated starting at $${ASSHIELD_ESTIMATES.homeowners_annual}/yr*`
      )
    );
  } else {
    lines.push(agentPriced(product, productLabel(product)));
  }

  const disclaimer = `${ASSHIELD_ESTIMATES.disclaimer_lead} ${ASSHIELD_ESTIMATES.disclaimer_body}`;

  return {
    brand: "Asshield Insurance",
    title: "Asshield estimate + proposal",
    lines,
    proposal: proposalFor(product, coveragePref, deductiblePref, vehicleCount),
    coverage_preference: coveragePref,
    deductible_preference: deductiblePref,
    vehicle_count: vehicleCount,
    disclaimer_lead: ASSHIELD_ESTIMATES.disclaimer_lead,
    disclaimer_body: ASSHIELD_ESTIMATES.disclaimer_body,
    disclaimer,
    estimates_are_not_quotes: true,
    no_coverage_bound: true
  };
}
