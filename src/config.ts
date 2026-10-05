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
  smsWebhookUrl: process.env.SMS_WEBHOOK_URL ?? ""
};
