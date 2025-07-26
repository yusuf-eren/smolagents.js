export class RateLimiter {
  private enabled: boolean;
  private interval: number;
  private lastCall: number;

  /**
   * Simple rate limiter that enforces a minimum delay between consecutive calls.
   *
   * @param requestsPerMinute - Max number of allowed requests per minute. If undefined, rate limiting is disabled.
   */
  constructor(requestsPerMinute?: number | null) {
    this.enabled = requestsPerMinute != null;
    this.interval = this.enabled ? 60_000 / requestsPerMinute! : 0; // in milliseconds
    this.lastCall = 0;
  }

  /**
   * If rate limiting is enabled, pauses execution to respect the rate.
   */
  async throttle(): Promise<void> {
    if (!this.enabled) return;

    const now = Date.now();
    const elapsed = now - this.lastCall;

    if (elapsed < this.interval) {
      const waitTime = this.interval - elapsed;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastCall = Date.now();
  }
}
