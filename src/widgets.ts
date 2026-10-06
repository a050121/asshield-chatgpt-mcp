import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  registerAppResource,
  RESOURCE_MIME_TYPE
} from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { config } from "./config.js";
import { LICENSED_STATES } from "./licensed-states.js";
import {
  checklistFor,
  crossSellFor,
  getDisclaimer,
  productLabel
} from "./coverage-kb.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");

export const QUOTE_CARD_URI = "ui://widget/asshield-quote-card/v1.html";
export const AGENT_CARD_URI = "ui://widget/asshield-agent-card/v1.html";
export const OPTIONS_CARD_URI = "ui://widget/asshield-options-card/v1.html";
export const COVERAGE_CARD_URI = "ui://widget/asshield-coverage-card/v1.html";

function logoDataUri(): string {
  try {
    const png = readFileSync(
      join(__dirname, "..", "chatgpt-plugin/asshield-insurance/assets/icon.png")
    );
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return "";
  }
}

function loadHtml(name: string): string {
  const theme = readFileSync(join(publicDir, "asshield-widget-theme.css"), "utf8");
  const icons = readFileSync(join(publicDir, "asshield-line-icons.js"), "utf8");
  return readFileSync(join(publicDir, name), "utf8")
    .replaceAll("LOGO_SRC", logoDataUri())
    .replace("/*__ASSHIELD_THEME__*/", theme)
    .replace("/*__ASSHIELD_ICONS__*/", icons);
}

const uiCsp = {
  connectDomains: [] as string[],
  resourceDomains: [
    "https://www.asshield.com",
    "https://asshield.com",
    "https://content.naic.org"
  ]
};

const uiResourceMeta = {
  prefersBorder: true,
  csp: uiCsp
};

function openaiWidgetMeta(description: string) {
  return {
    ui: uiResourceMeta,
    "openai/widgetCSP": {
      connect_domains: uiCsp.connectDomains,
      resource_domains: uiCsp.resourceDomains
    },
    "openai/widgetDescription": description
  };
}

export function registerWidgets(server: McpServer): void {
  const specs: { name: string; uri: string; file: string; description: string }[] = [
    {
      name: "asshield-quote-card",
      uri: QUOTE_CARD_URI,
      file: "quote-card.html",
      description: "Asshield guided quote card (consent, stepper form, review, confirmation)"
    },
    {
      name: "asshield-agent-card",
      uri: AGENT_CARD_URI,
      file: "agent-card.html",
      description: "Asshield agent contact card"
    },
    {
      name: "asshield-options-card",
      uri: OPTIONS_CARD_URI,
      file: "options-card.html",
      description: "Asshield insurance line picker (personal / commercial / recreational)"
    },
    {
      name: "asshield-coverage-card",
      uri: COVERAGE_CARD_URI,
      file: "coverage-card.html",
      description: "Asshield coverage overview and what-to-have-ready checklist"
    }
  ];

  for (const spec of specs) {
    const html = loadHtml(spec.file);
    registerAppResource(
      server,
      spec.name,
      spec.uri,
      {
        description: spec.description,
        mimeType: RESOURCE_MIME_TYPE,
        _meta: { ui: uiResourceMeta }
      },
      async () => ({
        contents: [
          {
            uri: spec.uri,
            mimeType: RESOURCE_MIME_TYPE,
            text: html,
            _meta: openaiWidgetMeta(spec.description)
          }
        ]
      })
    );
  }
}

function toolMeta(uri: string, invoking: string, invoked: string) {
  return {
    ui: { resourceUri: uri },
    "openai/outputTemplate": uri,
    "openai/toolInvocation/invoking": invoking,
    "openai/toolInvocation/invoked": invoked
  };
}

export function quoteCardMeta() {
  return toolMeta(
    QUOTE_CARD_URI,
    "Updating Asshield quote card…",
    "Asshield quote card ready."
  );
}

export function agentCardMeta() {
  return toolMeta(
    AGENT_CARD_URI,
    "Loading Asshield agent contact…",
    "Asshield agent contact ready."
  );
}

export function optionsCardMeta() {
  return toolMeta(
    OPTIONS_CARD_URI,
    "Loading Asshield insurance options…",
    "Asshield insurance options ready."
  );
}

export function coverageCardMeta() {
  return toolMeta(
    COVERAGE_CARD_URI,
    "Loading coverage overview…",
    "Coverage overview ready."
  );
}

export function agentContactPayload() {
  const license = config.agentLicenseNumber.trim();
  const booking = config.bookingUrl.trim();
  return {
    agency: "Asshield Insurance",
    name: config.agentName,
    phone: config.agentPhone,
    phone_tel: config.agentPhoneTel,
    email: config.agentEmail,
    address: config.agentAddress,
    street: config.agentStreet,
    office_city_state_zip: config.officeCityStateZip || undefined,
    website: config.agencyWebsite,
    privacy_url: config.privacyUrl,
    licensed_states: [...LICENSED_STATES],
    verify_license_url: config.naicLookupUrl,
    ...(license ? { license_number: license } : {}),
    ...(booking ? { booking_url: booking } : {}),
    note: "Contact information only. No coverage is bound by viewing this card."
  };
}

export type QuoteWidgetPhase = "consent" | "progress" | "confirmation";

export function withQuoteWidget(
  result: Record<string, unknown>,
  phase: QuoteWidgetPhase
): Record<string, unknown> {
  const quote = (result.quote as Record<string, unknown> | null) || null;
  const quoteId =
    (result.quote_id as string | undefined) ||
    (quote?.id as string | undefined) ||
    undefined;
  const product =
    (result.product as string | undefined) ||
    (quote?.product as string | undefined) ||
    undefined;
  const state =
    (result.state as string | undefined) || (quote?.state as string | undefined);
  const zip = (result.zip as string | undefined) || (quote?.zip as string | undefined);
  const checklist = product ? checklistFor(product) : [];
  const cross = product
    ? crossSellFor(product).map((l) => ({ id: l.id, label: l.label, icon: l.icon }))
    : [];

  const widget: Record<string, unknown> = {
    kind: "quote_card",
    phase,
    quote_id: quoteId,
    reference_number: quoteId,
    product,
    product_label: product ? productLabel(product) : undefined,
    state,
    zip,
    missing: (result.missing as string[] | undefined) || [],
    checklist,
    what_to_have_ready: checklist,
    fields: { state, zip, product },
    message: result.message,
    privacy_url: config.privacyUrl,
    no_coverage_bound: true,
    callback_sla: config.callbackSlaText,
    cross_sell: cross,
    disclaimer: getDisclaimer(),
    agent: phase === "confirmation" ? agentContactPayload() : undefined
  };

  return {
    ...result,
    product_label: product ? productLabel(product) : undefined,
    what_to_have_ready: checklist,
    callback_sla: config.callbackSlaText,
    cross_sell: cross,
    widget
  };
}

export function toolTextResult(structured: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(structured) }],
    structuredContent: structured
  };
}
