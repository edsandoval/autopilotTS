import { BrowserWindow } from 'electron';

/**
 * Log Interceptor - Captures console.log and sends to Electron renderer
 */
export class LogInterceptor {
  private static originalLog: typeof console.log;
  private static originalError: typeof console.error;
  private static isIntercepting = false;
  private static currentTicketId?: string;
  private static mainWindow: BrowserWindow | null = null;

  /**
   * Initialize with main window reference
   */
  static initialize(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  /**
   * Start intercepting console.log/error and send to Electron renderer
   */
  static start(ticketId?: string): void {
    if (this.isIntercepting) return;

    this.currentTicketId = ticketId;
    this.originalLog = console.log;
    this.originalError = console.error;
    this.isIntercepting = true;

    console.log = (...args: any[]) => {
      // Call original console.log
      this.originalLog(...args);

      // Send to Electron renderer (strip chalk colors)
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
      
      // Remove ANSI color codes
      const cleanMessage = message.replace(/\x1b\[[0-9;]*m/g, '');
      
      this.sendLog(cleanMessage, 'log');
    };

    console.error = (...args: any[]) => {
      // Call original console.error
      this.originalError(...args);

      // Send to Electron renderer (strip chalk colors)
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
      
      // Remove ANSI color codes
      const cleanMessage = message.replace(/\x1b\[[0-9;]*m/g, '');
      
      this.sendLog(cleanMessage, 'error');
    };
  }

  /**
   * Send log to renderer
   */
  private static sendLog(message: string, type: 'log' | 'error'): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('ticket-log', { 
        message, 
        type, 
        ticketId: this.currentTicketId 
      });
    }
  }

  /**
   * Stop intercepting and restore original console functions
   */
  static stop(): void {
    if (!this.isIntercepting) return;

    console.log = this.originalLog;
    console.error = this.originalError;
    this.isIntercepting = false;
    this.currentTicketId = undefined;
  }

  /**
   * Update the current ticket ID for log context
   */
  static setTicketId(ticketId?: string): void {
    this.currentTicketId = ticketId;
  }

  /**
   * Check if currently intercepting
   */
  static isActive(): boolean {
    return this.isIntercepting;
  }
}
