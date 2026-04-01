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
import { ensureLeoCoderContext } from './context/initContext';
import { buildLeoContextPrompt } from './context/loadContext';

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
  .action(async (options) => { await runChatSession(options); });

program
  .command('ask <prompt>')
  .description('Ask a single question')
  .option('-l, --local-only', 'Use only local models')
  .option('-c, --cloud-only', 'Use only cloud models')
  .action(async (prompt, options) => { await runSingleQuestion(prompt, options); });

program
  .command('status')
  .description('Check available providers and models')
  .action(async () => { await showStatus(); });

program
  .command('config')
  .description('Show current configuration')
  .action(() => { showConfig(); });

program.parse();

// ─── Pixel font ───────────────────────────────────────────────────────────────

const PIXEL_CHARS: Record<string, string[]> = {
  L: ['█░░░░','█░░░░','█░░░░','█░░░░','█░░░░','█░░░░','█████'],
  E: ['█████','█░░░░','█░░░░','████░','█░░░░','█░░░░','█████'],
  O: ['░███░','█░░░█','█░░░█','█░░░█','█░░░█','█░░░█','░███░'],
  C: ['░████','█░░░░','█░░░░','█░░░░','█░░░░','█░░░░','░████'],
  D: ['████░','█░░░█','█░░░█','█░░░█','█░░░█','█░░░█','████░'],
  R: ['████░','█░░░█','█░░░█','████░','█░█░░','█░░█░','█░░░█'],
  '.': ['░░','░░','░░','░░','░░','░░','██'],
};

const LOGO_COLORS = [
  chalk.hex('#FFD700'), chalk.hex('#FFC200'), chalk.hex('#FFB300'),
  chalk.hex('#FFA500'), chalk.hex('#FF9500'), chalk.hex('#FF8C00'),
  chalk.hex('#FF8000'),
];

function renderPixelWord(word: string): string[] {
  const rows: string[] = Array(7).fill('');
  for (const letter of word.toUpperCase()) {
    const glyph = PIXEL_CHARS[letter] ?? PIXEL_CHARS['.'];
    for (let r = 0; r < 7; r++) {
      rows[r] += (glyph[r] ?? '░░░░░') + ' ';
    }
  }
  return rows.map((row, i) =>
    row.split('').map(ch => ch === '█' ? LOGO_COLORS[i](ch) : chalk.hex('#1a1a1a')(ch)).join('')
  );
}

// ─── FIX: truncate path to fit inside the box ────────────────────────────────

function truncatePath(fullPath: string, maxLen: number): string {
  // Normalize to forward slashes for display, keep drive letter on Windows
  const normalized = fullPath.replace(/\\/g, '/');
  if (normalized.length <= maxLen) return normalized;
  // Show last N chars with ellipsis prefix so the end (project name) stays visible
  return '…' + normalized.slice(-(maxLen - 1));
}

