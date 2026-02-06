import chalk from 'chalk';
import simpleGit from 'simple-git';
import { Ticket } from '../types/index.js';
import { ConfigManager } from '../utils/config.js';
import { GitManager } from '../utils/git.js';
import { CopilotCLI } from '../utils/copilot-cli.js';
import { CopilotAgent } from '../utils/copilot.js';

export interface SimplifiedResolverOptions {
  skipValidation?: boolean;
  cleanupOnError?: boolean;
  existingWorktree?: string; // Optional pre-created worktree path
}

export interface SimplifiedResolutionResult {
  success: boolean;
  ticket: Ticket;
  worktreePath?: string;
  hasChanges: boolean;
  testBranch?: string;
  commitMessage?: string;
  summary?: string; // HTML summary of changes
  error?: string;
  duration: number;
}

/**
 * TicketResolverCLI - Simplified resolver using copilot -p CLI
 * Uses worktrees for isolation, similar to the PowerShell script approach
 */
export class TicketResolverCLI {
  private ticket: Ticket;
  private git: GitManager;
  private copilotSDK: CopilotAgent | null;
  private options: SimplifiedResolverOptions;

  constructor(ticket: Ticket, options?: SimplifiedResolverOptions) {
    this.ticket = ticket;
    this.git = new GitManager();
    
    // Try to initialize Copilot SDK for commit message generation
    try {
      this.copilotSDK = new CopilotAgent();
    } catch {
      this.copilotSDK = null;
      console.log(chalk.gray('Note: Copilot SDK not available, will use default commit messages'));
    }
    
    this.options = {
      cleanupOnError: true,
      ...options
    };
  }

