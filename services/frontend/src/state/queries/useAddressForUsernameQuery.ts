/**
 * React Query hook for resolving address by username.
 */

import { useQuery } from "@tanstack/react-query";
import { getAddressForUsername } from "../../lib/contracts";
import type { ContractsConfig } from "../../lib/config";
import { queryKeys } from "../queryKeys";

export interface UseAddressForUsernameQueryInput {
  config: ContractsConfig | null;
  rpcUrl: string;
  username: string | null;
  enabled?: boolean;
}

export function useAddressForUsernameQuery({
  config,
  rpcUrl,
  username,
  enabled = true,
}: UseAddressForUsernameQueryInput) {
  const trimmed = username?.trim().toLowerCase() ?? "";
  return useQuery({
    queryKey: queryKeys.addressByUsername(rpcUrl, trimmed),
    queryFn: () => getAddressForUsername(config!, rpcUrl, trimmed),
    enabled: enabled && !!config && trimmed.length > 0,
  });
}
