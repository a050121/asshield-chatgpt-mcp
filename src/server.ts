import { createServer } from "node:http";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { config } from "./config.js";
import {
  startQuote,
  saveContact,
  saveBusinessDetails,
  saveLineDetails,
  addDriver,
  addVehicle,
  saveCurrentPolicy,
  saveConsent,
  getMissingFields,
  submitQuote
} from "./quote-service.js";
import { notificationConfigured } from "./notify.js";
import { QUOTE_PRODUCTS } from "./types.js";
import {
  registerWidgets,
  quoteCardMeta,
  agentCardMeta,
  optionsCardMeta,
  coverageCardMeta,
  agentContactPayload,
  withQuoteWidget,
  toolTextResult
} from "./widgets.js";
import { explainCoverage, listInsuranceOptions } from "./coverage-kb.js";

const productEnum = z.enum(QUOTE_PRODUCTS);

function createMcpServer(): McpServer {
  const app = new McpServer(
    {
      name: "asshield-insurance",
      version: "0.5.0"
    },
    {
      instructions:
        "Help users start and complete Asshield Insurance quote intake for Auto, Home, Auto+Home, Renters, Commercial Auto, Commercial GL, Workers' Comp, Boat, Golf Cart, Motorcycle, or Trucking. Never state that coverage is bound or effective. Only start quotes for licensed states (AL, AR, FL, GA, IN, KY, NC, OH, PA, SC, TN, TX). Before submitting, call get_missing_quote_fields. Use show_insurance_options to present lines, explain_coverage for general coverage Q&A (not advice), and get_agent_contact for agent phone/email/office or after submit. Never collect SSN, FEIN, driver's license numbers, payment cards, or passwords."
    }
  );

  registerWidgets(app);

  registerAppTool(
    app,
    "start_quote",
    {
      title: "Start an Asshield quote",
      description:
        "Start a new insurance quote intake for Auto, Home, Auto+Home, Renters, Commercial Auto, Commercial GL, Workers' Comp, Boat, Golf Cart, Motorcycle, or Trucking in a licensed state (AL, AR, FL, GA, IN, KY, NC, OH, PA, SC, TN, TX). Out-of-area states get a polite unsupported message and no quote is created. Does not bind coverage or return a price. Renders the Asshield guided quote card (consent, multi-step form, review). Includes a what-to-have-ready checklist for the line.",
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      _meta: quoteCardMeta(),
      inputSchema: {
        product: productEnum,
        state: z.string().length(2),
        zip: z.string().regex(/^\d{5}(-\d{4})?$/)
      }
    },
    async (input) => {
      const result = await startQuote(input) as Record<string, unknown>;
      const phase = result.supported === false ? "consent" : "consent";
      const enriched = withQuoteWidget(result, phase);
      return toolTextResult(enriched);
    }
  );

  app.registerTool(
    "save_contact",
    {
      title: "Save quote contact",
      description:
        "Save the customer's name and preferred contact details for an active Asshield quote. Collect only name plus at least one reachable phone or email. Do not collect SSN, FEIN, driver's license numbers, payment cards, or passwords.",
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        quote_id: z.string().uuid(),
        first_name: z.string().min(1),
        last_name: z.string().min(1),
        phone: z.string().min(7).optional(),
        email: z.string().email().optional(),
        preferred_contact_method: z.enum(["call", "text", "email"]).optional(),
        callback_preference: z.enum(["morning", "afternoon", "evening"]).optional(),
        intake_notes: z.string().max(500).optional()
      }
    },
    async (input) => {
      const result = await saveContact(input);
      return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
    }
  );

  app.registerTool(
    "save_business_details",
    {
      title: "Save business details",
      description:
        "Save business profile fields for Commercial Auto, Commercial GL, Workers' Comp, or Trucking quotes: business name, type/description, years in business, revenue range, employee count, and business address state/ZIP. For Trucking also accept optional DOT/MC number, radius (local/intermediate/long_haul), cargo type, power unit and trailer counts. For Commercial Auto you may include a short commercial_vehicle_summary. Never collect FEIN, SSN, or payment info.",
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        quote_id: z.string().uuid(),
        business_name: z.string().min(1),
        business_type_or_description: z.string().min(1).optional(),
        years_in_business: z.number().int().min(0).max(200).optional(),
        annual_revenue_range: z.string().optional(),
        number_of_employees: z.number().int().min(0).max(100000).optional(),
        business_address_state: z.string().length(2).optional(),
        business_address_zip: z.string().regex(/^\d{5}(-\d{4})?$/).optional(),
        dot_mc_number: z.string().max(64).optional(),
        radius_of_operation: z.enum(["local", "intermediate", "long_haul"]).optional(),
        cargo_type: z.string().max(500).optional(),
        power_unit_count: z.number().int().min(0).max(10000).optional(),
        trailer_count: z.number().int().min(0).max(10000).optional(),
        commercial_vehicle_summary: z.string().max(1000).optional()
      }
    },
    async (input) => {
      const result = await saveBusinessDetails(input);
      return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
    }
  );

  app.registerTool(
    "save_line_details",
    {
      title: "Save line-specific details",
      description:
        "Save specialty intake fields for Commercial GL (operations description, desired limits), Workers' Comp (payroll estimate, employees by job type as plain text), Boat (year, make, length, motor HP, storage/usage), or Golf Cart (year, make, street-legal flag, usage). Do not collect SSN, FEIN, driver's license numbers, or payment info.",
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        quote_id: z.string().uuid(),
        operations_description: z.string().max(2000).optional(),
        desired_limits: z.string().max(500).optional(),
        annual_payroll_estimate: z.string().max(200).optional(),
        employees_by_job_type: z.string().max(2000).optional(),
        boat_year: z.number().int().min(1900).max(2100).optional(),
        boat_make: z.string().min(1).optional(),
        boat_length_ft: z.number().positive().max(500).optional(),
        motor_hp: z.number().nonnegative().max(10000).optional(),
        boat_storage_or_usage: z.string().max(500).optional(),
        cart_year: z.number().int().min(1900).max(2100).optional(),
        cart_make: z.string().min(1).optional(),
        street_legal: z.boolean().optional(),
        cart_usage: z.string().max(500).optional(),
        commercial_vehicle_summary: z.string().max(1000).optional()
      }
    },
    async (input) => {
      const result = await saveLineDetails(input);
      return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
    }
  );

  app.registerTool(
    "add_driver",
    {
      title: "Add driver",
      description:
        "Add a driver/rider to an Auto, Auto+Home, Commercial Auto, Motorcycle, or Trucking quote. Do not request or return a driver's license number, SSN, or FEIN.",
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        quote_id: z.string().uuid(),
        first_name: z.string().min(1),
        last_name: z.string().min(1),
        date_of_birth: z.string().date().optional(),
        relationship: z.string().optional(),
        license_state: z.string().length(2).optional()
      }
    },
    async (input) => {
      const result = await addDriver(input);
      return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
    }
  );

  app.registerTool(
    "add_vehicle",
    {
      title: "Add vehicle",
      description:
        "Add a vehicle, motorcycle, or power unit to an Auto, Auto+Home, Commercial Auto, Motorcycle, or Trucking quote (year, make, model; VIN and usage optional). For motorcycles put CC in the model field (e.g. 'Ninja 650'). Do not collect payment or financing account numbers.",
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        quote_id: z.string().uuid(),
        year: z.number().int().min(1900).max(2100),
        make: z.string().min(1),
        model: z.string().min(1),
        vin: z.string().min(11).max(17).optional(),
        ownership: z.enum(["owned", "financed", "leased"]).optional(),
        usage: z.enum(["pleasure", "commute", "business"]).optional(),
        annual_mileage: z.number().int().min(0).max(250000).optional()
      }
    },
    async (input) => {
      const result = await addVehicle(input);
      return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
    }
  );

  app.registerTool(
    "save_current_policy",
    {
      title: "Save current policy",
      description:
        "Save the customer's current carrier, premium, renewal date, and main coverage limits/deductibles for comparison. Optional fields only; skip anything the customer does not know.",
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        quote_id: z.string().uuid(),
        carrier: z.string().optional(),
        current_premium: z.number().positive().optional(),
        premium_frequency: z.enum(["monthly", "6_month", "annual"]).optional(),
        renewal_date: z.string().date().optional(),
        bodily_injury_limit: z.string().optional(),
        property_damage_limit: z.string().optional(),
        comp_deductible: z.number().nonnegative().optional(),
        collision_deductible: z.number().nonnegative().optional()
      }
    },
    async (input) => {
      const result = await saveCurrentPolicy(input);
      return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
    }
  );

  app.registerTool(
    "save_consent",
    {
      title: "Save consent",
      description:
        "Record a customer's affirmative consent. Never infer consent; accepted must reflect an explicit user choice.",
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        quote_id: z.string().uuid(),
        consent_type: z.enum(["quote_authorization", "sms", "email"]),
        accepted: z.boolean()
      }
    },
    async (input) => {
      const result = await saveConsent(input);
      return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
    }
  );

  registerAppTool(
    app,
    "get_missing_quote_fields",
    {
      title: "Check quote completeness",
      description:
        "Read-only check of what information is still needed before a quote intake can be submitted for the active product line. Does not change any data. Renders the Asshield quote card progress view.",
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      _meta: quoteCardMeta(),
      inputSchema: { quote_id: z.string().uuid() }
    },
    async ({ quote_id }) => {
      const result = await getMissingFields(quote_id) as Record<string, unknown>;
      const enriched = withQuoteWidget(result, "progress");
      return toolTextResult(enriched);
    }
  );

  registerAppTool(
    app,
    "submit_quote",
    {
      title: "Submit quote request",
      description:
        "Send a completed quote intake to Asshield Insurance for a licensed agent to review via Asshield's lead webhook/email. Call get_missing_quote_fields first and confirm with the user before submitting. Submitting is a one-time outbound send; it does not bind, issue, or guarantee coverage or a price. Renders the Asshield quote confirmation card (reference number, agent will contact, no coverage bound) and agent contact details.",
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
      _meta: quoteCardMeta(),
      inputSchema: {
        quote_id: z.string().uuid(),
        notes: z.string().max(2000).optional()
      }
    },
    async (input) => {
      const result = await submitQuote(input) as Record<string, unknown>;
      const phase = result.submitted ? "confirmation" : "progress";
      const enriched = withQuoteWidget(result, phase);
      if (result.submitted) {
        enriched.agent = agentContactPayload();
        enriched.no_coverage_bound = true;
        enriched.agent_will_contact = true;
      }
      return toolTextResult(enriched);
    }
  );

  registerAppTool(
    app,
    "show_insurance_options",
    {
      title: "Show insurance options",
      description:
        "Read-only branded line picker for Asshield's 11 personal, commercial, and recreational insurance lines. Use when the user is unsure which product to start. Does not create a quote or bind coverage.",
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      _meta: optionsCardMeta(),
      inputSchema: {}
    },
    async () => {
      const options = listInsuranceOptions();
      return toolTextResult({
        ...options,
        message:
          "Asshield insurance options. Tap a line to start a quote request in a licensed state. Quote intake only — no coverage is bound."
      });
    }
  );

  registerAppTool(
    app,
    "explain_coverage",
    {
      title: "Explain coverage (general info)",
      description:
        "Read-only general coverage overview from Asshield's curated knowledge base for a product line: what it typically covers, common add-ons, what to have ready, and high-level state notes. Always general information — not advice or a quote. Offer to start a quote afterward. Does not invent specific state statutes.",
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      _meta: coverageCardMeta(),
      inputSchema: {
        product: productEnum,
        topic: z.string().max(500).optional()
      }
    },
    async (input) => {
      const explained = explainCoverage(input.product, input.topic);
      return toolTextResult({
        ...explained,
        agent_will_confirm: true,
        no_coverage_bound: true
      });
    }
  );

  registerAppTool(
    app,
    "get_agent_contact",
    {
      title: "Get Asshield agent contact",
      description:
        "Read-only Asshield Insurance agent contact card: agency name, Asshield licensed agents team, primary Lexington KY office phone/email/address, Fort Walton Beach FL office, agency licenses (KY/FL), office hours, website, licensed states, and NAIC license verification link. Optional booking URL appears only when configured. Does not book appointments or bind coverage.",
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      _meta: agentCardMeta(),
      inputSchema: {}
    },
    async () => {
      const agent = agentContactPayload();
      const structured = {
        agent,
        message:
          "Asshield Insurance agent contact. An agent can help with your quote request. No coverage is bound by viewing this card."
      };
      return toolTextResult(structured);
    }
  );

  return app;
}

