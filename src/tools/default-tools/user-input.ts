import { Tool } from '@/tools/tool';
import readline from 'readline';

export class UserInputTool extends Tool {
  constructor() {
    super({
      name: 'user_input',
      description: "Asks for user's input on a specific question",
      inputs: {
        question: {
          type: 'string',
          description: 'The question to ask the user',
        },
      },
      outputType: 'string',
    });
  }

  override async execute(input: any): Promise<string> {
    let question: string = input['question'];

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    const userInput = await new Promise<string>(resolve => {
      rl.question(`${question} => Type your answer here: `, resolve);
    });
    rl.close();

    return userInput;
  }
}

export const TOOL_MAPPING = Object.fromEntries(
  [
    // PythonInterpreterTool,
    // DuckDuckGoSearchTool,
    // VisitWebpageTool,
  ]?.map(toolClass => [toolClass['name'], toolClass]) ?? []
);
