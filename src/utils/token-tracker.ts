import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

/**
 * Daily token usage record
 */
export interface DailyUsage {
  date: string;
  localTokens: number;
  cloudTokens: number;
  localRequests: number;
  cloudRequests: number;
  tokensSaved: number;
}

/**
 * Track and persist token usage statistics
 */
export class TokenTracker {
  private dataFile: string;
  private dailyLimit: number;
  private currentUsage: DailyUsage;

  constructor(dataDir: string = '.vibecoder', dailyLimit: number = 100000) {
    this.dataFile = path.join(dataDir, 'usage.json');
    this.dailyLimit = dailyLimit;
    this.currentUsage = this.loadToday();
  }

  /**
   * Record token usage
   */
  record(usage: {
    provider: 'local' | 'cloud';
    promptTokens: number;
    completionTokens: number;
  }): void {
    const totalTokens = usage.promptTokens + usage.completionTokens;

    if (usage.provider === 'local') {
      this.currentUsage.localTokens += totalTokens;
      this.currentUsage.localRequests++;
      this.currentUsage.tokensSaved += totalTokens;
    } else {
      this.currentUsage.cloudTokens += totalTokens;
      this.currentUsage.cloudRequests++;
    }

    this.save();
  }

  /**
   * Check if within daily limit
   */
  isWithinLimit(): boolean {
    return this.currentUsage.cloudTokens < this.dailyLimit;
  }

  /**
   * Get remaining cloud tokens for today
   */
  getRemainingTokens(): number {
    return Math.max(0, this.dailyLimit - this.currentUsage.cloudTokens);
  }

  /**
   * Get usage percentage
   */
  getUsagePercentage(): number {
    return (this.currentUsage.cloudTokens / this.dailyLimit) * 100;
  }

  /**
   * Check if approaching limit
   */
  isApproachingLimit(threshold: number = 0.8): boolean {
    return this.getUsagePercentage() >= threshold * 100;
  }

  /**
   * Get current usage summary
   */
  getSummary(): DailyUsage {
    return { ...this.currentUsage };
  }

  /**
   * Get historical usage
   */
  getHistory(days: number = 7): DailyUsage[] {
    const data = this.loadAll();
    return data.slice(0, days);
  }

  /**
   * Print usage report
   */
  printReport(): void {
    const today = this.currentUsage;
    const percentage = this.getUsagePercentage();
    
    console.log(chalk.blue.bold('\n📊 Token Usage Report\n'));
    
    console.log(chalk.white(`Date: ${chalk.cyan(today.date)}`));
    console.log();
    
    console.log(chalk.cyan('Local Usage:'));
    console.log(chalk.white(`  Requests:  ${today.localRequests}`));
    console.log(chalk.white(`  Tokens:    ${today.localTokens.toLocaleString()}`));
    console.log();
    
    console.log(chalk.cyan('Cloud Usage:'));
    console.log(chalk.white(`  Requests:  ${today.cloudRequests}`));
    console.log(chalk.white(`  Tokens:    ${today.cloudTokens.toLocaleString()}`));
    console.log(chalk.white(`  Limit:     ${this.dailyLimit.toLocaleString()}`));
    console.log(chalk.white(`  Remaining: ${this.getRemainingTokens().toLocaleString()}`));
    console.log();
    
    // Progress bar
    const barWidth = 30;
    const filledWidth = Math.floor((percentage / 100) * barWidth);
    const emptyWidth = barWidth - filledWidth;
    
    const bar = chalk.green('█'.repeat(filledWidth)) + chalk.gray('░'.repeat(emptyWidth));
    const status = this.isApproachingLimit() ? chalk.yellow('⚠️  Approaching limit!') : chalk.green('✓ Within limit');
    
    console.log(chalk.cyan('Daily Limit Progress:'));
    console.log(`  [${bar}] ${percentage.toFixed(1)}%`);
    console.log(`  ${status}`);
    console.log();
    
    console.log(chalk.green(`💰 Tokens Saved (using local): ~${today.tokensSaved.toLocaleString()}`));
    console.log();
  }

  /**
   * Reset today's usage
   */
  resetToday(): void {
    this.currentUsage = this.createToday();
    this.save();
  }

  /**
   * Load today's usage
   */
  private loadToday(): DailyUsage {
    const data = this.loadAll();
    const today = new Date().toISOString().split('T')[0];
    
    const existing = data.find(d => d.date === today);
    if (existing) {
      return existing;
    }
    
    const newRecord = this.createToday();
    data.unshift(newRecord);
    
    // Keep only last 30 days
    if (data.length > 30) {
      data.pop();
    }
    
    this.saveAll(data);
    return newRecord;
  }

  /**
   * Create today's record
   */
  private createToday(): DailyUsage {
    return {
      date: new Date().toISOString().split('T')[0],
      localTokens: 0,
      cloudTokens: 0,
      localRequests: 0,
      cloudRequests: 0,
      tokensSaved: 0,
    };
  }

  /**
   * Load all usage data
   */
  private loadAll(): DailyUsage[] {
    try {
      if (fs.existsSync(this.dataFile)) {
        const content = fs.readFileSync(this.dataFile, 'utf-8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.error('Error loading usage data:', error);
    }
    return [];
  }

  /**
   * Save all usage data
   */
  private saveAll(data: DailyUsage[]): void {
    try {
      const dir = path.dirname(this.dataFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error saving usage data:', error);
    }
  }

  /**
   * Save current usage
   */
  private save(): void {
    const data = this.loadAll();
    const index = data.findIndex(d => d.date === this.currentUsage.date);
    
    if (index >= 0) {
      data[index] = this.currentUsage;
    } else {
      data.unshift(this.currentUsage);
    }
    
    this.saveAll(data);
  }
}
