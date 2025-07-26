/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import type { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';

import {
  MessageRole,
  ChatMessage,
  messageRoles,
  type ChatMessageStreamDelta,
  type ChatMessageToolCallStreamDelta,
  type ChatMessageToolCall,
  type ChatMessageContent,
} from '@/models';
import { TokenUsage } from '@/monitoring';
import { Tool } from '@/tools';
import type { ToolInputs } from '@/tools/types';
import { encodeImageBase64, makeImageUrl } from '@/utils';

/**
 * Agglomerate a list of stream deltas into a single stream delta.
 */
export function agglomerateStreamDeltas(
  streamDeltas: ChatMessageStreamDelta[],
  role: MessageRole = MessageRole.ASSISTANT
): ChatMessage {
  const accumulatedToolCalls: Record<number, ChatMessageToolCallStreamDelta> = {};
  let accumulatedContent = '';
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (const streamDelta of streamDeltas) {
    if (streamDelta.tokenUsage) {
      totalInputTokens += streamDelta.tokenUsage.inputTokens;
      totalOutputTokens += streamDelta.tokenUsage.outputTokens;
    }

    if (streamDelta.content) {
      accumulatedContent += streamDelta.content;
    }

    if (streamDelta.toolCalls) {
      for (const toolCallDelta of streamDelta.toolCalls) {
        if (toolCallDelta.index !== undefined && toolCallDelta.index !== null) {
          if (!(toolCallDelta.index in accumulatedToolCalls)) {
            accumulatedToolCalls[toolCallDelta.index] = {
              id: toolCallDelta.id ?? '',
              type: toolCallDelta.type ?? '',
              function: {
                name: '',
                arguments: '',
              },
            };
          }

          const toolCall = accumulatedToolCalls[toolCallDelta.index];

          if (toolCall) {
            if (toolCallDelta?.id) {
              toolCall.id = toolCallDelta.id;
            }

            if (toolCallDelta?.type) {
              toolCall.type = toolCallDelta.type;
            }

            if (toolCallDelta.function) {
              if (toolCallDelta.function.name && toolCallDelta.function.name.length > 0) {
                toolCall.function!.name = toolCallDelta.function.name;
              }
              if (toolCallDelta.function.arguments) {
                toolCall.function!.arguments += toolCallDelta.function.arguments;
              }
            }
          }
        } else {
          throw new Error(
            `Tool call index is not provided in tool delta: ${JSON.stringify(toolCallDelta)}`
          );
        }
      }
    }
  }

  const toolCalls: ChatMessageToolCall[] = Object.values(accumulatedToolCalls)
    .filter(delta => delta.function)
    .map(delta => ({
      function: {
        name: delta.function!.name,
        arguments: delta.function!.arguments,
      },
      id: delta.id ?? '',
      type: 'function',
    }));

  return new ChatMessage({
    role,
    content: accumulatedContent,
    toolCalls,
    tokenUsage: new TokenUsage(totalInputTokens, totalOutputTokens),
  });
}

export function getToolJsonSchema(tool: Tool): Record<string, any> {
  const properties = JSON.parse(JSON.stringify(tool.inputs)) as ToolInputs; // deep clone
  const required: string[] = [];

  for (const [key, value] of Object.entries(properties)) {
    if (value['type'] === 'any') {
      value['type'] = 'string';
    }

    if (!('nullable' in value && value['nullable'])) {
      required.push(key);
    }
  }

  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object',
        properties,
        required,
      },
    },
  };
}

export function removeStopSequences(content: string, stopSequences: string[]): string {
  for (const stopSeq of stopSequences) {
    if (content.endsWith(stopSeq)) {
      content = content.slice(0, -stopSeq.length);
    }
  }
  return content;
}

