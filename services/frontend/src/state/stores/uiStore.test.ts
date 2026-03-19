import { describe, it, expect, beforeEach } from "vitest";
import { useUiStore } from "./uiStore";

describe("uiStore", () => {
  beforeEach(() => {
    useUiStore.getState().resetCostModal();
    useUiStore.getState().setSendToast(false);
  });

  it("resetCostModal clears cost modal state", () => {
    useUiStore.getState().setCostModalOpen(true);
    useUiStore.getState().setCostModalQuote({} as never);
    useUiStore.getState().resetCostModal();
    const state = useUiStore.getState();
    expect(state.costModalOpen).toBe(false);
    expect(state.costModalQuote).toBeNull();
    expect(state.costModalAction).toBeNull();
    expect(state.costModalPreparedOp).toBeNull();
    expect(state.costModalPayload).toBeNull();
  });

  it("setSendToast updates toast state", () => {
    useUiStore.getState().setSendToast(true);
    expect(useUiStore.getState().sendToast).toBe(true);
    useUiStore.getState().setSendToast(false);
    expect(useUiStore.getState().sendToast).toBe(false);
  });

  it("auth modal step can be set", () => {
    useUiStore.getState().setAuthModalStep("register");
    expect(useUiStore.getState().authModalStep).toBe("register");
    useUiStore.getState().setAuthModalStep("login");
    expect(useUiStore.getState().authModalStep).toBe("login");
  });
});
