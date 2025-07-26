import type { Buffer } from 'node:buffer';

import sharp from 'sharp';
import { Logger } from 'winston';

import { LogLevel } from '@/monitoring';

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
  constructor(message: string, logger: Logger) {
    super(message);
    this.name = new.target.name;
    logger.log(LogLevel.ERROR, message);
  }

  toJSON(): { type: string; message: string } {
    return { type: this.constructor.name, message: String(this.message) };
  }
}

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

export { AgentError, escapeCodeBrackets, makeJsonSerializable, encodeImageBase64, makeImageUrl };
