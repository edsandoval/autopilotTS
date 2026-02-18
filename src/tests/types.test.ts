import { describe, it, expect } from 'vitest';
import { TicketStatus } from '../types/index.js';
import type { Ticket, AutopilotResult } from '../types/index.js';

describe('Types - Ticket Structure', () => {
  it('should create valid ticket with all required fields', () => {
    const ticket: Ticket = {
      id: 'TASK-001',
      name: 'Test Ticket',
      description: 'This is a test description',
      status: TicketStatus.PENDING,
      createdAt: new Date()
    };

    expect(ticket.id).toMatch(/^TASK-\d{3}$/);
    expect(ticket.name).toBeTruthy();
    expect(ticket.description).toBeTruthy();
    expect(ticket.status).toBe(TicketStatus.PENDING);
    expect(ticket.createdAt).toBeInstanceOf(Date);
  });

  it('should support all ticket statuses', () => {
    const statuses = [
      TicketStatus.PENDING,
      TicketStatus.BRANCHING,
      TicketStatus.WORKING,
      TicketStatus.STOPPED,
      TicketStatus.CLOSED,
      TicketStatus.ERROR
    ];

    statuses.forEach(status => {
      const ticket: Ticket = {
        id: 'TASK-001',
        name: 'Test',
        description: 'Test',
        status,
        createdAt: new Date()
      };
      expect(ticket.status).toBe(status);
    });
  });

  it('should include optional fields', () => {
    const ticket: Ticket = {
      id: 'TASK-001',
      name: 'Test',
      description: 'Test',
      status: TicketStatus.CLOSED,
      createdAt: new Date(),
      startedAt: new Date(),
      closedAt: new Date(),
      branch: 'develop-TASK-001',
      summary: '<div>HTML Summary</div>'
    };

    expect(ticket.branch).toBeDefined();
    expect(ticket.summary).toBeDefined();
    expect(ticket.startedAt).toBeInstanceOf(Date);
    expect(ticket.closedAt).toBeInstanceOf(Date);
  });
});

describe('Types - AutopilotResult Structure', () => {
  it('should create valid autopilot result', () => {
    const result: AutopilotResult = {
      completed: [],
      failed: [],
      totalDuration: 0,
      cancelled: false
    };

    expect(result.completed).toBeInstanceOf(Array);
    expect(result.failed).toBeInstanceOf(Array);
    expect(result.totalDuration).toBe(0);
    expect(result.cancelled).toBe(false);
  });
});
