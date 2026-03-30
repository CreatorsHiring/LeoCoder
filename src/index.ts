#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import { config as dotenvConfig } from 'dotenv';
import ora from 'ora';

import { OllamaProvider, LMStudioProvider, GroqProvider, GeminiProvider } from './providers';
import { SmartRouter } from './utils/router';
import { FileSystemTools } from './tools/filesystem';
import { ShellTools } from './tools/shell';

// Load environment variables
dotenvConfig();

// Animation frames for thinking indicator
const THINKING_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const LION_COLORS = [
  chalk.hex('#FF8C00'),  // Dark orange
  chalk.hex('#FFA500'),  // Orange
  chalk.hex('#FFB347'),  // Pastel orange
  chalk.hex('#FFD700'),  // Gold
  chalk.hex('#FFA500'),  // Orange
  chalk.hex('#FF8C00'),  // Dark orange
];

// Lion gradient text helper
function lionGradient(text: string): string {
  const chars = text.split('');
  return chars.map((char, i) => LION_COLORS[i % LION_COLORS.length](char)).join('');
}

const program = new Command();

program
  .name('leocoder')
  .description('LeoCoder - Smart LLM router for vibe coding')
  .version('0.1.0');

program
  .command('chat')
  .description('Start an interactive chat session')
  .option('-l, --local-only', 'Use only local models')
  .option('-c, --cloud-only', 'Use only cloud models')
  .option('-m, --model <model>', 'Specify model to use')
  .action(async (options) => {
    await runChatSession(options);
  });

program
  .command('ask <prompt>')
  .description('Ask a single question')
  .option('-l, --local-only', 'Use only local models')
  .option('-c, --cloud-only', 'Use only cloud models')
  .action(async (prompt, options) => {
    await runSingleQuestion(prompt, options);
  });

program
  .command('status')
  .description('Check available providers and models')
  .action(async () => {
    await showStatus();
  });

program
  .command('config')
  .description('Show current configuration')
  .action(() => {
    showConfig();
  });

program.parse();

/**
 * Display new improved header with LEO in lion gradient and model on the right
 */
function displayNewHeader(modelName: string): void {
  const width = 80;
  const modelText = `(${modelName})`;

  console.log();
  
  // Large LEO text using block letters - properly formatted
  const leoLines = [
    chalk.hex('#FFD700')('██') + chalk.hex('#FFA500')('█') + chalk.hex('#FF8C00')('█') + chalk.hex('#FFD700')('      ') + chalk.hex('#FFD700')('██████') + chalk.hex('#FFA500')('██') + chalk.hex('#FF8C00')('      ') + chalk.hex('#FFD700')(' ██████ ') + chalk.hex('#FFD700')('       ') + chalk.gray(modelText),
    chalk.hex('#FFD700')('██') + chalk.hex('#FFA500')('█') + chalk.hex('#FF8C00')('█') + chalk.hex('#FFD700')('      ') + chalk.hex('#FFD700')('██') + chalk.hex('#FFA500')('    ██') + chalk.hex('#FF8C00')('      ') + chalk.hex('#FFD700')('██') + chalk.hex('#FFA500')('    ██') + chalk.hex('#FFD700')('       ') + chalk.gray('Smart LLM Router for Vibe Coding'),
    chalk.hex('#FFD700')('██') + chalk.hex('#FFA500')('█') + chalk.hex('#FF8C00')('█') + chalk.hex('#FFD700')('      ') + chalk.hex('#FFD700')('██████') + chalk.hex('#FFA500')('██') + chalk.hex('#FF8C00')('      ') + chalk.hex('#FFD700')('██') + chalk.hex('#FFA500')('    ██') + chalk.hex('#FFD700')('       ') + chalk.gray('Local-First • Cloud Fallback • Token Saver'),
    chalk.hex('#FFD700')('██') + chalk.hex('#FFA500')('█') + chalk.hex('#FF8C00')('█') + chalk.hex('#FFD700')('      ') + chalk.hex('#FFD700')('██') + chalk.hex('#FFA500')('    ██') + chalk.hex('#FF8C00')('      ') + chalk.hex('#FFD700')('██') + chalk.hex('#FFA500')('    ██') + chalk.hex('#FFD700')(''),
    chalk.hex('#FFD700')('██') + chalk.hex('#FFA500')('█') + chalk.hex('#FF8C00')('█') + chalk.hex('#FFD700')('      ') + chalk.hex('#FFD700')('██████') + chalk.hex('#FFA500')('██') + chalk.hex('#FF8C00')('      ') + chalk.hex('#FFD700')(' ██████ '),
    chalk.hex('#FFD700')('████████') + chalk.hex('#FFD700')('      ') + chalk.hex('#FFD700')('██') + chalk.hex('#FFA500')('    ██') + chalk.hex('#FFD700')('      ') + chalk.hex('#FFD700')('██') + chalk.hex('#FFA500')('    ██'),
    chalk.hex('#FFD700')('        ') + chalk.hex('#FFD700')(' ██████ ') + chalk.hex('#FFD700')('       ') + chalk.hex('#FFD700')(' ██████ '),
  ];
  
  for (const line of leoLines) {
    console.log(line);
  }
  
  console.log();
  console.log(chalk.hex('#FFA500')('─'.repeat(width)));
  
  // Commands section
  const commands = chalk.cyan('/help') + chalk.gray('  |  ') + chalk.cyan('/models') + chalk.gray('  |  ') + chalk.cyan('/stats') + chalk.gray('  |  ') + chalk.green('exit');
  console.log(chalk.gray('Commands:  ') + commands);
  console.log(chalk.hex('#FFA500')('─'.repeat(width)));
  console.log();
}

