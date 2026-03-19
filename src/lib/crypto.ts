/**
 * Mavault Crypto Library
 * Uses Web Crypto API for secure, hardware-accelerated encryption.
 */

const ITERATIONS = 100000;
const ALGO = 'AES-GCM';
const KEY_ALGO = 'PBKDF2';

/**
 * Robustly converts Uint8Array to Base64 string without stack limits.
 */
function arrayBufferToBase64(buffer: Uint8Array): string {
  let binary = '';
  const len = buffer.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary);
}

/**
 * Robustly converts Base64 string to Uint8Array.
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function deriveKey(passphrase: string, salt: Uint8Array) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    KEY_ALGO,
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: KEY_ALGO,
      salt,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: ALGO, length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptData(data: string, passphrase: string) {
  if (!passphrase) throw new Error('Passphrase is required for encryption');
  
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  
  const enc = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt(
    { name: ALGO, iv },
    key,
    enc.encode(data)
  );

  // Combine Salt + IV + Encrypted Data into a single blob
  const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encrypted), salt.length + iv.length);

  return arrayBufferToBase64(combined);
}

export async function decryptData(base64Data: string, passphrase: string) {
  if (!passphrase) throw new Error('Passphrase is required for decryption');
  
  try {
    const combined = base64ToUint8Array(base64Data);

    if (combined.length < 28) {
        throw new Error('Invalid vault data: too short');
    }

    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const data = combined.slice(28);

    const key = await deriveKey(passphrase, salt);
    
    const decrypted = await crypto.subtle.decrypt(
      { name: ALGO, iv },
      key,
      data
    );

    const dec = new TextDecoder();
    return dec.decode(decrypted);
  } catch (e: any) {
    if (e.name === 'OperationError') {
        throw new Error('Invalid passphrase');
    }
    throw new Error(`Decryption failed: ${e.message}`);
  }
}

export function generateRecoveryKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Readable chars (no O, I, 0, 1)
  const array = new Uint32Array(24);
  crypto.getRandomValues(array);
  let key = '';
  for (let i = 0; i < 24; i++) {
    if (i > 0 && i % 4 === 0) key += '-';
    key += chars[array[i] % chars.length];
  }
  return key;
}
