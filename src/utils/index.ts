import type { Buffer } from 'node:buffer';

import sharp from 'sharp';
import { AgentLogger, LogLevel } from '@/monitoring';

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
  return JSON.parse(JSON.stringify(obj));
}

async function encodeImageBase64(imageBuffer: Buffer): Promise<string> {
  const pngBuffer = await sharp(imageBuffer).png().toBuffer();
  return pngBuffer.toString('base64');
}

function makeImageUrl(base64Image: string): string {
  return `data:image/png;base64,${base64Image}`;
}

export function populateTemplate(template: string, variables: Record<string, any>): string {
  return template.replace(/{{\s*([\w.]+)\s*}}/g, (_, key) => {
    const value = getNestedValue(variables, key);
    if (value === undefined) {
      throw new Error(`Missing template variable: ${key}`);
    }
    return String(value);
  });
}

function getNestedValue(obj: Record<string, any>, key: string): any {
  return key.split('.').reduce((acc, part) => {
    if (acc && typeof acc === 'object' && part in acc) {
      return acc[part];
    }
    return undefined;
  }, obj);
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
};
