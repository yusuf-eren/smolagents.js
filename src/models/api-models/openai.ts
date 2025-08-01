import { ApiModel, type ApiModelConfig } from '@/models/api-models/base';
import { TokenUsage } from '@/monitoring';
import { ChatMessage, ChatMessageStreamDelta } from '@/models/chat-message';
import {
  MessageRole,
  type OpenAIGenerateParams,
  type ChatMessageToolCallFunction,
  type OpenAIGenerateStreamParams,
  toolRoleConversions,
} from '@/models/types';

// Dynamic import helper for dual package support
async function loadOpenAI() {
  try {
    // Try ESM dynamic import first using eval to avoid TS compile-time resolution
    const dynamicImport = eval('(specifier) => import(specifier)');
    const openaiModule = await dynamicImport('openai');
    return openaiModule.default || openaiModule;
  } catch (e1) {
    try {
      // Fallback to require (CommonJS). check if require is available
      if (typeof require !== 'undefined') {
        return require('openai');
      }
      // Last resort: use eval to avoid TypeScript compile-time issues
      const requireFunc = eval('require');
      return requireFunc('openai');
    } catch (e2) {
      throw new Error("Optional dependency 'openai' not installed.");
    }
  }
}

export interface OpenAIServerModelConfig extends ApiModelConfig {
  apiBase?: string;
  apiKey?: string;
  organization?: string;
  project?: string;
  clientOptions?: Record<string, any>;
}

type OpenAIClientType = import('openai').OpenAI;

export class OpenAIServerModel extends ApiModel {
  clientOptions: Record<string, any>;
  override client: OpenAIClientType | null = null;

  constructor({
    modelId,
    flattenMessagesAsText = false,
    customRoleConversions,
    apiBase,
    apiKey,
    organization,
    project,
    clientOptions = {},
    ...rest
  }: OpenAIServerModelConfig) {
    const mergedClientOptions = {
      ...clientOptions,
      apiKey,
      baseURL: apiBase,
      organization,
      project,
    };

    super({
      modelId,
      flattenMessagesAsText,
      customRoleConversions: customRoleConversions ?? toolRoleConversions,
      ...rest,
    });

    this.clientOptions = mergedClientOptions;
  }

  protected async createClient(clientOptions?: Record<string, any>): Promise<OpenAIClientType> {
    try {
      const openaiModule = await loadOpenAI();
      const { OpenAI } = openaiModule;
      const options = clientOptions ?? this.clientOptions;
      return new OpenAI(options) as OpenAIClientType;
    } catch (e) {
      console.error(e);
      throw new Error("Optional dependency 'openai' not installed.");
    }
  }

  private async ensureClient(): Promise<OpenAIClientType> {
    if (!this.client) {
      this.client = await this.createClient();
    }
    return this.client;
  }

  override async generate(params: OpenAIGenerateParams): Promise<ChatMessage> {
    const completionParams = await this.prepareCompletionParams({
      messages: params.messages,
      stopSequences: params.stopSequences ?? null,
      responseFormat: params.responseFormat ?? null,
      toolsToCallFrom: params.toolsToCallFrom ?? null,
      modelId: this.modelId ?? '',
    });

    await this.applyRateLimit();
    const client = await this.ensureClient();
    const response = await client.chat.completions.create({
      model: this.modelId ?? 'gpt-4o-mini',
      messages: completionParams['messages'] ?? [],
      stop: completionParams['stopSequences'] ?? null,
      response_format: completionParams['responseFormat'] ?? null,
      tools: completionParams['toolsToCallFrom'] ?? null,
      ...completionParams,
    });

    // Set last input/output token counts from response usage
    this._lastInputTokenCount = response.usage?.prompt_tokens ?? 0;
    this._lastOutputTokenCount = response.usage?.completion_tokens ?? 0;

    return new ChatMessage({
      role: response.choices[0]?.message.role as MessageRole,
      content: response.choices[0]?.message.content ?? '',
      raw: response,
      toolCalls: response.choices[0]?.message.tool_calls ?? [],
      tokenUsage: new TokenUsage(
        response.usage?.prompt_tokens ?? 0,
        response.usage?.completion_tokens ?? 0
      ),
    });
  }

  override async *generateStream(
    params: OpenAIGenerateStreamParams
  ): AsyncGenerator<ChatMessageStreamDelta> {
    const completionParams = await this.prepareCompletionParams({
      messages: params.messages,
      stopSequences: params.stopSequences ?? null,
      responseFormat: params.responseFormat ?? null,
      toolsToCallFrom: params.toolsToCallFrom ?? null,
      modelId: this.modelId ?? 'gpt-4o-mini',
      flattenMessagesAsText: this.flattenMessagesAsText,
      customRoleConversions: this.customRoleConversions,
      convertImagesToImageUrls: true,
    });

    await this.applyRateLimit();

    const client = await this.ensureClient();
    const stream = await client.chat.completions.create({
      model: this.modelId ?? 'gpt-4o-mini',
      messages: completionParams['messages'] ?? [],
      stop: completionParams['stopSequences'] ?? null,
      response_format: completionParams['responseFormat'] ?? null,
      tools: completionParams['toolsToCallFrom'] ?? null,
      ...completionParams,
      stream: true,
      stream_options: { include_usage: true },
    });

    for await (const event of stream) {
      if (event.usage) {
        this._lastInputTokenCount = event.usage.prompt_tokens;
        this._lastOutputTokenCount = event.usage.completion_tokens;
        yield new ChatMessageStreamDelta({
          content: '',
          tokenUsage: new TokenUsage(
            this._lastInputTokenCount ?? 0,
            this._lastOutputTokenCount ?? 0
          ),
        });
      }

      if (event.choices?.length) {
        const choice = event.choices[0];
        if (choice?.delta) {
          yield new ChatMessageStreamDelta({
            content: choice?.delta.content ?? '',
            toolCalls:
              choice.delta.tool_calls?.map(delta => ({
                index: delta.index,
                id: delta.id ?? '',
                type: delta.type as string,
                function: delta.function as ChatMessageToolCallFunction,
              })) ?? [],
          });
        } else if (!choice?.finish_reason) {
          throw new Error(`No content or tool calls in event: ${JSON.stringify(event)}`);
        }
      }
    }
  }
}
