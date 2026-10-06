import "dotenv/config";

function optional(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() ? value : undefined;
}

const supabaseUrl = optional("SUPABASE_URL");
const supabaseServiceRoleKey = optional("SUPABASE_SERVICE_ROLE_KEY");
const useMemoryStore = !supabaseUrl || !supabaseServiceRoleKey;

/** Street line only by default; city/ZIP appended when OFFICE_CITY_STATE_ZIP is set. */
const agentStreet = process.env.AGENT_STREET ?? "2240 Executive Dr Unit 103";
/** City/state/ZIP for the primary (Lexington) office. */
const officeCityStateZip = (process.env.OFFICE_CITY_STATE_ZIP ?? "Lexington, KY 40505").trim();
const agentAddress = officeCityStateZip
  ? `${agentStreet}, ${officeCityStateZip}`
  : agentStreet;

/** Hours shown on the agent card row (full). */
const officeHoursText =
  (process.env.OFFICE_HOURS_TEXT ?? "Mon–Fri 9am–7pm · Sat 9am–5pm ET").trim();
/** Compact hours for the agent card footer. */
const officeHoursFooter =
  (process.env.OFFICE_HOURS_FOOTER ?? "Mon–Fri 9–7 · Sat 9–5 ET").trim();

const flOfficeStreet =
  process.env.FL_OFFICE_STREET ?? "139 Beal Pkwy SE, Suite 203";
const flOfficeCityStateZip =
  (process.env.FL_OFFICE_CITY_STATE_ZIP ?? "Fort Walton Beach, FL 32548").trim();
const flOfficePhone = process.env.FL_OFFICE_PHONE ?? "850-684-0164";
const flOfficePhoneTel = process.env.FL_OFFICE_PHONE_TEL ?? "+18506840164";
const flOfficeAddress = flOfficeCityStateZip
  ? `${flOfficeStreet}, ${flOfficeCityStateZip}`
  : flOfficeStreet;

export const config = {
  port: Number(process.env.PORT ?? 8787),
  supabaseUrl,
  supabaseServiceRoleKey,
  useMemoryStore,
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? `http://localhost:${process.env.PORT ?? 8787}`,
  crmWebhookUrl: process.env.CRM_WEBHOOK_URL ?? "",
  ezlynxWebhookUrl: process.env.EZLYNX_WEBHOOK_URL ?? "",
  smsWebhookUrl: process.env.SMS_WEBHOOK_URL ?? "",
  /** Destination inbox for lead emails (e.g. insurancelexky@gmail.com). */
  leadNotifyEmail: process.env.LEAD_NOTIFY_EMAIL ?? "",
  /** From header for Resend/SMTP. Resend free: onboarding@resend.dev until domain verified. */
  leadNotifyFrom: process.env.LEAD_NOTIFY_FROM ?? "",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  smtpHost: process.env.SMTP_HOST ?? "",
  smtpPort: Number(process.env.SMTP_PORT ?? 587),
  smtpUser: process.env.SMTP_USER ?? "",
  smtpPass: process.env.SMTP_PASS ?? "",
  /** Agency license numbers shown on the contact card (KY + FL). */
  agentLicenseNumber:
    process.env.AGENT_LICENSE_NUMBER ?? "KY Agency #867084 · FL Agency #L120146",
  /** Optional booking URL; shown only when set. */
  bookingUrl: process.env.BOOKING_URL ?? "",
  agentName: process.env.AGENT_NAME ?? "Asshield licensed agents",
  agentEmail: process.env.AGENT_EMAIL ?? "quote@asshield.com",
  agentPhone: process.env.AGENT_PHONE ?? "859-368-0162",
  agentPhoneTel: process.env.AGENT_PHONE_TEL ?? "+18593680162",
  agentStreet,
  officeCityStateZip,
  agentAddress,
  officeHoursText,
  officeHoursFooter,
  flOfficeStreet,
  flOfficeCityStateZip,
  flOfficePhone,
  flOfficePhoneTel,
  flOfficeAddress,
  agencyWebsite: process.env.AGENCY_WEBSITE ?? "https://www.asshield.com",
  privacyUrl: process.env.PRIVACY_URL ?? "https://www.asshield.com/privacy",
  naicLookupUrl:
    process.env.NAIC_LOOKUP_URL ?? "https://content.naic.org/state-insurance-departments",
  /** Shown on confirmation timeline; keep soft unless Josh sets a firmer SLA. */
  callbackSlaText:
    process.env.CALLBACK_SLA_TEXT ?? "An agent will reach out soon"
};
