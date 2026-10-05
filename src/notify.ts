/**
 * Outbound lead notifications after submit_quote succeeds.
 * Channels (any combination):
 *   - CRM_WEBHOOK_URL: JSON POST (Zapier / Make / n8n / custom)
 *   - RESEND_API_KEY + LEAD_NOTIFY_EMAIL: email via Resend
 *   - SMTP_* + LEAD_NOTIFY_EMAIL: email via SMTP (e.g. Gmail app password)
 * Failures are logged; they do not roll back the quote status update.
 */

import nodemailer from "nodemailer";
import { config } from "./config.js";

export type LeadSnapshot = {
  quote_id: string;
  submitted_at: string | null;
  product: string | null;
  state: string | null;
  zip: string | null;
  status: string | null;
  notes: string | null;
  source: string;
  source_detail: string;
  campaign: string;
  customer: Record<string, unknown> | null;
  drivers: Record<string, unknown>[];
  vehicles: Record<string, unknown>[];
  current_policies: Record<string, unknown>[];
  consents: Record<string, unknown>[];
  line_details?: Record<string, unknown>;
  /** Flat line-specific summary for Zapier/email templates. */
  details_summary?: string;
};

export type NotifyResult = {
  webhook: { attempted: boolean; ok: boolean; status?: number; error?: string };
  email: { attempted: boolean; ok: boolean; provider?: string; error?: string };
};

function buildSubject(lead: LeadSnapshot): string {
  const name = lead.customer
    ? `${String(lead.customer.first_name ?? "")} ${String(lead.customer.last_name ?? "")}`.trim()
    : "Unknown";
  const product = lead.product ?? "quote";
  const state = lead.state ?? "??";
  return `[Asshield ChatGPT] New ${product} quote — ${name} (${state})`;
}

function buildTextBody(lead: LeadSnapshot): string {
  const lines: string[] = [
    "New Asshield quote request from ChatGPT.",
    "",
    `Quote ID: ${lead.quote_id}`,
    `Submitted: ${lead.submitted_at ?? "(unknown)"}`,
    `Product: ${lead.product ?? ""}`,
    `State/ZIP: ${lead.state ?? ""} / ${lead.zip ?? ""}`,
    `Status: ${lead.status ?? ""}`,
    `Source: ${lead.source} / ${lead.source_detail} / ${lead.campaign}`,
    ""
  ];

  if (lead.customer) {
    lines.push(
      "Customer:",
      `  Name: ${lead.customer.first_name ?? ""} ${lead.customer.last_name ?? ""}`,
      `  Phone: ${lead.customer.phone ?? ""}`,
      `  Email: ${lead.customer.email ?? ""}`,
      `  Preferred contact: ${lead.customer.preferred_contact_method ?? ""}`,
      ""
    );
  }

  if (lead.drivers.length) {
    lines.push("Drivers:");
    for (const d of lead.drivers) {
      lines.push(
        `  - ${d.first_name ?? ""} ${d.last_name ?? ""} DOB=${d.date_of_birth ?? ""} rel=${d.relationship ?? ""} lic=${d.license_state ?? ""}`
      );
    }
    lines.push("");
  }

  if (lead.vehicles.length) {
    lines.push("Vehicles:");
    for (const v of lead.vehicles) {
      lines.push(
        `  - ${v.year ?? ""} ${v.make ?? ""} ${v.model ?? ""} own=${v.ownership ?? ""} use=${v.usage ?? ""} mi=${v.annual_mileage ?? ""}`
      );
    }
    lines.push("");
  }

  if (lead.current_policies.length) {
    lines.push("Current policy / coverages:");
    for (const p of lead.current_policies) {
      lines.push(
        `  - carrier=${p.carrier ?? ""} premium=${p.current_premium ?? ""} freq=${p.premium_frequency ?? ""} renewal=${p.renewal_date ?? ""} BI=${p.bodily_injury_limit ?? ""} PD=${p.property_damage_limit ?? ""}`
      );
    }
    lines.push("");
  }

  if (lead.consents.length) {
    lines.push("Consents:");
    for (const c of lead.consents) {
      lines.push(`  - ${c.consent_type ?? ""}: ${c.accepted ? "accepted" : "declined"}`);
    }
    lines.push("");
  }

  if (lead.details_summary) {
    lines.push(`Details summary: ${lead.details_summary}`, "");
  }

  if (lead.notes) {
    lines.push(`Notes: ${lead.notes}`, "");
  }

  lines.push(
    "This is a quote intake only — not confirmation of coverage or a bound policy."
  );
  return lines.join("\n");
}

