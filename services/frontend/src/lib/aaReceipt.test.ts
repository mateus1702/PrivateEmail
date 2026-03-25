/**
 * UserOperation receipt success assertion (bundler execution outcome).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { assertUserOperationReceiptSucceeded } from "./aa";
import { GENERIC_ONCHAIN } from "./userFacingError";

const HASH = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as `0x${string}`;

function baseReceipt(
  overrides: Partial<{
    success: boolean;
    reason: string | undefined;
    status: "success" | "reverted";
  }> = {}
) {
  const { success = true, reason = undefined, status = "success" } = overrides;
  return {
    success,
    reason,
    userOpHash: HASH,
    sender: "0x1111111111111111111111111111111111111111" as const,
    nonce: 0n,
    entryPoint: "0x2222222222222222222222222222222222222222" as const,
    actualGasUsed: 1n,
    actualGasCost: 2n,
    logs: [],
    receipt: {
      status,
      transactionHash: HASH,
      blockHash: HASH,
      blockNumber: 1n,
      contractAddress: null,
      cumulativeGasUsed: 1n,
      effectiveGasPrice: 1n,
      from: "0x3333333333333333333333333333333333333333" as const,
      gasUsed: 1n,
      logs: [],
      logsBloom: "0x" + "0".repeat(512),
      root: undefined,
      to: null,
      transactionIndex: 0,
      type: "eip1559",
    },
  } as const;
}

describe("assertUserOperationReceiptSucceeded", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("no-ops when receipt is null or undefined", () => {
    expect(() => assertUserOperationReceiptSucceeded(null, HASH)).not.toThrow();
    expect(() => assertUserOperationReceiptSucceeded(undefined, HASH)).not.toThrow();
  });

  it("no-ops when success is true and tx status is not reverted", () => {
    expect(() =>
      assertUserOperationReceiptSucceeded(baseReceipt({ success: true, status: "success" }) as never, HASH)
    ).not.toThrow();
  });

  it("throws GENERIC_ONCHAIN and logs when success is false", () => {
    expect(() =>
      assertUserOperationReceiptSucceeded(
        baseReceipt({ success: false, reason: "revert: OOG" }) as never,
        HASH
      )
    ).toThrow(GENERIC_ONCHAIN);
    expect(console.error).toHaveBeenCalled();
  });

  it("throws when inner receipt status is reverted even if success flag is true", () => {
    expect(() =>
      assertUserOperationReceiptSucceeded(baseReceipt({ success: true, status: "reverted" }) as never, HASH)
    ).toThrow(GENERIC_ONCHAIN);
  });
});
