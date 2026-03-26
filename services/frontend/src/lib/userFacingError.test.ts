import { describe, it, expect } from "vitest";
import { formatGlobalErrorToast, GENERIC_ONCHAIN } from "./userFacingError";

describe("formatGlobalErrorToast", () => {
  it("passes through compose recipient / username errors", () => {
    expect(formatGlobalErrorToast("Invalid recipient: username not found")).toBe(
      "Invalid recipient: username not found"
    );
    expect(formatGlobalErrorToast("Recipient has not registered a public key")).toBe(
      "Recipient has not registered a public key"
    );
  });

  it("maps unknown errors to generic on-chain copy", () => {
    expect(formatGlobalErrorToast("execution reverted (0xdeadbeef)")).toBe(GENERIC_ONCHAIN);
  });
});
