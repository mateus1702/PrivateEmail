/**
 * Fund smart account help modal.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FundSmartAccountModal } from "../FundSmartAccountModal";

const ADDR = "0x1234567890123456789012345678901234567890";

describe("FundSmartAccountModal", () => {
  it("renders nothing in the document when closed", () => {
    render(
      <FundSmartAccountModal
        open={false}
        onClose={vi.fn()}
        smartAccountAddress={ADDR}
        chainLabel="Polygon"
        usdcBalance="0.5"
        explorerAddressUrl={null}
        onCopyAddress={vi.fn()}
        onRefreshBalance={vi.fn()}
        isBalanceRefreshing={false}
      />
    );
    expect(screen.queryByTestId("fund-smart-account-modal")).not.toBeInTheDocument();
  });

  it("shows smart account info and address when open", () => {
    render(
      <FundSmartAccountModal
        open
        onClose={vi.fn()}
        smartAccountAddress={ADDR}
        chainLabel="Polygon"
        usdcBalance="1.25"
        explorerAddressUrl={`https://polygonscan.com/address/${ADDR.toLowerCase()}`}
        onCopyAddress={vi.fn()}
        onRefreshBalance={vi.fn()}
        isBalanceRefreshing={false}
      />
    );
    expect(screen.getByTestId("fund-smart-account-modal")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Fund with USDC/i })).toBeInTheDocument();
    expect(screen.getByTestId("fund-modal-address")).toHaveTextContent(ADDR);
    expect(screen.getByTestId("fund-modal-chain-badge")).toHaveTextContent("Polygon");
    expect(screen.getByText(/1\.25/)).toBeInTheDocument();
    expect(screen.getByTestId("fund-modal-explorer")).toBeInTheDocument();
  });

  it("calls onRefreshBalance when refresh is clicked", async () => {
    const user = userEvent.setup();
    const onRefreshBalance = vi.fn();
    render(
      <FundSmartAccountModal
        open
        onClose={vi.fn()}
        smartAccountAddress={ADDR}
        chainLabel="Polygon"
        usdcBalance="2"
        explorerAddressUrl={null}
        onCopyAddress={vi.fn()}
        onRefreshBalance={onRefreshBalance}
        isBalanceRefreshing={false}
      />
    );
    await user.click(screen.getByTestId("fund-modal-refresh-balance"));
    expect(onRefreshBalance).toHaveBeenCalled();
  });

  it("calls onCopyAddress when Copy is clicked", async () => {
    const user = userEvent.setup();
    const onCopyAddress = vi.fn();
    render(
      <FundSmartAccountModal
        open
        onClose={vi.fn()}
        smartAccountAddress={ADDR}
        chainLabel="Local"
        usdcBalance={null}
        explorerAddressUrl={null}
        onCopyAddress={onCopyAddress}
        onRefreshBalance={vi.fn()}
        isBalanceRefreshing={false}
      />
    );
    await user.click(screen.getByTestId("fund-modal-copy"));
    expect(onCopyAddress).toHaveBeenCalled();
  });

  it("calls onClose when Close is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <FundSmartAccountModal
        open
        onClose={onClose}
        smartAccountAddress={ADDR}
        chainLabel="Polygon"
        usdcBalance={null}
        explorerAddressUrl={null}
        onCopyAddress={vi.fn()}
        onRefreshBalance={vi.fn()}
        isBalanceRefreshing={false}
      />
    );
    await user.click(screen.getByTestId("fund-modal-close"));
    expect(onClose).toHaveBeenCalled();
  });
});
