/**
 * Global full-screen loading overlay: blocking operation counter and inbox poll flag.
 * When adding useQuery/useMutation or new async UI flows, update overlay policy (blocking vs silent) in review.
 */

import { create } from "zustand";

export interface GlobalLoadingState {
  blockingCount: number;
  silentInboxPollActive: boolean;
  beginBlocking: () => void;
  endBlocking: () => void;
  resetBlocking: () => void;
  setSilentInboxPollActive: (v: boolean) => void;
}

export const useGlobalLoadingStore = create<GlobalLoadingState>((set) => ({
  blockingCount: 0,
  silentInboxPollActive: false,

  beginBlocking: () => set((s) => ({ blockingCount: s.blockingCount + 1 })),

  endBlocking: () =>
    set((s) => ({ blockingCount: Math.max(0, s.blockingCount - 1) })),

  resetBlocking: () => set({ blockingCount: 0 }),

  setSilentInboxPollActive: (v) => set({ silentInboxPollActive: v }),
}));

export async function runBlocking<T>(fn: () => Promise<T>): Promise<T> {
  const { beginBlocking, endBlocking } = useGlobalLoadingStore.getState();
  beginBlocking();
  try {
    return await fn();
  } finally {
    endBlocking();
  }
}
