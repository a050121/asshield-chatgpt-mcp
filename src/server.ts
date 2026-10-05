import { createServer } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { config } from "./config.js";
import {
  startQuote,
  saveContact,
  addDriver,
  addVehicle,
  saveCurrentPolicy,
  saveConsent,
  getMissingFields,
  submitQuote
} from "./quote-service.js";
import { notificationConfigured } from "./notify.js";

function createMcpServer(): McpServer {
  const app = new McpServer(
    {
      name: "asshield-insurance",
      version: "0.2.0"
    },
    {
      instructions:
        "Help users start and complete insurance quote intake for Asshield Insurance for Auto, Home, Auto+Home, or Renters. Never state that coverage is bound or effective. Only start quotes for licensed states (AL, AR, FL, GA, IN, KY, NC, OH, PA, SC, TN, TX); for other states explain Asshield cannot write there and do not submit. Before submitting, call get_missing_quote_fields. Never collect SSN, driver's license numbers, payment cards, or passwords."
    }
  );

  app.registerTool(
    "start_quote",
    {
      title: "Start an Asshield quote",
      description:
        "Start a new insurance quote intake for Auto, Home, Auto + Home, or Renters in a state where Asshield is licensed (AL, AR, FL, GA, IN, KY, NC, OH, PA, SC, TN, TX). If the state is outside that list, returns a polite unsupported message and does not create a quote. Does not bind coverage or return a price.",
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false
      },
      inputSchema: {
        product: z.enum(["auto", "home", "auto_home", "renters"]),
        state: z.string().length(2),
        zip: z.string().regex(/^\d{5}(-\d{4})?$/)
      }
    },
    async (input) => {
      const result = await startQuote(input);
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        structuredContent: result
      };
    }
  );

  app.registerTool(
    "save_contact",
    {
      title: "Save quote contact",
      description:
        "Save the customer's name and preferred contact details for an active Asshield quote. Collect only name plus at least one reachable phone or email. Do not collect SSN, driver's license numbers, payment cards, or passwords.",
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false
      },
      inputSchema: {
        quote_id: z.string().uuid(),
        first_name: z.string().min(1),
        last_name: z.string().min(1),
        phone: z.string().min(7).optional(),
        email: z.string().email().optional(),
        preferred_contact_method: z.enum(["call", "text", "email"]).optional()
      }
    },
    async (input) => {
      const result = await saveContact(input);
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        structuredContent: result
      };
    }
  );

  app.registerTool(
    "add_driver",
    {
      title: "Add driver",
      description:
        "Add a driver to an active auto quote. Do not request or return a driver's license number in this MVP.",
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false
      },
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
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        structuredContent: result
      };
    }
  );

  app.registerTool(
    "add_vehicle",
    {
      title: "Add vehicle",
      description:
        "Add a vehicle to an active auto quote (year, make, model; VIN and usage details optional). Do not collect payment or financing account numbers.",
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false
      },
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
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        structuredContent: result
      };
    }
  );

  app.registerTool(
    "save_current_policy",
    {
      title: "Save current policy",
      description:
        "Save the customer's current carrier, premium, renewal date, and main coverage limits/deductibles for comparison. Optional fields only; skip anything the customer does not know.",
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false
      },
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
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        structuredContent: result
      };
    }
  );

  app.registerTool(
    "save_consent",
    {
      title: "Save consent",
      description:
        "Record a customer's affirmative consent. Never infer consent; accepted must reflect an explicit user choice.",
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false
      },
      inputSchema: {
        quote_id: z.string().uuid(),
        consent_type: z.enum(["quote_authorization", "sms", "email"]),
        accepted: z.boolean()
      }
    },
    async (input) => {
      const result = await saveConsent(input);
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        structuredContent: result
      };
    }
  );

  app.registerTool(
    "get_missing_quote_fields",
    {
      title: "Check quote completeness",
      description:
        "Read-only check of what information is still needed before a quote intake can be submitted. Does not change any data.",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false
      },
      inputSchema: {
        quote_id: z.string().uuid()
      }
    },
    async ({ quote_id }) => {
      const result = await getMissingFields(quote_id);
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        structuredContent: result
      };
    }
  );

  app.registerTool(
    "submit_quote",
    {
      title: "Submit quote request",
      description:
        "Send a completed quote intake to Asshield Insurance for a licensed agent to review. Call get_missing_quote_fields first and confirm with the user before submitting. Submitting is a one-time send; it does not bind, issue, or guarantee coverage or a price.",
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: false
      },
      inputSchema: {
        quote_id: z.string().uuid(),
        notes: z.string().max(2000).optional()
      }
    },
    async (input) => {
      const result = await submitQuote(input);
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        structuredContent: result
      };
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
