export enum TicketStatus {
  PENDING = 'pending',
  BRANCHING = 'branching',
  WORKING = 'working',
  STOPPED = 'stopped',
  CLOSED = 'closed',
  ERROR = 'error'
}

export enum TicketType {
  BUG = 'bug',
  ENHANCEMENT = 'enhancement',
  FEATURE = 'feature',
  CODE_REVIEW = 'code-review',
  REFACTOR = 'refactor'
}

export interface Ticket {
  id: string;
  name: string;
  description: string;
  status: TicketStatus;
  type?: TicketType;
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
  reportLanguage?: string; // Language for ticket reports (default: en)
  // Per-type prompts for ticket handling (each value is a prompt string)
  ticketTypes?: {
    bug?: string;
    enhancement?: string;
    feature?: string;
    codeReview?: string; // corresponds to TicketType.CODE_REVIEW
    refactor?: string;
  };
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