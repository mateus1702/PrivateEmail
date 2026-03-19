/**
 * Zustand store for UI orchestration state.
 * Modal flags, selected message, auth step, compose draft, cost modal, toasts.
 */

import { create } from "zustand";
import type { Message } from "../../lib/contracts";
import type { SponsorQuote } from "../../lib/aa";
import type { CostModalPayload } from "../../features/shared/types";

export type AuthModalStep = "login" | "register";
export type CostModalAction = "register" | "send" | null;

export interface UiState {
  // Auth modal
  mobileAuthModalOpen: boolean;
  authModalStep: AuthModalStep;
  setMobileAuthModalOpen: (v: boolean) => void;
  setAuthModalStep: (v: AuthModalStep) => void;

  // Compose modal
  composeModalOpen: boolean;
  recipientAddr: string;
  messageText: string;
  setComposeModalOpen: (v: boolean) => void;
  setRecipientAddr: (v: string) => void;
  setMessageText: (v: string) => void;

  // Message modal
  messageModalOpen: boolean;
  selectedMessage: Message | null;
  setMessageModalOpen: (v: boolean) => void;
  setSelectedMessage: (msg: Message | null) => void;

  // Cost modal
  costModalOpen: boolean;
  costModalQuote: SponsorQuote | null;
  costModalAction: CostModalAction;
  costModalPreparedOp: Record<string, unknown> | null;
  costModalPayload: CostModalPayload | null;
  setCostModalOpen: (v: boolean) => void;
  setCostModalQuote: (q: SponsorQuote | null) => void;
  setCostModalAction: (a: CostModalAction) => void;
  setCostModalPreparedOp: (op: Record<string, unknown> | null) => void;
  setCostModalPayload: (p: CostModalPayload | null) => void;
  resetCostModal: () => void;

  // Toasts
  sendToast: boolean;
  setSendToast: (v: boolean) => void;

  // Error (app-level)
  error: string | null;
  setError: (err: string | null) => void;
}

const initialCostModal = {
  costModalOpen: false,
  costModalQuote: null as SponsorQuote | null,
  costModalAction: null as CostModalAction,
  costModalPreparedOp: null as Record<string, unknown> | null,
  costModalPayload: null as CostModalPayload | null,
};

export const useUiStore = create<UiState>((set) => ({
  mobileAuthModalOpen: false,
  authModalStep: "login",
  setMobileAuthModalOpen: (v) => set({ mobileAuthModalOpen: v }),
  setAuthModalStep: (v) => set({ authModalStep: v }),

  composeModalOpen: false,
  recipientAddr: "",
  messageText: "",
  setComposeModalOpen: (v) => set({ composeModalOpen: v }),
  setRecipientAddr: (v) => set({ recipientAddr: v }),
  setMessageText: (v) => set({ messageText: v }),

  messageModalOpen: false,
  selectedMessage: null,
  setMessageModalOpen: (v) => set({ messageModalOpen: v }),
  setSelectedMessage: (msg) => set({ selectedMessage: msg }),

  ...initialCostModal,
  setCostModalOpen: (v) => set({ costModalOpen: v }),
  setCostModalQuote: (q) => set({ costModalQuote: q }),
  setCostModalAction: (a) => set({ costModalAction: a }),
  setCostModalPreparedOp: (op) => set({ costModalPreparedOp: op }),
  setCostModalPayload: (p) => set({ costModalPayload: p }),
  resetCostModal: () => set(initialCostModal),

  sendToast: false,
  setSendToast: (v) => set({ sendToast: v }),

  error: null,
  setError: (err) => set({ error: err }),
}));
