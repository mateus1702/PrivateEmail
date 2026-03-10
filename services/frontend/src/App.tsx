import { useState, useEffect, useCallback } from "react";
import { loadConfig, loadEnv, type ContractsConfig, type EnvConfig } from "./lib/config";
import {
  createMailClient,
  getUsdcBalance,
  isRegistered,
} from "./lib/contracts";
import {
  submitRegisterPublicKey,
  submitSendMessage,
  getSmartAccountAddress,
} from "./lib/aa";
import {
  deriveAaPrivateKey,
  deriveEncryptionKeyPair,
  encryptWithPublicKey,
  publicKeyToBytes,
  bytesToHex,
  hexToBytes,
} from "./lib/crypto";
import { formatUnits, parseUnits, keccak256 } from "viem";
import type { Address } from "viem";
import "./App.css";

const MIN_USDC_FOR_REGISTER = parseUnits("1", 6);
const WHALE_FUND_AMOUNT = parseUnits("10", 6);
const INBOX_POLL_INTERVAL_MS = 30000;

type Screen = "login" | "register" | "logged";

function App() {
  const [config, setConfig] = useState<ContractsConfig | null>(null);
  const [env, setEnv] = useState<EnvConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>("login");
  const [birthday, setBirthday] = useState("");
  const [password, setPassword] = useState("");
  const [recipientAddr, setRecipientAddr] = useState("");
  const [messageText, setMessageText] = useState("");

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
  const [isSending, setIsSending] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);

  // Session state (cleared on logout)
  const [sessionAddress, setSessionAddress] = useState<string | null>(null);
  const [sessionOwnerPrivateKeyHex, setSessionOwnerPrivateKeyHex] = useState<`0x${string}` | null>(null);
  const [sessionUsdcBalance, setSessionUsdcBalance] = useState<bigint | null>(null);
  const [isRefreshingSessionBalance, setIsRefreshingSessionBalance] = useState(false);

  const [composeModalOpen, setComposeModalOpen] = useState(false);

  const copyText = useCallback(async (value: string | null) => {
    if (!value) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return;
      }
    } catch {
      // fall through to legacy fallback
    }

    try {
      const input = document.createElement("textarea");
      input.value = value;
      input.setAttribute("readonly", "");
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.focus();
      input.select();
      const copied = document.execCommand("copy");
      document.body.removeChild(input);
      if (!copied) {
        throw new Error("Copy command failed");
      }
    } catch {
      setError("Unable to copy automatically. Please copy manually.");
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const e = await loadEnv();
        setEnv(e);
        const cfg = await loadConfig();
        setConfig(cfg);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);

  const clearDerivedState = useCallback(() => {
    setDerivedAddress(null);
    setDerivedPubKeyHex(null);
    setOwnerPrivateKeyHex(null);
    setUsdcBalance(null);
    setRegistered(null);
    setRegisterSuccess(null);
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
    if ((screen === "login" || screen === "register") && env?.VITE_RPC_URL && isAnvil === null) {
      detectAnvil(env.VITE_RPC_URL).then(setIsAnvil);
    }
  }, [screen, env?.VITE_RPC_URL, isAnvil, detectAnvil]);

  const storeSession = useCallback(
    (addr: string, ownerHex: `0x${string}`) => {
      setSessionAddress(addr);
      setSessionOwnerPrivateKeyHex(ownerHex);
      setScreen("logged");
    },
    []
  );

  const handleContinue = async () => {
    if (!config || !env) return;
    const [y, m, d] = birthday.split("-").map(Number);
    if (!y || !m || !d) {
      setError("Enter birthday (YYYY-MM-DD)");
      return;
    }
    if (!password || password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setIsContinueLoading(true);
    setError(null);
    try {
      const ts = Math.floor(new Date(Date.UTC(y, m - 1, d)).getTime() / 1000);
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

      if (reg) {
        storeSession(addr, ownerHex);
      } else {
        setScreen("register");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsContinueLoading(false);
    }
  };

  const handleRefreshBalance = async () => {
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
  };

  const handleLoadFromWhale = async () => {
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
      setIsFunding(false);
    }
  };

  const handleCompleteRegistration = async () => {
    if (!config || !env || !derivedAddress || !derivedPubKeyHex || !ownerPrivateKeyHex) return;
    if (usdcBalance === null || usdcBalance < MIN_USDC_FOR_REGISTER) {
      setError("Need at least 1 USDC. Refresh balance or use Load from whale.");
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

    setIsRegistering(true);
    setError(null);
    setRegisterSuccess(null);
    try {
      const aaConfig = {
        bundlerUrl: env.VITE_BUNDLER_URL,
        paymasterApiUrl: env.VITE_PAYMASTER_API_URL,
        rpcUrl: env.VITE_RPC_URL,
        entryPointAddress: env.VITE_ENTRYPOINT_ADDRESS ?? "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
        chainId: parseInt(env.VITE_CHAIN_ID, 10),
        usdcAddress: env.VITE_USDC_ADDRESS ?? "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
      };
      const hash = await submitRegisterPublicKey(aaConfig, {
        mailAddress: config.PrivateMail.address as Address,
        pubKeyHex: derivedPubKeyHex,
        ownerPrivateKeyHex,
      });
      setRegisterSuccess(hash);
      setRegistered(true);
      storeSession(derivedAddress, ownerPrivateKeyHex);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsRegistering(false);
    }
  };

  const handleBack = useCallback(() => {
    setBirthday("");
    setPassword("");
    clearDerivedState();
    setScreen("login");
    setError(null);
  }, [clearDerivedState]);

  const handleLogout = useCallback(() => {
    setSessionAddress(null);
    setSessionOwnerPrivateKeyHex(null);
    setSessionUsdcBalance(null);
    setScreen("login");
    setComposeModalOpen(false);
    clearDerivedState();
  }, [clearDerivedState]);

  const handleRefreshSessionBalance = useCallback(async () => {
    if (!env || !sessionAddress) return;
    const usdcAddr = (env.VITE_USDC_ADDRESS ?? "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359") as Address;
    setIsRefreshingSessionBalance(true);
    setError(null);
    try {
      const bal = await getUsdcBalance(env.VITE_RPC_URL, usdcAddr, sessionAddress as Address);
      setSessionUsdcBalance(bal);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsRefreshingSessionBalance(false);
    }
  }, [env, sessionAddress]);


  useEffect(() => {
    if (screen !== "logged" || !sessionAddress) return;
    handleRefreshSessionBalance();
    const interval = setInterval(() => {
      handleRefreshSessionBalance();
    }, INBOX_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [screen, sessionAddress, handleRefreshSessionBalance]);

  const handleSend = async () => {
    if (!config || !env || !recipientAddr || !messageText || !sessionOwnerPrivateKeyHex) return;
    if (!/^0x[a-fA-F0-9]{40}$/.test(recipientAddr)) {
      setError("Invalid recipient address");
      return;
    }
    if (!env.VITE_BUNDLER_URL || !env.VITE_PAYMASTER_API_URL) {
      setError("Bundler and Paymaster URLs required");
      return;
    }

    setIsSending(true);
    setError(null);
    setSendSuccess(null);
    try {
      const recipientPubKey = await createMailClient(config, env.VITE_RPC_URL).read.getPublicKey([
        recipientAddr as Address,
      ]);
      if (!recipientPubKey || recipientPubKey.length === 0) {
        setError("Recipient has not registered a public key");
        return;
      }
      const plaintext = new TextEncoder().encode(messageText);
      const recipPub =
        typeof recipientPubKey === "string"
          ? hexToBytes(recipientPubKey)
          : new Uint8Array(recipientPubKey as ArrayBuffer);
      const { ciphertext } = encryptWithPublicKey(plaintext, recipPub);
      const contentHash = keccak256(plaintext);

      const aaConfig = {
        bundlerUrl: env.VITE_BUNDLER_URL,
        paymasterApiUrl: env.VITE_PAYMASTER_API_URL,
        rpcUrl: env.VITE_RPC_URL,
        entryPointAddress: env.VITE_ENTRYPOINT_ADDRESS ?? "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
        chainId: parseInt(env.VITE_CHAIN_ID, 10),
        usdcAddress: env.VITE_USDC_ADDRESS ?? "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
      };
      const ciphertextHex = bytesToHex(ciphertext) as `0x${string}`;
      const hash = await submitSendMessage(aaConfig, {
        mailAddress: config.PrivateMail.address as Address,
        recipient: recipientAddr as Address,
        ciphertextHex,
        contentHash,
        ownerPrivateKeyHex: sessionOwnerPrivateKeyHex,
      });
      setSendSuccess(hash);
      setMessageText("");
      setComposeModalOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsSending(false);
    }
  };

  if (error && !config) {
    return (
      <div className="app">
        <h1>Private Mail</h1>
        <p className="error">{error}</p>
        <p>Ensure config is available at /config/contracts.json</p>
      </div>
    );
  }

  if (!config || !env) return <div className="app">Loading config…</div>;

  const canRegister =
    derivedAddress &&
    derivedPubKeyHex &&
    ownerPrivateKeyHex &&
    usdcBalance !== null &&
    usdcBalance >= MIN_USDC_FOR_REGISTER &&
    registered === false;

  // Login screen
  if (screen === "login") {
    return (
      <div className="app">
        <div className="app-header">
          <img src="/logo.svg" alt="Private Mail Logo" className="app-logo" />
          <h1>Private Mail</h1>
        </div>
        <div className="panel">
          <h2>Login or Register</h2>
          <input
            type="date"
            placeholder="Birthday (YYYY-MM-DD)"
            value={birthday}
            onChange={(e) => setBirthday(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button onClick={handleContinue} disabled={isContinueLoading}>
            {isContinueLoading ? "Checking…" : "Continue"}
          </button>
        </div>

        {error && <p className="error">{error}</p>}
      </div>
    );
  }

  // Register screen (unregistered users only)
  if (screen === "register") {
    return (
      <div className="app">
        <div className="app-header">
          <img src="/logo.svg" alt="Private Mail Logo" className="app-logo" />
          <h1>Private Mail</h1>
        </div>
        <button onClick={handleBack} className="back-button">
          Back
        </button>
        <div className="panel">
          <h2>Complete Registration</h2>
          <div className="address-row">
            <div className="address-label">
              <strong>Your address:</strong>
            </div>
            <div className="address-content">
              <code title={derivedAddress ?? ""}>
                {derivedAddress ? `${derivedAddress.slice(0, 10)}…${derivedAddress.slice(-8)}` : ""}
              </code>
              <button
                type="button"
                onClick={() => void copyText(derivedAddress)}
                title="Copy"
                className="copy-button"
              >
                Copy
              </button>
            </div>
          </div>
          <p>Send at least 1 USDC to this address to complete registration.</p>
          <p>
            <strong>USDC balance:</strong>{" "}
            {usdcBalance !== null ? formatUnits(usdcBalance, 6) : "—"}
          </p>
          <button onClick={handleRefreshBalance} disabled={isRefreshing}>
            {isRefreshing ? "Refreshing…" : "Refresh balance"}
          </button>
          {isAnvil && env.VITE_ENABLE_ANVIL_WHALE_FUNDING !== "false" && (
            <button onClick={handleLoadFromWhale} disabled={isFunding}>
              {isFunding ? "Loading…" : "Load 10 USDC from whale"}
            </button>
          )}
          <button
            onClick={handleCompleteRegistration}
            disabled={!canRegister || isRegistering}
          >
            {isRegistering ? "Registering…" : "Complete registration"}
          </button>
          {registerSuccess && (
            <p className="success">Registered. Tx: {registerSuccess.slice(0, 18)}…</p>
          )}
        </div>

        {error && <p className="error">{error}</p>}
      </div>
    );
  }

  // Logged screen (minimal layout with header and footer)
  return (
    <div className="app app--logged-minimal">
      <header className="logged-header-minimal">
        <div className="logged-header-content">
          <img src="/logo.svg" alt="Private Mail Logo" className="logged-logo-minimal" />
          <h1 className="logged-title-minimal">Private Mail</h1>
        </div>
      </header>

      <footer className="logged-footer-minimal">
        <div className="logged-footer-left">
          <div className="logged-footer-address">
            <strong>Account:</strong>{" "}
            <code title={sessionAddress ?? ""}>
              {sessionAddress ? `${sessionAddress.slice(0, 10)}…${sessionAddress.slice(-8)}` : ""}
            </code>
            <button
              type="button"
              onClick={() => void copyText(sessionAddress)}
              title="Copy"
            >
              Copy
            </button>
          </div>
          <div className="logged-footer-balance">
            <strong>USDC:</strong>{" "}
            {sessionUsdcBalance !== null ? formatUnits(sessionUsdcBalance, 6) : "—"}
          </div>
        </div>
        <div className="logged-footer-actions">
          <button onClick={handleRefreshSessionBalance} disabled={isRefreshingSessionBalance}>
            {isRefreshingSessionBalance ? "Refreshing…" : "Refresh"}
          </button>
          <button onClick={() => setComposeModalOpen(true)}>Compose</button>
          <button onClick={handleLogout}>Logout</button>
        </div>
      </footer>

      {composeModalOpen && (
        <div className="modal-overlay" onClick={() => setComposeModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">Compose</h2>
            <input
              placeholder="Recipient address"
              value={recipientAddr}
              onChange={(e) => setRecipientAddr(e.target.value)}
            />
            <textarea
              placeholder="Message"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
            />
            <div className="modal-actions">
              <button type="button" className="modal-close-btn" onClick={() => setComposeModalOpen(false)}>
                Close
              </button>
              <button onClick={handleSend} disabled={isSending}>
                {isSending ? "Sending…" : "Send"}
              </button>
            </div>
            {sendSuccess && <p className="success">Sent. Tx: {sendSuccess.slice(0, 18)}…</p>}
          </div>
        </div>
      )}

      {error && <p className="error logged-error">{error}</p>}
    </div>
  );
}

export default App;
