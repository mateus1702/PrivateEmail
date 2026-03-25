/**
 * Structured logger with redaction. Never logs birthday, password, private keys,
 * plaintext, or ciphertext. Environment-gated (verbose in dev, quieter in prod).
 */

const SENSITIVE_KEYS = new Set([
  "birthday",
  "password",
  "confirmPassword",
  "ownerPrivateKeyHex",
  "privateKey",
  "plaintext",
  "ciphertext",
  "pubKeyHex",
  "aaPrivateKey",
  "referralAddress",
]);

const REDACTED = "[REDACTED]";

function isDev(): boolean {
  return import.meta.env?.DEV === true;
}

function redact(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(redact);
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    const keyLower = k.toLowerCase();
    if (SENSITIVE_KEYS.has(keyLower) || keyLower.includes("private") || keyLower.includes("secret")) {
      out[k] = REDACTED;
    } else {
      out[k] = redact(v);
    }
  }
  return out;
}

function formatPayload(...args: unknown[]): unknown[] {
  return args.map((a) => (typeof a === "object" && a != null ? redact(a) : a));
}

export const logger = {
  debug(...args: unknown[]): void {
    if (isDev()) {
      console.debug("[pm]", ...formatPayload(...args));
    }
  },

  info(...args: unknown[]): void {
    if (isDev()) {
      console.info("[pm]", ...formatPayload(...args));
    }
  },

  warn(...args: unknown[]): void {
    console.warn("[pm]", ...formatPayload(...args));
  },

  error(...args: unknown[]): void {
    console.error("[pm]", ...formatPayload(...args));
  },
};
