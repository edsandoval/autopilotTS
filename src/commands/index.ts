import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import open from 'open';
import { Storage } from '../utils/storage.js';
import { Display } from '../utils/display.js';
import { GitManager } from '../utils/git.js';
import { CopilotAgent } from '../utils/copilot.js';
import { CopilotCLI } from '../utils/copilot-cli.js';
import { ConfigManager } from '../utils/config.js';
import { Ticket, TicketStatus } from '../types/index.js';
import { TicketResolverCLI } from '../agents/TicketResolverCLI.js';
import { WebServer } from '../web/server.js';
import { LogInterceptor } from '../utils/log-interceptor.js';

export class Commands {
  private git: GitManager;
  private copilot: CopilotAgent | null = null;
  private autopilotRunning: boolean = false;
  private autopilotShouldStop: boolean = false;
  private autopilotCallback?: (update: any) => void;

  constructor() {
    this.git = new GitManager();
    
    try {
      this.copilot = new CopilotAgent();
    } catch (error) {
      Display.warning('GitHub Copilot not available. Make sure you are authenticated with GitHub Copilot CLI.');
    }
  }

  async list(): Promise<void> {
    const tickets = Storage.getAllTickets();
    Display.showTicketsList(tickets);
  }

  async create(name?: string): Promise<void> {
    if (!name) {
      Display.error('Please provide a ticket name: create <name>');
      return;
    }

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'description',
        message: 'Enter ticket description:',
        validate: (input) => input.length > 0 || 'Description is required'
      }
    ]);

    const ticket = Storage.createTicket(name, answers.description);
    
    Display.success(`Ticket created: ${chalk.cyan(ticket.id)} - ${ticket.name}`);
  }

  private async interactiveChat(ticketId: string, name: string, description: string): Promise<void> {
    if (!this.copilot) {
      Display.error('GitHub Copilot not available');
      return;
    }

    console.log(chalk.cyan.bold('\n🤖 GitHub Copilot Interactive Chat (type "done" to finish)\n'));

    const conversationHistory: Array<{ role: 'user' | 'assistant', content: string }> = [];

    // Initial Copilot analysis
    Display.loading('Analyzing with GitHub Copilot');
    const initialResponse = await this.copilot.generateCode(ticketId, description);
    Display.loadingComplete();
    
    if (initialResponse.success) {
      console.log(chalk.white(initialResponse.message));
      console.log();
      
      conversationHistory.push(
        { role: 'user', content: `Ticket: ${name}\nDescription: ${description}` },
        { role: 'assistant', content: initialResponse.message }
      );
    }

    // Interactive loop
    while (true) {
      const { message } = await inquirer.prompt([
        {
          type: 'input',
          name: 'message',
          message: chalk.cyan('You:'),
          validate: (input) => input.length > 0 || 'Message cannot be empty'
        }
      ]);

      if (message.toLowerCase() === 'done' || message.toLowerCase() === 'exit') {
        Display.success('Chat session ended');
        break;
      }

      Display.loading('GitHub Copilot is thinking');
      const response = await this.copilot.chat(message, conversationHistory);
      Display.loadingComplete();
      
      conversationHistory.push(
        { role: 'user', content: message },
        { role: 'assistant', content: response }
      );

      console.log(chalk.gray('\nCopilot: ') + chalk.white(response) + '\n');
    }
  }

  private async analyzeTicketWithAI(ticket: Ticket): Promise<void> {
    try {
      // Always use CLI mode
      const cliAvailable = CopilotCLI.isAvailable();

      if (!cliAvailable) {
        Display.error('GitHub Copilot CLI is not available.');
        Display.info('Install copilot CLI: npm install -g @github/copilot-cli');
        return;
      }

      // Use CLI-based resolver
      const resolver = new TicketResolverCLI(ticket, {
        skipValidation: false,
        cleanupOnError: true
      });

      const result = await resolver.resolve();

      // Save summary to ticket if generated
      if (result.success && result.summary) {
        Storage.updateTicket(ticket.id, {
          summary: result.summary,
          status: TicketStatus.CLOSED,
          closedAt: new Date()
        });
        console.log(chalk.green('✓ Resumen guardado en el ticket'));
      }

      // Display summary
      console.log();
      console.log(TicketResolverCLI.getSummary(result));

      if (!result.success) {
        Display.error('Ticket resolution failed. Please review the errors above.');
      }

    } catch (error) {
      Display.error('Error during AI analysis: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * Legacy interactive mode (old behavior)
   */
  private async legacyInteractiveMode(ticket: Ticket): Promise<void> {
    console.log(chalk.cyan.bold('🤖 Starting AI Analysis (Legacy Mode)\n'));
    
    try {
      Display.loading('Analyzing project structure');
      const projectStructure = await this.getProjectStructure();
      Display.loadingComplete();
      Display.success('Project structure analyzed');

      console.log();
      Display.loading('Consulting GitHub Copilot for solution approach');
      
      const analysisPrompt = this.buildAnalysisPrompt(ticket, projectStructure);
      const analysis = await this.copilot!.analyzeTicket(analysisPrompt);
      
      Display.loadingComplete();
      
      if (analysis.success) {
        console.log();
        console.log(chalk.cyan.bold('📋 AI Analysis Results:\n'));
        console.log(chalk.white(analysis.message));
        console.log();
        
        const { proceed } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'proceed',
            message: 'Would you like to continue with interactive AI assistance?',
            default: true
          }
        ]);

        if (proceed) {
          await this.interactiveImplementation(ticket, analysis.message);
        }
      } else {
        Display.error('AI analysis failed: ' + (analysis.error || 'Unknown error'));
      }

    } catch (error) {
      Display.error('Error during AI analysis: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  private async getProjectStructure(): Promise<string> {
    const projectPath = process.cwd();
    
    try {
      const structure: string[] = [];
      
      // Get key files
      const keyFiles = [
        'package.json',
        'tsconfig.json',
        'README.md',
        'src/',
        'dist/',
        'test/'
      ];

      structure.push('Project Structure:');
      structure.push('─'.repeat(50));
      
      const fs = await import('fs');
      const path = await import('path');
      
      for (const file of keyFiles) {
        const filePath = path.join(projectPath, file);
        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath);
          structure.push(`  ${stats.isDirectory() ? '📁' : '📄'} ${file}`);
          
          // If it's a directory, list first level
          if (stats.isDirectory()) {
            try {
              const items = fs.readdirSync(filePath);
              items.slice(0, 10).forEach(item => {
                structure.push(`    - ${item}`);
              });
              if (items.length > 10) {
                structure.push(`    ... and ${items.length - 10} more items`);
              }
            } catch {}
          }
        }
      }

      return structure.join('\n');
    } catch (error) {
      return 'Unable to analyze project structure';
    }
  }

  private buildAnalysisPrompt(ticket: Ticket, projectStructure: string): string {
    return `You are an AI assistant helping to resolve a software ticket. Analyze the ticket and provide a detailed implementation plan.

Ticket Information:
- ID: ${ticket.id}
- Name: ${ticket.name}
- Description: ${ticket.description}

${projectStructure}

Please provide:
1. **Understanding**: What needs to be done based on the ticket description
2. **Files to examine**: Which files should we look at to understand the current implementation
3. **Implementation approach**: Step-by-step plan to resolve this ticket
4. **Potential challenges**: What issues might arise during implementation

Be specific and actionable. Focus on practical steps.`;
  }

  private async interactiveImplementation(ticket: Ticket, initialAnalysis: string): Promise<void> {
    if (!this.copilot) return;

    console.log(chalk.cyan.bold('\n💬 Interactive AI Session (type "done" to finish)\n'));

    const conversationHistory: Array<{ role: 'user' | 'assistant', content: string }> = [
      { role: 'assistant', content: initialAnalysis }
    ];

    while (true) {
      const { command } = await inquirer.prompt([
        {
          type: 'input',
          name: 'command',
          message: chalk.cyan('You:'),
          prefix: ''
        }
      ]);

      const cmd = command.trim().toLowerCase();

      if (cmd === 'done' || cmd === 'exit' || cmd === 'quit') {
        Display.success('AI session ended');
        break;
      }

      if (!command.trim()) continue;

      Display.loading('GitHub Copilot is processing');
      const response = await this.copilot.chat(command, conversationHistory);
      Display.loadingComplete();

      conversationHistory.push(
        { role: 'user', content: command },
        { role: 'assistant', content: response }
      );

      console.log();
      console.log(chalk.white(response));
      console.log();
    }
  }

  async start(ticketId?: string): Promise<void> {
    if (!ticketId) {
      Display.error('Please provide ticket ID: start <ID>');
      return;
    }

    const ticket = Storage.getTicket(ticketId);
    
    if (!ticket) {
      Display.error(`Ticket not found: ${ticketId}`);
      return;
    }

    if (ticket.status === TicketStatus.WORKING) {
      Display.warning('Ticket is already in working status');
      return;
    }

    try {
      // Check if git repo
      const isGit = await this.git.isGitRepo();
      
      if (!isGit) {
        Display.warning('Not a git repository. Skipping git operations.');
        Storage.updateTicket(ticket.id, {
          status: TicketStatus.WORKING,
          startedAt: new Date()
        });
        Display.success(`Started working on ticket: ${ticket.id}`);
        
        // AI Analysis even without git
        if (this.copilot) {
          console.log();
          await this.analyzeTicketWithAI(ticket);
        }
        return;
      }

      // Change to branching status
      Storage.updateTicket(ticket.id, { status: TicketStatus.BRANCHING });
      Display.info('Status: BRANCHING');

      // Pull from develop
      await this.git.pullDevelop();

      // Create branch
      const branchName = await this.git.createBranch(ticket.id);

      // Change to working status
      Storage.updateTicket(ticket.id, {
        status: TicketStatus.WORKING,
        startedAt: new Date(),
        branch: branchName
      });

      Display.success(`Started working on ticket: ${ticket.id}`);
      Display.info(`Branch: ${branchName}`);

      // AI Analysis
      if (this.copilot) {
        console.log();
        await this.analyzeTicketWithAI(ticket);
      }

    } catch (error) {
      Storage.updateTicket(ticket.id, {
        status: TicketStatus.ERROR,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      Display.error('Failed to start ticket: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  async stop(ticketId?: string): Promise<void> {
    if (!ticketId) {
      Display.error('Please provide ticket ID: stop <ID>');
      return;
    }

    const ticket = Storage.getTicket(ticketId);
    
    if (!ticket) {
      Display.error(`Ticket not found: ${ticketId}`);
      return;
    }

    if (ticket.status !== TicketStatus.WORKING) {
      Display.warning('Ticket is not in working status');
      return;
    }

    try {
      const isGit = await this.git.isGitRepo();

      if (isGit) {
        const hasChanges = await this.git.hasUncommittedChanges();

        if (hasChanges) {
          const { shouldCommit } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'shouldCommit',
              message: 'You have uncommitted changes. Commit them?',
              default: true
            }
          ]);

          if (shouldCommit) {
            const { commitMessage } = await inquirer.prompt([
              {
                type: 'input',
                name: 'commitMessage',
                message: 'Commit message:',
                default: `Work in progress on ${ticket.name}`
              }
            ]);

            await this.git.commitChanges(ticket.id, commitMessage);
          }
        }

        await this.git.returnToDevelop();
      }

      Storage.updateTicket(ticket.id, {
        status: TicketStatus.STOPPED,
        stoppedAt: new Date()
      });

      Display.success(`Stopped working on ticket: ${ticket.id}`);

    } catch (error) {
      Display.error('Failed to stop ticket: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  async delete(ticketId?: string, skipConfirmation: boolean = false): Promise<void> {
    if (!ticketId) {
      Display.error('Please provide ticket ID: delete <ID>');
      return;
    }

    const ticket = Storage.getTicket(ticketId);
    
    if (!ticket) {
      Display.error(`Ticket not found: ${ticketId}`);
      return;
    }

    // Only ask for confirmation in CLI mode
    if (!skipConfirmation) {
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Are you sure you want to delete ticket ${chalk.cyan(ticket.id)}?`,
          default: false
        }
      ]);

      if (!confirm) {
        Display.info('Deletion cancelled');
        return;
      }
    }

    // Clean up git resources before deleting ticket
    console.log(chalk.blue('\n🧹 Cleaning up git resources...'));

    try {
      // 1. Check and remove worktree if exists
      const worktreePath = await this.git.worktreeExists(ticketId);
      if (worktreePath) {
        console.log(chalk.blue(`📁 Removing worktree: ${worktreePath}`));
        await this.git.removeWorktree(worktreePath);
      } else {
        console.log(chalk.gray('   No worktree found'));
      }

      // 2. Check and delete copilot branch if exists
      const copilotBranch = `copilot/${ticketId}`;
      const copilotBranchExists = await this.git.branchExistsInBase(copilotBranch) || await this.git.branchExists(copilotBranch);
      
      if (copilotBranchExists) {
        console.log(chalk.blue(`🌿 Deleting branch: ${copilotBranch}`));
        await this.git.deleteBranchInBase(copilotBranch);
        await this.git.deleteBranch(copilotBranch);
      } else {
        console.log(chalk.gray('   No copilot branch found'));
      }

      // 3. Check and delete test branch if exists
      const testBranch = `test/copilot/${ticketId}`;
      const testBranchExists = await this.git.branchExistsInBase(testBranch) || await this.git.branchExists(testBranch);
      
      if (testBranchExists) {
        console.log(chalk.blue(`🧪 Deleting test branch: ${testBranch}`));
        await this.git.deleteBranchInBase(testBranch);
        await this.git.deleteBranch(testBranch);
      } else {
        console.log(chalk.gray('   No test branch found'));
      }

      console.log(chalk.green('✓ Git cleanup completed\n'));
    } catch (error) {
      console.log(chalk.yellow('⚠️  Some git cleanup operations failed'));
      console.log(chalk.gray(`   ${error instanceof Error ? error.message : 'Unknown error'}\n`));
    }

    // 4. Finally, delete the ticket
    const success = Storage.deleteTicket(ticket.id);
    
    if (success) {
      Display.success(`Ticket deleted: ${ticket.id}`);
    } else {
      Display.error('Failed to delete ticket');
    }
  }

  async status(ticketId?: string): Promise<void> {
    if (!ticketId) {
      Display.error('Please provide ticket ID: status <ID>');
      return;
    }

    const ticket = Storage.getTicket(ticketId);
    
    if (!ticket) {
      Display.error(`Ticket not found: ${ticketId}`);
      return;
    }

    Display.showTicketStatus(ticket);
  }

  help(): void {
    Display.showHelp();
  }

  clear(): void {
    Display.showBanner();
  }

  async import(filename?: string): Promise<void> {
    if (!filename) {
      Display.error('Please provide a filename: import <filename.md>');
      return;
    }

    const filePath = path.join(process.cwd(), filename);

    if (!fs.existsSync(filePath)) {
      Display.error(`File not found: ${filename}`);
      return;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const tickets = this.parseMarkdownTickets(content);

      if (tickets.length === 0) {
        Display.warning('No tickets found in file');
        return;
      }

      Display.info(`Found ${tickets.length} ticket(s) in ${filename}`);
      console.log();

      let imported = 0;
      let skipped = 0;

      for (const { id, description } of tickets) {
        const existing = Storage.getTicket(id);
        
        if (existing) {
          console.log(chalk.yellow(`  ⊘ ${id} - Already exists, skipping`));
          skipped++;
          continue;
        }

        Storage.createTicket(id, description);
        console.log(chalk.green(`  ✓ ${id} - Imported`));
        imported++;
      }

      console.log();
      Display.success(`Import complete: ${imported} created, ${skipped} skipped`);

    } catch (error) {
      Display.error('Failed to import: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  private parseMarkdownTickets(content: string): Array<{ id: string; description: string }> {
    const tickets: Array<{ id: string; description: string }> = [];
    
    // Match ticket sections: ## TICKET-ID followed by Description
    const ticketRegex = /##\s+([A-Z0-9-_]+)\s*\n\s*\*\*Description:\*\*\s*\n([\s\S]*?)(?=\n##|\n---|$)/gi;
    
    let match;
    while ((match = ticketRegex.exec(content)) !== null) {
      const id = match[1].trim();
      const description = match[2].trim();
      
      if (id && description) {
        tickets.push({ id, description });
      }
    }

    return tickets;
  }

  async config(action?: string, value?: string): Promise<void> {
    if (!action) {
      // Show current configuration
      const configPath = ConfigManager.getConfigPath();
      const debugEnabled = ConfigManager.isDebugEnabled();
      const baseRepoPath = ConfigManager.getBaseRepositoryPath();
      const automationPath = ConfigManager.getAutomationPath();
      const baseBranch = ConfigManager.getBaseBranch();
      const copilotModel = ConfigManager.getCopilotModel();
      const ticketCommandPrompt = ConfigManager.getTicketCommandPrompt();
      const ticketResolutionPrompt = ConfigManager.getTicketResolutionPrompt();
      
      console.log();
      console.log(chalk.cyan.bold('📁 Autopilot Configuration'));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(chalk.white('Config Location: ') + chalk.green(configPath));
      console.log(chalk.white('Base Repository Path: ') + (baseRepoPath ? chalk.green(baseRepoPath) : chalk.gray('Not set')));
      console.log(chalk.white('Automation Path: ') + (automationPath ? chalk.green(automationPath) : chalk.gray('Not set')));
      console.log(chalk.white('Base Branch: ') + chalk.green(baseBranch));
      console.log(chalk.white('Copilot Model: ') + chalk.green(copilotModel));
      console.log(chalk.white('Debug Mode: ') + (debugEnabled ? chalk.green('Enabled') : chalk.gray('Disabled')));
      console.log(chalk.white('Ticket Command Prompt: ') + chalk.gray(ticketCommandPrompt.substring(0, 60) + '...'));
      console.log(chalk.white('Ticket Resolution Prompt: ') + chalk.gray(ticketResolutionPrompt.substring(0, 60) + '...'));
      console.log();
      
      Display.info('Use "config base-repo <path>" to set base repository path');
      Display.info('Use "config automation <path>" to set automation path');
      Display.info('Use "config branch <name>" to set base branch (default: develop)');
      Display.info('Use "config model <name>" to set copilot model (default: gpt-4o)');
      Display.info('Use "config debug on/off" to enable/disable debug mode');
      Display.info('Use "config ticket-command-prompt <prompt>" to set ticket command prompt');
      Display.info('Use "config ticket-resolution-prompt <prompt>" to set ticket resolution prompt');
      
      return;
    }

    if (action.toLowerCase() === 'debug') {
      if (!value || (value.toLowerCase() !== 'on' && value.toLowerCase() !== 'off')) {
        Display.error('Please specify "on" or "off": config debug on/off');
        return;
      }

      const enable = value.toLowerCase() === 'on';
      ConfigManager.setDebug(enable);
      Display.success(`Debug mode ${enable ? 'enabled' : 'disabled'}`);
      
      if (enable) {
        Display.info('GitHub Copilot requests and responses will be logged to console');
      }
      
      return;
    }

    if (action.toLowerCase() === 'base-repo') {
      if (!value) {
        Display.error('Please provide a path: config base-repo <path>');
        return;
      }

      try {
        ConfigManager.setBaseRepositoryPath(value);
        Display.success(`Base repository path configured: ${value}`);
      } catch (error) {
        Display.error('Failed to set base repository path: ' + (error instanceof Error ? error.message : 'Unknown error'));
      }
      
      return;
    }

    if (action.toLowerCase() === 'automation') {
      if (!value) {
        Display.error('Please provide a path: config automation <path>');
        return;
      }

      try {
        ConfigManager.setAutomationPath(value);
        Display.success(`Automation path configured: ${value}`);
      } catch (error) {
        Display.error('Failed to set automation path: ' + (error instanceof Error ? error.message : 'Unknown error'));
      }
      
      return;
    }

    if (action.toLowerCase() === 'branch') {
      if (!value) {
        Display.error('Please provide a branch name: config branch <name>');
        return;
      }

      ConfigManager.setBaseBranch(value);
      Display.success(`Base branch configured: ${value}`);
      Display.info('This branch will be used as the base for creating ticket branches');
      
      return;
    }

    if (action.toLowerCase() === 'model') {
      if (!value) {
        Display.error('Please provide a model name: config model <name>');
        Display.info('Available models: gpt-4o, gpt-4, claude-sonnet-4, o1, o1-mini, etc.');
        return;
      }

      ConfigManager.setCopilotModel(value);
      Display.success(`Copilot model configured: ${value}`);
      Display.info('This model will be used when resolving tickets with copilot -p');
      
      return;
    }

    if (action.toLowerCase() === 'ticket-command-prompt') {
      if (!value) {
        Display.error('Please provide a prompt: config ticket-command-prompt <prompt>');
        Display.info('Example: config ticket-command-prompt "Act as a senior developer. Analyze the software ticket in the following file and provide an implementation that resolves it, File -> ${FILE}"');
        Display.info('Available placeholder: ${FILE}');
        return;
      }

      ConfigManager.setTicketCommandPrompt(value);
      Display.success('Ticket Command Prompt configured successfully');
      Display.info('This prompt will be used when running copilot CLI commands');
      
      return;
    }

    if (action.toLowerCase() === 'ticket-resolution-prompt') {
      if (!value) {
        Display.error('Please provide a prompt: config ticket-resolution-prompt <prompt>');
        Display.info('Available placeholders: ${ID}, ${DESCRIPTION}');
        return;
      }

      ConfigManager.setTicketResolutionPrompt(value);
      Display.success('Ticket Resolution Prompt configured successfully');
      Display.info('This prompt will be used when building ticket resolution requests');
      
      return;
    }

    Display.error(`Unknown config action: ${action}. Use "config", "config base-repo <path>", "config automation <path>", "config branch <name>", "config model <name>", "config debug on/off", "config ticket-command-prompt <prompt>", or "config ticket-resolution-prompt <prompt>"`);
  }

  async ui(port?: string): Promise<void> {
    const serverPort = port ? parseInt(port, 10) : 3000;
    
    if (isNaN(serverPort) || serverPort < 1 || serverPort > 65535) {
      Display.error('Invalid port number. Please provide a valid port (1-65535)');
      return;
    }

    try {
      Display.info(`Starting Web UI on port ${serverPort}...`);
      
      const server = new WebServer(serverPort);
      await server.start();
      
      // Start log interceptor to send console output to WebSocket
      LogInterceptor.start();
      Display.success('Log interceptor started - console output will be sent to WebSocket');
      
      // Open browser
      const url = `http://localhost:${serverPort}`;
      Display.success(`Web UI is running at ${chalk.cyan(url)}`);
      Display.info('Opening browser...');
      
      await open(url);
      
      Display.info('Press Ctrl+C to stop the server');
      
      // Keep process alive
      await new Promise(() => {});
      
    } catch (error) {
      if (error instanceof Error && error.message.includes('already in use')) {
        Display.error(`Port ${serverPort} is already in use. Try a different port:`);
        Display.info(`  autopilot ui ${serverPort + 1}`);
      } else {
        Display.error('Failed to start Web UI: ' + (error instanceof Error ? error.message : 'Unknown error'));
      }
    }
  }

  /**
   * Autopilot Mode - Process all pending tickets sequentially
   */
  async autopilotMode(callback?: (update: any) => void): Promise<any> {
    if (this.autopilotRunning) {
      throw new Error('Autopilot is already running');
    }

    this.autopilotRunning = true;
    this.autopilotShouldStop = false;
    this.autopilotCallback = callback;

    // Start intercepting console output and send to WebSocket
    LogInterceptor.start();

    const startTime = Date.now();
    const completed: any[] = [];
    const failed: any[] = [];

    try {
      // Get all pending tickets sorted by creation date
      const allTickets = Storage.getAllTickets();
      const pendingTickets = allTickets.filter(t => t.status === TicketStatus.PENDING)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      if (pendingTickets.length === 0) {
        this.autopilotRunning = false;
        this.sendUpdate({ type: 'no_tickets' });
        return {
          completed: [],
          failed: [],
          totalDuration: 0,
          cancelled: false
        };
      }

      this.sendUpdate({ 
        type: 'started', 
        total: pendingTickets.length,
        tickets: pendingTickets.map(t => ({ id: t.id, name: t.name }))
      });

      // ✨ NEW: Create all worktrees BEFORE starting to resolve tickets
      Display.info('\n🔧 Preparing worktrees for all pending tickets...');
      const worktreeMap = new Map<string, string>(); // ticketId -> worktreePath
      
      for (const ticket of pendingTickets) {
        try {
          // Check if worktree already exists
          const existingWorktree = await this.git.worktreeExists(ticket.id);
          
          if (existingWorktree) {
            Display.info(`   ✓ Worktree already exists for ${ticket.id}: ${existingWorktree}`);
            worktreeMap.set(ticket.id, existingWorktree);
          } else {
            Display.info(`   Creating worktree for ${ticket.id}...`);
            const worktreePath = await this.git.createWorktree(ticket.id);
            worktreeMap.set(ticket.id, worktreePath);
            Display.success(`   ✓ Worktree created: ${worktreePath}`);
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          Display.error(`   ✗ Failed to create worktree for ${ticket.id}: ${errorMsg}`);
          // Continue with other tickets even if one fails
        }
      }

      Display.success(`\n✓ All worktrees prepared (${worktreeMap.size}/${pendingTickets.length})`);
      console.log();

      // Process each ticket sequentially
      for (let i = 0; i < pendingTickets.length; i++) {
        if (this.autopilotShouldStop) {
          this.sendUpdate({ type: 'cancelled' });
          break;
        }

        const ticket = pendingTickets[i];
        const ticketStartTime = Date.now();

        // Update ticket ID context for logs
        LogInterceptor.setTicketId(ticket.id);

        this.sendUpdate({
          type: 'processing',
          current: i + 1,
          total: pendingTickets.length,
          ticket: { id: ticket.id, name: ticket.name }
        });

        try {
          // Resolve ticket using CLI mode with pre-created worktree
          const worktreePath = worktreeMap.get(ticket.id);
          const result = await this.resolveTicketAutopilot(ticket, worktreePath);
          
          const ticketDuration = Date.now() - ticketStartTime;

          if (result.success) {
            completed.push({
              ticket,
              success: true,
              duration: ticketDuration,
              summary: result.summary
            });

            this.sendUpdate({
              type: 'ticket_completed',
              ticket: { id: ticket.id, name: ticket.name },
              current: i + 1,
              total: pendingTickets.length
            });
          } else {
            failed.push({
              ticket,
              success: false,
              duration: ticketDuration,
              error: result.error
            });

            this.sendUpdate({
              type: 'ticket_failed',
              ticket: { id: ticket.id, name: ticket.name },
              error: result.error,
              current: i + 1,
              total: pendingTickets.length
            });
          }

        } catch (error) {
          const ticketDuration = Date.now() - ticketStartTime;
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';

          failed.push({
            ticket,
            success: false,
            duration: ticketDuration,
            error: errorMsg
          });

          this.sendUpdate({
            type: 'ticket_failed',
            ticket: { id: ticket.id, name: ticket.name },
            error: errorMsg,
            current: i + 1,
            total: pendingTickets.length
          });
        }
      }

      const totalDuration = Date.now() - startTime;

      const result = {
        completed,
        failed,
        totalDuration,
        cancelled: this.autopilotShouldStop
      };

      this.sendUpdate({
        type: 'completed',
        result
      });

      return result;

    } finally {
      // Stop intercepting console output
      LogInterceptor.stop();
      this.autopilotRunning = false;
      this.autopilotShouldStop = false;
      this.autopilotCallback = undefined;
    }
  }

  /**
   * Resolve a single ticket in autopilot mode
   */
  private async resolveTicketAutopilot(ticket: Ticket, existingWorktree?: string): Promise<any> {
    // Update ticket status to working
    Storage.updateTicket(ticket.id, {
      status: TicketStatus.WORKING,
      startedAt: new Date()
    });

    try {
      const resolver = new TicketResolverCLI(ticket, {
        skipValidation: false,
        cleanupOnError: true,
        existingWorktree // Pass the pre-created worktree
      });

      const result = await resolver.resolve();

      // Save summary and mark as closed if successful
      if (result.success && result.summary) {
        Storage.updateTicket(ticket.id, {
          summary: result.summary,
          status: TicketStatus.CLOSED,
          closedAt: new Date()
        });
      } else if (result.success) {
        Storage.updateTicket(ticket.id, {
          status: TicketStatus.CLOSED,
          closedAt: new Date()
        });
      } else {
        Storage.updateTicket(ticket.id, {
          status: TicketStatus.ERROR,
          error: result.error || 'Unknown error'
        });
      }

      return {
        success: result.success,
        summary: result.summary,
        error: result.error
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      
      Storage.updateTicket(ticket.id, {
        status: TicketStatus.ERROR,
        error: errorMsg
      });

      return {
        success: false,
        error: errorMsg
      };
    }
  }

  /**
   * Stop autopilot mode after current ticket completes
   */
  stopAutopilot(): void {
    if (this.autopilotRunning) {
      this.autopilotShouldStop = true;
    }
  }

  /**
   * Get autopilot status
   */
  getAutopilotStatus(): { running: boolean; shouldStop: boolean } {
    return {
      running: this.autopilotRunning,
      shouldStop: this.autopilotShouldStop
    };
  }

  /**
   * Send update to callback
   */
  private sendUpdate(update: any): void {
    if (this.autopilotCallback) {
      this.autopilotCallback(update);
    }
  }
}