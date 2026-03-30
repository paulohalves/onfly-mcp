import { filterPII } from '../api/response-filter.js';

const ATTACH_LOG_PREVIEW = 120;

/** Avoid stringifying multi‑MB base64 in logs (blocks the event loop and slows MCP responses). */
function redactAttachToExpenseArgsForLog(args: unknown): unknown {
  if (args === null || typeof args !== 'object') {
    return args;
  }
  const a = args as Record<string, unknown>;
  const out = { ...a };
  if (typeof out.file === 'string' && out.file.length > ATTACH_LOG_PREVIEW) {
    out.file = `<redacted; ${out.file.length} chars> ${out.file.slice(0, ATTACH_LOG_PREVIEW)}…`;
  }
  if (Array.isArray(out.files)) {
    out.files = out.files.map((entry) => {
      if (entry === null || typeof entry !== 'object') {
        return entry;
      }
      const f = entry as Record<string, unknown>;
      if (typeof f.file === 'string' && f.file.length > ATTACH_LOG_PREVIEW) {
        return {
          ...f,
          file: `<redacted; ${f.file.length} chars> ${f.file.slice(0, ATTACH_LOG_PREVIEW)}…`,
        };
      }
      return entry;
    });
  }
  return out;
}

function asMessageArray(body: unknown): unknown[] {
  if (Array.isArray(body)) {
    return body;
  }
  if (body === undefined || body === null) {
    return [];
  }
  return [body];
}

function stringifyPretty(value: unknown, maxChars: number): string {
  try {
    const s = JSON.stringify(filterPII(value), null, 2);
    if (s.length <= maxChars) {
      return s;
    }
    return `${s.slice(0, maxChars)}\n… truncated (${s.length - maxChars} chars)`;
  } catch {
    return '(unserializable)';
  }
}

function stringifyOneLine(value: unknown, maxChars: number): string {
  try {
    const s = JSON.stringify(filterPII(value));
    if (s.length <= maxChars) {
      return s;
    }
    return `${s.slice(0, maxChars)}…`;
  } catch {
    return '(unserializable)';
  }
}

function summarizeMessage(msg: unknown): string {
  if (typeof msg !== 'object' || msg === null || !('method' in msg)) {
    return '(non-jsonrpc)';
  }
  const m = msg as { method?: unknown; id?: unknown; params?: Record<string, unknown> };
  const method = typeof m.method === 'string' ? m.method : '?';
  let detail = method;
  if (method === 'tools/call' && m.params && typeof m.params.name === 'string') {
    detail += ` name=${m.params.name}`;
  }
  if (m.id !== undefined && m.id !== null) {
    detail += ` rpcId=${String(m.id)}`;
  }
  return detail;
}

function summarizeMcpJsonRpcBody(body: unknown): string {
  if (Array.isArray(body)) {
    return body.map(summarizeMessage).join(' | ');
  }
  if (body === undefined || body === null) {
    return '(empty)';
  }
  return summarizeMessage(body);
}

function line(prefix: string): void {
  const ts = new Date().toISOString();
  console.log(`[mcp ${ts}] ${prefix}`);
}

function logJsonRpcParamsDetail(messages: unknown[]): void {
  for (const msg of messages) {
    if (typeof msg !== 'object' || msg === null || !('method' in msg)) {
      continue;
    }
    const m = msg as { method?: string; params?: Record<string, unknown> };
    const method = m.method ?? '?';

    if (method === 'tools/call' && m.params) {
      const toolName =
        typeof m.params.name === 'string' ? m.params.name : String(m.params.name ?? '?');
      const args =
        toolName === 'attach_to_expense'
          ? redactAttachToExpenseArgsForLog(m.params.arguments)
          : m.params.arguments;
      line(`  params tools/call "${toolName}" → arguments (PII redacted):`);
      console.log(stringifyPretty(args, 16_000));
      continue;
    }

    if (m.params && Object.keys(m.params).length > 0) {
      line(`  params ${method} (compact, PII redacted, truncated):`);
      console.log(stringifyOneLine(m.params, 2_000));
    }
  }
}

export const mcpRequestDebug = {
  logPost(enabled: boolean, sessionId: string | undefined, body: unknown): void {
    if (!enabled) {
      return;
    }
    const summary = summarizeMcpJsonRpcBody(body);
    const sid = sessionId ?? 'new-session';
    line(`POST /mcp session=${sid} ${summary}`);
    logJsonRpcParamsDetail(asMessageArray(body));
  },

  logSse(enabled: boolean, sessionId: string): void {
    if (!enabled) {
      return;
    }
    line(`GET /mcp SSE session=${sessionId}`);
  },

  logSessionDelete(enabled: boolean, sessionId: string): void {
    if (!enabled) {
      return;
    }
    line(`DELETE /mcp session=${sessionId}`);
  },
} as const;
