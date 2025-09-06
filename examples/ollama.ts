import { LogLevel, OllamaModel, ToolCallingAgent, tool } from 'smolagents.js';

const getTimeTool = tool(
  {
    name: 'get_time',
    description: 'Get the current time in a given city',
    inputs: {
      city: {
        type: 'string',
        description: 'The city to get the time for',
      },
    },
    outputType: 'string',
  },
  async ({ city }: { city: string }): Promise<string> => {
    return `The current time in ${city} is 12:00 PM`;
  }
);

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
  async ({ city }: { city: string }) => {
    return {
      observation: `The weather in ${city} is sunny`,
    };
  }
);

const agent = new ToolCallingAgent({
  tools: [getTimeTool, getWeatherTool],
  model: new OllamaModel({
    modelName: 'gemma3',
  }),
  maxSteps: 5,
  instructions: 'You are a helpful assistant.',
  planningInterval: 1,
});

await agent.run('What is the weather and time in İstanbul?');
