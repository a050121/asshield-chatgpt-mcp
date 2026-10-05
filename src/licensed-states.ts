/**
 * States where Asshield Insurance is licensed to serve clients.
 * Source: docs/TERMS_AND_SUPPORT_PAGES_FINAL.md and live terms page
 * (AL, AR, FL, GA, IN, KY, NC, OH, PA, SC, TN, TX).
 * Product availability still varies by ZIP and carrier.
 */
export const LICENSED_STATES = [
  "AL",
  "AR",
  "FL",
  "GA",
  "IN",
  "KY",
  "NC",
  "OH",
  "PA",
  "SC",
  "TN",
  "TX"
] as const;

export type LicensedState = (typeof LICENSED_STATES)[number];

const licensedSet = new Set<string>(LICENSED_STATES);

export function isLicensedState(state: string): boolean {
  return licensedSet.has(state.trim().toUpperCase());
}

export function licensedStatesMessage(): string {
  return (
    "Asshield currently serves Alabama, Arkansas, Florida, Georgia, Indiana, " +
    "Kentucky, North Carolina, Ohio, Pennsylvania, South Carolina, Tennessee, " +
    "and Texas. Product availability can still vary by ZIP and carrier."
  );
}
