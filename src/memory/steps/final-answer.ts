import { MemoryStep } from '@/memory/steps/memory';

export class FinalAnswerStep extends MemoryStep {
  output: any;

  constructor(output: any) {
    super();
    this.output = output;
  }
}