function writeJsonRpcError(
  res: import("node:http").ServerResponse,
  status: number,
  code: number,
  message: string
): void {
  if (res.headersSent) return;
  res.writeHead(status, { "content-type": "application/json" });
  res.end(
    JSON.stringify({
      jsonrpc: "2.0",
      error: { code, message },
      id: null
    })
  );
}

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection (not exiting):", reason);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception (not exiting):", err);
});

const httpServer = createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        service: "asshield-insurance-mcp",
        store: config.useMemoryStore ? "memory" : "supabase",
        notifications_configured: notificationConfigured()
      })
    );
    return;
  }

  // OpenAI plugin portal domain verification. Set OPENAI_APPS_CHALLENGE_TOKEN
  // to the exact token shown in the portal; the response is the bare token.
  if (req.method === "GET" && req.url === "/.well-known/openai-apps-challenge") {
    const token = process.env.OPENAI_APPS_CHALLENGE_TOKEN?.trim();
    if (!token) {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("Not configured");
      return;
    }
    res.writeHead(200, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
    res.end(token);
    return;
  }

  if (req.url === "/mcp" || req.url?.startsWith("/mcp?")) {
    if (req.method === "GET" || req.method === "DELETE") {
      writeJsonRpcError(res, 405, -32000, "Method not allowed.");
      return;
    }

    if (req.method !== "POST") {
      writeJsonRpcError(res, 405, -32000, "Method not allowed.");
      return;
    }

    const server = createMcpServer();
    try {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined
      });

      res.on("close", () => {
        void transport.close();
        void server.close();
      });

      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch (error) {
      console.error("Error handling MCP request:", error);
      writeJsonRpcError(res, 500, -32603, "Internal server error");
      try {
        await server.close();
      } catch {
        // ignore cleanup errors
      }
    }
    return;
  }

  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

httpServer.listen(config.port, "0.0.0.0", () => {
  const storeMode = config.useMemoryStore ? "memory (./data/store.json)" : "supabase";
  console.log(`Asshield MCP server listening on http://localhost:${config.port}/mcp`);
  console.log(`Store mode: ${storeMode}`);
  console.log(`Lead notifications: ${notificationConfigured() ? "configured" : "NOT configured (set CRM_WEBHOOK_URL or email)"}`);
});
