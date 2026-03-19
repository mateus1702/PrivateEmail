/**
 * Shared feature types for session, modal payloads, and inbox projections.
 * Used as contracts between App shell and feature modules.
 */

import type { Message } from "../../lib/contracts";
import type { SendMessageOp } from "../../lib/aa";
import type { AaConfig } from "../../lib/aa";

/** Top-level app screen. */
export type Screen = "login" | "register" | "logged";

/** Step within auth flow. */
export type AuthModalStep = "login" | "register";

/** Active session for logged-in user. */
export interface Session {
  address: string;
  ownerPrivateKeyHex: `0x${string}`;
  username: string | null;
  usdcBalance: bigint | null;
}

/** Payload carried by cost modal for register flow. */
export interface CostModalRegisterPayload {
  aaConfig: AaConfig;
  username: string;
  ownerPrivateKeyHex: `0x${string}`;
  derivedAddress: string;
}

/** Payload carried by cost modal for send flow. */
export interface CostModalSendPayload {
  aaConfig: AaConfig;
  sendOp: SendMessageOp;
}

/** Union of cost modal payloads. */
export type CostModalPayload = CostModalRegisterPayload | CostModalSendPayload;

/** Action type for cost modal confirmation branching. */
export type CostModalAction = "register" | "send";

/** Inbox page result with messages and sender username map. */
export interface InboxData {
  messages: Message[];
  prevPageId: bigint;
  hasMore: boolean;
  senderUsernames: Map<string, string | null>;
}
