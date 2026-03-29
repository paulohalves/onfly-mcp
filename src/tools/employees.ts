import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod';

import type { TokenBucketLimiter } from '../api/rate-limiter.js';
import { includeForProfile } from '../utils/include-defaults.js';
import { appendParam } from '../utils/query.js';

import { jsonTextResult, newClient } from './common.js';

export function registerEmployeeTools(server: McpServer, limiter: TokenBucketLimiter): void {
  server.registerTool(
    'get_my_profile',
    {
      title: 'Get my profile',
      description:
        'Returns the authenticated Onfly employee profile (company, permissions, preferences).',
      inputSchema: {
        detail_level: z
          .enum(['basic', 'full'])
          .optional()
          .default('basic')
          .describe('basic or full relation include expansion'),
      },
      annotations: {
        title: 'Get my profile',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ detail_level }, extra) => {
      const client = newClient(extra, limiter);
      const params = new URLSearchParams();
      appendParam(params, 'include', includeForProfile(detail_level));
      const data = await client.get('/employees/me', params);
      return jsonTextResult(data);
    },
  );
}
