import type { TokenBucketLimiter } from './rate-limiter.js';

export class OnflyApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
    private readonly limiter: TokenBucketLimiter,
    private readonly requestTimeoutMs: number = 90_000,
  ) {}

  private makeAbortSignal(): { signal: AbortSignal; clear: () => void } {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    return { signal: controller.signal, clear: () => clearTimeout(id) };
  }

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
      // JSON.stringify can be slow for large payloads (e.g. base64 attachments).
      // Yield the event loop first so MCP keep-alives are not blocked.
      await new Promise<void>((r) => setImmediate(r));
      body = JSON.stringify(options.body);
    }
    const { signal, clear } = this.makeAbortSignal();
    try {
      const res = await fetch(url, { method, headers, body, signal });
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
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(
          `Onfly API request timed out after ${this.requestTimeoutMs / 1000}s (${method} ${path}).`,
        );
      }
      throw err;
    } finally {
      clear();
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
   * Preferred for large files — sends binary bytes via FormData instead of embedding
   * base64 in JSON, avoiding synchronous JSON.stringify of multi-MB payloads.
   * Do not set Content-Type manually — `fetch` adds the boundary.
   */
  async postFormData(path: string, form: FormData): Promise<unknown> {
    await this.limiter.acquire();
    const url = `${this.baseUrl}${path}`;
    const { signal, clear } = this.makeAbortSignal();
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: 'application/json',
        },
        body: form,
        signal,
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
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(
          `Onfly API request timed out after ${this.requestTimeoutMs / 1000}s (POST multipart ${path}).`,
        );
      }
      throw err;
    } finally {
      clear();
    }
  }

  put(path: string, body?: unknown, search?: URLSearchParams): Promise<unknown> {
    return this.request('PUT', path, { body, search });
  }

  delete(path: string, search?: URLSearchParams): Promise<unknown> {
    return this.request('DELETE', path, { search });
  }
}
