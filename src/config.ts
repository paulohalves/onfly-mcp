import 'dotenv/config';

const env = process.env;

export const config = {
  apiBaseUrl: (env.ONFLY_API_BASE_URL ?? 'https://api.onfly.com').replace(/\/$/, ''),
  devAccessToken: env.ONFLY_DEV_ACCESS_TOKEN ?? '',
  mcpPort: env.MCP_PORT ? Number.parseInt(env.MCP_PORT, 10) : 3000,
  mcpHost: env.MCP_HOST ?? '127.0.0.1',
  /**
   * Max JSON body for POST /mcp (base64 in tools/call). SDK default ~100kb is too small.
   * Default ~18mb fits one 10MiB binary as base64 inside JSON-RPC.
   */
  mcpJsonBodyLimit: env.MCP_JSON_BODY_LIMIT ?? '18mb',
  /** Log JSON-RPC method / tool name to stdout (no tokens or full args). */
  mcpDebug: env.MCP_DEBUG === '1' || env.MCP_DEBUG === 'true',
  /**
   * stateless: new MCP transport per POST (no Mcp-Session-Id). For simple clients; SSE GET returns 405.
   * stateful: default — client must send Mcp-Session-Id after initialize.
   */
  mcpStreamableMode:
    env.MCP_STATELESS === '1' || env.MCP_STATELESS === 'true' ? 'stateless' : 'stateful',
  /**
   * Onfly API request timeout in ms. Large uploads can be slow; default 90s.
   * If the API hangs beyond this, the tool returns an error instead of blocking forever.
   */
  apiTimeoutMs: env.ONFLY_API_TIMEOUT_MS ? Number.parseInt(env.ONFLY_API_TIMEOUT_MS, 10) : 90_000,
} as const;
