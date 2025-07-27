import type { PlanningStepConfig } from '@/memory';
import { MemoryStep } from '@/memory/steps/memory';
import { ChatMessage, MessageRole } from '@/models';
import type { Timing, TokenUsage } from '@/monitoring';

export class PlanningStep extends MemoryStep {
  modelInputMessages: ChatMessage[];
  modelOutputMessage: ChatMessage;
  plan: string;
  timing: Timing;
  tokenUsage?: TokenUsage;

  constructor(params: PlanningStepConfig) {
    super();
    this.modelInputMessages = params.modelInputMessages;
    this.modelOutputMessage = params.modelOutputMessage;
    this.plan = params.plan;
    this.timing = params.timing;
    if (params.tokenUsage) this.tokenUsage = params.tokenUsage;
  }

  override toMessages(summaryMode: boolean = false): ChatMessage[] {
    if (summaryMode) {
      return [];
    }
    return [
      new ChatMessage({
        role: MessageRole.ASSISTANT,
        content: [{ type: 'text', text: this.plan.trim() }],
      }),
      new ChatMessage({
        role: MessageRole.USER,
        content: [
          {
            type: 'text',
            text: 'Now proceed and carry out this plan.',
          },
        ],
      }),
    ];
  }
}
