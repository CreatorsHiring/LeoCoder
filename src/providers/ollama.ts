import axios from 'axios';
import { LLMProvider, GenerateOptions, CompletionResponse } from './base';

/**
 * Ollama provider for local LLM inference
 */
export class OllamaProvider implements LLMProvider {
  name = 'ollama';
  baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:11434') {
    this.baseUrl = baseUrl;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`, { timeout: 3000 });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`);
      return response.data.models?.map((m: any) => m.name) || [];
    } catch {
      return [];
    }
  }

  async generate(prompt: string, options?: GenerateOptions): Promise<CompletionResponse> {
    const model = options?.model || 'phi-3-mini';
    
    try {
      const response = await axios.post(`${this.baseUrl}/api/generate`, {
        model,
        prompt,
        stream: false,
        options: {
          temperature: options?.temperature ?? 0.7,
          num_predict: options?.maxTokens ?? 2048,
        },
      });

      const text = response.data.response || '';
      const promptTokens = response.data.prompt_eval_count || 0;
      const completionTokens = response.data.eval_count || 0;

      return {
        text,
        model,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
        },
        provider: this.name,
      };
    } catch (error: any) {
      throw new Error(`Ollama error: ${error.message}`);
    }
  }

  async *generateStream(prompt: string, options?: GenerateOptions): AsyncGenerator<string> {
    const model = options?.model || 'phi-3-mini';

    try {
      const response = await axios.post(`${this.baseUrl}/api/generate`, {
        model,
        prompt,
        stream: true,
        options: {
          temperature: options?.temperature ?? 0.7,
          num_predict: options?.maxTokens ?? 2048,
        },
      }, {
        responseType: 'stream',
      });

      for await (const chunk of response.data) {
        const text = chunk.toString();
        for (const line of text.split('\n').filter((l: string) => l.trim())) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.response) {
              yield parsed.response;
            }
          } catch {
            // Skip invalid JSON lines
          }
        }
      }
    } catch (error: any) {
      throw new Error(`Ollama stream error: ${error.message}`);
    }
  }
}
