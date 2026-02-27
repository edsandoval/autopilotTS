import fs from 'fs';
import path from 'path';
import { Ticket, TicketConfig, TicketStatus, TicketType } from '../types/index.js';

// helper functions migrated to ProjectManager in project.ts
import { ProjectManager } from './project.js';

function getTicketsFile(): string {
  const project = ProjectManager.getActiveProject();
  if (!project) {
    throw new Error('No active project selected - please choose or create a project in the UI');
  }
  const projectDir = ProjectManager.getProjectDir(project);
  return path.join(projectDir, 'tickets.json');
}

export class Storage {
  // Cache for file metadata to reduce log spam
  private static fileCache: {
    size: number;
    mtime: number;
  } | null = null;

  /**
   * Clear any in‑memory caches (used when switching projects).
   */
  static resetCache() {
    this.fileCache = null;
  }

  /**
   * If tickets.json doesn't exist but config.json has ticket data (legacy layout),
   * migrate the ticket data out of config.json into tickets.json and strip it
   * from config.json so each file has a single responsibility.
   */
  private static migrateFromConfig(): void {
    const ticketsFile = getTicketsFile();
    if (fs.existsSync(ticketsFile)) return; // already migrated

    const project = ProjectManager.getActiveProject();
    if (!project) return;
    const projectDir = ProjectManager.getProjectDir(project);
    const configFile = path.join(projectDir, 'config.json');
    if (!fs.existsSync(configFile)) return;

    try {
      const raw = fs.readFileSync(configFile, 'utf-8');
      const data = JSON.parse(raw);
      if (Array.isArray(data.tickets)) {
        // Write ticket data to tickets.json
        const ticketData: TicketConfig = {
          tickets: data.tickets,
          lastId: data.lastId ?? 0
        };
        fs.writeFileSync(ticketsFile, JSON.stringify(ticketData, null, 2));
        console.log(`[Storage] Migrated ${data.tickets.length} ticket(s) from config.json → tickets.json`);

        // Remove ticket keys from config.json
        delete data.tickets;
        delete data.lastId;
        fs.writeFileSync(configFile, JSON.stringify(data, null, 2));
        console.log('[Storage] Removed ticket data from config.json');
      }
    } catch (e) {
      console.warn('[Storage] Migration from config.json failed:', e);
    }
  }

  private static ensureTicketsFileExists(): void {
    this.migrateFromConfig();
    const ticketsFile = getTicketsFile();
    if (!fs.existsSync(ticketsFile)) {
      const initialConfig: TicketConfig = {
        tickets: [],
        lastId: 0
      };
      fs.writeFileSync(ticketsFile, JSON.stringify(initialConfig, null, 2));
    }
  }

  static getConfig(): TicketConfig {
    try {
      this.ensureTicketsFileExists();
      const ticketsFile = getTicketsFile();

      if (!fs.existsSync(ticketsFile)) {
        throw new Error(`Tickets file does not exist: ${ticketsFile}`);
      }

      // Check file stats to detect changes
      const stats = fs.statSync(ticketsFile);
      const currentSize = stats.size;
      const currentMtime = stats.mtimeMs;

      // Only log if file has changed or first time reading
      const hasChanged = !this.fileCache ||
                        this.fileCache.size !== currentSize ||
                        this.fileCache.mtime !== currentMtime;

      if (hasChanged) {
        console.log('[Storage] Reading tickets from:', ticketsFile);
        console.log('[Storage] Read', currentSize, 'bytes from tickets file');

        // Update cache
        this.fileCache = { size: currentSize, mtime: currentMtime };
      }

      const data = fs.readFileSync(ticketsFile, 'utf-8');
      const config = JSON.parse(data);

      if (hasChanged) {
        console.log('[Storage] Parsed config with', config.tickets?.length || 0, 'tickets');
      }

      // Convert date strings back to Date objects
      config.tickets = config.tickets.map((t: any) => ({
        ...t,
        createdAt: new Date(t.createdAt),
        startedAt: t.startedAt ? new Date(t.startedAt) : undefined,
        stoppedAt: t.stoppedAt ? new Date(t.stoppedAt) : undefined,
        closedAt: t.closedAt ? new Date(t.closedAt) : undefined
      }));

      return config;
    } catch (error) {
      console.error('[Storage] Error reading tickets:', error);
      throw error;
    }
  }

  static saveConfig(config: TicketConfig): void {
    fs.writeFileSync(getTicketsFile(), JSON.stringify(config, null, 2));
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

  static createTicket(ticketId: string, description: string, type?: TicketType): Ticket {
    const config = this.getConfig();
    
    const ticket: Ticket = {
      id: ticketId,
      name: ticketId,
      description,
      status: TicketStatus.PENDING,
      ...(type && { type }),
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

  /**
   * Return the path where ticket/state files are being stored for the
   * currently active project.  Useful for tests and debugging.
   */
  static getStoragePath(): string {
    const project = ProjectManager.getActiveProject();
    return project ? ProjectManager.getProjectDir(project) : ProjectManager.getAutopilotDir();
  }
}