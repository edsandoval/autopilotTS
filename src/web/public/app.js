// AutopilotTS Web UI App

class AutopilotApp {
  constructor() {
    this.tickets = [];
    this.currentFilter = 'all';
    this.ws = null;
    this.autopilotRunning = false;
    this.autopilotInterval = null;
    
    // Terminal instances
    this.terminal = null;
    this.terminalAutopilot = null;
    this.fitAddon = null;
    this.fitAddonAutopilot = null;
    
    // Terminal footer resize
    this.isResizing = false;
    this.terminalFooterHeight = 200;
    this.terminalFooterHeightBeforeMinimize = 200;
    this.terminalFooterMinimized = false;
    
    this.init();
  }

  async init() {
    await this.loadTickets();
    await this.loadConfig();
    await this.loadModels(); // Load available models
    this.setupElectronIPC(); // Use Electron IPC instead of WebSocket
    this.setupTerminal();
    this.setupEventListeners();
    this.updateStatus('Ready - Desktop Mode');
  }

  setupEventListeners() {
    // Config form submit
    const configForm = document.getElementById('configForm');
    if (configForm) {
      configForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveConfig(e);
      });
    }
    
    // Terminal footer resize handle
    this.setupTerminalResize();
  }

  // Electron IPC Setup (replaces WebSocket)
  setupElectronIPC() {
    // Check if running in Electron
    if (typeof window.electronAPI === 'undefined') {
      console.warn('Not running in Electron environment');
      return;
    }
    
    console.log('Electron IPC initialized');
    // Ticket log listener is already set up in electron-adapter.js
  }

  // Handle ticket logs from Electron IPC
  handleTicketLog(data) {
    const { message, type, ticketId, log } = data;
    const logMessage = message || log || '';
    const logType = type || 'log';
    
    this.writeToTerminal(logMessage, logType);
  }

  // API Methods
  async apiCall(endpoint, options = {}) {
    try {
      const response = await fetch(`/api${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Request failed');
      }
      
      return data;
    } catch (error) {
      this.showError(error.message);
      throw error;
    }
  }

  // Tickets Management
  async loadTickets() {
    try {
      this.updateStatus('Loading tickets...');
      const data = await this.apiCall('/tickets');
      this.tickets = data.tickets || [];
      this.renderTickets();
      this.updateStatus(`${this.tickets.length} ticket(s) loaded`);
    } catch (error) {
      this.updateStatus('Failed to load tickets');
    }
  }

  async createTicket(event) {
    event.preventDefault();
    
    const name = document.getElementById('ticketName').value;
    const description = document.getElementById('ticketDescription').value;
    
    try {
      this.updateStatus('Creating ticket...');
      await this.apiCall('/tickets', {
        method: 'POST',
        body: JSON.stringify({ name, description })
      });
      
      this.hideCreateModal();
      document.getElementById('createForm').reset();
      await this.loadTickets();
      this.showSuccess('Ticket created successfully!');
    } catch (error) {
      this.updateStatus('Failed to create ticket');
    }
  }

  async startTicket(id) {
    if (!confirm(`Start working on ticket ${id}? This will create a git branch and begin resolution.`)) {
      return;
    }
    
    try {
      this.updateStatus(`Starting ticket ${id}...`);
      await this.apiCall(`/tickets/${id}/start`, { method: 'POST' });
      await this.loadTickets();
      this.showSuccess(`Ticket ${id} started! Check console for progress.`);
    } catch (error) {
      this.updateStatus(`Failed to start ticket ${id}`);
    }
  }

  async stopTicket(id) {
    if (!confirm(`Stop working on ticket ${id}?`)) {
      return;
    }
    
    try {
      this.updateStatus(`Stopping ticket ${id}...`);
      await this.apiCall(`/tickets/${id}/stop`, { method: 'POST' });
      await this.loadTickets();
      this.showSuccess(`Ticket ${id} stopped.`);
    } catch (error) {
      this.updateStatus(`Failed to stop ticket ${id}`);
    }
  }

  async deleteTicket(id) {
    if (!confirm(`Delete ticket ${id}? This action cannot be undone.`)) {
      return;
    }
    
    try {
      this.updateStatus(`Deleting ticket ${id}...`);
      await this.apiCall(`/tickets/${id}`, { method: 'DELETE' });
      await this.loadTickets();
      this.showSuccess(`Ticket ${id} deleted.`);
    } catch (error) {
      this.updateStatus(`Failed to delete ticket ${id}`);
    }
  }

  // Config Management
  async loadModels() {
    try {
      const data = await this.apiCall('/config/models');
      const models = data.models || [];
      
      const select = document.getElementById('copilotModel');
      if (!select) return;
      
      // Clear existing options
      select.innerHTML = '';
      
      // Add options
      models.forEach(model => {
        const option = document.createElement('option');
        option.value = model.id;
        option.textContent = model.name;
        if (model.description) {
          option.title = model.description;
        }
        select.appendChild(option);
      });
      
      // Set selected value from config
      const config = await this.apiCall('/config');
      const currentModel = config.config?.copilotModel || 'gpt-4o';
      select.value = currentModel;
      
    } catch (error) {
      console.error('Failed to load models:', error);
      // Fallback to showing a text input or default options
      const select = document.getElementById('copilotModel');
      if (select) {
        select.innerHTML = '<option value="gpt-4o">GPT-4o (default)</option>';
      }
    }
  }

  async refreshModels() {
    try {
      this.updateStatus('Refreshing models list...');
      const data = await this.apiCall('/config/models/refresh', { method: 'POST' });
      const models = data.models || [];
      
      const select = document.getElementById('copilotModel');
      if (!select) return;
      
      const currentValue = select.value;
      
      // Clear and repopulate
      select.innerHTML = '';
      models.forEach(model => {
        const option = document.createElement('option');
        option.value = model.id;
        option.textContent = model.name;
        if (model.description) {
          option.title = model.description;
        }
        select.appendChild(option);
      });
      
      // Restore selection if still available
      if ([...select.options].some(opt => opt.value === currentValue)) {
        select.value = currentValue;
      }
      
      this.updateStatus('Models list refreshed');
      this.showSuccess(`Found ${models.length} available models`);
    } catch (error) {
      console.error('Failed to refresh models:', error);
      this.updateStatus('Failed to refresh models');
    }
  }

  async loadConfig() {
    try {
      const data = await this.apiCall('/config');
      const config = data.config || {};
      const defaults = data.defaults || {};
      
      document.getElementById('baseRepositoryPath').value = config.baseRepositoryPath || '';
      document.getElementById('automationPath').value = config.automationPath || '';
      document.getElementById('baseBranch').value = config.baseBranch || 'develop';
      document.getElementById('debugMode').checked = config.debug || false;
      
      // Use defaults if no custom value is set
      document.getElementById('ticketCommandPrompt').value = config.ticketCommandPrompt || defaults.ticketCommandPrompt || '';
      document.getElementById('ticketResolutionPrompt').value = config.ticketResolutionPrompt || defaults.ticketResolutionPrompt || '';
      
      document.getElementById('reportLanguage').value = config.reportLanguage || 'en';
      
      // Set model dropdown value if models are already loaded
      const modelSelect = document.getElementById('copilotModel');
      if (modelSelect && modelSelect.options.length > 0) {
        modelSelect.value = config.copilotModel || 'gpt-4o';
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  }

  async saveConfig(event) {
    if (event) {
      event.preventDefault();
    }
    
    const baseRepositoryPath = document.getElementById('baseRepositoryPath').value;
    const automationPath = document.getElementById('automationPath').value;
    const baseBranch = document.getElementById('baseBranch').value;
    const copilotModel = document.getElementById('copilotModel').value;
    const debug = document.getElementById('debugMode').checked;
    const ticketCommandPrompt = document.getElementById('ticketCommandPrompt').value;
    const ticketResolutionPrompt = document.getElementById('ticketResolutionPrompt').value;
    const reportLanguage = document.getElementById('reportLanguage').value;
    
    try {
      this.updateStatus('Saving configuration...');
      
      await this.apiCall('/config', {
        method: 'POST',
        body: JSON.stringify({ key: 'baseRepositoryPath', value: baseRepositoryPath })
      });
      
      await this.apiCall('/config', {
        method: 'POST',
        body: JSON.stringify({ key: 'automationPath', value: automationPath })
      });
      
      await this.apiCall('/config', {
        method: 'POST',
        body: JSON.stringify({ key: 'baseBranch', value: baseBranch })
      });
      
      await this.apiCall('/config', {
        method: 'POST',
        body: JSON.stringify({ key: 'copilotModel', value: copilotModel })
      });
      
      await this.apiCall('/config', {
        method: 'POST',
        body: JSON.stringify({ key: 'baseBranch', value: baseBranch })
      });
      
      await this.apiCall('/config', {
        method: 'POST',
        body: JSON.stringify({ key: 'debug', value: debug ? 'on' : 'off' })
      });
      
      await this.apiCall('/config', {
        method: 'POST',
        body: JSON.stringify({ key: 'ticketCommandPrompt', value: ticketCommandPrompt })
      });
      
      await this.apiCall('/config', {
        method: 'POST',
        body: JSON.stringify({ key: 'ticketResolutionPrompt', value: ticketResolutionPrompt })
      });
      
      await this.apiCall('/config', {
        method: 'POST',
        body: JSON.stringify({ key: 'reportLanguage', value: reportLanguage })
      });
      
      this.hideConfigModal();
      this.showSuccess('Configuration saved!');
      this.updateStatus('Configuration saved successfully!');
    } catch (error) {
      this.updateStatus('Failed to save configuration');
      console.error('Error saving config:', error);
    }
  }

  // Filtering
  filterTickets(filter) {
    this.currentFilter = filter;
    
    // Update active filter button
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.filter === filter) {
        btn.classList.add('active');
      }
    });
    
    this.renderTickets();
  }

  // Rendering
  renderTickets() {
    const grid = document.getElementById('ticketsGrid');
    
    let filteredTickets = this.tickets;
    if (this.currentFilter !== 'all') {
      filteredTickets = this.tickets.filter(t => t.status === this.currentFilter);
    }
    
    if (filteredTickets.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <h3>No tickets found</h3>
          <p>Create a new ticket to get started</p>
        </div>
      `;
      return;
    }
    
    grid.innerHTML = filteredTickets.map(ticket => this.renderTicketCard(ticket)).join('');
  }

  renderTicketCard(ticket) {
    const actions = this.getTicketActions(ticket);
    const workingIndicator = ticket.status === 'working' 
      ? '<div class="working-indicator" title="Copilot trabajando...">⚙️</div>' 
      : '';
    
    return `
      <div class="ticket-card" data-id="${ticket.id}">
        <div class="ticket-header">
          <div class="ticket-id">${ticket.id}</div>
          <div style="display: flex; align-items: center; gap: 8px;">
            ${workingIndicator}
            <span class="ticket-status ${ticket.status}">${ticket.status}</span>
          </div>
        </div>
        <div class="ticket-name">${this.escapeHtml(ticket.name)}</div>
        <div class="ticket-description">${this.escapeHtml(ticket.description)}</div>
        <div class="ticket-meta">
          Created: ${new Date(ticket.createdAt).toLocaleDateString()}
        </div>
        <div class="ticket-actions">
          ${actions}
        </div>
      </div>
    `;
  }

  getTicketActions(ticket) {
    const actions = [];
    
    if (ticket.status === 'pending' || ticket.status === 'stopped') {
      actions.push(`<button class="btn btn-success" onclick="app.startTicket('${ticket.id}')">▶️ Start</button>`);
    }
    
    if (ticket.status === 'working') {
      actions.push(`<button class="btn btn-warning" onclick="app.stopTicket('${ticket.id}')">⏸️ Stop</button>`);
    }
    
    // Always show eye icon, but only functional if ticket is closed and has summary
    const eyeClass = (ticket.status === 'closed' && ticket.summary) ? 'btn-info' : 'btn-disabled';
    const eyeClick = (ticket.status === 'closed' && ticket.summary) ? `onclick="app.viewTicketSummary('${ticket.id}')"` : 'onclick="app.noSummaryAlert()"';
    actions.push(`<button class="btn ${eyeClass}" ${eyeClick}>👁️ Ver</button>`);
    
    // Edit button - only allow editing if ticket is not working
    if (ticket.status !== 'working') {
      actions.push(`<button class="btn btn-info" onclick="app.showEditModal('${ticket.id}')">✏️ Edit</button>`);
    }
    
    actions.push(`<button class="btn btn-danger" onclick="app.deleteTicket('${ticket.id}')">🗑️ Delete</button>`);
    
    return actions.join('');
  }

  // Modal Management
  showCreateModal() {
    document.getElementById('createModal').classList.add('active');
  }

  hideCreateModal() {
    document.getElementById('createModal').classList.remove('active');
  }

  showConfigModal() {
    this.loadConfig();
    document.getElementById('configModal').classList.add('active');
  }

  hideConfigModal() {
    document.getElementById('configModal').classList.remove('active');
  }

  showLogsModal() {
    document.getElementById('logsModal').classList.add('active');
  }

  hideLogsModal() {
    document.getElementById('logsModal').classList.remove('active');
  }

  showSummaryModal() {
    document.getElementById('summaryModal').classList.add('active');
  }

  hideSummaryModal() {
    document.getElementById('summaryModal').classList.remove('active');
  }

  showEditModal(id) {
    const ticket = this.tickets.find(t => t.id === id);
    if (!ticket) {
      this.showError('Ticket not found');
      return;
    }
    
    document.getElementById('editTicketId').value = ticket.id;
    document.getElementById('editTicketDescription').value = ticket.description;
    document.getElementById('editModal').classList.add('active');
  }

  hideEditModal() {
    document.getElementById('editModal').classList.remove('active');
  }

  async updateTicket(event) {
    event.preventDefault();
    
    const id = document.getElementById('editTicketId').value;
    const description = document.getElementById('editTicketDescription').value;
    
    try {
      this.updateStatus('Updating ticket...');
      await this.apiCall(`/tickets/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ description })
      });
      
      this.hideEditModal();
      await this.loadTickets();
      this.showSuccess('Ticket updated successfully!');
    } catch (error) {
      this.updateStatus('Failed to update ticket');
    }
  }

  async viewTicketSummary(id) {
    try {
      this.showSummaryModal();
      document.getElementById('summaryTicketId').textContent = id;
      document.getElementById('summaryContainer').innerHTML = '<div class="loading">Cargando resumen...</div>';
      
      const data = await this.apiCall(`/tickets/${id}/summary`);
      
      if (data.success && data.summary) {
        document.getElementById('summaryContainer').innerHTML = data.summary;
      } else {
        document.getElementById('summaryContainer').innerHTML = `
          <div style="padding: 20px; text-align: center; color: #f44336;">
            <h3>❌ Resumen no disponible</h3>
            <p>El ticket debe estar completado para ver el resumen.</p>
          </div>
        `;
      }
    } catch (error) {
      document.getElementById('summaryContainer').innerHTML = `
        <div style="padding: 20px; text-align: center; color: #f44336;">
          <h3>❌ Error</h3>
          <p>${error.message}</p>
        </div>
      `;
    }
  }

  noSummaryAlert() {
    alert('El resumen solo está disponible para tickets completados.');
  }

  // Autopilot Mode
  async showAutopilotModal() {
    const pendingTickets = this.tickets.filter(t => t.status === 'pending');
    
    if (pendingTickets.length === 0) {
      alert('No hay tickets pendientes para procesar.');
      return;
    }

    // Populate tickets list
    const listHtml = pendingTickets.map(t => `
      <div class="autopilot-ticket-item">
        <span class="ticket-id">${t.id}</span>
        <span class="ticket-name">${this.escapeHtml(t.name)}</span>
      </div>
    `).join('');

    document.getElementById('autopilotTicketsList').innerHTML = listHtml;
    document.getElementById('autopilotConfirmModal').classList.add('active');
  }

  hideAutopilotModal() {
    document.getElementById('autopilotConfirmModal').classList.remove('active');
  }

  async startAutopilot() {
    try {
      this.hideAutopilotModal();
      
      // Start autopilot
      const data = await this.apiCall('/tickets/autopilot', { method: 'POST' });
      
      if (!data.success) {
        this.showError(data.error || 'Failed to start autopilot');
        return;
      }

      // Show progress modal
      this.autopilotRunning = true;
      document.getElementById('autopilotProgressModal').classList.add('active');
      document.getElementById('autopilotBtn').disabled = true;
      document.getElementById('autopilotBtn').classList.add('disabled');
      
      // Start polling for status
      this.startAutopilotPolling();

    } catch (error) {
      this.showError('Failed to start autopilot: ' + error.message);
    }
  }

  startAutopilotPolling() {
    // Poll every 2 seconds for ticket updates
    this.autopilotInterval = setInterval(async () => {
      await this.loadTickets();
      
      // Check if all tickets are processed
      const pendingTickets = this.tickets.filter(t => t.status === 'pending');
      const workingTickets = this.tickets.filter(t => t.status === 'working');
      
      if (pendingTickets.length === 0 && workingTickets.length === 0) {
        // Autopilot finished
        this.stopAutopilotPolling();
        await this.showAutopilotSummary();
      } else if (workingTickets.length > 0) {
        // Update current ticket info
        const currentTicket = workingTickets[0];
        const totalProcessed = this.tickets.filter(t => 
          t.status === 'closed' || t.status === 'error'
        ).length;
        const totalTickets = this.tickets.length;
        
        document.getElementById('progressText').textContent = 
          `Procesando ticket ${totalProcessed + 1} de ${totalTickets}...`;
        
        const progressPercent = ((totalProcessed / totalTickets) * 100).toFixed(0);
        document.getElementById('progressBar').style.width = progressPercent + '%';
        
        document.getElementById('currentTicketInfo').innerHTML = `
          <div class="ticket-id">${currentTicket.id}</div>
          <div class="ticket-name">${this.escapeHtml(currentTicket.name)}</div>
        `;
      }
    }, 2000);
  }

  stopAutopilotPolling() {
    if (this.autopilotInterval) {
      clearInterval(this.autopilotInterval);
      this.autopilotInterval = null;
    }
    this.autopilotRunning = false;
    document.getElementById('autopilotBtn').disabled = false;
    document.getElementById('autopilotBtn').classList.remove('disabled');
  }

  async stopAutopilot() {
    if (!confirm('¿Detener el autopilot después del ticket actual?')) {
      return;
    }

    try {
      await this.apiCall('/tickets/autopilot/stop', { method: 'POST' });
      this.updateStatus('Autopilot se detendrá después del ticket actual...');
    } catch (error) {
      console.error('Failed to stop autopilot:', error);
    }
  }

  async showAutopilotSummary() {
    // Hide progress modal
    document.getElementById('autopilotProgressModal').classList.remove('active');
    
    // Calculate results
    const completed = this.tickets.filter(t => t.status === 'closed');
    const failed = this.tickets.filter(t => t.status === 'error');
    
    const summaryHtml = `
      <div class="autopilot-summary-stats">
        <div class="stat-box success">
          <div class="stat-icon">✅</div>
          <div class="stat-number">${completed.length}</div>
          <div class="stat-label">Completados</div>
        </div>
        <div class="stat-box error">
          <div class="stat-icon">❌</div>
          <div class="stat-number">${failed.length}</div>
          <div class="stat-label">Fallidos</div>
        </div>
      </div>
      
      ${completed.length > 0 ? `
        <div class="summary-section">
          <h3>✅ Tickets Completados</h3>
          <ul class="ticket-result-list">
            ${completed.map(t => `
              <li class="success">
                <strong>${t.id}</strong> - ${this.escapeHtml(t.name)}
              </li>
            `).join('')}
          </ul>
        </div>
      ` : ''}
      
      ${failed.length > 0 ? `
        <div class="summary-section">
          <h3>❌ Tickets Fallidos</h3>
          <ul class="ticket-result-list">
            ${failed.map(t => `
              <li class="error">
                <strong>${t.id}</strong> - ${this.escapeHtml(t.name)}
                ${t.error ? `<br><small>Error: ${this.escapeHtml(t.error)}</small>` : ''}
              </li>
            `).join('')}
          </ul>
        </div>
      ` : ''}
    `;
    
    document.getElementById('autopilotSummaryContent').innerHTML = summaryHtml;
    document.getElementById('autopilotSummaryModal').classList.add('active');
    
    this.updateStatus('Autopilot finalizado');
  }

  hideAutopilotSummary() {
    document.getElementById('autopilotSummaryModal').classList.remove('active');
    this.loadTickets();
  }

  // Logs
  addLog(message, level = 'info') {
    const container = document.getElementById('logsContainer');
    const entry = document.createElement('div');
    entry.className = `log-entry ${level}`;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    container.appendChild(entry);
    container.scrollTop = container.scrollHeight;
  }

  // UI Helpers
  updateStatus(text) {
    document.querySelector('.status-text').textContent = text;
  }

  showSuccess(message) {
    this.updateStatus(message);
    setTimeout(() => this.updateStatus('Ready'), 3000);
  }

  showError(message) {
    this.updateStatus(`Error: ${message}`);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ============================================
  // TERMINAL METHODS
  // ============================================

  setupTerminal() {
    console.log('Setting up terminals...');
    
    // Main terminal footer (always visible)
    if (typeof Terminal !== 'undefined') {
      this.terminal = new Terminal({
        cursorBlink: false,
        fontSize: 14,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        theme: {
          background: '#1e1e1e',
          foreground: '#d4d4d4',
          cursor: '#00d9ff',
          selection: 'rgba(0, 217, 255, 0.3)'
        },
        convertEol: true,
        rows: 8
      });

      // Fit addon for responsive terminal
      if (typeof FitAddon !== 'undefined' && FitAddon.FitAddon) {
        this.fitAddon = new FitAddon.FitAddon();
        this.terminal.loadAddon(this.fitAddon);
      }

      const terminalElement = document.getElementById('terminal');
      if (terminalElement) {
        this.terminal.open(terminalElement);
        if (this.fitAddon) {
          setTimeout(() => {
            this.fitAddon.fit();
            this.terminal.writeln('✓ Terminal initialized');
            this.terminal.writeln('Waiting for logs...');
          }, 100);
        }
      } else {
        console.error('Terminal element not found');
      }

      // Autopilot modal terminal
      this.terminalAutopilot = new Terminal({
        cursorBlink: false,
        fontSize: 14,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        theme: {
          background: '#1e1e1e',
          foreground: '#d4d4d4',
          cursor: '#00d9ff',
          selection: 'rgba(0, 217, 255, 0.3)'
        },
        convertEol: true
      });

      if (typeof FitAddon !== 'undefined' && FitAddon.FitAddon) {
        this.fitAddonAutopilot = new FitAddon.FitAddon();
        this.terminalAutopilot.loadAddon(this.fitAddonAutopilot);
      }

      const terminalAutopilotElement = document.getElementById('terminalAutopilot');
      if (terminalAutopilotElement) {
        this.terminalAutopilot.open(terminalAutopilotElement);
        if (this.fitAddonAutopilot) {
          setTimeout(() => this.fitAddonAutopilot.fit(), 100);
        }
      }

      // Resize terminal when window resizes
      window.addEventListener('resize', () => {
        if (this.fitAddon) {
          this.fitAddon.fit();
        }
        if (this.fitAddonAutopilot) {
          this.fitAddonAutopilot.fit();
        }
      });
    } else {
      console.error('Terminal library not loaded');
    }
  }

  writeToTerminal(text, type = 'log') {
    if (!this.terminal || !this.terminalAutopilot) {
      console.error('Terminals not initialized');
      return;
    }

    // Format text with timestamp
    const timestamp = new Date().toLocaleTimeString();
    const prefix = type === 'error' ? '❌' : '▶';
    const formattedText = `[${timestamp}] ${prefix} ${text}`;
    
    // Write to both terminals
    this.terminal.writeln(formattedText);
    this.terminalAutopilot.writeln(formattedText);

    // Auto-scroll to bottom
    this.terminal.scrollToBottom();
    this.terminalAutopilot.scrollToBottom();
    
    console.log('Written to terminal:', formattedText);
  }

  clearTerminals() {
    if (this.terminal) {
      this.terminal.clear();
      this.terminal.writeln('✓ Terminal cleared');
    }
    if (this.terminalAutopilot) {
      this.terminalAutopilot.clear();
    }
  }

  // Terminal footer resize functionality
  setupTerminalResize() {
    const terminalFooter = document.getElementById('terminalFooter');
    const terminalHeader = terminalFooter.querySelector('.terminal-header');
    
    let startY = 0;
    let startHeight = 0;

    const onMouseDown = (e) => {
      // Only allow resize if clicking near the top edge (within 10px)
      const rect = terminalHeader.getBoundingClientRect();
      if (e.clientY > rect.top && e.clientY < rect.top + 10) {
        this.isResizing = true;
        startY = e.clientY;
        startHeight = this.terminalFooterHeight;
        document.body.style.cursor = 'ns-resize';
        e.preventDefault();
      }
    };

    const onMouseMove = (e) => {
      if (!this.isResizing) return;
      
      const deltaY = startY - e.clientY;
      const newHeight = Math.max(50, Math.min(800, startHeight + deltaY));
      
      this.setTerminalFooterHeight(newHeight);
    };

    const onMouseUp = () => {
      if (this.isResizing) {
        this.isResizing = false;
        document.body.style.cursor = '';
      }
    };

    terminalHeader.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    // Make header show resize cursor when hovering near top
    terminalHeader.addEventListener('mousemove', (e) => {
      const rect = terminalHeader.getBoundingClientRect();
      if (e.clientY > rect.top && e.clientY < rect.top + 10) {
        terminalHeader.style.cursor = 'ns-resize';
      } else {
        terminalHeader.style.cursor = 'default';
      }
    });
  }

  setTerminalFooterHeight(height) {
    const terminalFooter = document.getElementById('terminalFooter');
    this.terminalFooterHeight = height;
    terminalFooter.style.height = height + 'px';
    document.body.style.paddingBottom = (height + 20) + 'px';
    
    // Refit terminal
    if (this.fitAddon) {
      setTimeout(() => this.fitAddon.fit(), 10);
    }
  }

  toggleTerminalFooter() {
    if (this.terminalFooterMinimized) {
      // Restore to previous height
      this.setTerminalFooterHeight(this.terminalFooterHeightBeforeMinimize);
      this.terminalFooterMinimized = false;
      document.querySelector('.terminal-toggle-btn').textContent = '▼';
      document.querySelector('.terminal-toggle-btn').title = 'Minimizar terminal';
    } else {
      // Save current height before minimizing
      this.terminalFooterHeightBeforeMinimize = this.terminalFooterHeight;
      // Minimize to just header height (~40px)
      this.setTerminalFooterHeight(40);
      this.terminalFooterMinimized = true;
      document.querySelector('.terminal-toggle-btn').textContent = '▲';
      document.querySelector('.terminal-toggle-btn').title = 'Restaurar terminal';
    }
  }
}

// Initialize app
const app = new AutopilotApp();

// Close modals when clicking outside
window.onclick = (event) => {
  if (event.target.classList.contains('modal')) {
    event.target.classList.remove('active');
  }
};

// Refresh tickets every 10 seconds
setInterval(() => {
  app.loadTickets();
}, 10000);
