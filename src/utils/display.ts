import chalk from 'chalk';
import figlet from 'figlet';
import Table from 'cli-table3';
import { Ticket, TicketStatus } from '../types/index.js';

export class Display {
  static showBanner(): void {
    console.clear();
    
    const banner = figlet.textSync('autopilotTS', {
      font: 'ANSI Shadow',
      horizontalLayout: 'default',
      verticalLayout: 'default'
    });

    console.log(chalk.cyan(banner));
    console.log(chalk.gray('━'.repeat(70)));
    console.log(chalk.white.bold('  AI-Powered Ticket Resolution System'));
    console.log(chalk.gray('  Version 1.0.0'));
    console.log(chalk.gray('━'.repeat(70)));
    console.log();
  }

  static showHelp(): void {
    console.log(chalk.yellow.bold('\n📋 Available Commands:\n'));
    console.log(chalk.gray('─'.repeat(70)));
    
    const commands = [
      { cmd: 'list', desc: 'List all tickets in the system' },
      { cmd: 'create <name>', desc: 'Create a ticket and open interactive chat' },
      { cmd: 'start <name|ID>', desc: 'Start working on a ticket' },
      { cmd: 'stop <name|ID>', desc: 'Stop working on a ticket' },
      { cmd: 'delete <name|ID>', desc: 'Completely delete a ticket' },
      { cmd: 'status <name|ID>', desc: 'Show detailed ticket status' },
      { cmd: 'config [action] [value]', desc: 'Show or manage configuration (set, clear, debug)' },
      { cmd: 'ui [port]', desc: 'Start Web UI (default port: 3000)' },
      { cmd: 'help', desc: 'Show this menu' },
      { cmd: 'clear', desc: 'Clear the screen' },
      { cmd: 'exit', desc: 'Exit autopilotTS' }
    ];

    commands.forEach(({ cmd, desc }) => {
      console.log(`  ${chalk.cyan(cmd.padEnd(25))} → ${chalk.white(desc)}`);
    });

    console.log(chalk.gray('─'.repeat(70)));
    console.log(chalk.gray('\n💡 Note: <name> and <description> can be in any language\n'));
  }

  static showTicketsList(tickets: Ticket[]): void {
    if (tickets.length === 0) {
      console.log(chalk.yellow('\n📭 No tickets found. Create one with: ') + chalk.cyan('create <name>'));
      return;
    }

    const table = new Table({
      head: [
        chalk.cyan.bold('ID'),
        chalk.cyan.bold('DESCRIPTION'),
        chalk.cyan.bold('STATUS')
      ],
      colWidths: [15, 60, 15],
      wordWrap: true,
      style: {
        head: [],
        border: ['gray']
      }
    });

    tickets.forEach(ticket => {
      table.push([
        chalk.white(ticket.id),
        chalk.gray(this.truncate(ticket.description, 57)),
        this.colorizeStatus(ticket.status)
      ]);
    });

    console.log('\n' + table.toString() + '\n');
  }

  static showTicketStatus(ticket: Ticket): void {
    console.log(chalk.cyan.bold('\n╔════════════════════════════════════════════════════════════╗'));
    console.log(chalk.cyan.bold('║') + chalk.white.bold('  TICKET DETAILS'.padEnd(58)) + chalk.cyan.bold('║'));
    console.log(chalk.cyan.bold('╚════════════════════════════════════════════════════════════╝\n'));

    const info = [
      ['ID', ticket.id],
      ['Status', ticket.status.toUpperCase()],
      ['Description', ticket.description],
      ['Branch', ticket.branch || 'N/A'],
      ['Created', this.formatDate(ticket.createdAt)],
    ];

    if (ticket.startedAt) {
      info.push(['Started', this.formatDate(ticket.startedAt)]);
    }
    if (ticket.stoppedAt) {
      info.push(['Stopped', this.formatDate(ticket.stoppedAt)]);
    }
    if (ticket.closedAt) {
      info.push(['Closed', this.formatDate(ticket.closedAt)]);
    }
    if (ticket.error) {
      info.push(['Error', ticket.error]);
    }

    info.forEach(([label, value]) => {
      console.log(`  ${chalk.gray(label + ':')} ${chalk.white(value)}`);
    });

    console.log();
  }

  private static colorizeStatus(status: TicketStatus): string {
    switch (status) {
      case TicketStatus.PENDING:
        return chalk.gray('⏸ pending');
      case TicketStatus.BRANCHING:
        return chalk.blue('🌿 branching');
      case TicketStatus.WORKING:
        return chalk.green('⚡ working');
      case TicketStatus.STOPPED:
        return chalk.yellow('⏹ stopped');
      case TicketStatus.CLOSED:
        return chalk.magenta('✓ closed');
      case TicketStatus.ERROR:
        return chalk.red('✗ error');
      default:
        return status;
    }
  }

  private static truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  private static formatDate(date: Date): string {
    return date.toLocaleString('es-AR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  static success(message: string): void {
    console.log(chalk.green('✓ ') + message);
  }

  static error(message: string): void {
    console.log(chalk.red('✗ ') + message);
  }

  static info(message: string): void {
    console.log(chalk.blue('ℹ ') + message);
  }

  static warning(message: string): void {
    console.log(chalk.yellow('⚠ ') + message);
  }

  static loading(message: string): void {
    process.stdout.write(chalk.cyan('⏳ ') + message + chalk.cyan(' ...'));
  }

  static clearLine(): void {
    process.stdout.write('\r\x1b[K');
  }

  static loadingComplete(): void {
    process.stdout.write('\r\x1b[K');
  }
}