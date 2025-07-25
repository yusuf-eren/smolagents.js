import type { Logger } from 'winston';

import { logger } from '@/monitoring';

/**
 * Abstract class to be reimplemented to define types that can be returned by agents.
 *
 * These objects serve three purposes:
 * - They behave as if they were the type they're meant to be, e.g., a string for text, an Image for images
 * - They can be stringified: String(object) in order to return a string defining the object
 * - They should be displayed correctly in ipython notebooks/colab/jupyter (not directly applicable in TS, but can implement toString and valueOf)
 */
export abstract class AgentType<T = any> {
  protected _value: T;
  logger: Logger = logger;

  constructor(value: T) {
    this._value = value;
  }

  toString(): string | Promise<string> {
    this.logger.error(
      'This is a raw AgentType of unknown type. Display in notebooks and string conversion will be unreliable'
    );
    return String(this._value);
  }

  toRaw(): T | Promise<T> {
    this.logger.error(
      'This is a raw AgentType of unknown type. Display in notebooks and string conversion will be unreliable'
    );
    return this._value;
  }
}
