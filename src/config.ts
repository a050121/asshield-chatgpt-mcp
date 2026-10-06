import "dotenv/config";

function optional(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() ? value : undefined;
}

const supabaseUrl = optional("SUPABASE_URL");
const supabaseServiceRoleKey = optional("SUPABASE_SERVICE_ROLE_KEY");
const useMemoryStore = !supabaseUrl || !supabaseServiceRoleKey;

/** Street line only by default; city/ZIP appended when OFFICE_CITY_STATE_ZIP is set. */
const agentStreet = process.env.AGENT_STREET ?? "2240 Executive Dr Ste 103";
/** Optional city/state/ZIP (e.g. "Lexington, KY 40505") — omit until Josh confirms. */
const officeCityStateZip = (process.env.OFFICE_CITY_STATE_ZIP ?? "").trim();
const agentAddress = officeCityStateZip
  ? `${agentStreet}, ${officeCityStateZip}`
  : agentStreet;

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
  /** Optional agent license number shown on the contact card only when set. */
  agentLicenseNumber: process.env.AGENT_LICENSE_NUMBER ?? "",
  /** Optional booking URL; shown only when set. */
  bookingUrl: process.env.BOOKING_URL ?? "",
  agentName: process.env.AGENT_NAME ?? "Joshua Williams",
  agentEmail: process.env.AGENT_EMAIL ?? "joshuawilliams@asshield.com",
  agentPhone: process.env.AGENT_PHONE ?? "859-368-0162",
  agentPhoneTel: process.env.AGENT_PHONE_TEL ?? "+18593680162",
  agentStreet,
  officeCityStateZip,
  agentAddress,
  agencyWebsite: process.env.AGENCY_WEBSITE ?? "https://www.asshield.com",
  privacyUrl: process.env.PRIVACY_URL ?? "https://www.asshield.com/privacy",
  naicLookupUrl:
    process.env.NAIC_LOOKUP_URL ?? "https://content.naic.org/state-insurance-departments",
  /** Shown on confirmation timeline; keep soft unless Josh sets a firmer SLA. */
  callbackSlaText:
    process.env.CALLBACK_SLA_TEXT ?? "An agent will reach out soon"
};
