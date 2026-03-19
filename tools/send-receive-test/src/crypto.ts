/**
 * Encryption helpers (mirrors services/frontend/src/lib/crypto.ts).
 * Uses X25519 + XChaCha20-Poly1305.
 */

import { sha256 } from "@noble/hashes/sha256";
import { hkdf } from "@noble/hashes/hkdf";
import { x25519 } from "@noble/curves/ed25519";
import { xchacha20poly1305 } from "@noble/ciphers/chacha";

const HKDF_INFO = "project5-encryption-v1";
const NONCE_LEN = 24;

function randomBytes(len: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(len));
}

/**
 * Derive X25519 encryption key pair from a 32-byte seed (e.g. EOA private key).
 */
export function deriveEncryptionKeyPair(seed: Uint8Array): {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
} {
  if (seed.length !== 32) throw new Error("seed must be 32 bytes");
  const derived = hkdf(sha256, seed, undefined, HKDF_INFO, 32);
  const privateKey = derived.slice(0, 32);
  const publicKey = x25519.getPublicKey(privateKey);
  return { publicKey, privateKey };
}

export function encryptWithPublicKey(
  plaintext: Uint8Array,
  recipientPublicKey: Uint8Array
): { ciphertext: Uint8Array; nonce: Uint8Array } {
  if (recipientPublicKey.length !== 32) throw new Error("recipientPublicKey must be 32 bytes");
  const ephemeralPrivateKey = randomBytes(32);
  const ephemeralPublicKey = x25519.getPublicKey(ephemeralPrivateKey);
  const sharedSecret = x25519.getSharedSecret(ephemeralPrivateKey, recipientPublicKey);
  const key = sha256(sharedSecret);
  const nonce = randomBytes(NONCE_LEN);
  const cipher = xchacha20poly1305(key, nonce);
  const ciphertext = cipher.encrypt(plaintext);
  const combined = new Uint8Array(32 + nonce.length + ciphertext.length);
  combined.set(ephemeralPublicKey, 0);
  combined.set(nonce, 32);
  combined.set(ciphertext, 32 + nonce.length);
  return { ciphertext: combined, nonce };
}

export function decryptWithPrivateKey(
  combinedOrCiphertext: Uint8Array,
  privateKey: Uint8Array
): Uint8Array {
  if (privateKey.length !== 32) throw new Error("privateKey must be 32 bytes");
  if (combinedOrCiphertext.length < 32 + NONCE_LEN) {
    throw new Error("Invalid ciphertext format");
  }
  const ephemeralPublicKey = combinedOrCiphertext.slice(0, 32);
  const nonce = combinedOrCiphertext.slice(32, 32 + NONCE_LEN);
  const ciphertext = combinedOrCiphertext.slice(32 + NONCE_LEN);
  const sharedSecret = x25519.getSharedSecret(privateKey, ephemeralPublicKey);
  const key = sha256(sharedSecret);
  const cipher = xchacha20poly1305(key, nonce);
  return cipher.decrypt(ciphertext);
}

export function bytesToHex(bytes: Uint8Array): string {
  return "0x" + Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function hexToBytes(hex: string): Uint8Array {
  const s = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(s.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