/**
 * Display full welcome banner
 */
function displayWelcomeBanner(modelName: string, providers: { local?: string; cloud?: string }): void {
  console.clear();
  displayNewHeader(modelName);
}

/**
 * Format and display assistant message
 */
function displayAssistantMessage(content: string, provider: string): void {
  const isLocal = provider === 'ollama' || provider === 'lmstudio';
  const badge = isLocal 
    ? chalk.green.bold('[LOCAL]') 
    : chalk.yellow.bold('[CLOUD]');
  
  console.log(chalk.blue.bold('┌─ ') + chalk.cyan.bold('LEOCODER') + ' ' + badge);
  console.log(chalk.blue('│'));
  
  const wrappedLines = wrapText(content, 60);
  for (const line of wrappedLines) {
    console.log(chalk.blue('│ ') + chalk.white(line));
  }
  console.log(chalk.blue('└─' + '─'.repeat(60)));
  console.log();
}

/**
 * Wrap text to fit within width
 */
function wrapText(text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  const paragraphs = text.split('\n');
  
  for (const paragraph of paragraphs) {
    if (paragraph.length <= maxWidth) {
      lines.push(paragraph);
    } else {
      const words = paragraph.split(' ');
      let currentLine = '';
      
      for (const word of words) {
        if ((currentLine + word).length <= maxWidth) {
          currentLine += (currentLine ? ' ' : '') + word;
        } else {
          if (currentLine) lines.push(currentLine);
          currentLine = word;
        }
      }
      
      if (currentLine) lines.push(currentLine);
    }
  }
  
  return lines;
}

/**
 * Display thinking indicator with animation
 */
let thinkingSpinner: ora.Ora | null = null;

function displayThinking(): void {
  thinkingSpinner = ora({
    text: chalk.blue('Thinking...'),
    spinner: 'dots',
    color: 'cyan',
  }).start();
}

function stopThinking(): void {
  if (thinkingSpinner) {
    thinkingSpinner.stop();
    thinkingSpinner = null;
  }
}

/**
 * Main chat session
 */
