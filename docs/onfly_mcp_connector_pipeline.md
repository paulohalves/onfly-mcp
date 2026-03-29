# Pipeline de Análise: Conector MCP Onfly para Claude

**Data:** 29/03/2026  
**Versão:** 1.0  
**Referências:** Brex MCP, Ramp MCP, Trivago, Booking.com  
**Escopo:** Conector MCP remoto (Streamable HTTP) para integração da plataforma Onfly com Claude

---

## Sumário Executivo

Este documento consolida a análise de cinco agentes especializados — Analista de Negócios, Product Manager, Analista de Cybersegurança, Advogado do Diabo e Documentarista — para definir a arquitetura, escopo, segurança e documentação do conector MCP da Onfly para o ecossistema Claude (claude.ai, Claude Desktop, Claude Code, API).

A premissa fundamental: **a autenticação será via OAuth 2.0, redirecionando o usuário para a página de login da Onfly, onde o token do usuário logado será capturado. Todos os acessos e perfis de uso (Administrador, Gerente de Viagem, Colaborador) já estarão herdados automaticamente da sessão do usuário na Onfly.**

---

## AGENTE 1: Analista de Negócios

### 1.1 Mapeamento do Domínio Onfly

A Onfly é uma plataforma brasileira de gestão de viagens corporativas e despesas. A API (`api.onfly.com.br`) cobre os seguintes domínios:

| Domínio | Endpoints Principais | Operações |
|---------|---------------------|-----------|
| **Colaboradores** | `/employees`, `/employees/me`, `/employees/{id}` | CRUD completo, convite, perfil próprio |
| **Grupos** | `/employee-groups` | Leitura |
| **Centros de Custo** | `/settings/cost-center` | CRUD |
| **Tags** | `/settings/tag` | CRUD |
| **Empresa** | `/company`, `/settings/general` | Leitura, configurações |
| **Despesas (Expenditures)** | `/expense/expenditure` | CRUD, anexos, filtros por ID/colaborador/RDV |
| **Tipos de Despesa** | `/expense/expenditure-type` | CRUD |
| **RDVs (Relatórios de Viagem)** | `/expense/rdv` | CRUD, status (pago/aprovado/reprovado/arquivado), envio para aprovação |
| **Adiantamentos** | `/expense/advance-payment` | CRUD, status, pagamento |
| **Viagens - Aéreo** | `/travel/order/fly-order` | Leitura, edição |
| **Viagens - Hotel** | `/travel/order/hotel-order`, `/hotel/search` | Leitura, busca de hotéis (geolocation + search + book) |
| **Viagens - Ônibus** | `/travel/order/bus-order` | Leitura |
| **Viagens - Veículo** | `/travel/order/auto-order` | Leitura |
| **Aprovações** | `/general/approval` | Listar, aprovar, reprovar |
| **Orçamento** | `/settings/budget` | Leitura |
| **Cartões Corporativos** | `/blue/transaction`, `/blue/card` | Leitura, movimentações, saldo |
| **Anexos** | `/general/attachment` | Download de comprovantes |
| **Políticas** | `/settings/travel-policy/approval-group`, `/settings/travel-policy/policy` | CRUD completo |
| **Integração/Metadados** | `/integration/metadata`, `/integration/expenditure` | Metadados ERP, despesas de cartão/integração |
| **Créditos** | `/credits/groupByConsumer` | Leitura |
| **Campos Gerenciais** | `/settings/custom-fields` | CRUD |
| **Data & Analytics** | Endpoints de BI (despesas, RDVs, adiantamentos, reservas) | Leitura analítica |

### 1.2 Personas e Casos de Uso

**Persona 1: Colaborador (viajante)**
- "Quais são minhas despesas pendentes de aprovação?"
- "Qual o status da minha solicitação de viagem para São Paulo?"
- "Tenho algum adiantamento disponível?"
- "Quais minhas reservas de voo próximas?"

**Persona 2: Gestor / Gerente de Viagem**
- "Quais RDVs estão aguardando minha aprovação?"
- "Aprove o relatório de despesas do João"
- "Quanto o centro de custo Marketing gastou este mês?"
- "Liste todas as reservas de hotel da equipe para abril"

**Persona 3: Administrador / Financeiro**
- "Quais RDVs estão aguardando pagamento?"
- "Marque o RDV #12345 como pago"
- "Qual o orçamento restante do centro de custo TI?"
- "Liste transações do cartão corporativo da última semana"
- "Exporte dados de despesas para integração com ERP"

### 1.3 Benchmarking: Como os Concorrentes Estruturaram

| Conector | Tools Principais | Padrão |
|----------|-----------------|--------|
| **Brex** | Transações, categorização, análise de compliance, anomalias | Read-heavy com analytics em SQLite interno |
| **Ramp** | Transações (SQL), cartões, departamentos, vendors, bills | SQL-over-API — transforma JSON em SQLite para queries analíticas |
| **Trivago** | Busca de hotéis, comparação de preços, disponibilidade | Search-first, read-only |
| **Booking.com** | Reservas, disponibilidade, detalhes de propriedade | Search + booking flow em etapas |

**Insight chave do Ramp:** A evolução de "expor endpoints como tools" para "ETL interno + SQLite" resolveu problemas de context window e precisão de cálculos. A Onfly deveria considerar uma tool analítica similar para Data & Analytics.

### 1.4 Proposta de Value Proposition

O conector Onfly para Claude permite que gestores de viagem, financeiros e colaboradores interajam com toda a plataforma de gestão de viagens e despesas usando linguagem natural, eliminando a necessidade de navegar entre múltiplas telas e relatórios.

---

## AGENTE 2: Product Manager

### 2.1 Definição de Tools (MCP)

Baseado na análise de domínio, benchmarking e princípios de design de tools MCP (tools devem ser atômicas, bem descritas, e com escopo claro), proponho a seguinte estrutura:

#### Tier 1 — Core (MVP, lançamento)

