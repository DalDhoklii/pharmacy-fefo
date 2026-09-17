// Extracts a positive integer from messy quantity input like "10 units", "10", 10
export function parseQuantity(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") {
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : null;
  }
  if (typeof raw === "string") {
    const match = raw.match(/\d+/);
    if (!match) return null;
    const n = parseInt(match[0], 10);
    return n > 0 ? n : null;
  }
  return null;
}

// Accepts ISO (YYYY-MM-DD or full ISO) or dd/mm/yyyy, returns a valid Date or null
export function parseFlexibleDate(raw: unknown): Date | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw !== "string") return null;

  // Try dd/mm/yyyy first (has slashes)
  const ddmmyyyy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmmyyyy) {
    const [, dd, mm, yyyy] = ddmmyyyy;
    const day = parseInt(dd, 10);
    const month = parseInt(mm, 10);
    const year = parseInt(yyyy, 10);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const date = new Date(Date.UTC(year, month - 1, day));
    // Validate the date actually exists (e.g. rejects 31/02/2026)
    if (date.getUTCMonth() !== month - 1) return null;
    return date;
  }

  // Fall back to ISO / anything Date can natively parse
  const parsed = new Date(raw);
  if (isNaN(parsed.getTime())) return null;
  return parsed;
}