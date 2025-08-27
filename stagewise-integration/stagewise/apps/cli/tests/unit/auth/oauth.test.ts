import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';
import { createServer } from 'node:http';
import open from 'open';

// Mock dependencies
vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    isAxiosError: vi.fn((error: any) => error.isAxiosError === true),
  },
}));
vi.mock('open');
vi.mock('node:http', () => ({
  createServer: vi.fn(),
}));

vi.mock('../../../src/utils/logger', () => ({
  log: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../../../src/auth/token-manager', () => ({
  tokenManager: {
    storeToken: vi.fn(),
    getStoredToken: vi.fn(),
    clearToken: vi.fn(),
  },
}));

vi.mock('../../../src/utils/telemetry', () => ({
  analyticsEvents: {
    cliAuthInitiated: vi.fn(),
    cliAuthCompleted: vi.fn(),
  },
}));

describe('OAuthManager', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  describe.skip('initiateOAuthFlow', () => {
    it('should open browser and exchange auth code for tokens', async () => {
      let serverCallback: any = null;
      const mockServer = {
        listen: vi.fn((_port, callback) => callback()),
        close: vi.fn(),
        on: vi.fn(),
      };

      vi.mocked(createServer).mockImplementation((callback) => {
        serverCallback = callback;
        return mockServer as any;
      });
      vi.mocked(open).mockResolvedValue({} as any);

      // Mock successful token exchange
      vi.mocked(axios.post).mockResolvedValueOnce({
        status: 200,
        data: {
          accessToken: 'test-access-token',
          refreshToken: 'test-refresh-token',
          expiresAt: '2024-01-01T02:00:00Z',
          refreshExpiresAt: '2024-01-31T01:00:00Z',
        },
      });

      // Mock successful session validation
      vi.mocked(axios.get).mockResolvedValueOnce({
        status: 200,
        data: {
          valid: true,
          userId: 'test-user-id',
          userEmail: 'test@example.com',
          extensionId: 'test-extension',
          createdAt: '2024-01-01T00:00:00Z',
          isExpiringSoon: false,
        },
      });

      const { oauthManager } = await import('../../../src/auth/oauth');

      // Start the OAuth flow in a promise
      const authPromise = oauthManager.initiateOAuthFlow(3100);

      // Wait a bit for the server to be set up
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Simulate callback with auth code
      const mockReq = {
        url: '/auth/callback?authCode=test-auth-code&expiresAt=2024-01-01T01:00:00Z',
      };
      const mockRes = {
        setHeader: vi.fn(),
        writeHead: vi.fn(),
        end: vi.fn(),
      };

      // Call the server callback
      expect(serverCallback).toBeTruthy();
      serverCallback(mockReq as any, mockRes as any);

      const result = await authPromise;

      expect(open).toHaveBeenCalledWith(
        'https://console.stagewise.io/authenticate-ide?ide=cli&redirect_uri=http%3A%2F%2Flocalhost%3A3100%2Fauth%2Fcallback',
      );
      expect(axios.post).toHaveBeenCalledWith(
        'https://console.stagewise.io/auth/extension/exchange',
        { authCode: 'test-auth-code' },
        expect.any(Object),
      );
      expect(result.accessToken).toBe('test-access-token');
      expect(result.userEmail).toBe('test@example.com');
    });

    it('should handle auth code exchange errors', async () => {
      let serverCallback: any = null;
      const mockServer = {
        listen: vi.fn((_port, callback) => callback()),
        close: vi.fn(),
        on: vi.fn(),
      };

      vi.mocked(createServer).mockImplementation((callback) => {
        serverCallback = callback;
        return mockServer as any;
      });
      vi.mocked(open).mockResolvedValue({} as any);

      // Mock failed token exchange
      vi.mocked(axios.post).mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          status: 400,
          data: { error: 'Invalid auth code' },
        },
      });

      const { oauthManager } = await import('../../../src/auth/oauth');

      // Start the OAuth flow in a promise
      const authPromise = oauthManager.initiateOAuthFlow(3100);

      // Wait a bit for the server to be set up
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Simulate callback with auth code
      const mockReq = {
        url: '/auth/callback?authCode=test-auth-code&expiresAt=2024-01-01T01:00:00Z',
      };
      const mockRes = {
        setHeader: vi.fn(),
        writeHead: vi.fn(),
        end: vi.fn(),
      };

      expect(serverCallback).toBeTruthy();
      serverCallback(mockReq as any, mockRes as any);

      await expect(authPromise).rejects.toThrow('Invalid or expired auth code');
    });

    it('should handle backend server errors gracefully', async () => {
      let serverCallback: any = null;
      const mockServer = {
        listen: vi.fn((_port, callback) => callback()),
        close: vi.fn(),
        on: vi.fn(),
      };

      vi.mocked(createServer).mockImplementation((callback) => {
        serverCallback = callback;
        return mockServer as any;
      });
      vi.mocked(open).mockResolvedValue({} as any);

      // Mock backend server error (500)
      vi.mocked(axios.post).mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          status: 500,
          data: { error: 'Internal server error' },
        },
      });

      const { oauthManager } = await import('../../../src/auth/oauth');

      // Start the OAuth flow in a promise
      const authPromise = oauthManager.initiateOAuthFlow(3100);

      // Wait a bit for the server to be set up
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Simulate callback with auth code
      const mockReq = {
        url: '/auth/callback?authCode=test-auth-code&expiresAt=2024-01-01T01:00:00Z',
      };
      const mockRes = {
        setHeader: vi.fn(),
        writeHead: vi.fn(),
        end: vi.fn(),
      };

      expect(serverCallback).toBeTruthy();
      serverCallback(mockReq as any, mockRes as any);

      await expect(authPromise).rejects.toThrow(
        'Authentication service error - please try again later',
      );
    });
  });

  describe('checkAuthStatus', () => {
    it('should return authenticated state with valid token', async () => {
      const { tokenManager } = await import('../../../src/auth/token-manager');
      vi.mocked(tokenManager.getStoredToken).mockResolvedValue({
        accessToken: 'valid-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        refreshExpiresAt: new Date(
          Date.now() + 30 * 24 * 3600000,
        ).toISOString(),
        userId: 'test-user-id',
        userEmail: 'test@example.com',
      });

      vi.mocked(axios.get).mockResolvedValueOnce({
        status: 200,
        data: {
          valid: true,
          userId: 'test-user-id',
          userEmail: 'test@example.com',
        },
      });

      const { oauthManager } = await import('../../../src/auth/oauth');
      const result = await oauthManager.checkAuthStatus();

      expect(result.isAuthenticated).toBe(true);
      expect(result.userEmail).toBe('test@example.com');
    });

    it('should return not authenticated when no token stored', async () => {
      const { tokenManager } = await import('../../../src/auth/token-manager');
      vi.mocked(tokenManager.getStoredToken).mockResolvedValue(null);

      const { oauthManager } = await import('../../../src/auth/oauth');
      const result = await oauthManager.checkAuthStatus();

      expect(result.isAuthenticated).toBe(false);
    });
  });

  describe('logout', () => {
    it('should clear tokens and revoke on server', async () => {
      const { tokenManager } = await import('../../../src/auth/token-manager');
      vi.mocked(tokenManager.getStoredToken).mockResolvedValue({
        accessToken: 'test-token',
        refreshToken: 'refresh-token',
      });

      vi.mocked(axios.post).mockResolvedValueOnce({ status: 200 });

      const { oauthManager } = await import('../../../src/auth/oauth');
      await oauthManager.logout();

      expect(axios.post).toHaveBeenCalledWith(
        'https://console.stagewise.io/auth/extension/revoke',
        expect.objectContaining({
          refreshToken: 'refresh-token',
        }),
        expect.any(Object),
      );
      expect(tokenManager.clearToken).toHaveBeenCalled();
    });
  });

  describe('validateToken', () => {
    it('should validate token successfully', async () => {
      vi.mocked(axios.get).mockResolvedValueOnce({
        status: 200,
        data: {
          valid: true,
          userId: 'test-user-id',
          userEmail: 'test@example.com',
        },
      });

      const { oauthManager } = await import('../../../src/auth/oauth');
      const result = await oauthManager.validateToken('real-token');

      expect(axios.get).toHaveBeenCalledWith(
        'https://console.stagewise.io/auth/extension/session',
        expect.objectContaining({
          headers: {
            Authorization: 'Bearer real-token',
          },
        }),
      );
      expect(result).toBe(true);
    });

    it('should return false for invalid token', async () => {
      const axiosError = new Error('Unauthorized') as any;
      axiosError.isAxiosError = true;
      axiosError.response = { status: 401 };

      vi.mocked(axios.get).mockRejectedValueOnce(axiosError);
      vi.mocked(axios.isAxiosError).mockReturnValue(true);

      const { oauthManager } = await import('../../../src/auth/oauth');
      const result = await oauthManager.validateToken('invalid-real-token');

      expect(result).toBe(false);
    });

    it('should assume token is valid on network errors', async () => {
      vi.mocked(axios.get).mockRejectedValueOnce(new Error('Network error'));
      vi.mocked(axios.isAxiosError).mockReturnValue(false);

      const { oauthManager } = await import('../../../src/auth/oauth');
      const result = await oauthManager.validateToken(
        'real-network-error-token',
      );

      expect(result).toBe(true);
    });
  });

  describe('ensureValidAccessToken', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should return current token if not expired', async () => {
      const { tokenManager } = await import('../../../src/auth/token-manager');
      const tokenData = {
        accessToken: 'valid-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
        refreshExpiresAt: new Date(
          Date.now() + 30 * 24 * 3600000,
        ).toISOString(),
      };

      vi.mocked(tokenManager.getStoredToken).mockResolvedValue(tokenData);

      const { oauthManager } = await import('../../../src/auth/oauth');
      const result = await oauthManager.ensureValidAccessToken();
      expect(result).toBe('valid-token');
    });

    it('should refresh token if expired', async () => {
      const { tokenManager } = await import('../../../src/auth/token-manager');
      const expiredTokenData = {
        accessToken: 'expired-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(Date.now() - 1000).toISOString(), // Expired
        refreshExpiresAt: new Date(
          Date.now() + 30 * 24 * 3600000,
        ).toISOString(),
      };

      // First call returns expired token for initial check
      // Second call returns expired token for refresh check
      // Third call returns new token after refresh
      vi.mocked(tokenManager.getStoredToken)
        .mockResolvedValueOnce(expiredTokenData)
        .mockResolvedValueOnce(expiredTokenData)
        .mockResolvedValueOnce({
          ...expiredTokenData,
          accessToken: 'new-access-token',
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        });

      vi.mocked(tokenManager.storeToken).mockResolvedValue();

      vi.mocked(axios.post).mockResolvedValueOnce({
        status: 200,
        data: {
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
          refreshExpiresAt: new Date(
            Date.now() + 30 * 24 * 3600000,
          ).toISOString(),
        },
      });

      vi.mocked(axios.get).mockResolvedValueOnce({
        status: 200,
        data: {
          valid: true,
          userId: 'test-user-id',
          userEmail: 'test@example.com',
        },
      });

      const { oauthManager } = await import('../../../src/auth/oauth');
      const result = await oauthManager.ensureValidAccessToken();
      expect(result).toBe('new-access-token');
    });

    it('should throw if refresh token is expired', async () => {
      const { tokenManager } = await import('../../../src/auth/token-manager');
      const expiredTokenData = {
        accessToken: 'expired-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(Date.now() - 1000).toISOString(), // Expired
        refreshExpiresAt: new Date(Date.now() - 1000).toISOString(), // Also expired
      };

      vi.mocked(tokenManager.getStoredToken).mockResolvedValue(
        expiredTokenData,
      );
      vi.mocked(tokenManager.clearToken).mockResolvedValue();

      const { oauthManager } = await import('../../../src/auth/oauth');

      await expect(oauthManager.ensureValidAccessToken()).rejects.toThrow(
        'Refresh token expired. Please authenticate again.',
      );
    });
  });

  describe('isAuthenticated', () => {
    it('should return true with valid token', async () => {
      const { tokenManager } = await import('../../../src/auth/token-manager');
      vi.mocked(tokenManager.getStoredToken).mockResolvedValue({
        accessToken: 'valid-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        refreshExpiresAt: new Date(
          Date.now() + 30 * 24 * 3600000,
        ).toISOString(),
      });

      const { oauthManager } = await import('../../../src/auth/oauth');
      const result = await oauthManager.isAuthenticated();
      expect(result).toBe(true);
    });

    it('should return false with no token', async () => {
      const { tokenManager } = await import('../../../src/auth/token-manager');
      vi.mocked(tokenManager.getStoredToken).mockResolvedValue(null);

      const { oauthManager } = await import('../../../src/auth/oauth');
      const result = await oauthManager.isAuthenticated();
      expect(result).toBe(false);
    });
  });
});
