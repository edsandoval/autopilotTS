import { describe, it, expect } from 'vitest';
import type { Ticket, TicketStatus } from '../types/index.js';

describe('Ticket Type Validation', () => {
  it('should create valid ticket object', () => {
    const ticket: Ticket = {
      id: 'TASK-001',
      description: 'Test ticket',
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    expect(ticket.id).toMatch(/^TASK-\d{3}$/);
    expect(ticket.description).toBeTruthy();
    expect(['pending', 'branching', 'working', 'stopped', 'closed', 'error']).toContain(ticket.status);
  });

  it('should validate ticket status transitions', () => {
    const validStatuses: TicketStatus[] = ['pending', 'branching', 'working', 'stopped', 'closed', 'error'];
    
    validStatuses.forEach(status => {
      const ticket: Ticket = {
        id: 'TASK-001',
        description: 'Test',
        status,
        createdAt: new Date().toISOString()
      };
      expect(ticket.status).toBe(status);
    });
  });

  it('should include optional branch field', () => {
    const ticket: Ticket = {
      id: 'TASK-001',
      description: 'Test',
      status: 'working',
      createdAt: new Date().toISOString(),
      branch: 'copilot/TASK-001'
    };

    expect(ticket.branch).toBe('copilot/TASK-001');
  });

  it('should validate ticket ID format', () => {
    const validIds = ['TASK-001', 'TASK-999', 'MOBILE-042', 'BACKEND-123'];
    const invalidIds = ['TASK001', 'task-001', 'TASK-', '-001'];

    validIds.forEach(id => {
      expect(id).toMatch(/^[A-Z]+-\d{3}$/);
    });

    invalidIds.forEach(id => {
      expect(id).not.toMatch(/^[A-Z]+-\d{3}$/);
    });
  });
});
