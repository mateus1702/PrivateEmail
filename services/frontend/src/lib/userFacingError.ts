/**
 * Maps unexpected chain/RPC errors to a single reassuring toast message.
 * Known validation and config messages pass through unchanged.
 */

/** Thrown by chain submission paths; keep in sync with PASS_THROUGH / formatGlobalErrorToast. */
export const GENERIC_ONCHAIN =
  "Something broke on-chain. Try again or refresh – your data is safe.";

const PASS_THROUGH_SUBSTRINGS = [
  "Missing required env",
  "Invalid VITE_",
  "Invalid VITE_PRIVATE_MAIL_ADDRESS",
  "Set all required VITE_",
  "Enter birthday",
  "Password needs 8+",
  "Passwords do not match",
  "App config is still loading",
  "Session ended. Re-derive",
  "Please enter a recipient username",
  "Please enter a message",
  "Enter recipient by username only",
  "Invalid recipient",
  "username not found",
  "Recipient has not registered a public key",
  "Bundler and Paymaster URLs required",
  "Unable to copy automatically",
  "Anvil whale funding not available",
  "No whale with enough USDC",
  "Could not verify USDC balance",
  "smart account needs at least",
  "Please enter a username",
  "Already registered",
  "Username is already taken",
  "Missing session key",
  "Transfer failed:",
  "Something broke on-chain",
] as const;

export function formatGlobalErrorToast(message: string): string {
  const m = message.trim();
  if (!m) return m;
  for (const s of PASS_THROUGH_SUBSTRINGS) {
    if (m.includes(s)) return message;
  }
  return GENERIC_ONCHAIN;
}
