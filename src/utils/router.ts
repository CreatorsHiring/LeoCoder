import { LLMProvider, GenerateOptions, CompletionResponse } from '../providers/base';
import { classifyTask, TaskType } from '../utils/classifier';
import chalk from 'chalk';

export interface RouterConfig {
  localProviders: LLMProvider[];
  cloudProviders: LLMProvider[];
  localModel?: string;
  cloudModel?: string;
  complexityThreshold?: number;
  preferLocal?: boolean;
  onRouteChange?: (route: 'local' | 'cloud', reason: string) => void;
}

export interface TokenStats {
  localTokens: number;
  cloudTokens: number;
  totalRequests: number;
  localRequests: number;
  cloudRequests: number;
  tokensSaved: number;
}

export class SmartRouter {
  private localProviders: LLMProvider[];
  private cloudProviders: LLMProvider[];
  private localModel?: string;
  private cloudModel?: string;
  private complexityThreshold: number;
  private preferLocal: boolean;
  private onRouteChange?: (route: 'local' | 'cloud', reason: string) => void;

  private stats: TokenStats = {
    localTokens: 0,
    cloudTokens: 0,
    totalRequests: 0,
    localRequests: 0,
    cloudRequests: 0,
    tokensSaved: 0,
  };

  private activeLocalProvider?: LLMProvider;
  private activeCloudProvider?: LLMProvider;

  constructor(config: RouterConfig) {
    this.localProviders = config.localProviders;
    this.cloudProviders = config.cloudProviders;
    this.localModel = config.localModel;
    this.cloudModel = config.cloudModel;
    this.complexityThreshold = config.complexityThreshold ?? 5;
    this.preferLocal = config.preferLocal ?? true;
    this.onRouteChange = config.onRouteChange;
  }

  async initialize(): Promise<{ local: string[]; cloud: string[] }> {
    const availableLocal: string[] = [];
    const availableCloud: string[] = [];

    for (const provider of this.localProviders) {
      const isAvailable = await provider.isAvailable();
      if (isAvailable) {
        availableLocal.push(provider.name);
        this.activeLocalProvider = provider;
      }
    }

    for (const provider of this.cloudProviders) {
      const isAvailable = await provider.isAvailable();
      if (isAvailable) {
        availableCloud.push(provider.name);
        if (!this.activeCloudProvider) {
          this.activeCloudProvider = provider;
        }
      }
    }

    return { local: availableLocal, cloud: availableCloud };
  }

  async generate(
    userInput: string,
    options?: GenerateOptions & {
      context?: { selectedCode?: string; filePath?: string };
      forceProvider?: 'local' | 'cloud';
    }
  ): Promise<CompletionResponse> {
    this.stats.totalRequests++;

    const { type, complexity } = classifyTask(userInput, options?.context);
    let route = options?.forceProvider || this.determineRoute(complexity.score, type);

    if (this.onRouteChange) {
      this.onRouteChange(route, `Complexity: ${complexity.score}/10, Task: ${type}`);
    }

    try {
      let provider = route === 'local' ? this.activeLocalProvider : this.activeCloudProvider;

      if (!provider) {
        if (route === 'local' && this.activeCloudProvider) {
          route = 'cloud';
        } else if (route === 'cloud' && this.activeLocalProvider) {
          route = 'local';
        } else {
          throw new Error('No providers available');
        }
      }

      const activeProvider = route === 'local' ? this.activeLocalProvider! : this.activeCloudProvider!;

      const response = await activeProvider.generate(userInput, {
        ...options,
        model: route === 'local' ? this.localModel : this.cloudModel,
      });

      if (route === 'local') {
        this.stats.localRequests++;
        this.stats.localTokens += response.usage.totalTokens;
        this.stats.tokensSaved += response.usage.totalTokens;
      } else {
        this.stats.cloudRequests++;
        this.stats.cloudTokens += response.usage.totalTokens;
      }

      return response;
    } catch (error: any) {
      const fallbackRoute = route === 'local' ? 'cloud' : 'local';
      const fallbackProvider = fallbackRoute === 'local' ? this.activeLocalProvider : this.activeCloudProvider;

      if (fallbackProvider) {
        return await fallbackProvider.generate(userInput, {
          ...options,
          model: fallbackRoute === 'local' ? this.localModel : this.cloudModel,
        });
      }

      throw error;
    }
  }

  async *generateStream(
    userInput: string,
    options?: GenerateOptions & {
      context?: { selectedCode?: string; filePath?: string };
      forceProvider?: 'local' | 'cloud';
    }
  ): AsyncGenerator<string> {
    const { complexity } = classifyTask(userInput, options?.context);
    const route = options?.forceProvider || this.determineRoute(complexity.score);
    const provider = route === 'local' ? this.activeLocalProvider : this.activeCloudProvider;

    if (!provider) throw new Error(`No ${route} provider available`);

    for await (const chunk of provider.generateStream(userInput, {
      ...options,
      model: route === 'local' ? this.localModel : this.cloudModel,
    })) {
      yield chunk;
    }
  }

  private determineRoute(complexityScore: number, taskType?: TaskType): 'local' | 'cloud' {
    const localPreferredTypes: TaskType[] = ['code_completion', 'format_code', 'explain_code', 'simple_refactor'];
    if (taskType && localPreferredTypes.includes(taskType)) return 'local';

    const cloudRequiredTypes: TaskType[] = ['architecture_design', 'complex_refactor', 'security_audit', 'new_feature_design'];
    if (taskType && cloudRequiredTypes.includes(taskType)) return 'cloud';

    return this.preferLocal
      ? complexityScore < this.complexityThreshold ? 'local' : 'cloud'
      : complexityScore <= this.complexityThreshold ? 'local' : 'cloud';
  }

  getStats(): TokenStats {
    return { ...this.stats };
  }

  resetStats(): void {
    this.stats = { localTokens: 0, cloudTokens: 0, totalRequests: 0, localRequests: 0, cloudRequests: 0, tokensSaved: 0 };
  }

  getActiveProviders(): { local?: string; cloud?: string } {
    return {
      local: this.activeLocalProvider?.name,
      cloud: this.activeCloudProvider?.name,
    };
  }
}