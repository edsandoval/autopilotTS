import fs from 'fs';
import path from 'path';
import os from 'os';
import { ProjectConfig } from '../types/index.js';

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
        copilotModel: 'gpt-4o'
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
}
