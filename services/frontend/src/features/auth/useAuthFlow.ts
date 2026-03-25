/**
 * Auth flow hook: derive keys, continue, registration, whale funding.
 */

import { useState, useEffect, useCallback } from "react";
import { parseUnits } from "viem";
import type { Address } from "viem";
import { getReferralContext, type ContractsConfig, type EnvConfig } from "../../lib/config";
import { buildAaConfig } from "../../lib/aaConfig";
import { getSmartAccountAddress } from "../../lib/aa";
import {
  getUsdcBalance,
  isRegistered,
  getAddressForUsername,
} from "../../lib/contracts";
import {
  deriveAaPrivateKey,
  deriveEncryptionKeyPair,
  publicKeyToBytes,
  bytesToHex,
} from "../../lib/crypto";
import { parseBirthdayMask, formatBirthdayInput } from "../../lib/parseBirthdayMask";
import { formatUnits } from "viem";
import { prepareRegisterOperation } from "../../application";
import { MIN_REGISTER_USDC_E6 } from "../../lib/usdcThresholds";
import { useGlobalLoadingStore } from "../../state/stores";
import type { CostModalRegisterPayload } from "../shared/types";
import type { SponsorQuote } from "../../lib/aa";

const WHALE_FUND_AMOUNT = parseUnits("0.5", 6);

export interface UseAuthFlowInput {
  config: ContractsConfig | null;
  env: EnvConfig | null;
  setError: (err: string | null) => void;
  onStoreSession: (addr: string, ownerHex: `0x${string}`) => void;
  onOpenCostModal: (opts: {
    quote: SponsorQuote;
    preparedUserOp: Record<string, unknown>;
    action: "register";
    payload: CostModalRegisterPayload;
  }) => void;
  onSessionUsernameResolved?: (username: string) => void;
}

export interface UseAuthFlowResult {
  // Form state
  birthday: string;
  setBirthday: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  confirmPassword: string;
  setConfirmPassword: (v: string) => void;
  registerUsername: string;
  setRegisterUsername: (v: string) => void;
  // Derived state
  derivedAddress: string | null;
  derivedPubKeyHex: `0x${string}` | null;
  ownerPrivateKeyHex: `0x${string}` | null;
  usdcBalance: bigint | null;
  registered: boolean | null;
  isAnvil: boolean | null;
  showWhaleFunding: boolean;
  isContinueLoading: boolean;
  isRefreshing: boolean;
  isFunding: boolean;
  isRegistering: boolean;
  registerSuccess: string | null;
  /** Username shown after successful activation (success message). */
  activatedUsername: string | null;
  // Modal state
  mobileAuthModalOpen: boolean;
  setMobileAuthModalOpen: (v: boolean) => void;
  authModalStep: "login" | "register";
  setAuthModalStep: (v: "login" | "register") => void;
  // Handlers
  handleContinue: () => Promise<void>;
  handleRefreshBalance: () => Promise<void>;
  handleLoadFromWhale: () => Promise<void>;
  handleCompleteRegistration: () => Promise<void>;
  handleBack: () => void;
  handleRegistrationSuccess: (opts: { hash: string; username: string }) => void;
  formatBirthdayInput: typeof formatBirthdayInput;
  formatUnits: typeof formatUnits;
}

