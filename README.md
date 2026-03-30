# onfly-mcp

Servidor **MCP remoto** (transporte **Streamable HTTP**) que expõe a API REST da [Onfly](https://onfly.com) como **ferramentas** para assistentes (Claude Code, Cursor, etc.). Documentação oficial da API: [onfly.travel/api-doc](https://onfly.travel/api-doc). O token Onfly permanece no seu ambiente; as chamadas à API saem da máquina em que o servidor está em execução.

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
│  5. Retorna JSON para a tool / o modelo     │
└──────────────────┬──────────────────────────┘
                   │ HTTPS
                   ▼
            api.onfly.com (REST)
```

## Por que é seguro (no seu ambiente)


| Camada                | O que faz                                                                                      |
| --------------------- | ---------------------------------------------------------------------------------------------- |
| **Token no servidor** | O access token Onfly não é embutido nas tools; chega por header ou `.env` local (dev).         |
| **HTTPS para Onfly**  | Tráfego para `api.onfly.com` (ou URL do tenant) sobre TLS.                                     |
| **PII**               | Helper de resposta tenta redigir campos sensíveis antes de devolver ao modelo.                 |
| **Rate limit**        | *Token bucket* por processo, alinhado à orientação Onfly (~200 requisições / 30 min).          |
| **Sem OAuth no repo** | A integração parte do princípio de que você já tem um token válido (fluxo da sua organização). |


---

## Requisitos

- **Node.js** 20+ (o projeto foi validado com Node 24)
- Conta / integração Onfly com **access token** válido
- Cliente MCP compatível com **HTTP Streamable** (não é MCP stdio)

---

## Quick Start

Fluxo típico: clonar o repositório, instalar dependências, configurar ambiente e ligar o cliente MCP.

### Opção 1: Desenvolvimento (recomendado)

**macOS / Linux:**

```bash
git clone git@github.com:paulohalves/onfly-mcp.git
cd onfly-mcp
npm install
cp .env.example .env
# Edite o .env: ONFLY_API_BASE_URL e, opcionalmente, ONFLY_DEV_ACCESS_TOKEN (dev)
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

Por padrão, o servidor fica disponível em `**http://127.0.0.1:3000/mcp**`. Se você definir `MCP_DEBUG=1`, o comando `npm run dev` exibe no terminal os métodos e as tools invocadas, sem expor o token.

### Opção 2: Build + execução compilada

Depois de concluir os passos da Opção 1 (clone, `install` e `.env`), você pode executar em modo compilado:

```bash
npm run build
npm start
```

### Registrar no cliente MCP

1. Certifique-se de que o servidor está em execução (Opção 1 ou 2).
2. Use o endpoint MCP em `http://127.0.0.1:3000/mcp` (ou host/porta conforme a sua configuração).
3. Em produção, envie `Authorization: Bearer <token>`; em desenvolvimento, você pode usar `ONFLY_DEV_ACCESS_TOKEN` no `.env` do servidor.

#### Claude Desktop (macOS, Linux, Windows)

O Claude Desktop usa **stdio**. Para conectar ao `onfly-mcp` via HTTP, use o `mcp-remote` como ponte.

**Caminho do `claude_desktop_config.json`:**


| Sistema     | Caminho                                                           |
| ----------- | ----------------------------------------------------------------- |
| **macOS**   | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| **Linux**   | `~/.config/Claude/claude_desktop_config.json`                     |
| **Windows** | `%APPDATA%\Claude\claude_desktop_config.json`                     |


**Exemplo base (`mcpServers`):**

```json
{
  "mcpServers": {
    "onfly": {
      "command": "<NPX_PATH>",
      "args": ["-y", "mcp-remote", "http://127.0.0.1:3000/mcp"]
    }
  }
}
```

`**<NPX_PATH>` por sistema:**

- **macOS:** use o caminho retornado por `which npx` (ex.: `/usr/local/bin/npx`).
- **Linux:** use o caminho retornado por `which npx` (ex.: `/usr/bin/npx`).
- **Windows:** em geral `C:\\Program Files\\nodejs\\npx.cmd` (ou `npx.cmd` se estiver no `PATH`).

Depois de salvar o arquivo, reinicie o Claude Desktop.

#### Claude Code (CLI)

No [Claude Code](https://docs.claude.com/en/docs/claude-code/mcp), use transporte HTTP:

```bash
claude mcp add --transport http onfly http://127.0.0.1:3000/mcp \
  --header "Authorization: Bearer <ONFLY_ACCESS_TOKEN>"
```

Opcionalmente, você pode definir o escopo:

```bash
claude mcp add --transport http onfly --scope local http://127.0.0.1:3000/mcp \
  --header "Authorization: Bearer <ONFLY_ACCESS_TOKEN>"
```

Se você estiver em desenvolvimento com `ONFLY_DEV_ACCESS_TOKEN` no servidor, pode testar sem `--header`.

---

## Configuração


| Variável                 | Descrição                                                                         | Padrão                  |
| ------------------------ | --------------------------------------------------------------------------------- | ----------------------- |
| `ONFLY_API_BASE_URL`     | URL base da API                                                                   | `https://api.onfly.com` |
| `ONFLY_DEV_ACCESS_TOKEN` | Token estático só para desenvolvimento (evita enviar o header em cada requisição) | vazio                   |
| `MCP_PORT`               | Porta HTTP                                                                        | `3000`                  |
| `MCP_HOST`               | *Bind* (usar `0.0.0.0` só em redes confiáveis)                                    | `127.0.0.1`             |
| `MCP_DEBUG`              | `1` ou `true` — log de método/tool (params com chaves PII redigidas)              | —                       |
| `MCP_STATELESS`          | `1` — um POST = sessão nova, sem `Mcp-Session-Id`                                 | *off* (stateful)        |


Em **produção**, use sempre `**Authorization: Bearer <token>*`* em cada requisição a `/mcp` e evite `ONFLY_DEV_ACCESS_TOKEN` em arquivos compartilhados.

### Stateful vs stateless

- **Stateful (padrão):** após `initialize`, o cliente deve enviar o header `**Mcp-Session-Id`**; suporta SSE em `GET /mcp`.
- **Stateless (`MCP_STATELESS=1`):** cada `POST /mcp` cria transporte novo; `GET /mcp` responde 405 — útil para clientes simples que não gerem sessão.

---

## Ferramentas disponíveis

São **63** tools MCP. **Os nomes dos argumentos** estão em inglês (schemas em `src/tools/*.ts`). As tabelas a seguir descrevem **em português** o efeito de cada tool; o texto canônico em inglês está no campo `description` de cada registro. Na coluna **Homologado**, ✅ indica tools já validadas em ambiente real (as demais seguem em revisão).

### Perfil


| Tool             | O que faz                                                                                             | Homologado |
| ---------------- | ----------------------------------------------------------------------------------------------------- | ---------- |
| `get_my_profile` | Retorna o perfil do colaborador autenticado (empresa, permissões, preferências). `GET /employees/me`. | ✅          |


### Colaboradores (diretório)


| Tool                        | O que faz                                                          | Homologado |
| --------------------------- | ------------------------------------------------------------------ | ---------- |
| `list_employees`            | Lista colaboradores da empresa com paginação. `GET /employees`.    |            |
| `get_employee`              | Obtém um colaborador por id. `GET /employees/{id}`.                |            |
| `get_employee_companies`    | Empresas / vínculos do colaborador. `GET /employees/{id}/company`. |            |
| `find_employee_by_document` | Busca colaborador por documento. `GET /employees?document=…`.      |            |


### Colaboradores (mutações)


| Tool                         | O que faz                                                                | Homologado |
| ---------------------------- | ------------------------------------------------------------------------ | ---------- |
| `invite_employee`            | Convida colaborador. `POST /employees/invite` (corpo JSON conforme API). |            |
| `create_employee`            | Cria colaborador. `POST /employees/create`.                              |            |
| `update_employee`            | Atualiza colaborador. `PUT /employees/{id}`.                             |            |
| `update_employee_preference` | Atualiza preferências. `PUT /employees/{id}/preference`.                 |            |
| `deactivate_employee`        | Desativa colaborador. `DELETE /employees/{id}`.                          |            |


### Despesas


| Tool                            | O que faz                                                                                                                                       | Homologado |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `list_expenses`                 | Lista despesas; por padrão só as do usuário autenticado (`userId` + `user[]`). Filtros: datas, estado, RDV, usuário, empresa.                   | ✅          |
| `get_expense`                   | Obtém uma despesa por id. `GET /expense/expenditure/{id}`.                                                                                      |            |
| `create_expense`                | Cria despesa manual. `POST /expense/expenditure`. Envia **ou** `amount` (centavos) **ou** `amount_brl` (reais), não ambos.                      | ✅          |
| `attach_to_expense`             | Anexa um arquivo a uma despesa (modo web JSON ou multipart legado; veja a seção **Anexos** mais abaixo).                                        |            |
| `create_expense_on_latest_trip` | Cria despesa ligada ao RDV mais recente (mesma resolução que `get_my_latest_rdv`), data a partir da viagem, `amount_brl` convertido para a API. |            |


### Tipos de despesa


| Tool                  | O que faz                                                | Homologado |
| --------------------- | -------------------------------------------------------- | ---------- |
| `list_expense_types`  | Lista tipos de despesa. `GET /expense/expenditure-type`. |            |
| `create_expense_type` | Cria tipo de despesa. `POST /expense/expenditure-type`.  |            |


### RDV (relatórios de viagem)


| Tool                      | O que faz                                                                                                      | Homologado |
| ------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------- |
| `list_rdvs`               | Lista RDVs; por padrão, somente os do usuário autenticado. Para obter o “último RDV”, use `get_my_latest_rdv`. |            |
| `get_my_latest_rdv`       | RDV mais recente do usuário (`GET /expense/rdv` ou *fallback* via despesas e `GET /expense/rdv/{id}`).         |            |
| `get_rdv`                 | Obtém um RDV por id. `GET /expense/rdv/{id}`.                                                                  |            |
| `create_rdv`              | Cadastra novo RDV. `POST /expense/rdv` com título, centro de custo, `reason` opcional/null, anexos/tags/adiantamentos/Blue; **período da viagem**: `start_trip_date` / `end_trip_date` (YYYY-MM-DD) → `startTripDate` / `endTripDate`, `isManualTripAutomation` (default true se houver data). |            |
| `submit_rdv_for_approval` | Submete RDV ao fluxo de aprovação. `POST /expense/rdv`.                                                        |            |
| `update_rdv`              | Atualiza RDV. `PUT /expense/rdv/{id}`.                                                                         |            |


### Aprovações


| Tool              | O que faz                                                                                             | Homologado |
| ----------------- | ----------------------------------------------------------------------------------------------------- | ---------- |
| `list_approvals`  | Lista itens pendentes de aprovação (despesas, viagens, adiantamentos, etc.). `GET /general/approval`. |            |
| `approve_request` | Aprova pelo *slug* retornado em `list_approvals`. `POST /general/approval/approve/{slug}`.            |            |
| `reprove_request` | Rejeita pelo *slug*, com motivo. `POST /general/approval/reprove/{slug}`.                             |            |
| `pay_request`     | Marca item como pago pelo *slug*. `POST /general/approval/pay/{slug}`.                                |            |


### Adiantamentos


| Tool                      | O que faz                                                          | Homologado |
| ------------------------- | ------------------------------------------------------------------ | ---------- |
| `list_advance_payments`   | Lista adiantamentos. `GET /expense/advance-payment`.               |            |
| `get_advance_payment`     | Obtém adiantamento por id. `GET /expense/advance-payment/{id}`.    |            |
| `update_advance_payment`  | Atualiza adiantamento. `PUT /expense/advance-payment/{id}`.        |            |
| `archive_advance_payment` | Arquiva adiantamento. `PUT /expense/advance-payment/archive/{id}`. |            |
| `delete_advance_payment`  | Remove adiantamento. `DELETE /expense/advance-payment/{id}`.       |            |


### Viagem (reservas)


| Tool                 | O que faz                                                                              | Homologado |
| -------------------- | -------------------------------------------------------------------------------------- | ---------- |
| `list_travel_orders` | Lista reservas por tipo (voo, hotel, ônibus, carro). `GET /travel/order/{type}-order`. |            |
| `get_travel_order`   | Obtém uma reserva por tipo e id.                                                       |            |


### Viagem (hotéis)


| Tool                        | O que faz                                                                     | Homologado |
| --------------------------- | ----------------------------------------------------------------------------- | ---------- |
| `search_hotel_destinations` | Resolve o destino para busca de hotel. `GET /geolocation/search-destination`. |            |
| `search_hotels`             | Busca disponibilidade de hotéis. `GET /hotel/search`.                         |            |


### Viagem (voos)


| Tool               | O que faz                                                    | Homologado |
| ------------------ | ------------------------------------------------------------ | ---------- |
| `update_fly_order` | Atualiza reserva de voo. `PUT /travel/order/fly-order/{id}`. |            |


### Blue


| Tool                              | O que faz                                                                      | Homologado |
| --------------------------------- | ------------------------------------------------------------------------------ | ---------- |
| `list_blue_transactions`          | Lista transações de cartão Blue. `GET /blue/transaction`.                      |            |
| `list_blue_internal_transactions` | Lista transações internas Blue. `GET /blue/transaction/internal`.              |            |
| `list_blue_cards`                 | Lista cartões Blue. `GET /blue/card`.                                          |            |
| `get_blue_card`                   | Obtém cartão Blue por id. `GET /blue/card/{id}`.                               |            |
| `update_blue_card_balance`        | Atualiza saldo / operação financeira no cartão. `PUT /blue/card/{id}/balance`. |            |


### Créditos


| Tool                       | O que faz                                                                | Homologado |
| -------------------------- | ------------------------------------------------------------------------ | ---------- |
| `list_credits_by_consumer` | Lista créditos agrupados por consumidor. `GET /credits/groupByConsumer`. |            |


### Integração Onfly


| Tool                             | O que faz                                                                                                         | Homologado |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------- |
| `put_integration_metadata`       | Sincroniza metadados de integração (ex.: ERP: usuário, centro de custo, tag). `PUT /integration/metadata/{hash}`. |            |
| `create_integration_expenditure` | Cria despesa via integração (cartão / payload de integração). `POST /integration/expenditure`.                    |            |


### Anexos (API geral)


| Tool                        | O que faz                                                                              | Homologado |
| --------------------------- | -------------------------------------------------------------------------------------- | ---------- |
| `get_attachment_by_receipt` | Obtém anexo associado a um recibo. `GET /general/attachment/{receiptId}`.              |            |
| `get_rdv_attachment`        | Obtém anexo no *namespace* de um RDV. `GET /general/attachment/{table_type}/{rdv_id}`. |            |


### Configurações (somente leitura)


| Tool                                 | O que faz                                                                                      | Homologado |
| ------------------------------------ | ---------------------------------------------------------------------------------------------- | ---------- |
| `list_employee_groups`               | Lista grupos de colaboradores. `GET /employee-groups`.                                         |            |
| `list_cost_centers`                  | Lista centros de custo. `GET /settings/cost-center`.                                           |            |
| `list_tags`                          | Lista etiquetas. `GET /settings/tag`.                                                          |            |
| `get_company`                        | Dados da empresa. `GET /company`.                                                              |            |
| `get_general_settings`               | Configurações gerais. `GET /settings/general`.                                                 |            |
| `list_budgets`                       | Lista orçamentos. `GET /settings/budget`.                                                      |            |
| `get_budget`                         | Obtém orçamento por id. `GET /settings/budget/{id}`.                                           |            |
| `list_travel_policy_approval_groups` | Lista grupos de aprovação da política de viagem. `GET /settings/travel-policy/approval-group`. |            |
| `get_travel_policy_approval_group`   | Obtém grupo de aprovação por id.                                                               |            |
| `list_travel_policy_rules`           | Lista regras da política de viagem. `GET /settings/travel-policy/policy`.                      |            |
| `list_custom_fields_v3`              | Lista campos personalizados (v3). `GET /settings/custom-fields-v3`.                            |            |
| `get_travel_policy_rule`             | Obtém regra de política por id. `GET /settings/travel-policy/policy/{id}`.                     |            |


### Configurações (escrita)


| Tool                  | O que faz                                                         | Homologado |
| --------------------- | ----------------------------------------------------------------- | ---------- |
| `create_cost_center`  | Cria centro de custo. `POST /settings/cost-center`.               |            |
| `update_cost_center`  | Atualiza centro de custo. `PUT /settings/cost-center/{id}`.       |            |
| `delete_cost_center`  | Remove centro de custo. `DELETE /settings/cost-center/{id}`.      |            |
| `create_tag`          | Cria etiqueta. `POST /settings/tag`.                              |            |
| `update_custom_field` | Atualiza campo personalizado. `PUT /settings/custom-fields/{id}`. |            |


---

## Anexos (`attach_to_expense`)

Fluxo prioritário (igual ao da plataforma/web app):

`POST /general/attachments/4/1/{expenditure_id}/true` com JSON  
`{ "files": [ { "file": "data:image/jpeg;base64,...", "filename": "..." } ] }`

- **Modo padrão (`web_app_json`):** usa exatamente esse formato (`files[].file` + `files[].filename`).
- `**file` + `filename`** (ou array `files`) é o formato recomendado para o agente.
- Nos argumentos da tool: `**file**` (data URL ou base64) + `**filename**`, ou `**files**`. O `**file_path**` existe **só no MCP**: o servidor lê esse caminho **na máquina onde o onfly-mcp roda** e monta o mesmo upload (bytes no `file`); não é um parâmetro da API Onfly.
- Arquivos grandes: `**file_path`** reduz o tamanho do JSON da tool (o arquivo continua indo como `file` na wire).
- Contrato multipart documentado também existe: `POST /general/attachment/4/1/{expenditure_id}` com campo `**file**` (equivalente a `curl --form 'file=@"/caminho/local/img.jpeg"'`), disponível via `upload_mode: collection_multipart`.
- Falha no modo web com **um** arquivo pode acionar **fallback** automático para multipart.

**Tamanho do anexo (Onfly):** até **10 MiB** por arquivo (decodificado); a tool recusa antes do envio se ultrapassar.

**Timeout no Claude / “No result received” com anexos:** o servidor usa `express.json` com limite alto (`MCP_JSON_BODY_LIMIT`, padrão **18mb**, suficiente para ~~10 MiB em base64 no JSON-RPC). O limite padrão do Express (~~100kb) descarta corpos maiores e o cliente pode ficar minutos à espera. Aumente `MCP_JSON_BODY_LIMIT` se precisar de margem; com `MCP_DEBUG=1`, payloads grandes de `attach_to_expense` são truncados no log para não bloquear o processo.

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
│   │   └── create-onfly-mcp-server.ts  # Registro de tools + instruções MCP
│   └── tools/                   # Uma área por domínio (expenses, rdvs, …)
├── docs/                        # Ex.: PDF da API Onfly (local)
├── package.json
├── tsconfig.json
└── .env.example
```

---

## Scripts


| Comando             | Descrição                     |
| ------------------- | ----------------------------- |
| `npm run dev`       | `tsx watch` com `MCP_DEBUG=1` |
| `npm run dev:quiet` | *Watch* sem debug             |
| `npm run build`     | `tsc` → `dist/`               |
| `npm start`         | `node dist/index.js`          |
| `npm run typecheck` | `tsc --noEmit`                |


---

## Documentação adicional

- **Documentação oficial da API Onfly:** [https://onfly.travel/api-doc](https://onfly.travel/api-doc) — contratos REST, autenticação e referência dos *endpoints*.

