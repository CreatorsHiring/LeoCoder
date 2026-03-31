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

// ─── Qwen-style pixel font characters (5×7 grid using block chars) ───────────

const PIXEL_CHARS: Record<string, string[]> = {
  L: [
    '█░░░░',
    '█░░░░',
    '█░░░░',
    '█░░░░',
    '█░░░░',
    '█░░░░',
    '█████',
  ],
  E: [
    '█████',
    '█░░░░',
    '█░░░░',
    '████░',
    '█░░░░',
    '█░░░░',
    '█████',
  ],
  O: [
    '░███░',
    '█░░░█',
    '█░░░█',
    '█░░░█',
    '█░░░█',
    '█░░░█',
    '░███░',
  ],
  C: [
    '░████',
    '█░░░░',
    '█░░░░',
    '█░░░░',
    '█░░░░',
    '█░░░░',
    '░████',
  ],
  D: [
    '████░',
    '█░░░█',
    '█░░░█',
    '█░░░█',
    '█░░░█',
    '█░░░█',
    '████░',
  ],
  R: [
    '████░',
    '█░░░█',
    '█░░░█',
    '████░',
    '█░█░░',
    '█░░█░',
    '█░░░█',
  ],
  '.': [
    '░░',
    '░░',
    '░░',
    '░░',
    '░░',
    '░░',
    '██',
  ],
};

const LOGO_COLORS = [
  chalk.hex('#FFD700'),
  chalk.hex('#FFC200'),
  chalk.hex('#FFB300'),
  chalk.hex('#FFA500'),
  chalk.hex('#FF9500'),
  chalk.hex('#FF8C00'),
  chalk.hex('#FF8000'),
];

/**
 * Render pixel-font word into colored rows
 */
function renderPixelWord(word: string): string[] {
  const charRows = 7;
  const rows: string[] = Array(charRows).fill('');

  for (const letter of word.toUpperCase()) {
    const glyph = PIXEL_CHARS[letter] ?? PIXEL_CHARS['.'];
    for (let row = 0; row < charRows; row++) {
      rows[row] += (glyph[row] ?? '░░░░░') + ' ';
    }
  }

  return rows.map((row, i) => {
    const color = LOGO_COLORS[i];
    // Color '█' chars, leave '░' and ' ' as dim
    return row
      .split('')
      .map(ch => (ch === '█' ? color(ch) : chalk.hex('#1a1a1a')(ch)))
      .join('');
  });
}

/**
 * Display Qwen-style header:
 *  Left  → pixel-font "LEOCODER"
 *  Right → info box like Qwen's ">_ Name (version)" box
 */
