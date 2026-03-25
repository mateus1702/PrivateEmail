/**
 * React Query hook for resolving username by address.
 */

import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { getUsernameForAddress } from "../../lib/contracts";
import type { ContractsConfig } from "../../lib/config";
import { queryKeys } from "../queryKeys";

export interface UseUsernameForAddressQueryInput {
  config: ContractsConfig | null;
  rpcUrl: string;
  address: string | null;
  enabled?: boolean;
}

export function useUsernameForAddressQuery({
  config,
  rpcUrl,
  address,
  enabled = true,
}: UseUsernameForAddressQueryInput) {
  return useQuery({
    queryKey: queryKeys.usernameByAddress(rpcUrl, address ?? ""),
    queryFn: () =>
      getUsernameForAddress(config!, rpcUrl, address as Address),
    enabled: enabled && !!config && !!address,
  });
}
