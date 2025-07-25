import type { Buffer } from 'node:buffer';

import type { Sharp } from 'sharp';

export type AgentImageValue = Sharp | Buffer | string;

export type AgentAudioValue = string | Float32Array | [number, Float32Array];
