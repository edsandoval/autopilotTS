import { CopilotClient } from '@github/copilot-sdk';
import chalk from 'chalk';
import { CopilotResponse } from '../types/index.js';
import { ConfigManager } from './config.js';

export class CopilotAgent {
  private client: CopilotClient;

  constructor() {
    // GitHub Copilot SDK uses your CLI authentication automatically
    this.client = new CopilotClient();
  }

  private debugLog(type: 'request' | 'response', content: string): void {
    if (ConfigManager.isDebugEnabled()) {
      if (type === 'request') {
        console.log(chalk.gray('📤 Request to GitHub Copilot:'));
        console.log(chalk.hex('#B0B0B0')(content)); // Gris claro
      } else {
        console.log(chalk.gray('📥 Response from GitHub Copilot:'));
        console.log(chalk.hex('#707070')(content)); // Gris oscuro
      }
      console.log(); // Línea en blanco para separación
    }
  }

  async generateCode(
    ticketId: string,
    description: string,
    additionalContext?: string
  ): Promise<CopilotResponse> {
    try {
      console.log(chalk.blue('⏳ Calling GitHub Copilot to generate code...'));

      await this.client.start();
      const session = await this.client.createSession({
        model: 'gpt-5'
      });

      const prompt = this.buildPrompt(ticketId, description, additionalContext);

      this.debugLog('request', prompt);

      let fullResponse = '';
      const done = new Promise<void>((resolve) => {
        session.on((event) => {
          if (event.type === 'assistant.message') {
            fullResponse += event.data.content;
          } else if (event.type === 'session.idle') {
            resolve();
          }
        });
      });

      await session.send({ prompt });
      await done;

      this.debugLog('response', fullResponse);

      await session.destroy();
      await this.client.stop();

      console.log(chalk.green('✓ GitHub Copilot completed successfully'));
      
      return {
        success: true,
        message: fullResponse,
        changes: this.extractCodeBlocks(fullResponse)
      };

    } catch (error) {
      console.error(chalk.red('✗ Error calling GitHub Copilot:'), error);
      
      return {
        success: false,
        message: 'Failed to generate code',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async analyzeTicket(prompt: string): Promise<CopilotResponse> {
    try {
      await this.client.start();
      const session = await this.client.createSession({
        model: 'gpt-5'
      });

      this.debugLog('request', prompt);

      let fullResponse = '';
      const done = new Promise<void>((resolve) => {
        session.on((event) => {
          if (event.type === 'assistant.message') {
            fullResponse += event.data.content;
          } else if (event.type === 'session.idle') {
            resolve();
          }
        });
      });

      await session.send({ prompt });
      await done;

      this.debugLog('response', fullResponse);

      await session.destroy();
      await this.client.stop();

      return {
        success: true,
        message: fullResponse
      };

    } catch (error) {
      console.error(chalk.red('✗ Error during analysis:'), error);
      
      return {
        success: false,
        message: 'Failed to analyze ticket',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private buildPrompt(
    ticketId: string,
    description: string,
    additionalContext?: string
  ): string {
    return `You are an expert software developer working on a ticket resolution system.

Ticket ID: ${ticketId}
Description: ${description}
${additionalContext ? `Additional Context: ${additionalContext}` : ''}

Please provide:
1. A complete implementation plan
2. Code files needed (with full code)
3. Any configuration changes required
4. Step-by-step implementation instructions

Format your response with clear sections and code blocks for each file.`;
  }

  private extractCodeBlocks(text: string): string[] {
    const codeBlockRegex = /```[\s\S]*?```/g;
    const matches = text.match(codeBlockRegex);
    return matches || [];
  }

  async chat(
    message: string, 
    conversationHistory: Array<{ role: 'user' | 'assistant', content: string }>
  ): Promise<string> {
    try {
      this.debugLog('request', message);

      await this.client.start();
      const session = await this.client.createSession({
        model: 'gpt-5'
      });

      let fullResponse = '';
      const done = new Promise<void>((resolve) => {
        session.on((event) => {
          if (event.type === 'assistant.message') {
            fullResponse += event.data.content;
          } else if (event.type === 'session.idle') {
            resolve();
          }
        });
      });

      // For conversation history, we'd need to send multiple messages
      // For now, sending just the current message
      await session.send({ prompt: message });
      await done;

      this.debugLog('response', fullResponse);

      await session.destroy();
      await this.client.stop();

      return fullResponse;

    } catch (error) {
      console.error(chalk.red('✗ Chat error:'), error);
      return 'Error: Failed to get response from GitHub Copilot';
    }
  }

  async streamResponse(
    message: string,
    onChunk: (text: string) => void
  ): Promise<void> {
    try {
      this.debugLog('request', message);

      await this.client.start();
      const session = await this.client.createSession({
        model: 'gpt-5'
      });

      let fullResponse = '';
      const done = new Promise<void>((resolve) => {
        session.on((event) => {
          if (event.type === 'assistant.message') {
            const content = event.data.content;
            fullResponse += content;
            onChunk(content);
          } else if (event.type === 'session.idle') {
            resolve();
          }
        });
      });

      await session.send({ prompt: message });
      await done;

      this.debugLog('response', fullResponse);

      await session.destroy();
      await this.client.stop();

    } catch (error) {
      console.error(chalk.red('✗ Stream error:'), error);
      onChunk('\nError: Failed to stream response from GitHub Copilot');
    }
  }

  /**
   * Generate commit message based on changes
   */
  async generateCommitMessage(diff: string, ticketId: string): Promise<string> {
    try {
      console.log(chalk.blue('🤖 Generating commit message with GitHub Copilot SDK...'));

      await this.client.start();
      const session = await this.client.createSession({
        model: 'gpt-5'
      });

      const prompt = `You are a git commit message generator. Based on the following git diff, generate a concise commit message in English.

RULES:
- Maximum 60 characters
- Be specific about what changed
- Use imperative mood (e.g., "Add feature" not "Added feature")
- Focus on WHAT changed, not HOW
- Do NOT include the ticket ID (it will be added automatically)
- Do NOT include prefixes like [feat], [fix], etc. (they will be added automatically)
- Return ONLY the commit message, nothing else

GIT DIFF:
${diff.substring(0, 3000)}

Generate the commit message:`;

      this.debugLog('request', prompt);

      let fullResponse = '';
      const done = new Promise<void>((resolve) => {
        session.on((event) => {
          if (event.type === 'assistant.message') {
            fullResponse += event.data.content;
          } else if (event.type === 'session.idle') {
            resolve();
          }
        });
      });

      await session.send({ prompt });
      await done;

      this.debugLog('response', fullResponse);

      await session.destroy();
      await this.client.stop();

      // Clean up response (remove quotes, trim, etc.)
      let message = fullResponse.trim();
      message = message.replace(/^["']|["']$/g, ''); // Remove quotes
      message = message.split('\n')[0]; // Take only first line
      message = message.substring(0, 60); // Max 60 chars

      console.log(chalk.green(`✓ Generated message: ${message}`));

      return message;

    } catch (error) {
      console.log(chalk.yellow('⚠️  Failed to generate commit message, using default'));
      return `Implement functionality for task`;
    }
  }

  /**
   * Generate HTML summary of ticket changes in Spanish
   */
  async generateTicketSummary(ticketId: string, diff: string, commitMessage?: string): Promise<string> {
    try {
      console.log(chalk.blue('📊 Generando resumen del ticket...'));

      await this.client.start();
      const session = await this.client.createSession({
        model: 'gpt-5'
      });

      const prompt = `Eres un asistente que genera resúmenes técnicos en HTML de cambios realizados en tickets de desarrollo.

TICKET ID: ${ticketId}
${commitMessage ? `COMMIT MESSAGE: ${commitMessage}` : ''}

GIT DIFF:
${diff.substring(0, 8000)}

Genera un resumen completo en HTML (sin etiquetas <html>, <head> o <body>, solo el contenido) que incluya:

1. **Resumen Ejecutivo**: Breve descripción de los cambios realizados
2. **Archivos Modificados**: Lista de archivos con el tipo de cambio (creado/modificado/eliminado)
3. **Clases y Métodos**: Detalle de clases nuevas o modificadas, métodos agregados/modificados
4. **Cambios Lógicos**: Nuevas condicionales, bucles, validaciones agregadas
5. **Dependencias**: Nuevas librerías o dependencias agregadas/eliminadas
6. **Configuración**: Cambios en archivos de configuración

IMPORTANTE:
- Todo el texto debe estar en español
- Usa HTML semántico con estilos inline para mejor visualización
- Usa colores profesionales: verde para agregados (#4CAF50), rojo para eliminados (#f44336), azul para modificados (#2196F3)
- Usa iconos Unicode donde sea apropiado (✓, ✗, ⚡, 📝, 🔧, etc.)
- Si no hay cambios en alguna categoría, omítela del resumen
- Sé específico con nombres de clases, métodos y archivos
- Formato limpio y fácil de leer
- El Resumen Ejecutivo debe usar texto en color blanco (#FFFFFF) para máxima legibilidad sobre fondo oscuro
- Los archivos modificados NO deben tener fondo blanco, usar fondo transparente o tonos oscuros sutiles
- Las rutas de archivos deben usar colores más visibles, como azul claro (#64B5F6) o cyan (#00BCD4), NO azules muy tenues

Genera el HTML:`;

      this.debugLog('request', prompt);

      let fullResponse = '';
      const done = new Promise<void>((resolve) => {
        session.on((event) => {
          if (event.type === 'assistant.message') {
            fullResponse += event.data.content;
          } else if (event.type === 'session.idle') {
            resolve();
          }
        });
      });

      await session.send({ prompt });
      await done;

      this.debugLog('response', fullResponse);

      await session.destroy();
      await this.client.stop();

      // Extract HTML from response (remove markdown code blocks if present)
      let html = fullResponse.trim();
      
      // Remove ```html and ``` markers if present
      html = html.replace(/^```html\s*/i, '');
      html = html.replace(/^```\s*/, '');
      html = html.replace(/```\s*$/, '');
      html = html.trim();

      console.log(chalk.green('✓ Resumen generado exitosamente'));

      return html;

    } catch (error) {
      console.log(chalk.yellow('⚠️  No se pudo generar el resumen'));
      
      // Return a basic HTML summary as fallback
      return `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2 style="color: #f44336;">❌ Error al generar resumen</h2>
          <p>No se pudo generar el resumen automático para el ticket ${ticketId}.</p>
          <p style="color: #666; font-size: 14px;">Error: ${error instanceof Error ? error.message : 'Error desconocido'}</p>
        </div>
      `;
    }
  }
}