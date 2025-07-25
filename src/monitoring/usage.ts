/**
 * Contains the token usage information for a given step or run.
 */
export class TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;

  constructor(inputTokens: number, outputTokens: number) {
    this.inputTokens = inputTokens;
    this.outputTokens = outputTokens;
    this.totalTokens = inputTokens + outputTokens;
  }

  toJSON(): { inputTokens: number; outputTokens: number; totalTokens: number } {
    return {
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
      totalTokens: this.totalTokens,
    };
  }
}
