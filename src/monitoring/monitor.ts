import chalk from 'chalk';

import type { AgentLogger, Timing } from '@/monitoring/logging';
import { LogLevel } from '@/monitoring/types';
import { TokenUsage } from '@/monitoring/usage';

export class Monitor {
  stepDurations: number[];
  trackedModel: string;
  logger: AgentLogger;
  totalInputTokenCount: number;
  totalOutputTokenCount: number;

  constructor(trackedModel: string, logger: AgentLogger) {
    this.stepDurations = [];
    this.trackedModel = trackedModel;
    this.logger = logger;
    this.totalInputTokenCount = 0;
    this.totalOutputTokenCount = 0;
  }

  getTotalTokenCounts(): TokenUsage {
    return new TokenUsage(this.totalInputTokenCount, this.totalOutputTokenCount);
  }

  reset(): void {
    this.stepDurations = [];
    this.totalInputTokenCount = 0;
    this.totalOutputTokenCount = 0;
  }

  updateMetrics(stepLog: { timing: Timing; tokenUsage?: TokenUsage | null }): void {
    const stepDuration = stepLog.timing.duration;
    if (stepDuration) {
      this.stepDurations.push(stepDuration);
    }

    let consoleOutputs = `[Step ${this.stepDurations.length}: Duration ${stepDuration?.toFixed(2)} seconds`;

    if (stepLog.tokenUsage) {
      this.totalInputTokenCount += stepLog.tokenUsage.inputTokens;
      this.totalOutputTokenCount += stepLog.tokenUsage.outputTokens;
      consoleOutputs += ` | Input tokens: ${this.totalInputTokenCount.toLocaleString()} | Output tokens: ${this.totalOutputTokenCount.toLocaleString()}`;
    }
    consoleOutputs += ']';

    this.logger.log(chalk.dim(consoleOutputs), {
      level: LogLevel.INFO,
    });
  }
}
