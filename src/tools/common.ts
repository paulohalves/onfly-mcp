import { OnflyApiClient } from '../api/client.js';
import { filterPII } from '../api/response-filter.js';
import type { TokenBucketLimiter } from '../api/rate-limiter.js';
import { config } from '../config.js';

import type { McpExtra } from './context.js';
import { getAccessToken } from './context.js';

export function jsonTextResult(data: unknown): { content: Array<{ type: 'text'; text: string }> } {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(filterPII(data), null, 2),
      },
    ],
  };
}

export function newClient(extra: McpExtra, limiter: TokenBucketLimiter): OnflyApiClient {
  const token = getAccessToken(extra);
  return new OnflyApiClient(config.apiBaseUrl, token, limiter, config.apiTimeoutMs);
}
