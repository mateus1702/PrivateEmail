/**
 * Block explorer URLs for transaction/user-op hashes (optional VITE_EXPLORER_TX_URL_PREFIX).
 */

function normalizeHash(hash: string): string {
  const t = hash.trim();
  if (!/^0x[0-9a-fA-F]+$/.test(t)) return "";
  return t;
}

function normalizeAddress(address: string): string {
  const t = address.trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(t)) return "";
  return t.toLowerCase();
}

/**
 * Returns full explorer URL, or null if prefix is unset or hash is invalid.
 * Set VITE_EXPLORER_TX_URL_PREFIX to e.g. https://polygonscan.com/tx/ (trailing slash optional).
 */
export function getTxUrl(hash: string): string | null {
  const raw =
    typeof import.meta.env.VITE_EXPLORER_TX_URL_PREFIX === "string"
      ? import.meta.env.VITE_EXPLORER_TX_URL_PREFIX.trim()
      : "";
  if (!raw) return null;
  const h = normalizeHash(hash);
  if (!h) return null;
  const base = raw.endsWith("/") ? raw.slice(0, -1) : raw;
  return `${base}/${h}`;
}

/**
 * Returns full explorer URL for an EOA/contract address, or null if prefix is unset or address is invalid.
 * Set VITE_EXPLORER_ADDRESS_URL_PREFIX to e.g. https://polygonscan.com/address (trailing slash optional).
 */
export function getAddressUrl(address: string): string | null {
  const raw =
    typeof import.meta.env.VITE_EXPLORER_ADDRESS_URL_PREFIX === "string"
      ? import.meta.env.VITE_EXPLORER_ADDRESS_URL_PREFIX.trim()
      : "";
  if (!raw) return null;
  const a = normalizeAddress(address);
  if (!a) return null;
  const base = raw.endsWith("/") ? raw.slice(0, -1) : raw;
  return `${base}/${a}`;
}
