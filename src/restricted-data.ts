/** Server-side guard: never persist SSN, FEIN, DL numbers, cards, or passwords. */

const PATTERNS: { name: string; re: RegExp }[] = [
  { name: "SSN", re: /\b\d{3}-\d{2}-\d{4}\b/ },
  { name: "SSN", re: /\b(?:ssn|social\s*security(?:\s*number)?)\b[\s:#-]*\d{3}[\s-]?\d{2}[\s-]?\d{4}\b/i },
  { name: "FEIN", re: /\b\d{2}-\d{7}\b/ },
  { name: "FEIN", re: /\b(?:fein|ein|tax\s*id)\b[\s:#-]*\d{2}[\s-]?\d{7}\b/i },
  {
    name: "driver's license number",
    re: /\b(?:driver'?s?\s*license|dl)\s*(?:number|#|no\.?)?\s*[:#]?\s*[A-Z0-9]{5,}\b/i
  },
  { name: "payment card", re: /\b(?:\d[ -]*?){13,19}\b/ },
  { name: "password", re: /\bpassword\s*[:=]\s*\S+/i }
];

export class RestrictedDataError extends Error {
  readonly code = "restricted_data_refused";
  readonly matched: string;
  constructor(matched: string) {
    super(
      `Asshield refused to store restricted data (${matched}). Do not send SSN, FEIN, driver's license numbers, payment cards, or passwords. Quote intake does not need them.`
    );
    this.name = "RestrictedDataError";
    this.matched = matched;
  }
}

export function findRestrictedIdentifier(text: unknown): string | null {
  if (text == null) return null;
  const s = String(text);
  if (!s.trim()) return null;
  for (const { name, re } of PATTERNS) {
    if (re.test(s)) return name;
  }
  return null;
}

/** Scan every string field on a plain object (shallow + one nested level). */
export function assertNoRestrictedData(payload: Record<string, unknown>, fields?: string[]) {
  const keys = fields ?? Object.keys(payload);
  for (const k of keys) {
    const v = payload[k];
    if (typeof v === "string") {
      const hit = findRestrictedIdentifier(v);
      if (hit) throw new RestrictedDataError(hit);
    }
  }
}

export function restrictedDataRefusal(matched: string) {
  const message = new RestrictedDataError(matched).message;
  return {
    refused: true as const,
    code: "restricted_data_refused" as const,
    matched_type: matched,
    stored: false as const,
    message
  };
}
