import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InboxShell } from "./InboxShell";

describe("InboxShell", () => {
  it("renders PrivateMail header and tagline", () => {
    render(
      <InboxShell
        username="alice"
        usdcBalance="1.00"
        isUserBalanceRefresh={false}
        isLoadingInbox={false}
        onRefreshBalance={vi.fn()}
        onFundSmartAccount={vi.fn()}
        onRefreshInbox={vi.fn()}
        onCompose={vi.fn()}
        onLogout={vi.fn()}
      >
        <div />
      </InboxShell>
    );
    expect(screen.getByRole("heading", { name: /PrivateMail/i })).toBeInTheDocument();
    expect(screen.getByText(/Chain-native/)).toBeInTheDocument();
    const github = screen.getByTestId("header-github-link");
    expect(github).toHaveAttribute("href", "https://github.com/mateus1702/PrivateMail");
    expect(github).toHaveAttribute("target", "_blank");
    expect(github).toHaveAttribute("rel", "noopener noreferrer");
    expect(github).toHaveTextContent(/source code/i);
  });

  it("sets aria-busy on balance refresh button when user refresh is active", () => {
    render(
      <InboxShell
        username="alice"
        usdcBalance="1.00"
        isUserBalanceRefresh
        isLoadingInbox={false}
        onRefreshBalance={vi.fn()}
        onFundSmartAccount={vi.fn()}
        onRefreshInbox={vi.fn()}
        onCompose={vi.fn()}
        onLogout={vi.fn()}
      >
        <div />
      </InboxShell>
    );
    const btn = screen.getByTestId("inbox-refresh-balance-btn");
    expect(btn).toHaveAttribute("aria-busy", "true");
    expect(btn).toBeDisabled();
  });

  it("does not set aria-busy when user refresh is idle", () => {
    render(
      <InboxShell
        username="alice"
        usdcBalance="1.00"
        isUserBalanceRefresh={false}
        isLoadingInbox={false}
        onRefreshBalance={vi.fn()}
        onFundSmartAccount={vi.fn()}
        onRefreshInbox={vi.fn()}
        onCompose={vi.fn()}
        onLogout={vi.fn()}
      >
        <div />
      </InboxShell>
    );
    const btn = screen.getByTestId("inbox-refresh-balance-btn");
    expect(btn).toHaveAttribute("aria-busy", "false");
  });

  it("calls onFundSmartAccount when Fund is clicked", async () => {
    const user = userEvent.setup();
    const onFundSmartAccount = vi.fn();
    render(
      <InboxShell
        username="alice"
        usdcBalance="1.00"
        isUserBalanceRefresh={false}
        isLoadingInbox={false}
        onRefreshBalance={vi.fn()}
        onFundSmartAccount={onFundSmartAccount}
        onRefreshInbox={vi.fn()}
        onCompose={vi.fn()}
        onLogout={vi.fn()}
      >
        <div />
      </InboxShell>
    );
    await user.click(screen.getByTestId("inbox-fund-btn"));
    expect(onFundSmartAccount).toHaveBeenCalled();
  });

  it("disables compose and shows loading label while opening", () => {
    render(
      <InboxShell
        username="alice"
        usdcBalance="1.00"
        isUserBalanceRefresh={false}
        isLoadingInbox={false}
        onRefreshBalance={vi.fn()}
        onFundSmartAccount={vi.fn()}
        onRefreshInbox={vi.fn()}
        onCompose={vi.fn()}
        isComposeOpening
        onLogout={vi.fn()}
      >
        <div />
      </InboxShell>
    );
    const composeBtn = screen.getByTestId("compose-btn");
    expect(composeBtn).toBeDisabled();
    expect(composeBtn).toHaveTextContent("Opening…");
  });
});
