import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { marked } from 'marked';
import { Storage } from './utils/storage.js';
import { ConfigManager } from './utils/config.js';
import { GitManager } from './utils/git.js';
import { TicketResolverCLI } from './agents/TicketResolverCLI.js';
import { Ticket, TicketStatus, TicketType } from './types/index.js';
import { LogInterceptor } from './utils/log-interceptor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let git: GitManager;
let ticketResolverCLI: TicketResolverCLI | null = null;
let autopilotRunning = false;
let autopilotShouldStop = false;

/**
 * Send progress update to frontend
 * @param phase - 'phase1' (worktrees), 'phase2' (processing), or 'complete'
 * @param current - Current progress count
 * @param total - Total items
 * @param currentTicketId - Optional ticket ID being processed
 */
function sendProgressUpdate(phase: string, current: number, total: number, currentTicketId?: string) {
  if (!mainWindow) return;
  
  // Calculate overall percentage based on phases
  // Phase 1 (worktrees): 20% of total progress
  // Phase 2 (processing): 80% of total progress
  let percentage = 0;
  
  if (phase === 'phase1') {
    // 0-20% for worktree creation
    percentage = (current / total) * 20;
  } else if (phase === 'phase2') {
    // 20-100% for ticket processing
    percentage = 20 + ((current / total) * 80);
  } else if (phase === 'complete') {
    percentage = 100;
  }
  
  mainWindow.webContents.send('autopilot:progress', {
    phase,
    current,
    total,
    percentage: Math.round(percentage),
    currentTicketId
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'electron-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, '..', 'docs', 'icon-256.png'),
    title: 'AutopilotTS - AI-Powered Ticket Resolution System',
  });

  // Initialize log interceptor with main window
  LogInterceptor.initialize(mainWindow);

  // Load the index.html
  const indexPath = path.join(__dirname, 'web', 'public', 'index.html');
  mainWindow.loadFile(indexPath);

  // Remove default application menu so the native menu bar (File/Edit/View...) is hidden
  try {
    Menu.setApplicationMenu(null);
    // Also ensure the BrowserWindow menu bar is hidden (Windows/Linux)
    mainWindow.setMenuBarVisibility(false);
  } catch (err) {
    console.warn('Failed to remove application menu:', err);
  }

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    // Stop log interceptor when window closes
    LogInterceptor.stop();
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

async function processAutopilotTickets() {
  try {
    // Start intercepting logs for autopilot
    LogInterceptor.start();

    // PHASE 1: Create worktrees for all pending tickets
    console.log('[Autopilot] Phase 1: Creating worktrees for all pending tickets...');
    const tickets = Storage.getAllTickets();
    const pendingTickets = tickets.filter(t => t.status === TicketStatus.PENDING);

    if (pendingTickets.length === 0) {
      console.log('[Autopilot] No pending tickets found');
      return;
    }

    console.log(`[Autopilot] Found ${pendingTickets.length} pending ticket(s)`);

    // Send progress: Phase 1 starting
    sendProgressUpdate('phase1', 0, pendingTickets.length);

    // Create worktrees for all tickets
    const worktreeMap = new Map<string, string>(); // ticketId -> worktreePath
    
    for (let i = 0; i < pendingTickets.length; i++) {
      const ticket = pendingTickets[i];
      if (autopilotShouldStop) {
        console.log('[Autopilot] Stopped during worktree creation');
        return;
      }

      try {
        console.log(`[Autopilot] Creating worktree for ${ticket.id}...`);
        const worktreePath = await git.createWorktree(ticket.id);
        worktreeMap.set(ticket.id, worktreePath);
        
        // Update ticket status to WORKING
        Storage.updateTicket(ticket.id, {
          status: TicketStatus.WORKING,
          startedAt: new Date()
        });
        
        console.log(`[Autopilot] ✓ Worktree ready for ${ticket.id}`);
        
        // Send progress update
        sendProgressUpdate('phase1', i + 1, pendingTickets.length);
      } catch (error) {
        console.error(`[Autopilot] Failed to create worktree for ${ticket.id}:`, error);
        // Mark ticket as error
        Storage.updateTicket(ticket.id, {
          status: 'error' as TicketStatus,
          error: `Failed to create worktree: ${(error as Error).message}`
        });
      }
    }

    console.log(`[Autopilot] Phase 1 complete: ${worktreeMap.size} worktree(s) created`);

    // PHASE 2: Process tickets sequentially
    console.log('[Autopilot] Phase 2: Processing tickets...');
    const totalTicketsToProcess = worktreeMap.size;
    let ticketsProcessed = 0;
    
    while (!autopilotShouldStop) {
      // Get working tickets
      const currentTickets = Storage.getAllTickets();
      const workingTickets = currentTickets.filter(t => t.status === TicketStatus.WORKING);

      if (workingTickets.length === 0) {
        console.log('[Autopilot] No more working tickets');
        break;
      }

      // Process next ticket
      const ticket = workingTickets[0];
      const worktreePath = worktreeMap.get(ticket.id);
      
      if (!worktreePath) {
        console.error(`[Autopilot] No worktree found for ${ticket.id}, skipping`);
        Storage.updateTicket(ticket.id, {
          status: 'error' as TicketStatus,
          error: 'No worktree found'
        });
        ticketsProcessed++;
        sendProgressUpdate('phase2', ticketsProcessed, totalTicketsToProcess);
        continue;
      }

      // Update ticket ID for log context
      LogInterceptor.setTicketId(ticket.id);
      console.log(`[Autopilot] Processing ticket: ${ticket.id}`);
      
      // Send progress for current ticket being processed
      sendProgressUpdate('phase2', ticketsProcessed, totalTicketsToProcess, ticket.id);

      // Create resolver with existing worktree
      ticketResolverCLI = new TicketResolverCLI(ticket, {
        existingWorktree: worktreePath
      });
      
      const result = await ticketResolverCLI.resolve();

      // Update ticket status based on result
      if (result.success) {
        const updates: Partial<Ticket> = {
          status: TicketStatus.CLOSED,
          closedAt: new Date()
        };
        if (result.summary) {
          updates.summary = result.summary;
        }
        Storage.updateTicket(ticket.id, updates);
        console.log(`[Autopilot] ✓ Ticket ${ticket.id} completed!`);
      } else {
        Storage.updateTicket(ticket.id, {
          status: 'error' as TicketStatus,
          error: result.error
        });
        console.log(`[Autopilot] ✗ Ticket ${ticket.id} failed: ${result.error}`);
      }
      
      ticketsProcessed++;
      sendProgressUpdate('phase2', ticketsProcessed, totalTicketsToProcess);

      // Small delay before next ticket
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('[Autopilot] All tickets processed');
    sendProgressUpdate('complete', totalTicketsToProcess, totalTicketsToProcess);
  } catch (error) {
    console.error('[Autopilot] Error:', error);
  } finally {
    // Stop intercepting logs
    LogInterceptor.stop();
    autopilotRunning = false;
    console.log('[Autopilot] Stopped');
  }
}

function setupIpcHandlers() {
  // Ticket management
  ipcMain.handle('get-all-tickets', async () => {
    try {
      const tickets = Storage.getAllTickets();
      return { success: true, tickets };
    } catch (error) {
      console.error('[IPC] Error getting tickets:', error);
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

  ipcMain.handle('create-ticket', async (_event, name: string, description: string, type?: TicketType) => {
    try {
      const ticket = Storage.createTicket(name, description, type);
      return { success: true, ticket };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('update-ticket', async (_event, id: string, name: string, description: string, type?: string) => {
    try {
      const ticket = Storage.getTicket(id);
      if (!ticket) {
        throw new Error('Ticket not found');
      }
      const updates: Partial<Ticket> = { name, description };
      if (type !== undefined) updates.type = type as Ticket['type'];
      Storage.updateTicket(id, updates);
      const updatedTicket = Storage.getTicket(id);
      return { success: true, ticket: updatedTicket };
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

      // Send initial log
      if (mainWindow) {
        mainWindow.webContents.send('ticket-log', { 
          message: `Inicializando resolución del ticket ${id}...`,
          type: 'log',
          ticketId: id
        });
      }

      // Update ticket status to working immediately
      Storage.updateTicket(id, {
        status: TicketStatus.WORKING,
        startedAt: new Date()
      });

      // Notify UI of status change
      if (mainWindow) {
        mainWindow.webContents.send('ticket-status-changed', { 
          ticketId: id,
          status: TicketStatus.WORKING
        });
      }

      // Start intercepting logs for this ticket
      LogInterceptor.start(id);

      // Send worktree creation log
      if (mainWindow) {
        mainWindow.webContents.send('ticket-log', { 
          message: `Creando worktree para ${id}...`,
          type: 'log',
          ticketId: id
        });
      }

      // Create resolver instance with the ticket
      ticketResolverCLI = new TicketResolverCLI(ticket);

      // Start ticket resolution
      const result = await ticketResolverCLI.resolve();
      
      // Stop intercepting logs
      LogInterceptor.stop();

      // Update ticket status based on result
      if (result.success) {
        const updates: Partial<Ticket> = {
          status: TicketStatus.CLOSED,
          closedAt: new Date()
        };
        if (result.summary) {
          updates.summary = result.summary;
        }
        Storage.updateTicket(id, updates);
        
        if (mainWindow) {
          mainWindow.webContents.send('ticket-log', { 
            message: `✓ Ticket ${id} completado exitosamente`,
            type: 'log',
            ticketId: id
          });
        }
      } else {
        Storage.updateTicket(id, {
          status: 'error' as TicketStatus,
          error: result.error
        });
        
        if (mainWindow) {
          mainWindow.webContents.send('ticket-log', { 
            message: `✗ Error en ticket ${id}: ${result.error}`,
            type: 'error',
            ticketId: id
          });
        }
      }
      
      return { success: result.success, error: result.error };
    } catch (error) {
      // Stop intercepting logs on error
      LogInterceptor.stop();
      
      if (mainWindow) {
        mainWindow.webContents.send('ticket-log', { 
          message: `Error: ${(error as Error).message}`,
          type: 'error',
          ticketId: id
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

      Storage.updateTicket(id, {
        status: TicketStatus.STOPPED,
        stoppedAt: new Date()
      });
      
      const updatedTicket = Storage.getTicket(id);
      return { success: true, ticket: updatedTicket };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('get-ticket-summary', async (_event, id: string) => {
    try {
      const ticket = Storage.getTicket(id);
      if (!ticket) {
        throw new Error('Ticket not found');
      }

      // Only completed tickets have summaries
      if (ticket.status !== TicketStatus.CLOSED && ticket.status !== 'error') {
        return { 
          success: false, 
          error: 'Summary is only available for completed tickets' 
        };
      }

      // If ticket has a generated summary, use it
      if (ticket.summary) {
        return { success: true, summary: ticket.summary };
      }

      // Fallback: generate basic summary from description if no summary exists
      const descriptionHtml = await marked.parse(ticket.description || '', { 
        async: true,
        gfm: true, // GitHub Flavored Markdown
        breaks: true // Convert line breaks to <br>
      });

      const summary = `
        <h2>📋 Ticket: ${ticket.id}</h2>
        <p><strong>Status:</strong> ${ticket.status}</p>
        <h3>📝 Description</h3>
        <div class="markdown-content">${descriptionHtml}</div>
        ${ticket.startedAt ? `<h3>⏱️ Timeline</h3><p><strong>Started:</strong> ${ticket.startedAt.toLocaleString()}</p>` : ''}
        ${ticket.closedAt ? `<p><strong>Completed:</strong> ${ticket.closedAt.toLocaleString()}</p>` : ''}
        ${ticket.error ? `<h3>❌ Error</h3><p style="color: #f44336;">${ticket.error}</p>` : ''}
      `;

      return { success: true, summary };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Autopilot mode
  ipcMain.handle('start-autopilot', async () => {
    try {
      if (autopilotRunning) {
        return { success: false, error: 'Autopilot is already running' };
      }

      autopilotRunning = true;
      autopilotShouldStop = false;

      console.log('[IPC] Starting autopilot mode');

      // Process tickets in background
      processAutopilotTickets();

      return { success: true };
    } catch (error) {
      autopilotRunning = false;
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('stop-autopilot', async () => {
    try {
      console.log('[IPC] Autopilot stop requested');
      autopilotShouldStop = true;
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Configuration management
  ipcMain.handle('get-config', async () => {
    try {
      console.log('[IPC] get-config called');
      const config = ConfigManager.getConfig();
      console.log('[IPC] Config retrieved successfully');
      return { success: true, config };
    } catch (error) {
      console.error('[IPC] Error getting config:', error);
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


