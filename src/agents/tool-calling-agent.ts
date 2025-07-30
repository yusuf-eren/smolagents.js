import { MultiStepAgent } from '@/agents/multi-step-agent';
import type { Model } from '@/models';
import { ToolOutput, type Tool, ToolCall } from '@/tools';
import { ActionOutput, type PromptTemplates } from '@/agents/types';
import {
  AgentGenerationError,
  AgentParsingError,
  AgentToolCallError,
  AgentToolExecutionError,
  populateTemplate,
} from '@/utils';

export interface ToolCallingAgentParams {
  tools: Tool[];
  model: Model;
  promptTemplates?: PromptTemplates;
  planningInterval?: number;
  streamOutputs?: boolean;
  maxToolThreads?: number;
  [key: string]: any; // To accept additional kwargs
}

import fs from 'fs';
import yaml from 'js-yaml';
import type { ActionStep } from '@/memory/steps';
import type { ChatMessage, ChatMessageStreamDelta } from '@/models/chat-message';
import { LiveBox, LogLevel, panel } from '@/monitoring';
import { agglomerateStreamDeltas, parseJsonIfNeeded } from '@/models/helpers';
import { AgentImage } from './agent-types';

export function loadPromptTemplates(yamlPath: string, fallback?: any): any {
  if (fs.existsSync(yamlPath)) {
    const fileContents = fs.readFileSync(yamlPath, 'utf8');
    return yaml.load(fileContents);
  }
  return fallback;
}

export class ToolCallingAgent extends MultiStepAgent {
  maxToolThreads: number = 1;

  constructor({
    tools,
    model,
    promptTemplates,
    planningInterval,
    streamOutputs = false,
    maxToolThreads,
    ...kwargs
  }: ToolCallingAgentParams) {
    super({
      tools,
      model,
      // TODO: Test that load prompt templates works.
      promptTemplates: promptTemplates ?? loadPromptTemplates('src/prompts/toolcalling_agent.yaml'),
      streamOutputs,
      ...(planningInterval && { planningInterval }),
      ...kwargs,
    });

    // Streaming setup
    this.streamOutputs = streamOutputs;
    if (this.streamOutputs && !('generateStream' in this.model)) {
      throw new Error(
        '`stream_outputs` is set to True, but the model class implements no `generateStream` method.'
      );
    }

    // Tool calling setup
    if (maxToolThreads) this.maxToolThreads = maxToolThreads;
  }

  initializesystem_prompt(): string {
    const system_prompt = populateTemplate(this.promptTemplates['system_prompt'], {
      tools: this.tools,
      managed_agents: this.managedAgents,
      custom_instructions: this.instructions,
    });
    return system_prompt;
  }

  get toolsAndManagedAgents(): Tool[] {
    // Returns a combined list of tools and managed agents.
    return [
      ...Object.values(this.tools ?? {}),
      ...Object.values(this.managedAgents ?? {}),
    ] as Tool[];
  }

  /**
   * Perform one step in the ReAct framework: the agent thinks, acts, and observes the result.
   * Yields ChatMessageStreamDelta during the run if streaming is enabled.
   * At the end, yields either None if the step is not final, or the final answer.
   */
  protected async *_stepStream(
    memoryStep: ActionStep
  ): AsyncGenerator<ChatMessageStreamDelta | ToolCall | ToolOutput | ActionOutput, any, unknown> {
    const memoryMessages = this.writeMemoryToMessages();
    const inputMessages = [...memoryMessages];
    memoryStep.modelInputMessages = inputMessages;

    let chatMessage: ChatMessage;
    try {
      if (this.streamOutputs && 'generateStream' in this.model) {
        const outputStream = this.model.generateStream({
          messages: inputMessages,
          stopSequences: ['Observation:', 'Calling tools:'],
          toolsToCallFrom: this.toolsAndManagedAgents,
        });

        const chatMessageStreamDeltas: ChatMessageStreamDelta[] = [];
        const live = new LiveBox('', false, this.logger);
        for await (const delta of outputStream) {
          chatMessageStreamDeltas.push(delta);
          live.update(delta.content ?? '', 'md');
          yield delta;
        }
        chatMessage = agglomerateStreamDeltas(chatMessageStreamDeltas);
      } else {
        chatMessage = await this.model.generate({
          messages: inputMessages,
          stopSequences: ['Observation:', 'Calling tools:'],
          toolsToCallFrom: this.toolsAndManagedAgents,
        });
        let logContent: string;
        if (!chatMessage.content && chatMessage.raw) {
          logContent = String(chatMessage.raw);
        } else {
          logContent = String(chatMessage.content) || '';
        }

        this.logger.logMarkdown({
          content: logContent,
          title: 'Output message of the LLM:',
          level: LogLevel.DEBUG,
        });
      }
      memoryStep.modelOutputMessage = chatMessage;
      memoryStep.modelOutput = chatMessage.content ?? '';
      memoryStep.tokenUsage = chatMessage.tokenUsage;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new AgentGenerationError(`Error while generating output:\n${errorMsg}`, this.logger);
    }

    if (!chatMessage.toolCalls || chatMessage.toolCalls.length === 0) {
      try {
        chatMessage = this.model.parseToolCalls(chatMessage);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        throw new AgentParsingError(
          `Error while parsing tool call from model output: ${errorMsg}`,
          this.logger
        );
      }
    } else {
      for (const toolCall of chatMessage.toolCalls) {
        toolCall.function.arguments = parseJsonIfNeeded(toolCall.function.arguments);
      }
    }

    let finalAnswer;
    let gotFinalAnswer = false;

    for await (const output of this._processToolCalls(chatMessage, memoryStep)) {
      yield output;
      if (output instanceof ToolOutput) {
        if (output.isFinalAnswer) {
          if (gotFinalAnswer) {
            throw new AgentToolExecutionError(
              'You returned multiple final answers. Please return only one single final answer!',
              this.logger
            );
          }
          finalAnswer = output.output;
          gotFinalAnswer = true;

          // Manage state variables
          if (typeof finalAnswer === 'string' && finalAnswer in Object.keys(this.state)) {
            finalAnswer = this.state[finalAnswer];
          }
        }
      }
    }

    yield new ActionOutput({
      output: finalAnswer,
      isFinalAnswer: gotFinalAnswer,
    });
  }