| # | Tool Name | Descrição | Método HTTP | Endpoint Base | Params Chave |
|---|-----------|-----------|-------------|---------------|--------------|
| 1 | `get_my_profile` | Retorna perfil do usuário autenticado, incluindo empresa, permissões e preferências | GET | `/employees/me` | `include` |
| 2 | `list_expenses` | Lista despesas com filtros por data, status, colaborador, RDV | GET | `/expense/expenditure` | `startDate`, `endDate`, `userId`, `status[]`, `rdv[]`, `perPage`, `page`, `include` |
| 3 | `get_expense` | Obtém detalhes de uma despesa específica | GET | `/expense/expenditure/{id}` | `include` |
| 4 | `create_expense` | Cria nova despesa manual | POST | `/expense/expenditure` | `date`, `amount`, `description`, `expenditureTypeId`, `costCenterId`, `rdvId` |
| 5 | `list_rdvs` | Lista relatórios de viagem (RDVs) com filtros | GET | `/expense/rdv` | `startDate`, `endDate`, `status[]`, `userId`, `perPage`, `page`, `include` |
| 6 | `get_rdv` | Obtém detalhes de um RDV específico | GET | `/expense/rdv/{id}` | `include` |
| 7 | `submit_rdv_for_approval` | Envia RDV para o fluxo de aprovação | POST | `/expense/rdv` (submit) | `rdvId`, `expendituresId[]`, `tagsId[]`, `costCenterId` |
| 8 | `list_approvals` | Lista aprovações pendentes, aprovadas ou reprovadas | GET | `/general/approval` | `status[]`, `types[]`, `categories[]`, `perPage`, `sortOrder` |
| 9 | `approve_request` | Aprova uma solicitação por slug | POST | `/general/approval/approve/{slug}` | `slug` |
| 10 | `reprove_request` | Reprova uma solicitação por slug com motivo | POST | `/general/approval/reprove/{slug}` | `slug`, `reason` |
| 11 | `list_travel_orders` | Lista reservas de viagem (aéreo, hotel, ônibus, veículo) | GET | `/travel/order/{type}-order` | `type` (fly/hotel/bus/auto), `startDate`, `endDate`, `include` |
| 12 | `get_travel_order` | Obtém detalhes de uma reserva específica | GET | `/travel/order/{type}-order/{id}` | `type`, `id`, `include` |

#### Tier 2 — Extended (pós-MVP)

| # | Tool Name | Descrição |
|---|-----------|-----------|
| 13 | `list_advance_payments` | Lista adiantamentos de viagem com filtros |
| 14 | `get_budget` | Consulta orçamento por centro de custo |
| 15 | `list_card_transactions` | Lista transações do cartão corporativo Onfly |
| 16 | `get_card_details` | Obtém dados de um cartão específico |
| 17 | `list_employees` | Lista colaboradores (admin only) |
| 18 | `get_employee` | Obtém detalhes de um colaborador |
| 19 | `list_cost_centers` | Lista centros de custo |
| 20 | `list_tags` | Lista tags (projetos, clientes, etc.) |
| 21 | `list_expense_types` | Lista tipos de despesa disponíveis |
| 22 | `get_company_info` | Obtém dados e configurações da empresa |
| 23 | `list_policies` | Lista políticas de aprovação |
| 24 | `search_hotels` | Busca hotéis por destino e datas (flow: geolocation → search → detalhes) |

#### Tier 3 — Analytics (avançado)

| # | Tool Name | Descrição |
|---|-----------|-----------|
| 25 | `analytics_expenses` | Relatório analítico de despesas (mapeamento DE-PARA para BI) |
| 26 | `analytics_travel` | Relatório consolidado de reservas (aéreo + hotel + bus + auto) |
| 27 | `analytics_rdv_summary` | Resumo de RDVs por período e status |

### 2.2 Descrições das Tools (para o LLM)

As descrições das tools são críticas para o roteamento correto do Claude. Seguindo as diretrizes da Anthropic: "Instructional Software must define each tool through narrow, unambiguous natural language."

Exemplos de descrições otimizadas:

```
list_expenses:
"Lista despesas da empresa no Onfly. Filtre por período (startDate/endDate no formato YYYY-MM-DD), 
status (1=rascunho, 2=aguardando aprovação, 3=reprovado, 4=aguardando pagamento, 5=pago, 6=arquivado), 
colaborador (userId), ou relatório de viagem (rdvId). Retorna dados paginados. 
Use include para expandir relacionamentos (user, costCenter, rdv, expenditureType)."

approve_request:
"Aprova uma solicitação no Onfly (despesa, viagem, adiantamento ou cartão). 
Requer o slug da aprovação, obtido via list_approvals. 
A aprovação segue o fluxo de níveis definido pela política da empresa. 
O usuário autenticado deve ter permissão de aprovador."

list_travel_orders:
"Lista reservas de viagem no Onfly. O parâmetro type define o tipo: 
'fly' para aéreo, 'hotel' para hospedagem, 'bus' para ônibus, 'auto' para veículo. 
Filtre por período (startDate/endDate). Use include para expandir viajantes, 
centro de custo, tags e histórico de aprovação."
```

### 2.3 Priorização e Roadmap

```
Sprint 1 (2 semanas): Infraestrutura
  → OAuth 2.0 + MCP server (Streamable HTTP)
  → Tools: get_my_profile, list_expenses, list_rdvs

Sprint 2 (2 semanas): Core Read
  → Tools: get_expense, get_rdv, list_approvals, list_travel_orders, get_travel_order

Sprint 3 (2 semanas): Core Write
  → Tools: create_expense, submit_rdv_for_approval, approve_request, reprove_request

Sprint 4 (2 semanas): Extended
  → Tier 2 tools (14-24)
  
Sprint 5 (2 semanas): Analytics + Polish
  → Tier 3 tools, otimização de descrições, testes com usuários

Sprint 6 (1 semana): Directory Submission
  → Documentação, testes Anthropic, exemplos, privacy policy
```

