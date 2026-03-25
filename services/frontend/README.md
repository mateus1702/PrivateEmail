# PrivateMail Frontend

React frontend for PrivateMail, the encrypted email dApp. Uses the NoKYC-GasStation paymaster for gas sponsorship.

## Sponsor SDK

The Sponsor SDK (`src/lib/sponsor-sdk`) handles paymaster sponsorship, cost confirmation, and quote TTL. See the root [README](../../README.md) for the full dApp Integration Guide and API reference.

## Commands

| Command | Description |
|---------|-------------|
| `yarn dev` | Start dev server (default port 5174) |
| `yarn build` | Production build |

## Environment

Required `VITE_*` variables. See root `.env.example` and `services/frontend/.env.example` for details. Key:

- `VITE_PRIVATE_MAIL_ADDRESS` – Contract address from deploy output
- `VITE_RPC_URL` – Chain RPC
- `VITE_BUNDLER_URL` – ERC-4337 bundler
- `VITE_PAYMASTER_API_URL` – Paymaster API base URL
