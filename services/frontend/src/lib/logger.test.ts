/**
 * Unit tests for structured logger redaction and level behavior.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logger } from "./logger";

describe("logger", () => {
  let consoleDebugSpy: ReturnType<typeof vi.spyOn>;
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleDebugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleDebugSpy.mockRestore();
    consoleInfoSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it("redacts sensitive keys in objects", () => {
    logger.debug("Cost modal", {
      estimatedBaseCostUsdcE6: "100",
      password: "secret123",
      ownerPrivateKeyHex: "0xabc",
    });
    expect(consoleDebugSpy).toHaveBeenCalledTimes(1);
    const [prefix, ...rest] = consoleDebugSpy.mock.calls[0] ?? [];
    expect(prefix).toBe("[pm]");
    const payload = rest[1] as Record<string, unknown>;
    expect(payload?.estimatedBaseCostUsdcE6).toBe("100");
    expect(payload?.password).toBe("[REDACTED]");
    expect(payload?.ownerPrivateKeyHex).toBe("[REDACTED]");
  });

  it("redacts keys containing 'private' or 'secret'", () => {
    logger.debug("Data", { privateKey: "0x123", apiSecret: "key" });
    const payload = (consoleDebugSpy.mock.calls[0] ?? [])[2] as Record<string, unknown>;
    expect(payload?.privateKey).toBe("[REDACTED]");
    expect(payload?.apiSecret).toBe("[REDACTED]");
  });

  it("does not redact non-sensitive keys", () => {
    logger.debug("Quote", {
      estimatedTotalCostUsdcE6: "150",
      validUntil: "1234567890",
    });
    const payload = (consoleDebugSpy.mock.calls[0] ?? [])[2] as Record<string, unknown>;
    expect(payload?.estimatedTotalCostUsdcE6).toBe("150");
    expect(payload?.validUntil).toBe("1234567890");
  });

  it("warn and error always log regardless of env", () => {
    logger.warn("Warning message");
    logger.error("Error message");
    expect(consoleWarnSpy).toHaveBeenCalledWith("[pm]", "Warning message");
    expect(consoleErrorSpy).toHaveBeenCalledWith("[pm]", "Error message");
  });
});