### 2.4 Rate Limiting e Paginação

A API Onfly tem limites claros:
- **Autenticação:** 1 request a cada 2 minutos
- **Demais endpoints:** 200 requests a cada 30 minutos

O MCP server deve implementar:
- Cache do token OAuth (365 dias de validade ou até nova autenticação)
- Rate limiter interno com backoff exponencial
- Paginação transparente: para tools analíticas, iterar automaticamente as páginas e consolidar resultados
- Default de `perPage=100` para minimizar chamadas

---

## AGENTE 3: Analista de Cybersegurança

### 3.1 Modelo de Autenticação

**Premissa confirmada:** O fluxo de autenticação redireciona o usuário para a página de login da Onfly. O token obtido é o token pessoal do usuário, com todos os perfis e permissões herdados.

#### Fluxo OAuth 2.0:

```
1. Usuário habilita conector Onfly no Claude
2. Claude redireciona para Authorization Server da Onfly
3. Usuário faz login na página da Onfly
4. Onfly emite Authorization Code
5. MCP Server troca code por Access Token + Refresh Token
6. Token é armazenado pelo Claude (por sessão/usuário)
7. MCP Server usa o token como Bearer em todas as chamadas à API Onfly
```

**Variantes suportadas pela Onfly:**
- `grant_type: client_credentials` — para integrações sistema-a-sistema
- `grant_type: password` — login direto com credenciais

**Para o conector Claude, deve-se usar Authorization Code Flow (standard OAuth 2.0)**, que é o padrão exigido pela Anthropic para o Connectors Directory. A Onfly precisará implementar o fluxo `/authorize` (se ainda não existir) para suportar o redirect.

### 3.2 Superfície de Ataque e Mitigações

| Vetor | Risco | Mitigação |
|-------|-------|-----------|
| **Token leakage** | Token exposto em logs ou contexto do LLM | Token NUNCA entra no contexto do LLM. O MCP server o gerencia server-side. O `authorization_token` no MCP é passado via header, não no corpo das mensagens. |
| **Prompt injection via dados** | Dados retornados pela API Onfly podem conter instruções maliciosas em campos como `description` de despesas | Sanitizar outputs: escapar markdown/HTML em respostas, limitar tamanho de campos textuais |
| **Over-permissioning** | Conector com acesso a mais do que o usuário deveria ver | O token herda os perfis da Onfly (Administrador=1, Gerente=2, Colaborador=3). Não há elevação possível pelo conector. |
| **Write operations sem confirmação** | Aprovar/reprovar por engano | Tools de escrita devem ter `annotations.readOnlyHint: false` e `destructiveHint: true` para que Claude peça confirmação ao usuário |
| **Rate limit abuse** | LLM gerando muitas chamadas em loop | Rate limiter interno no MCP server + circuit breaker após 150 requests/30min |
| **Data exfiltration** | Dados sensíveis (CPF, RG, PIX) expostos ao LLM | Filtrar campos PII nas respostas. Campos como `cpf`, `rg_number`, `keyPix`, `passport` devem ser mascarados ou omitidos |
| **Session fixation** | Reutilização de token expirado | Implementar refresh token rotation. Token Onfly tem 365 dias, mas o MCP server deve validar antes de cada chamada |
| **SSRF** | MCP server como proxy para acessar endpoints internos | Whitelist de endpoints Onfly (`api.onfly.com.br` apenas). Rejeitar redirecionamentos |

### 3.3 Classificação de Tools por Risco

```
🟢 LOW RISK (read-only, dados do próprio usuário):
   get_my_profile, list_expenses (próprias), list_rdvs (próprios),
   list_travel_orders (próprios), get_expense, get_rdv, get_travel_order

🟡 MEDIUM RISK (read-only, dados de terceiros / empresa):
   list_employees, list_cost_centers, list_tags, list_card_transactions,
   get_budget, list_policies, analytics_*

🔴 HIGH RISK (write operations):
   create_expense, submit_rdv_for_approval, approve_request, reprove_request
```

### 3.4 Annotations MCP (Obrigatórias para Directory)

Conforme a Anthropic Software Directory Policy: "MCP servers must provide all applicable annotations for their tools."

```json
{
  "name": "approve_request",
  "annotations": {
    "title": "Aprovar solicitação",
    "readOnlyHint": false,
    "destructiveHint": false,
    "idempotentHint": true,
    "openWorldHint": false
  }
}

{
  "name": "reprove_request",
  "annotations": {
    "title": "Reprovar solicitação",
    "readOnlyHint": false,
    "destructiveHint": true,
    "idempotentHint": true,
    "openWorldHint": false
  }
}

{
  "name": "list_expenses",
  "annotations": {
    "title": "Listar despesas",
    "readOnlyHint": true,
    "destructiveHint": false,
    "idempotentHint": true,
    "openWorldHint": false
  }
}
```

### 3.5 Requisitos de Compliance (LGPD)

- **Privacy Policy:** Obrigatória para submissão ao Anthropic Directory. Deve cobrir: quais dados são coletados, como são usados/armazenados, compartilhamento com terceiros, retenção e contato.
- **Minimização de dados:** Retornar apenas campos necessários para o caso de uso. Nunca retornar senha, client_secret, tokens.
- **Direito ao esquecimento:** O MCP server não deve cachear dados pessoais. Tokens são gerenciados pela Anthropic e removidos quando o usuário desconecta.
- **Anonimização:** Para tools analíticas (Tier 3), considerar agregar dados sem expor PII.

---

## AGENTE 4: Advogado do Diabo

### 4.1 Questionamento ao Analista de Negócios

**Q:** "27 tools é demais para um conector. A Ramp e a Brex começaram com bem menos. Por que não focar em 8-10 tools no MVP?"

