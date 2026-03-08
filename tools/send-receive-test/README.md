# Send-Receive Test

End-to-end test: create 2 accounts, register both, send a message, receive it.

## Prereqs

1. AA stack running: Anvil, bundler, paymaster
2. PrivateMail deployed; copy `deploy-output/contracts.json` to `services/frontend/public/config/contracts.json`
3. **Polygon fork required**: Start Anvil with `--fork-url https://polygon-rpc.com` so USDC and whale balances exist
4. **Chain ID match**: Set `CHAIN_ID=137` if your AA stack (bundler, paymaster) expects Polygon; or use 31337 if using local Anvil chain with matching AA deployment
5. **Paymaster whitelist**: Ensure the paymaster accepts calls to the PrivateMail contract address. If using project4's paymaster, it may need to be updated to whitelist the PrivateMail contract

## Run

```bash
cd tools/send-receive-test
pnpm install
pnpm test
```

## Env (optional)

| Var | Default |
|-----|---------|
| RPC_URL | http://127.0.0.1:8545 |
| BUNDLER_URL | http://127.0.0.1:4337 |
| PAYMASTER_URL | http://127.0.0.1:3000 |
| USDC_ADDRESS | 0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359 |
| CHAIN_ID | From contracts.json, else 137 (Polygon fork) |
| USDC_FUND_AMOUNT | 10 |

For Polygon fork, set `CHAIN_ID=137` so it matches the fork.

## Flow

1. Load config from `services/frontend/public/config/contracts.json`
2. Create alice (Anvil #0) and bob (Anvil #1) SimpleAccounts
3. Fund both with USDC via whale impersonation
4. Register both with PrivateMail via AA (approve + registerPublicKey)
5. Send message from alice to bob via AA sendMessage
6. Query MessageSent events and getMessage to verify receive
