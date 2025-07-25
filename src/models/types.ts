import type { TokenUsage } from '@/monitoring';
import type { ChatMessage } from '@/models/chat-message';
import type { Tool } from '@/tools';

export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system',
  TOOL_CALL = 'tool-call',
  TOOL_RESPONSE = 'tool-response',
}

export const messageRoles = Object.values(MessageRole);

export const STRUCTURED_GENERATION_PROVIDERS = ['cerebras', 'fireworks-ai'] as const;

export const CODEAGENT_RESPONSE_FORMAT = {
  type: 'json_schema',
  json_schema: {
    schema: {
      additionalProperties: false,
      properties: {
        thought: {
          description: 'A free form text description of the thought process.',
          title: 'Thought',
          type: 'string',
        },
        code: {
          description: 'Valid Python code snippet implementing the thought.',
          title: 'Code',
          type: 'string',
        },
      },
      required: ['thought', 'code'],
      title: 'ThoughtAndCodeAnswer',
      type: 'object',
    },
    name: 'ThoughtAndCodeAnswer',
    strict: true,
  },
} as const;

export interface ChatMessageToolCallFunction {
  arguments: any;
  name: string;
  description?: string;
}

export interface ChatMessageToolCall {
  function: ChatMessageToolCallFunction;
  id: string;
  type: string;
}

export type ChatMessageContent = string | Array<Record<string, any>>;

/**
 * Represents a streaming delta for tool calls during generation.
 */
export interface ChatMessageToolCallStreamDelta {
  index?: number;
  id?: string;
  type?: string;
  function?: ChatMessageToolCallFunction;
}

export interface ChatMessageStreamDelta {
  content?: string;
  toolCalls?: ChatMessageToolCallStreamDelta[];
  tokenUsage?: TokenUsage;
}

export function getMessageRoles(): string[] {
  return Object.values(MessageRole);
}

export const toolRoleConversions: Record<
  MessageRole.TOOL_CALL | MessageRole.TOOL_RESPONSE,
  MessageRole.ASSISTANT | MessageRole.USER
> = {
  [MessageRole.TOOL_CALL]: MessageRole.ASSISTANT,
  [MessageRole.TOOL_RESPONSE]: MessageRole.USER,
};

export interface ModelConfig {
  flattenMessagesAsText?: boolean;
  toolNameKey?: string;
  toolArgumentsKey?: string;
  modelId?: string;
}

export interface PrepareCompletionParams {
  messages: Array<ChatMessage | Record<string, any>>;
  stopSequences?: string[] | null;
  responseFormat?: Record<string, string> | null;
  toolsToCallFrom?: Tool[] | null;
  customRoleConversions?: Record<string, string> | null;
  convertImagesToImageUrls?: boolean;
  flattenMessagesAsText?: boolean;
  toolChoice?: string | Record<string, any> | null;
  modelId?: string;
}

export interface GenerateParams {
  messages: ChatMessage[];
  stopSequences?: string[];
  responseFormat?: Record<string, string>;
  toolsToCallFrom?: Tool[];
}

export interface OpenAIGenerateParams {
  messages: Array<ChatMessage | Record<string, any>>;
  stopSequences?: string[];
  responseFormat?: Record<string, string>;
  toolsToCallFrom?: Tool[];
}
