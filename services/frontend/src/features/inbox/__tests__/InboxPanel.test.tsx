/**
 * Integration tests for inbox flow.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InboxPanel } from "../InboxPanel";
import type { UseInboxFlowResult } from "../useInboxFlow";
import type { Message } from "../../../lib/contracts";

function createMockInbox(overrides: Partial<UseInboxFlowResult> = {}): UseInboxFlowResult {
  return {
    inboxPages: [],
    inboxNextPageId: 0n,
    inboxHasMore: false,
    isLoadingInbox: false,
    senderUsernames: new Map(),
    readMessageKeys: new Set(),
    selectedMessage: null,
    decryptedContent: null,
    messageModalOpen: false,
    setMessageModalOpen: vi.fn(),
    handleLoadInbox: vi.fn(),
    handleOpenMessage: vi.fn(),
    handleRetryDecrypt: vi.fn(),
    handleRefreshSessionBalance: vi.fn(),
    sessionUsdcBalance: null,
    isUserBalanceRefresh: false,
    overlayInboxBlocking: false,
    overlayBalanceInitialBlocking: false,
    isDecrypting: false,
    decryptError: null,
    getMessageKey: (msg: Message) =>
      `${msg.sender}-${msg.recipient}-${msg.timestamp}-${msg.contentHash}`,
    ...overrides,
  };
}

describe("InboxPanel", () => {
  it("renders empty state when no messages", () => {
    const inbox = createMockInbox();
    render(<InboxPanel inbox={inbox} />);
    expect(screen.getByText("Your Inbox")).toBeInTheDocument();
    expect(
      screen.getByText("Inbox is quiet. Send the first uncensorable message.")
    ).toBeInTheDocument();
  });

  it("shows loading state", () => {
    const inbox = createMockInbox({ isLoadingInbox: true, inboxPages: [] });
    render(<InboxPanel inbox={inbox} />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("renders message list when messages exist", () => {
    const messages: Message[] = [
      {
        sender: "0x1111111111111111111111111111111111111111" as `0x${string}`,
        recipient: "0x2222222222222222222222222222222222222222" as `0x${string}`,
        ciphertext: "0x" as `0x${string}`,
        ciphertextRef: 0n,
        timestamp: BigInt(Math.floor(Date.now() / 1000)),
        contentHash: "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`,
      },
    ];
    const senderUsernames = new Map([["0x1111111111111111111111111111111111111111", "alice"]]);
    const inbox = createMockInbox({ inboxPages: messages, senderUsernames });
    render(<InboxPanel inbox={inbox} />);
    expect(screen.getByText(/From: alice/)).toBeInTheDocument();
  });

  it("shows Unread badge for messages not in readMessageKeys", () => {
    const messages: Message[] = [
      {
        sender: "0x1111111111111111111111111111111111111111" as `0x${string}`,
        recipient: "0x2222222222222222222222222222222222222222" as `0x${string}`,
        ciphertext: "0x" as `0x${string}`,
        ciphertextRef: 0n,
        timestamp: BigInt(Math.floor(Date.now() / 1000)),
        contentHash: "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`,
      },
    ];
    const inbox = createMockInbox({
      inboxPages: messages,
      readMessageKeys: new Set(),
    });
    render(<InboxPanel inbox={inbox} />);
    expect(screen.getByTestId("inbox-badge-unread")).toBeInTheDocument();
    expect(screen.getByText(/Unread/i)).toBeInTheDocument();
  });

  it("calls handleLoadInbox when Load more is clicked", async () => {
    const user = userEvent.setup();
    const handleLoadInbox = vi.fn();
    const inbox = createMockInbox({ inboxHasMore: true, handleLoadInbox });
    render(<InboxPanel inbox={inbox} />);
    await user.click(screen.getByRole("button", { name: /Load more/i }));
    expect(handleLoadInbox).toHaveBeenCalledWith(true);
  });
});
