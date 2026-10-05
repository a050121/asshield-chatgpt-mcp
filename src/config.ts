import "dotenv/config";

function optional(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() ? value : undefined;
}

const supabaseUrl = optional("SUPABASE_URL");
const supabaseServiceRoleKey = optional("SUPABASE_SERVICE_ROLE_KEY");
const useMemoryStore = !supabaseUrl || !supabaseServiceRoleKey;

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
  smtpPass: process.env.SMTP_PASS ?? ""
};
