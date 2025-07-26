import { Model, type ModelConfig } from '@/models';
import { RateLimiter } from '@/models/rate-limiter';

export interface ApiModelConfig extends ModelConfig {
  modelId: string;
  customRoleConversions?: Record<string, string>;
  client?: any;
  requestsPerMinute?: number;
}

export class ApiModel extends Model {
  customRoleConversions: Record<string, string>;
  client: any;
  rateLimiter: RateLimiter;

  constructor({
    modelId,
    customRoleConversions = {},
    client = null,
    requestsPerMinute,
    ...rest
  }: ApiModelConfig) {
    super({ modelId, ...rest });
    this.customRoleConversions = customRoleConversions;
    this.client = client ?? this.createClient();
    this.rateLimiter = new RateLimiter(requestsPerMinute);
  }

  /** Create the API client for the specific service. */
  protected createClient(): any {
    throw new Error('Subclasses must implement createClient()');
  }

  /** Applies rate limiting before making an API call. */
  protected async applyRateLimit(): Promise<void> {
    await this.rateLimiter.throttle();
  }
}
