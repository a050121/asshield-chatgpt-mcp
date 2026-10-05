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

const app = new McpServer(
  {
    name: "asshield-insurance",
    version: "0.1.0"
  },
  {
    instructions:
      "Help users start and complete insurance quote intake for Asshield Insurance. Never state that coverage is bound or effective. Before submitting a quote, call get_missing_quote_fields. Collect only information needed for the active quote."
  }
);

app.registerTool(
  "start_quote",
  {
    title: "Start an Asshield quote",
    description:
      "Start a new insurance quote intake for Auto, Home, Auto + Home, or Renters.",
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
    description: "Save the customer's contact information for an active Asshield quote.",
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
    description: "Add a vehicle to an active auto quote.",
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
      "Save the customer's current carrier, premium, renewal date, and main coverage details.",
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
      "Check what information is still needed before a quote can be submitted.",
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
      "Submit a completed quote intake to Asshield. This does not bind coverage.",
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

const httpServer = createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, service: "asshield-insurance-mcp" }));
    return;
  }

  if (req.url === "/mcp") {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined
    });

    res.on("close", () => {
      transport.close();
    });

    await app.connect(transport);
    await transport.handleRequest(req, res);
    return;
  }

  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

httpServer.listen(config.port, "0.0.0.0", () => {
  const storeMode = config.useMemoryStore ? "memory (./data/store.json)" : "supabase";
  console.log(`Asshield MCP server listening on http://localhost:${config.port}/mcp`);
  console.log(`Store mode: ${storeMode}`);
});
