import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod';

import type { TokenBucketLimiter } from '../api/rate-limiter.js';
import { appendParam } from '../utils/query.js';

import { jsonTextResult, newClient } from './common.js';

export function registerEmployeeDirectoryTools(server: McpServer, limiter: TokenBucketLimiter): void {
  server.registerTool(
    'list_employees',
    {
      title: 'List employees',
      description: 'GET /employees — paginated company employees.',
      inputSchema: {
        page: z.number().int().optional().default(1),
        per_page: z.number().int().min(1).max(100).optional().default(20),
        include: z
          .string()
          .optional()
          .describe('Comma includes e.g. group,costCenter,document'),
        email: z.array(z.string()).optional(),
        sort_by: z.string().optional().default('name'),
        sort_order: z.enum(['ASC', 'DESC']).optional().default('ASC'),
      },
      annotations: readOnlyAnn(),
    },
    async ({ page, per_page, include, email, sort_by, sort_order }, extra) => {
      const client = newClient(extra, limiter);
      const params = new URLSearchParams();
      appendParam(params, 'page', page);
      appendParam(params, 'perPage', per_page);
      appendParam(params, 'paginate', 'true');
      appendParam(params, 'include', include);
      appendParam(params, 'sortBy', sort_by);
      appendParam(params, 'sortOrder', sort_order);
      if (email?.length) {
        appendParam(params, 'email[]', email);
      }
      const data = await client.get('/employees', params);
      return jsonTextResult(data);
    },
  );

  server.registerTool(
    'get_employee',
    {
      title: 'Get employee',
      description: 'GET /employees/{id}.',
      inputSchema: {
        id: z.number().int(),
        include: z
          .string()
          .optional()
          .default('permissions,preference,fieldsUsed.field'),
      },
      annotations: readOnlyAnn(),
    },
    async ({ id, include }, extra) => {
      const client = newClient(extra, limiter);
      const params = new URLSearchParams();
      appendParam(params, 'include', include);
      const data = await client.get(`/employees/${id}`, params);
      return jsonTextResult(data);
    },
  );

  server.registerTool(
    'get_employee_companies',
    {
      title: 'Get employee companies',
      description: 'GET /employees/{id}/company.',
      inputSchema: {
        id: z.number().int(),
        include: z
          .string()
          .optional()
          .default('permissions,roles,customFields'),
      },
      annotations: readOnlyAnn(),
    },
    async ({ id, include }, extra) => {
      const client = newClient(extra, limiter);
      const params = new URLSearchParams();
      appendParam(params, 'include', include);
      const data = await client.get(`/employees/${id}/company`, params);
      return jsonTextResult(data);
    },
  );

  server.registerTool(
    'find_employee_by_document',
    {
      title: 'Find employee by document',
      description: 'GET /employees?document=…',
      inputSchema: {
        document: z.string().min(1),
        paginate: z.boolean().optional().default(true),
      },
      annotations: readOnlyAnn(),
    },
    async ({ document, paginate }, extra) => {
      const client = newClient(extra, limiter);
      const params = new URLSearchParams();
      appendParam(params, 'document', document);
      appendParam(params, 'paginate', paginate ? 'true' : 'false');
      const data = await client.get('/employees', params);
      return jsonTextResult(data);
    },
  );
}

function readOnlyAnn() {
  return {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  } as const;
}
