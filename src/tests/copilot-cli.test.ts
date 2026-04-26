import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { tmpdir } from 'os';
import { existsSync, rmSync } from 'fs';
import { ProjectManager } from '../utils/project.js';
import { CopilotCLI } from '../utils/copilot-cli.js';

// Basic sanity checks for prompt path logic

describe('CopilotCLI - project prompts path', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `autopilot-prompts-test-${Date.now()}`);
    process.env.AUTOPILOT_DIR = testDir;
  });

  afterEach(() => {
    delete process.env.AUTOPILOT_DIR;
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should use global folder when no project active', () => {
    const promptsDir = (CopilotCLI as any).getPromptsDir();
    expect(promptsDir).toContain('.autopilot');
  });

  it('should switch to project-specific prompts directory', () => {
    ProjectManager.createProject('FooBar');
    const promptsDir = (CopilotCLI as any).getPromptsDir();
    // encoded project name should appear as part of path (base64)
    const encoded = ProjectManager.encodeName('FooBar');
    expect(promptsDir).toContain(encoded);
    // ensure directory exists after ensurePromptsDir call
    (CopilotCLI as any).ensurePromptsDir();
    expect(existsSync(promptsDir)).toBe(true);
  });
});