**R do Analista:** Concordo. O Tier 1 com 12 tools já pode ser reduzido. As tools `list_travel_orders` e `get_travel_order` cobrem 4 tipos cada (aéreo, hotel, bus, auto), então tecnicamente são 2 tools com um parâmetro `type`. O MVP real seria:

```
MVP Revisado (8 tools):
1. get_my_profile
2. list_expenses  
3. get_expense
4. list_rdvs
5. get_rdv
6. list_approvals
7. approve_request
8. list_travel_orders
```

**Consenso:** ✅ MVP com 8 tools. `create_expense`, `reprove_request` e `submit_rdv_for_approval` entram no Sprint 3.

---

**Q:** "O fluxo de busca e reserva de hotel (geolocation → search → book) tem 4 etapas sequenciais. Isso é viável num conector MCP?"

**R do PM:** O fluxo de booking é complexo e multi-step. Os conectores do Trivago e Booking.com focam em busca, não em reserva completa. A reserva de hotel via chat tem alto risco de erro (datas erradas, quarto errado) e implicações financeiras.

**Consenso:** ✅ Incluir `search_hotels` como read-only (busca + disponibilidade). A reserva efetiva fica fora do escopo do conector — o usuário é redirecionado para a plataforma Onfly.

---

### 4.2 Questionamento ao PM

**Q:** "As descrições das tools usam IDs numéricos de status (1=rascunho, 2=aguardando...). O LLM vai mapear isso corretamente quando o usuário falar em linguagem natural?"

**R do PM:** Boa observação. A API Onfly usa IDs numéricos para status, mas o Claude precisa da tabela de-para nas tool descriptions. A descrição já contém o mapeamento inline. Porém, seria melhor aceitar ambos (nome e ID) no input da tool e fazer a conversão no MCP server.

**Consenso:** ✅ O MCP server aceita `status` como string ("rascunho", "aguardando_aprovacao", "pago") ou como ID numérico. A conversão é feita no server antes de chamar a API Onfly.

---

**Q:** "O parâmetro `include` da API Onfly é poderoso mas confuso. O LLM vai saber quando incluir `user.document,user.group,costCenter`?"

**R do PM:** O `include` é um detalhe da API, não do usuário. O MCP server deve ter defaults inteligentes por tool:
- `list_expenses` → default include: `costCenter,rdv,expenditureType,user`
- `list_rdvs` → default include: `owner,costCenter,tags`
- `list_travel_orders` → default include: `travellers,costCenter`

O parâmetro `include` não deve ser exposto ao LLM diretamente.

**Consenso:** ✅ Defaults de include hardcoded no MCP server. Expor um parâmetro opcional `detail_level` (basic/full) que controla o nível de expansão.

---

### 4.3 Questionamento ao Analista de Segurança

**Q:** "Você disse que o token tem 365 dias de validade. Isso é um risco enorme. Se o token é comprometido, o atacante tem acesso por um ano. Como o refresh token rotation resolve isso se a Onfly não implementa refresh?"

**R do Analista:** A API atual da Onfly não documenta refresh tokens — o token de 365 dias é emitido via `client_credentials` ou `password`. Para o conector OAuth no Claude, a Onfly precisa implementar:
1. Authorization Code Flow com PKCE
2. Tokens de curta duração (1h)
3. Refresh tokens com rotation
4. Revogação de token ao desconectar

Se a Onfly mantiver apenas o token de 365 dias, o MCP server deve:
- Armazenar o token encriptado
- Validar a cada chamada (HEAD request ou similar)
- Fornecer endpoint de revogação

**Consenso:** ✅ A Onfly DEVE implementar Authorization Code Flow com tokens de curta duração para o conector Claude. O token de 365 dias é inaceitável para um conector público. Isso é um **blocker** para submissão ao Anthropic Connectors Directory.

---

**Q:** "Dados PII como CPF, RG, PIX key passam pelo MCP server. Mesmo que mascarados na resposta, o MCP server os vê. Quem é o controlador de dados neste contexto? A Onfly, a Anthropic ou o cliente empresa?"

**R do Analista:** Conforme a Anthropic Directory FAQ: "MCP servers must handle compliance independently from Claude." O controlador é a empresa cliente (que contrata a Onfly). A Onfly é processadora. O MCP server da Onfly é um sub-processador. A Anthropic apenas transporta dados e declara que não retém após uso.

Na prática:
- O MCP server não armazena dados pessoais (stateless)
- A filtragem de PII acontece no MCP server antes de enviar ao Claude
- A empresa decide quais tools habilitar
- A Privacy Policy do conector deve explicitar esse modelo

**Consenso:** ✅ O MCP server é stateless. PII é filtrada antes de atingir o Claude. A privacy policy documenta os papéis de cada parte.

---

### 4.4 Questionamento Transversal

**Q:** "A Onfly tem rate limit de 200 requests/30min. Um Gestor com 50 RDVs pendentes que pede 'me dê o detalhe de todos' vai esgotar o limite em segundos. Como resolver?"

**R conjunta:** Três estratégias:
1. **Batch inteligente:** A tool `list_rdvs` já retorna dados suficientes com `include` para a maioria dos casos. Evitar chamadas individuais `get_rdv` em loop.
2. **Guardrail no MCP server:** Limitar a 10 resultados por default, com paginação explícita. Se o LLM tentar iterar mais de 5 páginas, retornar warning.
3. **Rate limiter com fila:** Implementar token bucket (200 tokens/30min) e queue requests que excedem, retornando mensagem amigável: "Limite de consultas atingido. Tente novamente em X minutos."

**Consenso:** ✅ Default perPage=20, máximo=100. Guardrail de 5 páginas por tool call. Rate limiter com token bucket no MCP server.

---

**Q:** "O conector será público no Directory da Anthropic. Qualquer empresa Onfly poderá habilitar. E se uma empresa usar o conector para extrair dados em massa (scraping via Claude)?"