  /**
   * Execute ticket resolution using copilot CLI
   */
  async resolve(): Promise<SimplifiedResolutionResult> {
    const startTime = Date.now();
    let worktreePath: string | undefined;

    console.log(chalk.cyan.bold('\n⚡ Starting Ticket Resolution with GitHub Copilot CLI\n'));
    console.log(chalk.white(`Ticket: ${this.ticket.id} - ${this.ticket.name}`));
    console.log(chalk.gray('─'.repeat(60)));
    console.log();

    try {
      // Step 1: Validate configuration
      this.validateConfiguration();

      // Step 2: Use existing worktree or create new one
      if (this.options.existingWorktree) {
        worktreePath = this.options.existingWorktree;
        console.log(chalk.blue(`📁 Using existing worktree: ${worktreePath}`));
      } else {
        worktreePath = await this.git.createWorktree(this.ticket.id);
      }

      // Step 3: Run copilot CLI
      console.log();
      const configuredModel = ConfigManager.getCopilotModel();
      console.log(chalk.gray(`Using model: ${configuredModel}`));
      const copilotResult = await CopilotCLI.resolveTicket(this.ticket, worktreePath, configuredModel);

      if (!copilotResult.success) {
        throw new Error(copilotResult.error || 'Copilot CLI failed');
      }

      // Step 4: Generate commit message with SDK and commit changes
      console.log();
      let commitMessage: string | undefined;
      let hasChanges = false;
      let summaryHTML: string | undefined;

      // First check if there are changes
      const checkGit = simpleGit(worktreePath);
      const status = await checkGit.status();
      
      if (status.files.length > 0) {
        hasChanges = true;

        // Get diff for both commit message and summary
        const diff = await this.git.getWorktreeDiff(worktreePath);

        // Generate intelligent commit message using SDK
        if (this.copilotSDK && diff) {
          try {
            // Generate commit message with SDK
            const generatedMessage = await this.copilotSDK.generateCommitMessage(diff, this.ticket.id);
            
            // Format: [feat]: {generated message}({ticketId})
            commitMessage = `[feat]: ${generatedMessage}(${this.ticket.id})`;
          } catch (error) {
            console.log(chalk.yellow('⚠️  Failed to generate commit message, using default'));
          }
        }

        // Commit with generated or default message
        await this.git.commitInWorktree(worktreePath, this.ticket.id, commitMessage);

        // Generate summary HTML after committing
        if (this.copilotSDK && diff) {
          try {
            console.log();
            summaryHTML = await this.copilotSDK.generateTicketSummary(this.ticket.id, diff, commitMessage);
          } catch (error) {
            console.log(chalk.yellow('⚠️  Failed to generate summary'));
          }
        }
      } else {
        console.log(chalk.yellow('\n⚠️  WARNING: No changes detected. Issue may not be fixed.'));
        console.log(chalk.yellow('    Review the output above to understand what happened.'));
      }

      // Step 5: Create test branch
      let testBranch: string | undefined;
      if (hasChanges) {
        console.log();
        testBranch = await this.git.createTestBranch(this.ticket.id);
      }

      // Step 6: Return to base branch
      const baseRepoPath = ConfigManager.getBaseRepositoryPath();
      if (baseRepoPath) {
        const baseBranch = ConfigManager.getBaseBranch();
        console.log();
        console.log(chalk.blue(`🔄 Returning to ${baseBranch} branch...`));
        console.log(chalk.green(`✓ Switched back to ${baseBranch}`));
      }

      // Success summary
      const duration = Date.now() - startTime;
      console.log();
      console.log(chalk.green.bold('✓ TICKET RESOLUTION COMPLETED'));
      console.log(chalk.gray(`   Duration: ${(duration / 1000).toFixed(1)}s`));
      if (commitMessage) {
        console.log(chalk.gray(`   Commit: ${commitMessage}`));
      }
      if (testBranch) {
        console.log(chalk.gray(`   Test branch: ${testBranch}`));
      }
      console.log(chalk.gray(`   Worktree: ${worktreePath}`));
      if (summaryHTML) {
        console.log(chalk.gray(`   Summary: Generated ✓`));
      }
      console.log();

      return {
        success: true,
        ticket: this.ticket,
        worktreePath,
        hasChanges,
        testBranch,
        commitMessage,
        summary: summaryHTML,
        duration
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      console.log();
      console.log(chalk.red.bold('✗ TICKET RESOLUTION FAILED'));
      console.log(chalk.red(`   Error: ${errorMessage}`));
      console.log(chalk.gray(`   Duration: ${(duration / 1000).toFixed(1)}s`));
      console.log();

      // Cleanup on error if requested
      if (this.options.cleanupOnError && worktreePath) {
        console.log(chalk.yellow('🧹 Cleaning up worktree...'));
        try {
          await this.git.removeWorktree(worktreePath);
        } catch (cleanupError) {
          console.log(chalk.yellow('⚠️  Failed to cleanup worktree'));
        }
      }

      return {
        success: false,
        ticket: this.ticket,
        worktreePath,
        hasChanges: false,
        error: errorMessage,
        duration
      };
    }
  }

  /**
   * Validate required configuration
   */
  private validateConfiguration(): void {
    console.log(chalk.blue('🔍 Validating configuration...'));

    // Check copilot CLI availability
    if (!CopilotCLI.isAvailable()) {
      throw new Error('GitHub Copilot CLI not found. Install it with: npm install -g @github/copilot-cli');
    }

    // Check automation path
    const automationPath = ConfigManager.getAutomationPath();
    if (!automationPath) {
      throw new Error('Automation path not configured. Set it with: autopilot config set automationPath <path>');
    }

    // Check base repository path
    const baseRepoPath = ConfigManager.getBaseRepositoryPath();
    if (!baseRepoPath) {
      throw new Error('Base repository path not configured. Set it with: autopilot config set baseRepositoryPath <path>');
    }

    console.log(chalk.green('✓ Configuration valid'));
    console.log(chalk.gray(`   Base repo: ${baseRepoPath}`));
    console.log(chalk.gray(`   Automation: ${automationPath}`));
  }

  /**
   * Get summary of result
   */
  static getSummary(result: SimplifiedResolutionResult): string {
    const lines: string[] = [];
    
    lines.push(chalk.cyan.bold('═'.repeat(60)));
    lines.push(chalk.cyan.bold('  RESOLUTION SUMMARY'));
    lines.push(chalk.cyan.bold('═'.repeat(60)));
    lines.push('');

    if (result.success) {
      lines.push(chalk.green('✓ Status: SUCCESS'));
      lines.push(chalk.gray(`  Duration: ${(result.duration / 1000).toFixed(1)}s`));
      lines.push('');
      lines.push(chalk.white('Changes:'));
      lines.push(chalk.gray(`  Has changes: ${result.hasChanges ? 'Yes' : 'No'}`));
      if (result.testBranch) {
        lines.push(chalk.gray(`  Test branch: ${result.testBranch}`));
      }
      if (result.worktreePath) {
        lines.push(chalk.gray(`  Worktree: ${result.worktreePath}`));
      }
    } else {
      lines.push(chalk.red('✗ Status: FAILED'));
      lines.push(chalk.red(`  Error: ${result.error || 'Unknown error'}`));
      lines.push(chalk.gray(`  Duration: ${(result.duration / 1000).toFixed(1)}s`));
    }

    lines.push('');
    lines.push(chalk.cyan('─'.repeat(60)));

    return lines.join('\n');
  }
}
