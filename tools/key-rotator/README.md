# Project5 Key Rotator

Rotates `CONTRACT_DEPLOYER_PRIVATE_KEY` in `.env.prod` and validates the new address is a plain EOA on the target chain.

## Usage

From project5 root:

```bash
cd tools/key-rotator
npm install
node rotate-env-prod-keys.js
```

With options:

```bash
node rotate-env-prod-keys.js --env ../../.env.prod --rpc https://rpc.ankr.com/polygon
```

## Options

| Option | Description |
|--------|-------------|
| `--env <path>` | Path to .env.prod (default: `.env.prod` in cwd) |
| `--rpc <url>` | RPC URL for EOA validation (default: `TOOLS_RPC_URL` from env file) |
| `--max-attempts <n>` | Max generation attempts (default: 25) |

## Behaviour

1. Reads `TOOLS_RPC_URL` from the env file (or `--rpc`).
2. Generates a random wallet and checks `eth_getCode` returns `0x` (plain EOA).
3. Replaces `CONTRACT_DEPLOYER_PRIVATE_KEY` in the env file.
4. Creates a timestamped backup (`.env.prod.bak.<ts>`).