async function runChatSession(options: any) {
  const { router, fsTools, shellTools, modelName, providers } = await initializeProviders(options);

  displayWelcomeBanner(modelName, providers);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Handle Ctrl+C
  rl.on('SIGINT', () => {
    stopThinking();
    showFinalStats(router);
    rl.close();
    process.exit(0);
  });

  const conversationHistory: any[] = [];
  let currentFile: string | undefined;

  const prompt = () => {
    const fileIndicator = currentFile ? chalk.yellow('[' + currentFile + '] ') : '';

    console.log();
    rl.question(chalk.green.bold(fileIndicator + '> '), async (answer) => {
      await handleInput(answer, conversationHistory);
      prompt();
    });
  };

  const handleInput = async (input: string, history: any[]) => {
    const trimmed = input.trim();

    if (!trimmed) {
      prompt();
      return;
    }

    // Handle commands
    if (trimmed.startsWith('/')) {
      await handleCommand(trimmed, router, fsTools, shellTools);
      prompt();
      return;
    }

    // Handle special keywords
    if (['exit', 'quit', 'bye'].includes(trimmed.toLowerCase())) {
      showFinalStats(router);
      rl.close();
      process.exit(0);
    }

    if (trimmed.toLowerCase() === 'stats') {
      showStats(router);
      prompt();
      return;
    }

    if (trimmed.toLowerCase() === 'help') {
      showHelp();
      prompt();
      return;
    }

    // Regular message - send to router
    try {
      displayThinking();

      const context = currentFile ? {
        filePath: currentFile,
        selectedCode: fsTools.readFile(currentFile, { maxLines: 50 }).then(r => r.success ? r.content : undefined).catch(() => undefined),
      } : undefined;

      const response = await router.generate(trimmed, {
        context: context as any,
        systemPrompt: 'You are a helpful coding assistant. Provide concise, practical answers for coding tasks.',
      });

      stopThinking();
      displayAssistantMessage(response.text, response.provider);

      history.push({ role: 'user', content: trimmed });
      history.push({ role: 'assistant', content: response.text });

    } catch (error: any) {
      stopThinking();
      console.log(chalk.red.bold('\n┌─ ERROR'));
      console.log(chalk.red('│'));
      console.log(chalk.red('│ ' + error.message));
      console.log(chalk.red('└─' + '─'.repeat(40)));
      console.log();
    }

    prompt();
  };

  const handleCommand = async (cmd: string, router: SmartRouter, fsTools: FileSystemTools, shellTools: ShellTools) => {
    const parts = cmd.split(' ');
    const command = parts[0].toLowerCase();

    console.log();

    switch (command) {
      case '/file':
      case '/open':
        if (parts[1]) {
          currentFile = parts[1];
          const result = await fsTools.readFile(currentFile);
          if (result.success) {
            console.log(chalk.green('✓ Opened: ') + currentFile);
            console.log(chalk.gray(result.content!.slice(0, 500) + (result.content!.length > 500 ? '...' : '')));
          } else {
            console.log(chalk.red('✗ ' + result.error));
          }
        } else {
          console.log(chalk.yellow('Usage: /file <path>'));
        }
        break;

      case '/read':
        if (parts[1]) {
          const result = await fsTools.readFile(parts[1]);
          if (result.success) {
            console.log(chalk.cyan('\nFile Contents:'));
            console.log(chalk.white(result.content!));
          } else {
            console.log(chalk.red('✗ ' + result.error));
          }
        } else {
          console.log(chalk.yellow('Usage: /read <path>'));
        }
        break;

      case '/search':
        const searchPattern = parts.slice(1).join(' ');
        if (searchPattern) {
          const results = await fsTools.searchInFiles(searchPattern, { maxResults: 10 });
          if (results.length > 0) {
            console.log(chalk.cyan('\nSearch Results:'));
            results.forEach(r => {
              console.log(chalk.gray(r.file + ':' + r.line));
              console.log(chalk.white('  ' + r.content));
            });
          } else {
            console.log(chalk.yellow('No matches found'));
          }
        } else {
          console.log(chalk.yellow('Usage: /search <pattern>'));
        }
        break;

      case '/run':
        const shellCmd = parts.slice(1).join(' ');
        if (shellCmd) {
          await shellTools.execute(shellCmd, { streamOutput: true });
        } else {
          console.log(chalk.yellow('Usage: /run <command>'));
        }
        break;

      case '/models':
        const activeProviders = router.getActiveProviders();
        console.log(chalk.cyan('\nActive Providers:'));
        console.log(chalk.white('  Local: ' + (activeProviders.local || 'None')));
        console.log(chalk.white('  Cloud: ' + (activeProviders.cloud || 'None')));
        break;

      case '/stats':
        showStats(router);
        break;

      case '/help':
        showHelp();
        break;

      default:
        console.log(chalk.yellow('Unknown command: ' + command + '. Type /help for available commands.'));
    }
    console.log();
  };

  prompt();
}

/**
 * Single question mode
 */