  /**
   * Process tool calls from the model output and update agent memory.
   *
   * Args:
   *     chatMessage (`ChatMessage`): Chat message containing tool calls from the model.
   *     memoryStep (`ActionStep`): Memory ActionStep to update with results.
   *
   * Yields:
   *     `ToolCall | ToolOutput`: The tool call or tool output.
   */
  protected async *_processToolCalls(
    chatMessage: ChatMessage,
    memoryStep: ActionStep
  ): AsyncGenerator<ToolOutput | ToolCall, any, unknown> {
    const parallelCalls: Record<string, ToolCall> = {};
    if (!chatMessage.toolCalls || chatMessage.toolCalls.length === 0) {
      throw new Error('chatMessage.toolCalls is None');
    }

    let toolCall: ToolCall;
    // let toolOutput: ToolOutput;

    for (const chatToolCall of chatMessage.toolCalls) {
      toolCall = new ToolCall(
        chatToolCall.function.name,
        chatToolCall.function.arguments,
        chatToolCall.id
      );
      yield toolCall;
      parallelCalls[toolCall.id] = toolCall;
    }
    // TODO: IMPLEMENT RELATED FUNCTIONS

    const outputs: Record<string, ToolOutput> = {};
    const callList = Object.values(parallelCalls);

    if (callList.length === 1) {
      const toolCall = callList[0]!;
      const toolOutput = await this.#processSingleToolCall(toolCall);
      outputs[toolCall.id] = toolOutput;
      yield toolOutput;
    } else {
      const promises = callList.map(call =>
        this.#processSingleToolCall(call).then(result => ({ id: call.id, result }))
      );
      const resolved = await Promise.all(promises);
      for (const { id, result } of resolved) {
        outputs[id] = result;
        yield result;
      }
    }

    memoryStep.toolCalls = callList;
    memoryStep.modelOutput ??= '';
    memoryStep.observations ??= '';

    for (const id of Object.keys(outputs).sort()) {
      const output = outputs[id];
      memoryStep.modelOutput += `Tool call ${output!.id}: calling '${output!.toolCall.name}' with arguments: ${JSON.stringify(output!.toolCall.arguments)}\n`;
      memoryStep.observations += output!.observation + '\n';
    }

    memoryStep.modelOutput = (memoryStep.modelOutput as string).trimEnd();
    memoryStep.observations = (memoryStep.observations as string).trimEnd();
  }

  async #processSingleToolCall(toolCall: ToolCall): Promise<ToolOutput> {
    const toolName = toolCall.name;
    const toolArguments = toolCall.arguments || {};
    this.logger.log(
      panel(
        {
          title: '',
          content: `Calling tool: '${toolName}' with arguments: ${JSON.stringify(toolArguments)}`,
        },
        {}
      ),
      { level: LogLevel.INFO }
    );

    const toolCallResult = await this.#executeToolCall(toolName, toolArguments);

    let observation: string;
    let observationName: string;

