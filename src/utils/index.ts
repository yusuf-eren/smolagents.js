import type { Buffer } from 'node:buffer';

import nunjucks from 'nunjucks';
import sharp from 'sharp';
import { AgentLogger, LogLevel } from '@/monitoring';
import type { BaseTool } from '@/tools/tool';
import type { MultiStepAgent } from '@/agents/multi-step-agent';

/**
 * Escapes square brackets in code segments while preserving Rich styling tags.
 *
 * For example, it will escape [foo] as \[foo\] unless the content is only a Rich style tag.
 */
function escapeCodeBrackets(text: string): string {
  // Matches [content] and processes the content.
  return text.replace(/\[([^\]]*)\]/g, (_: string, content: string) => {
    // Remove style tags and whitespace for checking if it's only a style tag.
    const cleaned = content.replace(
      /(bold|red|green|blue|yellow|magenta|cyan|white|black|italic|dim|\s|#[0-9a-fA-F]{6})/g,
      ''
    );
    if (cleaned.trim()) {
      return `\\[${content}\\]`;
    } else {
      return `[${content}]`;
    }
  });
}

class AgentError extends Error {
  /**
   * Base class for other agent-related exceptions
   * @param message The error message
   * @param logger An AgentLogger instance
   */
  constructor(message: string, logger: AgentLogger) {
    super(message);
    this.name = new.target.name;
    logger.log(message, { level: LogLevel.ERROR });
  }

  toJSON(): { type: string; message: string } {
    return { type: this.constructor.name, message: String(this.message) };
  }
}

// Exception raised for errors in parsing in the agent
class AgentParsingError extends AgentError {}

// Exception raised for errors in execution in the agent
class AgentExecutionError extends AgentError {}

// Exception raised when maximum steps exceeded
class AgentMaxStepsError extends AgentError {}

// Exception raised for errors when incorrect arguments are passed to the tool
class AgentToolCallError extends AgentExecutionError {}

// Exception raised for errors when executing a tool
class AgentToolExecutionError extends AgentExecutionError {}

// Exception raised for errors in generation in the agent
class AgentGenerationError extends AgentError {}

function makeJsonSerializable(obj: unknown): unknown {
  return JSON.parse(JSON.stringify(obj, null, 2));
}

async function encodeImageBase64(imageBuffer: Buffer): Promise<string> {
  const pngBuffer = await sharp(imageBuffer).png().toBuffer();
  return pngBuffer.toString('base64');
}

function makeImageUrl(base64Image: string): string {
  return `data:image/png;base64,${base64Image}`;
}

function toToolCallingPrompt(tool: {
  name: string;
  description: string;
  inputs: Record<string, any>;
  outputType: any;
}): string {
  return `${tool.name}: ${tool.description}
    Takes inputs: ${JSON.stringify(tool.inputs)}
    Returns an output of type: ${JSON.stringify(tool.outputType)}`;
}

export interface RenderContextTemplate {
  toolsArray: BaseTool[];
  managedAgentsArray?: MultiStepAgent[] | undefined;
  customInstructions?: string | undefined;
  task?: string | undefined;
  remainingSteps?: number | undefined;
  name?: string | undefined;
  finalAnswer?: string | undefined;
}

function populateTemplate(
  template: string,
  rawContext: {
    tools?: Record<string, BaseTool>;
    managedAgents?: Record<string, MultiStepAgent> | undefined;
    customInstructions?: string;
    task?: string;
    remainingSteps?: number;
    name?: string;
    finalAnswer?: string;
  }
): string {
  const env = new nunjucks.Environment(undefined, {
    autoescape: false,
  });

  env.addGlobal('toToolCallingPrompt', toToolCallingPrompt);

  const context = {
    tools: rawContext.tools ?? {},
    managedAgents: rawContext.managedAgents ?? {},
    customInstructions: rawContext.customInstructions ?? '',
    task: rawContext.task,
    remainingSteps: rawContext.remainingSteps,
    name: rawContext.name,
    finalAnswer: rawContext.finalAnswer,
  };

  return env.renderString(template, context);
}
export {
  AgentError,
  AgentParsingError,
  AgentExecutionError,
  AgentMaxStepsError,
  AgentToolCallError,
  AgentToolExecutionError,
  AgentGenerationError,
  escapeCodeBrackets,
  makeJsonSerializable,
  encodeImageBase64,
  makeImageUrl,
  populateTemplate,
  toToolCallingPrompt,
};
