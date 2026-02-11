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

**Rules:**
- Only modify what's necessary
- Don't refactor unrelated code
- Don't change dependencies
- Don't perform git operations
- Keep changes minimal
- Apply changes directly to the code`;

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
        reportLanguage: 'en'
      };
      
      fs.writeFileSync(configPath, JSON.stringify(initialConfig, null, 2));
    }
  }

  static getConfig(): ProjectConfig {
    this.ensureConfigExists();
    const data = fs.readFileSync(getConfigFile(), 'utf-8');
    return JSON.parse(data);
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

  static getReportLanguage(): string {
    const config = this.getConfig();
    return config.reportLanguage || 'en';
  }

  static setReportLanguage(language: string): void {
    const config = this.getConfig();
    config.reportLanguage = language;
    this.saveConfig(config);
  }
}
