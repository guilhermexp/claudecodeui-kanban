// Auth persistence utility with encryption
import { encryptedStorage } from './secure-storage';
import { createLogger } from './logger';

const log = createLogger('AuthPersistence');

const AUTH_KEY = 'auth-token';
const AUTH_EXPIRY_KEY = 'auth-token-expiry';
const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

export const authPersistence = {
  /**
   * Save token with expiration date (encrypted)
   * @param {string} token - JWT token to save
   * @returns {Promise<boolean>} Success status
   */
  async saveToken(token) {
    if (!token || typeof token !== 'string') {
      log.warn('Invalid token provided to saveToken');
      return false;
    }

    try {
      const expiry = Date.now() + SESSION_DURATION;

      // Use encrypted storage for sensitive data
      await encryptedStorage.setItem(AUTH_KEY, token);
      await encryptedStorage.setItem(AUTH_EXPIRY_KEY, expiry);

      log.debug('Token saved successfully');
      return true;
    } catch (error) {
      log.error('Failed to save token:', error);
      return false;
    }
  },

  /**
   * Retrieve token if still valid (decrypted)
   * @returns {Promise<string|null>} Token or null if expired/invalid
   */
  async getToken() {
    try {
      const token = await encryptedStorage.getItem(AUTH_KEY);
      const expiry = await encryptedStorage.getItem(AUTH_EXPIRY_KEY);

      // Check if expired
      if (token && expiry && Date.now() > expiry) {
        log.info('Token expired, clearing...');
        await this.clearToken();
        return null;
      }

      return token;
    } catch (error) {
      log.error('Failed to get token:', error);
      return null;
    }
  },

  /**
   * Clear the stored token
   * @returns {Promise<void>}
   */
  async clearToken() {
    try {
      encryptedStorage.removeItem(AUTH_KEY);
      encryptedStorage.removeItem(AUTH_EXPIRY_KEY);
      log.debug('Token cleared successfully');
    } catch (error) {
      log.error('Failed to clear token:', error);
    }
  },

  /**
   * Check if user has valid token
   * @returns {Promise<boolean>}
   */
  async isAuthenticated() {
    const token = await this.getToken();
    return !!token;
  },

  /**
   * Refresh expiration when token is used
   * @returns {Promise<void>}
   */
  async refreshExpiry() {
    const token = await this.getToken();
    if (token) {
      await this.saveToken(token);
      log.debug('Token expiry refreshed');
    }
  }
};