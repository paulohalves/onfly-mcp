# Onfly MCP

Remote MCP server (Streamable HTTP) that proxies tools to the [Onfly](https://onfly.com) REST API.

## Prerequisites

- Node.js 20+ (tested with Node 24)
- Onfly API bearer token (e.g. from your integration credentials / OAuth flow)

## Configuration

Copy [.env.example](.env.example) to `.env` and set:

- `ONFLY_API_BASE_URL` — default `https://api.onfly.com`
- `ONFLY_DEV_ACCESS_TOKEN` — **development only**: static token so your client does not need `Authorization` on every call
- `MCP_PORT` / `MCP_HOST` — bind address (use `0.0.0.0` only in trusted networks)

For production, prefer sending `Authorization: Bearer <onfly_access_token>` on every `/mcp` request instead of `ONFLY_DEV_ACCESS_TOKEN`.

## Run

```bash
npm install
npm run dev
```

Build and production-style start:

```bash
npm run build
npm start
```

The MCP endpoint is `http://<MCP_HOST>:<MCP_PORT>/mcp`.

## Tools (IDs in English)

| Tool | Description |
|------|-------------|
| `get_my_profile` | `GET /employees/me` |
| `list_expenses` | `GET /expense/expenditure` |
| `get_expense` | `GET /expense/expenditure/{id}` |
| `create_expense` | `POST /expense/expenditure` |
| `list_rdvs` | `GET /expense/rdv` |
| `get_rdv` | `GET /expense/rdv/{id}` |
| `submit_rdv_for_approval` | `POST /expense/rdv` |
| `list_approvals` | `GET /general/approval` |
| `approve_request` | `POST /general/approval/approve/{slug}` |
| `reprove_request` | `POST /general/approval/reprove/{slug}` |
| `list_travel_orders` | `GET /travel/order/{type}-order` |
| `get_travel_order` | `GET /travel/order/{type}-order/{id}` |

Details and roadmap: [docs/onfly_mcp_connector_pipeline.md](docs/onfly_mcp_connector_pipeline.md).

## Notes

- Responses are passed through a PII redaction helper before being returned to the client.
- A process-wide token bucket approximates Onfly’s 200 requests / 30 minutes guideline.
- `submit_rdv_for_approval` payload field names follow the internal spec doc; if the live API differs, adjust `src/tools/rdvs.ts`.
