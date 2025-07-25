import { MemoryStep } from '@/memory';

export class FinalAnswerStep extends MemoryStep {
  output: any;

  constructor(output: any) {
    super();
    this.output = output;
  }
}
