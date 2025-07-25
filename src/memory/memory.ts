import { ActionStep, PlanningStep, SystemPromptStep, TaskStep } from '@/memory';

export class AgentMemory {
  systemPrompt: SystemPromptStep;
  steps: Array<TaskStep | ActionStep | PlanningStep>;

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
      // Assume each step has a toDict() method similar to Python's dict()
      const dict = typeof step.toDict === 'function' ? step.toDict() : { ...step };
      const { model_input_messages, ...rest } = dict;
      return rest;
    });
  }
}