export async function getCleanMessageList(
  messageList: Array<ChatMessage | Record<string, any>>,
  roleConversions: Record<MessageRole | string, MessageRole | string> = {},
  convertImagesToImageUrls: boolean = false,
  flattenMessagesAsText: boolean = false
): Promise<Array<Record<string, any>>> {
  const outputMessageList: Array<Record<string, any>> = [];
  const messageListCopy = JSON.parse(JSON.stringify(messageList)) as Array<
    ChatMessage | Record<string, any>
  >;

  for (let message of messageListCopy) {
    if (!(message instanceof ChatMessage)) {
      message = new ChatMessage({
        role: message['role'],
        content: message['content'],
        toolCalls: message['toolCalls'],
        tokenUsage: message['tokenUsage'],
        raw: message['raw'],
      });
    }

    const role = message.role as MessageRole;
    if (!messageRoles.includes(role)) {
      throw new Error(
        `Incorrect role "${role}", only ${messageRoles.join(', ')} are supported for now.`
      );
    }

    // Convert role if needed
    if (roleConversions[role]) {
      message.role = roleConversions[role];
    }

    // Encode images if needed
    if (Array.isArray(message.content)) {
      for (const element of message.content as ChatMessageContent) {
        if (typeof element !== 'object' || element === null) {
          throw new Error('This element should be an object: ' + JSON.stringify(element));
        }

        if (element['type'] === 'image') {
          if (flattenMessagesAsText) {
            throw new Error(`Cannot use images with flattenMessagesAsText=true`);
          }

          if (convertImagesToImageUrls) {
            const base64 = await encodeImageBase64(element['image'] as Buffer);
            element['type'] = 'image_url';
            element['image_url'] = { url: makeImageUrl(base64) };
            delete element['image'];
          } else {
            element['image'] = await encodeImageBase64(element['image'] as Buffer);
          }
        }
      }
    }

    if (
      outputMessageList?.length > 0 &&
      message.role === outputMessageList[outputMessageList.length - 1]?.['role']
    ) {
      if (!Array.isArray(message.content)) {
        throw new Error('Error: wrong content:' + String(message.content));
      }

      if (flattenMessagesAsText) {
        // Merge text content as a single string
        const textToMerge = '\n' + (message.content as Array<Record<string, any>>)[0]!['text'];
        const length = outputMessageList?.length - 1;
        outputMessageList[length]!['content'] += textToMerge;
      } else {
        for (const el of message.content) {
          const lastContent = outputMessageList[outputMessageList.length - 1]!['content'];
          if (el.type === 'text' && lastContent[lastContent.length - 1]!['type'] === 'text') {
            // Merge consecutive text messages rather than creating new ones
            lastContent[lastContent.length - 1]['text'] += '\n' + el['text'];
          } else {
            outputMessageList[outputMessageList.length - 1]!['content'].push(el);
          }
        }
      }
    } else {
      let content: ChatMessageContent;
      if (flattenMessagesAsText) {
        content = (message.content as Array<Record<string, any>>)[0]!['text'];
      } else {
        content = message.content;
      }
      outputMessageList.push({
        role: message.role,
        content: content,
      });
    }
  }

  return outputMessageList;
}

export function parseJsonBlob(jsonBlob: string): [Record<string, any>, string] {
  try {
    const firstBraceIndex = jsonBlob.indexOf('{');
    const closingBraces = [...jsonBlob.matchAll(/}/g)];

    if (closingBraces.length === 0) {
      throw new Error('The model output does not contain any JSON blob.');
    }

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const lastBraceIndex = closingBraces[closingBraces.length - 1]!.index!;
    const jsonStr = jsonBlob.slice(firstBraceIndex, lastBraceIndex + 1);
    const jsonData = JSON.parse(jsonStr) as Record<string, any>;
    const prefix = jsonBlob.slice(0, firstBraceIndex);
    return [jsonData, prefix];
  } catch (err: any) {
    if (err instanceof SyntaxError) {
      const message = err.message || '';
      const match = message.match(/position (\d+)/i);
      const pos = match ? parseInt(match[1]!, 10) : -1;

      const preview = pos !== -1 ? jsonBlob.slice(Math.max(0, pos - 4), pos + 5) : '';

      if (pos !== -1 && jsonBlob.slice(pos - 1, pos + 2) === '},\n') {
        throw new Error(
          'JSON is invalid: you probably tried to provide multiple tool calls in one action. PROVIDE ONLY ONE TOOL CALL.'
        );
      }

      throw new Error(
        `The JSON blob you used is invalid due to the following error: ${err.message}.\n` +
          `JSON blob was: ${jsonBlob}, decoding failed on this specific part:\n` +
          `'${preview}'.`
      );
    }

    throw err;
  }
}

export function parseJsonIfNeeded(
  args: string | Record<string, unknown>
): string | Record<string, unknown> {
  if (typeof args === 'object' && args !== null) {
    return args;
  }

  try {
    return JSON.parse(args) as Record<string, unknown>;
  } catch {
    return args;
  }
}

export function getToolCallFromText(
  text: string,
  toolNameKey: string,
  toolArgumentsKey: string
): ChatMessageToolCall {
  const [toolCallDictionary] = parseJsonBlob(text);

  const toolName = toolCallDictionary[toolNameKey];
  if (!toolName) {
    const availableKeys = Object.keys(toolCallDictionary).join(', ');
    throw new Error(
      `Key '${toolNameKey}' not found in the generated tool call. Got keys: ${availableKeys} instead.`
    );
  }

  let toolArguments = toolCallDictionary[toolArgumentsKey];
  if (typeof toolArguments === 'string') {
    toolArguments = parseJsonIfNeeded(toolArguments);
  }

  return {
    id: randomUUID(),
    type: 'function',
    function: {
      name: toolName,
      arguments: toolArguments,
    },
  };
}

/**
 * Check if the model supports the `stop` parameter.
 *
 * Not supported with reasoning models like `openai/o3` and `openai/o4-mini`,
 * including any versioned variants like `o3-2025-04-16`.
 *
 * @param modelId - Model identifier (e.g. "openai/o3", "o4-mini-2025-04-16")
 * @returns True if the model supports the stop parameter, false otherwise
 */
export function supportsStopParameter(modelId: string): boolean {
  const modelName = modelId.split('/').pop() ?? '';
  const pattern = /^(o3[-\d]*|o4-mini[-\d]*)$/;
  return !pattern.test(modelName);
}
