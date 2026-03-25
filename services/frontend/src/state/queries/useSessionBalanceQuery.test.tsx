import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useSessionBalanceQuery } from "./useSessionBalanceQuery";
import * as contracts from "../../lib/contracts";

vi.mock("../../lib/contracts");

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
};

describe("useSessionBalanceQuery", () => {
  beforeEach(() => {
    vi.mocked(contracts.getUsdcBalance).mockResolvedValue(1_000_000n);
  });

  it("is disabled when sessionAddress is null", () => {
    const { result } = renderHook(
      () =>
        useSessionBalanceQuery({
          rpcUrl: "https://rpc.example.com",
          sessionAddress: null,
        }),
      { wrapper: createWrapper() }
    );
    expect(result.current.fetchStatus).toBe("idle");
    expect(contracts.getUsdcBalance).not.toHaveBeenCalled();
  });

  it("fetches when sessionAddress is set", async () => {
    const mockBalance = 1_000_000n;
    vi.mocked(contracts.getUsdcBalance).mockResolvedValue(mockBalance);

    const { result } = renderHook(
      () =>
        useSessionBalanceQuery({
          rpcUrl: "https://rpc.example.com",
          sessionAddress: "0x1234567890123456789012345678901234567890",
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(mockBalance);
    expect(contracts.getUsdcBalance).toHaveBeenCalledWith(
      "https://rpc.example.com",
      expect.any(String),
      "0x1234567890123456789012345678901234567890"
    );
  });
});
