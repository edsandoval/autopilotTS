import fs from 'fs';
import path from 'path';
import os from 'os';
import { ProjectConfig } from '../types/index.js';

// Default prompts
const DEFAULT_TICKET_COMMAND_PROMPT = 'Act as a senior developer. Analyze the software ticket in the following file and provide an implementation to resolve it, File -> ${FILE}';

const DEFAULT_TICKET_RESOLUTION_PROMPT = `You are working on a repository.

Fix the following issue in the code.

**Issue Identifier:**
\${ID}
**Issue Description:**
\${DESCRIPTION}

**Type-specific Instructions:**
\${TYPE}

**Rules:**
- Only modify what's necessary
- Don't refactor unrelated code
- Don't change dependencies
- Don't perform git operations
- Keep changes minimal
- Apply changes directly to the code`;

// Default per-type prompts used when ticketTypes are not configured
const DEFAULT_TICKET_TYPE_PROMPTS: { [k: string]: string } = {
  bug: `🐛 This task is a BUG FIX. Identify the root cause of the reported behavior and fix it. Before writing any code, add a brief analysis of what is failing and why to the final report. Keep the diff focused and minimal — avoid touching unrelated code. At the end, leave a report detailing: root cause found, changes made, and files modified.`,
  enhancement: `✨ This task is an ENHANCEMENT to existing functionality. Extend or improve the feature respecting the existing architecture and patterns. If you introduce new parameters, methods or config, make them backward-compatible. At the end, leave a report detailing: what was extended, approach taken, and files modified.`,
  feature: `🚀 This task is a NEW FEATURE. Identify where in the codebase this fits and integrate it following the project's conventions for structure, naming and patterns. Build incrementally and prefer small, composable pieces. Do not modify unrelated code. At the end, leave a report detailing: what was built, how it integrates with existing modules, and files modified.`,
  codeReview: `🔍 This task is a CODE REVIEW. Analyze the code and identify: bugs or logic errors, security concerns, performance issues, readability problems, and deviations from the project's patterns. Apply the fixes you consider necessary and justified. At the end, leave a report detailing: issues found, changes applied, and files modified.`,
  refactor: `♻️ This task is a REFACTOR. Behavior must remain identical before and after — do not introduce new functionality. Focus on reducing complexity, improving naming, eliminating duplication, and aligning with existing patterns. At the end, leave a report detailing: what was refactored, reasoning behind each change, and files modified.`
};
function getAutopilotDir(): string {
  // Get user home directory
  const homeDir = os.homedir();
  const autopilotDir = path.join(homeDir, '.autopilot');
  
  // Ensure directory exists
  if (!fs.existsSync(autopilotDir)) {
    fs.mkdirSync(autopilotDir, { recursive: true });
  }
  
  return autopilotDir;
}

function getConfigFile(): string {
  return path.join(getAutopilotDir(), 'config.json');
}

export class ConfigManager {
  private static ensureConfigExists(): void {
    const configPath = getConfigFile();
    
    if (!fs.existsSync(configPath)) {
      const initialConfig: ProjectConfig = {
        debug: false,
        baseRepositoryPath: undefined,
        automationPath: undefined,
        baseBranch: 'develop',
        copilotModel: 'gpt-4o',
        ticketCommandPrompt: DEFAULT_TICKET_COMMAND_PROMPT,
        ticketResolutionPrompt: DEFAULT_TICKET_RESOLUTION_PROMPT,
        reportLanguage: 'en',
        ticketTypes: {
          bug: DEFAULT_TICKET_TYPE_PROMPTS.bug,
          enhancement: DEFAULT_TICKET_TYPE_PROMPTS.enhancement,
          feature: DEFAULT_TICKET_TYPE_PROMPTS.feature,
          codeReview: DEFAULT_TICKET_TYPE_PROMPTS.codeReview,
          refactor: DEFAULT_TICKET_TYPE_PROMPTS.refactor
        }
      };

      fs.writeFileSync(configPath, JSON.stringify(initialConfig, null, 2));
    }
  }

  static getConfig(): ProjectConfig {
    try {
      this.ensureConfigExists();
      const configFile = getConfigFile();
      console.log('[ConfigManager] Reading config from:', configFile);
      
      if (!fs.existsSync(configFile)) {
        throw new Error(`Config file does not exist: ${configFile}`);
      }
      
      const data = fs.readFileSync(configFile, 'utf-8');
      console.log('[ConfigManager] Read', data.length, 'bytes from config file');
      
      const config = JSON.parse(data);
      console.log('[ConfigManager] Config loaded successfully');
      
      // Migration: ensure ticketTypes keys exist (do not overwrite explicit user values)
      const ticketTypes = config.ticketTypes || {};
      let migrated = false;
      for (const key of ['bug','enhancement','feature','codeReview','refactor']) {
        if (typeof ticketTypes[key] === 'undefined') {
          ticketTypes[key] = DEFAULT_TICKET_TYPE_PROMPTS[key];
          migrated = true;
        }
      }
      if (!config.ticketTypes) config.ticketTypes = ticketTypes;
      if (migrated) {
        try {
          fs.writeFileSync(getConfigFile(), JSON.stringify(config, null, 2));
          console.log('[ConfigManager] Migrated config to include ticketTypes defaults');
        } catch (e) {
          console.warn('[ConfigManager] Failed to persist migrated config:', e);
        }
      }

      return config;
    } catch (error) {
      console.error('[ConfigManager] Error reading config:', error);
      throw error;
    }
  }