function displayHeader(modelName: string, providerName: string): void {
  console.log();
  const logoRows = renderPixelWord('LEOCODER');

  // Box inner content width (characters visible inside │ … │)
  const BOX_CONTENT = 42;

  const cwd = process.cwd();
  // Replace home dir with ~ on unix; on Windows just truncate
  const home = process.env.HOME || process.env.USERPROFILE || '';
  const prettyPath = home && cwd.startsWith(home)
    ? '~' + cwd.slice(home.length).replace(/\\/g, '/')
    : cwd.replace(/\\/g, '/');
  const displayPath = truncatePath(prettyPath, BOX_CONTENT);

  const boxLines = [
    chalk.green('>_ ') + chalk.white.bold('LeoCoder') + chalk.gray(' (v0.1.0)'),
    chalk.gray(providerName + ' | ' + modelName + ' (/models to change)'),
    chalk.green('/help') + chalk.gray(' for commands'),
    chalk.gray(displayPath),
  ];

  while (boxLines.length < logoRows.length) boxLines.push('');

  const BOX_INNER = BOX_CONTENT + 2; // +2 for the single space padding each side
  const top    = chalk.white('┌' + '─'.repeat(BOX_INNER) + '┐');
  const bottom = chalk.white('└' + '─'.repeat(BOX_INNER) + '┘');

  const paddedBoxLines = boxLines.map(line => {
    const visible = line.replace(/\x1b\[[0-9;]*m/g, '');
    // Clamp visible length to box width — truncate with ellipsis if still too long
    const clampedLine = visible.length > BOX_CONTENT
      ? line.slice(0, BOX_CONTENT - 1) + '…'
      : line;
    const visibleLen = clampedLine.replace(/\x1b\[[0-9;]*m/g, '').length;
    const pad = Math.max(0, BOX_CONTENT - visibleLen);
    return chalk.white('│') + ' ' + clampedLine + ' '.repeat(pad) + ' ' + chalk.white('│');
  });

  logoRows.forEach((logoRow, i) => {
    if (i === 0) {
      console.log(logoRow + '    ' + top);
    } else if (i <= paddedBoxLines.length) {
      console.log(logoRow + '    ' + (paddedBoxLines[i - 1] ?? ''));
    } else {
      console.log(logoRow);
    }
  });

  // bottom border always sits flush
  const logoVisualWidth = 8 * 6 + 4; // 8 chars × (5 glyph + 1 space) approx — use fixed indent
  console.log(' '.repeat(50) + bottom);

  console.log();
  console.log(
    chalk.gray('Tips: Use ') + chalk.cyan('/bug') +
    chalk.gray(' to submit issues to the maintainers when something goes off.')
  );
  console.log();
}

// ─── Aider-style: parse fenced code blocks and write files ───────────────────

interface ParsedFile {
  filename: string;
  language: string;
  content: string;
}

/**
 * Scan LLM response for ```lang filename blocks and extract them.
 * Supports patterns like:
 *   ```typescript src/utils/foo.ts
 *   ```python main.py
 *   ```js   index.js
 *   // filename: src/foo.ts   (fallback comment hint)
 */
function parseCodeBlocks(response: string): ParsedFile[] {
  const files: ParsedFile[] = [];
  // Match ``` optionally followed by language and/or filename
  const fenceRe = /```(\w*)\s*([\w./\\-]+\.\w+)?\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;

  while ((match = fenceRe.exec(response)) !== null) {
    const language = match[1] || 'text';
    let filename = match[2] || '';
    const content = match[3];

    // Fallback: look for a // filename: hint inside the block
    if (!filename) {
      const hintMatch = content.match(/^(?:\/\/|#|<!--)\s*filename:\s*([\w./\\-]+\.\w+)/m);
      if (hintMatch) filename = hintMatch[1];
    }

    if (filename && content.trim()) {
      files.push({ filename, language, content });
    }
  }

  return files;
}

/**
 * Write extracted files to disk and report what was written.
 * Returns true if any files were written.
 */
async function applyCodeBlocks(
  files: ParsedFile[],
  baseDir: string,
  fsTools: FileSystemTools
): Promise<boolean> {
  if (files.length === 0) return false;

  console.log();
  console.log(chalk.cyan('┌─ ') + chalk.cyan.bold('FILES TO WRITE') + chalk.gray(` (${files.length} file${files.length > 1 ? 's' : ''})`));

  for (const f of files) {
    const filePath = path.isAbsolute(f.filename)
      ? f.filename
      : path.join(baseDir, f.filename);

    const result = await fsTools.writeFile(filePath, f.content);

    if (result.success) {
      console.log(chalk.cyan('│ ') + chalk.green('✓ wrote  ') + chalk.white(f.filename));
    } else {
      console.log(chalk.cyan('│ ') + chalk.red('✗ failed ') + chalk.white(f.filename) + chalk.gray(' — ' + result.error));
    }
  }

  console.log(chalk.cyan('└' + '─'.repeat(40)));
  console.log();
  return true;
}

// ─── Display response ─────────────────────────────────────────────────────────

function displayAssistantMessage(content: string, provider: string): void {
  const isLocal = provider === 'ollama' || provider === 'lmstudio';
  const badge = isLocal ? chalk.green.bold('[LOCAL]') : chalk.yellow.bold('[CLOUD]');

  console.log();
  console.log(chalk.blue.bold('┌─ ') + chalk.cyan.bold('LEOCODER') + ' ' + badge);
  console.log(chalk.blue('│'));
  for (const line of wrapText(content, 70)) {
    console.log(chalk.blue('│ ') + chalk.white(line));
  }
  console.log(chalk.blue('└─' + '─'.repeat(60)));
  console.log();
}

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

// ─── Spinner ──────────────────────────────────────────────────────────────────

let thinkingSpinner: ReturnType<typeof ora> | null = null;

function displayThinking(): void {
  if (thinkingSpinner) thinkingSpinner.stop();
  thinkingSpinner = ora({ text: chalk.blue('Thinking...'), spinner: 'dots', color: 'cyan' }).start();
}

function stopThinking(): void {
  if (thinkingSpinner) { thinkingSpinner.stop(); thinkingSpinner = null; }
}

// ─── Chat session ─────────────────────────────────────────────────────────────

async function runChatSession(options: any) {
  const { router, fsTools, shellTools, modelName, providerName } =
    await initializeProviders(options);

  console.clear();
  displayHeader(modelName, providerName);

  // Working directory for file writes — defaults to cwd, changeable with /cd
  let workDir = process.cwd();
  let currentFile: string | undefined;

  // System prompt that instructs the model to include filenames in fences
  const SYSTEM_PROMPT = `You are LeoCoder, an expert coding assistant.
When you write or modify code files, ALWAYS put them in fenced code blocks with the filename on the opening fence line, like:
\`\`\`typescript src/utils/helper.ts
// code here
\`\`\`
This allows the user's editor to automatically write the files to disk.
Be concise and practical. If asked to create or edit a file, always output the full file content in a fence.`;

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  rl.on('SIGINT', () => {
    stopThinking();
    showFinalStats(router);
    rl.close();
    process.exit(0);
  });

  const conversationHistory: Array<{ role: string; content: string }> = [];

  const prompt = () => {
    const fileIndicator = currentFile ? chalk.yellow(' [' + path.basename(currentFile) + ']') : '';
    console.log();
    rl.question(chalk.green.bold('>') + fileIndicator + chalk.green.bold(' '), async (answer) => {
      await handleInput(answer.trim());
      prompt();
    });
  };

  const handleInput = async (input: string) => {
    if (!input) return;

    if (input.startsWith('/')) {
      await handleCommand(input);
      return;
    }

    if (['exit', 'quit', 'bye'].includes(input.toLowerCase())) {
      showFinalStats(router);
      rl.close();
      process.exit(0);
    }

await ensureLeoCoderContext(workDir, input);

// Load LeoCoder project context
const leoContext = buildLeoContextPrompt(workDir);

// Build prompt — attach open file context if set
let fullPrompt = input;

if (currentFile && fs.existsSync(currentFile)) {
  const fileContent = fs.readFileSync(currentFile, 'utf-8');
  const relPath = path.relative(workDir, currentFile);

  fullPrompt =
    `${leoContext}\n\n` +
    `=== OPEN FILE CONTEXT (${relPath}) ===\n` +
    '```\n' + fileContent + '\n```\n\n' +
    `=== USER REQUEST ===\n${input}`;
} else {
  fullPrompt =
    `${leoContext}\n\n` +
    `=== USER REQUEST ===\n${input}`;
}

    try {
      displayThinking();

      const response = await router.generate(fullPrompt, { systemPrompt: SYSTEM_PROMPT });

      stopThinking();
      displayAssistantMessage(response.text, response.provider);

      // ── Aider-style: auto-write any code blocks that have filenames ──
      const parsedFiles = parseCodeBlocks(response.text);
      if (parsedFiles.length > 0) {
        await applyCodeBlocks(parsedFiles, workDir, fsTools);
      }

      conversationHistory.push({ role: 'user', content: input });
      conversationHistory.push({ role: 'assistant', content: response.text });

    } catch (error: any) {
      stopThinking();
      console.log(chalk.red('\n✗ Error: ' + error.message));
    }
  };

  const handleCommand = async (cmd: string) => {
    const parts = cmd.trim().split(/\s+/);
    const command = parts[0].toLowerCase();
    console.log();

    switch (command) {

      // ── File context ──────────────────────────────────────────────────
      case '/file':
      case '/open':
        if (parts[1]) {
          currentFile = path.resolve(workDir, parts[1]);
          if (fs.existsSync(currentFile)) {
            const lines = fs.readFileSync(currentFile, 'utf-8').split('\n').length;
            console.log(chalk.green('✓ Opened: ') + currentFile + chalk.gray(` (${lines} lines)`));
            console.log(chalk.gray('  The file will be included as context in every message.'));
          } else {
            console.log(chalk.red('✗ File not found: ' + currentFile));
            currentFile = undefined;
          }
        } else {
          console.log(chalk.yellow('Usage: /file <path>'));
        }
        break;

      case '/close':
        if (currentFile) {
          console.log(chalk.gray('Closed: ' + currentFile));
          currentFile = undefined;
        } else {
          console.log(chalk.gray('No file is open.'));
        }
        break;

      // ── Change working dir (where files are written) ──────────────────
      case '/cd':
        if (parts[1]) {
          const newDir = path.resolve(workDir, parts[1]);
          if (fs.existsSync(newDir) && fs.statSync(newDir).isDirectory()) {
            workDir = newDir;
            console.log(chalk.green('✓ Working directory: ') + workDir);
          } else {
            console.log(chalk.red('✗ Directory not found: ' + newDir));
          }
        } else {
          console.log(chalk.white('Current directory: ') + workDir);
        }
        break;

      // ── Write a file manually ─────────────────────────────────────────
      case '/write': {
        // Usage: /write <filepath> <content...>   or   /write <filepath>  (opens editor prompt)
        if (!parts[1]) { console.log(chalk.yellow('Usage: /write <filepath> <content>')); break; }
        const writeTarget = path.resolve(workDir, parts[1]);
        const inlineContent = parts.slice(2).join(' ');
        if (inlineContent) {
          const r = await fsTools.writeFile(writeTarget, inlineContent + '\n');
          console.log(r.success ? chalk.green('✓ Written: ' + writeTarget) : chalk.red('✗ ' + r.error));
        } else {
          console.log(chalk.gray('Enter content (type END on its own line to finish):'));
          const lines: string[] = [];
          const tempRl = readline.createInterface({ input: process.stdin });
          await new Promise<void>(resolve => {
            tempRl.on('line', line => {
              if (line === 'END') { tempRl.close(); resolve(); }
              else lines.push(line);
            });
          });
          const r = await fsTools.writeFile(writeTarget, lines.join('\n') + '\n');
          console.log(r.success ? chalk.green('✓ Written: ' + writeTarget) : chalk.red('✗ ' + r.error));
        }
        break;
      }

      case '/read':
        if (parts[1]) {
          const result = await fsTools.readFile(path.resolve(workDir, parts[1]));
          if (result.success) {
            console.log(chalk.cyan('\n' + parts[1] + ':'));
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
              console.log(chalk.gray(r.file + ':' + r.line) + '  ' + chalk.white(r.content));
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
          await shellTools.execute(shellCmd, { streamOutput: true, cwd: workDir });
        } else {
          console.log(chalk.yellow('Usage: /run <command>'));
        }
        break;

      case '/models':
        const activeProviders = router.getActiveProviders();
        console.log(chalk.cyan('Active Providers:'));
        console.log('  Local: ' + (activeProviders.local || chalk.gray('None')));
        console.log('  Cloud: ' + (activeProviders.cloud || chalk.gray('None')));
        break;

      case '/stats':
        showStats(router);
        break;

      case '/help':
        showHelp();
        break;

      case '/bug':
        console.log(chalk.yellow('Report issues at: https://github.com/CreatorsHiring/LeoCoder/issues'));
        break;

      default:
        console.log(chalk.yellow('Unknown command: ' + command + '. Type /help for available commands.'));
    }
  };

  prompt();
}

// ─── Single question ──────────────────────────────────────────────────────────

async function runSingleQuestion(promptText: string, options: any) {
  const { router, fsTools, modelName, providerName } = await initializeProviders(options);

  console.clear();
  displayHeader(modelName, providerName);

  try {
    await ensureLeoCoderContext(process.cwd(), promptText);

    const leoContext = buildLeoContextPrompt(process.cwd());
    const fullPrompt =
      `${leoContext}\n\n` +
      `=== USER REQUEST ===\n${promptText}`;

    displayThinking();
    const response = await router.generate(fullPrompt, {
      systemPrompt: 'You are a helpful coding assistant. When writing files, put them in fenced code blocks with the filename on the opening fence line.',
    });
    stopThinking();
    displayAssistantMessage(response.text, response.provider);
    const files = parseCodeBlocks(response.text);
    if (files.length > 0) await applyCodeBlocks(files, process.cwd(), fsTools);
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
  const ollamaOk = await ollama.isAvailable();
  console.log('  ' + (ollamaOk ? chalk.green('✓') : chalk.red('✗')) + ' Ollama (http://localhost:11434)');
  if (ollamaOk) {
    const models = await ollama.listModels();
    console.log(chalk.gray('    Models: ' + (models.join(', ') || 'None')));
  }

  const lm = new LMStudioProvider();
  console.log('  ' + (await lm.isAvailable() ? chalk.green('✓') : chalk.red('✗')) + ' LM Studio (http://localhost:1234)');

  console.log();
  console.log(chalk.yellow.bold('Cloud Providers:'));
  console.log();

  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    const groq = new GroqProvider(groqKey);
    console.log('  ' + (await groq.isAvailable() ? chalk.green('✓') : chalk.red('✗')) + ' Groq');
  } else {
    console.log(chalk.yellow('  [!] Groq — key not set (https://console.groq.com/keys)'));
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    const gemini = new GeminiProvider(geminiKey);
    console.log('  ' + (await gemini.isAvailable() ? chalk.green('✓') : chalk.red('✗')) + ' Gemini');
  } else {
    console.log(chalk.yellow('  [!] Gemini — key not set (https://makersuite.google.com/app/apikey)'));
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

// ─── Initialize providers ─────────────────────────────────────────────────────

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
      if (models.length > 0) localModel = models[0];
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
      if (!activeCloud) { activeCloud = 'gemini'; if (!activeLocal) providerName = 'Gemini'; }
    }
  }

  const originalWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = () => true;

  const router = new SmartRouter({
    localProviders, cloudProviders, localModel,
    cloudModel: 'llama-3.1-8b-instant',
    complexityThreshold: 5, preferLocal: true, onRouteChange: () => {},
  });
  await router.initialize();

  process.stdout.write = originalWrite;

  return {
    router,
    fsTools: new FileSystemTools(),
    shellTools: new ShellTools(),
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
    ['/file <path>',       'Open file as context (auto-included in prompts)'],
    ['/close',             'Close the currently open file'],
    ['/cd <dir>',          'Change working directory for file writes'],
    ['/write <path>',      'Manually write content to a file'],
    ['/read <path>',       'Read and display a file'],
    ['/search <pattern>',  'Search for pattern in files'],
    ['/run <command>',     'Run a shell command'],
    ['/models',            'Show active models'],
    ['/stats',             'Show token usage stats'],
    ['/bug',               'Report an issue'],
    ['/help',              'Show this help'],
  ];
  for (const [cmd, desc] of cmds) {
    console.log('  ' + chalk.cyan(cmd.padEnd(24)) + chalk.gray(desc));
  }
  console.log();
  console.log('  ' + chalk.green('exit') + chalk.gray(' / ') + chalk.green('quit') + chalk.gray('  — End the session'));
  console.log();
  console.log(chalk.cyan.bold('FILE WRITING'));
  console.log(chalk.cyan('─'.repeat(60)));
  console.log(chalk.gray('  Ask the LLM to create or edit files and it will write them'));
  console.log(chalk.gray('  automatically. Use prompts like:'));
  console.log('  ' + chalk.white('"create a utils/math.ts with add and subtract functions"'));
  console.log('  ' + chalk.white('"add error handling to the open file"'));
  console.log(chalk.gray('  Files are written to the current working directory (/cd to change).'));
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
  console.log(chalk.green.bold('Local:'));
  console.log('  Requests: ' + stats.localRequests + '   Tokens: ' + stats.localTokens);
  console.log();
  console.log(chalk.yellow.bold('Cloud:'));
  console.log('  Requests: ' + stats.cloudRequests + '   Tokens: ' + stats.cloudTokens);
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
  console.log(chalk.green('  Local:   ' + stats.localRequests + ' (' + stats.localTokens + ' tokens)'));
  console.log(chalk.yellow('  Cloud:   ' + stats.cloudRequests + ' (' + stats.cloudTokens + ' tokens)'));
  console.log(chalk.green('  Saved:   ~' + stats.tokensSaved + ' tokens'));
  console.log();
  console.log(chalk.cyan('  Happy coding with LeoCoder!'));
  console.log();
}