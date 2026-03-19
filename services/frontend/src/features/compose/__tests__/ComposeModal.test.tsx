/**
 * Integration tests for compose flow.
 */

import { describe, it, expect, vi } from "vitest";
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
    handleSend: vi.fn(),
    clearSendSuccess: vi.fn(),
    clearComposeError: vi.fn(),
    ...overrides,
  };
}

describe("ComposeModal", () => {
  it("returns null when not open", () => {
    const compose = createMockCompose({ composeModalOpen: false });
    const { container } = render(<ComposeModal compose={compose} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders compose form when open", () => {
    const compose = createMockCompose();
    render(<ComposeModal compose={compose} />);
    expect(screen.getByText("Compose")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Recipient/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Message/)).toBeInTheDocument();
  });

  it("calls handleSend when Send is clicked", async () => {
    const user = userEvent.setup();
    const handleSend = vi.fn();
    const compose = createMockCompose({ handleSend });
    render(<ComposeModal compose={compose} />);
    await user.click(screen.getByRole("button", { name: /Send/i }));
    expect(handleSend).toHaveBeenCalled();
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
