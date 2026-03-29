import type { TokenBucketLimiter } from './rate-limiter.js';

export class OnflyApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
    private readonly limiter: TokenBucketLimiter,
  ) {}

  private async request(
    method: string,
    path: string,
    options: { search?: URLSearchParams; body?: unknown } = {},
  ): Promise<unknown> {
    await this.limiter.acquire();
    const qs = options.search?.toString();
    const url = `${this.baseUrl}${path}${qs ? `?${qs}` : ''}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      Accept: 'application/json',
    };
    let body: string | undefined;
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(options.body);
    }
    const res = await fetch(url, { method, headers, body });
    const text = await res.text().catch(() => '');
    if (!res.ok) {
      throw new Error(`Onfly API ${res.status}: ${text || res.statusText}`);
    }
    if (!text) {
      return {};
    }
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return { raw: text };
    }
  }

  get(path: string, search?: URLSearchParams): Promise<unknown> {
    return this.request('GET', path, { search });
  }

  post(path: string, body?: unknown, search?: URLSearchParams): Promise<unknown> {
    return this.request('POST', path, { body, search });
  }

  put(path: string, body?: unknown, search?: URLSearchParams): Promise<unknown> {
    return this.request('PUT', path, { body, search });
  }

  delete(path: string, search?: URLSearchParams): Promise<unknown> {
    return this.request('DELETE', path, { search });
  }
}
