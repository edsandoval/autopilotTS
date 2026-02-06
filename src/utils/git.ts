import simpleGit, { SimpleGit } from 'simple-git';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { ConfigManager } from './config.js';

export class GitManager {
  private git: SimpleGit;
  private baseRepoGit: SimpleGit | null = null;

  constructor() {
    // Default to current working directory
    this.git = simpleGit(process.cwd());

    // If baseRepositoryPath is configured, use it
    const baseRepoPath = ConfigManager.getBaseRepositoryPath();
    if (baseRepoPath) {
      this.baseRepoGit = simpleGit(baseRepoPath);
    }
  }

  async isGitRepo(): Promise<boolean> {
    try {
      await this.git.status();
      return true;
    } catch {
      return false;
    }
  }

  async getCurrentBranch(): Promise<string> {
    const status = await this.git.status();
    return status.current || 'unknown';
  }

  async pullDevelop(): Promise<void> {
    const baseBranch = ConfigManager.getBaseBranch();
    console.log(chalk.blue(`📥 Pulling latest changes from ${baseBranch}...`));
    
    const currentBranch = await this.getCurrentBranch();
    
    // Checkout to base branch
    await this.git.checkout(baseBranch);
    
    // Pull latest changes
    await this.git.pull('origin', baseBranch);
    
    console.log(chalk.green(`✓ Successfully pulled from ${baseBranch}`));
  }

  async createBranch(ticketId: string): Promise<string> {
    const baseBranch = ConfigManager.getBaseBranch();
    const branchName = `copilot/${ticketId}`;
    
    console.log(chalk.blue(`🌿 Creating branch: ${branchName}...`));
    
    // Create and checkout new branch from base branch
    await this.git.checkoutBranch(branchName, baseBranch);
    
    console.log(chalk.green(`✓ Branch ${branchName} created and checked out`));
    
    return branchName;
  }

  async commitChanges(ticketId: string, message: string): Promise<void> {
    console.log(chalk.blue('💾 Committing changes...'));
    
    // Stage all changes
    await this.git.add('.');
    
    // Commit
    await this.git.commit(`[${ticketId}] ${message}`);
    
    console.log(chalk.green('✓ Changes committed successfully'));
  }

  async returnToDevelop(): Promise<void> {
    const baseBranch = ConfigManager.getBaseBranch();
    console.log(chalk.blue(`🔄 Returning to ${baseBranch} branch...`));
    
    await this.git.checkout(baseBranch);
    
    console.log(chalk.green(`✓ Switched back to ${baseBranch}`));
  }

  async hasUncommittedChanges(): Promise<boolean> {
    const status = await this.git.status();
    return status.files.length > 0;
  }

  /**
   * Create a worktree for the ticket
   */
  async createWorktree(ticketId: string): Promise<string> {
    const automationPath = ConfigManager.getAutomationPath();
    const baseRepoPath = ConfigManager.getBaseRepositoryPath();

    if (!automationPath) {
      throw new Error('Automation path not configured. Use: autopilot config set automationPath <path>');
    }

    if (!baseRepoPath) {
      throw new Error('Base repository path not configured. Use: autopilot config set baseRepositoryPath <path>');
    }

    const baseBranch = ConfigManager.getBaseBranch();
    const branchName = `copilot/${ticketId}`;
    const worktreePath = path.join(automationPath, ticketId);

    console.log(chalk.blue(`📁 Creating worktree for ${ticketId}...`));

    // Use baseRepoGit for worktree operations
    const git = this.baseRepoGit || simpleGit(baseRepoPath);

    // Ensure we're on base branch and up to date
    await git.checkout(baseBranch);
    await git.pull('origin', baseBranch);

    // Create branch if it doesn't exist
    try {
      await git.branch([branchName, baseBranch]);
    } catch (error) {
      // Branch may already exist, that's ok
      console.log(chalk.gray(`Branch ${branchName} already exists`));
    }

    // Create worktree
    await git.raw(['worktree', 'add', worktreePath, branchName]);

    console.log(chalk.green(`✓ Worktree created at: ${worktreePath}`));

    return worktreePath;
  }

  /**
   * Remove a worktree
   */
  async removeWorktree(worktreePath: string): Promise<void> {
    const baseRepoPath = ConfigManager.getBaseRepositoryPath();
    
    if (!baseRepoPath) {
      throw new Error('Base repository path not configured');
    }

    const git = this.baseRepoGit || simpleGit(baseRepoPath);

    console.log(chalk.blue(`🗑️  Removing worktree: ${worktreePath}...`));

    try {
      await git.raw(['worktree', 'remove', worktreePath, '--force']);
      console.log(chalk.green('✓ Worktree removed'));
    } catch (error) {
      console.log(chalk.yellow('⚠️  Failed to remove worktree, cleaning up manually...'));
      // Manual cleanup if git command fails
      if (fs.existsSync(worktreePath)) {
        fs.rmSync(worktreePath, { recursive: true, force: true });
      }
    }
  }

