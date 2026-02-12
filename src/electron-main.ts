import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { Storage } from './utils/storage.js';
import { ConfigManager } from './utils/config.js';
import { GitManager } from './utils/git.js';
import { TicketResolverCLI } from './agents/TicketResolverCLI.js';
import { Ticket, TicketStatus } from './types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let git: GitManager;
let ticketResolverCLI: TicketResolverCLI | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'electron-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, 'web', 'public', 'logo.svg'),
    title: 'AutopilotTS - AI-Powered Ticket Resolution System',
  });

  // Load the index.html
  const indexPath = path.join(__dirname, 'web', 'public', 'index.html');
  mainWindow.loadFile(indexPath);

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  git = new GitManager();
  setupIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

function setupIpcHandlers() {
  // Ticket management
  ipcMain.handle('get-all-tickets', async () => {
    try {
      return { success: true, tickets: Storage.getAllTickets() };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('get-ticket', async (_event, id: string) => {
    try {
      const ticket = Storage.getTicket(id);
      return { success: true, ticket };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('create-ticket', async (_event, name: string, description: string) => {
    try {
      const ticket = Storage.createTicket(name, description);
      return { success: true, ticket };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('update-ticket', async (_event, id: string, description: string) => {
    try {
      const ticket = Storage.getTicket(id);
      if (!ticket) {
        throw new Error('Ticket not found');
      }
      ticket.description = description;
      const config = Storage.getConfig();
      Storage.saveConfig(config);
      return { success: true, ticket };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('delete-ticket', async (_event, id: string) => {
    try {
      Storage.deleteTicket(id);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('start-ticket', async (_event, id: string) => {
    try {
      const ticket = Storage.getTicket(id);
      if (!ticket) {
        throw new Error('Ticket not found');
      }

      // Create resolver instance with the ticket
      ticketResolverCLI = new TicketResolverCLI(ticket);

      // Send initial log to renderer
      if (mainWindow) {
        mainWindow.webContents.send('ticket-log', { 
          ticketId: id, 
          log: `Starting ticket ${id}...`,
          type: 'log'
        });
      }

      // Start ticket resolution
      const result = await ticketResolverCLI.resolve();
      
      // Send completion log
      if (mainWindow) {
        mainWindow.webContents.send('ticket-log', { 
          ticketId: id, 
          log: result.success ? `✓ Ticket ${id} completed!` : `✗ Ticket ${id} failed: ${result.error}`,
          type: result.success ? 'log' : 'error'
        });
      }
      
      return { success: result.success, error: result.error };
    } catch (error) {
      if (mainWindow) {
        mainWindow.webContents.send('ticket-log', { 
          ticketId: id, 
          log: `Error: ${(error as Error).message}`,
          type: 'error'
        });
      }
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('stop-ticket', async (_event, id: string) => {
    try {
      const ticket = Storage.getTicket(id);
      if (!ticket) {
        throw new Error('Ticket not found');
      }

      ticket.status = TicketStatus.STOPPED;
      ticket.stoppedAt = new Date();
      const config = Storage.getConfig();
      Storage.saveConfig(config);

      return { success: true, ticket };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Configuration management
  ipcMain.handle('get-config', async () => {
    try {
      const config = ConfigManager.getConfig();
      return { success: true, config };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('update-config', async (_event, configUpdate: any) => {
    try {
      const currentConfig = ConfigManager.getConfig();
      const newConfig = { ...currentConfig, ...configUpdate };
      ConfigManager.saveConfig(newConfig);
      return { success: true, config: newConfig };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Copilot models
  ipcMain.handle('get-copilot-models', async () => {
    try {
      // Import the models manager
      const { CopilotModelsManager } = await import('./utils/copilot-models.js');
      const models = await CopilotModelsManager.getAvailableModels();
      return { success: true, models };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Health check
  ipcMain.handle('health-check', async () => {
    return { 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      electron: process.versions.electron,
      node: process.versions.node
    };
  });
}

// Send log messages to renderer
export function sendLog(message: string, type: 'log' | 'error' = 'log', ticketId?: string) {
  if (mainWindow) {
    mainWindow.webContents.send('ticket-log', { message, type, ticketId });
  }
}
