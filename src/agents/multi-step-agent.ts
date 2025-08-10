import vm2 from 'vm2';
import { Tool, ToolCall, type ToolOutput } from '@/tools';
import { MessageRole, Model } from '@/models';
import {
  AgentLogger,
  LiveBox,
  LogLevel,
  Monitor,
  Timing,
  TokenUsage,
  group,
  rule,
} from '@/monitoring';
import {
  ActionStep,
  AgentMemory,
  CallbackRegistry,
  FinalAnswerStep,
  PlanningStep,
  SystemPromptStep,
  TaskStep,
} from '@/memory';
import {
  EMPTY_PROMPT_TEMPLATES,
  RunResult,
  type PromptTemplates,
  type RunResultState,
  ActionOutput,
} from '@/agents/types';
import { isValidName } from '@/tools/helpers';
import { BaseTool } from '@/tools/tool';
import { FinalAnswerTool, TOOL_MAPPING } from '@/tools/default-tools';
import type { CallbackFn } from '@/memory/memory';
import type { AgentImageValue } from './agent-types/types';
import { AgentImage, handleAgentOutputTypes } from './agent-types';
import { ChatMessage, type ChatMessageStreamDelta } from '@/models/chat-message';
import {
  AgentError,
  AgentGenerationError,
  AgentMaxStepsError,
  AgentParsingError,
  populateTemplate,
} from '@/utils';
import chalk from 'chalk';

interface MultiStepAgentConfig {
  tools: Tool[];
  model: Model;
  promptTemplates?: PromptTemplates;
  instructions?: string;
  maxSteps?: number;
  addBaseTools?: boolean;
  verbosityLevel?: LogLevel;
  grammar?: Record<string, string>;
  managedAgents?: any[];
  stepCallbacks?: CallbackFn[] | Record<string, CallbackFn | CallbackFn[]>;
  planningInterval?: number;
  name?: string;
  description?: string;
  provideRunSummary?: boolean;
  finalAnswerChecks?: Function[];
  returnFullResult?: boolean;
  logger?: AgentLogger;
  streamOutputs?: boolean;
}

export abstract class MultiStepAgent {
  agentName: string;
  model: Model;
  tools?: Record<string, BaseTool>;
  task?: string;
  promptTemplates: PromptTemplates;
  maxSteps: number;
  stepNumber: number;
  grammar?: Record<string, string>;
  planningInterval?: number;
  state: Record<string, any>;
  name?: string;
  description?: string;
  provideRunSummary: boolean;
  finalAnswerChecks: Function[];
  returnFullResult: boolean;
  instructions?: string;
  logger: AgentLogger;
  monitor: Monitor;
  memory: AgentMemory;
  stepCallbacks?: CallbackRegistry;
  streamOutputs?: boolean;
  managedAgents: Record<string, MultiStepAgent> = {};
  interruptSwitch: boolean = false;

  jsExecutor?: vm2.VM; // TODO: Implement a vm (probably vm2)

  constructor(config: MultiStepAgentConfig) {
    this.agentName = this.constructor.name;
    this.model = config.model;
    this.promptTemplates = config.promptTemplates ?? EMPTY_PROMPT_TEMPLATES;
    this.streamOutputs = config.streamOutputs ?? false;

    if (config.promptTemplates) {
      const missingKeys = Object.keys(EMPTY_PROMPT_TEMPLATES).filter(
        key => !(key in config.promptTemplates!)
      );

      if (missingKeys.length > 0) {
        throw new Error(
          `Some prompt templates are missing from your custom \`prompt_templates\`: ${missingKeys.join(', ')}`
        );
      }

      for (const [key, value] of Object.entries(EMPTY_PROMPT_TEMPLATES)) {
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          const requiredSubkeys = Object.keys(value);
          const actualSubkeys = Object.keys(
            config.promptTemplates![key as keyof PromptTemplates] || {}
          );

          for (const subkey of requiredSubkeys) {
            if (!actualSubkeys.includes(subkey)) {
              throw new Error(
                `Some prompt templates are missing from your custom \`prompt_templates\`: ${subkey} under ${key}`
              );
            }
          }
        }
      }
    }

    this.maxSteps = config.maxSteps ?? 20;
    this.stepNumber = 0;

    this.logger = config.logger ?? new AgentLogger(config.verbosityLevel ?? LogLevel.INFO);

