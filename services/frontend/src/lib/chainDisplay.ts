/**
 * Human-readable chain names for smart-account / funding copy.
 */

/** Polygon mainnet */
const POLYGON = 137;
/** Polygon Amoy testnet */
const POLYGON_AMOY = 80002;
/** Common local dev chain ids */
const LOCAL_CHAIN_IDS = new Set([31337, 1337, 13371337]);

export function getSmartAccountChainLabel(chainId: number): string {
  if (chainId === POLYGON) return "Polygon";
  if (chainId === POLYGON_AMOY) return "Polygon Amoy";
  if (LOCAL_CHAIN_IDS.has(chainId)) return "Local";
  return `Chain ${chainId}`;
}
