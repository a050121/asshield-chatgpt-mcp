import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const MCP_URL = process.env.MCP_URL || "http://localhost:8787/mcp";
const CALL_TOOLS = process.env.CALL_TOOLS !== "0";

async function runClient(label) {
  const client = new Client({ name: `verify-${label}`, version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL));
  await client.connect(transport);
  console.log(`[${label}] connected / initialized`);

  const tools = await client.listTools();
  console.log(`[${label}] tools/list count=${tools.tools.length} names=${tools.tools.map((t) => t.name).join(",")}`);

  let quoteId = null;
  if (CALL_TOOLS) {
    const start = await client.callTool({
      name: "start_quote",
      arguments: { product: "auto", state: "KY", zip: "40502" }
    });
    const startText = start.content?.[0]?.text || JSON.stringify(start);
    console.log(`[${label}] start_quote ok: ${startText.slice(0, 200)}`);
    try {
      const parsed = JSON.parse(start.content[0].text);
      quoteId = parsed.quote?.id || parsed.quote_id || parsed.quoteId || parsed.id;
    } catch {
      quoteId = start.structuredContent?.quote_id;
    }
    if (!quoteId) throw new Error(`[${label}] no quote_id from start_quote`);

    const missing = await client.callTool({
      name: "get_missing_quote_fields",
      arguments: { quote_id: quoteId }
    });
    console.log(`[${label}] get_missing_quote_fields ok: ${(missing.content?.[0]?.text || "").slice(0, 200)}`);
  }

  await client.close();
  console.log(`[${label}] closed cleanly`);
  return { label, quoteId, toolCount: tools.tools.length };
}

async function main() {
  console.log(`Target: ${MCP_URL} CALL_TOOLS=${CALL_TOOLS}`);
  // (a) persistent client with multiple ops on same connection
  const a = await runClient("persistent-a");

  // (b) two concurrent clients
  const [b1, b2] = await Promise.all([runClient("concurrent-1"), runClient("concurrent-2")]);

  // health still up
  const healthUrl = MCP_URL.replace(/\/mcp\/?$/, "/health");
  const health = await fetch(healthUrl).then((r) => r.json());
  console.log("health after tests:", JSON.stringify(health));
  if (!health.ok) throw new Error("health not ok after tests");

  console.log("ALL_OK", JSON.stringify({ a, b1, b2, health }));
}

main().catch((err) => {
  console.error("VERIFY_FAILED", err);
  process.exit(1);
});
