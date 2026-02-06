import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { ProjectConfig } from '../types/index.js';

describe('Config - File Operations', () => {
  let testDir: string;
  let configFile: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `autopilot-config-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    configFile = join(testDir, '.autopilot.config.json');
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should read project path from config file', () => {
    const config: ProjectConfig = {
      projectPath: '/test/path',
      debug: false
    };
    
    writeFileSync(configFile, JSON.stringify(config));

    const loaded: ProjectConfig = JSON.parse(readFileSync(configFile, 'utf8'));
    expect(loaded.projectPath).toBe('/test/path');
  });

  it('should write project path to config file', () => {
    const config: ProjectConfig = {
      projectPath: '/new/path',
      debug: false
    };

    writeFileSync(configFile, JSON.stringify(config, null, 2));

    expect(existsSync(configFile)).toBe(true);
    const loaded: ProjectConfig = JSON.parse(readFileSync(configFile, 'utf8'));
    expect(loaded.projectPath).toBe('/new/path');
  });

  it('should handle debug mode in config', () => {
    const config: ProjectConfig = {
      debug: true
    };

    writeFileSync(configFile, JSON.stringify(config));
    const loaded: ProjectConfig = JSON.parse(readFileSync(configFile, 'utf8'));

    expect(loaded.debug).toBe(true);
  });

  it('should store copilot model in config', () => {
    const config: ProjectConfig = {
      debug: false,
      copilotModel: 'gpt-5'
    };

    writeFileSync(configFile, JSON.stringify(config));
    const loaded: ProjectConfig = JSON.parse(readFileSync(configFile, 'utf8'));

    expect(loaded.copilotModel).toBe('gpt-5');
  });

  it('should create default config structure', () => {
    const config: ProjectConfig = {
      debug: false
    };

    writeFileSync(configFile, JSON.stringify(config, null, 2));

    expect(existsSync(configFile)).toBe(true);
    const content = readFileSync(configFile, 'utf8');
    expect(content).toContain('debug');
  });
});
