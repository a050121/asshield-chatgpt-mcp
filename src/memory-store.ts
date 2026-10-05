import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

const STORE_PATH = resolve("./data/store.json");

type Row = Record<string, unknown>;

interface StoreData {
  quotes: Row[];
  customers: Row[];
  drivers: Row[];
  vehicles: Row[];
  current_policies: Row[];
  consents: Row[];
  activities: Row[];
}

const EMPTY: StoreData = {
  quotes: [],
  customers: [],
  drivers: [],
  vehicles: [],
  current_policies: [],
  consents: [],
  activities: []
};

function load(): StoreData {
  try {
    if (!existsSync(STORE_PATH)) return structuredClone(EMPTY);
    const raw = readFileSync(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<StoreData>;
    return {
      quotes: parsed.quotes ?? [],
      customers: parsed.customers ?? [],
      drivers: parsed.drivers ?? [],
      vehicles: parsed.vehicles ?? [],
      current_policies: parsed.current_policies ?? [],
      consents: parsed.consents ?? [],
      activities: parsed.activities ?? []
    };
  } catch {
    return structuredClone(EMPTY);
  }
}

function save(data: StoreData): void {
  mkdirSync(dirname(STORE_PATH), { recursive: true });
  writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), "utf8");
}

function pick<T extends Row>(row: T, fields?: string[]): Partial<T> | T {
  if (!fields || fields.length === 0 || fields.includes("*")) return row;
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    if (f in row) out[f] = row[f];
  }
  return out as Partial<T>;
}

class MemoryStore {
  private data: StoreData;

  constructor() {
    this.data = load();
  }

  private persist() {
    save(this.data);
  }

  insert(table: keyof StoreData, row: Row, selectFields?: string[]): Row {
    const now = new Date().toISOString();
    const record: Row = {
      id: randomUUID(),
      created_at: now,
      ...row
    };
    this.data[table].push(record);
    this.persist();
    return pick(record, selectFields) as Row;
  }

  update(
    table: keyof StoreData,
    id: string,
    patch: Row,
    selectFields?: string[]
  ): Row | null {
    const list = this.data[table];
    const idx = list.findIndex((r) => r.id === id);
    if (idx < 0) return null;
    const updated: Row = {
      ...list[idx],
      ...patch,
      updated_at: new Date().toISOString()
    };
    list[idx] = updated;
    this.persist();
    return pick(updated, selectFields) as Row;
  }

  getById(table: keyof StoreData, id: string, selectFields?: string[]): Row | null {
    const row = this.data[table].find((r) => r.id === id);
    if (!row) return null;
    return pick(row, selectFields) as Row;
  }

  listByQuoteId(
    table: keyof StoreData,
    quoteId: string,
    selectFields?: string[]
  ): Row[] {
    return this.data[table]
      .filter((r) => r.quote_id === quoteId)
      .map((r) => pick(r, selectFields) as Row);
  }
}

export const memoryStore = new MemoryStore();
