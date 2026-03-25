import { describe, it, expect, beforeEach } from "vitest";
import { useSessionStore } from "./sessionStore";

describe("sessionStore", () => {
  beforeEach(() => {
    useSessionStore.getState().logout();
  });

  it("starts with null session", () => {
    const state = useSessionStore.getState();
    expect(state.sessionAddress).toBeNull();
    expect(state.sessionOwnerPrivateKeyHex).toBeNull();
  });

  it("login sets session address and owner key", () => {
    const addr = "0x1234567890123456789012345678901234567890";
    const ownerHex = "0xabcd" as `0x${string}`;
    useSessionStore.getState().login(addr, ownerHex);
    const state = useSessionStore.getState();
    expect(state.sessionAddress).toBe(addr);
    expect(state.sessionOwnerPrivateKeyHex).toBe(ownerHex);
  });

  it("logout clears session", () => {
    useSessionStore.getState().login("0x1234", "0xabcd" as `0x${string}`);
    useSessionStore.getState().logout();
    const state = useSessionStore.getState();
    expect(state.sessionAddress).toBeNull();
    expect(state.sessionOwnerPrivateKeyHex).toBeNull();
  });
});
