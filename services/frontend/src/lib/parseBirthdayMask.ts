/**
 * Format raw input as MM/DD/YYYY mask.
 */
export function formatBirthdayInput(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
}

/**
 * Parse MM/DD/YYYY masked string to Unix UTC midnight.
 * Returns null if invalid or incomplete.
 */
const BIRTHDAY_MIN = -86400 * 365 * 130; // ~1900
const BIRTHDAY_MAX = Math.floor(Date.now() / 1000) - 86400 * 365 * 10; // ~10 years ago

export function parseBirthdayMask(value: string): number | null {
  const trimmed = value.replace(/\s/g, "");
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, monthStr, dayStr, yearStr] = match;
  const month = parseInt(monthStr!, 10);
  const day = parseInt(dayStr!, 10);
  const year = parseInt(yearStr!, 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const ts = Math.floor(new Date(Date.UTC(year, month - 1, day)).getTime() / 1000);
  if (ts < BIRTHDAY_MIN || ts > BIRTHDAY_MAX) return null;
  return ts;
}
