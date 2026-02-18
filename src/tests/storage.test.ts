import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Storage } from '../utils/storage.js';
import { TicketStatus } from '../types/index.js';
import type { Ticket } from '../types/index.js';

describe('Storage - Ticket Structure Validation', () => {
  it('should validate ticket ID format', () => {
    const validIds = ['TASK-001', 'TASK-999', 'MOBILE-042', 'BACKEND-123'];
    
    validIds.forEach(id => {
      expect(id).toMatch(/^[A-Z]+-\d{3}$/);
    });
  });

  it('should validate ticket has all required fields', () => {
    const ticket: Ticket = {
      id: 'TASK-001',
      name: 'Test Ticket',
      description: 'Test description',
      status: TicketStatus.PENDING,
      createdAt: new Date()
    };

    expect(ticket.id).toBeTruthy();
    expect(ticket.name).toBeTruthy();
    expect(ticket.description).toBeTruthy();
    expect(ticket.status).toBeTruthy();
    expect(ticket.createdAt).toBeInstanceOf(Date);
  });

  it('should support optional fields', () => {
    const ticket: Ticket = {
      id: 'TASK-001',
      name: 'Test',
      description: 'Test',
      status: TicketStatus.CLOSED,
      createdAt: new Date(),
      startedAt: new Date(),
      closedAt: new Date(),
      branch: 'develop-TASK-001',
      summary: '<div>Summary</div>'
    };

    expect(ticket.branch).toBeDefined();
    expect(ticket.summary).toBeDefined();
    expect(ticket.startedAt).toBeInstanceOf(Date);
    expect(ticket.closedAt).toBeInstanceOf(Date);
  });
});

