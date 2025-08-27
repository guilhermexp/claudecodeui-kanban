import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs/promises';

// Mock fs/promises
vi.mock('node:fs/promises', () => ({
  default: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    access: vi.fn(),
  },
}));

describe('config-file', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  describe('loadConfigFile', () => {
    it('should load and parse valid config file', async () => {
      const mockConfig = {
        port: 3100,
        appPort: 3000,
        autoPlugins: true,
        plugins: ['plugin1', 'plugin2'],
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConfig));

      const { loadConfigFile } = await import(
        '../../../src/config/config-file'
      );
      const result = await loadConfigFile('/test/dir');

      expect(fs.readFile).toHaveBeenCalledWith(
        '/test/dir/stagewise.json',
        'utf-8',
      );
      expect(result).toEqual(mockConfig);
    });

    it('should return null when config file does not exist', async () => {
      const error: any = new Error('File not found');
      error.code = 'ENOENT';
      vi.mocked(fs.readFile).mockRejectedValue(error);

      const { loadConfigFile } = await import(
        '../../../src/config/config-file'
      );
      const result = await loadConfigFile('/test/dir');

      expect(result).toBeNull();
    });

    it('should throw error for invalid JSON', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('{ invalid json');

      const { loadConfigFile } = await import(
        '../../../src/config/config-file'
      );

      await expect(loadConfigFile('/test/dir')).rejects.toMatchObject({
        type: 'json',
        message: 'Failed to parse stagewise.json',
      });
    });

    it('should throw error for invalid config schema', async () => {
      const invalidConfig = {
        port: 'not a number', // Should be number
        appPort: 3000,
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(invalidConfig));

      const { loadConfigFile } = await import(
        '../../../src/config/config-file'
      );

      await expect(loadConfigFile('/test/dir')).rejects.toMatchObject({
        type: 'validation',
        message: 'Invalid configuration in stagewise.json',
      });
    });

    it('should validate plugin with name and path', async () => {
      const mockConfig = {
        plugins: [{ name: 'test-plugin', path: './plugins/test' }],
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConfig));

      const { loadConfigFile } = await import(
        '../../../src/config/config-file'
      );
      const result = await loadConfigFile('/test/dir');

      expect(result).toEqual(mockConfig);
    });

    it('should validate plugin with name and url', async () => {
      const mockConfig = {
        plugins: [{ name: 'test-plugin', url: 'https://example.com/plugin' }],
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConfig));

      const { loadConfigFile } = await import(
        '../../../src/config/config-file'
      );
      const result = await loadConfigFile('/test/dir');

      expect(result).toEqual(mockConfig);
    });

    it('should reject plugin with both path and url', async () => {
      const mockConfig = {
        plugins: [
          {
            name: 'test-plugin',
            path: './plugins/test',
            url: 'https://example.com/plugin',
          },
        ],
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConfig));

      const { loadConfigFile } = await import(
        '../../../src/config/config-file'
      );

      await expect(loadConfigFile('/test/dir')).rejects.toMatchObject({
        type: 'validation',
        message: 'Invalid configuration in stagewise.json',
      });
    });

    it('should accept plugins as string array', async () => {
      const mockConfig = {
        plugins: ['plugin1', 'plugin2', 'plugin3'],
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConfig));

      const { loadConfigFile } = await import(
        '../../../src/config/config-file'
      );
      const result = await loadConfigFile('/test/dir');

      expect(result).toEqual(mockConfig);
    });
  });

  it('should provide helpful error for invalid port numbers', async () => {
    const invalidConfig = {
      port: 99999, // Port too high
      appPort: 3000,
    };

    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(invalidConfig));

    const { loadConfigFile } = await import('../../../src/config/config-file');

    try {
      await loadConfigFile('/test/dir');
      expect.fail('Should have thrown');
    } catch (error: any) {
      expect(error.type).toBe('validation');
      expect(error.details).toContain(
        'Port number must be between 1 and 65535',
      );
    }
  });

  it('should provide helpful error for string port numbers', async () => {
    const invalidConfig = {
      appPort: '3000', // Should be number, not string
    };

    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(invalidConfig));

    const { loadConfigFile } = await import('../../../src/config/config-file');

    try {
      await loadConfigFile('/test/dir');
      expect.fail('Should have thrown');
    } catch (error: any) {
      expect(error.type).toBe('validation');
      expect(error.details).toContain('appPort: Must be a number');
    }
  });
});

describe('saveConfigFile', () => {
  it('should save valid config file with pretty formatting', async () => {
    const config = {
      port: 3100,
      appPort: 3000,
      autoPlugins: false,
    };

    const { saveConfigFile } = await import('../../../src/config/config-file');
    await saveConfigFile('/test/dir', config);

    expect(fs.writeFile).toHaveBeenCalledWith(
      '/test/dir/stagewise.json',
      JSON.stringify(config, null, 2),
      'utf-8',
    );
  });

  it('should validate config before saving', async () => {
    vi.clearAllMocks();

    const invalidConfig = {
      port: 'not a number', // Invalid
    } as any;

    const { saveConfigFile } = await import('../../../src/config/config-file');

    await expect(saveConfigFile('/test/dir', invalidConfig)).rejects.toThrow();
    expect(fs.writeFile).not.toHaveBeenCalled();
  });

  it('should save config with plugins', async () => {
    const config = {
      plugins: [
        'simple-plugin',
        { name: 'complex-plugin', path: './plugins/complex' },
      ],
    };

    const { saveConfigFile } = await import('../../../src/config/config-file');
    await saveConfigFile('/test/dir', config);

    expect(fs.writeFile).toHaveBeenCalledWith(
      '/test/dir/stagewise.json',
      JSON.stringify(config, null, 2),
      'utf-8',
    );
  });
});

describe('configFileExists', () => {
  it('should return true when file exists', async () => {
    vi.mocked(fs.access).mockResolvedValue(undefined);

    const { configFileExists } = await import(
      '../../../src/config/config-file'
    );
    const result = await configFileExists('/test/dir');

    expect(fs.access).toHaveBeenCalledWith('/test/dir/stagewise.json');
    expect(result).toBe(true);
  });

  it('should return false when file does not exist', async () => {
    vi.mocked(fs.access).mockRejectedValue(new Error('File not found'));

    const { configFileExists } = await import(
      '../../../src/config/config-file'
    );
    const result = await configFileExists('/test/dir');

    expect(fs.access).toHaveBeenCalledWith('/test/dir/stagewise.json');
    expect(result).toBe(false);
  });
});

describe('CONFIG_FILE_NAME', () => {
  it('should export correct config file name', async () => {
    const { CONFIG_FILE_NAME } = await import(
      '../../../src/config/config-file'
    );
    expect(CONFIG_FILE_NAME).toBe('stagewise.json');
  });
});