**R conjunta:** O rate limit da Onfly já protege contra abuso. Adicionalmente:
- A tool `analytics_*` deve ter `perPage` máximo de 500 por chamada
- O MCP server deve logar todas as chamadas com `userId` e `companyId`
- A Onfly pode desabilitar o acesso de API para empresas que abusem
- O conector deve ter ToS que proíbe uso automatizado em massa

**Consenso:** ✅ Logging, rate limiting e ToS são suficientes. A Onfly já controla o acesso via API keys.

---

## AGENTE 5: Documentação da Implementação

### 5.1 Arquitetura do Conector

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────┐
│   Claude     │────▶│  Onfly MCP       │────▶│  Onfly API   │
│  (claude.ai, │◀────│  Server          │◀────│  api.onfly.  │
│   Desktop,   │     │  (Streamable     │     │  com.br      │
│   Code, API) │     │   HTTP)          │     │              │
└─────────────┘     └──────────────────┘     └──────────────┘
       │                    │                       │
       │  OAuth 2.0 Flow    │                       │
       │───────────────────▶│──────────────────────▶│
       │◀───────────────────│◀──────────────────────│
       │   (redirect to     │  (Authorization Code  │
       │    Onfly login)    │   → Access Token)     │
```

### 5.2 Stack Tecnológica

| Componente | Tecnologia | Justificativa |
|------------|-----------|---------------|
| Runtime | Node.js 20+ (TypeScript) | Alinhado com SDK MCP oficial, facilita TypeScript SDK helpers |
| Framework MCP | `@modelcontextprotocol/sdk` | SDK oficial, suporta Streamable HTTP nativo |
| Transporte | Streamable HTTP | Obrigatório pela Anthropic (SSE deprecated) |
| OAuth | Custom Authorization Server ou Auth0/WorkOS | Depende da implementação escolhida pela Onfly |
| HTTP Client | `undici` ou `node-fetch` | Para chamadas à API Onfly |
| Deploy | AWS/GCP/Vercel | URL pública HTTPS obrigatória |

### 5.3 Estrutura do Projeto

```
onfly-mcp-connector/
├── src/
│   ├── index.ts                # Entry point — MCP server setup
│   ├── auth/
│   │   ├── oauth-handler.ts    # OAuth 2.0 Authorization Code + PKCE
│   │   └── token-manager.ts    # Token cache, refresh, revocation
│   ├── tools/
│   │   ├── expenses.ts         # list_expenses, get_expense, create_expense
│   │   ├── rdvs.ts             # list_rdvs, get_rdv, submit_rdv_for_approval
│   │   ├── approvals.ts        # list_approvals, approve_request, reprove_request
│   │   ├── travel.ts           # list_travel_orders, get_travel_order, search_hotels
│   │   ├── employees.ts        # get_my_profile, list_employees, get_employee
│   │   ├── finance.ts          # list_advance_payments, get_budget, list_card_transactions
│   │   ├── settings.ts         # list_cost_centers, list_tags, list_expense_types, etc.
│   │   └── analytics.ts        # analytics_expenses, analytics_travel, analytics_rdv_summary
│   ├── api/
│   │   ├── client.ts           # HTTP client wrapper para api.onfly.com.br
│   │   ├── rate-limiter.ts     # Token bucket (200 req/30min)
│   │   └── response-filter.ts  # PII masking, output sanitization
│   ├── utils/
│   │   ├── status-mapper.ts    # Converte "rascunho" → 1, "pago" → 5, etc.
│   │   ├── include-defaults.ts # Defaults de include por tool
│   │   └── pagination.ts       # Auto-pagination helper
│   └── types/
│       └── onfly.ts            # TypeScript types para todos os domínios
├── tests/
│   ├── tools/                  # Testes unitários por tool
│   └── integration/            # Testes e2e com API Onfly (sandbox)
├── docs/
│   ├── PRIVACY_POLICY.md       # Privacy policy (obrigatória para Directory)
│   ├── EXAMPLES.md             # 3+ exemplos de uso (obrigatório para Directory)
│   └── SETUP.md                # Instruções de setup
├── package.json
├── tsconfig.json
└── README.md
```

### 5.4 Implementação do OAuth Handler

```typescript
// src/auth/oauth-handler.ts — Pseudocódigo

import { OAuthServerProvider } from "@modelcontextprotocol/sdk/server/auth/provider.js";

export class OnflyOAuthProvider implements OAuthServerProvider {
  
  // Onfly Authorization Server endpoints
  private readonly AUTH_URL = "https://app.onfly.com.br/oauth/authorize";
  private readonly TOKEN_URL = "https://api.onfly.com.br/oauth/token";
  
  async authorize(params: AuthorizationParams): Promise<string> {
    // Redireciona o usuário para a página de login da Onfly
    // O token retornado herda TODOS os perfis do usuário:
    //   permissionId=1 → Administrador (acesso total)
    //   permissionId=2 → Gerente de Viagem (aprovações + leitura)
    //   permissionId=3 → Colaborador (apenas dados próprios)
    const authUrl = new URL(this.AUTH_URL);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", this.clientId);
    authUrl.searchParams.set("redirect_uri", this.redirectUri);
    authUrl.searchParams.set("scope", "*");
    authUrl.searchParams.set("code_challenge", params.codeChallenge);
    authUrl.searchParams.set("code_challenge_method", "S256");
    return authUrl.toString();
  }
  
