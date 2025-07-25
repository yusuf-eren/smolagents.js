import type { ChatMessage } from '@/models';

export abstract class MemoryStep {
  toJSON(): Record<string, unknown> {
    // By default, serialize all own properties
    const json: Record<string, unknown> = {};
    for (const key of Object.keys(this)) {
      // @ts-expect-error: index signature for dynamic property access
      json[key] = this[key];
    }
    return json;
  }

  toMessages(summaryMode?: boolean): ChatMessage[] {
    throw new Error('Not implemented');
  }
}
