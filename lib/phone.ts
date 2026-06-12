// Lightweight, dependency-free phone normalization to E.164-ish form (+<cc><national>).
//
// We deliberately avoid libphonenumber: our rule is deterministic and best-effort,
// not full validation. The region (ISO-3166 alpha-2, e.g. "IN") supplies the
// default country calling code when a number is written locally.
//
// Rule (per product spec):
//   - Already has a country code (leading "+", or digits starting with the
//     region's calling code and longer than a national number) -> keep, ensure "+".
//   - Leading "0" (national trunk prefix) -> strip the zero(s), prepend "+<cc>".
//   - Plain national number -> prepend "+<cc>".
//   - Can't make anything usable -> null (caller keeps raw / leaves empty).

export type RegionConfig = {
  /** Country calling code, digits only (no "+"). */
  callingCode: string;
  /** Typical national (subscriber) number length, used to detect embedded cc. */
  nationalLength: number;
  /** ISO-3166 alpha-2 country, stored on the contact. */
  country: string;
  /** IANA timezone when the country has a single one; null when ambiguous. */
  timezone: string | null;
};

// Add regions as we target them. Single-timezone countries get a timezone;
// multi-timezone countries (US) leave it null (derive from state/city later).
export const REGIONS: Record<string, RegionConfig> = {
  IN: { callingCode: "91", nationalLength: 10, country: "IN", timezone: "Asia/Kolkata" },
  US: { callingCode: "1", nationalLength: 10, country: "US", timezone: null },
  CA: { callingCode: "1", nationalLength: 10, country: "CA", timezone: null },
  GB: { callingCode: "44", nationalLength: 10, country: "GB", timezone: "Europe/London" },
  AU: { callingCode: "61", nationalLength: 9, country: "AU", timezone: null },
  AE: { callingCode: "971", nationalLength: 9, country: "AE", timezone: "Asia/Dubai" },
  SG: { callingCode: "65", nationalLength: 8, country: "SG", timezone: "Asia/Singapore" },
};

export const DEFAULT_REGION = "IN";

export function resolveRegion(region?: string | null): RegionConfig {
  const key = (region ?? "").trim().toUpperCase();
  return REGIONS[key] ?? REGIONS[DEFAULT_REGION];
}

/** Geo defaults (country + timezone) derived from a region, for contact fields. */
export function regionGeoDefaults(region?: string | null): {
  country: string;
  timezone: string | null;
} {
  const cfg = resolveRegion(region);
  return { country: cfg.country, timezone: cfg.timezone };
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

// Normalizes a phone to "+<cc><national>". `region` selects the default calling
// code for locally-written numbers. Returns null when there's nothing usable.
export function normalizePhone(
  value: unknown,
  region?: string | null,
): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const cfg = resolveRegion(region);

  // Explicit international form: trust the country code, just clean it.
  if (trimmed.startsWith("+")) {
    const d = digitsOnly(trimmed);
    return d ? `+${d}` : null;
  }

  let digits = digitsOnly(trimmed);
  if (!digits) return null;

  // National trunk prefix: drop leading zero(s), then prepend the calling code.
  if (digits.startsWith("0")) {
    digits = digits.replace(/^0+/, "");
    if (!digits) return null;
    return `+${cfg.callingCode}${digits}`;
  }

  // Country code embedded without "+": e.g. "91 97361 96250". Only when the
  // number is longer than a bare national number (so we don't mistake a
  // national number that happens to start with the calling code's digits).
  if (
    cfg.callingCode &&
    digits.startsWith(cfg.callingCode) &&
    digits.length > cfg.nationalLength
  ) {
    return `+${digits}`;
  }

  // Plain national number -> prepend the region's calling code.
  return `+${cfg.callingCode}${digits}`;
}

// Variants to match legacy rows (10-digit national, 0-prefix, cc without +) when
// deduplicating against contacts.phone after E.164 normalization.
export function phoneLookupVariants(
  e164: string,
  region?: string | null,
): string[] {
  const cfg = resolveRegion(region);
  const variants = new Set<string>([e164]);

  const d = digitsOnly(e164);
  if (!d) return [...variants];

  variants.add(d); // digits without +

  if (d.startsWith(cfg.callingCode)) {
    const national = d.slice(cfg.callingCode.length);
    if (national) {
      variants.add(national);
      variants.add(`0${national}`);
      variants.add(`+${cfg.callingCode}${national}`);
      variants.add(`${cfg.callingCode}${national}`);
    }
  }

  return [...variants];
}
