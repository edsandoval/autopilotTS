import { sendLog } from '../electron-main.js';

/**
 * Log Interceptor - Captures console.log and sends to Electron renderer
 */
export class LogInterceptor {
  private static originalLog: typeof console.log;
  private static originalError: typeof console.error;
  private static isIntercepting = false;
  private static currentTicketId?: string;

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

      // Send to Electron renderer
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
      sendLog(message, 'log', this.currentTicketId);
    };

    console.error = (...args: any[]) => {
      // Call original console.error
      this.originalError(...args);

      // Send to Electron renderer
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
      sendLog(message, 'error', this.currentTicketId);
    };
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
