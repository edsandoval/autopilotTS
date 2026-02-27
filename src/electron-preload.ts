import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Ticket management
  getAllTickets: () => ipcRenderer.invoke('get-all-tickets'),
  getTicket: (id: string) => ipcRenderer.invoke('get-ticket', id),
  createTicket: (name: string, description: string, type?: string) => 
    ipcRenderer.invoke('create-ticket', name, description, type),
  updateTicket: (id: string, name: string, description: string, type?: string) => 
    ipcRenderer.invoke('update-ticket', id, name, description, type),
  deleteTicket: (id: string) => ipcRenderer.invoke('delete-ticket', id),
  startTicket: (id: string) => ipcRenderer.invoke('start-ticket', id),
  stopTicket: (id: string) => ipcRenderer.invoke('stop-ticket', id),
  getTicketSummary: (id: string) => ipcRenderer.invoke('get-ticket-summary', id),

  // Autopilot
  startAutopilot: () => ipcRenderer.invoke('start-autopilot'),
  stopAutopilot: () => ipcRenderer.invoke('stop-autopilot'),

  // Configuration
  getConfig: () => ipcRenderer.invoke('get-config'),
  updateConfig: (config: any) => ipcRenderer.invoke('update-config', config),

  // Copilot models
  getCopilotModels: () => ipcRenderer.invoke('get-copilot-models'),

  // Project management
  listProjects: () => ipcRenderer.invoke('list-projects'),
  createProject: (name: string) => ipcRenderer.invoke('create-project', name),
  selectProject: (name: string) => ipcRenderer.invoke('select-project', name),
  getActiveProject: () => ipcRenderer.invoke('get-active-project'),
  deleteProject: (name: string) => ipcRenderer.invoke('delete-project', name),

  // Health check
  healthCheck: () => ipcRenderer.invoke('health-check'),

  // Folder picker
  selectFolder: () => ipcRenderer.invoke('select-folder'),

  // Event listeners
  onTicketLog: (callback: (data: any) => void) => {
    ipcRenderer.on('ticket-log', (_event, data) => callback(data));
  },
  removeTicketLogListener: () => {
    ipcRenderer.removeAllListeners('ticket-log');
  },
  onAutopilotProgress: (callback: (data: any) => void) => {
    ipcRenderer.on('autopilot:progress', (_event, data) => callback(data));
  },
  removeAutopilotProgressListener: () => {
    ipcRenderer.removeAllListeners('autopilot:progress');
  },
});

// Type definitions for TypeScript
declare global {
  interface Window {
    electronAPI: {
      getAllTickets: () => Promise<{ success: boolean; tickets?: any[]; error?: string }>;
      getTicket: (id: string) => Promise<{ success: boolean; ticket?: any; error?: string }>;
      createTicket: (name: string, description: string, type?: string) => Promise<{ success: boolean; ticket?: any; error?: string }>;
      updateTicket: (id: string, name: string, description: string, type?: string) => Promise<{ success: boolean; ticket?: any; error?: string }>;
      deleteTicket: (id: string) => Promise<{ success: boolean; error?: string }>;
      startTicket: (id: string) => Promise<{ success: boolean; error?: string }>;
      stopTicket: (id: string) => Promise<{ success: boolean; ticket?: any; error?: string }>;
      getTicketSummary: (id: string) => Promise<{ success: boolean; summary?: string; error?: string }>;
      startAutopilot: () => Promise<{ success: boolean; error?: string }>;
      stopAutopilot: () => Promise<{ success: boolean; error?: string }>;
      getConfig: () => Promise<{ success: boolean; config?: any; error?: string }>;
      updateConfig: (config: any) => Promise<{ success: boolean; config?: any; error?: string }>;
      getCopilotModels: () => Promise<{ success: boolean; models?: any[]; error?: string }>;
      listProjects: () => Promise<{ success: boolean; projects?: string[]; active?: string; error?: string }>;
      createProject: (name: string) => Promise<{ success: boolean; project?: string; error?: string }>;
      selectProject: (name: string) => Promise<{ success: boolean; error?: string }>;
      getActiveProject: () => Promise<{ success: boolean; project?: string; error?: string }>;
      deleteProject: (name: string) => Promise<{ success: boolean; error?: string }>;
      healthCheck: () => Promise<{ status: string; timestamp: string; electron: string; node: string }>;
      selectFolder: () => Promise<{ success: boolean; path?: string; cancelled?: boolean; error?: string }>;
      onTicketLog: (callback: (data: any) => void) => void;
      removeTicketLogListener: () => void;
      onAutopilotProgress: (callback: (data: any) => void) => void;
      removeAutopilotProgressListener: () => void;
    };
  }
}
