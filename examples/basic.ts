import { OpenAIServerModel, ToolCallingAgent, tool } from 'smolagents.js';

const getWeatherTool = tool(
  {
    name: 'get_weather',
    description: 'Get the weather for a given city',
    inputs: {
      city: {
        type: 'string',
        description: 'The city to get the weather for',
      },
    },
    outputType: 'string',
  },
  async ({ city }: { city: string }): Promise<string> => {
    return `The weather in ${city} is sunny`;
  }
);

const agent = new ToolCallingAgent({
  tools: [getWeatherTool],
  model: new OpenAIServerModel({
    modelId: 'gpt-4o',
    apiKey: process.env['OPENAI_API_KEY'] as string,
  }),
});

await agent.run('What is the weather in San Francisco?');
