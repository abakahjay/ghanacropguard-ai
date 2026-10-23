/** Formatting that never throws on missing data: a missing value prints as an en dash. */
export const DASH = "–";

export function pctOr(v, digits = 1) {
  return typeof v === "number" && Number.isFinite(v) ? `${(v * 100).toFixed(digits)}%` : DASH;
}

export function numOr(v, digits = 3) {
  return typeof v === "number" && Number.isFinite(v) ? v.toFixed(digits) : DASH;
}

export function intOr(v) {
  return typeof v === "number" && Number.isFinite(v) ? v.toLocaleString("en-GB") : DASH;
}