    if (config.grammar) {
      // Copied the log from the original library. Will change probably.
      this.logger.log(`Parameter 'grammar' is deprecated and will be removed in version 1.20.`, {
        level: LogLevel.ERROR,
      });
      this.grammar = config.grammar;
    }

    if (config.planningInterval) this.planningInterval = config.planningInterval;
    this.state = {};

    if (config.name) this.name = this.#validateName(config.name);
    if (config.description) this.description = config.description;

    this.provideRunSummary = config.provideRunSummary ?? false;
    this.finalAnswerChecks = config.finalAnswerChecks ?? [];
    this.returnFullResult = config.returnFullResult ?? false;
    if (config.instructions) this.instructions = config.instructions;

    // TODO: Implement these
    this._setupManagedAgents(config.managedAgents);
    this._setupTools(config.tools, config.addBaseTools ?? false);
    this._validateToolsAndManagedAgents(config.tools, config.managedAgents);

    this.memory = new AgentMemory(this.systemPrompt);
    this.monitor = new Monitor(
      this.model.modelId ?? '',
      this.logger ?? new AgentLogger(LogLevel.INFO)
    );
    this._setupStepCallbacks(config.stepCallbacks);
  }

  #validateName(name: string): string {
    if (!isValidName(name)) {
      throw new Error(
        `Agent name '${name}' must be a valid TypeScript identifier and not a reserved keyword.`
      );
    }
    return name;
  }

  protected _setupManagedAgents(managedAgents: any[] | null = null): void {
    this.managedAgents = {};

    if (managedAgents) {
      const allValid = managedAgents.every(agent => agent.name && agent.description);
      if (!allValid) {
        throw new Error('All managed agents need both a name and a description!');
      }

      for (const agent of managedAgents) {
        agent['inputs'] = {
          task: {
            type: 'string',
            description: 'Long detailed description of the task.',
          },
          additional_args: {
            type: 'object',
            description:
              'Dictionary of extra inputs to pass to the managed agent, e.g. images, dataframes, or any other contextual data it may need.',
          },
        };
        agent['output_type'] = 'string';
        this.managedAgents[agent.name] = agent;
      }
    }
  }

  protected _setupTools(tools: Tool[], addBaseTools: boolean): void {
    if (!tools.every(tool => tool instanceof Tool)) {
      throw new Error('All elements must be instance of BaseTool (or a subclass)');
    }

    this.tools = Object.fromEntries(tools.map(tool => [tool.name, tool]));

    if (addBaseTools) {
      for (const [name, ToolClass] of Object.entries(TOOL_MAPPING)) {
        // TODO: JAVASCRIPT CHANGE
        if (name !== 'python_interpreter' || this.constructor.name === 'ToolCallingAgent') {
          // ToolClass is of type unknown, so we need to assert it is a constructor
          this.tools[name] = new (ToolClass as { new (): Tool })();
        }
      }
    }

    if (!this.tools['final_answer']) {
      this.tools['final_answer'] = new FinalAnswerTool();
    }
  }

  protected _validateToolsAndManagedAgents(
    tools: Array<{ name: string }>,
    managedAgents?: Array<{ name: string }>
  ): void {
    const toolAndAgentNames: string[] = tools.map(tool => tool.name);

    if (managedAgents && Array.isArray(managedAgents)) {
      toolAndAgentNames.push(...managedAgents.map(agent => agent.name));
    }

    if (this.name) {
      toolAndAgentNames.push(this.name);
    }

    const duplicates = toolAndAgentNames.filter((name, idx, arr) => arr.indexOf(name) !== idx);

    if (duplicates.length > 0) {
      throw new Error(
        `Each tool or managed agent should have a unique name! You passed these duplicate names: ${[...new Set(duplicates)].join(', ')}`
      );
    }
  }

  protected _setupStepCallbacks(stepCallbacks?: MultiStepAgentConfig['stepCallbacks']): void {
    this.stepCallbacks = new CallbackRegistry();

    if (stepCallbacks) {
      // Backward compatibility: list of callbacks for ActionStep
      if (Array.isArray(stepCallbacks)) {
        for (const callback of stepCallbacks) {
          this.stepCallbacks.register(ActionStep, callback);
        }
      }
      // Dict-style: specific step class => callback(s)
      else if (typeof stepCallbacks === 'object' && stepCallbacks !== null) {
        for (const [stepCls, callbacks] of Object.entries(stepCallbacks)) {
          const cbList = Array.isArray(callbacks) ? callbacks : [callbacks];
          for (const cb of cbList) {
            this.stepCallbacks.register(stepCls as any, cb);
          }
        }
      } else {
        throw new Error('stepCallbacks must be a list or a record');
      }
    }

    // Backward compatibility: always register update_metrics for ActionStep
    this.stepCallbacks.register(ActionStep, this.monitor.updateMetrics.bind(this.monitor));
  }

  set systemPrompt(_: string) {
    throw new Error(
      "The 'system_prompt' property is read-only. Use 'this.promptTemplates[\"system_prompt\"]' instead."
    );
  }

  async run(
    task: string,
    {
      stream = false,
      reset = true,
      images,
      additionalArgs,
      maxSteps,
    }: {
      stream?: boolean;
      reset?: boolean;
      images?: AgentImageValue[];
      additionalArgs?: Record<string, any>;
      maxSteps?: number;
    } = {}
  ): Promise<any> {
    maxSteps = maxSteps ?? this.maxSteps;
    this.task = task;
    this.interruptSwitch = false;
    if (additionalArgs) {
      Object.assign(this.state, additionalArgs);
      this.task += `
        You have been provided with these additional arguments, that you can access directly using the keys as variables:
        ${JSON.stringify(additionalArgs)}.`;
    }

    this.memory.system_prompt = new SystemPromptStep(this.systemPrompt);
    if (reset) {
      this.memory.reset();
      this.monitor.reset();
    }

    this.logger.logTask({
      content: this.task.trim(),
      subtitle: `(${this.model?.constructor?.name} - ${this.model?.modelId ?? ''})`,
      level: LogLevel.INFO,
      title: this.name ?? '',
    });
    this.memory.steps.push(
      new TaskStep(
        this.task,
        images?.map(image => new AgentImage(image).toRaw())
      )
    );

    /** TODO: Implement these lines
     * 
     if getattr(self, "python_executor", None):
        self.python_executor.send_variables(variables=self.state)
        self.python_executor.send_tools({**self.tools, **self.managed_agents})
     */

    if (stream) {
      // The steps are returned as they are executed through a generator to iterate on.
      return this._runStream(
        task,
        maxSteps,
        images?.map(image => new AgentImage(image))
      );
    }
    const runStartTime = Date.now();

    // Run the agent in streaming mode and collect all steps
    const steps: (ActionStep | PlanningStep | FinalAnswerStep | ChatMessageStreamDelta)[] = [];
    for await (const step of await this._runStream(
      this.task!,
      maxSteps,
      images?.map(image => new AgentImage(image))
    )) {
      steps.push(step as any);
    }
    if (steps.length === 0 || !(steps[steps.length - 1] instanceof FinalAnswerStep)) {
      throw new Error('Final step is not a FinalAnswerStep');
    }
    const output = (steps[steps.length - 1] as FinalAnswerStep).output;

    if (this.returnFullResult) {
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      let correctTokenUsage = true;

      for (const step of this.memory.steps) {
        if (step instanceof ActionStep || step instanceof PlanningStep) {
          if (!step.tokenUsage) {
            correctTokenUsage = false;
            break;
          } else {
            totalInputTokens += step.tokenUsage.inputTokens;
            totalOutputTokens += step.tokenUsage.outputTokens;
          }
        }
      }

      let tokenUsage: TokenUsage | undefined;
      if (correctTokenUsage) {
        tokenUsage = new TokenUsage(totalInputTokens, totalOutputTokens);
      }

      let state: RunResultState;
      if (
        this.memory.steps.length > 0 &&
        this.memory.steps[this.memory.steps.length - 1]?.toJSON()?.['error'] instanceof
          AgentMaxStepsError
      ) {
        state = 'max_steps_error';
      } else {
        state = 'success';
      }

      const messages = this.memory.getFullSteps();

      return new RunResult({
        output,
        messages,
        timing: new Timing(runStartTime, Date.now()),
        state,
        ...(tokenUsage && { token_usage: tokenUsage }),
      });
    }

    return output;
  }

  protected async *_runStream(
    task: string,
    maxSteps: number,
    images: AgentImage[] = []
  ): AsyncGenerator<
    | ActionStep
    | PlanningStep
    | FinalAnswerStep
    | ChatMessageStreamDelta
    | ToolCall
    | ToolOutput
    | ActionOutput
  > {
    this.stepNumber = 1;
    let returnedFinalAnswer = false;
    let actionStep: ActionStep | undefined = undefined;
    let finalAnswer: any | undefined = undefined;

    while (!returnedFinalAnswer && this.stepNumber <= maxSteps) {
      if (this.interruptSwitch) {
        throw new AgentError('Agent was interrupted.', this.logger);
      }

      // Run a planning step if scheduled
      if (
        this.planningInterval &&
        (this.stepNumber === 1 || (this.stepNumber - 1) % this.planningInterval === 0)
      ) {
        const planningStartTime = Date.now();
        let planningStep: PlanningStep | undefined = undefined;
        // TODO: Review this.
        for await (const element of this._generatePlanningStep(
          task,
          this.memory.steps.length === 1,
          this.stepNumber
        )) {
          yield element;
          planningStep = element as PlanningStep;
        }
        if (!planningStep || !(planningStep instanceof PlanningStep)) {
          throw new AgentError('Last yielded element should be a PlanningStep', this.logger);
        }
        const planningEndTime = Date.now();
        planningStep.timing = new Timing(planningStartTime, planningEndTime);
        this._finalizeStep(planningStep);
        this.memory.steps.push(planningStep);
      }

      // Start action step!
      const actionStepStartTime = Date.now();
      actionStep = new ActionStep({
        stepNumber: this.stepNumber,
        timing: new Timing(actionStepStartTime),
        observationsImages: images.map(image => image.toRaw()),
      });

      this.logger.logRule({
        title: `Step ${this.stepNumber}`,
        level: LogLevel.INFO,
      });

      try {
        for await (const output of this._stepStream(actionStep)) {
          // Yield all
          yield output;

          if (output instanceof ActionOutput && output.isFinalAnswer) {
            finalAnswer = output.output;
            this.logger.log(chalk.hex('#FFD600')(`Final answer: ${finalAnswer}`), {
              level: LogLevel.INFO,
            });

            if (this.finalAnswerChecks && this.finalAnswerChecks.length > 0) {
              await this._validateFinalAnswer(finalAnswer);
            }
            returnedFinalAnswer = true;
            actionStep.isFinalAnswer = true;
          }
        }
      } catch (e: any) {
        if (e instanceof AgentGenerationError) {
          // Agent generation errors are not caused by a Model error but an implementation error: so we should raise them and exit.
          throw e;
        } else if (e instanceof AgentError) {
          // Other AgentError types are caused by the Model, so we should log them and iterate.
          actionStep.error = e;
        }
      } finally {
        this._finalizeStep(actionStep);
        this.memory.steps.push(actionStep);
        yield actionStep;
        this.stepNumber += 1;
      }
    }

    // TODO: review this part.
    if (!returnedFinalAnswer && this.stepNumber === maxSteps + 1) {
      finalAnswer = await this._handleMaxStepsReached(task, images);
      this.logger.log(chalk.hex('#FFD600')(`Final answer: ${finalAnswer}`), {
              level: LogLevel.INFO,
            });
      yield actionStep!;
    }
    // TODO: Review also this `handleAgentOutputTypes` function.
    yield new FinalAnswerStep(handleAgentOutputTypes(finalAnswer));
    /*
     if not returned_final_answer and self.step_number == max_steps + 1:
            final_answer = self._handle_max_steps_reached(task, images)
            yield action_step
        yield FinalAnswerStep(handle_agent_output_types(final_answer))
    */
  }

  protected async _handleMaxStepsReached(task: string, images: AgentImage[]): Promise<any> {
    const actionStepStartTime = Date.now();
    const finalAnswer = await this._provideFinalAnswer(task, images);
    const finalMemoryStep = new ActionStep({
      stepNumber: this.stepNumber,
      error: new AgentMaxStepsError('Reached max steps.', this.logger),
      timing: new Timing(actionStepStartTime, Date.now()),
      tokenUsage: finalAnswer.tokenUsage,
    });
    finalMemoryStep.actionOutput = finalAnswer.content;
    this._finalizeStep(finalMemoryStep);
    this.memory.steps.push(finalMemoryStep);
    return finalAnswer.content;
  }

  protected async *_generatePlanningStep(
    task: string,
    isFirstStep: boolean,
    stepNumber: number
  ): AsyncGenerator<PlanningStep | ChatMessageStreamDelta> {
    const startTime = Date.now();
    let inputMessages: ChatMessage[] = [];
    let plan: string = '';

    let inputTokens = 0;
    let outputTokens = 0;

    let planMessageContent: string = '';

    if (isFirstStep) {
      inputMessages = [
        new ChatMessage({
          role: MessageRole.USER,
          content: [
            {
              type: 'text',
              text: populateTemplate(this.promptTemplates['planning']['initial_plan'], {
                task,
                tools: this.tools ?? {},
                managedAgents: this.managedAgents ?? {},
              }),
            },
          ],
        }),
      ];

      if (this.streamOutputs && 'generateStream' in this.model) {
        inputTokens = 0;
        outputTokens = 0;

        const live = new LiveBox('', false, this.logger);
        const outputStream = this.model.generateStream({
          messages: inputMessages,
          stopSequences: ['<end_plan>'],
        });
        for await (const event of outputStream) {
          if (event.content !== undefined && event.content !== null) {
            planMessageContent += event.content;
            live.update(planMessageContent, 'md');
            if (event.tokenUsage) {
              outputTokens += event.tokenUsage.outputTokens;
              inputTokens = event.tokenUsage.inputTokens;
            }
            yield event as ChatMessageStreamDelta;
          }
        }
      } else {
        const planMessage = await this.model.generate({
          messages: inputMessages,
          stopSequences: ['<end_plan>'],
        });
        planMessageContent = planMessage.content as string;
        inputTokens = planMessage.tokenUsage?.inputTokens ?? 0;
        outputTokens = planMessage.tokenUsage?.outputTokens ?? 0;
      }
      plan = `Here are the facts I know and the plan of action that I will follow to solve the task:\n\`\`\`\n${planMessageContent}\n\`\`\``;
    } else {
      // Summary mode removes the system prompt and previous planning messages output by the model.
      // Removing previous planning messages avoids influencing too much the new plan.
      const memoryMessages = this.writeMemoryToMessages(true);
      const planUpdatePre = new ChatMessage({
        role: MessageRole.SYSTEM,
        content: [
          {
            type: 'text',
            text: populateTemplate(this.promptTemplates['planning']['update_plan_pre_messages'], {
              task,
            }),
          },
        ],
      });
      const planUpdatePost = new ChatMessage({
        role: MessageRole.SYSTEM,
        content: [
          {
            type: 'text',
            text: populateTemplate(this.promptTemplates['planning']['update_plan_post_messages'], {
              task: task,
              tools: this.tools ?? {},
              managedAgents: this.managedAgents ?? {},
              remainingSteps: this.maxSteps - stepNumber,
            }),
          },
        ],
      });

      inputMessages = [planUpdatePre, ...memoryMessages, planUpdatePost];

      if (this.streamOutputs && 'generateStream' in this.model) {
        inputTokens = 0;
        outputTokens = 0;

        const live = new LiveBox('', false, this.logger);
        const outputStream = this.model.generateStream({
          messages: inputMessages,
          stopSequences: ['<end_plan>'],
        });

        for await (const event of outputStream) {
          if (event.content !== undefined && event.content !== null) {
            planMessageContent += event.content;
            live.update(planMessageContent, 'md');
            if (event.tokenUsage) {
              outputTokens += event.tokenUsage.outputTokens;
              inputTokens = event.tokenUsage.inputTokens;
            }
            yield event as ChatMessageStreamDelta;
          }
        }
      } else {
        const planMessage = await this.model.generate({
          messages: inputMessages,
          stopSequences: ['<end_plan>'],
        });
        planMessageContent = planMessage.content as string;
        inputTokens = planMessage.tokenUsage?.inputTokens ?? 0;
        outputTokens = planMessage.tokenUsage?.outputTokens ?? 0;
      }

      plan = `I still need to solve the task I was given:\n\`\`\`\n${task}\n\`\`\`\n\nHere are the facts I know and my new/updated plan of action to solve the task:\n\`\`\`\n${planMessageContent}\n\`\`\``;
    }

    const logHeadline = isFirstStep ? 'Initial plan' : `Updated plan`;
    this.logger.log(
      group([
        rule({
          title: logHeadline,
          bold: true,
          textColor: 'orange',
        }),
        plan,
      ]),
      { level: LogLevel.INFO }
    );

    yield new PlanningStep({
      modelInputMessages: inputMessages,
      plan,
      modelOutputMessage: new ChatMessage({
        role: MessageRole.ASSISTANT,
        content: planMessageContent,
      }),
      tokenUsage: new TokenUsage(inputTokens, outputTokens),
      timing: new Timing(startTime, Date.now()),
    });
  }

  protected async _validateFinalAnswer(finalAnswer: any): Promise<void> {
    for (const checkFunction of this.finalAnswerChecks) {
      try {
        if (!(await checkFunction(finalAnswer, this.memory))) {
          throw new Error(`Check ${checkFunction.name} returned false`);
        }
      } catch (e: any) {
        throw new AgentError(
          `Check ${checkFunction.name} failed with error: ${e.message || e}`,
          this.logger
        );
      }
    }
  }

  protected _finalizeStep(memoryStep: ActionStep | PlanningStep) {
    memoryStep.timing.endTime = Date.now();
    this.stepCallbacks?.callback(memoryStep, {
      agent: this, // TODO: Need to be tested. not sure if this is the correct way to pass the agent.
    });
  }

  /**
   * To be implemented in child classes.
   * Should initialize and return the system prompt string.
   */
  abstract initializeSystemPrompt(): string;

  /**
   *
   */
  get systemPrompt(): string {
    return this.initializeSystemPrompt();
  }

  /**
   * Interrupts the agent execution.
   */
  interrupt(): void {
    this.interruptSwitch = true;
  }

  /**
   * Reads past llm_outputs, actions, and observations or errors from the memory into a series of messages
   * that can be used as input to the LLM. Adds a number of keywords (such as PLAN, error, etc) to help
   * the LLM.
   */
  writeMemoryToMessages(summaryMode: boolean = false): ChatMessage[] {
    let messages: ChatMessage[] = this.memory.system_prompt.toMessages(summaryMode);
    for (const memoryStep of this.memory.steps) {
      messages = messages.concat(memoryStep.toMessages(summaryMode));
    }
    return messages;
  }

  /**
   * Perform one step in the ReAct framework: the agent thinks, acts, and observes the result.
   * Yields ChatMessageStreamDelta during the run if streaming is enabled.
   * At the end, yields either null if the step is not final, or the final answer.
   *
   * This method should be implemented in child classes.
   */
  protected abstract _stepStream(
    memoryStep: ActionStep
  ): AsyncGenerator<ChatMessageStreamDelta | ToolCall | ToolOutput | ActionOutput>;

  /**
   * Perform one step in the ReAct framework: the agent thinks, acts, and observes the result.
   * Returns either null if the step is not final, or the final answer.
   */
  async step(
    memoryStep: ActionStep
  ): Promise<ChatMessageStreamDelta | ToolCall | ToolOutput | ActionOutput | null> {
    let lastOutput: ChatMessageStreamDelta | ToolCall | ToolOutput | ActionOutput | null = null;

    for await (const output of this._stepStream(memoryStep)) {
      lastOutput = output;
    }

    return lastOutput;
  }

  /**
   * Parses the action section from the LLM output using a specific split token.
   *
   * @param modelOutput - Output string from the LLM.
   * @param splitToken - Separator for the action. Should match the example in the system prompt.
   * @returns A tuple containing the rationale and the action string.
   * @throws AgentParsingError if the split token is not found in the output.
   */
  protected _extractAction(modelOutput: string, splitToken: string): [string, string] {
    const split = modelOutput.split(splitToken);

    if (split.length < 2) {
      throw new AgentParsingError(
        `No '${splitToken}' token provided in your output.\nYour output:\n${modelOutput}\nBe sure to include an action, prefaced with '${splitToken}'!`,
        this.logger
      );
    }

    // Using elements from the end of the split array ensures correctness
    // even if the splitToken appears multiple times in the output.
    const rationale = split[split.length - 2]!;
    const action = split[split.length - 1]!;

    return [rationale.trim(), action.trim()];
  }

  /**
   * Provide the final answer to the task, using memory and prompt templates.
   *
   * @param task - The original task string.
   * @param images - Optional list of AgentImage objects used in prior steps.
   * @returns A ChatMessage representing the final answer from the model.
   */
  protected async _provideFinalAnswer(task: string, images: AgentImage[]): Promise<ChatMessage> {
    // Start with the SYSTEM message and pre-message content

    const messages: ChatMessage[] = [
      new ChatMessage({
        role: MessageRole.SYSTEM,
        content: [
          {
            type: 'text',
            text: this.promptTemplates['final_answer']['pre_messages'],
          },
          ...(images?.map(image => ({ type: 'image', image })) ?? []),
        ],
      }),
    ];

    // Add memory messages (excluding the first which we just created)
    const memoryMessages = this.writeMemoryToMessages().slice(1);
    messages.push(...memoryMessages);

    // Create the USER message with the final prompt
    messages.push(
      new ChatMessage({
        role: MessageRole.USER,
        content: [
          {
            type: 'text',
            text: populateTemplate(this.promptTemplates['final_answer']['post_messages'], { task }),
          },
        ],
      })
    );

    // Try generating the final message from the model
    try {
      return this.model.generate({
        messages,
      });
    } catch (e: any) {
      return new ChatMessage({
        role: MessageRole.ASSISTANT,
        content: [
          {
            type: 'text',
            text: `Error in generating final LLM output: ${e.message || e}`,
          },
        ],
      });
    }
  }

  /**
   * Creates a rich tree visualization of the agent's structure.
   */
  visualize() {
    this.logger.visualizeAgentTree(this);
  }

  /**
   * Prints a pretty replay of the agent's steps.
   * @param detailed If true, also displays the memory at each step. Careful: will increase log length exponentially. Use only for debugging.
   */
  replay(detailed: boolean = false) {
    this.memory.replay(this.logger, detailed);
  }

  /**
   * Adds additional prompting for the managed agent, runs it, and wraps the output.
   * This method is called only by a managed agent.
   */
  async call(task: string, kwargs: Record<string, any> = {}): Promise<string> {
    // Compose the full task prompt for the managed agent
    const fullTask = populateTemplate(this.promptTemplates['managed_agent']['task'], {
      name: this.name ?? '',
      task,
    });

    const result = await this.run(fullTask, kwargs);
    let report: any;
    if (result instanceof RunResult) {
      report = result.output;
    } else {
      report = result;
    }

    // Compose the answer using the report
    let answer = populateTemplate(this.promptTemplates['managed_agent']['report'], {
      name: this.name ?? '',
      finalAnswer: report,
    });

    // Optionally append a summary of the agent's work
    if (this.provideRunSummary) {
      answer +=
        "\n\nFor more detail, find below a summary of this agent's work:\n<summary_of_work>\n";
      // Helper to truncate content for summary
      const truncateContent = (content: string, maxLength = 500) =>
        content.length > maxLength ? content.slice(0, maxLength) + '...' : content;

      for (const message of this.writeMemoryToMessages(true)) {
        const content = message.content;
        answer += '\n' + truncateContent(String(content)) + '\n---';
      }
      answer += '\n</summary_of_work>';
    }

    return answer;
  }

  // Implement missing functions. (Check other functions too. idk i didn't count all functions.):
  // TODO: fromHub
  // TODO: fromFolder

  /**
   * Pushes the agent to the Hub.
   * @param repoId - The repository ID to push to.
   * @param commitMessage - The commit message to push to the Hub.
   * @param privateRepo - Whether the repository should be private.
   * @param token - The token to use to push to the Hub.
   * @param createPR - Whether to create a pull request to the Hub.
   */
  // async pushToHub({
  //   repoId,
  //   commitMessage = 'Upload agent',
  //   privateRepo,
  //   token,
  //   createPR,
  // }: {
  //   repoId: string;
  //   commitMessage?: string;
  //   privateRepo?: boolean;
  //   token?: string;
  //   createPR?: boolean;
  // }): Promise<void> {
  //   if (!token) {
  //     throw new Error('Token is required to push to Hub');
  //   }

  //   const repo = await createRepo({
  //     repo: repoId,
  //     accessToken: token,
  //     private: privateRepo ?? false,
  //     sdk: 'gradio',
  //   });

  //   repoId = repo.repoUrl.split('/').pop()!;

  //   // TODO: Continue here. Some functions are not yet implemented in @huggingface/hub lib.
  //   // We may need to use node:fetch
  // }
}
