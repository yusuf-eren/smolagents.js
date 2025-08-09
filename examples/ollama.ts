import { OllamaModel,  ToolCallingAgent, tool } from 'smolagents.js';

const getTimeTool = tool(
  {
    name: 'get_Time',
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

const agent = new ToolCallingAgent({
  tools: [getTimeTool],
  model: new OllamaModel({
    modelId: 'mistral' 
  }),

});

await agent.run('What is the time in San Francisco?');


