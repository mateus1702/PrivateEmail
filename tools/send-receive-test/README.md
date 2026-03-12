# Send-Receive Test

End-to-end test for the PrivateMail contract: sends an encrypted message from one account to another, then fetches and decrypts it to verify the full flow.

## Prerequisites

1. **Contract deployed** – run from project root:
   ```bash
   cd contracts && npm run deploy:localhost
   ```

2. **Local node running** – Hardhat node (or compatible) on port 8545 with funded accounts from the test mnemonic.

3. **Environment** – `.env` in project root (see TOOLS section). Required: all `TOOLS_*` vars plus `CONTRACT_DEPLOYER_MNEMONIC`.

## Usage

From the tool directory:

```bash
cd tools/send-receive-test
npm install
npm run run
```

With optional overrides:

```bash
MESSAGE="Custom test message" npm run run
TOOLS_RPC_URL=http://localhost:8545 npm run run
npm run run -- --message "Custom text" --rpc http://localhost:8545
```

## What It Does

1. Loads config from project root `.env` and `deploy-output/mail-address.txt`
2. Derives sender (account 0) and recipient (account 1) from mnemonic
3. Registers both with `registerPublicKey` if not already registered
4. Encrypts the message with the recipient’s public key (X25519 + XChaCha20-Poly1305)
5. Sends via `sendMessage(recipient, ciphertext, contentHash)`
6. Fetches the latest message from the recipient’s inbox
7. Decrypts and verifies `keccak256(decrypted) === contentHash`
8. Prints `SUCCESS: Sent and received message: "<plaintext>"`

## Anvil / Polygon Fork

When running against an Anvil node (e.g. `anvil --fork-url <polygon_rpc>`), the test detects Anvil and automatically:

1. **Funds ETH** – sets 1 ETH balance on sender and recipient so they can pay gas
2. **Funds USDC from whales** – impersonates known USDC holders and transfers 0.5 USDC to each account (for paymaster/AA scenarios or future use)

Whale candidates and USDC address can be overridden via env:

| Env var | Description |
|--------|-------------|
| `TOOLS_USDC_ADDRESS` | USDC token address (or `VITE_USDC_ADDRESS`) |
| `TOOLS_ANVIL_WHALE_CANDIDATES` | Comma-separated whale addresses |
| `TOOLS_USDC_FUND_AMOUNT` | USDC amount (6 decimals) to fund each account |

## Configuration

| Env var | Description |
|--------|-------------|
| `TOOLS_RPC_URL` | Chain RPC URL |
| `TOOLS_CHAIN_ID` | Chain ID |
| `TOOLS_MAIL_ADDRESS_FILE` | Path to contract address file |
| `CONTRACT_DEPLOYER_MNEMONIC` | Mnemonic for sender/recipient |
