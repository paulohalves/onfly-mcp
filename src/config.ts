import 'dotenv/config';

const env = process.env;

export const config = {
  apiBaseUrl: (env.ONFLY_API_BASE_URL ?? 'https://api.onfly.com').replace(/\/$/, ''),
  devAccessToken: env.ONFLY_DEV_ACCESS_TOKEN ?? '',
  mcpPort: env.MCP_PORT ? Number.parseInt(env.MCP_PORT, 10) : 3000,
  mcpHost: env.MCP_HOST ?? '127.0.0.1',
  /** Log JSON-RPC method / tool name to stdout (no tokens or full args). */
  mcpDebug: env.MCP_DEBUG === '1' || env.MCP_DEBUG === 'true',
  /**
   * stateless: new MCP transport per POST (no Mcp-Session-Id). For simple clients; SSE GET returns 405.
   * stateful: default — client must send Mcp-Session-Id after initialize.
   */
  mcpStreamableMode:
    env.MCP_STATELESS === '1' || env.MCP_STATELESS === 'true' ? 'stateless' : 'stateful',
} as const;
