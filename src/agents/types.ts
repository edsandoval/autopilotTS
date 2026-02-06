import { Ticket } from '../types/index.js';

/**
 * Context shared between agents during ticket resolution
 */
export interface AgentContext {
  ticket: Ticket;
  projectPath: string;
  debugMode: boolean;
}

/**
 * A file change made during implementation
 */
export interface FileChange {
  path: string;
  action: 'created' | 'modified' | 'deleted';
  success: boolean;
  error?: string;
}
