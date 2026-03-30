import axios from 'axios';
import { LLMProvider, GenerateOptions, CompletionResponse } from './base';

/**
 * Google Gemini provider - Free tier available
 * Get API key: https://makersuite.google.com/app/apikey
 */
export class GeminiProvider implements LLMProvider {
  name = 'gemini';
  baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/models`, {
        params: { key: this.apiKey },
        timeout: 5000,
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/models`, {
        params: { key: this.apiKey },
      });
      return response.data.models?.map((m: any) => m.name.replace('models/', '')) || [];
    } catch {
      return [];
    }
  }

  async generate(prompt: string, options?: GenerateOptions): Promise<CompletionResponse> {
    const model = options?.model || 'gemini-1.5-flash';
    
    try {
      const response = await axios.post(
        `${this.baseUrl}/models/${model}:generateContent`,
        {
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: options?.temperature ?? 0.7,
            maxOutputTokens: options?.maxTokens ?? 2048,
          },
        },
        {
          params: { key: this.apiKey },
        }
      );

      const text = response.data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || '';
      const usageMetadata = response.data.usageMetadata;

      return {
        text,
        model,
        usage: {
          promptTokens: usageMetadata?.promptTokenCount || 0,
          completionTokens: usageMetadata?.candidatesTokenCount || 0,
          totalTokens: usageMetadata?.totalTokenCount || 0,
        },
        provider: this.name,
      };
    } catch (error: any) {
      throw new Error(`Gemini error: ${error.message}`);
    }
  }

  async *generateStream(prompt: string, options?: GenerateOptions): AsyncGenerator<string> {
    const model = options?.model || 'gemini-1.5-flash';

    try {
      const response = await axios.post(
        `${this.baseUrl}/models/${model}:streamGenerateContent`,
        {
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: options?.temperature ?? 0.7,
            maxOutputTokens: options?.maxTokens ?? 2048,
          },
        },
        {
          params: { key: this.apiKey, alt: 'sse' },
          responseType: 'stream',
        }
      );

      for await (const chunk of response.data) {
        const text = chunk.toString();
        for (const line of text.split('\n').filter((l: string) => l.trim())) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            try {
              const parsed = JSON.parse(data);
              const content = parsed.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('');
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
      throw new Error(`Gemini stream error: ${error.message}`);
    }
  }
}
