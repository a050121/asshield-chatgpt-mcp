import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const port = 8798;
const child = spawn("node", ["./node_modules/tsx/dist/cli.mjs", "src/server.ts"], {
  env: { ...process.env, PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"]
});
await sleep(1800);

async function rpc(method, params, id = 1) {
  const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream"
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params })
  });
  const raw = await res.text();
  if (raw.includes("data:")) {
    for (const line of raw.split("\n")) {
      if (line.startsWith("data:")) return JSON.parse(line.slice(5).trim());
    }
  }
  return JSON.parse(raw);
}

try {
  await rpc("initialize", {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "smoke", version: "0" }
  });
  const tools = await rpc("tools/list", {}, 2);
  const names = tools.result.tools.map((t) => t.name);
  if (names.length !== 11) throw new Error(`expected 11 tools, got ${names.length}: ${names}`);
  if (!names.includes("get_agent_contact")) throw new Error("missing get_agent_contact");
  const start = tools.result.tools.find((t) => t.name === "start_quote");
  if (!start._meta?.["openai/outputTemplate"]) throw new Error("start_quote missing outputTemplate");
  const res = await rpc("resources/list", {}, 3);
  if (res.result.resources.length < 2) throw new Error("expected >=2 resources");
  console.log("smoke OK", names.join(","));
  process.exitCode = 0;
} catch (e) {
  console.error("smoke FAIL", e);
  process.exitCode = 1;
} finally {
  child.kill("SIGTERM");
}
