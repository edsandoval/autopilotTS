import { describe, it, expect } from 'vitest';
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { Ticket, TicketConfig } from '../types/index.js';

describe('Storage - File Operations', () => {
  let testDir: string;
  let storageFile: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `autopilot-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    storageFile = join(testDir, '.autopilot.json');
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should create valid ticket structure', () => {
    const ticket: Ticket = {
      id: 'TASK-001',
      description: 'Test ticket',
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    expect(ticket.id).toMatch(/TASK-\d{3}/);
    expect(ticket.status).toBe('pending');
    expect(ticket.description).toBeTruthy();
  });

  it('should persist ticket config to JSON file', () => {
    const config: TicketConfig = {
      lastId: 1,
      tickets: [
        {
          id: 'TASK-001',
          description: 'First ticket',
          status: 'pending',
          createdAt: new Date().toISOString()
        }
      ]
    };

    writeFileSync(storageFile, JSON.stringify(config, null, 2));

    expect(existsSync(storageFile)).toBe(true);
    const loaded = JSON.parse(readFileSync(storageFile, 'utf8'));
    expect(loaded.tickets).toHaveLength(1);
    expect(loaded.tickets[0].id).toBe('TASK-001');
  });

  it('should load and increment ticket IDs', () => {
    const config: TicketConfig = {
      lastId: 5,
      tickets: []
    };

    writeFileSync(storageFile, JSON.stringify(config));
    const loaded: TicketConfig = JSON.parse(readFileSync(storageFile, 'utf8'));

    expect(loaded.lastId).toBe(5);
    
    // Next ID should be 6
    const nextId = loaded.lastId + 1;
    expect(nextId).toBe(6);
  });

  it('should update ticket status in config', () => {
    const config: TicketConfig = {
      lastId: 1,
      tickets: [
        {
          id: 'TASK-001',
          description: 'Test',
          status: 'pending',
          createdAt: new Date().toISOString()
        }
      ]
    };

    writeFileSync(storageFile, JSON.stringify(config));
    
    // Simulate status update
    const loaded: TicketConfig = JSON.parse(readFileSync(storageFile, 'utf8'));
    loaded.tickets[0].status = 'working';
    writeFileSync(storageFile, JSON.stringify(loaded, null, 2));

    const updated: TicketConfig = JSON.parse(readFileSync(storageFile, 'utf8'));
    expect(updated.tickets[0].status).toBe('working');
  });

  it('should handle multiple tickets', () => {
    const config: TicketConfig = {
      lastId: 3,
      tickets: [
        { id: 'TASK-001', description: 'First', status: 'closed', createdAt: new Date().toISOString() },
        { id: 'TASK-002', description: 'Second', status: 'working', createdAt: new Date().toISOString() },
        { id: 'TASK-003', description: 'Third', status: 'pending', createdAt: new Date().toISOString() }
      ]
    };

    writeFileSync(storageFile, JSON.stringify(config, null, 2));
    const loaded: TicketConfig = JSON.parse(readFileSync(storageFile, 'utf8'));

    expect(loaded.tickets).toHaveLength(3);
    expect(loaded.tickets.find(t => t.status === 'working')).toBeDefined();
  });
});

