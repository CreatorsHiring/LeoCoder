import * as fs from 'fs';
import * as path from 'path';

export interface RepoFileSummary {
  path: string;
  type: string;
  size: number;
  summary?: string;
}

export interface RepoMap {
  projectName: string;
  rootPath: string;
  techStack: string[];
  importantFiles: RepoFileSummary[];
  folders: string[];
  detectedPurpose: string;
}

const IGNORE_DIRS = new Set([
  '.git',
  'node_modules',
  '.next',
  'dist',
  'build',
  'coverage',
  '.turbo',
  '.vercel',
  '.idea',
  '.vscode',
  '.leocoder',
]);

const IMPORTANT_FILE_NAMES = new Set([
  'package.json',
  'tsconfig.json',
  'README.md',
  'vite.config.ts',
  'next.config.js',
  'next.config.ts',
  'tailwind.config.js',
  'tailwind.config.ts',
  'dockerfile',
  'Dockerfile',
  'requirements.txt',
  'pom.xml',
  'build.gradle',
  '.env.example',
]);

function safeReadJson(filePath: string): any | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function walkDir(dir: string, rootDir: string, files: string[] = [], folders: string[] = []): { files: string[]; folders: string[] } {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relative = path.relative(rootDir, fullPath);

    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      folders.push(relative);
      walkDir(fullPath, rootDir, files, folders);
    } else {
      files.push(relative);
    }
  }

  return { files, folders };
}

function detectTechStack(rootDir: string, allFiles: string[]): string[] {
  const stack = new Set<string>();

  const packageJsonPath = path.join(rootDir, 'package.json');
  const packageJson = safeReadJson(packageJsonPath);

  if (packageJson) {
    stack.add('Node.js');

    const deps = {
      ...(packageJson.dependencies || {}),
      ...(packageJson.devDependencies || {}),
    };

    if (deps['typescript']) stack.add('TypeScript');
    if (deps['react']) stack.add('React');
    if (deps['next']) stack.add('Next.js');
    if (deps['express']) stack.add('Express');
    if (deps['commander']) stack.add('CLI');
    if (deps['tailwindcss']) stack.add('Tailwind CSS');
    if (deps['vite']) stack.add('Vite');
  }

  if (allFiles.some(f => f.endsWith('.py'))) stack.add('Python');
  if (allFiles.some(f => f.endsWith('.java'))) stack.add('Java');
  if (allFiles.some(f => f.endsWith('.tsx'))) stack.add('TSX');
  if (allFiles.some(f => f.endsWith('.jsx'))) stack.add('JSX');

  if (allFiles.includes('requirements.txt')) stack.add('Python');
  if (allFiles.includes('pom.xml')) stack.add('Maven');
  if (allFiles.includes('Dockerfile')) stack.add('Docker');

  return Array.from(stack);
}

function inferProjectPurpose(allFiles: string[], firstPrompt: string): string {
  const prompt = firstPrompt.toLowerCase();
  const fileBlob = allFiles.join(' ').toLowerCase();

  if (prompt.includes('coding assistant') || prompt.includes('llm') || prompt.includes('router')) {
    return 'AI coding assistant / LLM routing tool';
  }

  if (fileBlob.includes('src/providers') || fileBlob.includes('router')) {
    return 'Developer tooling / AI-assisted coding project';
  }

  if (fileBlob.includes('pages') || fileBlob.includes('app/') || fileBlob.includes('components')) {
    return 'Web application';
  }

  if (fileBlob.includes('cli') || fileBlob.includes('commander')) {
    return 'CLI developer tool';
  }

  return 'Software project';
}

