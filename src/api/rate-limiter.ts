export class TokenBucketLimiter {
  private tokens: number;
  private lastRefillMs: number;
  private readonly maxTokens: number;
  private readonly refillIntervalMs: number;

  constructor(maxTokens = 200, refillIntervalMs = 30 * 60 * 1000) {
    this.maxTokens = maxTokens;
    this.refillIntervalMs = refillIntervalMs;
    this.tokens = maxTokens;
    this.lastRefillMs = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    if (now - this.lastRefillMs >= this.refillIntervalMs) {
      this.tokens = this.maxTokens;
      this.lastRefillMs = now;
    }
  }

  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens > 0) {
      this.tokens -= 1;
      return;
    }
    const waitMs = this.refillIntervalMs - (Date.now() - this.lastRefillMs);
    throw new Error(
      `Onfly rate limit reached. Retry in about ${Math.ceil(waitMs / 60_000)} minute(s).`,
    );
  }
}
