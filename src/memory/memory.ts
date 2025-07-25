import { ActionStep, PlanningStep, SystemPromptStep, TaskStep } from '@/memory';
import { LogLevel, type AgentLogger } from '@/monitoring';

type MemoryStep = Array<TaskStep | ActionStep | PlanningStep>;

export class AgentMemory {
  systemPrompt: SystemPromptStep;
  steps: MemoryStep;

  constructor(systemPrompt: string) {
    this.systemPrompt = new SystemPromptStep(systemPrompt);
    this.steps = [];
  }

  /**
   * Reset the agent's memory, clearing all steps and keeping the system prompt.
   */
  reset(): void {
    this.steps = [];
  }

  /**
   * Return a succinct representation of the agent's steps, excluding model input messages.
   */
  getSuccinctSteps(): Array<Record<string, any>> {
    return this.steps.map(step => {
      const json = step.toJSON();
      return Object.fromEntries(
        Object.entries(json).filter(([key]) => key !== 'modelInputMessages')
      );
    });
  }

  /**
   * Return a full representation of the agent's steps, including model input messages.
   */
  getFullSteps(): Array<Record<string, any>> {
    if (this.steps.length === 0) {
      return [];
    }
    return this.steps.map(step => step.toJSON());
  }

  /**
   * Prints a pretty replay of the agent's steps.
   * @param logger - The logger to print replay logs to.
   * @param detailed - If true, also displays the memory at each step. Defaults to false.
   *                   Careful: will increase log length exponentially. Use only for debugging.
   */
  replay(logger: AgentLogger, detailed: boolean = false): void {
    logger.console.log('log', "Replaying the agent's steps:");
    logger.logMarkdown({
      title: 'System prompt',
      content: this.systemPrompt.systemPrompt,
      level: LogLevel.ERROR,
    });

    for (const step of this.steps) {
      if (step instanceof TaskStep) {
        logger.logTask({
          content: step.task,
          title: '',
          subtitle: '',
          level: LogLevel.ERROR,
        });
      } else if (step instanceof ActionStep) {
        logger.logRule({
          title: `Step ${step.stepNumber}`,
          level: LogLevel.ERROR,
        });

        if (detailed && step.modelInputMessages) {
          logger.logMessages({
            messages: step.modelInputMessages,
            level: LogLevel.ERROR,
          });
        }

        if (step.modelOutput) {
          logger.logMarkdown({
            title: 'Agent output:',
            content:
              typeof step.modelOutput === 'string'
                ? step.modelOutput
                : JSON.stringify(step.modelOutput),
            level: LogLevel.ERROR,
          });
        }
      } else if (step instanceof PlanningStep) {
        logger.logRule({
          title: 'Planning step',
          level: LogLevel.ERROR,
        });

        if (detailed && step.modelInputMessages) {
          logger.logMessages({
            messages: step.modelInputMessages,
            level: LogLevel.ERROR,
          });
        }

        logger.logMarkdown({
          title: 'Agent output:',
          content: step.plan,
          level: LogLevel.ERROR,
        });
      }
    }
  }

  /**
   * Returns all code actions from the agent's steps, concatenated as a single script.
   */
  returnFullCode(): string {
    return this.steps
      .filter((step): step is ActionStep => step instanceof ActionStep && !!step.codeAction)
      .map(step => step.codeAction)
      .join('\n\n');
  }
}

type StepConstructor<T = any> = new (...args: any[]) => T;
type CallbackFn = (step: any, kwargs?: Record<string, any>) => void;

/**
 * Registry for callbacks that are called at each step of the agent's execution.
 * Callbacks are registered by passing a step class and a callback function.
 */
export class CallbackRegistry {
  private _callbacks: Map<StepConstructor, CallbackFn[]> = new Map();

  register<T>(stepCls: StepConstructor<T>, callback: CallbackFn): void {
    if (!this._callbacks.has(stepCls)) {
      this._callbacks.set(stepCls, []);
    }
    this._callbacks.get(stepCls)!.push(callback);
  }

  callback(step: object, kwargs: Record<string, any> = {}): void {
    let proto = Object.getPrototypeOf(step) as StepConstructor;

    // TODO: Review this part.
    while (proto && proto.constructor !== Object) {
      const ctor = proto.constructor as StepConstructor;
      const callbacks = this._callbacks.get(ctor);

      if (callbacks) {
        for (const cb of callbacks) {
          if (cb.length === 1) cb(step);
          else cb(step, kwargs);
        }
      }

      proto = Object.getPrototypeOf(proto);
    }
  }
}