async function postWebhook(lead: LeadSnapshot): Promise<NotifyResult["webhook"]> {
  const url = config.crmWebhookUrl.trim();
  if (!url) {
    return { attempted: false, ok: false };
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "user-agent": "asshield-chatgpt-mcp/0.2"
      },
      body: JSON.stringify({
        event: "quote.submitted",
        received_at: new Date().toISOString(),
        lead,
        // Flat aliases for Zapier email templates (also on lead.details_summary)
        details_summary: lead.details_summary ?? "",
        product: lead.product ?? "",
        quote_id: lead.quote_id
      })
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        attempted: true,
        ok: false,
        status: res.status,
        error: body.slice(0, 500) || `HTTP ${res.status}`
      };
    }
    return { attempted: true, ok: true, status: res.status };
  } catch (err) {
    return {
      attempted: true,
      ok: false,
      error: err instanceof Error ? err.message : String(err)
    };
  }
}

async function sendResendEmail(lead: LeadSnapshot): Promise<NotifyResult["email"]> {
  const apiKey = config.resendApiKey.trim();
  const to = config.leadNotifyEmail.trim();
  if (!apiKey || !to) {
    return { attempted: false, ok: false };
  }

  const from = config.leadNotifyFrom.trim() || "Asshield ChatGPT <onboarding@resend.dev>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: buildSubject(lead),
        text: buildTextBody(lead)
      })
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        attempted: true,
        ok: false,
        provider: "resend",
        error: body.slice(0, 500) || `HTTP ${res.status}`
      };
    }
    return { attempted: true, ok: true, provider: "resend" };
  } catch (err) {
    return {
      attempted: true,
      ok: false,
      provider: "resend",
      error: err instanceof Error ? err.message : String(err)
    };
  }
}

async function sendSmtpEmail(lead: LeadSnapshot): Promise<NotifyResult["email"]> {
  const host = config.smtpHost.trim();
  const user = config.smtpUser.trim();
  const pass = config.smtpPass.trim();
  const to = config.leadNotifyEmail.trim();
  if (!host || !user || !pass || !to) {
    return { attempted: false, ok: false };
  }

  const from = config.leadNotifyFrom.trim() || user;
  try {
    const transporter = nodemailer.createTransport({
      host,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      auth: { user, pass }
    });
    await transporter.sendMail({
      from,
      to,
      subject: buildSubject(lead),
      text: buildTextBody(lead)
    });
    return { attempted: true, ok: true, provider: "smtp" };
  } catch (err) {
    return {
      attempted: true,
      ok: false,
      provider: "smtp",
      error: err instanceof Error ? err.message : String(err)
    };
  }
}

export async function notifyLeadSubmitted(lead: LeadSnapshot): Promise<NotifyResult> {
  const webhook = await postWebhook(lead);

  let email: NotifyResult["email"] = { attempted: false, ok: false };
  if (config.resendApiKey.trim() && config.leadNotifyEmail.trim()) {
    email = await sendResendEmail(lead);
  } else if (
    config.smtpHost.trim() &&
    config.smtpUser.trim() &&
    config.smtpPass.trim() &&
    config.leadNotifyEmail.trim()
  ) {
    email = await sendSmtpEmail(lead);
  }

  if (!webhook.attempted && !email.attempted) {
    console.warn(
      "[notify] No CRM_WEBHOOK_URL and no email provider configured; lead stored but Asshield was not notified."
    );
  } else {
    console.log(
      `[notify] quote=${lead.quote_id} webhook=${webhook.attempted ? (webhook.ok ? "ok" : "fail") : "skip"} email=${email.attempted ? (email.ok ? `ok(${email.provider})` : `fail(${email.provider})`) : "skip"}`
    );
    if (webhook.attempted && !webhook.ok) {
      console.error("[notify] webhook error:", webhook.error);
    }
    if (email.attempted && !email.ok) {
      console.error("[notify] email error:", email.error);
    }
  }

  return { webhook, email };
}

export function notificationConfigured(): boolean {
  const webhook = Boolean(config.crmWebhookUrl.trim());
  const resend = Boolean(config.resendApiKey.trim() && config.leadNotifyEmail.trim());
  const smtp = Boolean(
    config.smtpHost.trim() &&
      config.smtpUser.trim() &&
      config.smtpPass.trim() &&
      config.leadNotifyEmail.trim()
  );
  return webhook || resend || smtp;
}
