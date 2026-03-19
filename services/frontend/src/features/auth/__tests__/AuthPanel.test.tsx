/**
 * Integration tests for auth flow.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthPanel } from "../AuthPanel";
import type { UseAuthFlowResult } from "../useAuthFlow";

function createMockAuth(overrides: Partial<UseAuthFlowResult> = {}): UseAuthFlowResult {
  return {
    birthday: "",
    setBirthday: vi.fn(),
    password: "",
    setPassword: vi.fn(),
    confirmPassword: "",
    setConfirmPassword: vi.fn(),
    registerUsername: "",
    setRegisterUsername: vi.fn(),
    derivedAddress: null,
    derivedPubKeyHex: null,
    ownerPrivateKeyHex: null,
    usdcBalance: null,
    registered: null,
    isAnvil: false,
    showWhaleFunding: false,
    isContinueLoading: false,
    isRefreshing: false,
    isFunding: false,
    isRegistering: false,
    registerSuccess: null,
    mobileAuthModalOpen: false,
    setMobileAuthModalOpen: vi.fn(),
    authModalStep: "login",
    setAuthModalStep: vi.fn(),
    handleContinue: vi.fn(),
    handleRefreshBalance: vi.fn(),
    handleLoadFromWhale: vi.fn(),
    handleCompleteRegistration: vi.fn(),
    handleBack: vi.fn(),
    handleRegistrationSuccess: vi.fn(),
    formatBirthdayInput: (v: string) => v,
    formatUnits: (value: bigint, decimals: number) => value.toString().slice(0, -decimals),
    ...overrides,
  };
}

describe("AuthPanel", () => {
  const mockCopyText = vi.fn().mockResolvedValue(undefined);
  const mockCostModalConfirm = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders onboarding marketing content", () => {
    const auth = createMockAuth();
    render(
      <AuthPanel
        auth={auth}
        error={null}
        copyText={mockCopyText}
        costModalOpen={false}
        costModalQuote={null}
        costModalAction={null}
        onCostModalConfirm={mockCostModalConfirm}
        onCloseCostModal={vi.fn()}
        isCostConfirming={false}
        costStatusMessage={null}
        costNeedsReconfirm={false}
      />
    );
    expect(
      screen.getByText("Ship encrypted conversations without wallet friction.")
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Create or Access Your Inbox/i })).toBeInTheDocument();
  });

  it("shows error when present", () => {
    const auth = createMockAuth();
    render(
      <AuthPanel
        auth={auth}
        error="Invalid birthday format"
        copyText={mockCopyText}
        costModalOpen={false}
        costModalQuote={null}
        costModalAction={null}
        onCostModalConfirm={mockCostModalConfirm}
        onCloseCostModal={vi.fn()}
        isCostConfirming={false}
        costStatusMessage={null}
        costNeedsReconfirm={false}
      />
    );
    expect(screen.getByText("Invalid birthday format")).toBeInTheDocument();
  });

  it("opens auth modal when clicking Create or Access", async () => {
    const user = userEvent.setup();
    const setMobileAuthModalOpen = vi.fn();
    const auth = createMockAuth({ setMobileAuthModalOpen });
    render(
      <AuthPanel
        auth={auth}
        error={null}
        copyText={mockCopyText}
        costModalOpen={false}
        costModalQuote={null}
        costModalAction={null}
        onCostModalConfirm={mockCostModalConfirm}
        onCloseCostModal={vi.fn()}
        isCostConfirming={false}
        costStatusMessage={null}
        costNeedsReconfirm={false}
      />
    );
    await user.click(screen.getByRole("button", { name: /Open Secure Inbox/i }));
    expect(setMobileAuthModalOpen).toHaveBeenCalledWith(true);
  });

  it("shows register step with derived address when in register mode", () => {
    const auth = createMockAuth({
      authModalStep: "register",
      mobileAuthModalOpen: true,
      derivedAddress: "0x1234567890123456789012345678901234567890",
      usdcBalance: 500000n,
    });
    render(
      <AuthPanel
        auth={auth}
        error={null}
        copyText={mockCopyText}
        costModalOpen={false}
        costModalQuote={null}
        costModalAction={null}
        onCostModalConfirm={mockCostModalConfirm}
        onCloseCostModal={vi.fn()}
        isCostConfirming={false}
        costStatusMessage={null}
        costNeedsReconfirm={false}
      />
    );
    expect(screen.getByText("Activate Account")).toBeInTheDocument();
    expect(screen.getByText(/0x1234567890123456789012345678901234567890/)).toBeInTheDocument();
  });
});
