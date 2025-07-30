import { isValidName } from '@/tools/helpers';
import {
  AUTHORIZED_TYPES,
  type ToolCallInput,
  type ToolInputs,
  type ToolParams,
} from '@/tools/types';

// TODO: There are many more functions out there. But let's keep it simple for now.
// Add others as soon as the library becomes stable (after release).
export abstract class BaseTool {
  isInitialized: boolean = false;
  abstract name: string;
  abstract description: string;
  abstract inputs: Record<string, Record<string, string | typeof Function | boolean>>;
  abstract outputType: string;

  // Abstract method that must be implemented by subclasses
  abstract setup(): Promise<void> | void;

  // Optional method, can be used as a fallback implementation
  abstract call(args: any): any;

  abstract execute(input: any): any;
}

export class Tool implements BaseTool {
  name: string;
  description: string;
  inputs: ToolInputs;
  outputType: string;

  isInitialized: boolean = false;

  constructor(params: ToolParams) {
    this.#validateArguments(params);
    this.name = params.name;
    this.description = params.description;
    this.inputs = params.inputs;
    this.outputType = params.outputType;
  }

  async call(input: ToolCallInput): Promise<any> {
    if (!this.isInitialized) {
      this.setup();
    }

    // let args: any[] = [];

    // Normalize input
    // if (Array.isArray(input)) {
    //   args = input;
    // } else if (
    //   typeof input === 'object' &&
    //   input !== null &&
    //   Object.keys(input).every(key => key in this.inputs)
    // ) {
    // } else {
    //   throw new Error(`Invalid input to tool "${this.name}": ${JSON.stringify(input)}`);
    // }

    // Sanitize if needed
    // TODO: I think we don't need this. But let's keep it in comment for now.
    // if (options.sanitizeInputsOutputs) {
    //   [input, options] = await resolveAgentInputsAsync(input, options);
    // }

    // Run the core logic
    const result = (await this.execute(input)) as never;

    // TODO: Same issue as above. We don't need this. But let's keep it in comment for now.
    // Sanitize output if needed
    // return options.sanitizeInputsOutputs ? handleToolOutputTypes(result, this.outputType) : result;

    return result;
  }

  execute(..._args: any): any {
    throw new Error('Not implemented');
  }

  /**
   * Overwrite this method here for any operation that is expensive and needs to be executed before you start using
   * your tool. Such as loading a big model.
   */
  setup(): void {
    this.isInitialized = true;
  }

  #validateArguments(params: ToolParams): void {
    const requiredAttributes: Record<keyof ToolParams, 'string' | 'object'> = {
      name: 'string',
      description: 'string',
      inputs: 'object',
      outputType: 'string',
    };

    for (const [attr, expectedType] of Object.entries(requiredAttributes)) {
      const value = params[attr as keyof ToolParams];
      if (value == null) {
        throw new TypeError(`You must set an attribute "${attr}".`);
      }
      if (typeof value !== expectedType) {
        throw new TypeError(
          `Attribute "${attr}" should have type "${expectedType}", got "${typeof value}" instead.`
        );
      }
    }

    if (!isValidName(params.name)) {
      throw new Error(
        `Invalid Tool name '${params.name}': must be a valid JavaScript identifier and not a reserved keyword`
      );
    }

    for (const [inputName, inputContent] of Object.entries(params.inputs)) {
      if (typeof inputContent !== 'object' || inputContent === null || inputContent === undefined) {
        throw new TypeError(`Input "${inputName}" should be a dictionary.`);
      }

      const keys = Object.keys(inputContent);
      if (!('type' in inputContent) || !('description' in inputContent)) {
        throw new Error(
          `Input "${inputName}" must contain keys 'type' and 'description', found: ${keys.join(', ')}`
        );
      }

      const typeValue = inputContent['type'];
      const typeList = Array.isArray(typeValue) ? typeValue : [typeValue];

      if (!typeList.every(t => typeof t === 'string')) {
        throw new TypeError(
          `Input "${inputName}": 'type' must be a string or an array of strings. Got: ${JSON.stringify(typeValue)}`
        );
      }

      const invalidTypes = typeList.filter(t => !this.#isAuthorizedType(t as string));
      if (invalidTypes.length > 0) {
        throw new Error(
          `Input "${inputName}": Invalid types ${invalidTypes.join(', ')} — must be one of: ${AUTHORIZED_TYPES.join(', ')}`
        );
      }
    }

    // Validate outputType
    if (!this.#isAuthorizedType(params.outputType)) {
      throw new Error(
        `Invalid outputType "${String(params.outputType)}" — must be one of: ${AUTHORIZED_TYPES.join(', ')}`
      );
    }
  }

  #isAuthorizedType(value: string): boolean {
    return AUTHORIZED_TYPES.includes(value);
  }
}

export function tool(params: ToolParams, execute: (...args: any[]) => any): Tool {
  const createdTool = new Tool(params);
  createdTool.execute = execute;
  return createdTool;
}

