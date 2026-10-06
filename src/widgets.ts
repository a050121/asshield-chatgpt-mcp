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

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");

export const QUOTE_CARD_URI = "ui://widget/asshield-quote-card/v1.html";
export const AGENT_CARD_URI = "ui://widget/asshield-agent-card/v1.html";

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
  return readFileSync(join(publicDir, name), "utf8").replaceAll("LOGO_SRC", logoDataUri());
}

/** CSP for Asshield widgets — no external scripts; logo is inlined as data URI. */
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

export function registerWidgets(server: McpServer): void {
  const quoteHtml = loadHtml("quote-card.html");
  const agentHtml = loadHtml("agent-card.html");

  registerAppResource(
    server,
    "asshield-quote-card",
    QUOTE_CARD_URI,
    {
      description: "Asshield branded quote intake card (consent, progress, confirmation)",
      mimeType: RESOURCE_MIME_TYPE,
      _meta: { ui: uiResourceMeta }
    },
    async () => ({
      contents: [
        {
          uri: QUOTE_CARD_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: quoteHtml,
          _meta: {
            ui: uiResourceMeta,
            // ChatGPT Apps SDK compatibility (skybridge-era hosts)
            "openai/widgetCSP": {
              connect_domains: uiCsp.connectDomains,
              resource_domains: uiCsp.resourceDomains
            },
            "openai/widgetDescription":
              "Asshield quote card with privacy consent, progress editing, and confirmation."
          }
        }
      ]
    })
  );

  registerAppResource(
    server,
    "asshield-agent-card",
    AGENT_CARD_URI,
    {
      description: "Asshield agent contact card",
      mimeType: RESOURCE_MIME_TYPE,
      _meta: { ui: uiResourceMeta }
    },
    async () => ({
      contents: [
        {
          uri: AGENT_CARD_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: agentHtml,
          _meta: {
            ui: uiResourceMeta,
            "openai/widgetCSP": {
              connect_domains: uiCsp.connectDomains,
              resource_domains: uiCsp.resourceDomains
            },
            "openai/widgetDescription": "Asshield agent contact and license verification card."
          }
        }
      ]
    })
  );
}

export function quoteCardMeta() {
  return {
    ui: { resourceUri: QUOTE_CARD_URI },
    "openai/outputTemplate": QUOTE_CARD_URI,
    "openai/toolInvocation/invoking": "Updating Asshield quote card…",
    "openai/toolInvocation/invoked": "Asshield quote card ready."
  };
}

export function agentCardMeta() {
  return {
    ui: { resourceUri: AGENT_CARD_URI },
    "openai/outputTemplate": AGENT_CARD_URI,
    "openai/toolInvocation/invoking": "Loading Asshield agent contact…",
    "openai/toolInvocation/invoked": "Asshield agent contact ready."
  };
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

  const widget: Record<string, unknown> = {
    kind: "quote_card",
    phase,
    quote_id: quoteId,
    reference_number: quoteId,
    product,
    state,
    zip,
    missing: (result.missing as string[] | undefined) || [],
    fields: {
      state,
      zip,
      product
    },
    message: result.message,
    no_coverage_bound: true,
    agent: phase === "confirmation" ? agentContactPayload() : undefined
  };

  return {
    ...result,
    widget
  };
}

export function toolTextResult(structured: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(structured) }],
    structuredContent: structured
  };
}
