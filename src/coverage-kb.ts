import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { QuoteProduct } from "./types.js";
import { QUOTE_PRODUCTS } from "./types.js";

export type LineGroup = "personal" | "commercial" | "recreational";

export type LineKb = {
  id: QuoteProduct;
  label: string;
  group: LineGroup;
  icon: string;
  one_liner: string;
  covers: string[];
  common_add_ons: string[];
  what_to_have_ready: string[];
  cross_sell: string[];
};

type KbFile = {
  disclaimer: string;
  general_notes: string[];
  lines: Record<string, LineKb>;
};

const __dirname = dirname(fileURLToPath(import.meta.url));

let cached: KbFile | null = null;

function loadKb(): KbFile {
  if (cached) return cached;
  const raw = readFileSync(join(__dirname, "..", "data", "coverage-kb.json"), "utf8");
  cached = JSON.parse(raw) as KbFile;
  return cached;
}

export function getDisclaimer(): string {
  return loadKb().disclaimer;
}

export function getGeneralNotes(): string[] {
  return [...loadKb().general_notes];
}

export function getLineKb(product: string): LineKb | null {
  const line = loadKb().lines[product];
  return line ?? null;
}

export function listInsuranceOptions() {
  const kb = loadKb();
  const groups: { id: LineGroup; label: string; lines: LineKb[] }[] = [
    { id: "personal", label: "Personal", lines: [] },
    { id: "commercial", label: "Commercial", lines: [] },
    { id: "recreational", label: "Recreational", lines: [] }
  ];
  for (const id of QUOTE_PRODUCTS) {
    const line = kb.lines[id];
    if (!line) continue;
    const g = groups.find((x) => x.id === line.group);
    if (g) g.lines.push(line);
  }
  return {
    disclaimer: kb.disclaimer,
    groups,
    lines: groups.flatMap((g) => g.lines)
  };
}

export function explainCoverage(product: string, topic?: string) {
  const line = getLineKb(product);
  if (!line) {
    return {
      found: false as const,
      product,
      message: `No curated coverage overview for "${product}". Ask to see insurance options or start a quote for a supported line.`,
      disclaimer: getDisclaimer(),
      general_notes: getGeneralNotes()
    };
  }
  const topicNote =
    topic && topic.trim()
      ? `You asked about: ${topic.trim()}. Here is Asshield’s general overview; an agent will confirm details.`
      : undefined;
  return {
    found: true as const,
    product: line.id,
    label: line.label,
    group: line.group,
    icon: line.icon,
    one_liner: line.one_liner,
    covers: line.covers,
    common_add_ons: line.common_add_ons,
    what_to_have_ready: line.what_to_have_ready,
    cross_sell: line.cross_sell.filter((id) => Boolean(kbHas(id))),
    general_notes: getGeneralNotes(),
    disclaimer: getDisclaimer(),
    topic_note: topicNote,
    cta: "Offer to start a quote or show insurance options. Never claim coverage is bound."
  };
}

function kbHas(id: string): boolean {
  return Boolean(loadKb().lines[id]);
}

export const PRODUCT_LABELS: Record<string, string> = {
  auto: "Auto",
  home: "Home",
  auto_home: "Auto + Home",
  renters: "Renters",
  commercial_auto: "Commercial Auto",
  commercial_gl: "Commercial GL",
  workers_comp: "Workers' Comp",
  boat: "Boat",
  golf_cart: "Golf Cart",
  motorcycle: "Motorcycle",
  trucking: "Trucking"
};

export function productLabel(product: string | undefined | null): string {
  if (!product) return "Quote";
  return PRODUCT_LABELS[product] || product.replace(/_/g, " ");
}

export function checklistFor(product: string): string[] {
  return getLineKb(product)?.what_to_have_ready ?? [];
}

export function crossSellFor(product: string): LineKb[] {
  const line = getLineKb(product);
  if (!line) return [];
  return line.cross_sell
    .map((id) => getLineKb(id))
    .filter((x): x is LineKb => Boolean(x));
}
