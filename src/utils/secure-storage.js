// Secure Storage Utility - Encrypted localStorage
// Uses Web Crypto API for encryption/decryption
import { createLogger } from './logger';

const log = createLogger('SecureStorage');

class SecureStorage {
  constructor() {
    this.algorithm = 'AES-GCM';
    this.keyLength = 256;
    this.ivLength = 12; // 96-bit IV for GCM
    this.keyStorageKey = '_sk';
    // Generate or retrieve encryption key
    this.initKey();
  }

  async initKey() {
    try {
      const storedKey = sessionStorage.getItem(this.keyStorageKey);

      if (storedKey) {
        this.key = await this.importKey(storedKey);
      } else {
        // Generate new key
        this.key = await crypto.subtle.generateKey(
          { name: this.algorithm, length: this.keyLength },
          true,
          ['encrypt', 'decrypt']
        );

        // Export and store in sessionStorage (cleared on tab close)
        const exportedKey = await crypto.subtle.exportKey('raw', this.key);
        const keyString = this.arrayBufferToBase64(exportedKey);
        sessionStorage.setItem(this.keyStorageKey, keyString);
      }
    } catch (error) {
      log.error('Failed to initialize encryption key:', error);
      throw new Error('Encryption initialization failed');
    }
  }

  async importKey(keyString) {
    const keyBuffer = this.base64ToArrayBuffer(keyString);
    return crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: this.algorithm, length: this.keyLength },
      true,
      ['encrypt', 'decrypt']
    );
  }

  async encrypt(data) {
    if (!this.key) await this.initKey();

    // Validate input
    if (data === undefined || data === null) {
      throw new Error('Cannot encrypt null or undefined data');
    }

    const encodedData = new TextEncoder().encode(JSON.stringify(data));
    const iv = crypto.getRandomValues(new Uint8Array(this.ivLength));

    const encryptedData = await crypto.subtle.encrypt(
      { name: this.algorithm, iv },
      this.key,
      encodedData
    );

    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encryptedData.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encryptedData), iv.length);

    return this.arrayBufferToBase64(combined);
  }

  async decrypt(encryptedString) {
    if (!this.key) await this.initKey();

    // Validate input
    if (!encryptedString || typeof encryptedString !== 'string') {
      throw new Error('Invalid encrypted string');
    }

    try {
      const combined = this.base64ToArrayBuffer(encryptedString);
      const iv = combined.slice(0, this.ivLength);
      const encryptedData = combined.slice(this.ivLength);

      const decryptedData = await crypto.subtle.decrypt(
        { name: this.algorithm, iv },
        this.key,
        encryptedData
      );

      const decodedData = new TextDecoder().decode(decryptedData);
      return JSON.parse(decodedData);
    } catch (error) {
      log.warn('Decryption failed:', error);
      return null;
    }
  }

  async setItem(key, value) {
    // Validate input
    if (!key || typeof key !== 'string') {
      log.error('Invalid storage key:', key);
      return false;
    }

    try {
      const encrypted = await this.encrypt(value);
      localStorage.setItem(key, encrypted);
      return true;
    } catch (error) {
      log.error(`Secure storage setItem failed for key "${key}":`, error);
      return false;
    }
  }

  async getItem(key) {
    // Validate input
    if (!key || typeof key !== 'string') {
      log.error('Invalid storage key:', key);
      return null;
    }

    try {
      const encrypted = localStorage.getItem(key);
      if (!encrypted) return null;
      return await this.decrypt(encrypted);
    } catch (error) {
      log.error(`Secure storage getItem failed for key "${key}":`, error);
      return null;
    }
  }

  removeItem(key) {
    localStorage.removeItem(key);
  }

  clear() {
    localStorage.clear();
  }

  // Utility functions for base64 conversion (optimized)
  arrayBufferToBase64(buffer) {
    // Use built-in methods for better performance
    const bytes = new Uint8Array(buffer);
    const binary = String.fromCharCode.apply(null, bytes);
    return btoa(binary);
  }

  base64ToArrayBuffer(base64) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);

    // Optimized loop
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return bytes;
  }
}

// Singleton instance
const secureStorage = new SecureStorage();

// Backward compatible API
export const encryptedStorage = {
  setItem: (key, value) => secureStorage.setItem(key, value),
  getItem: (key) => secureStorage.getItem(key),
  removeItem: (key) => secureStorage.removeItem(key),
  clear: () => secureStorage.clear()
};

export default secureStorage;
