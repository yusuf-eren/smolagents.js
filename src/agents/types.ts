import type { ActionStep, FinalAnswerStep, PlanningStep } from '@/memory';
import { type ChatMessageStreamDelta, type ChatMessageToolCall, Model } from '@/models';
import { AgentLogger, LogLevel, Timing } from '@/monitoring';
import type { ToolCall, ToolOutput } from '@/tools';
import type { Tool } from '@/tools/tool';

export interface ActionOutput {
  output: any;
  isFinalAnswer: boolean;
}

export interface PlanningPromptTemplate {
  /**
   * Initial plan prompt.
   */
  initialPlan: string;

  /**
   * Update plan pre-messages prompt.
   */
  updatePlanPreMessages: string;

  /**
   * Update plan post-messages prompt.
   */
  updatePlanPostMessages: string;
}

export interface ManagedAgentPromptTemplate {
  /**
   * Task prompt.
   */
  task: string;

  /**
   * Report prompt.
   */
  report: string;
}

/**
 * Prompt templates for the final answer.
 *
 * @property preMessages Pre-messages prompt.
 * @property postMessages Post-messages prompt.
 */
export interface FinalAnswerPromptTemplate {
  /**
   * Pre-messages prompt.
   */
  preMessages: string;

  /**
   * Post-messages prompt.
   */
  postMessages: string;
}

/**
 * Prompt templates for the agent.
 *
 * @property systemPrompt System prompt.
 * @property planning Planning prompt templates.
 * @property managedAgent Managed agent prompt templates.
 * @property finalAnswer Final answer prompt templates.
 */
export interface PromptTemplates {
  /**
   * System prompt.
   */
  systemPrompt: string;

  /**
   * Planning prompt templates.
   */
  planning: PlanningPromptTemplate;

  /**
   * Managed agent prompt templates.
   */
  managedAgent: ManagedAgentPromptTemplate;

  /**
   * Final answer prompt templates.
   */
  finalAnswer: FinalAnswerPromptTemplate;
}

export const EMPTY_PROMPT_TEMPLATES: PromptTemplates = {
  systemPrompt: '',
  planning: {
    initialPlan: '',
    updatePlanPreMessages: '',
    updatePlanPostMessages: '',
  },
  managedAgent: {
    task: '',
    report: '',
  },
  finalAnswer: {
    preMessages: '',
    postMessages: '',
  },
};

export type RunResultState = 'success' | 'max_steps_error';

export interface TokenUsage {
  [key: string]: number;
}

export class RunResult {
  /**
   * Holds extended information about an agent run.
   *
   * @param output The final output of the agent run, if available.
   * @param state The final state of the agent after the run.
   * @param messages The agent's memory, as a list of messages.
   * @param token_usage Count of tokens used during the run.
   * @param timing Timing details of the agent run: start time, end time, duration.
   */
  output?: any;
  state: RunResultState;
  messages: Array<Record<string, any>>;
  token_usage: TokenUsage | null;
  timing: Timing;

  constructor(params: {
    output?: any;
    state: RunResultState;
    messages: Array<Record<string, any>>;
    token_usage: TokenUsage | null;
    timing: Timing;
  }) {
    if (params.output) this.output = params.output;
    this.state = params.state;
    this.messages = params.messages;
    this.token_usage = params.token_usage;
    this.timing = params.timing;
  }
}

export type StreamEvent =
  | ChatMessageStreamDelta
  | ChatMessageToolCall
  | ActionOutput
  | ToolCall
  | ToolOutput
  | PlanningStep
  | ActionStep
  | FinalAnswerStep;

export interface MultiStepAgentConfig {
  tools: Tool[];
  model: Model;
  promptTemplates?: PromptTemplates;
  instructions?: string;
  maxSteps?: number;
  addBaseTools?: boolean;
  verbosityLevel?: LogLevel;
  grammar?: Record<string, string>;
  managedAgents?: any[];
  stepCallbacks?:
    | Array<CallableFunction>
    | Record<string, CallableFunction | Array<CallableFunction>>;
  planningInterval?: number;
  name?: string;
  description?: string;
  provideRunSummary?: boolean;
  finalAnswerChecks?: Array<CallableFunction>;
  returnFullResult?: boolean;
  logger?: AgentLogger;
}
