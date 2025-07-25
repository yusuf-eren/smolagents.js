import { MemoryStep } from '@/memory';
import { ChatMessage, MessageRole } from '@/models';

export class SystemPromptStep extends MemoryStep {
  systemPrompt: string;

  constructor(systemPrompt: string) {
    super();
    this.systemPrompt = systemPrompt;
  }

  override toMessages(summaryMode: boolean = false): ChatMessage[] {
    if (summaryMode) {
      return [];
    }
    return [
      new ChatMessage({
        role: MessageRole.SYSTEM,
        content: [{ type: 'text', text: this.systemPrompt }],
      }),
    ];
  }
}