export function useAuthFlow(input: UseAuthFlowInput): UseAuthFlowResult {
  const {
    config,
    env,
    setError,
    onStoreSession,
    onOpenCostModal,
    onSessionUsernameResolved,
  } = input;

  const [birthday, setBirthday] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [registerUsername, setRegisterUsername] = useState("");
  const [derivedAddress, setDerivedAddress] = useState<string | null>(null);
  const [derivedPubKeyHex, setDerivedPubKeyHex] = useState<`0x${string}` | null>(null);
  const [ownerPrivateKeyHex, setOwnerPrivateKeyHex] = useState<`0x${string}` | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<bigint | null>(null);
  const [registered, setRegistered] = useState<boolean | null>(null);
  const [isAnvil, setIsAnvil] = useState<boolean | null>(null);
  const [isContinueLoading, setIsContinueLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isFunding, setIsFunding] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState<string | null>(null);
  const [activatedUsername, setActivatedUsername] = useState<string | null>(null);
  const [mobileAuthModalOpen, setMobileAuthModalOpen] = useState(false);
  const [authModalStep, setAuthModalStep] = useState<"login" | "register">("login");

  const clearDerivedState = useCallback(() => {
    setDerivedAddress(null);
    setDerivedPubKeyHex(null);
    setOwnerPrivateKeyHex(null);
    setUsdcBalance(null);
    setRegistered(null);
    setRegisterSuccess(null);
    setActivatedUsername(null);
  }, []);

  useEffect(() => {
    clearDerivedState();
  }, [birthday, password, clearDerivedState]);

  const detectAnvil = useCallback(async (rpcUrl: string): Promise<boolean> => {
    try {
      const res = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "anvil_impersonateAccount",
          params: ["0x0000000000000000000000000000000000000001"],
        }),
      });
      const json = await res.json();
      if (json.error) return false;
      const stopRes = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "anvil_stopImpersonatingAccount",
          params: ["0x0000000000000000000000000000000000000001"],
        }),
      });
      const stopJson = await stopRes.json();
      return !stopJson.error;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (!env?.VITE_RPC_URL || isAnvil !== null) return;
    const { beginBlocking, endBlocking } = useGlobalLoadingStore.getState();
    beginBlocking();
    void detectAnvil(env.VITE_RPC_URL)
      .then(setIsAnvil)
      .finally(() => endBlocking());
  }, [env?.VITE_RPC_URL, isAnvil, detectAnvil]);

  const handleContinue = useCallback(async () => {
    if (!config || !env) return;
    const ts = parseBirthdayMask(birthday);
    if (ts === null) {
      setError("Enter birthday (MM/DD/YYYY)");
      return;
    }
    if (!password || password.length < 8) {
      setError("Password needs 8+ characters for strong derivation");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setIsContinueLoading(true);
    setError(null);
    const { beginBlocking, endBlocking } = useGlobalLoadingStore.getState();
    beginBlocking();
    try {
      const aaKey = deriveAaPrivateKey(ts, password);
      const { publicKey } = deriveEncryptionKeyPair(aaKey);
      const pubKeyHex = bytesToHex(publicKeyToBytes(publicKey)) as `0x${string}`;
      const ownerHex = bytesToHex(aaKey) as `0x${string}`;
      const addr = await getSmartAccountAddress(
        env.VITE_RPC_URL,
        parseInt(env.VITE_CHAIN_ID, 10),
        ownerHex
      );

      const usdcAddr = (env.VITE_USDC_ADDRESS ?? "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359") as Address;
      const [bal, reg] = await Promise.all([
        getUsdcBalance(env.VITE_RPC_URL, usdcAddr, addr as Address),
        isRegistered(config, env.VITE_RPC_URL, addr as Address),
      ]);

      setDerivedAddress(addr);
      setDerivedPubKeyHex(pubKeyHex);
      setOwnerPrivateKeyHex(ownerHex);
      setUsdcBalance(bal);
      setRegistered(reg);
      setConfirmPassword("");

      if (reg) {
        setMobileAuthModalOpen(false);
        setAuthModalStep("login");
        onStoreSession(addr, ownerHex);
      } else {
        setAuthModalStep("register");
      }
    } catch (e) {
      console.error("[auth] continue", e);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      endBlocking();
      setIsContinueLoading(false);
    }
  }, [config, env, birthday, password, confirmPassword, onStoreSession, setError]);

  const handleRefreshBalance = useCallback(async () => {
    if (!config || !env || !derivedAddress) return;
    const usdcAddr = (env.VITE_USDC_ADDRESS ?? "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359") as Address;
    setIsRefreshing(true);
    setError(null);
    try {
      const [bal, reg] = await Promise.all([
        getUsdcBalance(env.VITE_RPC_URL, usdcAddr, derivedAddress as Address),
        isRegistered(config, env.VITE_RPC_URL, derivedAddress as Address),
      ]);
      setUsdcBalance(bal);
      setRegistered(reg);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsRefreshing(false);
    }
  }, [config, env, derivedAddress, setError]);

  const handleLoadFromWhale = useCallback(async () => {
    if (!env || !derivedAddress) return;
    const enabled = env.VITE_ENABLE_ANVIL_WHALE_FUNDING !== "false";
    if (!enabled || !isAnvil) {
      setError("Anvil whale funding not available");
      return;
    }
    const candidates = (
      env.VITE_ANVIL_WHALE_CANDIDATES ??
      "0x47c031236e19d024b42f8de678d3110562d925b5,0x794a61358D6845594F94dc1DB02A252b5b4814aD,0xF977814e90dA44bFA03b6295A0616a897441aceC,0x28C6c06298d514Db089934071355E5743bf21d60"
    )
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean) as Address[];
    const usdcAddr = (env.VITE_USDC_ADDRESS ?? "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359") as Address;

    setIsFunding(true);
    setError(null);
    const { beginBlocking, endBlocking } = useGlobalLoadingStore.getState();
    beginBlocking();
    try {
      const { createPublicClient, getContract, encodeFunctionData, http, parseAbi } = await import(
        "viem"
      );
      const chain = {
        id: 137,
        name: "Chain",
        nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
        rpcUrls: { default: { http: [env.VITE_RPC_URL] } },
      };
      const client = createPublicClient({
        chain,
        transport: http(env.VITE_RPC_URL),
      });
      const usdc = getContract({
        address: usdcAddr,
        abi: parseAbi([
          "function balanceOf(address) view returns (uint256)",
          "function transfer(address, uint256) returns (bool)",
        ]),
        client,
      });

      let whale: Address | undefined;
      for (const c of candidates) {
        const bal = await usdc.read.balanceOf([c]);
        if (bal >= WHALE_FUND_AMOUNT) {
          whale = c;
          break;
        }
      }
      if (!whale) {
        setError("No whale with enough USDC at current fork block");
        return;
      }

      await fetch(env.VITE_RPC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "anvil_impersonateAccount",
          params: [whale],
        }),
      });

      await fetch(env.VITE_RPC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "anvil_setBalance",
          params: [whale, "0x" + BigInt(1e18).toString(16)],
        }),
      });

      const transferData = encodeFunctionData({
        abi: parseAbi(["function transfer(address to, uint256 amount) returns (bool)"]),
        functionName: "transfer",
        args: [derivedAddress as Address, WHALE_FUND_AMOUNT],
      });

      const txRes = await fetch(env.VITE_RPC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 3,
          method: "eth_sendTransaction",
          params: [
            {
              from: whale,
              to: usdcAddr,
              data: transferData,
              gas: "0x186A0",
            },
          ],
        }),
      });
      const txJson = (await txRes.json()) as { error?: { message: string }; result?: string };
      if (txJson.error) {
        setError(`Transfer failed: ${txJson.error.message}`);
        return;
      }

      await fetch(env.VITE_RPC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 4,
          method: "anvil_stopImpersonatingAccount",
          params: [whale],
        }),
      });

      await handleRefreshBalance();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      endBlocking();
      setIsFunding(false);
    }
  }, [env, derivedAddress, isAnvil, handleRefreshBalance, setError]);

  const handleCompleteRegistration = useCallback(async () => {
    if (!config || !env || !derivedAddress || !derivedPubKeyHex || !ownerPrivateKeyHex) return;
    const username = registerUsername.trim().toLowerCase();
    if (username.length < 3 || username.length > 32) {
      setError("Please enter a username (3-32 characters)");
      return;
    }
    if (registered) {
      setError("Already registered");
      return;
    }
    if (!env.VITE_BUNDLER_URL || !env.VITE_PAYMASTER_API_URL) {
      setError("Bundler and Paymaster URLs required");
      return;
    }

    const { beginBlocking, endBlocking } = useGlobalLoadingStore.getState();
    beginBlocking();
    try {
      const usdcAddr = (env.VITE_USDC_ADDRESS ?? "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359") as Address;
      try {
        const balance = await getUsdcBalance(env.VITE_RPC_URL, usdcAddr, derivedAddress as Address);
        if (balance < MIN_REGISTER_USDC_E6) {
          setError(
            "Your smart account needs at least 0.3 USDC to activate. Fund it to continue."
          );
          return;
        }
      } catch (e) {
        setError(
          `Could not verify USDC balance: ${e instanceof Error ? e.message : String(e)}`
        );
        return;
      }

      const existingOwner = await getAddressForUsername(config, env.VITE_RPC_URL, username);
      if (existingOwner && existingOwner.toLowerCase() !== derivedAddress.toLowerCase()) {
        setError("Username is already taken");
        return;
      }

      setIsRegistering(true);
      setError(null);
      setRegisterSuccess(null);
      const aaConfig = buildAaConfig(env, getReferralContext());
      try {
        const { preparedUserOp, quote } = await prepareRegisterOperation({
          config,
          aaConfig,
          pubKeyHex: derivedPubKeyHex,
          ownerPrivateKeyHex,
          username,
        });
        const payload: CostModalRegisterPayload = {
          aaConfig,
          username,
          ownerPrivateKeyHex,
          derivedAddress,
        };
        onOpenCostModal({ quote, preparedUserOp, action: "register", payload });
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        const isUsernameTaken =
          errMsg.includes("0x2b4e2567") || errMsg.toLowerCase().includes("usernametaken");
        setError(isUsernameTaken ? "Username is already taken" : errMsg);
      } finally {
        setIsRegistering(false);
      }
    } finally {
      endBlocking();
    }
  }, [
    config,
    env,
    derivedAddress,
    derivedPubKeyHex,
    ownerPrivateKeyHex,
    registerUsername,
    registered,
    onOpenCostModal,
    setError,
  ]);

  const handleBack = useCallback(() => {
    setBirthday("");
    setPassword("");
    setConfirmPassword("");
    setRegisterUsername("");
    clearDerivedState();
    setAuthModalStep("login");
    setError(null);
  }, [clearDerivedState, setError]);

  const handleRegistrationSuccess = useCallback(
    (opts: { hash: string; username: string }) => {
      setRegisterSuccess(opts.hash);
      setActivatedUsername(opts.username);
      setRegistered(true);
      setRegisterUsername("");
      setMobileAuthModalOpen(false);
      setAuthModalStep("login");
      if (derivedAddress && ownerPrivateKeyHex) {
        try {
          localStorage.setItem(`pm_username_${derivedAddress.toLowerCase()}`, opts.username);
        } catch {
          /* ignore */
        }
        onSessionUsernameResolved?.(opts.username);
        onStoreSession(derivedAddress, ownerPrivateKeyHex);
      }
    },
    [derivedAddress, ownerPrivateKeyHex, onStoreSession, onSessionUsernameResolved]
  );

  return {
    birthday,
    setBirthday,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    registerUsername,
    setRegisterUsername,
    derivedAddress,
    derivedPubKeyHex,
    ownerPrivateKeyHex,
    usdcBalance,
    registered,
    isAnvil,
    showWhaleFunding: Boolean(isAnvil && env?.VITE_ENABLE_ANVIL_WHALE_FUNDING !== "false"),
    isContinueLoading,
    isRefreshing,
    isFunding,
    isRegistering,
    registerSuccess,
    activatedUsername,
    mobileAuthModalOpen,
    setMobileAuthModalOpen,
    authModalStep,
    setAuthModalStep,
    handleContinue,
    handleRefreshBalance,
    handleLoadFromWhale,
    handleCompleteRegistration,
    handleBack,
    handleRegistrationSuccess,
    formatBirthdayInput,
    formatUnits,
  };
}
