import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod';

import type { TokenBucketLimiter } from '../api/rate-limiter.js';
import { appendParam } from '../utils/query.js';

import { jsonTextResult, newClient } from './common.js';

const read = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

export function registerSettingsReadTools(server: McpServer, limiter: TokenBucketLimiter): void {
  server.registerTool(
    'list_employee_groups',
    {
      title: 'List employee groups',
      description: 'GET /employee-groups.',
      inputSchema: {
        page: z.number().int().optional().default(1),
        per_page: z.number().int().optional().default(20),
      },
      annotations: read,
    },
    async ({ page, per_page }, extra) => {
      const client = newClient(extra, limiter);
      const params = new URLSearchParams();
      appendParam(params, 'page', page);
      appendParam(params, 'perPage', per_page);
      const data = await client.get('/employee-groups', params);
      return jsonTextResult(data);
    },
  );

  server.registerTool(
    'list_cost_centers',
    {
      title: 'List cost centers',
      description: 'GET /settings/cost-center.',
      inputSchema: {
        page: z.number().int().optional().default(1),
        per_page: z.number().int().optional().default(50),
        include: z.string().optional().describe('e.g. metadata'),
      },
      annotations: read,
    },
    async ({ page, per_page, include }, extra) => {
      const client = newClient(extra, limiter);
      const params = new URLSearchParams();
      appendParam(params, 'page', page);
      appendParam(params, 'perPage', per_page);
      appendParam(params, 'include', include);
      const data = await client.get('/settings/cost-center', params);
      return jsonTextResult(data);
    },
  );

  server.registerTool(
    'list_tags',
    {
      title: 'List tags',
      description: 'GET /settings/tag.',
      inputSchema: {
        page: z.number().int().optional().default(1),
        per_page: z.number().int().optional().default(50),
      },
      annotations: read,
    },
    async ({ page, per_page }, extra) => {
      const client = newClient(extra, limiter);
      const params = new URLSearchParams();
      appendParam(params, 'page', page);
      appendParam(params, 'perPage', per_page);
      const data = await client.get('/settings/tag', params);
      return jsonTextResult(data);
    },
  );

  server.registerTool(
    'get_company',
    {
      title: 'Get company',
      description: 'GET /company.',
      inputSchema: {
        include: z
          .string()
          .optional()
          .default('financialInformation,permissions'),
      },
      annotations: read,
    },
    async ({ include }, extra) => {
      const client = newClient(extra, limiter);
      const params = new URLSearchParams();
      appendParam(params, 'include', include);
      const data = await client.get('/company', params);
      return jsonTextResult(data);
    },
  );

  server.registerTool(
    'get_general_settings',
    {
      title: 'Get general settings',
      description: 'GET /settings/general.',
      inputSchema: {},
      annotations: read,
    },
    async (_args, extra) => {
      const client = newClient(extra, limiter);
      const data = await client.get('/settings/general', new URLSearchParams());
      return jsonTextResult(data);
    },
  );

  server.registerTool(
    'list_budgets',
    {
      title: 'List budgets',
      description: 'GET /settings/budget.',
      inputSchema: {
        page: z.number().int().optional().default(1),
        per_page: z.number().int().optional().default(50),
      },
      annotations: read,
    },
    async ({ page, per_page }, extra) => {
      const client = newClient(extra, limiter);
      const params = new URLSearchParams();
      appendParam(params, 'page', page);
      appendParam(params, 'perPage', per_page);
      const data = await client.get('/settings/budget', params);
      return jsonTextResult(data);
    },
  );

  server.registerTool(
    'get_budget',
    {
      title: 'Get budget',
      description: 'GET /settings/budget/{id}.',
      inputSchema: { id: z.number().int() },
      annotations: read,
    },
    async ({ id }, extra) => {
      const client = newClient(extra, limiter);
      const data = await client.get(`/settings/budget/${id}`, new URLSearchParams());
      return jsonTextResult(data);
    },
  );

  server.registerTool(
    'list_travel_policy_approval_groups',
    {
      title: 'List travel policy approval groups',
      description: 'GET /settings/travel-policy/approval-group.',
      inputSchema: {
        page: z.number().int().optional().default(1),
        per_page: z.number().int().optional().default(50),
      },
      annotations: read,
    },
    async ({ page, per_page }, extra) => {
      const client = newClient(extra, limiter);
      const params = new URLSearchParams();
      appendParam(params, 'page', page);
      appendParam(params, 'perPage', per_page);
      const data = await client.get('/settings/travel-policy/approval-group', params);
      return jsonTextResult(data);
    },
  );

  server.registerTool(
    'get_travel_policy_approval_group',
    {
      title: 'Get travel policy approval group',
      description: 'GET /settings/travel-policy/approval-group/{id}.',
      inputSchema: { id: z.number().int() },
      annotations: read,
    },
    async ({ id }, extra) => {
      const client = newClient(extra, limiter);
      const data = await client.get(
        `/settings/travel-policy/approval-group/${id}`,
        new URLSearchParams(),
      );
      return jsonTextResult(data);
    },
  );

  server.registerTool(
    'list_travel_policy_rules',
    {
      title: 'List travel policy rules',
      description: 'GET /settings/travel-policy/policy.',
      inputSchema: {
        include: z
          .string()
          .optional()
          .describe(
            'e.g. rules.autoOrderRules,rules.expenditureRules.categorySubject,rules.flyOrderRules',
          ),
      },
      annotations: read,
    },
    async ({ include }, extra) => {
      const client = newClient(extra, limiter);
      const params = new URLSearchParams();
      appendParam(params, 'include', include);
      const data = await client.get('/settings/travel-policy/policy', params);
      return jsonTextResult(data);
    },
  );

  server.registerTool(
    'list_custom_fields_v3',
    {
      title: 'List custom fields (v3)',
      description: 'GET /settings/custom-fields-v3.',
      inputSchema: {
        page: z.number().int().optional().default(1),
        per_page: z.number().int().optional().default(50),
      },
      annotations: read,
    },
    async ({ page, per_page }, extra) => {
      const client = newClient(extra, limiter);
      const params = new URLSearchParams();
      appendParam(params, 'page', page);
      appendParam(params, 'perPage', per_page);
      const data = await client.get('/settings/custom-fields-v3', params);
      return jsonTextResult(data);
    },
  );

  server.registerTool(
    'get_travel_policy_rule',
    {
      title: 'Get travel policy rule',
      description: 'GET /settings/travel-policy/policy/{id}.',
      inputSchema: {
        id: z.number().int(),
        include: z.string().optional(),
      },
      annotations: read,
    },
    async ({ id, include }, extra) => {
      const client = newClient(extra, limiter);
      const params = new URLSearchParams();
      appendParam(params, 'include', include);
      const data = await client.get(`/settings/travel-policy/policy/${id}`, params);
      return jsonTextResult(data);
    },
  );
}
