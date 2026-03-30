/**
 * Base interface for all LLM providers
 */
export interface LLMProvider {
  name: string;
  baseUrl: string;
  
  /**
   * Check if the provider is available and responsive
   */
  isAvailable(): Promise<boolean>;
  
  /**
   * List available models
   */
  listModels(): Promise<string[]>;
  
  /**
   * Generate a completion
   */
  generate(prompt: string, options?: GenerateOptions): Promise<CompletionResponse>;
  
  /**
   * Generate with streaming
   */
  generateStream(prompt: string, options?: GenerateOptions): AsyncGenerator<string>;
}

export interface GenerateOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  stream?: boolean;
}

export interface CompletionResponse {
  text: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  provider: string;
}
