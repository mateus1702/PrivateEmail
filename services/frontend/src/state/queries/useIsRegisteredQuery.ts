/**
 * React Query hook for registration status of an address.
 */

import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { isRegistered } from "../../lib/contracts";
import type { ContractsConfig } from "../../lib/config";
import { queryKeys } from "../queryKeys";

export interface UseIsRegisteredQueryInput {
  config: ContractsConfig | null;
  rpcUrl: string;
  address: string | null;
  enabled?: boolean;
}

export function useIsRegisteredQuery({
  config,
  rpcUrl,
  address,
  enabled = true,
}: UseIsRegisteredQueryInput) {
  return useQuery({
    queryKey: queryKeys.registrationStatus(rpcUrl, address ?? ""),
    queryFn: () =>
      isRegistered(config!, rpcUrl, address as Address),
    enabled: enabled && !!config && !!address,
  });
}
