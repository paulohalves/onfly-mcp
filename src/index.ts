import { randomUUID } from 'node:crypto';

import type { RequestHandler, Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';

import { devOnflyAuthMiddleware } from './auth/dev-bearer.js';
import { config } from './config.js';
import { mcpRequestDebug } from './http/mcp-debug-log.js';
import { mcpSessionHttp } from './http/mcp-session-http.js';
import { InMemoryEventStore } from './infra/in-memory-event-store.js';
import { createOnflyMcpServer } from './server/create-onfly-mcp-server.js';

const transports: Record<string, StreamableHTTPServerTransport> = {};

const methodNotAllowedJson = (): RequestHandler => (_req, res) => {
  res.status(405).json({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Method not allowed for stateless MCP mode.' },
    id: null,
  });
};

function bindTransportCleanup(transport: StreamableHTTPServerTransport, server: ReturnType<typeof createOnflyMcpServer>, res: Response): void {
  res.on('close', () => {
    void transport.close().catch(() => {});
    void server.close().catch(() => {});
  });
}

const app = createMcpExpressApp({ host: config.mcpHost });
app.use('/mcp', devOnflyAuthMiddleware);

/** One POST = one fresh transport (no session header). Matches SDK simpleStatelessStreamableHttp. */
const mcpPostStateless: RequestHandler = async (req, res) => {
  mcpRequestDebug.logPost(config.mcpDebug, undefined, req.body);
  const server = createOnflyMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  try {
    await server.connect(transport);
    bindTransportCleanup(transport, server, res);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      });
    }
  }
};

const mcpPostStateful: RequestHandler = async (req, res) => {
  const sessionId = mcpSessionHttp.getSessionId(req);
  mcpRequestDebug.logPost(config.mcpDebug, sessionId, req.body);

  try {
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports[sessionId]) {
      transport = transports[sessionId];
    } else if (!sessionId && mcpSessionHttp.bodyHasInitialize(req.body)) {
      const eventStore = new InMemoryEventStore();
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        eventStore,
        onsessioninitialized: (sid) => {
          transports[sid] = transport;
        },
      });

      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && transports[sid]) {
          delete transports[sid];
        }
      };

      const server = createOnflyMcpServer();
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      return;
    } else {
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message:
            'Bad Request: No valid session ID. Send header Mcp-Session-Id from the initialize response, ' +
            'or set MCP_STATELESS=1 for one-shot POSTs without sessions. ' +
            'First request must be method "initialize" when starting a session.',
        },
        id: null,
      });
      return;
    }

    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      });
    }
  }
};

if (config.mcpStreamableMode === 'stateless') {
  app.post('/mcp', mcpPostStateless);
  app.get('/mcp', methodNotAllowedJson());
  app.delete('/mcp', methodNotAllowedJson());
  app.listen(config.mcpPort, config.mcpHost, () => {
    console.log(
      `Onfly MCP (stateless HTTP) on http://${config.mcpHost}:${config.mcpPort}/mcp — API ${config.apiBaseUrl}`,
    );
    if (config.mcpDebug) {
      console.log(
        'MCP_DEBUG=1: logging JSON-RPC methods, tool names, and params (PII fields redacted).',
      );
    }
  });
} else {
  const mcpGetHandler: RequestHandler = async (req, res) => {
    const sessionId = mcpSessionHttp.getSessionId(req);
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }
    mcpRequestDebug.logSse(config.mcpDebug, sessionId);
    await transports[sessionId].handleRequest(req, res);
  };

  const mcpDeleteHandler: RequestHandler = async (req, res) => {
    const sessionId = mcpSessionHttp.getSessionId(req);
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }
    mcpRequestDebug.logSessionDelete(config.mcpDebug, sessionId);
    await transports[sessionId].handleRequest(req, res);
  };

  app.post('/mcp', mcpPostStateful);
  app.get('/mcp', mcpGetHandler);
  app.delete('/mcp', mcpDeleteHandler);

  app.listen(config.mcpPort, config.mcpHost, () => {
    console.log(
      `Onfly MCP on http://${config.mcpHost}:${config.mcpPort}/mcp (API: ${config.apiBaseUrl})`,
    );
    if (config.mcpDebug) {
      console.log(
        'MCP_DEBUG=1: logging JSON-RPC methods, tool names, and params (PII fields redacted).',
      );
    }
  });
}

process.on('SIGINT', async () => {
  for (const id of Object.keys(transports)) {
    try {
      await transports[id].close();
    } catch {
      /* ignore */
    }
    delete transports[id];
  }
  process.exit(0);
});