async function runSingleQuestion(promptText: string, options: any) {
  const { router, modelName, providers } = await initializeProviders(options);

  displayWelcomeBanner(modelName, providers);

  try {
    displayThinking();

    const response = await router.generate(promptText, {
      systemPrompt: 'You are a helpful coding assistant.',
    });

    stopThinking();
    displayAssistantMessage(response.text, response.provider);

    const stats = router.getStats();
    console.log(chalk.gray('  Tokens: ' + (stats.cloudTokens > 0 ? stats.cloudTokens : stats.localTokens) + ' (' + (stats.cloudTokens > 0 ? 'cloud' : 'local') + ')'));
    console.log();
  } catch (error: any) {
    stopThinking();
    console.log(chalk.red.bold('\n┌─ ERROR'));
    console.log(chalk.red('│'));
    console.log(chalk.red('│ ' + error.message));
    console.log(chalk.red('└─' + '─'.repeat(40)));
    console.log();
    process.exit(1);
  }
}

/**
 * Show provider status
 */
async function showStatus() {
  console.clear();
  displayNewHeader('checking...');
  console.log();
  console.log(chalk.cyan.bold('PROVIDER STATUS'));
  console.log(chalk.cyan('─'.repeat(70)));
  console.log();

  // Check local providers
  console.log(chalk.green.bold('Local Providers:'));
  console.log();

  const ollama = new OllamaProvider();
  const ollamaAvailable = await ollama.isAvailable();
  console.log('  ' + (ollamaAvailable ? chalk.green('✓') : chalk.red('✗')) + ' Ollama (http://localhost:11434)');
  if (ollamaAvailable) {
    const models = await ollama.listModels();
    console.log(chalk.gray('    Models: ' + (models.join(', ') || 'None')));
  }

  const lmstudio = new LMStudioProvider();
  const lmstudioAvailable = await lmstudio.isAvailable();
  console.log('  ' + (lmstudioAvailable ? chalk.green('✓') : chalk.red('✗')) + ' LM Studio (http://localhost:1234)');
  if (lmstudioAvailable) {
    const models = await lmstudio.listModels();
    console.log(chalk.gray('    Models: ' + (models.join(', ') || 'None')));
  }

  // Check cloud providers
  console.log();
  console.log(chalk.yellow.bold('Cloud Providers:'));
  console.log();
  
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    const groq = new GroqProvider(groqKey);
    const groqAvailable = await groq.isAvailable();
    console.log('  ' + (groqAvailable ? chalk.green('✓') : chalk.red('✗')) + ' Groq');
  } else {
    console.log(chalk.yellow('  [!] Groq - API key not set'));
    console.log(chalk.gray('      Get free key: https://console.groq.com/keys'));
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    const gemini = new GeminiProvider(geminiKey);
    const geminiAvailable = await gemini.isAvailable();
    console.log('  ' + (geminiAvailable ? chalk.green('✓') : chalk.red('✗')) + ' Gemini');
  } else {
    console.log(chalk.yellow('  [!] Gemini - API key not set'));
    console.log(chalk.gray('      Get free key: https://makersuite.google.com/app/apikey'));
  }

  console.log();
  console.log(chalk.cyan('─'.repeat(70)));
  console.log();
}

/**
 * Show configuration
 */
function showConfig() {
  console.clear();
  displayNewHeader('config');
  console.log();

  const configPath = path.join(process.cwd(), 'config.yaml');

  if (fs.existsSync(configPath)) {
    const configContent = fs.readFileSync(configPath, 'utf-8');
    console.log(chalk.cyan.bold('CONFIGURATION'));
    console.log(chalk.cyan('─'.repeat(70)));
    console.log();
    console.log(chalk.gray(configContent));
  } else {
    console.log(chalk.yellow('No config.yaml found in current directory'));
  }
  console.log();
}

/**
 * Initialize providers
 */
