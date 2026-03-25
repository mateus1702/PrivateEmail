import { describe, it, expect, vi, afterEach } from "vitest";
import { getTxUrl, getAddressUrl } from "./explorerLinks";

describe("getTxUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns null when prefix is unset", () => {
    vi.stubEnv("VITE_EXPLORER_TX_URL_PREFIX", "");
    expect(getTxUrl("0x" + "a".repeat(64))).toBeNull();
  });

  it("joins prefix and hash", () => {
    vi.stubEnv("VITE_EXPLORER_TX_URL_PREFIX", "https://polygonscan.com/tx/");
    const h = "0x" + "b".repeat(64);
    expect(getTxUrl(h)).toBe(`https://polygonscan.com/tx/${h}`);
  });
});

describe("getAddressUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns null when prefix is unset", () => {
    vi.stubEnv("VITE_EXPLORER_ADDRESS_URL_PREFIX", "");
    expect(getAddressUrl("0x" + "a".repeat(40))).toBeNull();
  });

  it("joins prefix and checksummed address as lowercase", () => {
    vi.stubEnv("VITE_EXPLORER_ADDRESS_URL_PREFIX", "https://polygonscan.com/address/");
    const a = "0xABCDEFabcdef1234567890123456789012345678";
    expect(getAddressUrl(a)).toBe(
      "https://polygonscan.com/address/0xabcdefabcdef1234567890123456789012345678"
    );
  });

  it("returns null for invalid address", () => {
    vi.stubEnv("VITE_EXPLORER_ADDRESS_URL_PREFIX", "https://polygonscan.com/address/");
    expect(getAddressUrl("not-an-address")).toBeNull();
  });
});
