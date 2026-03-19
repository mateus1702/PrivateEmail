/**
 * Application use-case: submit a prepared UserOp to the bundler.
 */

import type { AaConfig } from "../lib/aa";
import { submitPreparedUserOp } from "../lib/aa";

export async function submitPreparedOperation(
  aaConfig: AaConfig,
  preparedUserOp: Record<string, unknown>,
  ownerPrivateKeyHex: `0x${string}`
): Promise<`0x${string}`> {
  return submitPreparedUserOp(aaConfig, preparedUserOp, ownerPrivateKeyHex);
}
