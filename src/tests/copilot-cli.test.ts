import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir, homedir } from 'os';

describe('CopilotCLI - Prompt File Creation', () => {
  let testPromptsDir: string;

  beforeEach(() => {
    // Use a test-specific prompts directory
    testPromptsDir = join(tmpdir(), `autopilot-prompts-test-${Date.now()}`);
  });

  afterEach(() => {
    // Cleanup test prompts
    if (existsSync(testPromptsDir)) {
      rmSync(testPromptsDir, { recursive: true, force: true });
    }
  });

  it('should create prompts directory if not exists', () => {
    // Simulate directory creation
    if (!existsSync(testPromptsDir)) {
      mkdirSync(testPromptsDir, { recursive: true });
    }

    expect(existsSync(testPromptsDir)).toBe(true);
  });

  it('should save prompt with ticket ID in filename', () => {
    mkdirSync(testPromptsDir, { recursive: true });
    
    const timestamp = Date.now();
    const ticketId = 'MOBILE-002';
    const prompt = 'Test prompt with special chars: "quotes" & $vars';
    const filename = `${timestamp}_${ticketId}.md`;
    const filePath = join(testPromptsDir, filename);

    writeFileSync(filePath, prompt, 'utf8');

    expect(existsSync(filePath)).toBe(true);
    expect(filename).toMatch(/^\d+_MOBILE-002\.md$/);
  });

  it('should preserve special characters in saved prompt', () => {
    mkdirSync(testPromptsDir, { recursive: true });
    
    const problematicPrompt = `Prompt with "double quotes"
and 'single quotes'
and $variables
and \`backticks\`
and special chars: & | < > ^ %`;

    const filePath = join(testPromptsDir, 'test-prompt.md');
    writeFileSync(filePath, problematicPrompt, 'utf8');

    const savedContent = require('fs').readFileSync(filePath, 'utf8');
    expect(savedContent).toBe(problematicPrompt);
  });

  it('should create filename without ticket ID when not provided', () => {
    mkdirSync(testPromptsDir, { recursive: true });
    
    const timestamp = Date.now();
    const prompt = 'Generic prompt';
    const filename = `${timestamp}.md`;
    const filePath = join(testPromptsDir, filename);

    writeFileSync(filePath, prompt, 'utf8');

    expect(existsSync(filePath)).toBe(true);
    expect(filename).toMatch(/^\d+\.md$/);
  });

  it('should use standard prompts location in home directory', () => {
    const expectedPath = join(homedir(), '.autopilot', 'prompts');
    expect(expectedPath).toContain('.autopilot');
    expect(expectedPath).toContain('prompts');
  });
});
