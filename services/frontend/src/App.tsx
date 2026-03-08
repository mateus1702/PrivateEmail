import { useState, useEffect, useCallback } from "react";
import { loadConfig, loadEnv, type ContractsConfig, type EnvConfig } from "./lib/config";
import {
  createMailClient,
  getInboxMessageIds,
  fetchMessage,
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
  decryptWithPrivateKey,
  publicKeyToBytes,
  bytesToHex,
  hexToBytes,
} from "./lib/crypto";
import { formatUnits, parseUnits, keccak256 } from "viem";
import type { Address } from "viem";
import "./App.css";

const MIN_USDC_FOR_REGISTER = parseUnits("1", 6);
const WHALE_FUND_AMOUNT = parseUnits("10", 6);

type Screen = "home" | "register" | "compose" | "inbox";

function App() {
  const [config, setConfig] = useState<ContractsConfig | null>(null);
  const [env, setEnv] = useState<EnvConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>("home");
  const [birthday, setBirthday] = useState("");
  const [password, setPassword] = useState("");
  const [recipientAddr, setRecipientAddr] = useState("");
  const [messageText, setMessageText] = useState("");
  const [inboxMessages, setInboxMessages] = useState<{ id: bigint; plaintext: string }[]>([]);
  const [inboxAddr, setInboxAddr] = useState("");
  const [loading, setLoading] = useState(false);

  const [derivedAddress, setDerivedAddress] = useState<string | null>(null);
  const [derivedPubKeyHex, setDerivedPubKeyHex] = useState<`0x${string}` | null>(null);
  const [ownerPrivateKeyHex, setOwnerPrivateKeyHex] = useState<`0x${string}` | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<bigint | null>(null);
  const [registered, setRegistered] = useState<boolean | null>(null);
  const [isAnvil, setIsAnvil] = useState<boolean | null>(null);
  const [isDeriving, setIsDeriving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isFunding, setIsFunding] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);

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
    if (screen === "register" && env?.VITE_RPC_URL && isAnvil === null) {
      detectAnvil(env.VITE_RPC_URL).then(setIsAnvil);
    }
  }, [screen, env?.VITE_RPC_URL, isAnvil, detectAnvil]);

  const handleDerive = async () => {
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
    setIsDeriving(true);
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
      setDerivedAddress(addr);
      setDerivedPubKeyHex(pubKeyHex);
      setOwnerPrivateKeyHex(ownerHex);
      setUsdcBalance(null);
      setRegistered(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsDeriving(false);
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

  const handleRegister = async () => {
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
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsRegistering(false);
    }
  };

  const handleSend = async () => {
    if (!config || !env || !recipientAddr || !messageText) return;
    if (!/^0x[a-fA-F0-9]{40}$/.test(recipientAddr)) {
      setError("Invalid recipient address");
      return;
    }
    const [y, m, d] = birthday.split("-").map(Number);
    if (!y || !m || !d || !password) {
      setError("Enter birthday and password (sender identity)");
      return;
    }
    if (!env.VITE_BUNDLER_URL || !env.VITE_PAYMASTER_API_URL) {
      setError("Bundler and Paymaster URLs required");
      return;
    }

    setIsSending(true);
    setError(null);
    setSendSuccess(null);
    setLoading(true);
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

      const ts = Math.floor(new Date(Date.UTC(y, m - 1, d)).getTime() / 1000);
      const aaKey = deriveAaPrivateKey(ts, password);
      const ownerHex = bytesToHex(aaKey) as `0x${string}`;

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
        ownerPrivateKeyHex: ownerHex,
      });
      setSendSuccess(hash);
      setMessageText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsSending(false);
      setLoading(false);
    }
  };

  const handleLoadInbox = async () => {
    if (!config || !env || !inboxAddr) return;
    if (!/^0x[a-fA-F0-9]{40}$/.test(inboxAddr)) {
      setError("Invalid address");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const ids = await getInboxMessageIds(config, env.VITE_RPC_URL, inboxAddr as Address);
      const [y, m, d] = birthday.split("-").map(Number);
      if (!y || !m || !d || !password) {
        setError("Enter birthday and password to decrypt");
        return;
      }
      const ts = Math.floor(new Date(Date.UTC(y, m - 1, d)).getTime() / 1000);
      const aaKey = deriveAaPrivateKey(ts, password);
      const { privateKey } = deriveEncryptionKeyPair(aaKey);
      const decrypted: { id: bigint; plaintext: string }[] = [];
      for (const id of ids) {
        const msg = await fetchMessage(config, env.VITE_RPC_URL, id);
        const raw =
          typeof msg.ciphertext === "string"
            ? hexToBytes(msg.ciphertext)
            : new Uint8Array(msg.ciphertext as ArrayBuffer);
        const plain = decryptWithPrivateKey(raw, privateKey);
        decrypted.push({ id, plaintext: new TextDecoder().decode(plain) });
      }
      setInboxMessages(decrypted);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
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

  return (
    <div className="app">
      <h1>Private Mail</h1>
      <nav>
        <button onClick={() => setScreen("home")}>Home</button>
        <button onClick={() => setScreen("register")}>Register</button>
        <button onClick={() => setScreen("compose")}>Compose</button>
        <button onClick={() => setScreen("inbox")}>Inbox</button>
      </nav>

      {screen === "home" && (
        <div className="panel">
          <p>Connect and derive identity from birthday + password.</p>
          <p>Contract: {config.PrivateMail.address}</p>
        </div>
      )}

      {screen === "register" && (
        <div className="panel">
          <h2>Register public key</h2>
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
          <button onClick={handleDerive} disabled={isDeriving}>
            {isDeriving ? "Deriving…" : "Derive address"}
          </button>

          {derivedAddress && (
            <>
              <p className="address-row">
                <strong>Your address:</strong>{" "}
                <code title={derivedAddress}>
                  {derivedAddress.slice(0, 10)}…{derivedAddress.slice(-8)}
                </code>
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(derivedAddress)}
                  title="Copy"
                >
                  Copy
                </button>
              </p>
              <p>
                <strong>USDC balance:</strong>{" "}
                {usdcBalance !== null ? formatUnits(usdcBalance, 6) : "—"}
              </p>
              <p>
                <strong>Registered:</strong> {registered === true ? "Yes" : registered === false ? "No" : "—"}
              </p>
              <button onClick={handleRefreshBalance} disabled={isRefreshing}>
                {isRefreshing ? "Refreshing…" : "Refresh balance"}
              </button>
              {isAnvil &&
                env.VITE_ENABLE_ANVIL_WHALE_FUNDING !== "false" && (
                  <button onClick={handleLoadFromWhale} disabled={isFunding}>
                    {isFunding ? "Loading…" : "Load 10 USDC from whale"}
                  </button>
                )}
              <button onClick={handleRegister} disabled={!canRegister || isRegistering}>
                {isRegistering ? "Registering…" : "Register"}
              </button>
              {registerSuccess && (
                <p className="success">Registered. Tx: {registerSuccess.slice(0, 18)}…</p>
              )}
            </>
          )}
        </div>
      )}

      {screen === "compose" && (
        <div className="panel">
          <h2>Compose</h2>
          <input
            type="date"
            placeholder="Your birthday"
            value={birthday}
            onChange={(e) => setBirthday(e.target.value)}
          />
          <input
            type="password"
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
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
          <button onClick={handleSend} disabled={isSending || loading}>
            {isSending ? "Sending…" : "Send"}
          </button>
          {sendSuccess && (
            <p className="success">Sent. Tx: {sendSuccess.slice(0, 18)}…</p>
          )}
        </div>
      )}

      {screen === "inbox" && (
        <div className="panel">
          <h2>Inbox</h2>
          <input
            type="date"
            placeholder="Your birthday"
            value={birthday}
            onChange={(e) => setBirthday(e.target.value)}
          />
          <input
            type="password"
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <input
            placeholder="Your address"
            value={inboxAddr}
            onChange={(e) => setInboxAddr(e.target.value)}
          />
          <button onClick={handleLoadInbox} disabled={loading}>
            {loading ? "Loading…" : "Load inbox"}
          </button>
          <ul>
            {inboxMessages.map((m) => (
              <li key={m.id.toString()}>
                <strong>#{m.id.toString()}</strong> {m.plaintext}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="error">{error}</p>}
    </div>
  );
}

export default App;
