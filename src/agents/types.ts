import type { ActionStep, FinalAnswerStep, PlanningStep } from '@/memory';
import { type ChatMessageStreamDelta, type ChatMessageToolCall, Model } from '@/models';
import { AgentLogger, LogLevel, Timing, TokenUsage } from '@/monitoring';
import type { ToolCall, ToolOutput } from '@/tools';
import type { Tool } from '@/tools/tool';

export class ActionOutput {
  output: any;
  isFinalAnswer: boolean;

  constructor({ output, isFinalAnswer }: { output: any; isFinalAnswer: boolean }) {
    this.output = output;
    this.isFinalAnswer = isFinalAnswer;
  }
}

export interface PlanningPromptTemplate {
  /**
   * Initial plan prompt.
   */
  initial_plan: string;

  /**
   * Update plan pre-messages prompt.
   */
  update_plan_pre_messages: string;

  /**
   * Update plan post-messages prompt.
   */
  update_plan_post_messages: string;
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
 * @property pre_messages Pre-messages prompt.
 * @property post_messages Post-messages prompt.
 */
export interface FinalAnswerPromptTemplate {
  /**
   * Pre-messages prompt.
   */
  pre_messages: string;

  /**
   * Post-messages prompt.
   */
  post_messages: string;
}

/**
 * Prompt templates for the agent.
 *
 * @property system_prompt System prompt.
 * @property planning Planning prompt templates.
 * @property managed_agent Managed agent prompt templates.
 * @property managed_agent Final answer prompt templates.
 */
export interface PromptTemplates {
  /**
   * System prompt.
   */
  system_prompt: string;

  /**
   * Planning prompt templates.
   */
  planning: PlanningPromptTemplate;

  /**
   * Managed agent prompt templates.
   */
  managed_agent: ManagedAgentPromptTemplate;

  /**
   * Final answer prompt templates.
   */
  final_answer: FinalAnswerPromptTemplate;
}

export const EMPTY_PROMPT_TEMPLATES: PromptTemplates = {
  system_prompt: '',
  planning: {
    initial_plan: '',
    update_plan_pre_messages: '',
    update_plan_post_messages: '',
  },
  managed_agent: {
    task: '',
    report: '',
  },
  final_answer: {
    pre_messages: '',
    post_messages: '',
  },
};

export type RunResultState = 'success' | 'max_steps_error';

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
  token_usage?: TokenUsage;
  timing: Timing;

  constructor(params: {
    output?: any;
    state: RunResultState;
    messages: Array<Record<string, any>>;
    token_usage?: TokenUsage;
    timing: Timing;
  }) {
    if (params.output) this.output = params.output;
    this.state = params.state;
    this.messages = params.messages;
    if (params.token_usage) this.token_usage = params.token_usage;
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
