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
    // Do not echo the restricted value — only the category.
    super(
      `Asshield does not collect ${matched}. That value was not stored. You can continue the quote without it.`
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

/** Strip restricted identifiers from string fields (replace with empty). Returns whether anything was stripped. */
export function stripRestrictedData(
  payload: Record<string, unknown>,
  fields?: string[]
): { stripped: boolean; matched: string | null; clean: Record<string, unknown> } {
  const keys = fields ?? Object.keys(payload);
  const clean: Record<string, unknown> = { ...payload };
  let matched: string | null = null;
  let stripped = false;
  for (const k of keys) {
    const v = clean[k];
    if (typeof v === "string") {
      const hit = findRestrictedIdentifier(v);
      if (hit) {
        matched = matched || hit;
        clean[k] = "";
        stripped = true;
      }
    }
  }
  return { stripped, matched, clean };
}

/** Scan fields; throw without including the raw value in logs/messages. */
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
  return {
    ok: true as const,
    collected: false as const,
    refused: true as const,
    code: "restricted_data_not_collected" as const,
    matched_type: matched,
    stored: false as const,
    message: `Asshield does not collect ${matched}. That value was not stored. You can continue the quote without it.`
  };
}
