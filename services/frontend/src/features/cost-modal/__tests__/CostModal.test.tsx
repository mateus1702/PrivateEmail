/**
 * Integration tests for cost modal.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CostModal } from "../CostModal";

const mockQuote = {
  estimatedBaseCostUsdcE6: "100000",
  estimatedReferralUsdcE6: "0",
  estimatedTotalCostUsdcE6: "100000",
  maxBaseCostUsdcE6: "120000",
  maxReferralUsdcE6: "0",
  maxTotalCostUsdcE6: "120000",
  estimatedGas: "200000",
  validUntil: String(Math.floor(Date.now() / 1000) + 300),
};

describe("CostModal", () => {
  it("returns null when not open", () => {
    const { container } = render(
      <CostModal
        open={false}
        quote={mockQuote}
        action="register"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders when open with register title", () => {
    render(
      <CostModal
        open={true}
        quote={mockQuote}
        action="register"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(
      screen.getByRole("heading", { name: /Confirm On-Chain Activation \(~0\.1200 USDC\)/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/Estimated cost:/)).toBeInTheDocument();
    expect(
      screen.getByText(/Total shown includes estimated network costs and the Private Mail service fee/i)
    ).toBeInTheDocument();
  });

  it("renders when open with send title", () => {
    render(
      <CostModal
        open={true}
        quote={mockQuote}
        action="send"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(
      screen.getByRole("heading", { name: /Confirm Gasless Send \(~0\.1200 USDC\)/i })
    ).toBeInTheDocument();
  });

  it("calls onConfirm when Confirm is clicked", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(
      <CostModal
        open={true}
        quote={mockQuote}
        action="register"
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />
    );
    await user.click(screen.getByRole("button", { name: /Confirm/i }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it("calls onClose when Cancel is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <CostModal
        open={true}
        quote={mockQuote}
        action="register"
        onConfirm={vi.fn()}
        onClose={onClose}
      />
    );
    await user.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
