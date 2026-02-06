import { CopilotClient } from '@github/copilot-sdk';
import chalk from 'chalk';

export interface CopilotModel {
  id: string;
  name: string;
  description?: string;
}

export class CopilotModelsManager {
  private static cachedModels: CopilotModel[] | null = null;

  /**
   * Get available Copilot models from GitHub Copilot SDK
   */
  static async getAvailableModels(): Promise<CopilotModel[]> {
    // Return cached models if available
    if (this.cachedModels) {
      return this.cachedModels;
    }

    try {
      console.log(chalk.blue('🔍 Fetching available Copilot models...'));
      
      const client = new CopilotClient();
      await client.start();
      
      // Get models from SDK
      const models = await client.listModels();
      
      await client.stop();

      // Transform SDK models to our format
      this.cachedModels = models.map(model => ({
        id: model.id || model.name,
        name: model.name,
        description: (model as any).description || undefined
      }));

      console.log(chalk.green(`✓ Found ${this.cachedModels.length} available models`));
      
      return this.cachedModels;
    } catch (error) {
      console.error(chalk.yellow('⚠️  Failed to fetch models from SDK, using fallback list'));
      
      // Fallback list of common models if SDK fails
      this.cachedModels = [
        { id: 'gpt-5', name: 'GPT-5', description: 'Latest GPT model' },
        { id: 'gpt-5-mini', name: 'GPT-5 Mini', description: 'Fast and efficient' },
        { id: 'gpt-4.1', name: 'GPT-4.1', description: 'Fast and reliable' },
        { id: 'gpt-4o', name: 'GPT-4o', description: 'GPT-4 Optimized' },
        { id: 'gpt-4', name: 'GPT-4', description: 'Powerful reasoning' },
        { id: 'claude-sonnet-4.5', name: 'Claude Sonnet 4.5', description: 'Anthropic Claude' },
        { id: 'claude-opus-4.5', name: 'Claude Opus 4.5', description: 'Most capable Claude' },
        { id: 'o1', name: 'OpenAI o1', description: 'Reasoning model' },
        { id: 'o1-mini', name: 'OpenAI o1-mini', description: 'Faster reasoning' }
      ];
      
      return this.cachedModels;
    }
  }

  /**
   * Clear cached models (useful for refreshing)
   */
  static clearCache(): void {
    this.cachedModels = null;
  }

  /**
   * Validate if a model ID is valid
   */
  static async isValidModel(modelId: string): Promise<boolean> {
    const models = await this.getAvailableModels();
    return models.some(model => model.id === modelId);
  }
}
