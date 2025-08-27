import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tokenManager } from '../../../src/auth/token-manager';

// Mock config-path utilities
vi.mock('../../../src/utils/config-path', () => ({
  readConfigFile: vi.fn(),
  writeConfigFile: vi.fn(),
  deleteConfigFile: vi.fn(),
}));

describe('tokenManager', () => {
  let configPathMock: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Get the mocked config-path module
    configPathMock = await import('../../../src/utils/config-path');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('storeToken', () => {
    it('should save token using config file', async () => {
      configPathMock.writeConfigFile.mockResolvedValue(undefined);

      const tokenData = {
        accessToken: 'test-token-123',
        userEmail: 'test@example.com',
      };

      await tokenManager.storeToken(tokenData);

      expect(configPathMock.writeConfigFile).toHaveBeenCalledWith(
        'credentials.json',
        tokenData,
      );
    });

    it('should store complete token data', async () => {
      configPathMock.writeConfigFile.mockResolvedValue(undefined);

      const tokenData = {
        accessToken: 'test-token-123',
        refreshToken: 'refresh-token-456',
        userEmail: 'test@example.com',
        expiresAt: '2024-12-31T23:59:59Z',
      };

      await tokenManager.storeToken(tokenData);

      expect(configPathMock.writeConfigFile).toHaveBeenCalledWith(
        'credentials.json',
        tokenData,
      );
    });
  });

  describe('getStoredToken', () => {
    it('should retrieve stored token', async () => {
      const tokenData = {
        accessToken: 'test-token-123',
        userEmail: 'test@example.com',
      };

      configPathMock.readConfigFile.mockResolvedValue(tokenData);

      const result = await tokenManager.getStoredToken();

      expect(configPathMock.readConfigFile).toHaveBeenCalledWith('credentials.json');
      expect(result).toEqual(tokenData);
    });

    it('should return null when no token exists', async () => {
      configPathMock.readConfigFile.mockResolvedValue(null);

      const result = await tokenManager.getStoredToken();

      expect(result).toBeNull();
    });

    it('should return null on read error', async () => {
      configPathMock.readConfigFile.mockRejectedValue(new Error('Read failed'));

      const result = await tokenManager.getStoredToken();

      expect(result).toBeNull();
    });
  });

  describe('deleteStoredToken', () => {
    it('should delete token file', async () => {
      configPathMock.deleteConfigFile.mockResolvedValue(undefined);

      await tokenManager.deleteStoredToken();

      expect(configPathMock.deleteConfigFile).toHaveBeenCalledWith(
        'credentials.json',
      );
    });
  });

  describe('resolveToken', () => {
    it('should prioritize CLI token over stored token', async () => {
      const storedToken = {
        accessToken: 'stored-token',
        userEmail: 'stored@example.com',
      };

      configPathMock.readConfigFile.mockResolvedValue(storedToken);

      const result = await tokenManager.resolveToken('cli-token');

      expect(result).toBe('cli-token');
      expect(configPathMock.readConfigFile).not.toHaveBeenCalled();
    });

    it('should return stored token when no CLI token provided', async () => {
      const storedToken = {
        accessToken: 'stored-token',
        userEmail: 'stored@example.com',
      };

      configPathMock.readConfigFile.mockResolvedValue(storedToken);

      const result = await tokenManager.resolveToken();

      expect(result).toBe('stored-token');
    });

    it('should return null when no tokens available', async () => {
      configPathMock.readConfigFile.mockResolvedValue(null);

      const result = await tokenManager.resolveToken();

      expect(result).toBeNull();
    });
  });
});
