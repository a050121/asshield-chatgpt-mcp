/**
 * Post-submit confirmation banner + independent-agency copy.
 * No quotation marks in customer-facing strings.
 */

/** Text carrier names only (no logos). Empty until Josh confirms his markets. */
export const CARRIER_NETWORK: string[] = [];

export type ConfirmationBanner = {
  heading: string;
  body: string;
  bound_line: string;
  after_hours: boolean;
  office_hours_label: string;
  submitted_at: string;
};

export type IndependentSection = {
  title: string;
  body: string;
  fine_print: string;
  /** Present only when CARRIER_NETWORK is non-empty. */
  carrier_line: string | null;
  carriers: string[];
};

export type ConfirmationMessaging = {
  banner: ConfirmationBanner;
  independent: IndependentSection;
  no_coverage_bound: true;
  /** Flat text for ChatGPT / structuredContent.message consumers. */
  summary_text: string;
};

const OFFICE_HOURS_LABEL = "Mon–Fri 9am–7pm · Sat 9am–5pm ET";

/** True when `when` falls inside Asshield office hours in America/New_York. */
export function isWithinOfficeHours(when: Date = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23"
  }).formatToParts(when);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  const weekday = get("weekday"); // Sun Mon Tue ...
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));
  const mins = hour * 60 + minute;

  if (weekday === "Sun") return false;
  if (weekday === "Sat") return mins >= 9 * 60 && mins < 17 * 60;
  // Mon–Fri
  return mins >= 9 * 60 && mins < 19 * 60;
}

function carrierLine(carriers: string[]): string | null {
  if (!carriers.length) return null;
  return `We work with multiple insurance carriers, including: ${carriers.join(" • ")} and others.`;
}

export function buildConfirmationMessaging(when: Date = new Date()): ConfirmationMessaging {
  const afterHours = !isWithinOfficeHours(when);
  const heading = "You're all set.";
  const bound_line = "No coverage is bound until confirmed by a licensed agent.";
  const body = afterHours
    ? "Your quote request is complete and ready for an Asshield agent to review. An agent will review the request next business day."
    : "Your quote request is complete and ready for an Asshield agent to review. During business hours, we typically respond within 1 hour. Requests received after hours will be reviewed the next business day.";

  const independent: IndependentSection = {
    title: "Independent means more options",
    body: "Your Asshield agent can review your request across multiple available insurance markets to help find an appropriate combination of coverage and price.",
    fine_print:
      "Carrier availability varies by state, product, eligibility, and underwriting. Your agent will determine which markets are appropriate for your request.",
    carrier_line: carrierLine(CARRIER_NETWORK),
    carriers: [...CARRIER_NETWORK]
  };

  const summary_text = [
    heading,
    body,
    bound_line,
    independent.title + ".",
    independent.body,
    independent.fine_print,
    independent.carrier_line || ""
  ]
    .filter(Boolean)
    .join(" ");

  return {
    banner: {
      heading,
      body,
      bound_line,
      after_hours: afterHours,
      office_hours_label: OFFICE_HOURS_LABEL,
      submitted_at: when.toISOString()
    },
    independent,
    no_coverage_bound: true,
    summary_text
  };
}
