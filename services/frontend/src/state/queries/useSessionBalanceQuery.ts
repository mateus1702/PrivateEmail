/**
 * React Query hook for USDC balance of a session address.
 */

import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { getUsdcBalance } from "../../lib/contracts";
import { queryKeys } from "../queryKeys";

const DEFAULT_USDC =
  "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359" as Address;

export interface UseSessionBalanceQueryInput {
  rpcUrl: string;
  usdcAddress?: string;
  sessionAddress: string | null;
  enabled?: boolean;
}

export function useSessionBalanceQuery({
  rpcUrl,
  usdcAddress = DEFAULT_USDC,
  sessionAddress,
  enabled = true,
}: UseSessionBalanceQueryInput) {
  return useQuery({
    queryKey: queryKeys.balance(rpcUrl, usdcAddress, sessionAddress ?? ""),
    queryFn: () =>
      getUsdcBalance(rpcUrl, usdcAddress as Address, sessionAddress as Address),
    enabled: enabled && !!sessionAddress,
    refetchInterval: 30_000,
  });
}
