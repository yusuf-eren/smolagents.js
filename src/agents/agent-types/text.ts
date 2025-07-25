import { AgentType } from '@/agents/agent-types/base';

/**
 * Text type returned by the agent. Behaves as a string.
 */
export class AgentText extends AgentType<string> {
  constructor(value: string) {
    super(value);
  }
}
