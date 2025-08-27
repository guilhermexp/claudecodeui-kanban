import { log } from '../utils/logger';
import {
  readConfigFile,
  writeConfigFile,
  deleteConfigFile,
} from '../utils/config-path';

const CREDENTIALS_FILE = 'credentials.json';

export interface TokenData {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  refreshExpiresAt?: string;
  userId?: string;
  userEmail?: string;
}

export class TokenManager {
  async getStoredToken(): Promise<TokenData | null> {
    try {
      const tokenData = await readConfigFile<TokenData>(CREDENTIALS_FILE);
      return tokenData;
    } catch (error) {
      log.debug(`Failed to retrieve stored token: ${error}`);
      return null;
    }
  }

  async storeToken(tokenData: TokenData): Promise<void> {
    try {
      await writeConfigFile(CREDENTIALS_FILE, tokenData);
      log.debug('Token stored successfully');
    } catch (error) {
      log.error(`Failed to store token: ${error}`);
      throw error;
    }
  }

  async deleteStoredToken(): Promise<void> {
    try {
      await deleteConfigFile(CREDENTIALS_FILE);
      log.debug('Token deleted successfully');
    } catch (error) {
      log.error(`Failed to delete token: ${error}`);
      throw error;
    }
  }

  async clearToken(): Promise<void> {
    return this.deleteStoredToken();
  }

  async resolveToken(cliToken?: string): Promise<string | null> {
    // Priority 1: CLI argument token
    if (cliToken) {
      log.debug('Using token from CLI argument');
      return cliToken;
    }

    // Priority 2: Stored token
    const storedToken = await this.getStoredToken();
    if (storedToken) {
      log.debug('Using stored token');
      return storedToken.accessToken;
    }

    // No token found
    return null;
  }
}

export const tokenManager = new TokenManager();