  async exchangeCode(code: string, codeVerifier: string): Promise<TokenResponse> {
    const response = await fetch(this.TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        code_verifier: codeVerifier,
      }),
    });
    return response.json();
  }
}
```

### 5.5 Implementação de Tool (Exemplo)

```typescript
// src/tools/expenses.ts

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerExpenseTools(server: McpServer, apiClient: OnflyApiClient) {
  
  server.tool(
    "list_expenses",
    `Lista despesas da empresa no Onfly. Filtre por período (startDate/endDate 
     formato YYYY-MM-DD), status (rascunho, aguardando_aprovacao, reprovado, 
     aguardando_pagamento, pago, arquivado), colaborador (userId), ou relatório 
     de viagem (rdvId). Retorna dados paginados com informações de centro de custo, 
     categoria e usuário.`,
    {
      startDate: z.string().optional().describe("Data início YYYY-MM-DD"),
      endDate: z.string().optional().describe("Data fim YYYY-MM-DD"),
      status: z.enum([
        "rascunho", "aguardando_aprovacao", "reprovado", 
        "aguardando_pagamento", "pago", "arquivado"
      ]).optional().describe("Filtrar por status"),
      userId: z.number().optional().describe("Filtrar por ID do colaborador"),
      rdvId: z.number().optional().describe("Filtrar por ID do RDV"),
      page: z.number().optional().default(1),
      perPage: z.number().optional().default(20).describe("Máximo 100"),
    },
    async (params) => {
      const statusMap = {
        rascunho: 1, aguardando_aprovacao: 2, reprovado: 3,
        aguardando_pagamento: 4, pago: 5, arquivado: 6,
      };
      
      const queryParams = new URLSearchParams();
      if (params.startDate) queryParams.set("startDate", params.startDate);
      if (params.endDate) queryParams.set("endDate", params.endDate);
      if (params.status) queryParams.set("status[]", String(statusMap[params.status]));
      if (params.userId) queryParams.set("userId", String(params.userId));
      if (params.rdvId) queryParams.set("rdv[]", String(params.rdvId));
      queryParams.set("page", String(params.page));
      queryParams.set("perPage", String(Math.min(params.perPage, 100)));
      queryParams.set("include", "costCenter,rdv,expenditureType,user");
      queryParams.set("sortBy", "id");
      queryParams.set("sortOrder", "DESC");
      
      const data = await apiClient.get(`/expense/expenditure?${queryParams}`);
      
      // Sanitize PII
      const sanitized = filterPII(data);
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify(sanitized, null, 2),
        }],
      };
    }
  );
}
```

### 5.6 Filtro de PII

```typescript
// src/api/response-filter.ts

const PII_FIELDS = [
  "cpf", "rg_number", "rgNumber", "passport", "keyPix", "typeKeyPix",
  "password", "client_secret", "token", "cellphone.number",
];

export function filterPII(data: any): any {
  if (Array.isArray(data)) return data.map(filterPII);
  if (typeof data !== "object" || data === null) return data;
  
  const filtered: any = {};
  for (const [key, value] of Object.entries(data)) {
    if (PII_FIELDS.includes(key)) {
      filtered[key] = "***REDACTED***";
    } else if (typeof value === "object") {
      filtered[key] = filterPII(value);
    } else {
      filtered[key] = value;
    }
  }
  return filtered;
}
```

### 5.7 Rate Limiter

```typescript
// src/api/rate-limiter.ts

export class TokenBucketLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens = 200;
  private readonly refillIntervalMs = 30 * 60 * 1000; // 30 minutos
  
  constructor() {
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
  }
  
  async acquire(): Promise<boolean> {
    this.refill();
    if (this.tokens > 0) {
      this.tokens--;
      return true;
    }
    const waitMs = this.refillIntervalMs - (Date.now() - this.lastRefill);
    throw new Error(
      `Limite de requisições Onfly atingido. ` +
      `Tente novamente em ${Math.ceil(waitMs / 60000)} minutos.`
    );
  }
  
  private refill() {
    const now = Date.now();
    if (now - this.lastRefill >= this.refillIntervalMs) {
      this.tokens = this.maxTokens;
      this.lastRefill = now;
    }
  }
}
```

### 5.8 Configuração do MCP Server

```typescript
// src/index.ts

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { OnflyOAuthProvider } from "./auth/oauth-handler.js";
import { OnflyApiClient } from "./api/client.js";
import { registerExpenseTools } from "./tools/expenses.js";
import { registerRdvTools } from "./tools/rdvs.js";
import { registerApprovalTools } from "./tools/approvals.js";
import { registerTravelTools } from "./tools/travel.js";
import { registerEmployeeTools } from "./tools/employees.js";

const server = new McpServer({
  name: "onfly",
  version: "1.0.0",
});

// Registrar todas as tools
const apiClient = new OnflyApiClient();
registerExpenseTools(server, apiClient);
registerRdvTools(server, apiClient);
registerApprovalTools(server, apiClient);
registerTravelTools(server, apiClient);
registerEmployeeTools(server, apiClient);

// Iniciar com Streamable HTTP
const transport = new StreamableHTTPServerTransport({ 
  path: "/mcp",
  authProvider: new OnflyOAuthProvider(),
});

await server.connect(transport);
```

### 5.9 Requisitos para Submissão ao Anthropic Connectors Directory

Com base na Anthropic Software Directory Policy e no Remote MCP Server Submission Guide:

| Requisito | Status | Detalhes |
|-----------|--------|----------|
| Transporte Streamable HTTP | ✅ Planejado | SSE deprecated, Streamable HTTP obrigatório |
| OAuth 2.0 com certificados reconhecidos | ⚠️ Depende Onfly | Onfly precisa implementar Authorization Code Flow |
| Privacy Policy | ✅ A criar | URL pública com cobertura LGPD + Anthropic requirements |
| 3+ exemplos de uso | ✅ A criar | Ver seção 5.10 |
| Conta de teste com dados amostrais | ⚠️ Depende Onfly | Onfly precisa fornecer sandbox/demo account |
| Tool annotations completas | ✅ Planejado | readOnlyHint, destructiveHint em todas as tools |
| Sem transferência financeira direta | ✅ OK | Conector não executa transações financeiras |
| Não gera imagens/vídeo/áudio | ✅ OK | Não aplicável |
| Sem publicidade/conteúdo patrocinado | ✅ OK | Não aplicável |
| Graceful error handling | ✅ Planejado | Mensagens de erro claras em português |

### 5.10 Exemplos de Uso (Obrigatório para Directory)

**Exemplo 1: Consulta de despesas**
```
Usuário: "Quais foram minhas despesas do mês passado?"
Claude: [usa get_my_profile para obter userId]
Claude: [usa list_expenses com startDate/endDate e userId]
Claude: "Você teve 12 despesas em fevereiro totalizando R$ 3.450,00. 
         As maiores foram: Hospedagem R$ 1.200 (Hotel Ibis SP), 
         Alimentação R$ 890 (diversos), Transporte R$ 650 (Uber)..."
