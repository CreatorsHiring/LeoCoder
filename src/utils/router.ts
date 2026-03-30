import { LLMProvider, GenerateOptions, CompletionResponse } from '../providers/base';
import { classifyTask, quickRoute, TaskType } from '../utils/classifier';
import chalk from 'chalk';

/**
 * Router configuration
 */
export interface RouterConfig {
  localProviders: LLMProvider[];
  cloudProviders: LLMProvider[];
  localModel?: string;
  cloudModel?: string;
  complexityThreshold?: number; // 1-10, default 5
  preferLocal?: boolean;
  onRouteChange?: (route: 'local' | 'cloud', reason: string) => void;
}

/**
 * Token usage statistics
 */
export interface TokenStats {
  localTokens: number;
  cloudTokens: number;
  totalRequests: number;
  localRequests: number;
  cloudRequests: number;
  tokensSaved: number; // Estimated tokens saved by using local
}

/**
 * Smart Router - Routes requests between local and cloud providers
 */
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

  /**
   * Initialize and detect available providers
   */
  async initialize(): Promise<{ local: string[]; cloud: string[] }> {
    const availableLocal: string[] = [];
    const availableCloud: string[] = [];

    // Check local providers
    for (const provider of this.localProviders) {
      const isAvailable = await provider.isAvailable();
      if (isAvailable) {
        availableLocal.push(provider.name);
        this.activeLocalProvider = provider;
        console.log(chalk.green(`✓ Local provider available: ${provider.name}`));
      } else {
        console.log(chalk.yellow(`✗ Local provider unavailable: ${provider.name}`));
      }
    }

    // Check cloud providers
    for (const provider of this.cloudProviders) {
      const isAvailable = await provider.isAvailable();
      if (isAvailable) {
        availableCloud.push(provider.name);
        if (!this.activeCloudProvider) {
          this.activeCloudProvider = provider;
        }
        console.log(chalk.green(`✓ Cloud provider available: ${provider.name}`));
      } else {
        console.log(chalk.yellow(`✗ Cloud provider unavailable: ${provider.name}`));
      }
    }

    return { local: availableLocal, cloud: availableCloud };
  }

  /**
   * Route a request and generate a response
   */
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

    // Log routing decision
    if (this.onRouteChange) {
      this.onRouteChange(
        route,
        `Complexity: ${complexity.score}/10, Task: ${type}, Factors: ${complexity.factors.slice(0, 2).join(', ')}`
      );
    }

    console.log(chalk.blue(`\n📍 Routing: ${route.toUpperCase()} (Complexity: ${complexity.score}/10, Task: ${type})`));

    try {
      const provider = route === 'local' ? this.activeLocalProvider : this.activeCloudProvider;
      
      if (!provider) {
        // Fallback logic
        if (route === 'local' && this.activeCloudProvider) {
          console.log(chalk.yellow('⚠ Local unavailable, falling back to cloud...'));
          route = 'cloud';
        } else if (route === 'cloud' && this.activeLocalProvider) {
          console.log(chalk.yellow('⚠ Cloud unavailable, falling back to local...'));
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

      // Update stats
      if (route === 'local') {
        this.stats.localRequests++;
        this.stats.localTokens += response.usage.totalTokens;
        // Estimate cloud equivalent for savings calculation
        this.stats.tokensSaved += response.usage.totalTokens;
      } else {
        this.stats.cloudRequests++;
        this.stats.cloudTokens += response.usage.totalTokens;
      }

      return response;
    } catch (error: any) {
      // Try fallback on error
      console.log(chalk.red(`\n✗ ${route} provider failed: ${error.message}`));
      
      const fallbackRoute = route === 'local' ? 'cloud' : 'local';
      const fallbackProvider = fallbackRoute === 'local' ? this.activeLocalProvider : this.activeCloudProvider;
      
      if (fallbackProvider) {
        console.log(chalk.yellow(`🔄 Falling back to ${fallbackRoute}...`));
        return await fallbackProvider.generate(userInput, {
          ...options,
          model: fallbackRoute === 'local' ? this.localModel : this.cloudModel,
        });
      }
      
      throw error;
    }
  }

  /**
   * Stream a response
   */
  async *generateStream(
    userInput: string,
    options?: GenerateOptions & {
      context?: { selectedCode?: string; filePath?: string };
      forceProvider?: 'local' | 'cloud';
    }
  ): AsyncGenerator<string> {
    const { complexity } = classifyTask(userInput, options?.context);
    let route = options?.forceProvider || this.determineRoute(complexity.score);

    const provider = route === 'local' ? this.activeLocalProvider : this.activeCloudProvider;
    
    if (!provider) {
      throw new Error(`No ${route} provider available`);
    }

    console.log(chalk.blue(`\n📍 Streaming from: ${route.toUpperCase()} (Complexity: ${complexity.score}/10)`));

    try {
      for await (const chunk of provider.generateStream(userInput, {
        ...options,
        model: route === 'local' ? this.localModel : this.cloudModel,
      })) {
        yield chunk;
      }
    } catch (error: any) {
      console.log(chalk.red(`\n✗ Stream failed: ${error.message}`));
      throw error;
    }
  }

  /**
   * Determine route based on complexity and preferences
   */
  private determineRoute(complexityScore: number, taskType?: TaskType): 'local' | 'cloud' {
    // Always use local for simple tasks
    const localPreferredTypes: TaskType[] = ['code_completion', 'format_code', 'explain_code', 'simple_refactor'];
    if (taskType && localPreferredTypes.includes(taskType)) {
      return 'local';
    }

    // Always use cloud for complex tasks
    const cloudRequiredTypes: TaskType[] = ['architecture_design', 'complex_refactor', 'security_audit', 'new_feature_design'];
    if (taskType && cloudRequiredTypes.includes(taskType)) {
      return 'cloud';
    }

    // Use threshold for other tasks
    if (this.preferLocal) {
      return complexityScore < this.complexityThreshold ? 'local' : 'cloud';
    } else {
      return complexityScore <= this.complexityThreshold ? 'local' : 'cloud';
    }
  }

  /**
   * Get current token statistics
   */
  getStats(): TokenStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      localTokens: 0,
      cloudTokens: 0,
      totalRequests: 0,
      localRequests: 0,
      cloudRequests: 0,
      tokensSaved: 0,
    };
  }

  /**
   * Get active providers
   */
  getActiveProviders(): { local?: string; cloud?: string } {
    return {
      local: this.activeLocalProvider?.name,
      cloud: this.activeCloudProvider?.name,
    };
  }
}
