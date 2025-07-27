import { makeJsonSerializable } from '@/utils';

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

export class ToolOutput {
  id: string;
  output: any;
  isFinalAnswer: boolean;
  observation: string;
  toolCall: ToolCall;

  constructor(params: {
    id: string;
    output: any;
    isFinalAnswer: boolean;
    observation: string;
    toolCall: ToolCall;
  }) {
    this.id = params.id;
    this.output = params.output;
    this.isFinalAnswer = params.isFinalAnswer;
    this.observation = params.observation;
    this.toolCall = params.toolCall;
  }
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
        arguments: makeJsonSerializable(this.arguments),
      },
    };
  }
}

export interface PreTool {
  name: string;
  inputs: Record<string, string>;
  output_type: any;
  task: string;
  description: string;
  repo_id: string;
}
