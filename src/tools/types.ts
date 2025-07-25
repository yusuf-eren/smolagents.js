export type ToolInputSpec = Record<string, string | typeof Function | boolean>;

export type ToolInputs = Record<string, ToolInputSpec>;

export type ToolParams = {
  name: string;
  description: string;
  inputs: ToolInputs;
  outputType: string;
};

export const AUTHORIZED_TYPES = [
  'string',
  'boolean',
  'integer',
  'number',
  'image',
  'audio',
  'array',
  'object',
  'any',
  'null',
];

export type AuthorizedType = (typeof AUTHORIZED_TYPES)[number];

export type ToolCallInput =
  | Record<string, any> // dict-style
  | any[]; // args-style

export interface ToolCallOptions {
  sanitizeInputsOutputs?: boolean;
}

export interface ToolOutput {
  id: string;
  output: any;
  isFinalAnswer: boolean;
  observation: string;
  toolCall: ToolCall;
}

export class ToolCall {
  name: string;
  arguments: any;
  id: string;

  constructor(name: string, args: any, id: string) {
    this.name = name;
    this.arguments = args;
    this.id = id;
  }

  toJSON() {
    return {
      id: this.id,
      type: 'function',
      function: {
        name: this.name,
        arguments: makeJsonSerializable(this.arguments), // keep this way for now.
      },
    };
  }
}
