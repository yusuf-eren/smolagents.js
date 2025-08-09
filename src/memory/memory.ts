import { ActionStep, PlanningStep, SystemPromptStep, TaskStep } from '@/memory/steps';
import type { MemoryStepTypes } from '@/memory/types';
import { LogLevel, type AgentLogger } from '@/monitoring';

export class AgentMemory {
  system_prompt: SystemPromptStep;
  steps: MemoryStepTypes;

  constructor(system_prompt: string) {
    this.system_prompt = new SystemPromptStep(system_prompt);
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

    // Store the current logger level as user may have closed it
    var loggerLevel = logger.level;

    //Change logger level to INFO just for replay
    logger.level = LogLevel.INFO;

    logger.console.log(LogLevel.INFO, "Replaying the agent's steps:");
    logger.logMarkdown({
      title: 'System prompt',
      content: this.system_prompt.system_prompt,
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
    // Restore the original logger level
    logger.level = loggerLevel;
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

export type StepConstructor = new (...args: any[]) => any;
export type CallbackFn = (step: any, ...args: any[]) => void;

/**
 * Registry for callbacks that are called at each step of the agent's execution.
 * Callbacks are registered by passing a step class and a callback function.
 */
export class CallbackRegistry {
  private _callbacks: Map<string, CallbackFn[]> = new Map();

  /**
   * Register a callback for a step class.
   *
   * @param stepCls Step class to register the callback for
   * @param callback Callback function to register
   */
  register(stepCls: StepConstructor, callback: CallbackFn): void {
    const className = stepCls.name;

    if (!this._callbacks.has(className)) {
      this._callbacks.set(className, []);
    }
    this._callbacks.get(className)!.push(callback);
  }

  callback(step: object, kwargs: Record<string, any> = {}): void {
    // Get the inheritance chain (equivalent to Python's __mro__)
    const mro: any[] = [];
    let current = step.constructor;

    // Build the method resolution order (inheritance chain)
    while (current && current !== Object) {
      mro.push(current);
      current = Object.getPrototypeOf(current);
    }

    // For each class in the inheritance chain, call registered callbacks
    for (const cls of mro) {
      const callbacks = this._callbacks.get(cls.name);

      if (callbacks) {
        for (const cb of callbacks) {
          // For backwards compatibility: single parameter vs multiple parameters
          if (cb.length === 1) {
            cb(step);
          } else {
            cb(step, kwargs);
          }
        }
      }
    }
  }
}
