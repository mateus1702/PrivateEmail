import { describe, it, expect } from "vitest";
import { queryKeys } from "./queryKeys";

describe("queryKeys", () => {
  it("balance key includes rpc, usdc, and account", () => {
    const key = queryKeys.balance("https://rpc", "0xusdc", "0xacc");
    expect(key).toEqual(["balance", "https://rpc", "0xusdc", "0xacc"]);
  });

  it("inboxList key includes rpc and recipient", () => {
    const key = queryKeys.inboxList("https://rpc", "0xrecipient");
    expect(key).toEqual(["inboxList", "https://rpc", "0xrecipient"]);
  });

  it("usernameByAddress key includes rpc and address", () => {
    const key = queryKeys.usernameByAddress("https://rpc", "0xaddr");
    expect(key).toEqual(["usernameByAddress", "https://rpc", "0xaddr"]);
  });

  it("addressByUsername key includes rpc and username", () => {
    const key = queryKeys.addressByUsername("https://rpc", "alice");
    expect(key).toEqual(["addressByUsername", "https://rpc", "alice"]);
  });
});