function displayHeader(modelName: string, providerName: string): void {
  console.log();

  const logoRows = renderPixelWord('LEOCODER');

  // Right-side info box content (matches Qwen style)
  const boxLines = [
    chalk.green('>_ ') + chalk.white.bold('LeoCoder') + chalk.gray(' (v0.1.0)'),
    chalk.gray(providerName + ' | ' + modelName + ' (/model to change)'),
    chalk.green('/help') + chalk.gray(' for commands '),
    chalk.gray(process.cwd().replace(process.env.HOME || '', '~')),
  ];

  // Pad box lines to same count as logo rows
  while (boxLines.length < logoRows.length) boxLines.push('');

  // Box dimensions
  const boxInnerWidth = 44;
  const top    = chalk.white('┌' + '─'.repeat(boxInnerWidth) + '┐');
  const bottom = chalk.white('└' + '─'.repeat(boxInnerWidth) + '┘');

  const paddedBoxLines = boxLines.map(line => {
    // Strip ANSI to measure visible length
    const visible = line.replace(/\x1b\[[0-9;]*m/g, '');
    const pad = Math.max(0, boxInnerWidth - 2 - visible.length);
    return chalk.white('│') + ' ' + line + ' '.repeat(pad) + ' ' + chalk.white('│');
  });

  // Print logo rows alongside box
  logoRows.forEach((logoRow, i) => {
    if (i === 0) {
      console.log(logoRow + '    ' + top);
    } else if (i >= 1 && i <= paddedBoxLines.length) {
      console.log(logoRow + '    ' + (paddedBoxLines[i - 1] ?? ''));
    } else {
      console.log(logoRow);
    }
  });

  // Close box if it's taller than logo
  if (paddedBoxLines.length >= logoRows.length) {
    console.log(' '.repeat(50) + bottom);
  } else {
    console.log('    '.repeat(10) + bottom);
  }

  console.log();
  console.log(
    chalk.gray('Tips: Use ') +
    chalk.cyan('/bug') +
    chalk.gray(' to submit issues to the maintainers when something goes off.')
  );
  console.log();
}

/**
 * Display assistant message
 */
function displayAssistantMessage(content: string, provider: string): void {
  const isLocal = provider === 'ollama' || provider === 'lmstudio';
  const badge = isLocal
    ? chalk.green.bold('[LOCAL]')
    : chalk.yellow.bold('[CLOUD]');

  console.log();
  console.log(chalk.blue.bold('┌─ ') + chalk.cyan.bold('LEOCODER') + ' ' + badge);
  console.log(chalk.blue('│'));

  const wrappedLines = wrapText(content, 70);
  for (const line of wrappedLines) {
    console.log(chalk.blue('│ ') + chalk.white(line));
  }
  console.log(chalk.blue('└─' + '─'.repeat(60)));
  console.log();
}

/**
 * Wrap text
 */
function wrapText(text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    if (paragraph.length <= maxWidth) {
      lines.push(paragraph);
    } else {
      const words = paragraph.split(' ');
      let current = '';
      for (const word of words) {
        if ((current + word).length <= maxWidth) {
          current += (current ? ' ' : '') + word;
        } else {
          if (current) lines.push(current);
          current = word;
        }
      }
      if (current) lines.push(current);
    }
  }
  return lines;
}

// ─── Single thinking spinner (no double animation) ────────────────────────────

let thinkingSpinner: ReturnType<typeof ora> | null = null;

function displayThinking(): void {
  // Clear any leftover spinner first
  if (thinkingSpinner) {
    thinkingSpinner.stop();
  }
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

// ─── Chat session ─────────────────────────────────────────────────────────────

async function runChatSession(options: any) {
  const { router, fsTools, shellTools, modelName, providerName } =
    await initializeProviders(options);

  console.clear();
  displayHeader(modelName, providerName);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

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
    rl.question(chalk.green.bold('> ') + chalk.gray(fileIndicator), async (answer) => {
      await handleInput(answer);
      prompt();
    });
  };

  const handleInput = async (input: string) => {
    const trimmed = input.trim();
    if (!trimmed) return;

    if (trimmed.startsWith('/')) {
      await handleCommand(trimmed);
      return;
    }

    if (['exit', 'quit', 'bye'].includes(trimmed.toLowerCase())) {
      showFinalStats(router);
      rl.close();
      process.exit(0);
    }

    try {
      displayThinking();

      const response = await router.generate(trimmed, {
        systemPrompt: 'You are a helpful coding assistant. Provide concise, practical answers.',
      });

      stopThinking();
      displayAssistantMessage(response.text, response.provider);

      conversationHistory.push({ role: 'user', content: trimmed });
      conversationHistory.push({ role: 'assistant', content: response.text });
    } catch (error: any) {
      stopThinking();
      console.log(chalk.red('\n✗ Error: ' + error.message));
    }
  };

  const handleCommand = async (cmd: string) => {
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
            console.log(chalk.gray((result.content ?? '').slice(0, 500)));
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
            console.log(chalk.white(result.content ?? ''));
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

      case '/bug':
        console.log(chalk.yellow('Please report issues at: https://github.com/your-repo/leocoder/issues'));
        break;

      default:
        console.log(chalk.yellow('Unknown command: ' + command + '. Type /help for available commands.'));
    }
  };

  prompt();
}