async function initializeProviders(options: any) {
  const localProviders: any[] = [];
  const cloudProviders: any[] = [];
  let localModel = 'qwen2.5:1.5b';
  let activeLocal: string | undefined;
  let activeCloud: string | undefined;

  // Setup local providers
  if (!options.cloudOnly) {
    const ollama = new OllamaProvider();
    localProviders.push(ollama);
    
    // Try to detect available model
    if (await ollama.isAvailable()) {
      const models = await ollama.listModels();
      if (models.length > 0) {
        localModel = models[0];
        activeLocal = ollama.name;
      }
    }
    
    localProviders.push(new LMStudioProvider());
  }

  // Setup cloud providers
  if (!options.localOnly) {
    const groqKey = process.env.GROQ_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    if (groqKey) {
      cloudProviders.push(new GroqProvider(groqKey));
      activeCloud = 'groq';
    }
    if (geminiKey) {
      cloudProviders.push(new GeminiProvider(geminiKey));
      if (!activeCloud) activeCloud = 'gemini';
    }
  }

  const router = new SmartRouter({
    localProviders,
    cloudProviders,
    localModel,
    cloudModel: 'llama-3.1-8b-instant',
    complexityThreshold: 5,
    preferLocal: true,
    onRouteChange: () => {
      // Silent routing for cleaner UI
    },
  });

  await router.initialize();

  const fsTools = new FileSystemTools();
  const shellTools = new ShellTools();

  return { 
    router, 
    fsTools, 
    shellTools,
    modelName: localModel,
    providers: { local: activeLocal, cloud: activeCloud }
  };
}

/**
 * Show help
 */
function showHelp() {
  console.log();
  console.log(chalk.cyan.bold('AVAILABLE COMMANDS'));
  console.log(chalk.cyan('─'.repeat(70)));
  console.log();
  console.log(chalk.white('  ') + chalk.cyan('/file <path>') + chalk.gray('      - Open a file for context'));
  console.log(chalk.white('  ') + chalk.cyan('/read <path>') + chalk.gray('      - Read and display a file'));
  console.log(chalk.white('  ') + chalk.cyan('/search <pattern>') + chalk.gray(' - Search for pattern in files'));
  console.log(chalk.white('  ') + chalk.cyan('/run <command>') + chalk.gray('    - Run a shell command'));
  console.log(chalk.white('  ') + chalk.cyan('/models') + chalk.gray('           - Show active models'));
  console.log(chalk.white('  ') + chalk.cyan('/stats') + chalk.gray('            - Show token usage stats'));
  console.log(chalk.white('  ') + chalk.cyan('/help') + chalk.gray('             - Show this help'));
  console.log();
  console.log(chalk.gray('  ') + chalk.green('exit') + chalk.gray(' / ') + chalk.green('quit') + chalk.gray('       - End the session'));
  console.log();
  console.log(chalk.cyan('─'.repeat(70)));
  console.log();
}

/**
 * Show stats
 */
function showStats(router: SmartRouter) {
  const stats = router.getStats();
  
  console.log();
  console.log(chalk.cyan.bold('TOKEN USAGE STATISTICS'));
  console.log(chalk.cyan('─'.repeat(70)));
  console.log();
  
  console.log(chalk.green.bold('Local Usage:'));
  console.log(chalk.white('    Requests:  ' + stats.localRequests));
  console.log(chalk.white('    Tokens:    ' + stats.localTokens));
  console.log();
  
  console.log(chalk.yellow.bold('Cloud Usage:'));
  console.log(chalk.white('    Requests:  ' + stats.cloudRequests));
  console.log(chalk.white('    Tokens:    ' + stats.cloudTokens));
  console.log();
  
  console.log(chalk.green.bold('Savings:'));
  console.log(chalk.white('    Saved:     ~' + stats.tokensSaved + ' tokens (by using local)'));
  console.log();
  console.log(chalk.cyan('─'.repeat(70)));
  console.log();
}

/**
 * Show final stats on exit
 */
function showFinalStats(router: SmartRouter) {
  const stats = router.getStats();
  
  console.log();
  console.log(chalk.cyan('╔' + '═'.repeat(68) + '╗'));
  console.log(chalk.cyan('║') + chalk.bold.white('                         SESSION SUMMARY                          ') + chalk.cyan('║'));
  console.log(chalk.cyan('╚' + '═'.repeat(68) + '╝'));
  console.log();
  console.log(chalk.white('  Total requests:   ' + stats.totalRequests));
  console.log();
  console.log(chalk.green('  Local requests:   ' + stats.localRequests + ' (' + stats.localTokens + ' tokens)'));
  console.log(chalk.yellow('  Cloud requests:   ' + stats.cloudRequests + ' (' + stats.cloudTokens + ' tokens)'));
  console.log();
  console.log(chalk.green('  Estimated savings: ~' + stats.tokensSaved + ' tokens'));
  console.log();
  console.log(chalk.cyan('  Happy coding with LeoCoder!'));
  console.log();
}
