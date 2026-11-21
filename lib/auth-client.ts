"use client";

const CLIENT_KEY = 'pali:auth-client:v1';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

// A browser hint for throttling, never an authentication credential.
export function authClientHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    let id = localStorage.getItem(CLIENT_KEY);
    if (!id || !UUID.test(id)) {
      if (typeof crypto.randomUUID === 'function') id = crypto.randomUUID();
      else {
        const bytes = crypto.getRandomValues(new Uint8Array(16));
        bytes[6] = (bytes[6] & 15) | 64;
        bytes[8] = (bytes[8] & 63) | 128;
        const hex = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
        id = `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
      }
      localStorage.setItem(CLIENT_KEY, id);
    }
    return { 'X-Auth-Client': id };
  } catch {
    // Private/storage-restricted browsers still use server account/IP limits.
    return {};
  }
}