// ─── Single question mode ─────────────────────────────────────────────────────

async function runSingleQuestion(promptText: string, options: any) {
  const { router, modelName, providerName } = await initializeProviders(options);

  console.clear();
  displayHeader(modelName, providerName);

  try {
    displayThinking();
    const response = await router.generate(promptText, {
      systemPrompt: 'You are a helpful coding assistant.',
    });
    stopThinking();
    displayAssistantMessage(response.text, response.provider);
  } catch (error: any) {
    stopThinking();
    console.log(chalk.red('\n✗ Error: ' + error.message));
    process.exit(1);
  }
}

// ─── Status ───────────────────────────────────────────────────────────────────

async function showStatus() {
  console.clear();
  displayHeader('checking...', 'status');
  console.log(chalk.cyan.bold('PROVIDER STATUS'));
  console.log(chalk.cyan('─'.repeat(60)));
  console.log();

  const ollama = new OllamaProvider();
  const ollamaAvailable = await ollama.isAvailable();
  console.log('  ' + (ollamaAvailable ? chalk.green('✓') : chalk.red('✗')) + ' Ollama (http://localhost:11434)');
  if (ollamaAvailable) {
    const models = await ollama.listModels();
    console.log(chalk.gray('    Models: ' + (models.join(', ') || 'None')));
  }

  const lmstudio = new LMStudioProvider();
  const lmAvailable = await lmstudio.isAvailable();
  console.log('  ' + (lmAvailable ? chalk.green('✓') : chalk.red('✗')) + ' LM Studio (http://localhost:1234)');

  console.log();
  console.log(chalk.yellow.bold('Cloud Providers:'));
  console.log();

  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    const groq = new GroqProvider(groqKey);
    const ok = await groq.isAvailable();
    console.log('  ' + (ok ? chalk.green('✓') : chalk.red('✗')) + ' Groq');
  } else {
    console.log(chalk.yellow('  [!] Groq - API key not set (https://console.groq.com/keys)'));
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    const gemini = new GeminiProvider(geminiKey);
    const ok = await gemini.isAvailable();
    console.log('  ' + (ok ? chalk.green('✓') : chalk.red('✗')) + ' Gemini');
  } else {
    console.log(chalk.yellow('  [!] Gemini - API key not set (https://makersuite.google.com/app/apikey)'));
  }

  console.log();
}

// ─── Config ───────────────────────────────────────────────────────────────────

function showConfig() {
  console.clear();
  displayHeader('config', 'leocoder');
  const configPath = path.join(process.cwd(), 'config.yaml');
  if (fs.existsSync(configPath)) {
    console.log(chalk.gray(fs.readFileSync(configPath, 'utf-8')));
  } else {
    console.log(chalk.yellow('No config.yaml found in current directory'));
  }
}

// ─── Initialize providers (silent — no console logs during init) ──────────────

