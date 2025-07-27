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
        },
      },
      outputType: 'any',
    });
  }

  override execute(input: any): any {
    return input['answer'];
  }
}
