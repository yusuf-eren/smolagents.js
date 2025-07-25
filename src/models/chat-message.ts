import { MessageRole, type ChatMessageContent, type ChatMessageToolCall } from '@/models/types';
import type { TokenUsage } from '@/monitoring';

export class ChatMessage {
  role: MessageRole;
  content?: ChatMessageContent;
  toolCalls?: ChatMessageToolCall[];
  raw?: any;
  tokenUsage?: TokenUsage;

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
    if (params.tokenUsage) this.tokenUsage = params.tokenUsage;

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
