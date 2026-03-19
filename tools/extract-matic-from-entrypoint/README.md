# Extract MATIC from EntryPoint

Withdraws deposited MATIC from an ERC-4337 EntryPoint v0.7 contract to a destination address.

## Configuration

Edit the hardcoded variables in `src/extract-matic-from-entrypoint.ts`:

| Variable | Description |
|----------|-------------|
| `RPC_URL` | Polygon RPC endpoint |
| `ENTRYPOINT_ADDRESS` | EntryPoint v0.7 contract (default: `0x0000000071727De22E5E9d8BAf0edAc6f37da032`) |
| `SENDER_PRIVATE_KEY` | Private key of the account that has the deposit (e.g. `ALTO_UTILITY_PRIVATE_KEY` or paymaster signer) |
| `DESTINATION_ADDRESS` | Address to receive the withdrawn MATIC |

## Usage

```bash
# From project root
npm run extract-matic              # Dry run: show balance only
npm run extract-matic -- --execute # Execute withdrawal

# From tool directory
cd tools/extract-matic-from-entrypoint
npm run run                        # Dry run
npm run run -- --execute           # Execute withdrawal
```

## Notes

- Only the account that deposited can call `withdrawTo`. Use the private key of the account whose `balanceOf` you want to withdraw.
- The EntryPoint holds deposits per account; typically bundler utility/executor keys or paymaster signer have deposits.
