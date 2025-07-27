import {
  MessageRole,
  type ChatMessageContent,
  type ChatMessageToolCall,
  type ChatMessageToolCallStreamDelta,
} from '@/models/types';
import { TokenUsage } from '@/monitoring';

export class ChatMessage {
  role: MessageRole;
  content?: ChatMessageContent;
  toolCalls?: ChatMessageToolCall[];
  raw?: any;
  tokenUsage: TokenUsage;

  constructor(params: {
    role: MessageRole;
    content?: string | Array<Record<string, any>>;
    toolCalls?: ChatMessageToolCall[];
    raw?: any;
    tokenUsage?: TokenUsage;
  }) {
    this.role = params.role;

    if (params.content) this.content = params.content;
    if (params.raw) this.raw = params.raw;
    this.tokenUsage = params.tokenUsage || new TokenUsage(0, 0);

    if (Array.isArray(params.toolCalls) && params.toolCalls?.length > 0) {
      const toolCalls: ChatMessageToolCall[] = [];
      for (const toolCall of params.toolCalls) {
        const chatMessageToolCall: ChatMessageToolCall = {
          id: toolCall.id,
          type: toolCall.type,
          function: toolCall.function,
        };
        toolCalls.push(chatMessageToolCall);
      }
      this.toolCalls = toolCalls;
    }
  }

  toJSON(): string {
    const json = {
      role: this.role,
      content: this.content,
      toolCalls: this.toolCalls,
      tokenUsage: this.tokenUsage,
    };
    return JSON.stringify(json);
  }

  renderAsMarkdown(): string {
    let rendered = String(this.content) || '';
    if (this.toolCalls) {
      rendered += this.toolCalls
        .map(tool =>
          JSON.stringify({ tool: tool.function.name, arguments: tool.function.arguments })
        )
        .join('\n');
    }
    return rendered;
  }
}

export class ChatMessageStreamDelta {
  content?: string;
  toolCalls?: ChatMessageToolCallStreamDelta[];
  tokenUsage?: TokenUsage;

  constructor(params: {
    content?: string;
    toolCalls?: ChatMessageToolCallStreamDelta[];
    tokenUsage?: TokenUsage;
  }) {
    if (params.content) this.content = params.content;
    if (params.tokenUsage) this.tokenUsage = params.tokenUsage;

    if (Array.isArray(params.toolCalls) && params.toolCalls.length > 0) {
      this.toolCalls = params.toolCalls;
    }
  }

  toJSON(): string {
    return JSON.stringify({
      content: this.content,
      toolCalls: this.toolCalls,
      tokenUsage: this.tokenUsage,
    });
  }

  renderAsMarkdown(): string {
    let rendered = this.content ?? '';
    if (this.toolCalls) {
      rendered +=
        '\n' +
        this.toolCalls
          .map(tool =>
            JSON.stringify({ tool: tool.function?.name, arguments: tool.function?.arguments })
          )
          .join('\n');
    }
    return rendered;
  }
}