  /**
   * Create test branch from worktree branch
   */
  async createTestBranch(ticketId: string): Promise<string> {
    const baseRepoPath = ConfigManager.getBaseRepositoryPath();
    
    if (!baseRepoPath) {
      throw new Error('Base repository path not configured');
    }

    const git = this.baseRepoGit || simpleGit(baseRepoPath);
    const baseBranch = ConfigManager.getBaseBranch();
    const copilotBranch = `copilot/${ticketId}`;
    const testBranch = `test/copilot/${ticketId}`;

    console.log(chalk.blue(`🧪 Creating test branch: ${testBranch}...`));

    try {
      // Delete test branch if it exists
      try {
        await git.deleteLocalBranch(testBranch, true);
      } catch {
        // Branch doesn't exist, that's ok
      }

      // Create test branch from copilot branch
      await git.checkoutBranch(testBranch, copilotBranch);
      
      // Return to base branch
      await git.checkout(baseBranch);

      console.log(chalk.green(`✓ Test branch created: ${testBranch}`));
      return testBranch;
    } catch (error) {
      console.log(chalk.yellow('⚠️  Failed to create test branch'));
      throw error;
    }
  }

  /**
   * Commit changes in worktree
   */
  async commitInWorktree(worktreePath: string, ticketId: string, customMessage?: string): Promise<boolean> {
    const git = simpleGit(worktreePath);

    console.log(chalk.blue('💾 Checking for changes in worktree...'));

    const status = await git.status();
    
    if (status.files.length === 0) {
      console.log(chalk.yellow('⚠️  No changes detected'));
      return false;
    }

    console.log(chalk.green(`✓ Found ${status.files.length} changed file(s)`));
    console.log();
    status.files.forEach(file => {
      console.log(chalk.gray(`   ${file.working_dir} ${file.path}`));
    });
    console.log();

    // Stage and commit
    await git.add('.');
    const commitMessage = customMessage || `[feat]: Implement functionality for ${ticketId} task`;
    await git.commit(commitMessage);

    console.log(chalk.green('✓ Changes committed in worktree'));
    return true;
  }

  /**
   * Get diff of changes in worktree
   */
  async getWorktreeDiff(worktreePath: string): Promise<string> {
    const git = simpleGit(worktreePath);
    
    try {
      // Get staged + unstaged changes
      const diff = await git.diff(['HEAD']);
      return diff;
    } catch (error) {
      console.log(chalk.yellow('⚠️  Failed to get diff'));
      return '';
    }
  }

  /**
   * List all worktrees
   */
  async listWorktrees(): Promise<string[]> {
    const baseRepoPath = ConfigManager.getBaseRepositoryPath();
    
    if (!baseRepoPath) {
      return [];
    }

    const git = this.baseRepoGit || simpleGit(baseRepoPath);

    try {
      const result = await git.raw(['worktree', 'list']);
      return result.split('\n').filter(line => line.trim());
    } catch {
      return [];
    }
  }

  /**
   * Check if a branch exists
   */
  async branchExists(branchName: string): Promise<boolean> {
    try {
      const branches = await this.git.branch();
      return branches.all.includes(branchName);
    } catch {
      return false;
    }
  }

  /**
   * Check if a branch exists in base repository
   */
  async branchExistsInBase(branchName: string): Promise<boolean> {
    const baseRepoPath = ConfigManager.getBaseRepositoryPath();
    
    if (!baseRepoPath) {
      return false;
    }

    const git = this.baseRepoGit || simpleGit(baseRepoPath);

    try {
      const branches = await git.branch();
      return branches.all.includes(branchName);
    } catch {
      return false;
    }
  }

  /**
   * Delete a branch (force delete)
   */
  async deleteBranch(branchName: string): Promise<void> {
    try {
      await this.git.deleteLocalBranch(branchName, true);
      console.log(chalk.green(`✓ Branch deleted: ${branchName}`));
    } catch (error) {
      console.log(chalk.yellow(`⚠️  Could not delete branch: ${branchName}`));
    }
  }

  /**
   * Delete a branch in base repository (force delete)
   */
  async deleteBranchInBase(branchName: string): Promise<void> {
    const baseRepoPath = ConfigManager.getBaseRepositoryPath();
    
    if (!baseRepoPath) {
      return;
    }

    const git = this.baseRepoGit || simpleGit(baseRepoPath);

    try {
      await git.deleteLocalBranch(branchName, true);
      console.log(chalk.green(`✓ Branch deleted: ${branchName}`));
    } catch (error) {
      console.log(chalk.yellow(`⚠️  Could not delete branch: ${branchName}`));
    }
  }

  /**
   * Check if worktree exists for a ticket
   */
  async worktreeExists(ticketId: string): Promise<string | null> {
    const automationPath = ConfigManager.getAutomationPath();
    
    if (!automationPath) {
      return null;
    }

    const worktreePath = path.join(automationPath, ticketId);
    
    if (fs.existsSync(worktreePath)) {
      return worktreePath;
    }

    return null;
  }
}