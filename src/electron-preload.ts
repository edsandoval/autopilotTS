import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Ticket management
  getAllTickets: () => ipcRenderer.invoke('get-all-tickets'),
  getTicket: (id: string) => ipcRenderer.invoke('get-ticket', id),
  createTicket: (name: string, description: string) => 
    ipcRenderer.invoke('create-ticket', name, description),
  updateTicket: (id: string, description: string) => 
    ipcRenderer.invoke('update-ticket', id, description),
  deleteTicket: (id: string) => ipcRenderer.invoke('delete-ticket', id),
  startTicket: (id: string) => ipcRenderer.invoke('start-ticket', id),
  stopTicket: (id: string) => ipcRenderer.invoke('stop-ticket', id),

  // Configuration
  getConfig: () => ipcRenderer.invoke('get-config'),
  updateConfig: (config: any) => ipcRenderer.invoke('update-config', config),

  // Copilot models
  getCopilotModels: () => ipcRenderer.invoke('get-copilot-models'),

  // Health check
  healthCheck: () => ipcRenderer.invoke('health-check'),

  // Event listeners
  onTicketLog: (callback: (data: any) => void) => {
    ipcRenderer.on('ticket-log', (_event, data) => callback(data));
  },
  removeTicketLogListener: () => {
    ipcRenderer.removeAllListeners('ticket-log');
  },
});

// Type definitions for TypeScript
declare global {
  interface Window {
    electronAPI: {
      getAllTickets: () => Promise<{ success: boolean; tickets?: any[]; error?: string }>;
      getTicket: (id: string) => Promise<{ success: boolean; ticket?: any; error?: string }>;
      createTicket: (name: string, description: string) => Promise<{ success: boolean; ticket?: any; error?: string }>;
      updateTicket: (id: string, description: string) => Promise<{ success: boolean; ticket?: any; error?: string }>;
      deleteTicket: (id: string) => Promise<{ success: boolean; error?: string }>;
      startTicket: (id: string) => Promise<{ success: boolean; error?: string }>;
      stopTicket: (id: string) => Promise<{ success: boolean; ticket?: any; error?: string }>;
      getConfig: () => Promise<{ success: boolean; config?: any; error?: string }>;
      updateConfig: (config: any) => Promise<{ success: boolean; config?: any; error?: string }>;
      getCopilotModels: () => Promise<{ success: boolean; models?: any[]; error?: string }>;
      healthCheck: () => Promise<{ status: string; timestamp: string; electron: string; node: string }>;
      onTicketLog: (callback: (data: any) => void) => void;
      removeTicketLogListener: () => void;
    };
  }
}
