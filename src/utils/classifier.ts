/**
 * Task types for routing decisions
 */
export type TaskType = 
  | 'code_completion'
  | 'simple_refactor'
  | 'explain_code'
  | 'find_bug'
  | 'format_code'
  | 'architecture_design'
  | 'complex_refactor'
  | 'security_audit'
  | 'new_feature_design'
  | 'debug'
  | 'optimize'
  | 'test_generation'
  | 'documentation'
  | 'file_operation'
  | 'shell_command'
  | 'general';

/**
 * Complexity level (1-10)
 */
export interface ComplexityAnalysis {
  score: number;
  factors: string[];
  recommendedProvider: 'local' | 'cloud';
}

/**
 * Keywords that indicate task complexity
 */
const LOCAL_KEYWORDS = [
  'complete', 'finish', 'autocomplete',
  'explain', 'describe', 'what does',
  'format', 'prettify', 'beautify',
  'simple', 'easy', 'quick',
  'fix typo', 'typo', 'syntax error',
  'rename', 'extract variable', 'inline',
];

const CLOUD_KEYWORDS = [
  'architecture', 'design pattern', 'microservice',
  'complex', 'refactor entire', 'restructure',
  'security', 'vulnerability', 'audit',
  'new feature', 'implement from scratch',
  'optimize performance', 'scale', 'distributed',
  'database schema', 'api design',
  'best practice', 'production-ready',
];

/**
 * Analyze task complexity and classify the request
 */
export function classifyTask(userInput: string, context?: {
  selectedCode?: string;
  filePath?: string;
  conversationHistory?: any[];
}): { type: TaskType; complexity: ComplexityAnalysis } {
  const input = userInput.toLowerCase();
  const codeContext = context?.selectedCode?.toLowerCase() || '';
  const combinedInput = `${input} ${codeContext}`;
  
  // Determine task type
  let taskType: TaskType = 'general';
  
  if (matchesAny(input, ['complete', 'finish', 'add ', 'append'])) {
    taskType = 'code_completion';
  } else if (matchesAny(input, ['explain', 'describe', 'what does', 'how does'])) {
    taskType = 'explain_code';
  } else if (matchesAny(input, ['refactor', 'restructure', 'improve'])) {
    taskType = input.includes('entire') || input.includes('complex') ? 'complex_refactor' : 'simple_refactor';
  } else if (matchesAny(input, ['bug', 'error', 'not working', 'broken', 'fix'])) {
    taskType = 'find_bug';
  } else if (matchesAny(input, ['format', 'prettify', 'indent'])) {
    taskType = 'format_code';
  } else if (matchesAny(input, ['architecture', 'design', 'structure'])) {
    taskType = 'architecture_design';
  } else if (matchesAny(input, ['security', 'vulnerability', 'audit'])) {
    taskType = 'security_audit';
  } else if (matchesAny(input, ['new feature', 'implement', 'create from scratch'])) {
    taskType = 'new_feature_design';
  } else if (matchesAny(input, ['debug', 'why', 'troubleshoot'])) {
    taskType = 'debug';
  } else if (matchesAny(input, ['optimize', 'performance', 'faster', 'efficient'])) {
    taskType = 'optimize';
  } else if (matchesAny(input, ['test', 'spec', 'jest', 'pytest'])) {
    taskType = 'test_generation';
  } else if (matchesAny(input, ['document', 'comment', 'readme', 'docstring'])) {
    taskType = 'documentation';
  } else if (matchesAny(input, ['read file', 'write file', 'edit', 'create file'])) {
    taskType = 'file_operation';
  } else if (matchesAny(input, ['run', 'execute', 'command', 'terminal', 'shell'])) {
    taskType = 'shell_command';
  }

  // Calculate complexity score
  const complexity = calculateComplexity(combinedInput, taskType, context);
  
  return { type: taskType, complexity };
}

function matchesAny(text: string, keywords: string[]): boolean {
  return keywords.some(kw => text.includes(kw));
}

function calculateComplexity(
  input: string,
  taskType: TaskType,
  context?: { selectedCode?: string; filePath?: string }
): ComplexityAnalysis {
  let score = 5; // Base score
  const factors: string[] = [];

  // Local keywords reduce complexity
  const localMatches = LOCAL_KEYWORDS.filter(kw => input.includes(kw));
  if (localMatches.length > 0) {
    score -= 2;
    factors.push(`Simple task indicators: ${localMatches.slice(0, 3).join(', ')}`);
  }

  // Cloud keywords increase complexity
  const cloudMatches = CLOUD_KEYWORDS.filter(kw => input.includes(kw));
  if (cloudMatches.length > 0) {
    score += 3;
    factors.push(`Complex task indicators: ${cloudMatches.slice(0, 3).join(', ')}`);
  }

  // Task type adjustments
  const localPreferredTypes: TaskType[] = ['code_completion', 'format_code', 'explain_code'];
  const cloudRequiredTypes: TaskType[] = ['architecture_design', 'complex_refactor', 'security_audit', 'new_feature_design'];

  if (localPreferredTypes.includes(taskType)) {
    score -= 1;
    factors.push(`Task type '${taskType}' is typically simple`);
  } else if (cloudRequiredTypes.includes(taskType)) {
    score += 2;
    factors.push(`Task type '${taskType}' requires advanced reasoning`);
  }

  // Code context length
  if (context?.selectedCode) {
    const codeLines = context.selectedCode.split('\n').length;
    if (codeLines > 100) {
      score += 1;
      factors.push(`Large code context (${codeLines} lines)`);
    } else if (codeLines < 20) {
      score -= 1;
      factors.push(`Small code context (${codeLines} lines)`);
    }
  }

  // Input length
  const wordCount = input.split(/\s+/).length;
  if (wordCount > 50) {
    score += 1;
    factors.push('Detailed/complex request');
  } else if (wordCount < 10) {
    score -= 1;
    factors.push('Brief/simple request');
  }

  // Clamp score to 1-10
  score = Math.max(1, Math.min(10, score));

  return {
    score,
    factors,
    recommendedProvider: score <= 4 ? 'local' : 'cloud',
  };
}

/**
 * Quick heuristic for routing without full analysis
 */
export function quickRoute(userInput: string): 'local' | 'cloud' {
  const input = userInput.toLowerCase();
  
  // Quick local checks
  if (input.length < 50 && !input.includes('?')) {
    return 'local';
  }
  
  if (LOCAL_KEYWORDS.some(kw => input.includes(kw))) {
    return 'local';
  }
  
  // Quick cloud checks
  if (CLOUD_KEYWORDS.some(kw => input.includes(kw))) {
    return 'cloud';
  }
  
  // Default to local for short queries, cloud for long ones
  return input.length < 100 ? 'local' : 'cloud';
}
