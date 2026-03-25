/**
 * Integration tests for auth flow.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthPanel } from "../AuthPanel";
import type { UseAuthFlowResult } from "../useAuthFlow";
import type { EnvConfig } from "../../../lib/config";

const mockEnv: EnvConfig = {
  VITE_RPC_URL: "http://localhost:8545",
  VITE_BUNDLER_URL: "http://localhost:4337",
  VITE_PAYMASTER_API_URL: "http://localhost:3000",
  VITE_CHAIN_ID: "137",
  VITE_ENTRYPOINT_ADDRESS: "0x0000000000000000000000000000000000000000",
  VITE_USDC_ADDRESS: "0x0000000000000000000000000000000000000001",
  VITE_ANVIL_WHALE_CANDIDATES: "",
  VITE_ENABLE_ANVIL_WHALE_FUNDING: "false",
  VITE_REFERRAL_BPS: "0",
  VITE_REFERRAL_ADDRESS: "0x0000000000000000000000000000000000000000",
};

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
    activatedUsername: null,
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
  const mockCopyText = vi.fn().mockResolvedValue(true);
  const mockCostModalConfirm = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders onboarding marketing content", () => {
    const auth = createMockAuth();
    render(
      <AuthPanel
        auth={auth}
        env={mockEnv}
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
    expect(screen.getByText(/PrivateMail – Inbox on the Blockchain/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Access Your On-Chain Inbox/i })).toBeInTheDocument();
    const github = screen.getByTestId("auth-github-link");
    expect(github).toHaveAttribute("href", "https://github.com/mateus1702/PrivateMail");
    expect(github).toHaveAttribute("target", "_blank");
    expect(github).toHaveAttribute("rel", "noopener noreferrer");
    expect(github).toHaveTextContent(/source code/i);
  });

  it("shows error when present", () => {
    const auth = createMockAuth();
    render(
      <AuthPanel
        auth={auth}
        env={mockEnv}
        error="Enter birthday (MM/DD/YYYY)"
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
    expect(screen.getByText("Enter birthday (MM/DD/YYYY)")).toBeInTheDocument();
  });

  it("opens auth modal when clicking Launch Your Sovereign Inbox", async () => {
    const user = userEvent.setup();
    const setMobileAuthModalOpen = vi.fn();
    const auth = createMockAuth({ setMobileAuthModalOpen });
    render(
      <AuthPanel
        auth={auth}
        env={mockEnv}
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
    await user.click(screen.getByRole("button", { name: /Launch Your Sovereign Inbox/i }));
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
        env={mockEnv}
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
    expect(screen.getByText("Activate & Claim Your Username")).toBeInTheDocument();
    expect(screen.getByText(/0x1234567890123456789012345678901234567890/)).toBeInTheDocument();
    expect(screen.getByTestId("auth-chain-badge")).toHaveTextContent("Polygon");
  });
});
