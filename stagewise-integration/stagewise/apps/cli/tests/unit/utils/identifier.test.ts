import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { IdentifierManager } from '../../../src/utils/identifier';
import * as configPath from '../../../src/utils/config-path';

vi.mock('../../../src/utils/config-path', () => ({
  readDataFile: vi.fn(),
  writeDataFile: vi.fn(),
}));

// Mock crypto.randomUUID
vi.mock('crypto', () => ({
  randomUUID: vi.fn(() => 'test-uuid-1234-5678-9012-345678901234'),
}));

describe('IdentifierManager', () => {
  let identifierManager: IdentifierManager;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset singleton instance
    (IdentifierManager as any).instance = undefined;
    identifierManager = IdentifierManager.getInstance();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getInstance', () => {
    it('should return the same instance', () => {
      const instance1 = IdentifierManager.getInstance();
      const instance2 = IdentifierManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('getMachineId', () => {
    it('should create new identifier when none exists', async () => {
      vi.mocked(configPath.readDataFile).mockResolvedValue(null);

      const machineId = await identifierManager.getMachineId();

      expect(machineId).toBe('test-uuid-1234-5678-9012-345678901234');
      expect(configPath.writeDataFile).toHaveBeenCalledWith(
        'identifier.json',
        expect.objectContaining({
          id: 'test-uuid-1234-5678-9012-345678901234',
          createdAt: expect.any(String),
        }),
      );
    });

    it('should return existing identifier', async () => {
      const existingIdentifier = {
        id: 'existing-uuid',
        createdAt: '2024-01-01T00:00:00.000Z',
      };
      vi.mocked(configPath.readDataFile).mockResolvedValue(existingIdentifier);

      const machineId = await identifierManager.getMachineId();

      expect(machineId).toBe('existing-uuid');
      expect(configPath.writeDataFile).not.toHaveBeenCalled();
    });

    it('should create new identifier for invalid data', async () => {
      vi.mocked(configPath.readDataFile).mockResolvedValue({ invalid: 'data' });

      const machineId = await identifierManager.getMachineId();

      expect(machineId).toBe('test-uuid-1234-5678-9012-345678901234');
      expect(configPath.writeDataFile).toHaveBeenCalled();
    });

    it('should cache identifier after first load', async () => {
      vi.mocked(configPath.readDataFile).mockResolvedValue({
        id: 'cached-uuid',
        createdAt: '2024-01-01T00:00:00.000Z',
      });

      await identifierManager.getMachineId();
      await identifierManager.getMachineId();

      expect(configPath.readDataFile).toHaveBeenCalledTimes(1);
    });
  });

  describe('getIdentifier', () => {
    it('should return full identifier object', async () => {
      const mockDate = '2024-01-01T00:00:00.000Z';
      vi.spyOn(Date.prototype, 'toISOString').mockReturnValue(mockDate);
      vi.mocked(configPath.readDataFile).mockResolvedValue(null);

      const identifier = await identifierManager.getIdentifier();

      expect(identifier).toEqual({
        id: 'test-uuid-1234-5678-9012-345678901234',
        createdAt: mockDate,
      });
    });
  });
});
