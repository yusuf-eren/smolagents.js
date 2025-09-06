import { Tool } from '@/tools/tool';

export class FinalAnswerTool extends Tool {
  constructor() {
    super({
      name: 'final_answer',
      description: 'Provides a final answer to the given problem.',
      inputs: {
        answer: {
          type: 'any',
          description: 'The final answer to the problem',
          nullable: true,
        },
      },
      outputType: 'any',
    });
  }

  override execute(input: any): any {
    // Handle both {"answer": "..."} and direct string formats
    if (typeof input === 'string') {
      return input;
    }
    if (input && typeof input === 'object' && 'answer' in input) {
      return input['answer'];
    }
    // Fallback: return the input as-is
    return input;
  }
}
