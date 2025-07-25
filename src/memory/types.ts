import type { Sharp } from 'sharp';

import type { ChatMessage } from '@/models';
import type { Timing, TokenUsage } from '@/monitoring';
import type { ToolCall } from '@/tools';
import type { AgentError } from '@/utils';

interface ActionStepConfig {
  stepNumber: number;
  timing: Timing;
  modelInputMessages?: ChatMessage[];
  toolCalls?: ToolCall[];
  error?: AgentError;
  modelOutputMessage?: ChatMessage;
  modelOutput?: string | Record<string, any>[];
  codeAction?: string;
  observations?: string;
  observationsImages?: Sharp[];
  actionOutput?: any;
  tokenUsage?: TokenUsage;
  isFinalAnswer: boolean;
}

interface PlanningStepConfig {
  modelInputMessages: ChatMessage[];
  modelOutputMessage: ChatMessage;
  plan: string;
  timing: Timing;
  tokenUsage?: TokenUsage;
}

export type { ActionStepConfig, PlanningStepConfig };
