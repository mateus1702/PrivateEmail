import { describe, it, expect, beforeEach } from "vitest";
import { useGlobalLoadingStore, runBlocking } from "./globalLoadingStore";

describe("globalLoadingStore", () => {
  beforeEach(() => {
    useGlobalLoadingStore.setState({
      blockingCount: 0,
      silentInboxPollActive: false,
    });
  });

  it("increments and decrements blockingCount", () => {
    const { beginBlocking, endBlocking } = useGlobalLoadingStore.getState();
    beginBlocking();
    beginBlocking();
    expect(useGlobalLoadingStore.getState().blockingCount).toBe(2);
    endBlocking();
    expect(useGlobalLoadingStore.getState().blockingCount).toBe(1);
    endBlocking();
    expect(useGlobalLoadingStore.getState().blockingCount).toBe(0);
  });

  it("clamps blockingCount at zero on endBlocking", () => {
    useGlobalLoadingStore.getState().endBlocking();
    expect(useGlobalLoadingStore.getState().blockingCount).toBe(0);
  });

  it("resetBlocking clears count", () => {
    useGlobalLoadingStore.getState().beginBlocking();
    useGlobalLoadingStore.getState().resetBlocking();
    expect(useGlobalLoadingStore.getState().blockingCount).toBe(0);
  });

  it("setSilentInboxPollActive toggles flag", () => {
    useGlobalLoadingStore.getState().setSilentInboxPollActive(true);
    expect(useGlobalLoadingStore.getState().silentInboxPollActive).toBe(true);
    useGlobalLoadingStore.getState().setSilentInboxPollActive(false);
    expect(useGlobalLoadingStore.getState().silentInboxPollActive).toBe(false);
  });

  it("runBlocking decrements even when fn throws", async () => {
    await expect(
      runBlocking(async () => {
        throw new Error("fail");
      })
    ).rejects.toThrow("fail");
    expect(useGlobalLoadingStore.getState().blockingCount).toBe(0);
  });

  it("runBlocking returns result on success", async () => {
    const v = await runBlocking(async () => 42);
    expect(v).toBe(42);
    expect(useGlobalLoadingStore.getState().blockingCount).toBe(0);
  });
});
