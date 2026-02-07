export enum TicketStatus {
  PENDING = 'pending',
  BRANCHING = 'branching',
  WORKING = 'working',
  STOPPED = 'stopped',
  CLOSED = 'closed',
  ERROR = 'error'
}

export interface Ticket {
  id: string;
  name: string;
  description: string;
  status: TicketStatus;
  createdAt: Date;
  startedAt?: Date;
  stoppedAt?: Date;
  closedAt?: Date;
  branch?: string;
  error?: string;
  summary?: string; // HTML summary of changes when ticket is completed
}

export interface TicketConfig {
  tickets: Ticket[];
  lastId: number;
}

export interface ProjectConfig {
  debug?: boolean;
  baseRepositoryPath?: string; // Carpeta del repositorio base
  automationPath?: string; // Carpeta automatización
  baseBranch?: string; // Repositorio base (default: develop)
  copilotModel?: string; // Modelo de Copilot (default: gpt-4o)
  ticketCommandPrompt?: string; // Prompt for running ticket commands (supports ${FILE} placeholder)
  ticketResolutionPrompt?: string; // Prompt for ticket resolution (supports ${ID}, ${DESCRIPTION} placeholders)
}

export interface CopilotResponse {
  success: boolean;
  message: string;
  changes?: string[];
  error?: string;
}

export interface AutopilotTicketResult {
  ticket: Ticket;
  success: boolean;
  duration: number;
  error?: string;
  summary?: string;
}

export interface AutopilotResult {
  completed: AutopilotTicketResult[];
  failed: AutopilotTicketResult[];
  totalDuration: number;
  cancelled: boolean;
}