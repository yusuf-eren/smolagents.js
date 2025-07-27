import type { Sharp } from 'sharp';

import type { ChatMessage } from '@/models';
import type { Timing, TokenUsage } from '@/monitoring';
import type { ToolCall } from '@/tools';
import type { AgentError } from '@/utils';
import type {
  ActionStep,
  FinalAnswerStep,
  PlanningStep,
  TaskStep,
  MemoryStep,
  system_promptStep,
} from '@/memory/steps';

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
  isFinalAnswer?: boolean;
}

interface PlanningStepConfig {
  modelInputMessages: ChatMessage[];
  modelOutputMessage: ChatMessage;
  plan: string;
  timing: Timing;
  tokenUsage?: TokenUsage;
}

type MemoryStepTypes = Array<
  TaskStep | ActionStep | PlanningStep | FinalAnswerStep | MemoryStep | system_promptStep
>;

export type { ActionStepConfig, PlanningStepConfig, MemoryStepTypes };
