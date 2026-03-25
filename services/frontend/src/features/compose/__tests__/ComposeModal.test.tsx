/**
 * Integration tests for compose flow.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ComposeModal } from "../ComposeModal";
import type { UseComposeFlowResult } from "../useComposeFlow";

function createMockCompose(overrides: Partial<UseComposeFlowResult> = {}): UseComposeFlowResult {
  return {
    recipientAddr: "",
    setRecipientAddr: vi.fn(),
    messageText: "",
    setMessageText: vi.fn(),
    isSending: false,
    composeError: null,
    sendSuccess: null,
    composeModalOpen: true,
    setComposeModalOpen: vi.fn(),
    requestOpenCompose: vi.fn().mockResolvedValue(undefined),
    isComposeOpenLoading: false,
    handleSend: vi.fn(),
    clearSendSuccess: vi.fn(),
    clearComposeError: vi.fn(),
    setSendSuccess: vi.fn(),
    resetComposeAfterSend: vi.fn(),
    ...overrides,
  };
}

describe("ComposeModal", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_EXPLORER_TX_URL_PREFIX", "https://polygonscan.com/tx/");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns null when not open", () => {
    const compose = createMockCompose({ composeModalOpen: false });
    const { container } = render(<ComposeModal compose={compose} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders compose form when open", () => {
    const compose = createMockCompose();
    render(<ComposeModal compose={compose} />);
    expect(screen.getByText("New On-Chain Message")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Recipient username")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Message/)).toBeInTheDocument();
  });

  it("calls handleSend when Send is clicked", async () => {
    const user = userEvent.setup();
    const handleSend = vi.fn();
    const compose = createMockCompose({ handleSend });
    render(<ComposeModal compose={compose} />);
    await user.click(screen.getByRole("button", { name: /Send Gaslessly/i }));
    expect(handleSend).toHaveBeenCalled();
  });

  it("renders explorer link when sendSuccess is set and explorer env is configured", () => {
    const hash =
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
    const compose = createMockCompose({ sendSuccess: hash });
    render(<ComposeModal compose={compose} />);
    const link = screen.getByRole("link", { name: /0xaaaaaaaaaaaaaaaa…/i });
    expect(link).toHaveAttribute("href", `https://polygonscan.com/tx/${hash}`);
  });

  it("calls setComposeModalOpen and clearSendSuccess when Close is clicked", async () => {
    const user = userEvent.setup();
    const setComposeModalOpen = vi.fn();
    const clearSendSuccess = vi.fn();
    const compose = createMockCompose({
      setComposeModalOpen,
      clearSendSuccess,
    });
    render(<ComposeModal compose={compose} />);
    await user.click(screen.getByTestId("compose-close"));
    expect(setComposeModalOpen).toHaveBeenCalledWith(false);
    expect(clearSendSuccess).toHaveBeenCalled();
  });
});
