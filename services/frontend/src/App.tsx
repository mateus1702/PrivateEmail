import { useState, useEffect, useCallback, useRef } from "react";
import { getConfig, getEnv, type ContractsConfig, type EnvConfig } from "./lib/config";
import {
  createMailClient,
  getUsdcBalance,
  isRegistered,
  loadInboxPage,
  getFullCiphertext,
  getAddressForUsername,
  getUsernameForAddress,
  type Message,
} from "./lib/contracts";
import {
  submitRegisterPublicKey,
  submitRegisterUsername,
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
import { parseBirthdayMask, formatBirthdayInput } from "./lib/parseBirthdayMask";
import { formatUnits, parseUnits, keccak256 } from "viem";
import type { Address } from "viem";
import "./App.css";

const MIN_USDC_FOR_REGISTER = parseUnits("0.5", 6);
const WHALE_FUND_AMOUNT = parseUnits("0.5", 6);
const INBOX_POLL_INTERVAL_MS = 30000;

const READ_STORAGE_KEY = (addr: string) => `pm_read_${addr.toLowerCase()}`;

function getMessageKey(msg: Message): string {
  return `${msg.sender.toLowerCase()}-${msg.recipient.toLowerCase()}-${msg.timestamp}-${msg.contentHash}`;
}

function loadReadKeys(addr: string): Set<string> {
  try {
    const raw = localStorage.getItem(READ_STORAGE_KEY(addr));
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function persistReadKeys(addr: string, keys: Set<string>): void {
  try {
    localStorage.setItem(READ_STORAGE_KEY(addr), JSON.stringify([...keys]));
  } catch {
    /* ignore */
  }
}

type Screen = "login" | "register" | "logged";

function App() {
  const [config, setConfig] = useState<ContractsConfig | null>(null);
  const [env, setEnv] = useState<EnvConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>("login");
  const [birthday, setBirthday] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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
  const [registerUsername, setRegisterUsername] = useState("");

  // Session state (cleared on logout)
  const [sessionAddress, setSessionAddress] = useState<string | null>(null);
  const [sessionOwnerPrivateKeyHex, setSessionOwnerPrivateKeyHex] = useState<`0x${string}` | null>(null);
  const [sessionUsdcBalance, setSessionUsdcBalance] = useState<bigint | null>(null);
  const [isRefreshingSessionBalance, setIsRefreshingSessionBalance] = useState(false);

  const [composeModalOpen, setComposeModalOpen] = useState(false);
  const [inboxPages, setInboxPages] = useState<Message[]>([]);
  const [inboxNextPageId, setInboxNextPageId] = useState<bigint>(0n);
  const [inboxHasMore, setInboxHasMore] = useState(true);
  const [isLoadingInbox, setIsLoadingInbox] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [decryptedContent, setDecryptedContent] = useState<string | null>(null);
  const [messageModalOpen, setMessageModalOpen] = useState(false);
  const [sessionUsername, setSessionUsername] = useState<string | null>(null);
  const [senderUsernames, setSenderUsernames] = useState<Map<string, string | null>>(new Map());
  const [sendToast, setSendToast] = useState(false);
  const [readMessageKeys, setReadMessageKeys] = useState<Set<string>>(new Set());

  const inboxPagesRef = useRef(inboxPages);
  const inboxNextPageIdRef = useRef(inboxNextPageId);
  useEffect(() => {
    inboxPagesRef.current = inboxPages;
    inboxNextPageIdRef.current = inboxNextPageId;
  }, [inboxPages, inboxNextPageId]);

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
    try {
      setEnv(getEnv());
      setConfig(getConfig());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
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

  useEffect(() => {
    if (!sessionAddress) {
      setSessionUsername(null);
      return;
    }
    setSessionUsername(null); // clear while loading
    let cancelled = false;
    (async () => {
      if (!config || !env) return;
      try {
        const onChain = await getUsernameForAddress(
          config,
          env.VITE_RPC_URL,
          sessionAddress as Address
        );
        if (!cancelled && onChain) {
          setSessionUsername(onChain);
          try {
            localStorage.setItem(`pm_username_${sessionAddress.toLowerCase()}`, onChain);
          } catch {
            /* ignore */
          }
          return;
        }
      } catch {
        /* ignore; fall back to localStorage */
      }
      if (cancelled) return;
      try {
        const stored = localStorage.getItem(`pm_username_${sessionAddress.toLowerCase()}`);
        setSessionUsername(stored ?? null);
      } catch {
        setSessionUsername(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionAddress, config, env]);

  useEffect(() => {
    if (!sessionAddress) {
      setReadMessageKeys(new Set());
      return;
    }
    setReadMessageKeys(loadReadKeys(sessionAddress));
  }, [sessionAddress]);

  const handleContinue = async () => {
    if (!config || !env) return;
    const ts = parseBirthdayMask(birthday);
    if (ts === null) {
      setError("Enter birthday (MM/DD/YYYY)");
      return;
    }
    if (!password || password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setIsContinueLoading(true);
    setError(null);
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
    const username = registerUsername.trim().toLowerCase();
    if (username.length < 3 || username.length > 32) {
      setError("Please enter a username (3-32 characters)");
      return;
    }
    if (usdcBalance === null || usdcBalance < MIN_USDC_FOR_REGISTER) {
      setError(
        `Need at least 0.5 USDC. Send USDC to: ${derivedAddress}`
      );
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

    const existingOwner = await getAddressForUsername(config, env.VITE_RPC_URL, username);
    if (existingOwner && existingOwner.toLowerCase() !== derivedAddress.toLowerCase()) {
      setError("Username is already taken");
      return;
    }

    setIsRegistering(true);
    setError(null);
    setRegisterSuccess(null);
    const aaConfig = {
      bundlerUrl: env.VITE_BUNDLER_URL,
      paymasterApiUrl: env.VITE_PAYMASTER_API_URL,
      rpcUrl: env.VITE_RPC_URL,
      entryPointAddress: env.VITE_ENTRYPOINT_ADDRESS ?? "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
      chainId: parseInt(env.VITE_CHAIN_ID, 10),
      usdcAddress: env.VITE_USDC_ADDRESS ?? "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    };
    try {
      const hash = await submitRegisterPublicKey(aaConfig, {
        mailAddress: config.PrivateMail.address as Address,
        pubKeyHex: derivedPubKeyHex,
        ownerPrivateKeyHex,
      });
      await submitRegisterUsername(aaConfig, {
        mailAddress: config.PrivateMail.address as Address,
        username,
        ownerPrivateKeyHex,
      });
      setRegisterSuccess(hash);
      setRegistered(true);
      setRegisterUsername("");
      setSessionUsername(username);
      try {
        localStorage.setItem(`pm_username_${derivedAddress.toLowerCase()}`, username);
      } catch {
        /* ignore */
      }
      storeSession(derivedAddress, ownerPrivateKeyHex);
    } catch (e) {
      // Some bundlers intermittently fail on receipt polling even when tx succeeded on-chain.
      try {
        const regNow = await isRegistered(config, env.VITE_RPC_URL, derivedAddress as Address);
        if (regNow) {
          try {
            await submitRegisterUsername(aaConfig, {
              mailAddress: config.PrivateMail.address as Address,
              username,
              ownerPrivateKeyHex,
            });
          } catch (usernameErr) {
            const msg = usernameErr instanceof Error ? usernameErr.message : String(usernameErr);
            const isUsernameTaken =
              msg.includes("0x2b4e2567") || msg.toLowerCase().includes("usernametaken");
            setError(isUsernameTaken ? "Username is already taken" : msg);
            return;
          }
          setRegistered(true);
          setRegisterUsername("");
          setSessionUsername(username);
          try {
            localStorage.setItem(`pm_username_${derivedAddress.toLowerCase()}`, username);
          } catch {
            /* ignore */
          }
          storeSession(derivedAddress, ownerPrivateKeyHex);
          return;
        }
      } catch {
        // Ignore fallback read errors and preserve original AA error.
      }
      const errMsg = e instanceof Error ? e.message : String(e);
      const isUsernameTaken =
        errMsg.includes("0x2b4e2567") || errMsg.toLowerCase().includes("usernametaken");
      setError(isUsernameTaken ? "Username is already taken" : errMsg);
    } finally {
      setIsRegistering(false);
    }
  };

  const handleBack = useCallback(() => {
    setBirthday("");
    setPassword("");
    setConfirmPassword("");
    setRegisterUsername("");
    clearDerivedState();
    setScreen("login");
    setError(null);
  }, [clearDerivedState]);

  const handleLogout = useCallback(() => {
    setSessionAddress(null);
    setSessionOwnerPrivateKeyHex(null);
    setSessionUsername(null);
    setSessionUsdcBalance(null);
    setInboxPages([]);
    setInboxNextPageId(0n);
    setInboxHasMore(true);
    setSenderUsernames(new Map());
    setReadMessageKeys(new Set());
    setScreen("login");
    setComposeModalOpen(false);
    setMessageModalOpen(false);
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

  const handleLoadInbox = useCallback(
    async (append: boolean) => {
      if (!config || !env || !sessionAddress) return;
      setIsLoadingInbox(true);
      setError(null);
      try {
        const pageId = append ? inboxNextPageIdRef.current : 0n;
        const page = await loadInboxPage(
          config,
          env.VITE_RPC_URL,
          sessionAddress as Address,
          pageId
        );
        const newMessages = append
          ? [...inboxPagesRef.current, ...page.messages]
          : page.messages;
        if (append) {
          setInboxPages((prev) => [...prev, ...page.messages]);
        } else {
          setInboxPages(page.messages);
        }
        setInboxNextPageId(page.prevPageId);
        setInboxHasMore(page.hasMore);
        const uniqueSenders = [...new Set(newMessages.map((m) => m.sender.toLowerCase()))];
        const results = await Promise.all(
          uniqueSenders.map((addr) =>
            getUsernameForAddress(config, env.VITE_RPC_URL, addr as Address)
          )
        );
        setSenderUsernames((prev) => {
          const next = new Map(prev);
          uniqueSenders.forEach((addr, i) => next.set(addr, results[i] ?? null));
          return next;
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setIsLoadingInbox(false);
      }
    },
    [config, env, sessionAddress]
  );

  useEffect(() => {
    if (screen === "logged" && sessionAddress && config && env) {
      handleLoadInbox(false);
    }
  }, [screen, sessionAddress, config, env]);

  useEffect(() => {
    if (screen !== "logged" || !sessionAddress) return;
    handleRefreshSessionBalance();
    handleLoadInbox(false);
    const interval = setInterval(() => {
      handleRefreshSessionBalance();
      handleLoadInbox(false);
    }, INBOX_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [screen, sessionAddress, handleRefreshSessionBalance, handleLoadInbox]);

  const handleOpenMessage = useCallback(
    async (msg: Message) => {
      if (!sessionOwnerPrivateKeyHex || !config || !env || !sessionAddress) return;
      setMessageModalOpen(true);
      setSelectedMessage(msg);
      setDecryptedContent(null);
      const key = getMessageKey(msg);
      setReadMessageKeys((prev) => {
        const next = new Set(prev);
        next.add(key);
        persistReadKeys(sessionAddress, next);
        return next;
      });
      try {
        const ciphertext = await getFullCiphertext(
          config,
          env.VITE_RPC_URL,
          msg
        );
        const { privateKey } = deriveEncryptionKeyPair(
          hexToBytes(sessionOwnerPrivateKeyHex)
        );
        const combined = hexToBytes(ciphertext);
        const plaintext = decryptWithPrivateKey(combined, privateKey);
        setDecryptedContent(new TextDecoder().decode(plaintext));
      } catch (e) {
        setDecryptedContent(
          e instanceof Error ? e.message : "Failed to decrypt"
        );
      }
    },
    [sessionOwnerPrivateKeyHex, config, env, sessionAddress]
  );

  const resolveRecipient = useCallback(
    async (input: string): Promise<Address | null> => {
      if (!config || !env) return null;
      const trimmed = input.trim();
      if (/^0x[a-fA-F0-9]{40}$/.test(trimmed)) return trimmed as Address;
      const addr = await getAddressForUsername(config, env.VITE_RPC_URL, trimmed);
      return addr;
    },
    [config, env]
  );

  const handleSend = async () => {
    if (!config || !env || !recipientAddr || !messageText || !sessionOwnerPrivateKeyHex) return;
    const trimmed = recipientAddr.trim();
    if (/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
      setError("Enter recipient by username only");
      return;
    }
    const resolved = await resolveRecipient(recipientAddr);
    if (!resolved) {
      setError("Invalid recipient: username not found");
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
        resolved,
      ]);
      const pk = recipientPubKey as string | Uint8Array | unknown;
      if (!pk || (typeof pk === "string" ? pk.length === 0 : (pk as Uint8Array).length === 0)) {
        setError("Recipient has not registered a public key");
        return;
      }
      const plaintext = new TextEncoder().encode(messageText);
      const recipPub =
        typeof pk === "string"
          ? hexToBytes(pk as `0x${string}`)
          : new Uint8Array(pk as ArrayBuffer);
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
      await submitSendMessage(aaConfig, {
        mailAddress: config.PrivateMail.address as Address,
        recipient: resolved,
        ciphertextHex,
        contentHash,
        ownerPrivateKeyHex: sessionOwnerPrivateKeyHex,
      });
      setSendSuccess(null);
      setMessageText("");
      setRecipientAddr("");
      setComposeModalOpen(false);
      setSendToast(true);
      setTimeout(() => setSendToast(false), 4000);
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
        <p>Set all required VITE_* env vars in .env (see .env.example).</p>
      </div>
    );
  }

  if (!config || !env) return <div className="app">Loading config…</div>;

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
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleContinue();
            }}
          >
            <input
              type="text"
              inputMode="numeric"
              placeholder="Birthday (MM/DD/YYYY)"
              value={birthday}
              onChange={(e) => setBirthday(formatBirthdayInput(e.target.value))}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <input
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <button type="submit" disabled={isContinueLoading}>
              {isContinueLoading ? "Checking…" : "Continue"}
            </button>
          </form>
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
          <input
            placeholder="Username (3-32 characters)"
            value={registerUsername}
            onChange={(e) => setRegisterUsername(e.target.value.toLowerCase())}
          />
          <p>
            <strong>Send at least 0.5 USDC to this address to complete registration:</strong>
          </p>
          <div className="address-row">
            <div className="address-content">
              <code title={derivedAddress ?? ""}>
                {derivedAddress ?? ""}
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
          <p>
            <strong>USDC balance:</strong>{" "}
            {usdcBalance !== null ? formatUnits(usdcBalance, 6) : "—"}
          </p>
          <button onClick={handleRefreshBalance} disabled={isRefreshing}>
            {isRefreshing ? "Refreshing…" : "Refresh balance"}
          </button>
          {isAnvil && env.VITE_ENABLE_ANVIL_WHALE_FUNDING !== "false" && (
            <button onClick={handleLoadFromWhale} disabled={isFunding}>
              {isFunding ? "Loading…" : "Load 0.5 USDC from whale"}
            </button>
          )}
          <button
            onClick={handleCompleteRegistration}
            disabled={isRegistering}
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
          <div className="logged-footer-username">
            <strong>User:</strong>{" "}
            {sessionUsername ?? "—"}
          </div>
          <div className="logged-footer-balance">
            <strong>USDC:</strong>{" "}
            {sessionUsdcBalance !== null ? formatUnits(sessionUsdcBalance, 6) : "—"}
            <button
              onClick={() => void handleRefreshSessionBalance()}
              disabled={isRefreshingSessionBalance}
              title="Refresh USDC balance"
              className="logged-footer-balance-refresh"
            >
              {isRefreshingSessionBalance ? "…" : "↻"}
            </button>
          </div>
        </div>
        <div className="logged-footer-actions">
          <button
            onClick={() => void handleLoadInbox(false)}
            disabled={isLoadingInbox}
            title="Refresh inbox"
          >
            {isLoadingInbox ? "Refreshing…" : "Refresh inbox"}
          </button>
          <button onClick={() => setComposeModalOpen(true)}>Compose</button>
          <button onClick={handleLogout}>Logout</button>
        </div>
      </footer>

      <div className="inbox-area">
        <div className="inbox-messages-container">
          {isLoadingInbox && inboxPages.length === 0 ? (
            <p className="inbox-loading">Loading…</p>
          ) : inboxPages.length === 0 ? (
            <p className="inbox-empty">No messages</p>
          ) : (
            <ul className="inbox-list">
              {inboxPages.map((msg, i) => (
                <li
                  key={i}
                  className="inbox-item"
                  onClick={() => void handleOpenMessage(msg)}
                >
                  {!readMessageKeys.has(getMessageKey(msg)) && (
                    <span className="inbox-badge-unread">unread</span>
                  )}
                  <span className="inbox-sender">
                    From: {senderUsernames.get(msg.sender.toLowerCase()) ?? "Unknown"}
                  </span>
                  <span className="inbox-meta">
                    <span className="inbox-time">
                      {new Date(Number(msg.timestamp) * 1000).toLocaleString()}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {inboxHasMore && (
            <button
              className="inbox-load-more"
              onClick={() => void handleLoadInbox(true)}
              disabled={isLoadingInbox}
            >
              {isLoadingInbox ? "Loading…" : "Load more"}
            </button>
          )}
        </div>
      </div>

      {messageModalOpen && selectedMessage && (
        <div className="modal-overlay" onClick={() => setMessageModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">Message</h2>
            <p className="message-sender">
              From: {senderUsernames.get(selectedMessage.sender.toLowerCase()) ?? "Unknown"}
            </p>
            <div className="message-content">
              {decryptedContent ?? "Decrypting…"}
            </div>
            <button
              type="button"
              className="modal-close-btn"
              onClick={() => setMessageModalOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {composeModalOpen && (
        <div
          className="modal-overlay"
          onClick={() => {
            setComposeModalOpen(false);
            setSendSuccess(null);
          }}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">Compose</h2>
            <input
              placeholder="Recipient (username)"
              value={recipientAddr}
              onChange={(e) => setRecipientAddr(e.target.value)}
            />
            <textarea
              placeholder="Message"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
            />
            <div className="modal-actions">
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => {
                  setComposeModalOpen(false);
                  setSendSuccess(null);
                }}
              >
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

      {sendToast && (
        <div className="toast toast-success" role="status">
          Message sent successfully
        </div>
      )}
      {error && (
          <div className="toast toast-error" role="alert">
            {error}
          </div>
        )}
    </div>
  );
}

export default App;
