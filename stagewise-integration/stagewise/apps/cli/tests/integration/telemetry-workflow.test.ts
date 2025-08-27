import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import envPaths from 'env-paths';

// Get the config directory for test environment
const paths = envPaths('stagewise-dev');

describe('Telemetry Command Integration', () => {
  const cliPath = path.join(__dirname, '../../src/index.ts');
  const telemetryConfigPath = path.join(paths.config, 'telemetry.json');
  
  beforeEach(async () => {
    // Ensure config directory exists
    await fs.mkdir(paths.config, { recursive: true });
    // Clean up any existing telemetry config
    try {
      await fs.unlink(telemetryConfigPath);
    } catch {
      // File doesn't exist, which is fine
    }
  });

  afterEach(async () => {
    // Clean up after tests
    try {
      await fs.unlink(telemetryConfigPath);
    } catch {
      // File doesn't exist, which is fine
    }
  });

  it('should show default telemetry status', () => {
    const output = execSync(`npx tsx ${cliPath} telemetry status`, { 
      encoding: 'utf8' 
    });
    
    expect(output).toContain('Telemetry level: anonymous');
    expect(output).toContain('off: Disable telemetry completely');
    expect(output).toContain('anonymous: Enable telemetry with pseudonymized ID');
    expect(output).toContain('full: Enable telemetry with actual user ID');
  });

  it('should set telemetry level to off', async () => {
    const setOutput = execSync(`npx tsx ${cliPath} telemetry set off`, { 
      encoding: 'utf8' 
    });
    
    expect(setOutput).toContain('Telemetry level set to: off');
    
    // Verify the config file was created
    const configContent = await fs.readFile(telemetryConfigPath, 'utf8');
    const config = JSON.parse(configContent);
    expect(config.level).toBe('off');
    
    // Verify status shows the new level
    const statusOutput = execSync(`npx tsx ${cliPath} telemetry status`, { 
      encoding: 'utf8' 
    });
    expect(statusOutput).toContain('Telemetry level: off');
  });

  it('should set telemetry level to full', async () => {
    const setOutput = execSync(`npx tsx ${cliPath} telemetry set full`, { 
      encoding: 'utf8' 
    });
    
    expect(setOutput).toContain('Telemetry level set to: full');
    
    // Verify the config file was created
    const configContent = await fs.readFile(telemetryConfigPath, 'utf8');
    const config = JSON.parse(configContent);
    expect(config.level).toBe('full');
  });

  it('should reject invalid telemetry level', () => {
    expect(() => {
      execSync(`npx tsx ${cliPath} telemetry set invalid`, { 
        encoding: 'utf8' 
      });
    }).toThrow();
  });

  it('should persist telemetry settings across runs', async () => {
    // Set telemetry to off
    execSync(`npx tsx ${cliPath} telemetry set off`, { 
      encoding: 'utf8' 
    });
    
    // Run status command again to verify persistence
    const statusOutput = execSync(`npx tsx ${cliPath} telemetry status`, { 
      encoding: 'utf8' 
    });
    
    expect(statusOutput).toContain('Telemetry level: off');
  });
});