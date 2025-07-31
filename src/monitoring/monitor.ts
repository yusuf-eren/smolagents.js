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

  updateMetrics(step: { timing: Timing; tokenUsage?: TokenUsage | null }): void {
    const stepDuration = step.timing.duration;
    if (stepDuration) {
      this.stepDurations.push(stepDuration);
    }

    // Convert milliseconds to seconds
    const durationInSeconds = stepDuration ? stepDuration / 1000 : 0;
    let consoleOutputs = `[Step ${this.stepDurations.length}: Duration ${durationInSeconds.toFixed(2)} seconds`;

    if (step.tokenUsage) {
      this.totalInputTokenCount += step.tokenUsage.inputTokens;
      this.totalOutputTokenCount += step.tokenUsage.outputTokens;
      consoleOutputs += ` | Input tokens: ${this.totalInputTokenCount.toLocaleString()} | Output tokens: ${this.totalOutputTokenCount.toLocaleString()}`;
    }
    consoleOutputs += ']';

    this.logger.log(chalk.dim(consoleOutputs), {
      level: LogLevel.INFO,
    });
  }
}
