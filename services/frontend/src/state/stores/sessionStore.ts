/**
 * Zustand store for session state.
 * SECURITY: Never persist or log sessionOwnerPrivateKeyHex.
 */

import { create } from "zustand";

export interface SessionState {
  sessionAddress: string | null;
  sessionOwnerPrivateKeyHex: `0x${string}` | null;
  login: (addr: string, ownerHex: `0x${string}`) => void;
  logout: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  sessionAddress: null,
  sessionOwnerPrivateKeyHex: null,
  login: (addr, ownerHex) =>
    set({
      sessionAddress: addr,
      sessionOwnerPrivateKeyHex: ownerHex,
    }),
  logout: () =>
    set({
      sessionAddress: null,
      sessionOwnerPrivateKeyHex: null,
    }),
}));
