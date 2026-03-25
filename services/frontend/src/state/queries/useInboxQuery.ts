/**
 * React Query infinite hook for paginated inbox.
 */

import { useInfiniteQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { loadInboxData } from "../../application";
import type { ContractsConfig } from "../../lib/config";
import { queryKeys } from "../queryKeys";

export interface UseInboxQueryInput {
  config: ContractsConfig | null;
  rpcUrl: string;
  recipient: string | null;
  enabled?: boolean;
}

export function useInboxQuery({
  config,
  rpcUrl,
  recipient,
  enabled = true,
}: UseInboxQueryInput) {
  return useInfiniteQuery({
    queryKey: queryKeys.inboxList(rpcUrl, recipient ?? ""),
    queryFn: async ({ pageParam }) => {
      const result = await loadInboxData({
        config: config!,
        rpcUrl,
        recipient: recipient as Address,
        pageId: pageParam as bigint,
      });
      return result;
    },
    initialPageParam: 0n as bigint,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.prevPageId : undefined,
    enabled: enabled && !!config && !!recipient,
  });
}
