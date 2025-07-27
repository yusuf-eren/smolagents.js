import type { Sharp } from 'sharp';

import type { ActionStepConfig } from '@/memory';
import { MemoryStep } from '@/memory';
import { ChatMessage, MessageRole } from '@/models';
import type { Timing, TokenUsage } from '@/monitoring';
import type { ToolCall } from '@/tools';
import type { AgentError } from '@/utils';
import { makeJsonSerializable } from '@/utils';
import { ActionOutput } from '@/agents';

export class ActionStep extends MemoryStep {
  stepNumber: number;
  timing: Timing;
  modelInputMessages?: ChatMessage[];
  toolCalls?: ToolCall[];
  error?: AgentError;
  modelOutputMessage?: ChatMessage;
  modelOutput?: string | Record<string, any>[];
  codeAction?: string;
  observations?: string;
  observationsImages?: Sharp[];
  actionOutput?: ActionOutput;
  tokenUsage?: TokenUsage;
  isFinalAnswer: boolean = false;

  constructor(config: ActionStepConfig) {
    super();
    this.stepNumber = config.stepNumber;
    this.timing = config.timing;
    if (config.modelInputMessages) this.modelInputMessages = config.modelInputMessages;
    if (config.toolCalls) this.toolCalls = config.toolCalls;
    if (config.error) this.error = config.error;
    if (config.modelOutputMessage) this.modelOutputMessage = config.modelOutputMessage;
    if (config.modelOutput) this.modelOutput = config.modelOutput;
    if (config.codeAction) this.codeAction = config.codeAction;
    if (config.observations) this.observations = config.observations;
    if (config.observationsImages) this.observationsImages = config.observationsImages;
    if (config.actionOutput) this.actionOutput = new ActionOutput(config.actionOutput);
    if (config.tokenUsage) this.tokenUsage = config.tokenUsage;
    if (config.isFinalAnswer) this.isFinalAnswer = config.isFinalAnswer;
  }

  // Override the toJSON method to parse tool_calls and action_output manually
  override toJSON(): Record<string, any> {
    return {
      stepNumber: this.stepNumber,
      timing: this.timing.toJSON(),
      modelInputMessages: this.modelInputMessages,
      toolCalls: this.toolCalls ? this.toolCalls.map(tc => tc.toJSON()) : [],
      error: this.error ? this.error.toJSON() : null,
      modelOutputMessage: this.modelOutputMessage ? this.modelOutputMessage.toJSON() : null,
      modelOutput: this.modelOutput,
      codeAction: this.codeAction,
      observations: this.observations,
      observationsImages: this.observationsImages
        ? this.observationsImages.map(image => image.toBuffer())
        : null,
      actionOutput: makeJsonSerializable(this.actionOutput),
      tokenUsage: this.tokenUsage ? Object.assign({}, this.tokenUsage) : null,
      isFinalAnswer: this.isFinalAnswer,
    };
  }

  override toMessages(summaryMode: boolean = false): ChatMessage[] {
    const messages: ChatMessage[] = [];

    if (this.modelOutput && !summaryMode) {
      messages.push(
        new ChatMessage({
          role: MessageRole.ASSISTANT,
          content: [{ type: 'text', text: this.modelOutput.toString().trim() }],
        })
      );
    }

    if (this.toolCalls) {
      messages.push(
        new ChatMessage({
          role: MessageRole.TOOL_CALL,
          content: [
            {
              type: 'text',
              text:
                'Calling tools:\n' +
                JSON.stringify(
                  this.toolCalls ? this.toolCalls.map(tc => tc.toJSON()) : [],
                  null,
                  2
                ),
            },
          ],
        })
      );
    }

    if (this.observationsImages) {
      messages.push(
        new ChatMessage({
          role: MessageRole.USER,
          content: this.observationsImages.map(image => ({
            type: 'image',
            image: image,
          })),
        })
      );
    }

    if (this.observations) {
      messages.push(
        new ChatMessage({
          role: MessageRole.TOOL_RESPONSE,
          content: [
            {
              type: 'text',
              text: `Observation:\n${this.observations}`,
            },
          ],
        })
      );
    }

    if (this.error) {
      const errorMessage =
        'Error:\n' +
        String(this.error) +
        "\nNow let's retry: take care not to repeat previous errors! If you have retried several times, try a completely different approach.\n";

      let messageContent = this.toolCalls ? `Call id: ${this?.toolCalls?.[0]?.id}\n` : '';
      messageContent += errorMessage;

      messages.push(
        new ChatMessage({
          role: MessageRole.TOOL_RESPONSE,
          content: [{ type: 'text', text: messageContent }],
        })
      );
    }

    return messages;
  }
}
