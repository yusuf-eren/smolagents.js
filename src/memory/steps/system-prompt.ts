import { MemoryStep } from '@/memory/steps/memory';
import { ChatMessage, MessageRole } from '@/models';

export class system_promptStep extends MemoryStep {
  system_prompt: string;

  constructor(system_prompt: string) {
    super();
    this.system_prompt = system_prompt;
  }

  override toMessages(summaryMode: boolean = false): ChatMessage[] {
    if (summaryMode) {
      return [];
    }
    return [
      new ChatMessage({
        role: MessageRole.SYSTEM,
        content: [{ type: 'text', text: this.system_prompt }],
      }),
    ];
  }
}
