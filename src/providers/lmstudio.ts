import axios from 'axios';
import { LLMProvider, GenerateOptions, CompletionResponse } from './base';

/**
 * LM Studio provider for local LLM inference
 * LM Studio provides an OpenAI-compatible API
 */
export class LMStudioProvider implements LLMProvider {
  name = 'lmstudio';
  baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:1234') {
    this.baseUrl = baseUrl;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/v1/models`, { timeout: 3000 });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/v1/models`);
      return response.data.data?.map((m: any) => m.id) || [];
    } catch {
      return [];
    }
  }

  async generate(prompt: string, options?: GenerateOptions): Promise<CompletionResponse> {
    const model = options?.model || 'local-model';
    
    try {
      const response = await axios.post(`${this.baseUrl}/v1/chat/completions`, {
        model,
        messages: [
          ...(options?.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
          { role: 'user', content: prompt },
        ],
        stream: false,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 2048,
      });

      const text = response.data.choices?.[0]?.message?.content || '';
      const usage = response.data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

      return {
        text,
        model,
        usage: {
          promptTokens: usage.prompt_tokens || 0,
          completionTokens: usage.completion_tokens || 0,
          totalTokens: usage.total_tokens || 0,
        },
        provider: this.name,
      };
    } catch (error: any) {
      throw new Error(`LM Studio error: ${error.message}`);
    }
  }

  async *generateStream(prompt: string, options?: GenerateOptions): AsyncGenerator<string> {
    const model = options?.model || 'local-model';

    try {
      const response = await axios.post(`${this.baseUrl}/v1/chat/completions`, {
        model,
        messages: [
          ...(options?.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
          { role: 'user', content: prompt },
        ],
        stream: true,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 2048,
      }, {
        responseType: 'stream',
      });

      for await (const chunk of response.data) {
        const text = chunk.toString();
        for (const line of text.split('\n').filter((l: string) => l.trim())) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                yield content;
              }
            } catch {
              // Skip invalid JSON lines
            }
          }
        }
      }
    } catch (error: any) {
      throw new Error(`LM Studio stream error: ${error.message}`);
    }
  }
}
