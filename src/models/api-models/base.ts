import { Model, type ModelConfig } from '@/models';
import { RateLimiter } from '@/models/rate-limiter';
import { toolRoleConversions } from '@/models/types';

export interface ApiModelConfig extends ModelConfig {
  modelId: string;
  customRoleConversions?: Record<string, string>;
  client?: any;
  requestsPerMinute?: number;
}

export abstract class ApiModel extends Model {
  abstract client: any;
  customRoleConversions: Record<string, string>;
  rateLimiter: RateLimiter;

  constructor({
    modelId,
    customRoleConversions,
    client = null,
    requestsPerMinute,
    ...rest
  }: ApiModelConfig) {
    super({ modelId, ...rest });
    this.customRoleConversions = customRoleConversions ?? toolRoleConversions;
    this.rateLimiter = new RateLimiter(requestsPerMinute);
  }

  /** Create the API client for the specific service. */
  protected abstract createClient(): any;

  /** Applies rate limiting before making an API call. */
  protected async applyRateLimit(): Promise<void> {
    await this.rateLimiter.throttle();
  }
}
