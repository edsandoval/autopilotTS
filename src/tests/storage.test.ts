import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Storage } from '../utils/storage.js';
import { TicketStatus } from '../types/index.js';
import type { Ticket } from '../types/index.js';
import { ProjectManager } from '../utils/project.js';
import { join } from 'path';
import { tmpdir } from 'os';
import { existsSync, mkdirSync, rmSync } from 'fs';

describe('Storage - Ticket Structure Validation', () => {
  // keep the original structural tests
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


// Additional tests for project-aware storage behavior

describe('Storage - project aware operations', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `autopilot-storage-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    process.env.AUTOPILOT_DIR = testDir;
  });

  afterEach(() => {
    delete process.env.AUTOPILOT_DIR;
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should report storage path correctly', () => {
    // before any project is selected, path should equal ephemeral autopilot root
    const root = ProjectManager.getAutopilotDir();
    expect(Storage.getStoragePath()).toBe(root);

    ProjectManager.createProject('A');
    expect(Storage.getStoragePath()).toContain(ProjectManager.encodeName('A'));
  });

  it('should store tickets separately per project', () => {
    ProjectManager.createProject('A');
    expect(Storage.getAllTickets()).toEqual([]);
    Storage.createTicket('A-001', 'first');
    expect(Storage.getAllTickets().length).toBe(1);

    ProjectManager.createProject('B');
    expect(Storage.getAllTickets()).toEqual([]);
    Storage.createTicket('B-001', 'second');
    expect(Storage.getAllTickets().length).toBe(1);

    // switch back
    ProjectManager.setActiveProject('A');
    Storage.resetCache();
    const ticketsA = Storage.getAllTickets();
    expect(ticketsA.length).toBe(1);
    expect(ticketsA[0].id).toBe('A-001');
  });
});

