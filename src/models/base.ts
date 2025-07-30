import {
  MessageRole,
  type ChatMessage,
  type GenerateParams,
  type ModelConfig,
  type PrepareCompletionParams,
  type ChatMessageStreamDelta,
} from '@/models';
import {
  getCleanMessageList,
  getToolCallFromText,
  getToolJsonSchema,
  parseJsonIfNeeded,
  supportsStopParameter,
} from '@/models/helpers';
import { toolRoleConversions } from '@/models/types';

export class Model {
  flattenMessagesAsText: boolean;
  toolNameKey: string;
  toolArgumentsKey: string;
  modelId?: string;

  protected _lastInputTokenCount: number | null = null;
  protected _lastOutputTokenCount: number | null = null;

  constructor(config: ModelConfig = {}) {
    this.flattenMessagesAsText = config.flattenMessagesAsText ?? false;
    this.toolNameKey = config.toolNameKey ?? 'name';
    this.toolArgumentsKey = config.toolArgumentsKey ?? 'arguments';
    if (config.modelId) this.modelId = config.modelId;
  }

  get lastInputTokenCount(): number | null {
    // Those consoles are from the original codebase, so we keep them for now.
    console.warn(
      'lastInputTokenCount is deprecated and will be removed in version 1.20. ' +
        'Please use tokenUsage.input_tokens instead.'
    );
    return this._lastInputTokenCount;
  }

  get lastOutputTokenCount(): number | null {
    // Those consoles are from the original codebase, so we keep them for now.
    console.warn(
      'lastOutputTokenCount is deprecated and will be removed in version 1.20. ' +
        'Please use tokenUsage.output_tokens instead.'
    );
    return this._lastOutputTokenCount;
  }

  /**
   * Prepares the completion kwargs for a model call.
   *
   * @param params - The parameters for preparing completion kwargs.
   * @returns An object containing the completion kwargs.
   */
  async prepareCompletionParams({
    messages,
    stopSequences = null,
    responseFormat = null,
    toolsToCallFrom = null,
    customRoleConversions = null,
    convertImagesToImageUrls = false,
    flattenMessagesAsText,
    toolChoice = 'required',
    modelId = '',
  }: PrepareCompletionParams): Promise<Record<string, any>> {
    // Standardize message list
    const messagesAsDicts = await getCleanMessageList(
      messages,
      customRoleConversions ?? toolRoleConversions,
      convertImagesToImageUrls,
      flattenMessagesAsText
    );

    // Build base completion params
    const completionParams: Record<string, any> = {
      messages: messagesAsDicts,
    };

    // Add stop sequences only if model supports it
    if (stopSequences && supportsStopParameter(modelId)) {
      completionParams['stop'] = stopSequences;
    }

    // Add response format if provided
    if (responseFormat) {
      completionParams['response_format'] = responseFormat;
    }

    // Add tools and optional tool_choice
    if (toolsToCallFrom?.length) {
      completionParams['tools'] = toolsToCallFrom.map(getToolJsonSchema);
      if (toolChoice !== null) {
        completionParams['tool_choice'] = toolChoice;
      }
    }

    return completionParams;
  }

  /**
   * Process the input messages and return the model's response.
   * Must be implemented in subclasses.
   *
   * @param messages - A list of chat messages.
   * @param stopSequences - Optional stop sequences.
   * @param responseFormat - Optional response format.
   * @param toolsToCallFrom - Optional list of tools.
   * @returns A ChatMessage representing the model's response.
   */
  generate(_params: GenerateParams): Promise<ChatMessage> {
    throw new Error('generate() must be implemented in child classes');
  }

  async *generateStream(_params: GenerateParams): AsyncGenerator<ChatMessageStreamDelta> {
    throw new Error('generateStream() must be implemented in child classes');
  }

  call(args: Parameters<this['generate']>[0], stream: false): ReturnType<this['generate']>;
  call(
    args: Parameters<this['generateStream']>[0],
    stream: true
  ): ReturnType<this['generateStream']>;
  call(
    args: Parameters<this['generate']>[0],
    stream: boolean = false
  ): ReturnType<this['generate']> | ReturnType<this['generateStream']> {
    if (stream) {
      return this.generateStream(args) as ReturnType<this['generateStream']>;
    } else {
      return this.generate(args) as ReturnType<this['generate']>;
    }
  }

  parseToolCalls(message: ChatMessage): ChatMessage {
    message.role = MessageRole.ASSISTANT;

    if (!message.toolCalls || message.toolCalls.length === 0) {
      if (!message.content) {
        throw new Error('Message contains no content and no tool calls');
      }

      const text =
        typeof message.content === 'string'
          ? message.content
          : message.content
              .filter((c: any) => c['type'] === 'text' && typeof c['text'] === 'string')
              .map((c: any) => c['text'])
              .join('\n')
              .trim();

      message.toolCalls = [getToolCallFromText(text, this.toolNameKey, this.toolArgumentsKey)];
    }

    if (message.toolCalls.length === 0) {
      throw new Error('No tool call was found in the model output');
    }

    for (const toolCall of message.toolCalls) {
      toolCall.function.arguments = parseJsonIfNeeded(toolCall.function.arguments);
    }

    return message;
  }
}