async function initializeProviders(options: any) {
  const localProviders: any[] = [];
  const cloudProviders: any[] = [];
  let localModel = 'qwen2.5:1.5b';
  let providerName = 'Qwen OAuth';
  let activeLocal: string | undefined;
  let activeCloud: string | undefined;

  if (!options.cloudOnly) {
    const ollama = new OllamaProvider();
    localProviders.push(ollama);

    if (await ollama.isAvailable()) {
      const models = await ollama.listModels();
      if (models.length > 0) {
        localModel = models[0];
      }
      activeLocal = ollama.name;
      providerName = 'Ollama';
    }

    localProviders.push(new LMStudioProvider());
  }

  if (!options.localOnly) {
    const groqKey = process.env.GROQ_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    if (groqKey) {
      cloudProviders.push(new GroqProvider(groqKey));
      activeCloud = 'groq';
      if (!activeLocal) providerName = 'Groq';
    }
    if (geminiKey) {
      cloudProviders.push(new GeminiProvider(geminiKey));
      if (!activeCloud) {
        activeCloud = 'gemini';
        if (!activeLocal) providerName = 'Gemini';
      }
    }
  }

  // Silence router init logs by temporarily suppressing stdout
  const originalWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = () => true;

  const router = new SmartRouter({
    localProviders,
    cloudProviders,
    localModel,
    cloudModel: 'llama-3.1-8b-instant',
    complexityThreshold: 5,
    preferLocal: true,
    onRouteChange: () => {},
  });

  await router.initialize();

  // Restore stdout
  process.stdout.write = originalWrite;

  const fsTools = new FileSystemTools();
  const shellTools = new ShellTools();

  return {
    router,
    fsTools,
    shellTools,
    modelName: localModel,
    providerName,
    providers: { local: activeLocal, cloud: activeCloud },
  };
}

// ─── Help / Stats ─────────────────────────────────────────────────────────────

function showHelp() {
  console.log();
  console.log(chalk.cyan.bold('AVAILABLE COMMANDS'));
  console.log(chalk.cyan('─'.repeat(60)));
  console.log();
  const cmds: [string, string][] = [
    ['/file <path>',      'Open a file for context'],
    ['/read <path>',      'Read and display a file'],
    ['/search <pattern>', 'Search for pattern in files'],
    ['/run <command>',    'Run a shell command'],
    ['/models',           'Show active models'],
    ['/stats',            'Show token usage stats'],
    ['/bug',              'Report an issue'],
    ['/help',             'Show this help'],
  ];
  for (const [cmd, desc] of cmds) {
    console.log('  ' + chalk.cyan(cmd.padEnd(22)) + chalk.gray(desc));
  }
  console.log();
  console.log('  ' + chalk.green('exit') + chalk.gray(' / ') + chalk.green('quit') + chalk.gray('  — End the session'));
  console.log();
  console.log(chalk.cyan('─'.repeat(60)));
  console.log();
}

function showStats(router: SmartRouter) {
  const stats = router.getStats();
  console.log();
  console.log(chalk.cyan.bold('TOKEN USAGE STATISTICS'));
  console.log(chalk.cyan('─'.repeat(60)));
  console.log();
  console.log(chalk.green.bold('Local Usage:'));
  console.log('  Requests:  ' + stats.localRequests);
  console.log('  Tokens:    ' + stats.localTokens);
  console.log();
  console.log(chalk.yellow.bold('Cloud Usage:'));
  console.log('  Requests:  ' + stats.cloudRequests);
  console.log('  Tokens:    ' + stats.cloudTokens);
  console.log();
  console.log(chalk.green('Saved: ~' + stats.tokensSaved + ' tokens (via local)'));
  console.log();
  console.log(chalk.cyan('─'.repeat(60)));
  console.log();
}

function showFinalStats(router: SmartRouter) {
  const stats = router.getStats();
  console.log();
  console.log(chalk.cyan('╔' + '═'.repeat(55) + '╗'));
  console.log(chalk.cyan('║') + chalk.bold.white('                    SESSION SUMMARY                    ') + chalk.cyan('║'));
  console.log(chalk.cyan('╚' + '═'.repeat(55) + '╝'));
  console.log();
  console.log('  Total:   ' + stats.totalRequests + ' requests');
  console.log(chalk.green('  Local:   ' + stats.localRequests + ' requests (' + stats.localTokens + ' tokens)'));
  console.log(chalk.yellow('  Cloud:   ' + stats.cloudRequests + ' requests (' + stats.cloudTokens + ' tokens)'));
  console.log(chalk.green('  Saved:   ~' + stats.tokensSaved + ' tokens'));
  console.log();
  console.log(chalk.cyan('  Happy coding with LeoCoder!'));
  console.log();
}