function getImportantFiles(rootDir: string, allFiles: string[]): RepoFileSummary[] {
  const summaries: RepoFileSummary[] = [];

  for (const relPath of allFiles) {
    const fileName = path.basename(relPath);
    const fullPath = path.join(rootDir, relPath);

    const isImportant =
      IMPORTANT_FILE_NAMES.has(fileName) ||
      relPath.startsWith('src/') ||
      relPath.startsWith('app/') ||
      relPath.startsWith('pages/') ||
      relPath.startsWith('components/') ||
      relPath.startsWith('lib/') ||
      relPath.startsWith('utils/');

    if (!isImportant) continue;

    try {
      const stat = fs.statSync(fullPath);
      const ext = path.extname(relPath).replace('.', '') || 'file';

      summaries.push({
        path: relPath,
        type: ext,
        size: stat.size,
      });
    } catch {
      // ignore unreadable files
    }
  }

  return summaries.slice(0, 150);
}

function generateLeoContextMarkdown(repoMap: RepoMap, firstPrompt: string): string {
  return `# LeoCoder Project Context

## Project Purpose
${repoMap.detectedPurpose}

## What the user is trying to build
${firstPrompt}

## Project Name
${repoMap.projectName}

## Tech Stack
${repoMap.techStack.length ? repoMap.techStack.join(', ') : 'Unknown'}

## Architecture Overview
Top-level folders:
${repoMap.folders.slice(0, 30).map(f => `- ${f}`).join('\n') || '- No major folders detected'}

## Important Files
${repoMap.importantFiles.slice(0, 40).map(f => `- ${f.path} (${f.type})`).join('\n') || '- No important files detected'}

## LeoCoder Rules
- Prefer minimal code changes over full rewrites
- Do not modify config/env files unless explicitly asked
- Preserve existing architecture unless user requests refactor
- Prefer local-first model usage where possible
`;
}

export async function ensureLeoCoderContext(rootDir: string, firstPrompt: string): Promise<void> {
  const leoDir = path.join(rootDir, '.leocoder');

  if (fs.existsSync(leoDir)) return;

  fs.mkdirSync(leoDir, { recursive: true });

  const { files, folders } = walkDir(rootDir, rootDir);
  const techStack = detectTechStack(rootDir, files);
  const detectedPurpose = inferProjectPurpose(files, firstPrompt);
  const importantFiles = getImportantFiles(rootDir, files);

  const repoMap: RepoMap = {
    projectName: path.basename(rootDir),
    rootPath: rootDir,
    techStack,
    importantFiles,
    folders,
    detectedPurpose,
  };

  // repomap.json
  fs.writeFileSync(
    path.join(leoDir, 'repomap.json'),
    JSON.stringify(repoMap, null, 2),
    'utf-8'
  );

  // leocodercontext.md
  fs.writeFileSync(
    path.join(leoDir, 'leocodercontext.md'),
    generateLeoContextMarkdown(repoMap, firstPrompt),
    'utf-8'
  );

  // session.json
  fs.writeFileSync(
    path.join(leoDir, 'session.json'),
    JSON.stringify({
      current_task: firstPrompt,
      files_in_focus: [],
      recent_user_prompts: [firstPrompt],
      initialized_at: new Date().toISOString(),
    }, null, 2),
    'utf-8'
  );

  // recent_edits.json
  fs.writeFileSync(
    path.join(leoDir, 'recent_edits.json'),
    JSON.stringify({
      recent_files: [],
      recent_changes: [],
      failed_attempts: [],
    }, null, 2),
    'utf-8'
  );

  // rules.md
  fs.writeFileSync(
    path.join(leoDir, 'rules.md'),
    `# LeoCoder Rules

- Never edit .env or secrets without explicit permission
- Prefer minimal diffs
- Preserve existing coding style
- Avoid unrelated refactors
- Ask before making repo-wide structural changes
`,
    'utf-8'
  );

  // tasks.json
  fs.writeFileSync(
    path.join(leoDir, 'tasks.json'),
    JSON.stringify([
      {
        id: 'task_001',
        title: firstPrompt,
        status: 'in_progress',
        created_at: new Date().toISOString(),
      }
    ], null, 2),
    'utf-8'
  );
}