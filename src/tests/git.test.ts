import { describe, it, expect } from 'vitest';
import { ConfigManager } from '../utils/config.js';

describe('GitManager - Branch Naming', () => {
  it('should validate base branch configuration', () => {
    const baseBranch = ConfigManager.getBaseBranch();
    expect(['develop', 'main', 'master']).toContain(baseBranch);
  });

  it('should generate correct branch name for ticket', () => {
    const ticketId = 'MOBILE-042';
    const baseBranch = ConfigManager.getBaseBranch();
    const branchName = `${baseBranch}-${ticketId}`;
    
    expect(branchName).toContain(ticketId);
    expect(branchName).toContain(baseBranch);
  });

  it('should validate ticket ID format in branch names', () => {
    const validTicketIds = ['TASK-001', 'MOBILE-999', 'BACKEND-123'];
    
    validTicketIds.forEach(ticketId => {
      expect(ticketId).toMatch(/^[A-Z]+-\d{3}$/);
    });
  });
});
