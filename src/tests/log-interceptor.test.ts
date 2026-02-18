import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LogInterceptor } from '../utils/log-interceptor.js';

describe('LogInterceptor - Initialization', () => {
  let mockWindow: any;

  beforeEach(() => {
    // Mock Electron BrowserWindow
    mockWindow = {
      webContents: {
        send: vi.fn()
      }
    };
  });

  afterEach(() => {
    LogInterceptor.stop();
  });

  it('should initialize with window', () => {
    expect(() => {
      LogInterceptor.initialize(mockWindow);
    }).not.toThrow();
  });

  it('should set ticket ID', () => {
    LogInterceptor.setTicketId('TASK-001');
    expect(() => LogInterceptor.setTicketId('TASK-002')).not.toThrow();
  });

  it('should start and stop interception', () => {
    LogInterceptor.initialize(mockWindow);
    
    expect(() => LogInterceptor.start()).not.toThrow();
    expect(() => LogInterceptor.stop()).not.toThrow();
  });

  it('should handle multiple start/stop cycles', () => {
    LogInterceptor.initialize(mockWindow);
    
    expect(() => {
      LogInterceptor.start();
      LogInterceptor.stop();
      LogInterceptor.start();
      LogInterceptor.stop();
    }).not.toThrow();
  });
});
