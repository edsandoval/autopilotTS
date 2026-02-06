import { execSync, spawn } from 'child_process';
import chalk from 'chalk';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { Ticket } from '../types/index.js';

export interface CopilotCLIOptions {
  allowAll?: boolean;
  noAskUser?: boolean;
  silent?: boolean;
  workingDir: string;
  model?: string; // Model to use (e.g., 'gpt-4', 'claude-sonnet')
}

export interface CopilotCLIResult {
  success: boolean;
  output: string;
  error?: string;
}

/**
 * Wrapper for GitHub Copilot CLI (copilot -p command)
 */
export class CopilotCLI {
  
  /**
   * Get prompts directory path
   */
  private static getPromptsDir(): string {
    return join(homedir(), '.autopilot', 'prompts');
  }

  /**
   * Ensure prompts directory exists
   */
  private static ensurePromptsDir(): void {
    const dir = this.getPromptsDir();
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Save prompt to file and return the file path
   */
  private static savePromptToFile(prompt: string, ticketId?: string): string {
    this.ensurePromptsDir();
    
    const timestamp = Date.now();
    const filename = ticketId 
      ? `${timestamp}_${ticketId}.md`
      : `${timestamp}.md`;
    
    const filePath = join(this.getPromptsDir(), filename);
    writeFileSync(filePath, prompt, 'utf8');
    
    console.log(chalk.gray(`💾 Prompt saved: ${filePath}`));
    
    return filePath;
  }

  /**
   * Check if copilot CLI is available
   */
  static isAvailable(): boolean {
    try {
      execSync('copilot --version', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Build prompt for ticket resolution
   */
  static buildPrompt(ticket: Ticket): string {
    return `You are working on a repository.

Corrige el siguiente issue en el código.

**Identificador del issue:**
${ticket.id}
**Descripción del issue:**
${ticket.description}

**Reglas:**
- Solo modificar lo necesario
- No refactorizar código no relacionado
- No cambiar dependencias
- No hacer operaciones de git
- Mantener cambios mínimos
- Aplicar cambios directamente al código
`;
  }

  /**
   * Execute copilot CLI with prompt
   */
  static async runPrompt(
    prompt: string,
    options: CopilotCLIOptions,
    ticketId?: string
  ): Promise<CopilotCLIResult> {
    console.log(chalk.cyan('🚀 Launching GitHub Copilot CLI...'));
    console.log(chalk.gray(`Working directory: ${options.workingDir}`));
    console.log();

    // Build flags
    const flags: string[] = [];
    if (options.allowAll) {
      flags.push('--allow-all');
    }
    if (options.noAskUser) {
      flags.push('--no-ask-user');
    }
    if (options.silent) {
      flags.push('--silent');
    }
    if (options.model) {
      flags.push(`--model ${options.model}`);
    }

    // Save prompt to file
    const promptFile = this.savePromptToFile(prompt, ticketId);

    // Build command using @ syntax for file reference
    const command = `copilot -p "Actúa como desarrollador senior. Analiza el ticket de software en el siguiente archivo y proporciona una implementacion que lo resuelva, Archivo -> @${promptFile}" ${flags.join(' ')}`;

    // DEBUG: Show complete command
    console.log(chalk.yellow('📝 Command to execute:'));
    console.log(chalk.white(`   ${command}`));
    console.log(chalk.yellow('📝 Prompt preview:'));
    console.log(chalk.gray('─'.repeat(60)));
    console.log(chalk.white(prompt.substring(0, 200) + (prompt.length > 200 ? '...' : '')));
    console.log(chalk.gray('─'.repeat(60)));
    console.log();

    return new Promise((resolve) => {
      // Detect shell based on OS
      const shell = process.platform === 'win32' 
        ? 'powershell.exe' 
        : '/bin/sh';
      
      const proc = spawn(command, [], {
        cwd: options.workingDir,
        stdio: ['inherit', 'inherit', 'inherit'],
        shell
      });

      let output = '';
      let errorOutput = '';

      proc.on('close', (code) => {
        if (code === 0) {
          console.log();
          console.log(chalk.green('✓ Copilot CLI completed successfully'));
          resolve({
            success: true,
            output: output || 'Copilot completed'
          });
        } else {
          console.log();
          console.log(chalk.red(`✗ Copilot CLI failed with code ${code}`));
          resolve({
            success: false,
            output: output,
            error: errorOutput || `Process exited with code ${code}`
          });
        }
      });

      proc.on('error', (error) => {
        console.log();
        console.log(chalk.red('✗ Failed to execute Copilot CLI'));
        resolve({
          success: false,
          output: '',
          error: error.message
        });
      });
    });
  }

  /**
   * Run copilot for ticket resolution
   */
  static async resolveTicket(
    ticket: Ticket,
    workingDir: string,
    model?: string
  ): Promise<CopilotCLIResult> {
    const prompt = this.buildPrompt(ticket);
    
    return this.runPrompt(prompt, {
      allowAll: true,
      noAskUser: true,
      silent: true,
      workingDir,
      model
    }, ticket.id);
  }
}
