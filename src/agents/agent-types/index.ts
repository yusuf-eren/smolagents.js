import { AgentType } from '@/agents/agent-types/base';
import { AgentImage } from '@/agents/agent-types/image';
import { AgentText } from '@/agents/agent-types/text';

const AGENT_TYPE_MAPPING = { string: AgentText, image: AgentImage };

async function resolveAgentInputsAsync<T>(
  input: unknown[] = [],
  options: Record<string, unknown> = {}
): Promise<[unknown[], Record<string, unknown>]> {
  const resolvedInput = await Promise.all(
    input.map(
      async (item: unknown): Promise<T> =>
        item instanceof AgentType ? ((await item.toRaw()) as T) : (item as T)
    )
  );

  const resolvedOptions: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(options)) {
    resolvedOptions[key] = value instanceof AgentType ? await value.toRaw() : value;
  }

  return [resolvedInput, resolvedOptions];
}

function handleAgentOutputTypes(output: unknown, outputType?: string | null): AgentType {
  if (outputType && outputType in AGENT_TYPE_MAPPING) {
    const AgentClass = AGENT_TYPE_MAPPING[outputType as keyof typeof AGENT_TYPE_MAPPING];
    return new AgentClass(output as never); // force-cast, since TS can't infer
  }

  // If the class does not have defined output, then we map according to the type
  if (typeof output === 'string') {
    return new AgentText(output);
  }

  // TODO: THINK ABOUT IMAGE PARSING LATER
  //   if (typeof output === 'object' && 'metadata' in output) {
  //     return new AgentImage(output);
  //   }

  // idk what is gonna return here. but let'st throw error for now. I will check that later.
  // return output;

  return new AgentText(output as any);
}

export {
  AGENT_TYPE_MAPPING,
  AgentImage,
  AgentText,
  handleAgentOutputTypes,
  resolveAgentInputsAsync,
};
