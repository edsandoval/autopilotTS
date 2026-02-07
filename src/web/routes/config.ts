import { Router, Request, Response } from 'express';
import { ConfigManager } from '../../utils/config.js';
import { CopilotModelsManager } from '../../utils/copilot-models.js';

const router = Router();

// GET /api/config - Get current configuration
router.get('/', async (req: Request, res: Response) => {
  try {
    const config = ConfigManager.getConfig();
    res.json({ success: true, config });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// POST /api/config - Update configuration
router.post('/', async (req: Request, res: Response) => {
  try {
    const { key, value } = req.body;
    
    if (!key) {
      return res.status(400).json({ 
        success: false, 
        error: 'Configuration key is required' 
      });
    }
    
    // Handle different config keys
    if (key === 'debug') {
      const debugValue = value === 'on' || value === true;
      ConfigManager.setDebug(debugValue);
    } else if (key === 'baseRepositoryPath') {
      if (value) {
        ConfigManager.setBaseRepositoryPath(value);
      }
    } else if (key === 'automationPath') {
      if (value) {
        ConfigManager.setAutomationPath(value);
      }
    } else if (key === 'baseBranch') {
      ConfigManager.setBaseBranch(value || 'develop');
    } else if (key === 'copilotModel') {
      ConfigManager.setCopilotModel(value || 'gpt-4o');
    } else if (key === 'ticketCommandPrompt') {
      ConfigManager.setTicketCommandPrompt(value || '');
    } else if (key === 'ticketResolutionPrompt') {
      ConfigManager.setTicketResolutionPrompt(value || '');
    } else {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid configuration key' 
      });
    }
    
    const config = ConfigManager.getConfig();
    res.json({ success: true, config });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// GET /api/config/models - Get available Copilot models
router.get('/models', async (req: Request, res: Response) => {
  try {
    const models = await CopilotModelsManager.getAvailableModels();
    res.json({ success: true, models });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// POST /api/config/models/refresh - Refresh models cache
router.post('/models/refresh', async (req: Request, res: Response) => {
  try {
    CopilotModelsManager.clearCache();
    const models = await CopilotModelsManager.getAvailableModels();
    res.json({ success: true, models });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

export default router;
