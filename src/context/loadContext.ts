import * as fs from 'fs';
import * as path from 'path';

function safeRead(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

function safeReadJson(filePath: string): any | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

export function buildLeoContextPrompt(workDir: string): string {
  const leoDir = path.join(workDir, '.leocoder');

  if (!fs.existsSync(leoDir)) return '';

  const contextMd = safeRead(path.join(leoDir, 'leocodercontext.md'));
  const rulesMd = safeRead(path.join(leoDir, 'rules.md'));
  const session = safeReadJson(path.join(leoDir, 'session.json'));
  const tasks = safeReadJson(path.join(leoDir, 'tasks.json'));
  const repomap = safeReadJson(path.join(leoDir, 'repomap.json'));
  const recentEdits = safeReadJson(path.join(leoDir, 'recent_edits.json'));

  let prompt = `You are LeoCoder, an expert coding assistant.

You may be working inside an existing project, but the user's current request is always the top priority.

Use repository/project context only when it is relevant.
If the user asks for a new standalone file, webpage, demo, or example, create it normally even if it is unrelated to the existing project.\n\n`;

  if (contextMd) {
    prompt += `=== PROJECT CONTEXT ===\n${contextMd}\n\n`;
  }

  if (rulesMd) {
    prompt += `=== PROJECT RULES ===\n${rulesMd}\n\n`;
  }

  if (session) {
    prompt += `=== CURRENT SESSION ===\n`;
    prompt += `Current task: ${session.current_task || 'Unknown'}\n`;
    prompt += `Recent user prompts: ${(session.recent_user_prompts || []).slice(-5).join(' | ')}\n\n`;
  }

  if (tasks && Array.isArray(tasks) && tasks.length > 0) {
    prompt += `=== ACTIVE TASKS ===\n`;
    for (const task of tasks.slice(0, 5)) {
      prompt += `- ${task.title} [${task.status}]\n`;
    }
    prompt += `\n`;
  }

  if (repomap) {
    prompt += `=== REPOSITORY OVERVIEW ===\n`;
    prompt += `Project: ${repomap.projectName || 'Unknown'}\n`;
    prompt += `Tech Stack: ${(repomap.techStack || []).join(', ')}\n`;
    prompt += `Purpose: ${repomap.detectedPurpose || 'Unknown'}\n`;

    if (Array.isArray(repomap.folders) && repomap.folders.length > 0) {
      prompt += `Folders:\n`;
      for (const folder of repomap.folders.slice(0, 10)) {
        prompt += `- ${folder}\n`;
      }
    }

    if (Array.isArray(repomap.importantFiles) && repomap.importantFiles.length > 0) {
      prompt += `Important files:\n`;
      for (const file of repomap.importantFiles.slice(0, 15)) {
        prompt += `- ${file.path}\n`;
      }
    }

    prompt += `\n`;
  }

  if (recentEdits) {
    prompt += `=== RECENT EDITS ===\n`;
    prompt += `Recent files: ${(recentEdits.recent_files || []).join(', ') || 'None'}\n`;
    prompt += `Recent changes: ${(recentEdits.recent_changes || []).join(' | ') || 'None'}\n`;
    prompt += `Failed attempts: ${(recentEdits.failed_attempts || []).join(' | ') || 'None'}\n\n`;
  }

  prompt += `Use this project context only when it is relevant to the user's request.
Do NOT refuse unrelated coding or file creation requests just because they differ from the project context.
The user's current request always takes priority.
If the user asks what they are building, summarize from the context above.
If the user asks to create a new file, webpage, script, or unrelated example, do it normally.\n`;

  return prompt;
}