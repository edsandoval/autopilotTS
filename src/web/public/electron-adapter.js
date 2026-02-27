// Electron API Adapter
// This file adapts the Electron IPC API to match the existing HTTP API structure
// so we can reuse the existing app.js with minimal changes

(function() {
  'use strict';

  // Check if we're running in Electron
  const isElectron = typeof window !== 'undefined' && window.electronAPI;

  if (!isElectron) {
    console.warn('Not running in Electron environment');
    return;
  }

  console.log('Electron API detected, setting up log listener...');

  // Setup Electron log listener - this will be called when logs arrive
  window.electronAPI.onTicketLog((data) => {
    console.log('Received ticket-log event:', data);
    if (window.app && typeof window.app.handleTicketLog === 'function') {
      window.app.handleTicketLog(data);
    } else {
      console.warn('App not ready to handle logs yet, queueing...');
      // Queue the log if app isn't ready
      if (!window._pendingLogs) window._pendingLogs = [];
      window._pendingLogs.push(data);
    }
  });

  // Setup Autopilot progress listener
  window.electronAPI.onAutopilotProgress((data) => {
    console.log('Received autopilot:progress event:', data);
    if (window.app && typeof window.app.handleAutopilotProgress === 'function') {
      window.app.handleAutopilotProgress(data);
    } else {
      console.warn('App not ready to handle progress yet');
    }
  });

  // Create a fetch-like API wrapper for Electron IPC
  const electronFetch = async (url, options = {}) => {
    const method = options.method || 'GET';
    const body = options.body ? JSON.parse(options.body) : {};

    try {
      // Parse the URL to determine the endpoint
      const endpoint = url.replace('/api', '');
      
      // Route to appropriate Electron IPC handler
      if (endpoint === '/tickets' && method === 'GET') {
        return await window.electronAPI.getAllTickets();
      }
      
      if (endpoint === '/tickets' && method === 'POST') {
        return await window.electronAPI.createTicket(body.name, body.description, body.type);
      }
      
      // Autopilot endpoints
      if (endpoint === '/tickets/autopilot' && method === 'POST') {
        return await window.electronAPI.startAutopilot();
      }
      
      if (endpoint === '/tickets/autopilot/stop' && method === 'POST') {
        return await window.electronAPI.stopAutopilot();
      }
      
      // Individual ticket endpoints - check specific actions first
      if (endpoint.match(/^\/tickets\/(.+)\/start$/) && method === 'POST') {
        const id = endpoint.match(/^\/tickets\/(.+)\/start$/)[1];
        return await window.electronAPI.startTicket(id);
      }
      
      if (endpoint.match(/^\/tickets\/(.+)\/stop$/) && method === 'POST') {
        const id = endpoint.match(/^\/tickets\/(.+)\/stop$/)[1];
        return await window.electronAPI.stopTicket(id);
      }
      
      if (endpoint.match(/^\/tickets\/(.+)\/summary$/) && method === 'GET') {
        const id = endpoint.match(/^\/tickets\/(.+)\/summary$/)[1];
        return await window.electronAPI.getTicketSummary(id);
      }
      
      // Generic ticket operations
      if (endpoint.match(/^\/tickets\/(.+)$/) && method === 'DELETE') {
        const id = endpoint.match(/^\/tickets\/(.+)$/)[1];
        return await window.electronAPI.deleteTicket(id);
      }
      
      if (endpoint.match(/^\/tickets\/(.+)$/) && (method === 'PUT' || method === 'PATCH')) {
        const id = endpoint.match(/^\/tickets\/(.+)$/)[1];
        return await window.electronAPI.updateTicket(id, body.name, body.description, body.type);
      }
      
      if (endpoint === '/config' && method === 'GET') {
        return await window.electronAPI.getConfig();
      }
      
      if (endpoint === '/config' && method === 'POST') {
        return await window.electronAPI.updateConfig(body);
      }
      
      if (endpoint === '/config/models' && method === 'GET') {
        return await window.electronAPI.getCopilotModels();
      }
      
      if (endpoint === '/config/models/refresh' && method === 'POST') {
        return await window.electronAPI.getCopilotModels();
      }
      
      if (endpoint === '/health' && method === 'GET') {
        const health = await window.electronAPI.healthCheck();
        return { success: true, ...health };
      }

      if (endpoint === '/folder/select' && method === 'POST') {
        return await window.electronAPI.selectFolder();
      }

      throw new Error(`Unknown endpoint: ${method} ${endpoint}`);
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // Override the global fetch for Electron
  const originalFetch = window.fetch;
  window.fetch = function(url, options) {
    // Only intercept /api calls
    if (typeof url === 'string' && url.startsWith('/api')) {
      return Promise.resolve({
        json: () => electronFetch(url, options),
        ok: true,
        status: 200
      });
    }
    // Pass through other requests to original fetch
    return originalFetch.apply(this, arguments);
  };

  console.log('Electron API adapter loaded');
})();
