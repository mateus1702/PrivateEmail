/**
 * Canonical query keys for React Query.
 * Use factories so invalidation can target specific or broad scopes.
 */

export const queryKeys = {
  balance: (rpcUrl: string, usdcAddress: string, accountAddress: string) =>
    ["balance", rpcUrl, usdcAddress, accountAddress] as const,

  inbox: (rpcUrl: string, recipient: string, pageId: string) =>
    ["inbox", rpcUrl, recipient, pageId] as const,

  inboxList: (rpcUrl: string, recipient: string) =>
    ["inboxList", rpcUrl, recipient] as const,

  usernameByAddress: (rpcUrl: string, address: string) =>
    ["usernameByAddress", rpcUrl, address] as const,

  addressByUsername: (rpcUrl: string, username: string) =>
    ["addressByUsername", rpcUrl, username] as const,

  registrationStatus: (rpcUrl: string, address: string) =>
    ["registrationStatus", rpcUrl, address] as const,
} as const;
