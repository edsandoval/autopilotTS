import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CopilotCLI } from '../utils/copilot-cli.js';
import { ConfigManager } from '../utils/config.js';
import { Ticket, TicketStatus } from '../types/index.js';
import { existsSync, rmSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

describe('Prompt Configuration', () => {
  let originalConfig: any;
  const configPath = join(homedir(), '.autopilot', 'config.json');

  beforeEach(() => {
    // Save original config
    if (existsSync(configPath)) {
      originalConfig = ConfigManager.getConfig();
    }
  });

  afterEach(() => {
    // Restore original config
    if (originalConfig) {
      ConfigManager.saveConfig(originalConfig);
    }
  });

  describe('ConfigManager - Prompt Methods', () => {
    it('should get default ticket command prompt', () => {
      const prompt = ConfigManager.getTicketCommandPrompt();
      expect(prompt).toContain('${FILE}');
      expect(typeof prompt).toBe('string');
    });

    it('should get default ticket resolution prompt', () => {
      const prompt = ConfigManager.getTicketResolutionPrompt();
      expect(prompt).toContain('${ID}');
      expect(prompt).toContain('${DESCRIPTION}');
      expect(typeof prompt).toBe('string');
    });

    it('should set and get custom ticket command prompt', () => {
      const customPrompt = 'Custom command prompt with ${FILE} placeholder';
      ConfigManager.setTicketCommandPrompt(customPrompt);
      
      const retrieved = ConfigManager.getTicketCommandPrompt();
      expect(retrieved).toBe(customPrompt);
    });

    it('should set and get custom ticket resolution prompt', () => {
      const customPrompt = 'Custom resolution prompt with ${ID} and ${DESCRIPTION}';
      ConfigManager.setTicketResolutionPrompt(customPrompt);
      
      const retrieved = ConfigManager.getTicketResolutionPrompt();
      expect(retrieved).toBe(customPrompt);
    });
  });

  describe('CopilotCLI - Prompt Building with Placeholders', () => {
    it('should replace ${ID} and ${DESCRIPTION} in buildPrompt', () => {
      const testTicket: Ticket = {
        id: 'TEST-123',
        name: 'Test Ticket',
        description: 'Fix the bug in the login component',
        status: TicketStatus.PENDING,
        createdAt: new Date()
      };

      // Set a simple test prompt
      ConfigManager.setTicketResolutionPrompt('Issue: ${ID}, Description: ${DESCRIPTION}');

      const result = CopilotCLI.buildPrompt(testTicket);
      
      expect(result).toBe('Issue: TEST-123, Description: Fix the bug in the login component');
      expect(result).not.toContain('${ID}');
      expect(result).not.toContain('${DESCRIPTION}');
    });

    it('should replace multiple occurrences of placeholders', () => {
      const testTicket: Ticket = {
        id: 'MULTI-001',
        name: 'Multi Test',
        description: 'Test description',
        status: TicketStatus.PENDING,
        createdAt: new Date()
      };

      ConfigManager.setTicketResolutionPrompt('ID: ${ID}, Again: ${ID}, Desc: ${DESCRIPTION}, Again: ${DESCRIPTION}');

      const result = CopilotCLI.buildPrompt(testTicket);
      
      expect(result).toBe('ID: MULTI-001, Again: MULTI-001, Desc: Test description, Again: Test description');
    });

    it('should handle special characters in ticket description', () => {
      const testTicket: Ticket = {
        id: 'SPECIAL-001',
        name: 'Special Chars',
        description: 'Fix bug with "quotes" and $variables & symbols',
        status: TicketStatus.PENDING,
        createdAt: new Date()
      };

      ConfigManager.setTicketResolutionPrompt('${ID}: ${DESCRIPTION}');

      const result = CopilotCLI.buildPrompt(testTicket);
      
      expect(result).toContain('Fix bug with "quotes" and $variables & symbols');
      expect(result).not.toContain('${ID}');
      expect(result).not.toContain('${DESCRIPTION}');
    });
  });

  describe('Prompt Placeholders Documentation', () => {
    it('ticket command prompt should use ${FILE} placeholder', () => {
      const prompt = ConfigManager.getTicketCommandPrompt();
      expect(prompt).toContain('${FILE}');
    });

    it('ticket resolution prompt should use ${ID} and ${DESCRIPTION} placeholders', () => {
      const prompt = ConfigManager.getTicketResolutionPrompt();
      expect(prompt).toContain('${ID}');
      expect(prompt).toContain('${DESCRIPTION}');
    });
  });
});
