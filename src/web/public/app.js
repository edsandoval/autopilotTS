// AutopilotTS Web UI App

class AutopilotApp {
  constructor() {
    this.tickets = [];
    this.projects = [];
    this.activeProject = null;
    this.currentProject = null;

    this.currentFilter = 'all';
    this.selectedTicketType = 'bug'; // Default to bug type
    this.selectedEditTicketType = null;
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
    // Expose app globally immediately for Electron adapter
    window.app = this;

    // Setup listeners before showing any modal so the project list is interactive
    this.setupEventListeners();

    // ensure a project is selected before doing anything else
    await this.ensureProjectSelected();

    await this.loadTickets();
    await this.loadConfig();
    await this.loadModels(); // Load available models
    this.setupElectronIPC(); // Use Electron IPC instead of WebSocket
    this.setupTerminal();
    this.setupGlobalTooltips();

    // Process any queued logs that arrived before app was ready
    this.processQueuedLogs();

    this.updateStatus('Ready - Desktop Mode');
  }

  setupEventListeners() {
    // Project buttons
    const projectList = document.getElementById('projectList');
    if (projectList) {
      projectList.addEventListener('click', (e) => {
        const item = e.target.closest('.project-list-item');
        if (!item) return;
        // Mark as selected
        projectList.querySelectorAll('.project-list-item').forEach(el => el.classList.remove('selected'));
        item.classList.add('selected');
      });
      projectList.addEventListener('dblclick', (e) => {
        const item = e.target.closest('.project-list-item');
        if (!item) return;
        this.selectProject(item.dataset.project);
      });
      projectList.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const item = e.target.closest('.project-list-item');
        if (!item) return;
        // Select the right-clicked item
        projectList.querySelectorAll('.project-list-item').forEach(el => el.classList.remove('selected'));
        item.classList.add('selected');
        const menu = document.getElementById('projectContextMenu');
        if (!menu) return;
        menu.style.left = e.clientX + 'px';
        menu.style.top = e.clientY + 'px';
        menu.classList.add('visible');
      });
    }
    document.addEventListener('click', () => this._hideProjectContextMenu());
    document.addEventListener('contextmenu', (e) => {
      if (!e.target.closest('#projectList')) {
        this._hideProjectContextMenu();
      }
    });
    const createProjectBtn = document.getElementById('createProjectBtn');
    if (createProjectBtn) {
      createProjectBtn.addEventListener('click', () => this.showCreateProjectModal());
    }
    const projectLabel = document.getElementById('projectLabel');
    if (projectLabel) {
      projectLabel.style.cursor = 'pointer';
      projectLabel.addEventListener('click', () => {
        this.loadProjects().then(() => this.showProjectModal());
      });
    }

    // Config form submit
    const configForm = document.getElementById('configForm');
    if (configForm) {
      configForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveConfig(e);
      });
    }

    // Delegate ticket action buttons to avoid inline onclick parsing/quoting issues
    const ticketsGrid = document.getElementById('ticketsGrid');
    if (ticketsGrid) {
      ticketsGrid.addEventListener('click', (e) => {
        // Be defensive: e.target may be a text node in some browsers, so normalize
        let target = e.target;
        if (target && target.nodeType === Node.TEXT_NODE) target = target.parentElement;
        const btn = target && target.closest ? target.closest('button[data-action]') : null;
        if (!btn) return;
        
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        
        // CRITICAL: Stop propagation AND prevent default
        e.stopPropagation();
        e.preventDefault();
        
        switch (action) {
          case 'start':
            this.startTicket(id);
            break;
          case 'stop':
            this.stopTicket(id);
            break;
          case 'view':
            if (btn.classList.contains('btn-disabled')) {
              this.noSummaryAlert();
            } else {
              this.viewTicketSummary(id);
            }
            break;
          case 'edit':
            this.showEditModal(id);
            break;
          case 'delete':
            this.deleteTicket(id);
            break;
        }
      });
    }
    
    // Terminal footer resize handle
    this.setupTerminalResize();
  }

  // Global tooltip portal (prevents clipping by overflow parents)
  setupGlobalTooltips() {
    if (this._tooltipInitialized) return;

    // create single global tooltip element appended to body
    this._globalTooltip = document.createElement('div');
    this._globalTooltip.className = 'global-tooltip';
    this._globalTooltip.setAttribute('role', 'tooltip');
    this._globalTooltip.style.display = 'none';
    document.body.appendChild(this._globalTooltip);

    const showFromElement = (el) => {
      const inner = el.querySelector('.tooltip');
      if (!inner) return;
      this._showGlobalTooltip(el, inner.innerHTML);
    };

    const hide = () => this._hideGlobalTooltip();

    document.querySelectorAll('.help-icon').forEach(icon => {
      icon.addEventListener('mouseenter', () => showFromElement(icon));
      icon.addEventListener('mouseleave', hide);
      icon.addEventListener('focus', () => showFromElement(icon), true);
      icon.addEventListener('blur', hide, true);
      icon.addEventListener('touchstart', (e) => { e.preventDefault(); showFromElement(icon); }, { passive: false });
    });

    // hide on scroll/resize for stability
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);

    this._tooltipInitialized = true;
  }

  _showGlobalTooltip(referenceEl, html) {
    if (!this._globalTooltip) return;
    const tip = this._globalTooltip;
    tip.innerHTML = html;
    tip.style.display = 'block';
    tip.style.visibility = 'hidden';
    tip.classList.remove('above', 'below', 'visible');

    // position after next frame so offsetWidth/Height are correct
    requestAnimationFrame(() => {
      const rect = referenceEl.getBoundingClientRect();
      const w = tip.offsetWidth;
      const h = tip.offsetHeight;

      // prefer placing above the reference; if no space, place below
      let top = rect.top - h - 8;
      let placement = 'above';
      if (top < 8) {
        top = rect.bottom + 8;
        placement = 'below';
      }

      let left = rect.left + rect.width / 2 - w / 2;
      const margin = 8;
      left = Math.max(margin, Math.min(left, window.innerWidth - w - margin));

      tip.style.left = `${left}px`;
      tip.style.top = `${top}px`;
      tip.classList.add(placement === 'above' ? 'above' : 'below');
      tip.style.visibility = 'visible';

      // animate in
      requestAnimationFrame(() => tip.classList.add('visible'));
    });
  }

  _hideGlobalTooltip() {
    const tip = this._globalTooltip;
    if (!tip) return;
    tip.classList.remove('visible');
    setTimeout(() => {
      tip.style.display = 'none';
      tip.style.visibility = 'hidden';
      tip.innerHTML = '';
      tip.classList.remove('above', 'below');
    }, 150);
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
    console.log('handleTicketLog called with:', data);
    const { message, type, ticketId, log } = data;
    const logMessage = message || log || '';
    const logType = type || 'log';
    
    if (logMessage) {
      this.writeToTerminal(logMessage, logType);
    }
  }

  // Handle autopilot progress updates from Electron IPC
  handleAutopilotProgress(data) {
    console.log('handleAutopilotProgress called with:', data);
    const { phase, current, total, percentage, currentTicketId } = data;
    
    // Update progress bar
    document.getElementById('progressBar').style.width = percentage + '%';
    
    // Update progress text based on phase
    let progressText = '';
    if (phase === 'phase1') {
      progressText = `Creating worktrees: ${current}/${total} (${percentage}%)`;
    } else if (phase === 'phase2') {
      progressText = `Processing tickets: ${current}/${total} (${percentage}%)`;
      
      // Update current ticket info if provided
      if (currentTicketId) {
        const ticket = this.tickets.find(t => t.id === currentTicketId);
        if (ticket) {
          document.getElementById('currentTicketInfo').innerHTML = `
            <div class="ticket-id">${ticket.id}</div>
            <div class="ticket-name">${this.escapeHtml(ticket.name)}</div>
          `;
        }
      }
    } else if (phase === 'complete') {
      progressText = `Completed (100%)`;
    }
    
    document.getElementById('progressText').textContent = progressText;
  }

  // Process any logs that were queued before app was ready
  processQueuedLogs() {
    if (window._pendingLogs && window._pendingLogs.length > 0) {
      console.log(`Processing ${window._pendingLogs.length} queued logs...`);
      window._pendingLogs.forEach(data => this.handleTicketLog(data));
      window._pendingLogs = [];
    }
  }

  // Project helpers
  async ensureProjectSelected() {
    // Always load projects and show the selection modal at startup
    await this.loadProjects();

    // Get currently active project (to pre-label it, but still show chooser)
    const res = await window.electronAPI.getActiveProject();
    if (res.success && res.project) {
      this.currentProject = res.project;
      this.setProjectLabel(res.project);
    }

    if (this.projects.length === 0) {
      // nothing to pick, show creation dialog directly
      this.showCreateProjectModal();
    } else {
      this.showProjectModal();
      // Wait for the user to select a project before continuing
      await new Promise(resolve => { this._projectSelectionResolve = resolve; });
    }
  }

  async loadProjects() {
    try {
      const res = await window.electronAPI.listProjects();
      if (res.success) {
        this.projects = res.projects || [];
        this.activeProject = res.active;
        const list = document.getElementById('projectList');
        if (list) {
          list.innerHTML = '';
          (this.projects || []).forEach((p) => {
            const item = document.createElement('div');
            item.className = 'project-list-item' + (p === this.activeProject ? ' selected' : '');
            item.dataset.project = p;
            item.textContent = p;
            list.appendChild(item);
          });
          // ensure first item selected if active not found
          const hasSelected = list.querySelector('.project-list-item.selected');
          if (!hasSelected && list.firstChild) {
            list.firstChild.classList.add('selected');
          }
        }
      }
    } catch (err) {
      console.error('Failed to load projects', err);
    }
  }

  openSelectedProject() {
    const list = document.getElementById('projectList');
    if (!list) return;
    const selected = list.querySelector('.project-list-item.selected');
    if (!selected) return;
    this.selectProject(selected.dataset.project);
  }

  showProjectModal() {
    const modal = document.getElementById('projectModal');
    if (modal) modal.classList.add('active');
  }
  hideProjectModal() {
    const modal = document.getElementById('projectModal');
    if (modal) modal.classList.remove('active');
  }

  setProjectLabel(name) {
    const lbl = document.getElementById('projectLabel');
    if (lbl) lbl.textContent = `Project: ${name}`;
  }

  async selectProject(name) {
    try {
      await window.electronAPI.selectProject(name);
      this.currentProject = name;
      this.setProjectLabel(name);
      this.hideProjectModal();
      // resolve the startup promise if pending
      if (this._projectSelectionResolve) {
        this._projectSelectionResolve();
        this._projectSelectionResolve = null;
      }
      // reload data now that project changed
      await this.loadTickets();
      await this.loadConfig();
      this.updateStatus(`Project "${name}" selected`);
    } catch (err) {
      console.error('Error selecting project', err);
    }
  }

  showCreateProjectModal() {
    const modal = document.getElementById('createProjectModal');
    if (modal) modal.classList.add('active');
    // hide selection list while creating
    const sel = document.getElementById('projectModal');
    if (sel) sel.classList.remove('active');
    // focus the name input and reset the Accept button
    setTimeout(() => {
      const input = document.getElementById('newProjectName');
      if (input) { input.value = ''; input.focus(); }
      const btn = document.getElementById('acceptProjectBtn');
      if (btn) btn.disabled = true;
    }, 50);
  }
  hideCreateProjectModal() {
    const modal = document.getElementById('createProjectModal');
    if (modal) modal.classList.remove('active');
    // always go back to project selection
    const sel = document.getElementById('projectModal');
    if (sel) sel.classList.add('active');
  }

  async createProject(event) {
    event.preventDefault();
    const input = document.getElementById('newProjectName');
    if (!input) return;
    const name = input.value.trim();
    if (!name) return;
    try {
      await window.electronAPI.createProject(name);
      this.currentProject = name;
      this.setProjectLabel(name);
      this.hideCreateProjectModal();
      this.hideProjectModal();
      // resolve the startup promise if pending
      if (this._projectSelectionResolve) {
        this._projectSelectionResolve();
        this._projectSelectionResolve = null;
      }
      await this.loadTickets();
      await this.loadConfig();
      this.updateStatus(`Project "${name}" created and selected`);
    } catch (err) {
      console.error('Failed to create project', err);
    }
  }

  _hideProjectContextMenu() {
    const menu = document.getElementById('projectContextMenu');
    if (menu) menu.classList.remove('visible');
  }

  async deleteSelectedProject() {
    this._hideProjectContextMenu();
    const list = document.getElementById('projectList');
    if (!list) return;
    const selected = list.querySelector('.project-list-item.selected');
    if (!selected) return;
    const name = selected.dataset.project;
    if (!name) return;
    const confirmed = confirm(`¿Eliminar el proyecto "${name}"?\n\nSe eliminará permanentemente la carpeta del proyecto y todos sus tickets. Esta acción no se puede deshacer.`);
    if (!confirmed) return;
    try {
      const res = await window.electronAPI.deleteProject(name);
      if (!res.success) throw new Error(res.error || 'Unknown error');
      if (this.currentProject === name) {
        this.currentProject = null;
        this.setProjectLabel('');
      }
      await this.loadProjects();
      this.updateStatus(`Project "${name}" deleted`);
      if (this.projects.length === 0) {
        this.hideProjectModal();
        this.showCreateProjectModal();
      }
    } catch (err) {
      console.error('Failed to delete project', err);
      this.updateStatus(`Failed to delete project "${name}"`);
    }
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
    
    // Ticket ID must be provided
    const ticketIdEl = document.getElementById('ticketId');
    const id = ticketIdEl ? ticketIdEl.value.trim() : '';
    const description = document.getElementById('ticketDescription').value.trim();
    const type = this.selectedTicketType;

    if (!id) {
      this.showError('Ticket ID is required');
      return;
    }
    if (!description) {
      this.showError('Description is required');
      return;
    }
    
    try {
      this.updateStatus('Creating ticket...');
      await this.apiCall('/tickets', {
        method: 'POST',
        body: JSON.stringify({ name: id, description, type })
      });
      
      this.hideCreateModal();
      document.getElementById('createForm').reset();
      this.selectedTicketType = null;
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
      // Immediate visual feedback - update ticket status optimistically
      this.updateStatus(`Starting ticket ${id}...`);
      this.writeToTerminal(`Starting resolution for ticket ${id}...`, 'log');
      
      // Find and update the ticket card immediately
      const ticketCard = document.querySelector(`.ticket-card[data-id="${id}"]`);
      if (ticketCard) {
        const statusEl = ticketCard.querySelector('.ticket-status');
        if (statusEl) {
          statusEl.textContent = 'working';
          statusEl.className = 'ticket-status working';
        }
        // Add working indicator
        const header = ticketCard.querySelector('.ticket-header > div:last-child');
        if (header && !header.querySelector('.working-indicator')) {
          const indicator = document.createElement('div');
          indicator.className = 'working-indicator';
          indicator.title = 'Copilot trabajando...';
          indicator.textContent = '⚙️';
          header.insertBefore(indicator, header.firstChild);
        }
      }
      
      // Make the actual API call
      await this.apiCall(`/tickets/${id}/start`, { method: 'POST' });
      
      // Reload tickets to get actual state
      await this.loadTickets();
      this.showSuccess(`Ticket ${id} started! Check terminal for progress.`);
    } catch (error) {
      this.updateStatus(`Failed to start ticket ${id}`);
      this.writeToTerminal(`Error starting ticket: ${error.message}`, 'error');
      // Reload to restore correct state
      await this.loadTickets();
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
      
      // Load per-type prompts (ticketTypes)
      const ticketTypes = config.ticketTypes || {};
      const setIfExists = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.value = value || '';
      };
      setIfExists('ticketTypePrompt-bug', ticketTypes.bug);
      setIfExists('ticketTypePrompt-enhancement', ticketTypes.enhancement);
      setIfExists('ticketTypePrompt-feature', ticketTypes.feature);
      setIfExists('ticketTypePrompt-codeReview', ticketTypes.codeReview);
      setIfExists('ticketTypePrompt-refactor', ticketTypes.refactor);
      
      document.getElementById('reportLanguage').value = config.reportLanguage || 'en';
      
      // Set model dropdown value if models are already loaded
      const modelSelect = document.getElementById('copilotModel');
      if (modelSelect && modelSelect.options.length > 0) {
        modelSelect.value = config.copilotModel || 'gpt-4o';
      }

      // Clipboard settings
      const clipboardEnabled = (config.clipboard && typeof config.clipboard.enableImageAnalysis !== 'undefined')
        ? config.clipboard.enableImageAnalysis
        : false;
      const clipboardPrompt = (config.clipboard && config.clipboard.imagePrompt) || `Analyze this screenshot @$IMAGE_FILE. It is likely a capture from a project management tool such as Jira, Trello, GitHub Issues, Linear, or similar.\nExtract the following and respond ONLY in this exact format, nothing else:\nID: <ticket id, issue number, card key or the shortest unique identifier you can find. If none exists, generate a short slug from the title>\nDESCRIPTION: <full description of the task, bug or feature. Include acceptance criteria, steps to reproduce, or any relevant detail visible in the image. Be thorough.>\nTYPE: <one of: bug | feature | enhancement | refactor | code-review>\nIMPORTANT: If the image does not appear to be from a ticket management tool, or if you cannot confidently determine an ID or DESCRIPTION from it, respond exactly like this and nothing else:\nID:\nDESCRIPTION:\nTYPE:\n`;

      const clipCheck = document.getElementById('clipboardEnableImageAnalysis');
      if (clipCheck) clipCheck.checked = !!clipboardEnabled;
      const clipPromptEl = document.getElementById('clipboardImagePrompt');
      if (clipPromptEl) clipPromptEl.value = clipboardPrompt;

    } catch (error) {
      console.error('Failed to load config:', error);
    }
  }

  async browseFolder(inputId) {
    try {
      const result = await this.apiCall('/folder/select', { method: 'POST' });
      if (result.success && result.path) {
        const input = document.getElementById(inputId);
        if (input) input.value = result.path;
      }
    } catch (err) {
      console.error('browseFolder error:', err);
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

    // Per-type prompts (Ticket Types)
    const ticketTypes = {
      bug: document.getElementById('ticketTypePrompt-bug') ? document.getElementById('ticketTypePrompt-bug').value.trim() : undefined,
      enhancement: document.getElementById('ticketTypePrompt-enhancement') ? document.getElementById('ticketTypePrompt-enhancement').value.trim() : undefined,
      feature: document.getElementById('ticketTypePrompt-feature') ? document.getElementById('ticketTypePrompt-feature').value.trim() : undefined,
      codeReview: document.getElementById('ticketTypePrompt-codeReview') ? document.getElementById('ticketTypePrompt-codeReview').value.trim() : undefined,
      refactor: document.getElementById('ticketTypePrompt-refactor') ? document.getElementById('ticketTypePrompt-refactor').value.trim() : undefined
    };
    
    try {
      this.updateStatus('Saving configuration...');
      
      // Send all config fields in a single request
      // Convert empty strings to undefined to preserve default behavior
      const configUpdate = {
        baseRepositoryPath: baseRepositoryPath.trim() || undefined,
        automationPath: automationPath.trim() || undefined,
        baseBranch: baseBranch.trim() || undefined,
        copilotModel: copilotModel || undefined,
        debug: debug,
        ticketCommandPrompt: ticketCommandPrompt.trim() || undefined,
        ticketResolutionPrompt: ticketResolutionPrompt.trim() || undefined,
        reportLanguage: reportLanguage || undefined,
        ticketTypes: {
          bug: ticketTypes.bug || undefined,
          enhancement: ticketTypes.enhancement || undefined,
          feature: ticketTypes.feature || undefined,
          codeReview: ticketTypes.codeReview || undefined,
          refactor: ticketTypes.refactor || undefined
        },
        clipboard: {
          enableImageAnalysis: document.getElementById('clipboardEnableImageAnalysis') ? !!document.getElementById('clipboardEnableImageAnalysis').checked : undefined,
          imagePrompt: document.getElementById('clipboardImagePrompt') ? document.getElementById('clipboardImagePrompt').value : undefined
        }
      };
      
      await this.apiCall('/config', {
        method: 'POST',
        body: JSON.stringify(configUpdate)
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
      grid.classList.add('empty-grid');
      grid.innerHTML = `
        <div class="empty-state">
          <h3>No tickets found</h3>
          <p>Create a new ticket to get started</p>
        </div>
      `;
      return;
    }
    
    grid.classList.remove('empty-grid');
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
            ${ticket.type ? `<span class="ticket-type ticket-type-${ticket.type}">${this.getTypeLabel(ticket.type)}</span>` : ''}
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
      actions.push(`<button class="btn btn-success" data-action="start" data-id="${ticket.id}">▶️ Start</button>`);
    }

    if (ticket.status === 'working') {
      actions.push(`<button class="btn btn-warning" data-action="stop" data-id="${ticket.id}">⏸️ Stop</button>`);
    }

    // Always show eye icon, but only functional if ticket is closed and has summary
    const eyeClass = (ticket.status === 'closed' && ticket.summary) ? 'btn-info' : 'btn-disabled';
    actions.push(`<button class="btn ${eyeClass}" data-action="view" data-id="${ticket.id}">👁️ Ver</button>`);

    // Edit button - only allow editing if ticket is not working
    if (ticket.status !== 'working') {
      actions.push(`<button class="btn btn-info" data-action="edit" data-id="${ticket.id}">✏️ Edit</button>`);
    }

    actions.push(`<button class="btn btn-danger" data-action="delete" data-id="${ticket.id}">🗑️ Delete</button>`);

    return actions.join('');
  }

  selectTicketType(type) {
    this.selectedTicketType = (this.selectedTicketType === type) ? null : type;
    document.querySelectorAll('#ticketTypeSelector .type-tag').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.type === this.selectedTicketType);
    });
  }

  selectEditTicketType(type) {
    this.selectedEditTicketType = (this.selectedEditTicketType === type) ? null : type;
    document.querySelectorAll('#editTicketTypeSelector .type-tag').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.type === this.selectedEditTicketType);
    });
  }

  // Modal Management
  async showCreateModal() {
    this.closeAllModals();
    this.selectedTicketType = 'bug'; // Set default to bug
    document.querySelectorAll('#ticketTypeSelector .type-tag').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.type === 'bug');
    });
    document.getElementById('createModal').classList.add('active');

    // Ensure ID and Description inputs are editable and cleared
    const ticketIdEl = document.getElementById('ticketId');
    if (ticketIdEl) { ticketIdEl.disabled = false; ticketIdEl.readOnly = false; ticketIdEl.value = ''; }
    const descEl = document.getElementById('ticketDescription');
    if (descEl) { descEl.disabled = false; descEl.value = ''; }

    // If clipboard extraction is enabled in config, attempt to extract image data
    try {
      const cfgRes = await this.apiCall('/config');
      const cfg = cfgRes.config || {};
      const clipboardCfg = cfg.clipboard || {};
      const enabled = (typeof clipboardCfg.enableImageAnalysis === 'undefined') ? true : !!clipboardCfg.enableImageAnalysis;
      const defaultPrompt = `Analyze this screenshot @$IMAGE_FILE. It is likely a capture from a project management tool such as Jira, Trello, GitHub Issues, Linear, or similar.\nExtract the following and respond ONLY in this exact format, nothing else:\nID: <ticket id, issue number, card key or the shortest unique identifier you can find. If none exists, generate a short slug from the title>\nDESCRIPTION: <full description of the task, bug or feature. Include acceptance criteria, steps to reproduce, or any relevant detail visible in the image. Be thorough.>\nTYPE: <one of: bug | feature | enhancement | refactor | code-review>\nIMPORTANT: If the image does not appear to be from a ticket management tool, or if you cannot confidently determine an ID or DESCRIPTION from it, respond exactly like this and nothing else:\nID:\nDESCRIPTION:\nTYPE:\n`;
      const prompt = clipboardCfg.imagePrompt || defaultPrompt;

      if (enabled && window.electronAPI && typeof window.electronAPI.extractClipboard === 'function') {
        const statusEl = document.getElementById('clipboardExtractionStatus');
        const createBtn = document.querySelector('#createModal button[type="submit"]');
        const cancelBtn = document.getElementById('cancelExtractionBtn');

        // helper to toggle create button based on inputs
        const updateCreateButtonState = () => {
          const idEl = document.getElementById('ticketId');
          const descEl = document.getElementById('ticketDescription');
          if (!createBtn) return;
          if (idEl && descEl && idEl.value.trim() && descEl.value.trim()) createBtn.disabled = false;
          else createBtn.disabled = true;
        };

        // attach input listeners so user can type and enable the create button
        const idElForListeners = document.getElementById('ticketId');
        const descElForListeners = document.getElementById('ticketDescription');
        if (idElForListeners) idElForListeners.oninput = updateCreateButtonState;
        if (descElForListeners) descElForListeners.oninput = updateCreateButtonState;

        // Initialize button disabled state while we check the clipboard
        if (createBtn) createBtn.disabled = true;

        try {
          if (statusEl) { statusEl.style.display = 'block'; statusEl.style.background = '#fff8c4'; statusEl.textContent = 'Checking clipboard for image...'; }
          if (cancelBtn) { cancelBtn.style.display = 'inline-block'; cancelBtn.onclick = async () => {
            // Cancel running extraction
            try {
              if (statusEl) statusEl.textContent = 'Cancelling extraction...';
              const cres = await window.electronAPI.cancelExtractClipboard();
              if (cres && cres.success) {
                if (statusEl) { statusEl.style.background = '#f3f3f3'; statusEl.textContent = 'Extraction cancelled.'; }
                if (this.writeToTerminal) this.writeToTerminal('Clipboard extraction cancelled by user', 'log');
              } else {
                if (statusEl) { statusEl.style.background = '#ffdede'; statusEl.textContent = 'Failed to cancel extraction.'; }
                if (cres && cres.error && this.writeToTerminal) this.writeToTerminal(`Failed to cancel extraction: ${cres.error}`, 'error');
              }
              if (createBtn) createBtn.disabled = false;
              if (cancelBtn) cancelBtn.style.display = 'none';
            } catch (err) {
              if (statusEl) { statusEl.style.background = '#ffdede'; statusEl.textContent = 'Error cancelling extraction.'; }
              console.error('Cancel extraction failed', err);
            }
          } }

          const r = await window.electronAPI.extractClipboard(prompt, 'gpt-4.1');

          // hide cancel button when done
          if (cancelBtn) cancelBtn.style.display = 'none';

          if (r && r.noImage) {
            if (statusEl) { statusEl.style.background = '#f3f3f3'; statusEl.textContent = 'No image found in clipboard.'; }
            if (this.writeToTerminal) this.writeToTerminal('No image found in clipboard for extraction', 'log');
            // re-enable create button so user can manually enter data
            if (createBtn) createBtn.disabled = false;
          } else if (r && r.success) {
            if (statusEl) { statusEl.style.background = '#e6ffed'; statusEl.textContent = 'Extraction complete — populating fields.'; }
            if (r.command && this.writeToTerminal) this.writeToTerminal(`Running: ${r.command}`, 'log');
            if (r.output && this.writeToTerminal) this.writeToTerminal(r.output, 'log');

            const parsed = r.parsed || this.extractClipboardFields(r.output || '');
            if (parsed) {
              this.applyClipboardExtraction(parsed);
              updateCreateButtonState();
            }
          } else {
            if (statusEl) { statusEl.style.background = '#ffdede'; statusEl.textContent = 'Extraction failed or returned no useful data.'; }
            if (r && r.error && this.writeToTerminal) this.writeToTerminal(`Clipboard extraction error: ${r.error}`, 'error');
            if (createBtn) createBtn.disabled = false;
          }
        } catch (err) {
          if (statusEl) { statusEl.style.background = '#ffdede'; statusEl.textContent = 'Error during clipboard extraction.'; }
          if (this.writeToTerminal) this.writeToTerminal(`Clipboard extraction exception: ${err.message || err}`, 'error');
          console.error('Clipboard extraction failed', err);
          if (createBtn) createBtn.disabled = false;
          if (cancelBtn) cancelBtn.style.display = 'none';
        }
      }
    } catch (err) {
      console.error('Clipboard extraction failed', err);
    }
  }

  extractClipboardFields(output) {
    if (!output) return null;
    const idMatch = output.match(/^ID:\s*(.*)$/im);
    const typeMatch = output.match(/^TYPE:\s*(.*)$/im);
    const descMatch = output.match(/DESCRIPTION:\s*([\s\S]*?)(?=\n[A-Z]+:\s|$)/im);
    return {
      id: idMatch && idMatch[1] ? idMatch[1].trim() : '',
      description: descMatch && descMatch[1] ? descMatch[1].trim() : '',
      type: typeMatch && typeMatch[1] ? typeMatch[1].trim().toLowerCase() : ''
    };
  }

  applyClipboardExtraction(parsed) {
    if (!parsed) return;
    if (parsed.id) {
      const idEl = document.getElementById('ticketId');
      if (idEl) idEl.value = parsed.id;
    }

    if (parsed.description) {
      const descEl = document.getElementById('ticketDescription');
      if (descEl) descEl.value = parsed.description;
    }

    if (parsed.type) {
      const map = { 'bug': 'bug', 'feature': 'feature', 'enhancement': 'enhancement', 'refactor': 'refactor', 'code-review': 'code-review', 'code review': 'code-review' };
      const normalized = map[parsed.type] || parsed.type;
      this.selectedTicketType = normalized;
      document.querySelectorAll('#ticketTypeSelector .type-tag').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === this.selectedTicketType);
      });
    }
  }

  hideCreateModal() {
    document.getElementById('createModal').classList.remove('active');
    this.selectedTicketType = 'bug'; // Reset to default
    document.querySelectorAll('#ticketTypeSelector .type-tag').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.type === 'bug');
    });
  }

  showConfigModal() {
    this.closeAllModals();
    this.loadConfig();
    document.getElementById('configModal').classList.add('active');
    // Ensure General tab is active when opening
    this.showConfigTab('general');
  }

  showConfigTab(tab) {
    // Toggle active class on tab buttons
    document.querySelectorAll('#configModal .tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    // Show/hide tab content sections
    document.querySelectorAll('#configModal .tab-content').forEach(content => {
      content.style.display = (content.id === `configTab-${tab}`) ? 'block' : 'none';
    });
  }

  hideConfigModal() {
    document.getElementById('configModal').classList.remove('active');
  }

  showLogsModal() {
    this.closeAllModals();
    document.getElementById('logsModal').classList.add('active');
  }

  hideLogsModal() {
    document.getElementById('logsModal').classList.remove('active');
  }

  showSummaryModal() {
    try {
      console.log('[showSummaryModal] Called - START');
      this.closeAllModals();
      document.getElementById('summaryModal').classList.add('active');
      const modal = document.getElementById('summaryModal');
      console.log('[showSummaryModal] Modal element:', modal);
      if (!modal) {
        console.error('[showSummaryModal] summaryModal NOT FOUND in DOM!');
        return;
      }
      modal.classList.add('active');
      console.log('[showSummaryModal] classList:', modal.classList.toString());
    } catch (error) {
      console.error('[showSummaryModal] ERROR:', error);
    }
  }

  hideSummaryModal() {
    document.getElementById('summaryModal').classList.remove('active');
  }

  showEditModal(id) {
    this.closeAllModals();
    const ticket = this.tickets.find(t => t.id === id);
    if (!ticket) {
      this.showError('Ticket not found');
      return;
    }
    
    document.getElementById('editTicketId').value = ticket.id;
    document.getElementById('editTicketDescription').value = ticket.description;

    this.selectedEditTicketType = ticket.type || null;
    document.querySelectorAll('#editTicketTypeSelector .type-tag').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.type === this.selectedEditTicketType);
    });

    document.getElementById('editModal').classList.add('active');
  }

  hideEditModal() {
    document.getElementById('editModal').classList.remove('active');
    this.selectedEditTicketType = null;
    document.querySelectorAll('#editTicketTypeSelector .type-tag').forEach(btn => btn.classList.remove('active'));
  }

  async updateTicket(event) {
    event.preventDefault();
    
    const id = document.getElementById('editTicketId').value;
    const description = document.getElementById('editTicketDescription').value;
    const type = this.selectedEditTicketType;
    
    try {
      this.updateStatus('Updating ticket...');
      await this.apiCall(`/tickets/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ description, type })
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

  closeAllModals() {
    document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
  }

  // Autopilot Mode
  async showAutopilotModal() {
    this.closeAllModals();
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
      this.closeAllModals();
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
      }
      // Note: Progress updates now come from autopilot:progress events
      // instead of being calculated here
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
    this.closeAllModals();
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

  getTypeLabel(type) {
    const labels = {
      'bug': '🐛 Bug',
      'enhancement': '✨ Enhancement',
      'feature': '🚀 Feature',
      'code-review': '👁️ Code Review',
      'refactor': '🔧 Refactor'
    };
    return labels[type] || type;
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
    const prefix = type === 'error' ? '❌' : type === 'warn' ? '⚠️ ' : '▶';
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
window.addEventListener('click', (event) => {
  // Don't interfere with button clicks or clicks inside modal content
  const target = event.target;
  if (target.closest('button') || target.closest('.modal-content')) {
    return;
  }
  
  // Only close if clicking directly on the modal backdrop
  if (target.classList && target.classList.contains('modal')) {
    target.classList.remove('active');
  }
});

// Refresh tickets every 10 seconds
setInterval(() => {
  app.loadTickets();
}, 10000);
