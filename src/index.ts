#!/usr/bin/env node

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { Display } from './utils/display.js';
import { Commands } from './commands/index.js';

const program = new Command();
const commands = new Commands();

program
  .name('autopilot')
  .description('AI-Powered Ticket Resolution System')
  .version('1.0.0');

// Interactive mode
async function interactiveMode() {
  Display.showBanner();
  Display.showHelp();

  while (true) {
    const { command } = await inquirer.prompt([
      {
        type: 'input',
        name: 'command',
        message: chalk.cyan('autopilot>'),
        prefix: ''
      }
    ]);

    const parts = command.trim().split(/\s+/);
    const cmd = parts[0]?.toLowerCase();
    const args = parts.slice(1);

    if (!cmd) continue;

    try {
      switch (cmd) {
        case 'list':
          await commands.list();
          break;

        case 'create':
          await commands.create(args.join(' '));
          break;

        case 'import':
          await commands.import(args[0]);
          break;

        case 'start':
          await commands.start(args[0]);
          break;

        case 'stop':
          await commands.stop(args[0]);
          break;

        case 'delete':
          await commands.delete(args[0]);
          break;

        case 'status':
          await commands.status(args[0]);
          break;

        case 'config':
          await commands.config(args[0], args[1]);
          break;

        case 'ui':
          await commands.ui(args[0]);
          break;

        case 'help':
          commands.help();
          break;

        case 'clear':
          commands.clear();
          break;

        case 'exit':
        case 'quit':
          console.log(chalk.cyan('\n👋 Goodbye!\n'));
          process.exit(0);

        default:
          Display.error(`Unknown command: ${cmd}. Type "help" for available commands.`);
      }
    } catch (error) {
      Display.error('Error: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }

    console.log(); // Empty line for readability
  }
}

// CLI commands
program
  .command('list')
  .description('List all tickets')
  .action(async () => {
    await commands.list();
  });

program
  .command('create <name>')
  .description('Create a new ticket')
  .action(async (name) => {
    await commands.create(name);
  });

program
  .command('start <idOrName>')
  .description('Start working on a ticket')
  .action(async (idOrName) => {
    await commands.start(idOrName);
  });

program
  .command('stop <idOrName>')
  .description('Stop working on a ticket')
  .action(async (idOrName) => {
    await commands.stop(idOrName);
  });

program
  .command('delete <idOrName>')
  .description('Delete a ticket')
  .action(async (idOrName) => {
    await commands.delete(idOrName);
  });

program
  .command('status <idOrName>')
  .description('Show ticket status')
  .action(async (idOrName) => {
    await commands.status(idOrName);
  });

program
  .command('config [action] [value]')
  .description('Manage project configuration (show, set <path>, clear, debug on/off)')
  .action(async (action, value) => {
    await commands.config(action, value);
  });

program
  .command('ui [port]')
  .description('Start Web UI server (default port: 3000)')
  .action(async (port) => {
    await commands.ui(port);
  });

program
  .command('interactive')
  .alias('i')
  .description('Start interactive mode')
  .action(interactiveMode);

// If no arguments, start interactive mode
if (process.argv.length === 2) {
  interactiveMode();
} else {
  program.parse(process.argv);
}