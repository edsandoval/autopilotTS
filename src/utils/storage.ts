import fs from 'fs';
import path from 'path';
import os from 'os';
import { Ticket, TicketConfig, TicketStatus } from '../types/index.js';

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
  return path.join(getAutopilotDir(), 'tickets.json');
}

export class Storage {
  private static ensureConfigExists(): void {
    const configFile = getConfigFile();
    
    if (!fs.existsSync(configFile)) {
      const initialConfig: TicketConfig = {
        tickets: [],
        lastId: 0
      };
      fs.writeFileSync(configFile, JSON.stringify(initialConfig, null, 2));
    }
  }

  static getConfig(): TicketConfig {
    this.ensureConfigExists();
    const data = fs.readFileSync(getConfigFile(), 'utf-8');
    const config = JSON.parse(data);
    
    // Convert date strings back to Date objects
    config.tickets = config.tickets.map((t: any) => ({
      ...t,
      createdAt: new Date(t.createdAt),
      startedAt: t.startedAt ? new Date(t.startedAt) : undefined,
      stoppedAt: t.stoppedAt ? new Date(t.stoppedAt) : undefined,
      closedAt: t.closedAt ? new Date(t.closedAt) : undefined
    }));
    
    return config;
  }

  static saveConfig(config: TicketConfig): void {
    fs.writeFileSync(getConfigFile(), JSON.stringify(config, null, 2));
  }

  static getAllTickets(): Ticket[] {
    return this.getConfig().tickets;
  }

  static getTicket(idOrName: string): Ticket | undefined {
    const tickets = this.getAllTickets();
    return tickets.find(
      t => t.id.toLowerCase() === idOrName.toLowerCase() || 
           t.name.toLowerCase() === idOrName.toLowerCase()
    );
  }

  static createTicket(ticketId: string, description: string): Ticket {
    const config = this.getConfig();
    
    const ticket: Ticket = {
      id: ticketId,
      name: ticketId,
      description,
      status: TicketStatus.PENDING,
      createdAt: new Date()
    };

    config.tickets.push(ticket);
    this.saveConfig(config);

    return ticket;
  }

  static updateTicket(id: string, updates: Partial<Ticket>): void {
    const config = this.getConfig();
    const index = config.tickets.findIndex(t => t.id === id);
    
    if (index !== -1) {
      config.tickets[index] = { ...config.tickets[index], ...updates };
      this.saveConfig(config);
    }
  }

  static deleteTicket(id: string): boolean {
    const config = this.getConfig();
    const index = config.tickets.findIndex(t => t.id === id);
    
    if (index !== -1) {
      config.tickets.splice(index, 1);
      this.saveConfig(config);
      return true;
    }
    
    return false;
  }

  static getStoragePath(): string {
    return getAutopilotDir();
  }
}