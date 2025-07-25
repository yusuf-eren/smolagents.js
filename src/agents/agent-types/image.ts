import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { Sharp } from 'sharp';
import sharp from 'sharp';

import { AgentType } from '@/agents/agent-types/base';
import type { AgentImageValue } from '@/agents/agent-types/types';

export class AgentImage extends AgentType<AgentImageValue> {
  private _raw: Sharp | null = null;
  private _path: string | null = null;
  // For now, skipping tensor support.
  //   private _tensor: any = null; // placeholder if you're using tfjs or torch bindings

  constructor(value: AgentImageValue) {
    super(value);

    if (value instanceof AgentImage) {
      this._raw = value._raw;
      this._path = value._path;
      //   this._tensor = value._tensor;
    } else if (Buffer.isBuffer(value)) {
      this._raw = sharp(value);
    } else if (typeof value === 'string') {
      this._path = value;
    } else if (typeof value === 'object' && 'metadata' in value) {
      this._raw = value;
    } else {
      throw new TypeError(`Unsupported type for AgentImage: ${typeof value}`);
    }

    if (!this._raw && !this._path) {
      throw new TypeError(`AgentImage: No valid input given`);
    }
  }

  // Missing functions:
  // _ipython_display_ - Due to display in notebook environment.

  load(): void {
    if (this._path && !this._raw) {
      const buffer = fs.readFileSync(path.resolve(this._path));
      this._raw = sharp(buffer);
    }
  }

  /**
   * Return the Sharp instance. Load it from path if needed.
   */
  override toRaw(): Sharp {
    if (this._raw) return this._raw;

    if (this._path) {
      const buffer = fs.readFileSync(path.resolve(this._path));
      this._raw = sharp(buffer);
      return this._raw;
    }

    throw new Error('AgentImage: No image data available');
  }

  async toBuffer(): Promise<Buffer> {
    if (!this._raw) this.load();
    if (!this._raw) throw new Error('AgentImage: Image data not loaded');
    return this._raw.toBuffer();
  }

  override async toString(): Promise<string> {
    if (this._path) {
      return this._path;
    }

    if (!this._raw) this.load();
    if (!this._raw) throw new Error('AgentImage: Image data not available');

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-image-'));
    const tempPath = path.join(dir, `${randomUUID()}.png`);

    const buffer = await this._raw.toBuffer();
    fs.writeFileSync(tempPath, buffer);

    this._path = tempPath;
    return tempPath;
  }

  /**
   * Saves the image to disk.
   * @param outputPath - File path to save the image to.
   * @param format - Optional image format ("png", "jpeg", etc).
   * @param params - Optional format-specific options.
   */
  async save(
    outputPath: string,
    format?: 'png' | 'jpeg' | 'webp' | 'tiff',
    params: Record<string, any> = {}
  ): Promise<void> {
    const img = this.toRaw();
    let pipeline = img;

    if (format) {
      switch (format) {
        case 'png':
          pipeline = pipeline.png(params);
          break;
        case 'jpeg':
          pipeline = pipeline.jpeg(params);
          break;
        case 'webp':
          pipeline = pipeline.webp(params);
          break;
        case 'tiff':
          pipeline = pipeline.tiff(params);
          break;
        default:
          throw new Error(`Unsupported image format: ${format as string}`);
      }
    }

    await pipeline.toFile(outputPath);
  }
}
