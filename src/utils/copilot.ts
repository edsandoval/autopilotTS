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
   * Generate HTML summary of ticket changes
   */
  async generateTicketSummary(ticketId: string, diff: string, commitMessage?: string): Promise<string> {
    try {
      console.log(chalk.blue('📊 Generando resumen del ticket...'));

      const reportLanguage = ConfigManager.getReportLanguage();
      
      // Language-specific configurations
      const languageConfig: Record<string, { name: string, prompt: string }> = {
        'en': {
          name: 'English',
          prompt: `You are an assistant that generates technical summaries in HTML of changes made in development tickets.

TICKET ID: ${ticketId}
${commitMessage ? `COMMIT MESSAGE: ${commitMessage}` : ''}

GIT DIFF:
${diff.substring(0, 8000)}

Generate a complete summary in HTML (without <html>, <head> or <body> tags, only the content) that includes:

1. **Executive Summary**: Brief description of the changes made
2. **Modified Files**: List of files with type of change (created/modified/deleted)
3. **Classes and Methods**: Detail of new or modified classes, added/modified methods
4. **Logical Changes**: New conditionals, loops, validations added
5. **Dependencies**: New libraries or dependencies added/removed
6. **Configuration**: Changes to configuration files

IMPORTANT:
- All text must be in English
- Use semantic HTML with inline styles for better visualization
- Use professional colors: green for added (#4CAF50), red for deleted (#f44336), blue for modified (#2196F3)
- Use Unicode icons where appropriate (✓, ✗, ⚡, 📝, 🔧, etc.)
- If there are no changes in a category, omit it from the summary
- Be specific with class, method and file names
- Clean and easy to read format
- The Executive Summary must use white text (#FFFFFF) for maximum readability on dark background
- Modified files should NOT have white background, use transparent or subtle dark tones
- File paths should use more visible colors, like light blue (#64B5F6) or cyan (#00BCD4), NOT very faint blues

Generate the HTML:`
        },
        'es': {
          name: 'Español',
          prompt: `Eres un asistente que genera resúmenes técnicos en HTML de cambios realizados en tickets de desarrollo.

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

Genera el HTML:`
        },
        'zh': {
          name: '中文',
          prompt: `你是一个生成开发工单变更技术摘要的HTML助手。

工单编号: ${ticketId}
${commitMessage ? `提交信息: ${commitMessage}` : ''}

GIT DIFF:
${diff.substring(0, 8000)}

生成一个完整的HTML摘要（不包含<html>、<head>或<body>标签，仅包含内容），包括：

1. **执行摘要**：简要描述所做的更改
2. **修改的文件**：包含更改类型的文件列表（创建/修改/删除）
3. **类和方法**：新增或修改的类的详细信息，添加/修改的方法
4. **逻辑变更**：添加的新条件、循环、验证
5. **依赖项**：添加/删除的新库或依赖项
6. **配置**：配置文件的更改

重要提示：
- 所有文本必须使用中文
- 使用带内联样式的语义HTML以获得更好的可视化效果
- 使用专业色彩：绿色表示添加（#4CAF50），红色表示删除（#f44336），蓝色表示修改（#2196F3）
- 在适当的地方使用Unicode图标（✓、✗、⚡、📝、🔧等）
- 如果某个类别没有变更，则在摘要中省略它
- 具体说明类、方法和文件名
- 格式清晰易读
- 执行摘要必须使用白色文本（#FFFFFF）以在深色背景上获得最大可读性
- 修改的文件不应有白色背景，使用透明或柔和的深色调
- 文件路径应使用更明显的颜色，如浅蓝色（#64B5F6）或青色（#00BCD4），而不是非常微弱的蓝色

生成HTML：`
        },
        'pt': {
          name: 'Português',
          prompt: `Você é um assistente que gera resumos técnicos em HTML de alterações realizadas em tickets de desenvolvimento.

ID DO TICKET: ${ticketId}
${commitMessage ? `MENSAGEM DO COMMIT: ${commitMessage}` : ''}

GIT DIFF:
${diff.substring(0, 8000)}

Gere um resumo completo em HTML (sem tags <html>, <head> ou <body>, apenas o conteúdo) que inclua:

1. **Resumo Executivo**: Breve descrição das alterações realizadas
2. **Arquivos Modificados**: Lista de arquivos com tipo de alteração (criado/modificado/excluído)
3. **Classes e Métodos**: Detalhes de classes novas ou modificadas, métodos adicionados/modificados
4. **Mudanças Lógicas**: Novos condicionais, loops, validações adicionadas
5. **Dependências**: Novas bibliotecas ou dependências adicionadas/removidas
6. **Configuração**: Alterações em arquivos de configuração

IMPORTANTE:
- Todo o texto deve estar em português
- Use HTML semântico com estilos inline para melhor visualização
- Use cores profissionais: verde para adicionado (#4CAF50), vermelho para excluído (#f44336), azul para modificado (#2196F3)
- Use ícones Unicode onde apropriado (✓, ✗, ⚡, 📝, 🔧, etc.)
- Se não houver alterações em alguma categoria, omita-a do resumo
- Seja específico com nomes de classes, métodos e arquivos
- Formato limpo e fácil de ler
- O Resumo Executivo deve usar texto em cor branca (#FFFFFF) para máxima legibilidade sobre fundo escuro
- Os arquivos modificados NÃO devem ter fundo branco, use fundo transparente ou tons escuros sutis
- Os caminhos de arquivos devem usar cores mais visíveis, como azul claro (#64B5F6) ou ciano (#00BCD4), NÃO azuis muito tênues

Gere o HTML:`
        },
        'fr': {
          name: 'Français',
          prompt: `Vous êtes un assistant qui génère des résumés techniques en HTML des modifications apportées aux tickets de développement.

ID DU TICKET: ${ticketId}
${commitMessage ? `MESSAGE DE COMMIT: ${commitMessage}` : ''}

GIT DIFF:
${diff.substring(0, 8000)}

Générez un résumé complet en HTML (sans balises <html>, <head> ou <body>, uniquement le contenu) qui inclut:

1. **Résumé Exécutif**: Brève description des modifications effectuées
2. **Fichiers Modifiés**: Liste des fichiers avec type de modification (créé/modifié/supprimé)
3. **Classes et Méthodes**: Détails des classes nouvelles ou modifiées, méthodes ajoutées/modifiées
4. **Changements Logiques**: Nouveaux conditionnels, boucles, validations ajoutées
5. **Dépendances**: Nouvelles bibliothèques ou dépendances ajoutées/supprimées
6. **Configuration**: Modifications des fichiers de configuration

IMPORTANT:
- Tout le texte doit être en français
- Utilisez du HTML sémantique avec des styles inline pour une meilleure visualisation
- Utilisez des couleurs professionnelles: vert pour ajouté (#4CAF50), rouge pour supprimé (#f44336), bleu pour modifié (#2196F3)
- Utilisez des icônes Unicode le cas échéant (✓, ✗, ⚡, 📝, 🔧, etc.)
- S'il n'y a pas de changements dans une catégorie, omettez-la du résumé
- Soyez précis avec les noms de classes, méthodes et fichiers
- Format propre et facile à lire
- Le Résumé Exécutif doit utiliser du texte en couleur blanche (#FFFFFF) pour une lisibilité maximale sur fond sombre
- Les fichiers modifiés NE doivent PAS avoir de fond blanc, utilisez un fond transparent ou des tons sombres subtils
- Les chemins de fichiers doivent utiliser des couleurs plus visibles, comme le bleu clair (#64B5F6) ou le cyan (#00BCD4), PAS de bleus très pâles

Générez le HTML:`
        }
      };

      const config = languageConfig[reportLanguage] || languageConfig['en'];
      const prompt = config.prompt;

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