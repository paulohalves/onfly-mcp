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

  /**
   * Multipart POST (e.g. Onfly `POST /general/attachment/4/1/{id}` with form field `file`).
   * Do not set Content-Type manually — `fetch` adds the boundary.
   */
  async postFormData(path: string, form: FormData): Promise<unknown> {
    await this.limiter.acquire();
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/json',
      },
      body: form,
    });
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

  put(path: string, body?: unknown, search?: URLSearchParams): Promise<unknown> {
    return this.request('PUT', path, { body, search });
  }

  delete(path: string, search?: URLSearchParams): Promise<unknown> {
    return this.request('DELETE', path, { search });
  }
}
