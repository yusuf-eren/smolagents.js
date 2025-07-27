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
  SystemPromptStep,
} from '@/memory/steps';
import type { ActionOutput } from '@/agents';

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
  actionOutput?: ActionOutput;
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
  TaskStep | ActionStep | PlanningStep | FinalAnswerStep | MemoryStep | SystemPromptStep
>;

export type { ActionStepConfig, PlanningStepConfig, MemoryStepTypes };
