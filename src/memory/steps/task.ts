import type { Sharp } from 'sharp';

import { MemoryStep } from '@/memory/steps/memory';
import { ChatMessage, MessageRole } from '@/models';

export class TaskStep extends MemoryStep {
  task: string;
  taskImages?: Sharp[] | null;

  constructor(task: string, taskImages?: Sharp[] | null) {
    super();
    this.task = task;
    this.taskImages = taskImages ?? null;
  }

  // NOTE: The `summaryMode` parameter is not used in this implementation but i still want to keep it for future use.
  override toMessages(_summaryMode: boolean = false): ChatMessage[] {
    const content: Record<string, any>[] = [{ type: 'text', text: `New task:\n${this.task}` }];
    if (this.taskImages && this.taskImages.length > 0) {
      content.push(...this.taskImages.map(image => ({ type: 'image', image })));
    }

    return [
      new ChatMessage({
        role: MessageRole.USER,
        content,
      }),
    ];
  }
}
