import { Router, Request, Response } from 'express';
import { Commands } from '../../commands/index.js';
import { Storage } from '../../utils/storage.js';

const router = Router();

// GET /api/tickets - List all tickets
router.get('/', async (req: Request, res: Response) => {
  try {
    const tickets = Storage.getAllTickets();
    res.json({ success: true, tickets });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// POST /api/tickets - Create new ticket
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    
    if (!name || !description) {
      return res.status(400).json({ 
        success: false, 
        error: 'Name and description are required' 
      });
    }
    
    const ticket = Storage.createTicket(name, description);
    res.json({ success: true, ticket });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// POST /api/tickets/import - Import tickets from file
router.post('/import', async (req: Request, res: Response) => {
  try {
    const { filePath } = req.body;
    
    if (!filePath) {
      return res.status(400).json({ 
        success: false, 
        error: 'File path is required' 
      });
    }
    
    const commands = new Commands();
    
    // Use a helper method to capture output
    const originalLog = console.log;
    const logs: string[] = [];
    console.log = (...args: any[]) => {
      logs.push(args.join(' '));
      originalLog(...args);
    };
    
    await commands.import(filePath);
    
    console.log = originalLog;
    
    res.json({ success: true, message: 'Tickets imported successfully', logs });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// GET /api/tickets/:id/status - Get ticket status
router.get('/:id/status', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const ticket = Storage.getTicket(id);
    
    if (!ticket) {
      return res.status(404).json({ 
        success: false, 
        error: 'Ticket not found' 
      });
    }
    
    res.json({ success: true, ticket });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// POST /api/tickets/:id/start - Start working on ticket
router.post('/:id/start', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    
    // Check if ticket exists
    const ticket = Storage.getTicket(id);
    if (!ticket) {
      return res.status(404).json({ 
        success: false, 
        error: 'Ticket not found' 
      });
    }
    
    // This is async, so we return immediately
    // The actual work happens in background
    res.json({ 
      success: true, 
      message: 'Ticket started. Check logs for progress.',
      ticket 
    });
    
    // Start work in background (don't await)
    const commands = new Commands();
    commands.start(id).catch(error => {
      console.error('Error starting ticket:', error);
    });
    
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// POST /api/tickets/:id/stop - Stop working on ticket
router.post('/:id/stop', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    
    // Check if ticket exists
    const ticket = Storage.getTicket(id);
    if (!ticket) {
      return res.status(404).json({ 
        success: false, 
        error: 'Ticket not found' 
      });
    }
    
    const commands = new Commands();
    await commands.stop(id);
    
    const updatedTicket = Storage.getTicket(id);
    res.json({ success: true, ticket: updatedTicket });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// PATCH /api/tickets/:id - Update ticket description
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { description } = req.body;
    
    if (!description) {
      return res.status(400).json({ 
        success: false, 
        error: 'Description is required' 
      });
    }
    
    const ticket = Storage.getTicket(id);
    if (!ticket) {
      return res.status(404).json({ 
        success: false, 
        error: 'Ticket not found' 
      });
    }
    
    // Update only the description
    Storage.updateTicket(id, { description });
    
    const updatedTicket = Storage.getTicket(id);
    res.json({ success: true, ticket: updatedTicket });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// DELETE /api/tickets/:id - Delete ticket
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    
    const commands = new Commands();
    // Skip confirmation prompt since Web UI already confirmed
    await commands.delete(id, true);
    
    res.json({ success: true, message: 'Ticket deleted successfully' });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// GET /api/tickets/:id/summary - Get ticket summary (HTML)
router.get('/:id/summary', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    
    const ticket = Storage.getTicket(id);
    
    if (!ticket) {
      return res.status(404).json({ 
        success: false, 
        error: 'Ticket not found' 
      });
    }
    
    if (!ticket.summary) {
      return res.status(404).json({ 
        success: false, 
        error: 'Summary not available. Ticket must be completed first.' 
      });
    }
    
    res.json({ 
      success: true, 
      summary: ticket.summary,
      ticketId: ticket.id,
      ticketName: ticket.name
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// POST /api/tickets/autopilot - Start autopilot mode
router.post('/autopilot', async (req: Request, res: Response) => {
  try {
    const commands = new Commands();
    
    // Check if autopilot is already running
    const status = commands.getAutopilotStatus();
    if (status.running) {
      return res.status(409).json({
        success: false,
        error: 'Autopilot is already running'
      });
    }

    // Get pending tickets count for preview
    const allTickets = Storage.getAllTickets();
    const pendingTickets = allTickets.filter(t => t.status === 'pending');

    if (pendingTickets.length === 0) {
      return res.json({
        success: false,
        error: 'No pending tickets to process'
      });
    }

    // Start autopilot in background
    // Don't await - let it run async
    commands.autopilotMode((update: any) => {
      // Send updates via WebSocket if available
      // This will be handled by the WebSocket connection
    }).catch(error => {
      console.error('Autopilot error:', error);
    });

    res.json({
      success: true,
      message: 'Autopilot started',
      ticketsCount: pendingTickets.length
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/tickets/autopilot/stop - Stop autopilot mode
router.post('/autopilot/stop', async (req: Request, res: Response) => {
  try {
    const commands = new Commands();
    commands.stopAutopilot();

    res.json({
      success: true,
      message: 'Autopilot will stop after current ticket completes'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/tickets/autopilot/status - Get autopilot status
router.get('/autopilot/status', async (req: Request, res: Response) => {
  try {
    const commands = new Commands();
    const status = commands.getAutopilotStatus();

    res.json({
      success: true,
      status
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