  static saveConfig(config: ProjectConfig): void {
    this.ensureConfigExists();
    fs.writeFileSync(getConfigFile(), JSON.stringify(config, null, 2));
  }

  static isDebugEnabled(): boolean {
    const config = this.getConfig();
    return config.debug === true;
  }

  static setDebug(enabled: boolean): void {
    const config = this.getConfig();
    config.debug = enabled;
    this.saveConfig(config);
  }

  static getBaseRepositoryPath(): string | undefined {
    const config = this.getConfig();
    return config.baseRepositoryPath;
  }

  static setBaseRepositoryPath(baseRepositoryPath: string): void {
    if (!fs.existsSync(baseRepositoryPath)) {
      throw new Error(`Base repository path does not exist: ${baseRepositoryPath}`);
    }

    if (!fs.statSync(baseRepositoryPath).isDirectory()) {
      throw new Error(`Base repository path is not a directory: ${baseRepositoryPath}`);
    }

    const config = this.getConfig();
    config.baseRepositoryPath = baseRepositoryPath;
    this.saveConfig(config);
  }

  static getAutomationPath(): string | undefined {
    const config = this.getConfig();
    return config.automationPath;
  }

  static setAutomationPath(automationPath: string): void {
    if (!fs.existsSync(automationPath)) {
      throw new Error(`Automation path does not exist: ${automationPath}`);
    }

    if (!fs.statSync(automationPath).isDirectory()) {
      throw new Error(`Automation path is not a directory: ${automationPath}`);
    }

    const config = this.getConfig();
    config.automationPath = automationPath;
    this.saveConfig(config);
  }

  static getBaseBranch(): string {
    const config = this.getConfig();
    return config.baseBranch || 'develop';
  }

  static setBaseBranch(baseBranch: string): void {
    const config = this.getConfig();
    config.baseBranch = baseBranch;
    this.saveConfig(config);
  }

  static getCopilotModel(): string {
    const config = this.getConfig();
    return config.copilotModel || 'gpt-4o';
  }

  static setCopilotModel(model: string): void {
    const config = this.getConfig();
    config.copilotModel = model;
    this.saveConfig(config);
  }

  static getConfigPath(): string {
    return getAutopilotDir();
  }

  static getTicketCommandPrompt(): string {
    const config = this.getConfig();
    return config.ticketCommandPrompt || DEFAULT_TICKET_COMMAND_PROMPT;
  }

  static setTicketCommandPrompt(prompt: string): void {
    const config = this.getConfig();
    config.ticketCommandPrompt = prompt;
    this.saveConfig(config);
  }

  static getTicketResolutionPrompt(): string {
    const config = this.getConfig();
    return config.ticketResolutionPrompt || DEFAULT_TICKET_RESOLUTION_PROMPT;
  }

  static setTicketResolutionPrompt(prompt: string): void {
    const config = this.getConfig();
    config.ticketResolutionPrompt = prompt;
    this.saveConfig(config);
  }

  /**
   * Return the configured per-type prompts (always returns object with keys).
   */
  static getTicketTypes(): { bug: string; enhancement: string; feature: string; codeReview: string; refactor: string } {
    const config = this.getConfig();
    const tt = config.ticketTypes || {};
    return {
      bug: (Object.prototype.hasOwnProperty.call(tt, 'bug') ? tt.bug : DEFAULT_TICKET_TYPE_PROMPTS.bug) || DEFAULT_TICKET_TYPE_PROMPTS.bug,
      enhancement: (Object.prototype.hasOwnProperty.call(tt, 'enhancement') ? tt.enhancement : DEFAULT_TICKET_TYPE_PROMPTS.enhancement) || DEFAULT_TICKET_TYPE_PROMPTS.enhancement,
      feature: (Object.prototype.hasOwnProperty.call(tt, 'feature') ? tt.feature : DEFAULT_TICKET_TYPE_PROMPTS.feature) || DEFAULT_TICKET_TYPE_PROMPTS.feature,
      codeReview: (Object.prototype.hasOwnProperty.call(tt, 'codeReview') ? tt.codeReview : DEFAULT_TICKET_TYPE_PROMPTS.codeReview) || DEFAULT_TICKET_TYPE_PROMPTS.codeReview,
      refactor: (Object.prototype.hasOwnProperty.call(tt, 'refactor') ? tt.refactor : DEFAULT_TICKET_TYPE_PROMPTS.refactor) || DEFAULT_TICKET_TYPE_PROMPTS.refactor
    };
  }

  static getReportLanguage(): string {
    const config = this.getConfig();
    return config.reportLanguage || 'en';
  }

  static setTicketTypes(ticketTypes: Partial<{ bug: string; enhancement: string; feature: string; codeReview: string; refactor: string }>): void {
    const config = this.getConfig();
    config.ticketTypes = { ...(config.ticketTypes || {}), ...(ticketTypes as any) };
    this.saveConfig(config);
  }

  /**
   * Get the prompt for a specific ticket type
   */
  static getTicketTypePrompt(type?: string): string {
    if (!type) return '';
    
    const ticketTypes = this.getTicketTypes();
    const typeKey = type === 'code-review' ? 'codeReview' : type;
    
    return (ticketTypes as any)[typeKey] || '';
  }

  static setReportLanguage(language: string): void {
    const config = this.getConfig();
    config.reportLanguage = language;
    this.saveConfig(config);
  }
}
