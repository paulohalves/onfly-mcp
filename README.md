# onfly-mcp

Servidor **MCP remoto** (transporte **Streamable HTTP**) que expõe a API REST da [Onfly](https://onfly.com) como **ferramentas** para assistentes (Claude Code, Cursor, etc.). Documentação oficial da API: [onfly.travel/api-doc](https://onfly.travel/api-doc). O token Onfly permanece no teu ambiente; chamadas à API saem da máquina onde o servidor corre.

---

## Como funciona

```
┌─────────────────────────┐
│  Cliente MCP (HTTP)    │
│  Cursor / Claude / …   │
└───────────┬─────────────┘
            │ JSON-RPC 2.0 (Streamable HTTP)
            │ POST /mcp  (+ Authorization: Bearer)
            ▼
┌─────────────────────────────────────────────┐
│              onfly-mcp (Node.js)            │
│                                             │
│  1. Valida Bearer (header ou dev .env)      │
│  2. Rate limit (~200 req / 30 min bucket)  │
│  3. Chama endpoints Onfly com o token       │
│  4. Reduz PII nas respostas                 │
│  5. Devolve JSON à ferramenta / modelo      │
└──────────────────┬──────────────────────────┘
                   │ HTTPS
                   ▼
            api.onfly.com (REST)
```

### Passo a passo

1. O cliente envia uma chamada MCP (ex.: `tools/call` → `list_expenses`) para `http://<host>:<porta>/mcp`.
2. O middleware exige **Bearer** (`Authorization: Bearer <token>`) ou usa `ONFLY_DEV_ACCESS_TOKEN` só em desenvolvimento.
3. Cada tool mapeia parâmetros validados (Zod) para pedidos `fetch` à `ONFLY_API_BASE_URL`.
4. Erros da API são devolvidos como texto/JSON para o modelo decidir retry ou mensagem ao utilizador.
5. Respostas passam por um filtro de **PII** antes de serem serializadas para o cliente MCP.

---

## Porquê é seguro (no teu ambiente)

| Camada | O que faz |
|--------|-----------|
| **Token no servidor** | O access token Onfly não é embutido nas tools; chega por header ou `.env` local (dev). |
| **HTTPS para Onfly** | Tráfego para `api.onfly.com` (ou URL do tenant) sobre TLS. |
| **PII** | Helper de resposta tenta redigir campos sensíveis antes de devolver ao modelo. |
| **Rate limit** | *Token bucket* por processo alinhado à orientação Onfly (~200 pedidos / 30 min). |
| **Sem OAuth no repo** | Integração assume que já tens um token válido (fluxo da tua organização). |

O que o modelo **vê**: resultados de API já filtrados, erros, `success: false` em writes. O que **não** deves commitar: `.env` com tokens reais.

---

## Requisitos

- **Node.js** 20+ (o projeto foi validado com Node 24)
- Conta / integração Onfly com **access token** válido
- Cliente MCP compatível com **HTTP Streamable** (não é MCP stdio)

---

## Quick Start

Fluxo típico: clonar o repositório, instalar dependências, configurar ambiente e ligar o cliente MCP. **Nota:** o onfly-mcp usa transporte **HTTP Streamable** (`POST /mcp`), não MCP via **stdio** em exclusivo — clientes só com stdio podem usar uma ponte (ex.: `mcp-remote`); quem falar HTTP tem de apontar para o endpoint `/mcp`.

### Opção 1: Desenvolvimento (recomendado)

**macOS / Linux:**

```bash
git clone git@github.com:paulohalves/onfly-mcp.git
cd onfly-mcp
npm install
cp .env.example .env
# Edita .env: ONFLY_API_BASE_URL, e opcionalmente ONFLY_DEV_ACCESS_TOKEN (dev)
npm run dev
```

**Windows (PowerShell):**

```powershell
git clone git@github.com:paulohalves/onfly-mcp.git
cd onfly-mcp
npm install
Copy-Item .env.example .env
# Editar .env conforme necessário
npm run dev
```

Por defeito o servidor expõe **`http://127.0.0.1:3000/mcp`**. Com `MCP_DEBUG=1`, o script `dev` regista método/tool na consola (sem expor o token).

### Opção 2: Setup manual (build + `node`)

Útil para correr apenas JavaScript compilado (sem `tsx watch`):

```bash
git clone git@github.com:paulohalves/onfly-mcp.git
cd onfly-mcp
npm install
cp .env.example .env
npm run build
npm start
```

Equivalente a `node dist/index.js` com as mesmas variáveis de ambiente.

### Registar no cliente MCP

1. Garante que o servidor está a escutar (Opção 1 ou 2).
2. A URL base do MCP é **`http://127.0.0.1:3000/mcp`** (ou o host/porta que definires).
3. **Autenticação:** envia **`Authorization: Bearer <token>`** em cada pedido HTTP **ou**, só em desenvolvimento, define **`ONFLY_DEV_ACCESS_TOKEN`** no `.env` do **servidor** `onfly-mcp` para aceitar pedidos sem header (ver tabela **Configuração**).

Alguns clientes falam HTTP direto com `url` + `headers`; o **Claude Desktop** costuma usar **stdio** e um pacote como **`mcp-remote`** para fazer de ponte até ao mesmo endpoint HTTP.

#### Claude Desktop

O Claude Desktop arranca um processo **stdio**; o pacote **`mcp-remote`** (via `npx`) faz de ponte até ao mesmo endpoint HTTP do `onfly-mcp` (`http://127.0.0.1:3000/mcp` por defeito).

**Onde editar `claude_desktop_config.json`** (o ficheiro pode não existir — cria-o na pasta indicada):

| Sistema | Caminho típico |
|--------|----------------|
| **macOS** | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| **Linux** | `~/.config/Claude/claude_desktop_config.json` (convenção [XDG](https://specifications.freedesktop.org/basedir-spec/basedir-spec-latest.html)) |
| **Windows** | `%APPDATA%\Claude\claude_desktop_config.json` — na prática `C:\Users\<utilizador>\AppData\Roaming\Claude\claude_desktop_config.json` |

Exemplo de `mcpServers` (o bloco JSON é igual em todos os sistemas; muda sobretudo o **`command`** para o executável `npx`):

```json
{
  "mcpServers": {
    "onfly": {
      "command": "/usr/local/bin/npx",
      "args": ["-y", "mcp-remote", "http://127.0.0.1:3000/mcp"]
    }
  }
}
```

**`command` por sistema:**

- **macOS:** muitas vezes `/usr/local/bin/npx` (Homebrew) ou o resultado de `which npx` (incl. instalações via `nvm`).
- **Linux:** usa o caminho absoluto de `which npx` (ex.: `/usr/bin/npx`); com **nvm**, costuma ser algo como `$HOME/.nvm/versions/node/<versão>/bin/npx`. Garante que o Claude Desktop consegue arrancar esse binário (às vezes o app não herda o mesmo `PATH` que o teu terminal — nesse caso o caminho absoluto resolve).
- **Windows:** o Node instala normalmente `npx.cmd` em `C:\Program Files\nodejs\`. Podes usar `"command": "C:\\Program Files\\nodejs\\npx.cmd"` (barra dupla em JSON) ou, se o `PATH` do ambiente do utilizador incluir Node, `"command": "npx"` / `"npx.cmd"` conforme o que funcionar ao testar. Alternativa: `"command": "cmd"` com `"args": ["/c", "npx", "-y", "mcp-remote", "http://127.0.0.1:3000/mcp"]`.

**Autenticação:** com esta forma **não há `headers` no JSON** em muitos setups — em desenvolvimento usa normalmente `ONFLY_DEV_ACCESS_TOKEN` no `.env` do **servidor** `onfly-mcp`. Se precisares de Bearer no HTTP, vê na documentação do `mcp-remote` suporte a variáveis ou headers; nunca commits tokens no repositório.

Reinicia o Claude Desktop após alterar o ficheiro (as alterações não são aplicadas em quente).

#### Outros clientes (MCP remoto HTTP)

Exemplo genérico quando o cliente aceita **URL + headers** (nomes de chaves podem variar):

```json
{
  "mcpServers": {
    "onfly": {
      "url": "http://127.0.0.1:3000/mcp",
      "headers": {
        "Authorization": "Bearer <ONFLY_ACCESS_TOKEN>"
      }
    }
  }
}
```

#### Claude Code (CLI)

No [Claude Code](https://docs.claude.com/en/docs/claude-code/mcp), o transporte **HTTP** é o recomendado para MCP remoto. Com o `onfly-mcp` a correr localmente (Opção 1 ou 2), regista o servidor assim:

**Com token no header** (recomendado; alinhado com produção):

```bash
claude mcp add --transport http onfly http://127.0.0.1:3000/mcp \
  --header "Authorization: Bearer <ONFLY_ACCESS_TOKEN>"
```

**Âmbito da configuração** (opcional; ver `claude mcp add --help`):

```bash
claude mcp add --transport http onfly --scope local http://127.0.0.1:3000/mcp \
  --header "Authorization: Bearer <ONFLY_ACCESS_TOKEN>"
```

Os flags (`--transport`, `--scope`, `--header`, …) devem ir **antes** do nome do servidor (`onfly`), conforme a [documentação MCP do Claude Code](https://docs.claude.com/en/docs/claude-code/mcp).

**Sem passar o header no cliente (só desenvolvimento):** se no `.env` do servidor definires `ONFLY_DEV_ACCESS_TOKEN`, o middleware aceita pedidos sem `Authorization` e usa esse token. Ainda assim, em cenários reais o mais seguro é **não** depender disto e usar o `--header` na CLI.

**Equivalente em JSON** (útil para automatizar ou copiar definições):

```bash
claude mcp add-json onfly \
  '{"type":"http","url":"http://127.0.0.1:3000/mcp","headers":{"Authorization":"Bearer <ONFLY_ACCESS_TOKEN>"}}'
```

Se o cliente não enviar o header `Mcp-Session-Id` após o `initialize`, define `MCP_STATELESS=1` no `.env` do servidor (ver secção **Configuração**).

Consulta também a documentação do **Cursor** ou de outros clientes para o formato exacto de *remote MCP over HTTP* (o **Claude Desktop** está descrito acima com `mcp-remote`).

---

## Configuração

| Variável | Descrição | Defeito |
|----------|-----------|---------|
| `ONFLY_API_BASE_URL` | Base URL da API | `https://api.onfly.com` |
| `ONFLY_DEV_ACCESS_TOKEN` | Token estático só para dev (evita header em cada pedido) | vazio |
| `MCP_PORT` | Porta HTTP | `3000` |
| `MCP_HOST` | *Bind* (usar `0.0.0.0` só em redes confiáveis) | `127.0.0.1` |
| `MCP_DEBUG` | `1` ou `true` — log de método/tool (params com chaves PII redigidas) | — |
| `MCP_STATELESS` | `1` — um POST = sessão nova, sem `Mcp-Session-Id` | *off* (stateful) |

Em **produção**, prefere sempre **`Authorization: Bearer <token>`** em cada pedido a `/mcp` e evita `ONFLY_DEV_ACCESS_TOKEN` em ficheiros partilhados.

### Stateful vs stateless

- **Stateful (defeito):** após `initialize`, o cliente deve enviar o header **`Mcp-Session-Id`**; suporta SSE em `GET /mcp`.
- **Stateless (`MCP_STATELESS=1`):** cada `POST /mcp` cria transporte novo; `GET /mcp` responde 405 — útil para clientes simples que não gerem sessão.

---

## Ferramentas disponíveis

São **63** tools MCP. **Nomes dos argumentos** estão em inglês (schemas em `src/tools/*.ts`). As tabelas abaixo descrevem **em português** o efeito de cada tool; o texto canónico em inglês está no campo `description` de cada registo.

### Perfil

| Tool | O que faz |
|------|-----------|
| `get_my_profile` | Devolve o perfil do colaborador autenticado (empresa, permissões, preferências). `GET /employees/me`. |

### Colaboradores (diretório)

| Tool | O que faz |
|------|-----------|
| `list_employees` | Lista colaboradores da empresa com paginação. `GET /employees`. |
| `get_employee` | Obtém um colaborador por id. `GET /employees/{id}`. |
| `get_employee_companies` | Empresas / vínculos do colaborador. `GET /employees/{id}/company`. |
| `find_employee_by_document` | Procura colaborador por documento. `GET /employees?document=…`. |

### Colaboradores (mutações)

| Tool | O que faz |
|------|-----------|
| `invite_employee` | Convida colaborador. `POST /employees/invite` (corpo JSON conforme API). |
| `create_employee` | Cria colaborador. `POST /employees/create`. |
| `update_employee` | Atualiza colaborador. `PUT /employees/{id}`. |
| `update_employee_preference` | Atualiza preferências. `PUT /employees/{id}/preference`. |
| `deactivate_employee` | Desativa colaborador. `DELETE /employees/{id}`. |

### Despesas

| Tool | O que faz |
|------|-----------|
| `list_expenses` | Lista despesas; por defeito só as do utilizador autenticado (`userId` + `user[]`). Filtros: datas, estado, RDV, utilizador, empresa. |
| `get_expense` | Obtém uma despesa por id. `GET /expense/expenditure/{id}`. |
| `create_expense` | Cria despesa manual. `POST /expense/expenditure`. Envia **ou** `amount` (centavos) **ou** `amount_brl` (reais), não ambos. |
| `attach_to_expense` | Anexa ficheiro a uma despesa (modo web JSON ou multipart legado; ver secção **Anexos** mais abaixo). |
| `create_expense_on_latest_trip` | Cria despesa ligada ao RDV mais recente (mesma resolução que `get_my_latest_rdv`), data a partir da viagem, `amount_brl` convertido para a API. |

### Tipos de despesa

| Tool | O que faz |
|------|-----------|
| `list_expense_types` | Lista tipos de despesa. `GET /expense/expenditure-type`. |
| `create_expense_type` | Cria tipo de despesa. `POST /expense/expenditure-type`. |

### RDV (relatórios de viagem)

| Tool | O que faz |
|------|-----------|
| `list_rdvs` | Lista RDVs; por defeito só os do utilizador autenticado. Para “último RDV” usar `get_my_latest_rdv`. |
| `get_my_latest_rdv` | RDV mais recente do utilizador (`GET /expense/rdv` ou *fallback* via despesas + `GET /expense/rdv/{id}`). |
| `get_rdv` | Obtém um RDV por id. `GET /expense/rdv/{id}`. |
| `submit_rdv_for_approval` | Submete RDV ao fluxo de aprovação. `POST /expense/rdv`. |
| `update_rdv` | Atualiza RDV. `PUT /expense/rdv/{id}`. |

### Aprovações

| Tool | O que faz |
|------|-----------|
| `list_approvals` | Lista itens pendentes de aprovação (despesas, viagens, adiantamentos, etc.). `GET /general/approval`. |
| `approve_request` | Aprova pelo *slug* devolvido em `list_approvals`. `POST /general/approval/approve/{slug}`. |
| `reprove_request` | Rejeita pelo *slug*, com motivo. `POST /general/approval/reprove/{slug}`. |
| `pay_request` | Marca item como pago pelo *slug*. `POST /general/approval/pay/{slug}`. |

### Adiantamentos

| Tool | O que faz |
|------|-----------|
| `list_advance_payments` | Lista adiantamentos. `GET /expense/advance-payment`. |
| `get_advance_payment` | Obtém adiantamento por id. `GET /expense/advance-payment/{id}`. |
| `update_advance_payment` | Atualiza adiantamento. `PUT /expense/advance-payment/{id}`. |
| `archive_advance_payment` | Arquiva adiantamento. `PUT /expense/advance-payment/archive/{id}`. |
| `delete_advance_payment` | Remove adiantamento. `DELETE /expense/advance-payment/{id}`. |

### Viagem (pedidos)

| Tool | O que faz |
|------|-----------|
| `list_travel_orders` | Lista reservas por tipo (voo, hotel, autocarro, carro). `GET /travel/order/{type}-order`. |
| `get_travel_order` | Obtém uma reserva por tipo e id. |

### Viagem (hotéis)

| Tool | O que faz |
|------|-----------|
| `search_hotel_destinations` | Resolve destino para pesquisa de hotel. `GET /geolocation/search-destination`. |
| `search_hotels` | Pesquisa disponibilidade de hotéis. `GET /hotel/search`. |

### Viagem (voos)

| Tool | O que faz |
|------|-----------|
| `update_fly_order` | Atualiza pedido de voo. `PUT /travel/order/fly-order/{id}`. |

### Blue

| Tool | O que faz |
|------|-----------|
| `list_blue_transactions` | Lista transações de cartão Blue. `GET /blue/transaction`. |
| `list_blue_internal_transactions` | Lista transações internas Blue. `GET /blue/transaction/internal`. |
| `list_blue_cards` | Lista cartões Blue. `GET /blue/card`. |
| `get_blue_card` | Obtém cartão Blue por id. `GET /blue/card/{id}`. |
| `update_blue_card_balance` | Atualiza saldo / operação financeira no cartão. `PUT /blue/card/{id}/balance`. |

### Créditos

| Tool | O que faz |
|------|-----------|
| `list_credits_by_consumer` | Lista créditos agrupados por consumidor. `GET /credits/groupByConsumer`. |

### Integração Onfly

| Tool | O que faz |
|------|-----------|
| `put_integration_metadata` | Sincroniza metadados de integração (ex.: ERP: utilizador, centro de custo, tag). `PUT /integration/metadata/{hash}`. |
| `create_integration_expenditure` | Cria despesa via integração (cartão / payload de integração). `POST /integration/expenditure`. |

### Anexos (API geral)

| Tool | O que faz |
|------|-----------|
| `get_attachment_by_receipt` | Obtém anexo associado a um recibo. `GET /general/attachment/{receiptId}`. |
| `get_rdv_attachment` | Obtém anexo no *namespace* de um RDV. `GET /general/attachment/{table_type}/{rdv_id}`. |

### Definições (leitura)

| Tool | O que faz |
|------|-----------|
| `list_employee_groups` | Lista grupos de colaboradores. `GET /employee-groups`. |
| `list_cost_centers` | Lista centros de custo. `GET /settings/cost-center`. |
| `list_tags` | Lista etiquetas. `GET /settings/tag`. |
| `get_company` | Dados da empresa. `GET /company`. |
| `get_general_settings` | Definições gerais. `GET /settings/general`. |
| `list_budgets` | Lista orçamentos. `GET /settings/budget`. |
| `get_budget` | Obtém orçamento por id. `GET /settings/budget/{id}`. |
| `list_travel_policy_approval_groups` | Lista grupos de aprovação da política de viagem. `GET /settings/travel-policy/approval-group`. |
| `get_travel_policy_approval_group` | Obtém grupo de aprovação por id. |
| `list_travel_policy_rules` | Lista regras da política de viagem. `GET /settings/travel-policy/policy`. |
| `list_custom_fields_v3` | Lista campos personalizados (v3). `GET /settings/custom-fields-v3`. |
| `get_travel_policy_rule` | Obtém regra de política por id. `GET /settings/travel-policy/policy/{id}`. |

### Definições (escrita)

| Tool | O que faz |
|------|-----------|
| `create_cost_center` | Cria centro de custo. `POST /settings/cost-center`. |
| `update_cost_center` | Atualiza centro de custo. `PUT /settings/cost-center/{id}`. |
| `delete_cost_center` | Remove centro de custo. `DELETE /settings/cost-center/{id}`. |
| `create_tag` | Cria etiqueta. `POST /settings/tag`. |
| `update_custom_field` | Atualiza campo personalizado. `PUT /settings/custom-fields/{id}`. |

### Índice alfabético

`approve_request` · `archive_advance_payment` · `attach_to_expense` · `create_cost_center` · `create_employee` · `create_expense` · `create_expense_on_latest_trip` · `create_expense_type` · `create_integration_expenditure` · `create_tag` · `deactivate_employee` · `delete_advance_payment` · `delete_cost_center` · `find_employee_by_document` · `get_advance_payment` · `get_attachment_by_receipt` · `get_blue_card` · `get_budget` · `get_company` · `get_employee` · `get_employee_companies` · `get_expense` · `get_general_settings` · `get_my_latest_rdv` · `get_my_profile` · `get_rdv` · `get_rdv_attachment` · `get_travel_order` · `get_travel_policy_approval_group` · `get_travel_policy_rule` · `invite_employee` · `list_advance_payments` · `list_approvals` · `list_blue_cards` · `list_blue_internal_transactions` · `list_blue_transactions` · `list_budgets` · `list_cost_centers` · `list_credits_by_consumer` · `list_custom_fields_v3` · `list_employee_groups` · `list_employees` · `list_expense_types` · `list_expenses` · `list_rdvs` · `list_tags` · `list_travel_orders` · `list_travel_policy_approval_groups` · `list_travel_policy_rules` · `pay_request` · `put_integration_metadata` · `reprove_request` · `search_hotel_destinations` · `search_hotels` · `submit_rdv_for_approval` · `update_advance_payment` · `update_blue_card_balance` · `update_cost_center` · `update_custom_field` · `update_employee` · `update_employee_preference` · `update_fly_order` · `update_rdv`

---

## Anexos (`attach_to_expense`)

Para espelhar o **front-end** Onfly, o modo por defeito envia **JSON** para:

`POST /general/attachments/4/1/{expenditure_id}/true`  

com corpo `{ "files": [ { "file": "data:…;base64,…", "filename": "…" } ] }`.

- Usa o argumento **`file`** (não um nome genérico de base64) + **`filename`**, ou o array **`files`**.
- Para ficheiros grandes, **`file_path`** lê o ficheiro no servidor e evita truncamento no payload da tool.
- Secundário: `upload_mode: collection_multipart` → `POST /general/attachment/4/1/{id}` com **multipart** `file` (estilo coleção antiga).
- Falha no modo web com **um** ficheiro pode fazer **fallback** automático para multipart.

---

## Estrutura do projeto

```
onfly-mcp/
├── src/
│   ├── index.ts                 # Express + Streamable HTTP (/mcp)
│   ├── config.ts                # Variáveis de ambiente
│   ├── auth/                    # Bearer (dev + produção)
│   ├── api/                     # Cliente Onfly, rate limit, filtro PII
│   ├── server/
│   │   └── create-onfly-mcp-server.ts  # Registo de tools + instruções MCP
│   └── tools/                   # Uma área por domínio (expenses, rdvs, …)
├── docs/
│   └── onfly_mcp_connector_pipeline.md  # Pipeline / detalhe de API
├── package.json
├── tsconfig.json
└── .env.example
```

---

## Scripts

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | `tsx watch` com `MCP_DEBUG=1` |
| `npm run dev:quiet` | *Watch* sem debug |
| `npm run build` | `tsc` → `dist/` |
| `npm start` | `node dist/index.js` |
| `npm run typecheck` | `tsc --noEmit` |

---

## Documentação adicional

- [Documentação oficial da API Onfly](https://onfly.travel/api-doc) — contratos REST, autenticação e referência de endpoints.
- [docs/onfly_mcp_connector_pipeline.md](docs/onfly_mcp_connector_pipeline.md) — conector, mapeamento de endpoints e notas de produto.