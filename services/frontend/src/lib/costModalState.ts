/**
 * Cost modal state helpers.
 * Centralizes repeated reset logic used across cancel, backdrop, and confirm branches.
 */

import type { Dispatch, SetStateAction } from "react";
import type { SponsorQuote } from "./aa";

/** Accepts React state setters for cost modal. */
export interface CostModalSetters {
  setOpen: Dispatch<SetStateAction<boolean>>;
  setQuote: Dispatch<SetStateAction<SponsorQuote | null>>;
  setPreparedOp: Dispatch<SetStateAction<Record<string, unknown> | null>>;
  setAction: Dispatch<SetStateAction<"register" | "send" | null>>;
  setPayload: Dispatch<SetStateAction<unknown>>;
}

/**
 * Resets cost modal to closed state by invoking all setters with null/closed values.
 * Use for cancel, backdrop click, and after successful confirm.
 */
export function resetCostModal(setters: CostModalSetters): void {
  setters.setOpen(false);
  setters.setQuote(null);
  setters.setPreparedOp(null);
  setters.setAction(null);
  setters.setPayload(null);
}
