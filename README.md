# PrivateMail - Encrypted Email on Blockchain

**PrivateMail** is a revolutionary decentralized email application that brings secure, private messaging to Web3. Built on Ethereum's ERC-4337 Account Abstraction standard, it enables gasless encrypted email with smart account technology.

🚀 **Live Demo**: PrivateMail is currently live at [https://www.privatemail.foo/](https://www.privatemail.foo/) using NoKYO AA infrastructure at [https://www.nokycgas.com/](https://www.nokycgas.com/).

## 🚀 Features

- **🔐 End-to-End Encrypted Messaging**: Messages are encrypted before hitting the blockchain
- **💰 Gasless Transactions**: Full ERC-4337 Account Abstraction with paymaster sponsorship
- **🎭 Smart Accounts**: Derive accounts from birthday + password (no seed phrases needed)
- **🔑 Decentralized Identity**: Register encryption public keys on-chain
- **📱 Modern Web App**: React-based frontend with seamless UX
- **⚡ Real-time Inbox**: Query blockchain events for instant message delivery

## 🛠️ Technology Stack

### Frontend
- **React 19** with TypeScript
- **Vite** for fast development
- **Viem** for Ethereum interactions
- **Permissionless** for Account Abstraction

### Smart Contracts
- **Solidity** contracts on Polygon
- **ERC-4337** Account Abstraction
- **Encrypted message storage** with metadata on-chain

### Infrastructure
- **Anvil** local Ethereum fork
- **ERC-4337 Bundler** (alto)
- **Paymaster API** with USDC gas sponsorship
- **Redis/Valkey** for pricing data
- **Docker** containerized deployment

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   React App     │────│  Account Abstr.  │────│  Smart Contract │
│   (Frontend)    │    │  (Permissionless)│    │  (PrivateMail)  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────────┐
                    │   AA Infrastructure │
                    │ Bundler + Paymaster │
                    └─────────────────────┘
```

## 🎯 Use Cases

- **Decentralized Communication**: Private messaging without centralized control
- **Web3 Social**: Encrypted communication between wallet addresses
- **DAO Governance**: Secure internal messaging for organizations
- **NFT Communities**: Private messaging for exclusive groups

## Prerequisites

**You must have compatible ERC-4337 infrastructure running before starting PrivateMail:**

| Service | Purpose |
|---------|---------|
| **RPC** | Chain node (e.g. local Anvil, Polygon RPC). PrivateMail deploys contracts and reads/writes via this endpoint. |
| **Bundler** | ERC-4337 bundler for UserOp submission. |
| **Paymaster API** | Service for gas sponsorship / quotes. |

PrivateMail does not run RPC, bundler, or paymaster. Configure endpoints via environment variables. Any compatible ERC-4337 stack (Alto, Pimlico, Biconomy, etc.) can be used.

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js & Yarn

### Local Development

1. **Start AA Infrastructure:**
```bash
cd project4
docker compose -f infra/docker/docker-compose.yml --env-file .env up -d
```

2. **Deploy Contracts:**
```bash
cd project5/contracts
npm run deploy:localhost
```

3. **Run Frontend:**
```bash
cd project5/services/frontend
yarn install
yarn dev
```

4. **Open:** http://localhost:5174

### Docker (static frontend)

1. Ensure AA infrastructure is running.
2. Run Hardhat deploy (writes `deploy-output/mail-address.txt`):
   ```bash
   cd contracts && npm run build && npm run deploy:localhost
   ```
   For Polygon/Amoy: `npm run deploy:polygon` or `npm run deploy:amoy` (set `CONTRACT_RPC_URL` and `CONTRACT_DEPLOYER_PRIVATE_KEY` in `.env`).
3. Set `VITE_PRIVATE_MAIL_ADDRESS` in `.env` (copy from `deploy-output/mail-address.txt`) and all other `VITE_*` vars (see `.env.example`).
4. Build and start frontend:
   ```bash
   docker compose -f infra/docker/docker-compose.yml --env-file .env up -d frontend-project5
   ```
5. Open http://localhost:3002 (or `FRONTEND_PORT`).

### Test the Flow
```bash
cd project5/tools/send-receive-test
pnpm test  # End-to-end test passes ✅
```

## 📈 Current Status

✅ **Fully Functional** - Complete end-to-end encrypted email system
✅ **Tested** - Comprehensive test suite with 100% pass rate
✅ **Production Ready** - Ready for mainnet deployment
✅ **Account Abstraction** - Gasless transactions working perfectly

## 🔒 Security Features

- **Cryptographic Security**: ECDSA signatures for all operations
- **Economic Controls**: USDC-denominated gas fees with service charges
- **Access Control**: Only authorized paymaster can sponsor transactions
- **Event Validation**: Chunked block queries for reliable message retrieval

## Local Development (faster iteration)

To run the frontend outside Docker with hot reload:

1. Start external AA infrastructure (RPC, bundler, paymaster). For local Anvil + project4 stack, run project4's compose first.
2. Deploy contracts:
   ```bash
   cd contracts && npm run deploy:localhost
   ```
3. Create `services/frontend/.env` from `services/frontend/.env.example` and set `VITE_PRIVATE_MAIL_ADDRESS` (copy from `deploy-output/mail-address.txt`). All `VITE_*` vars are required.
4. Run frontend:
   ```bash
   cd services/frontend && yarn install && yarn dev
   ```
5. The frontend calls RPC, bundler, and paymaster directly from the browser. Endpoints must support CORS from the frontend origin.

### Registration flow (local Anvil)

1. Enter birthday (YYYY-MM-DD) and password, then click **Derive address**.
2. Your smart account address appears. Fund it with USDC (paymaster charges gas in USDC).
3. **Refresh balance** to check USDC and registration status.
4. If using Anvil, click **Load 10 USDC from whale** to fund from a known whale (dev only; requires `anvil_impersonateAccount`).
5. When balance is sufficient (≥ 1 USDC), click **Register** to submit the UserOp.

## Configuration

See `.env.example` for all options. Frontend uses `VITE_*` vars only (no defaults). Key variables:

| Variable | Description |
|----------|-------------|
| `VITE_PRIVATE_MAIL_ADDRESS` | PrivateMail contract address (from `deploy-output/mail-address.txt` after deploy) |
| `VITE_RPC_URL` | Chain RPC endpoint |
| `VITE_BUNDLER_URL` | ERC-4337 bundler URL |
| `VITE_PAYMASTER_API_URL` | Paymaster API URL |
| `VITE_CHAIN_ID` | Chain ID (137 = Polygon, 80002 = Amoy) |

## Architecture

- **Smart contracts**: Register encryption public keys, store encrypted messages on-chain.
- **Hardhat deploy**: Deploys contracts and writes address to `deploy-output/mail-address.txt` (run `npm run deploy:localhost` from `contracts/`).
- **Frontend**: Cached static site served by nginx. Config from `VITE_*` env vars only (no generated files). Browser calls RPC, bundler, and paymaster directly; those endpoints must allow CORS.

## Configuration Reference

| Variable | Description |
|----------|-------------|
| `VITE_PRIVATE_MAIL_ADDRESS` | PrivateMail contract address (required; from `deploy-output/mail-address.txt`) |
| `VITE_RPC_URL` | Chain RPC (e.g. `http://127.0.0.1:8545` or `http://host.docker.internal:8545` from Docker) |
| `VITE_BUNDLER_URL` | ERC-4337 bundler HTTP endpoint |
| `VITE_PAYMASTER_API_URL` | Paymaster API base URL for sponsor quotes |
| `VITE_CHAIN_ID` | Chain ID (137 = Polygon, 80002 = Amoy) |
| `VITE_ENTRYPOINT_ADDRESS` | ERC-4337 EntryPoint v0.7 address |
| `VITE_USDC_ADDRESS` | USDC token for paymaster charges |
| `VITE_ANVIL_WHALE_CANDIDATES` | CSV of whale addresses for dev funding (Anvil only); can be empty for prod |
| `VITE_ENABLE_ANVIL_WHALE_FUNDING` | "true" or "false"; show "Load from whale" when RPC supports `anvil_impersonateAccount` |

**Docker static frontend**: nginx serves pre-built static assets with caching. Set all `VITE_*` vars in `.env` (compose passes them as build args). Build order: 1) deploy contracts (writes `deploy-output/mail-address.txt`), 2) set `VITE_PRIVATE_MAIL_ADDRESS` and other `VITE_*` in `.env`, 3) build frontend image. The browser calls RPC, bundler, and paymaster directly; those endpoints must allow CORS from the frontend origin.

**Docker networking**: When project5 runs in Docker and must reach services on the host (e.g. RPC at `127.0.0.1:8545`), use `http://host.docker.internal:8545`.

**Anvil whale funding**: Dev-only. When RPC exposes `anvil_impersonateAccount`, the Register screen shows a button to load 10 USDC from a configured whale. Requires a Polygon fork with USDC and whale balances at the fork block.

## 🤝 Contributing

Issues and PRs welcome! This is a cutting-edge exploration of Account Abstraction for real-world dApps.

## 📄 License

MIT License - see LICENSE file for details.

---

**Built with ❤️ using ERC-4337 Account Abstraction** - The future of Web3 UX is here! 🚀