```

**Exemplo 2: Aprovação de relatório**
```
Usuário: "Tem algo pra eu aprovar?"
Claude: [usa list_approvals com status=1 (aguardando)]
Claude: "Sim, 3 itens aguardando sua aprovação:
         1. RDV #4521 de Maria Silva - R$ 2.100 (viagem SP)
         2. Aéreo #891 de João Santos - R$ 1.450 (CNF→GRU)
         3. Adiantamento #156 de Ana Costa - R$ 800
         Deseja aprovar algum?"
Usuário: "Aprova o da Maria"
Claude: [usa approve_request com slug do RDV #4521]
Claude: "RDV #4521 de Maria Silva aprovado com sucesso."
```

**Exemplo 3: Visão geral de viagens**
```
Usuário: "Liste as viagens da equipe para a próxima semana"
Claude: [usa list_travel_orders type=fly com datas da próxima semana]
Claude: [usa list_travel_orders type=hotel com datas da próxima semana]
Claude: "Na próxima semana, sua equipe tem:
         ✈️ 2 voos: Pedro (CNF→GRU seg 08:00), Ana (CNF→SSA qua 14:00)
         🏨 2 hotéis: Pedro (Ibis SP, seg-qua), Ana (Wish Salvador, qua-sex)
         Valor total estimado: R$ 4.800"
```

### 5.11 Checklist de Implementação

```
PRÉ-REQUISITOS (Onfly backend team):
□ Implementar Authorization Code Flow com PKCE em /oauth/authorize
□ Emitir tokens de curta duração (1h access, 7d refresh)
□ Suportar token revocation endpoint
□ Configurar redirect URI para callback da Anthropic
□ Criar conta sandbox/demo para testes Anthropic
□ Configurar CORS para domínios Anthropic

IMPLEMENTAÇÃO MCP SERVER:
□ Setup projeto TypeScript com @modelcontextprotocol/sdk
□ Implementar OAuth handler (authorize, token exchange, refresh)
□ Implementar API client com rate limiter (token bucket 200/30min)
□ Implementar PII filter (CPF, RG, passport, PIX key)
□ Implementar status mapper (string ↔ ID numérico)
□ Implementar include defaults por tool
□ Implementar 8 tools MVP (Sprint 1-2)
□ Implementar 4 tools write (Sprint 3)
□ Adicionar tool annotations (readOnlyHint, destructiveHint)
□ Testes unitários por tool
□ Testes de integração com API Onfly
□ Deploy em URL pública HTTPS

SUBMISSÃO DIRECTORY:
□ Privacy Policy publicada em URL pública
□ 3+ exemplos de uso documentados
□ Conta de teste fornecida à Anthropic
□ Testar com MCP Inspector
□ Testar fluxo OAuth completo no claude.ai
□ Preencher formulário de submissão Anthropic
□ Aguardar review
```

---

## Decisões Consolidadas (Pós-Advogado do Diabo)

| # | Decisão | Consenso |
|---|---------|----------|
| 1 | MVP com 8 tools read-heavy, write no Sprint 3 | ✅ |
| 2 | Hotel search sim, hotel booking não (redireciona para plataforma) | ✅ |
| 3 | Status aceita string e ID numérico, conversão no MCP server | ✅ |
| 4 | `include` não exposto ao LLM, defaults hardcoded por tool | ✅ |
| 5 | OAuth Authorization Code + PKCE obrigatório (BLOCKER) | ✅ |
| 6 | Tokens curta duração (1h) obrigatório (BLOCKER) | ✅ |
| 7 | PII filtrada antes de atingir o Claude (stateless) | ✅ |
| 8 | Rate limiter token bucket 200/30min + guardrail 5 páginas | ✅ |
| 9 | Tools de escrita com annotations destructiveHint | ✅ |
| 10 | Streamable HTTP (SSE deprecated) | ✅ |

---

## Apêndice A: Mapeamento Completo de Status

| Domínio | Status | ID | Cor Sugerida |
|---------|--------|----|-------------|
| Despesas/RDV | Rascunho | 1 | 🔵 |
| Despesas/RDV | Aguardando Aprovação | 2 | 🟡 |
| Despesas/RDV | Aguardando Pagamento | 3 | 🟠 |
| Despesas/RDV | Pago | 4 | 🟢 |
| Despesas/RDV | Reprovado | 5 | 🔴 |
| Despesas/RDV | Arquivado | 6 | ⚫ |
| Adiantamento | Rascunho | 1 | 🔵 |
| Adiantamento | Aguardando Aprovação | 2 | 🟡 |
| Adiantamento | Reprovados | 3 | 🔴 |
| Adiantamento | Aguardando Pagamento | 4 | 🟠 |
| Adiantamento | Pago | 5 | 🟢 |
| Adiantamento | Arquivado | 6 | ⚫ |
| Adiantamento | Utilizado | 7 | ✅ |
| Adiantamento | Pagamento Agendado | 8 | 📅 |
| Aprovação/Categoria | Aguardando Aprovação | 1 | 🟡 |
| Aprovação/Categoria | Aprovados | 2 | 🟢 |
| Aprovação/Categoria | Reprovados | 3 | 🔴 |
| Aprovação/Tipo | Relatório de Despesas | 1 | — |
| Aprovação/Tipo | Aéreos | 2 | — |
| Aprovação/Tipo | Hotéis | 3 | — |
| Aprovação/Tipo | Adiantamentos | 4 | — |
| Aprovação/Tipo | Veículos | 5 | — |
| Aprovação/Tipo | Ônibus | 6 | — |
| Aprovação/Tipo | Cartão Onfly | 7 | — |
| Permissão | Administrador | 1 | — |
| Permissão | Gerente de Viagem | 2 | — |
| Permissão | Colaborador | 3 | — |

## Apêndice B: Endpoints da API Onfly (Referência Completa)

### Autenticação
- O servidor MCP usa **Bearer token** já obtido fora do conector (Authorization Code + PKCE ou fluxo da sua aplicação). **Não** expomos `POST /oauth/token` (client credentials / password) como tool MCP.

### Colaboradores
- `GET /employees` — Listar todos (paginado, filtros por email, id)
- `GET /employees/{id}` — Obter por ID
- `GET /employees/me` — Perfil próprio
- `GET /employees/{id}/company` — Empresas do colaborador
- `GET /employees?document=CPF` — Buscar por CPF
- `POST /employees/invite` — Convidar colaborador
- `POST /employees/create` — Cadastrar colaborador
- `PUT /employees/{id}` — Atualizar dados
- `PUT /employees/{id}/preference` — Atualizar preferências/documentos
- `DELETE /employees/{id}` — Inativar colaborador

### Configurações
- `GET /employee-groups` — Grupos de usuários
- `GET /settings/cost-center` — Centros de custo
- `POST /settings/cost-center` — Criar centro de custo
- `PUT /settings/cost-center/` — Alterar centro de custo
- `DELETE /settings/cost-center/{id}` — Excluir centro de custo
- `GET /settings/tag` — Tags (projetos, clientes)
- `POST /settings/tag` — Criar tag
- `GET /company` — Dados da empresa
- `GET /settings/general` — Configurações gerais
- `GET /settings/custom-fields` — Campos gerenciais
- `PUT /settings/custom-fields/{id}` — Editar campo gerencial
- `GET /settings/budget` — Orçamentos
- `GET /settings/budget/{id}` — Orçamento por ID

### Despesas
- `GET /expense/expenditure-type` — Tipos de despesa
- `POST /expense/expenditure-type` — Criar tipo de despesa
- `GET /expense/expenditure` — Listar despesas (filtros: data, status, userId, rdv, ids)
- `GET /expense/expenditure/{id}` — Despesa por ID
- `POST /expense/expenditure` — Criar despesa
- `POST /general/attachment/4/1/{expenditure_id}` — Adicionar anexo

### RDVs (Relatórios de Viagem)
- `GET /expense/rdv` — Listar RDVs (filtros: data, status, criação, atualização)
- `GET /expense/rdv/{id}` — RDV por ID
- `PUT /expense/rdv/{id}` — Editar RDV
- `POST /expense/rdv` — Enviar RDV para aprovação
- `POST /general/approval/pay/{slug}` — Marcar como pago
- `POST /general/approval/approve/{slug}` — Aprovar
- `POST /general/approval/reprove/{slug}` — Reprovar

### Adiantamentos
- `GET /expense/advance-payment` — Listar (filtros: data, status, userId)
- `GET /expense/advance-payment/{id}` — Por ID
- `PUT /expense/advance-payment/{id}` — Editar
- `PUT /expense/advance-payment/archive/{id}` — Arquivar
- `DELETE /expense/advance-payment/{id}` — Excluir
- `POST /general/approval/pay/{slug}` — Marcar como pago

### Viagens
- `GET /travel/order/fly-order` — Aéreo (listar/filtrar)
- `GET /travel/order/fly-order/{id}` — Aéreo por ID
- `PUT /travel/order/fly-order/{id}` — Editar aéreo
- `GET /travel/order/hotel-order` — Hotel (listar)
- `GET /travel/order/bus-order` — Ônibus (listar)
- `GET /travel/order/auto-order` — Veículo (listar)
- `GET /geolocation/search-destination` — Buscar destino (hotel)
- `GET /hotel/search` — Buscar hotéis

### Aprovações
- `GET /general/approval` — Listar aprovações
- `POST /general/approval/approve/{slug}` — Aprovar
- `POST /general/approval/reprove/{slug}` — Reprovar

### Políticas
- `GET /settings/travel-policy/approval-group` — Listar políticas
- `GET /settings/travel-policy/approval-group/{id}` — Política por ID
- `POST /settings/travel-policy/approval-group` — Criar política
- `PUT /settings/travel-policy/approval-group/{id}` — Alterar política
- `GET /settings/travel-policy/policy` — Regras das políticas

### Cartões Corporativos
- `GET /blue/transaction/internal` — Movimentações internas
- `GET /blue/transaction` — Transações
- `GET /blue/card/{id}` — Dados do cartão
- `GET /blue/card` — Listar cartões
- `PUT /blue/card/{id}/balance` — Alterar saldo

### Integração
- `PUT /integration/metadata/{hash}` — Metadados (User, CostCenter, Tag)
- `POST /integration/expenditure` — Criar despesa de integração/cartão

### Anexos
- `GET /general/attachment/:table_type/:rdv_id` — Download anexo RDV
- `GET /general/attachment/{receiptId}` — Download anexo despesa
- `GET /general/attachment/:slug` — Consultar anexo

### Créditos
- `GET /credits/groupByConsumer` — Listar créditos

### Data & Analytics (BI)
- `GET /expense/expenditure?include=...` — Relatório despesas detalhamento
- `GET /expense/rdv?include=...` — Relatório RDVs detalhamento
- `GET /expense/advance-payment?include=...` — Relatório adiantamentos
- `GET /expense/rdv?include=owner,expenditures,...` — Despesas por relatório
- `GET /travel/order/fly-order?include=...` — Reservas aéreo (BI)
- `GET /travel/order/hotel-order?include=...` — Reservas hotel (BI)
- `GET /travel/order/bus-order?include=...` — Reservas ônibus (BI)
- `GET /travel/order/auto-order?include=...` — Reservas veículo (BI)
