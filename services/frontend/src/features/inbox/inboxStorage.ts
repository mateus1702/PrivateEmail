/**
 * Inbox read-state persistence (localStorage).
 */

import type { Message } from "../../lib/contracts";

const READ_STORAGE_KEY = (addr: string) => `pm_read_${addr.toLowerCase()}`;

export function getMessageKey(msg: Message): string {
  return `${msg.sender.toLowerCase()}-${msg.recipient.toLowerCase()}-${msg.timestamp}-${msg.contentHash}`;
}

export function loadReadKeys(addr: string): Set<string> {
  try {
    const raw = localStorage.getItem(READ_STORAGE_KEY(addr));
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

export function persistReadKeys(addr: string, keys: Set<string>): void {
  try {
    localStorage.setItem(READ_STORAGE_KEY(addr), JSON.stringify([...keys]));
  } catch {
    /* ignore */
  }
}
