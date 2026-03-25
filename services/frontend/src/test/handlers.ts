/**
 * MSW handlers for integration tests.
 * Mocks RPC, paymaster, and bundler endpoints.
 */

import { http, HttpResponse } from "msw";

const RPC_URL = "https://rpc.example.com";
const PAYMASTER_URL = "https://paymaster.example.com";
const BUNDLER_URL = "https://bundler.example.com";

export const handlers = [
  http.post(RPC_URL, async ({ request }) => {
    const body = (await request.json()) as { method?: string; params?: unknown[] };
    const method = body.method;
    if (method === "anvil_impersonateAccount") {
      return HttpResponse.json({ jsonrpc: "2.0", id: 1, result: true });
    }
    if (method === "anvil_stopImpersonatingAccount") {
      return HttpResponse.json({ jsonrpc: "2.0", id: 2, result: true });
    }
    if (method === "eth_call") {
      return HttpResponse.json({ jsonrpc: "2.0", id: 1, result: "0x" });
    }
    return HttpResponse.json({ jsonrpc: "2.0", id: 1, result: null });
  }),

  http.post(PAYMASTER_URL, async ({ request }) => {
    const body = (await request.json()) as { method?: string };
    if (body.method === "pm_sponsorUserOperation") {
      return HttpResponse.json({
        jsonrpc: "2.0",
        id: 1,
        result: {
          paymaster: "0x123",
          paymasterData: "0x",
          paymasterVerificationGasLimit: "100000",
          paymasterPostOpGasLimit: "50000",
          estimatedBaseCostUsdcE6: "100000",
          estimatedReferralUsdcE6: "0",
          estimatedTotalCostUsdcE6: "100000",
          maxBaseCostUsdcE6: "120000",
          maxReferralUsdcE6: "0",
          maxTotalCostUsdcE6: "120000",
          estimatedGas: "200000",
          validUntil: String(Math.floor(Date.now() / 1000) + 300),
        },
      });
    }
    if (request.url.endsWith("/paymaster-address")) {
      return HttpResponse.json({ paymasterAddress: "0x1234567890123456789012345678901234567890" });
    }
    return HttpResponse.json({ jsonrpc: "2.0", id: 1, result: null });
  }),

  http.post(BUNDLER_URL, async ({ request }) => {
    const body = (await request.json()) as { method?: string };
    if (body.method === "eth_sendUserOperation") {
      return HttpResponse.json({
        jsonrpc: "2.0",
        id: 1,
        result: "0xuserophash123",
      });
    }
    if (body.method === "eth_getUserOperationReceipt") {
      return HttpResponse.json({
        jsonrpc: "2.0",
        id: 1,
        result: {
          receipt: { transactionHash: "0xtxhash123" },
        },
      });
    }
    return HttpResponse.json({ jsonrpc: "2.0", id: 1, result: null });
  }),
];