    // If audio is implemented, then we need more ifs.
    if ([AgentImage].find(type => toolCallResult instanceof type)) {
      observationName = 'image';
      this.state[observationName] = toolCallResult;
      observation = `Stored '${observationName}' in memory.`;
    } else {
      observation = JSON.stringify(toolCallResult);
    }

    this.logger.log(`Observations: ${observation.replace('[', '|')}`, { level: LogLevel.INFO });

    const isFinalAnswer = toolName === 'final_answer';

    return new ToolOutput({
      id: toolCall.id,
      output: toolCallResult,
      isFinalAnswer,
      observation,
      toolCall,
    });
  }

  protected _substituteStateVariables(
    args: Record<string, any> | string
  ): Record<string, any> | string {
    if (typeof args === 'object' && args !== null) {
      const substituted: Record<string, any> = {};
      for (const [key, value] of Object.entries(args)) {
        substituted[key] = typeof value === 'string' ? (this.state[value] ?? value) : value;
      }
      return substituted;
    }
    return args;
  }

  async #executeToolCall(toolName: string, arguments_: Record<string, any> | string): Promise<any> {
    const availableTools = { ...this.tools, ...this.managedAgents };

    if (!(toolName in availableTools)) {
      const availableNames = Object.keys(availableTools).join(', ');
      throw new AgentToolExecutionError(
        `Unknown tool ${toolName}, should be one of: ${availableNames}.`,
        this.logger
      );
    }

    const tool = availableTools[toolName] as Tool;
    const substitutedArgs = this._substituteStateVariables(arguments_);
    const isManagedAgent = toolName in this.managedAgents;

    const errorMsg = validateToolArguments(tool, substitutedArgs);
    if (errorMsg) {
      throw new AgentToolCallError(errorMsg, this.logger);
    }

    try {
      // TODO: ADD CALL FUNCTION. THE CLASS ITSELF IS NOT CALLABLE.
      if (typeof substitutedArgs === 'object' && substitutedArgs !== null) {
        if (isManagedAgent) {
          return await tool!.call(substitutedArgs);
        } else {
          return await tool.call({ ...substitutedArgs, sanitizeInputsOutputs: true });
        }
      } else {
        if (isManagedAgent) {
          return await tool.call(substitutedArgs as any);
        } else {
          return await tool.call(substitutedArgs as any);
        }
      }
    } catch (e: any) {
      let msg: string;
      if (isManagedAgent) {
        msg =
          `Error executing request to team member '${toolName}' with arguments ${JSON.stringify(substitutedArgs)}: ${e}\n` +
          `Please try again or request to another team member.`;
      } else {
        msg =
          `Error executing tool '${toolName}' with arguments ${JSON.stringify(substitutedArgs)}: ${e.name}: ${e.message}\n` +
          `Please try again or use another tool.`;
      }
      throw new AgentToolExecutionError(msg, this.logger);
    }
  }
}

function getJsonSchemaType(jsType: string): { type: string } {
  const map: Record<string, string> = {
    string: 'string',
    number: 'number',
    boolean: 'boolean',
    object: 'object',
    undefined: 'null',
    function: 'function',
    bigint: 'integer',
  };
  return { type: map[jsType] || 'string' }; // default fallback
}

export function validateToolArguments(tool: Tool, args: any): string | null {
  if (typeof args === 'object' && args !== null && !Array.isArray(args)) {
    for (const [key, value] of Object.entries(args)) {
      if (!(key in tool.inputs)) {
        return `Argument ${key} is not in the tool's input schema.`;
      }

      const actualType = getJsonSchemaType(typeof value).type;
      const expected = tool.inputs[key]!['type'];
      const expectedTypes = Array.isArray(expected) ? expected : [expected];
      const isNullable = tool.inputs[key]!['nullable'] === true;

      const isValid =
        expectedTypes.includes('any') ||
        expectedTypes.includes(actualType) ||
        (actualType === 'null' && isNullable);

      if (!isValid) {
        return `Argument ${key} has type '${actualType}' but should be '${expected}'.`;
      }
    }

    for (const [key, schema] of Object.entries(tool.inputs)) {
      const isNullable = schema['nullable'] === true;
      if (!(key in args) && !isNullable) {
        return `Argument ${key} is required.`;
      }
    }

    return null;
  } else {
    const expectedType = tool.inputs[Object.keys(tool.inputs)[0]!]!['type'];
    const actualType = getJsonSchemaType(typeof args).type;

    if (
      expectedType !== 'any' &&
      !(Array.isArray(expectedType)
        ? expectedType.includes(actualType)
        : expectedType === actualType)
    ) {
      return `Argument has type '${actualType}' but should be '${expectedType}'.`;
    }

    return null;
  }
}
