/**
 * Unit tests for cost modal state helpers.
 */

import { describe, it, expect, vi } from "vitest";
import { resetCostModal } from "./costModalState";

describe("resetCostModal", () => {
  it("invokes all setters with closed/reset values", () => {
    const setOpen = vi.fn();
    const setQuote = vi.fn();
    const setPreparedOp = vi.fn();
    const setAction = vi.fn();
    const setPayload = vi.fn();

    resetCostModal({
      setOpen,
      setQuote,
      setPreparedOp,
      setAction,
      setPayload,
    });

    expect(setOpen).toHaveBeenCalledTimes(1);
    expect(setOpen).toHaveBeenCalledWith(false);
    expect(setQuote).toHaveBeenCalledTimes(1);
    expect(setQuote).toHaveBeenCalledWith(null);
    expect(setPreparedOp).toHaveBeenCalledTimes(1);
    expect(setPreparedOp).toHaveBeenCalledWith(null);
    expect(setAction).toHaveBeenCalledTimes(1);
    expect(setAction).toHaveBeenCalledWith(null);
    expect(setPayload).toHaveBeenCalledTimes(1);
    expect(setPayload).toHaveBeenCalledWith(null);
  });
});
