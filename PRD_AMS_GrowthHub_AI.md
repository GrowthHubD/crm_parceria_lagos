# PRD — Sistema Gerencial de Agência (AMS) — Growth Hub
## DOCUMENTO PARA AGENTE DE IA — LEIA INTEGRALMENTE ANTES DE ESCREVER QUALQUER CÓDIGO

---

## 1. CONTEXT

O AMS (Agency Management System) é um sistema interno completo para a agência digital Growth Hub. Ele centraliza operações financeiras, comerciais, de atendimento e gestão de tarefas em uma única plataforma web. Possui 10 módulos: Dashboard, Pipeline, Contratos, Financeiro, CRM/WhatsApp, Clientes, Agente SDR, Kanban, Blog Interno e Sistema de Permissões. Os usuários são 3 sócios/diretores, gerentes e aproximadamente 10 operacionais (gestores de tráfego, automação, social media).

**Restrição inviolável:** Dados financeiros e de clientes DEVEM ser isolados por nível de permissão. Nenhum endpoint pode expor dados acima do nível de acesso do usuário autenticado. Todo middleware de rota DEVE verificar o papel (role) do usuário E o módulo solicitado antes de retornar dados.

---

## 2. TECH STACK

| Componente | Tecnologia | Versão | Status |
|---|---|---|---|
| Framework Frontend + Backend | Next.js (App Router) | 15.x | Non-negotiable |
| ORM | Drizzle ORM | Latest | Non-negotiable |
| Banco de dados | Neon PostgreSQL (Serverless) | Latest | Non-negotiable |
| Autenticação | better-auth | Latest | Non-negotiable |
| UI Components | shadcn/ui | Latest | Non-negotiable |
| CSS Framework | Tailwind CSS | 4.x | Non-negotiable |
| Storage de arquivos (primário) | Google Drive API v3 (Service Account) | v3 | Non-negotiable |
| Storage de arquivos (fallback) | Cloudflare R2 | Latest | Fallback only |
| WhatsApp API | Uazapi (instâncias próprias) | v2 | Non-negotiable |
| Deploy | Cloudflare Workers (via OpenNext) | Latest | Non-negotiable (iniciar no Free plan, migrar para Paid $5/mês se CPU time exceder 10ms) |
| Connection Pooling | Cloudflare Hyperdrive (free tier incluso) | Latest | Non-negotiable |
| Cron Jobs | Cloudflare Workers Cron Triggers (incluso em ambos planos) | Latest | Non-negotiable |
| Editor Blog | Markdown (MDX) com preview | — | Non-negotiable |
| Email (notificações) | Resend | Latest | Non-negotiable |
| Linguagem | TypeScript (strict mode) | 5.x | Non-negotiable |
| Package Manager | pnpm | Latest | Non-negotiable |

---

## 3. PROJECT STRUCTURE

```
ams-growthhub/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx                # Tela de login
│   │   │   └── layout.tsx                    # Layout auth (sem sidebar)
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx                    # Layout principal com sidebar + topbar
│   │   │   ├── page.tsx                      # Dashboard principal
│   │   │   ├── pipeline/
│   │   │   │   └── page.tsx                  # Pipeline de leads (kanban view)
│   │   │   ├── contratos/
│   │   │   │   ├── page.tsx                  # Lista de contratos
│   │   │   │   └── [id]/page.tsx             # Detalhe do contrato
│   │   │   ├── financeiro/
│   │   │   │   └── page.tsx                  # Módulo financeiro (sócios only)
│   │   │   ├── crm/
│   │   │   │   ├── page.tsx                  # CRM inbox WhatsApp
│   │   │   │   └── [numberId]/page.tsx       # Conversas de um número específico
│   │   │   ├── clientes/
│   │   │   │   ├── page.tsx                  # Lista de clientes
│   │   │   │   └── [id]/page.tsx             # Detalhe do cliente
│   │   │   ├── sdr/
│   │   │   │   └── page.tsx                  # Painel do Agente SDR
│   │   │   ├── kanban/
│   │   │   │   └── page.tsx                  # Kanban de tarefas
│   │   │   ├── blog/
│   │   │   │   ├── page.tsx                  # Grid de artigos
│   │   │   │   ├── novo/page.tsx             # Editor de novo artigo
│   │   │   │   └── [slug]/page.tsx           # Visualização de artigo
│   │   │   ├── admin/
│   │   │   │   ├── usuarios/page.tsx         # Gestão de usuários
│   │   │   │   ├── configuracoes/page.tsx    # Parâmetros do sistema
│   │   │   │   └── permissoes/page.tsx       # Gestão de permissões
│   │   │   └── notificacoes/page.tsx         # Centro de notificações
│   │   └── api/
│   │       ├── auth/[...all]/route.ts        # better-auth handler
│   │       ├── webhooks/
│   │       │   ├── uazapi/route.ts           # Webhook Uazapi (WhatsApp incoming)
│   │       │   └── sdr/route.ts              # Webhook SDR bots (n8n)
│   │       ├── drive/
│   │       │   ├── upload/route.ts           # Upload para Google Drive
│   │       │   └── download/[fileId]/route.ts # Download de arquivo
│   │       └── cron/
│   │           ├── kanban-daily/route.ts     # Envio diário de tarefas via WhatsApp
│   │           └── kanban-weekly/route.ts    # Envio semanal (segunda-feira)
│   ├── components/
│   │   ├── ui/                               # shadcn/ui components
│   │   ├── layout/
│   │   │   ├── sidebar.tsx                   # Sidebar principal
│   │   │   ├── topbar.tsx                    # Topbar com notificações
│   │   │   └── breadcrumbs.tsx
│   │   ├── dashboard/                        # Componentes do dashboard
│   │   ├── pipeline/                         # Componentes do pipeline
│   │   ├── contratos/                        # Componentes de contratos
│   │   ├── financeiro/                       # Componentes financeiros
│   │   ├── crm/                              # Componentes CRM/WhatsApp
│   │   ├── clientes/                         # Componentes de clientes
│   │   ├── sdr/                              # Componentes SDR
│   │   ├── kanban/                           # Componentes kanban
│   │   └── blog/                             # Componentes blog
│   ├── lib/
│   │   ├── auth.ts                           # Configuração better-auth server
│   │   ├── auth-client.ts                    # better-auth client
│   │   ├── db/
│   │   │   ├── index.ts                      # Drizzle client + Neon connection
│   │   │   ├── schema/
│   │   │   │   ├── users.ts                  # Tabelas de usuários e permissões
│   │   │   │   ├── clients.ts                # Tabelas de clientes
│   │   │   │   ├── contracts.ts              # Tabelas de contratos
│   │   │   │   ├── pipeline.ts               # Tabelas de pipeline/leads
│   │   │   │   ├── financial.ts              # Tabelas financeiras
│   │   │   │   ├── crm.ts                    # Tabelas CRM/conversas
│   │   │   │   ├── kanban.ts                 # Tabelas kanban/tarefas
│   │   │   │   ├── sdr.ts                    # Tabelas métricas SDR
│   │   │   │   ├── blog.ts                   # Tabelas blog
│   │   │   │   └── notifications.ts          # Tabelas de notificações
│   │   │   └── migrations/                   # Drizzle migrations
│   │   ├── drive.ts                          # Google Drive API client
│   │   ├── uazapi.ts                         # Uazapi WhatsApp client
│   │   ├── permissions.ts                    # Lógica de permissões e middleware
│   │   └── utils.ts                          # Utilitários gerais
│   ├── hooks/
│   │   ├── use-permissions.ts                # Hook de verificação de permissões
│   │   └── use-notifications.ts              # Hook de notificações
│   └── types/
│       └── index.ts                          # Tipos globais do sistema
├── drizzle.config.ts                         # Configuração Drizzle
├── wrangler.jsonc                            # Configuração Cloudflare Workers
├── open-next.config.ts                       # Configuração OpenNext
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── .env.example
```

---

## 4. DATABASE SCHEMA

USE Neon PostgreSQL. USE Drizzle ORM para todas as queries. NUNCA use string concatenation em queries SQL.

```sql
-- ============================================
-- AUTH & USERS (gerenciado parcialmente pelo better-auth)
-- ============================================

-- better-auth cria automaticamente: user, session, account, verification
-- Extendemos a tabela user com campos customizados

CREATE TABLE "user" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL UNIQUE,
  "emailVerified" BOOLEAN NOT NULL DEFAULT FALSE,
  "image" TEXT,
  "role" TEXT NOT NULL DEFAULT 'operational', -- 'partner', 'manager', 'operational'
  "job_title" TEXT, -- 'gestor_trafego', 'gestor_automacao', 'social_media', etc.
  "phone" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- PERMISSÕES
-- ============================================

CREATE TABLE "module_permission" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "module" TEXT NOT NULL, -- 'dashboard','pipeline','contracts','financial','crm','clients','sdr','kanban','blog','admin'
  "can_view" BOOLEAN NOT NULL DEFAULT FALSE,
  "can_edit" BOOLEAN NOT NULL DEFAULT FALSE,
  "can_delete" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("user_id", "module")
);

CREATE TABLE "blog_category_permission" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "category_id" UUID NOT NULL REFERENCES "blog_category"("id") ON DELETE CASCADE,
  "can_view" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("user_id", "category_id")
);

-- ============================================
-- CLIENTES
-- ============================================

CREATE TABLE "client" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_name" TEXT NOT NULL,
  "cnpj" TEXT UNIQUE,
  "responsible_name" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "group_id" TEXT, -- ID do grupo WhatsApp
  "status" TEXT NOT NULL DEFAULT 'active', -- 'active', 'inactive'
  "notes" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "client_file" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "client_id" UUID NOT NULL REFERENCES "client"("id") ON DELETE CASCADE,
  "file_name" TEXT NOT NULL,
  "file_type" TEXT NOT NULL, -- 'escopo', 'prd', 'contrato', 'outro'
  "drive_file_id" TEXT NOT NULL, -- Google Drive file ID
  "file_size_bytes" INTEGER,
  "uploaded_by" TEXT NOT NULL REFERENCES "user"("id"),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "client_responsible" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "client_id" UUID NOT NULL REFERENCES "client"("id") ON DELETE CASCADE,
  "user_id" TEXT NOT NULL REFERENCES "user"("id"),
  "role" TEXT NOT NULL DEFAULT 'responsible', -- 'responsible', 'collaborator'
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("client_id", "user_id")
);

-- ============================================
-- CONTRATOS
-- ============================================

CREATE TABLE "contract" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "client_id" UUID NOT NULL REFERENCES "client"("id") ON DELETE RESTRICT,
  "company_name" TEXT NOT NULL, -- Denormalized para performance no dashboard
  "monthly_value" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "implementation_value" NUMERIC(12,2) DEFAULT 0,
  "type" TEXT NOT NULL DEFAULT 'monthly', -- 'monthly', 'annual'
  "start_date" DATE NOT NULL,
  "end_date" DATE,
  "payment_day" INTEGER, -- Dia do mês para cobrança
  "status" TEXT NOT NULL DEFAULT 'active', -- 'active', 'expiring', 'inactive'
  "drive_file_id" TEXT, -- Contrato armazenado no Google Drive
  "notes" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "idx_contract_status" ON "contract"("status");
CREATE INDEX "idx_contract_end_date" ON "contract"("end_date");
CREATE INDEX "idx_contract_client" ON "contract"("client_id");

-- ============================================
-- PIPELINE / LEADS
-- ============================================

CREATE TABLE "pipeline_stage" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL, -- 'sem_atendimento', 'em_atendimento', 'reunioes', 'propostas', 'follow_up', 'ganho', 'perdido'
  "order" INTEGER NOT NULL,
  "color" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "lead" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "company_name" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "stage_id" UUID NOT NULL REFERENCES "pipeline_stage"("id"),
  "source" TEXT, -- 'sdr_bot', 'indicacao', 'inbound', 'outbound'
  "estimated_value" NUMERIC(12,2),
  "notes" TEXT,
  "assigned_to" TEXT REFERENCES "user"("id"),
  "crm_conversation_id" UUID REFERENCES "crm_conversation"("id"), -- Link com CRM
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "lead_tag" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL UNIQUE,
  "color" TEXT NOT NULL DEFAULT '#6366f1',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "lead_tag_assignment" (
  "lead_id" UUID NOT NULL REFERENCES "lead"("id") ON DELETE CASCADE,
  "tag_id" UUID NOT NULL REFERENCES "lead_tag"("id") ON DELETE CASCADE,
  PRIMARY KEY ("lead_id", "tag_id")
);

CREATE INDEX "idx_lead_stage" ON "lead"("stage_id");

-- ============================================
-- FINANCEIRO
-- ============================================

CREATE TABLE "financial_transaction" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL, -- 'income', 'expense'
  "category" TEXT NOT NULL, -- 'infraestrutura', 'interno', 'educacao', 'cliente', 'servico', 'outro'
  "amount" NUMERIC(12,2) NOT NULL,
  "transaction_date" DATE NOT NULL,
  "billing_type" TEXT NOT NULL DEFAULT 'monthly', -- 'monthly', 'annual', 'one_time'
  "status" TEXT NOT NULL DEFAULT 'pending', -- 'paid', 'pending', 'overdue'
  "due_date" DATE,
  "contract_id" UUID REFERENCES "contract"("id"),
  "client_id" UUID REFERENCES "client"("id"),
  "notes" TEXT,
  "created_by" TEXT NOT NULL REFERENCES "user"("id"),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "idx_financial_date" ON "financial_transaction"("transaction_date");
CREATE INDEX "idx_financial_status" ON "financial_transaction"("status");
CREATE INDEX "idx_financial_type" ON "financial_transaction"("type");

CREATE TABLE "financial_config" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "partner_share_percentage" NUMERIC(5,2) NOT NULL DEFAULT 30.00, -- % por sócio
  "company_reserve_percentage" NUMERIC(5,2) NOT NULL DEFAULT 10.00, -- % para caixa
  "updated_by" TEXT NOT NULL REFERENCES "user"("id"),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- CRM / WHATSAPP
-- ============================================

CREATE TABLE "whatsapp_number" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "phone_number" TEXT NOT NULL UNIQUE,
  "label" TEXT NOT NULL, -- Nome identificador do número da GH
  "uazapi_session" TEXT NOT NULL, -- Session name na Uazapi
  "uazapi_token" TEXT NOT NULL, -- Token da instância
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "crm_conversation" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "whatsapp_number_id" UUID NOT NULL REFERENCES "whatsapp_number"("id"),
  "contact_phone" TEXT NOT NULL,
  "contact_name" TEXT,
  "contact_push_name" TEXT, -- Nome do WhatsApp
  "classification" TEXT NOT NULL DEFAULT 'new', -- 'hot', 'warm', 'cold', 'active_client', 'new'
  "last_message_at" TIMESTAMPTZ,
  "unread_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("whatsapp_number_id", "contact_phone")
);

CREATE TABLE "crm_message" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "conversation_id" UUID NOT NULL REFERENCES "crm_conversation"("id") ON DELETE CASCADE,
  "message_id_wa" TEXT, -- ID da mensagem no WhatsApp
  "direction" TEXT NOT NULL, -- 'incoming', 'outgoing'
  "content" TEXT,
  "media_type" TEXT, -- 'text', 'image', 'audio', 'video', 'document'
  "media_url" TEXT,
  "status" TEXT DEFAULT 'sent', -- 'sent', 'delivered', 'read', 'failed'
  "timestamp" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "idx_crm_message_conversation" ON "crm_message"("conversation_id");
CREATE INDEX "idx_crm_message_timestamp" ON "crm_message"("timestamp" DESC);
CREATE INDEX "idx_crm_conversation_classification" ON "crm_conversation"("classification");

CREATE TABLE "crm_conversation_tag" (
  "conversation_id" UUID NOT NULL REFERENCES "crm_conversation"("id") ON DELETE CASCADE,
  "tag_id" UUID NOT NULL REFERENCES "lead_tag"("id") ON DELETE CASCADE, -- Reutiliza tags do lead
  PRIMARY KEY ("conversation_id", "tag_id")
);

-- ============================================
-- KANBAN / TAREFAS
-- ============================================

CREATE TABLE "kanban_column" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "color" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "kanban_task" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "title" TEXT NOT NULL,
  "description" TEXT,
  "column_id" UUID NOT NULL REFERENCES "kanban_column"("id"),
  "assigned_to" TEXT NOT NULL REFERENCES "user"("id"),
  "due_date" DATE,
  "priority" TEXT NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'
  "is_completed" BOOLEAN NOT NULL DEFAULT FALSE,
  "completed_at" TIMESTAMPTZ,
  "order" INTEGER NOT NULL DEFAULT 0,
  "whatsapp_sent" BOOLEAN NOT NULL DEFAULT FALSE, -- Se já foi enviado no dia
  "created_by" TEXT NOT NULL REFERENCES "user"("id"),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "idx_kanban_assigned" ON "kanban_task"("assigned_to");
CREATE INDEX "idx_kanban_due_date" ON "kanban_task"("due_date");
CREATE INDEX "idx_kanban_column" ON "kanban_task"("column_id");

-- ============================================
-- AGENTE SDR (métricas recebidas via webhook)
-- ============================================

CREATE TABLE "sdr_agent" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "description" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "sdr_metric_snapshot" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "agent_id" UUID NOT NULL REFERENCES "sdr_agent"("id") ON DELETE CASCADE,
  "period_start" DATE NOT NULL,
  "period_end" DATE NOT NULL,
  "leads_prospected" INTEGER NOT NULL DEFAULT 0,
  "new_leads" INTEGER NOT NULL DEFAULT 0,
  "total_messages_sent" INTEGER NOT NULL DEFAULT 0,
  "messages_per_meeting" NUMERIC(8,2) DEFAULT 0,
  "response_rate" NUMERIC(5,2) DEFAULT 0, -- Porcentagem
  "meetings_scheduled" INTEGER NOT NULL DEFAULT 0,
  "meetings_show_rate" NUMERIC(5,2) DEFAULT 0,
  "meetings_no_show" INTEGER NOT NULL DEFAULT 0,
  "meetings_rescheduled" INTEGER NOT NULL DEFAULT 0,
  "meetings_cancelled" INTEGER NOT NULL DEFAULT 0,
  "leads_refused" INTEGER NOT NULL DEFAULT 0,
  "leads_qualified" INTEGER NOT NULL DEFAULT 0,
  "first_response_time_avg_min" NUMERIC(8,2) DEFAULT 0,
  "conversion_rate" NUMERIC(5,2) DEFAULT 0,
  "mrr_generated" NUMERIC(12,2) DEFAULT 0,
  "arr_generated" NUMERIC(12,2) DEFAULT 0,
  "revenue_attributed" NUMERIC(12,2) DEFAULT 0,
  "dropoff_stage_data" JSONB, -- {"sem_atendimento": 15, "em_atendimento": 8, ...}
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "idx_sdr_metric_agent" ON "sdr_metric_snapshot"("agent_id");
CREATE INDEX "idx_sdr_metric_period" ON "sdr_metric_snapshot"("period_start", "period_end");

-- ============================================
-- BLOG INTERNO
-- ============================================

CREATE TABLE "blog_category" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL, -- 'Plugins Claude Code', 'Tráfego Pago', 'Criativos', etc.
  "slug" TEXT NOT NULL UNIQUE,
  "description" TEXT,
  "parent_id" UUID REFERENCES "blog_category"("id") ON DELETE SET NULL, -- NULL = categoria raiz, preenchido = subcategoria (pasta dentro de pasta)
  "order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "blog_post" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL UNIQUE,
  "content" TEXT NOT NULL, -- Markdown content
  "excerpt" TEXT,
  "type" TEXT NOT NULL DEFAULT 'article', -- 'list', 'article', 'guide', 'study'
  "cover_image_url" TEXT,
  "category_id" UUID NOT NULL REFERENCES "blog_category"("id"),
  "author_id" TEXT NOT NULL REFERENCES "user"("id"),
  "is_published" BOOLEAN NOT NULL DEFAULT FALSE,
  "published_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "blog_post_tag" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL UNIQUE,
  "slug" TEXT NOT NULL UNIQUE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "blog_post_tag_assignment" (
  "post_id" UUID NOT NULL REFERENCES "blog_post"("id") ON DELETE CASCADE,
  "tag_id" UUID NOT NULL REFERENCES "blog_post_tag"("id") ON DELETE CASCADE,
  PRIMARY KEY ("post_id", "tag_id")
);

CREATE INDEX "idx_blog_post_category" ON "blog_post"("category_id");
CREATE INDEX "idx_blog_post_published" ON "blog_post"("is_published", "published_at" DESC);

-- ============================================
-- NOTIFICAÇÕES
-- ============================================

CREATE TABLE "notification" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "type" TEXT NOT NULL, -- 'contract_expiring', 'task_due', 'new_lead', 'payment_overdue', 'system'
  "module" TEXT, -- Módulo de origem
  "link" TEXT, -- URL interna para navegação
  "is_read" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "idx_notification_user" ON "notification"("user_id", "is_read", "created_at" DESC);
```

---

## 5. QUEUE/JOB DEFINITIONS

O AMS usa Cloudflare Workers Cron Triggers para jobs agendados. NÃO use filas separadas.

### Cron Triggers (máximo 3 por Worker)

```typescript
// wrangler.jsonc
{
  "triggers": {
    "crons": [
      "0 7 * * 1",    // Segunda-feira 7h UTC (kanban semanal)
      "0 7 * * *",    // Diário 7h UTC (kanban diário + alertas de contratos)
      "0 0 1 * *"     // Mensal: snapshot financeiro
    ]
  }
}
```

### Job Interfaces

```typescript
interface KanbanDailyJob {
  type: 'kanban_daily';
  // Busca tarefas com due_date = hoje, agrupa por assigned_to, envia via Uazapi
}

interface KanbanWeeklyJob {
  type: 'kanban_weekly';
  // Busca tarefas com due_date entre segunda e domingo da semana, agrupa por assigned_to, envia via Uazapi
}

interface ContractAlertJob {
  type: 'contract_alert';
  // Busca contratos com end_date nos próximos 30 dias, cria notificações
}

interface FinancialSnapshotJob {
  type: 'financial_snapshot';
  // Calcula MRR, ARR, distribuição dos sócios, cria registro mensal
}
```

---

## 6. IMPLEMENTATION RULES

1. **Autenticação obrigatória em TODOS os endpoints** — USE o middleware `better-auth` em toda rota API. NUNCA crie um endpoint sem autenticação, mesmo para testes.

2. **Verificação de permissão por módulo** — Após autenticação, VERIFIQUE `module_permission` para o módulo solicitado. Exemplo:
   ```typescript
   const canAccess = await checkPermission(session.user.id, 'financial', 'view');
   if (!canAccess) return new Response('Forbidden', { status: 403 });
   ```

3. **Permissões padrão por role:**
   - `partner`: acesso total a todos os módulos
   - `manager`: acesso a dashboard, pipeline, contratos, crm, clientes, kanban, blog
   - `operational`: acesso a kanban (suas tarefas), blog (categorias permitidas), clientes (vinculados)

4. **Prepared statements em TODAS as queries** — Drizzle ORM faz isso automaticamente. NUNCA use `sql.raw()` com interpolação de strings.

5. **Error handling pattern:**
   ```typescript
   try {
     // lógica
   } catch (error) {
     console.error('[MODULE_NAME] Operation failed:', { 
       operation: 'nome_operacao',
       userId: session.user.id,
       // NUNCA logue dados sensíveis (tokens, senhas, CNPJ completo)
     });
     return new Response(JSON.stringify({ error: 'Erro interno' }), { status: 500 });
   }
   ```

6. **Formato de log:** `[MODULE] [OPERATION] mensagem` — MASQUE dados sensíveis: CNPJ mostra apenas últimos 4 dígitos, telefone mostra apenas últimos 4 dígitos.

7. **Limite de upload de arquivos:** 50MB máximo. VALIDE no frontend E no backend antes do upload.

8. **Google Drive como storage primário:**
   - USE Service Account para acesso programático
   - Organize em pastas: `/AMS/clientes/{client_id}/`, `/AMS/contratos/{contract_id}/`
   - Armazene apenas o `drive_file_id` no banco de dados
   - Se Google Drive falhar, retorne erro ao usuário (NÃO faça fallback automático para R2 sem configuração explícita)

9. **Uazapi Integration Pattern:**
   ```typescript
   // Enviar mensagem
   const response = await fetch(`${UAZAPI_BASE_URL}/sendText`, {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
       'SessionKey': env.UAZAPI_SESSION_KEY,
       'Token': env.UAZAPI_TOKEN,
     },
     body: JSON.stringify({
       phone: recipientPhone,
       message: messageText,
     }),
   });
   ```

10. **Webhook Uazapi (recebimento de mensagens):**
    - Endpoint: `/api/webhooks/uazapi`
    - VALIDE o token de autenticação do webhook
    - Armazene a mensagem na tabela `crm_message`
    - Atualize `crm_conversation.last_message_at` e `unread_count`

11. **WebSocket para CRM Inbox:** Para o inbox real-time, USE polling com intervalo de 5 segundos via `useEffect` + `setInterval` no componente CRM. NÃO implemente WebSocket nativo — Cloudflare Workers tem limitações de WebSocket para longa duração. O webhook da Uazapi já garante que as mensagens chegam ao banco em tempo real; o polling apenas atualiza a interface.

12. **Distribuição financeira:**
    ```typescript
    // Cálculo padrão (lido de financial_config)
    const config = await getFinancialConfig();
    const totalProfit = totalRevenue - totalExpenses;
    const partnerShare = totalProfit * (config.partner_share_percentage / 100);
    const companyReserve = totalProfit * (config.company_reserve_percentage / 100);
    // Se 3 sócios, cada um recebe: partnerShare (já é por sócio)
    // Reserve vai para o caixa da empresa
    ```

13. **Todas as datas no banco em UTC (TIMESTAMPTZ).** Conversão para fuso horário do Brasil (America/Sao_Paulo) apenas na camada de apresentação.

14. **Validação de inputs:** USE Zod para validar TODOS os inputs de API. Schema de validação colocado ao lado do handler da rota.

---

## 7. ENV VARIABLES

```bash
# ============================================
# DATABASE
# ============================================
DATABASE_URL="postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require"

# ============================================
# AUTH (better-auth)
# ============================================
BETTER_AUTH_URL="https://ams.growthhub.com.br"
BETTER_AUTH_SECRET="gerar-com-openssl-rand-hex-32"

# ============================================
# GOOGLE DRIVE
# ============================================
GOOGLE_SERVICE_ACCOUNT_EMAIL="ams@project-id.iam.gserviceaccount.com"
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
GOOGLE_DRIVE_ROOT_FOLDER_ID="1xxxxxxxxxxxxxxxxx" # Pasta raiz do AMS no Drive

# ============================================
# WHATSAPP (Uazapi)
# ============================================
UAZAPI_BASE_URL="https://sua-instancia.uazapi.dev"
UAZAPI_TOKEN="seu-token-global"
UAZAPI_WEBHOOK_SECRET="secret-para-validar-webhooks-incoming"
# Sessions individuais configuradas na tabela whatsapp_number

# ============================================
# CLOUDFLARE
# ============================================
CLOUDFLARE_ACCOUNT_ID="seu-account-id"
CLOUDFLARE_HYPERDRIVE_ID="seu-hyperdrive-id"

# ============================================
# EMAIL
# ============================================
RESEND_API_KEY="re_xxxxxxxxxxxxx"

# ============================================
# APP
# ============================================
NEXT_PUBLIC_APP_URL="https://ams.growthhub.com.br"
NODE_ENV="production"
```

---

## 8. IMPLEMENTATION ORDER

### Step 1: Project Setup + Database
- Criar projeto Next.js 15 com App Router
- Configurar Drizzle ORM + Neon PostgreSQL
- Rodar todas as migrations do schema acima
- Configurar wrangler.jsonc para Cloudflare Workers com OpenNext
- **Test:** `pnpm drizzle-kit push` roda sem erros. `pnpm dev` inicia o servidor local.

### Step 2: Authentication + Permissions
- Configurar better-auth com Drizzle adapter
- Implementar login/logout
- Criar middleware de verificação de role + module_permission
- Criar página de login
- Seed de usuários de teste (1 partner, 1 manager, 1 operational)
- **Test:** Login funciona. Partner acessa tudo. Operational é bloqueado no financeiro.

### Step 3: Layout Principal
- Implementar sidebar com navegação por módulos
- Topbar com nome do usuário, notificações e logout
- Sidebar oculta módulos que o usuário não tem permissão
- Responsividade mobile
- **Test:** Sidebar mostra apenas módulos permitidos por role.

### Step 4: Módulo de Clientes
- CRUD completo de clientes
- Upload de arquivos para Google Drive
- Vinculação de responsáveis
- **Test:** Cadastro, edição, exclusão e upload de arquivo funcionam. Arquivo aparece no Google Drive.

### Step 5: Módulo de Contratos
- CRUD de contratos vinculados a clientes
- Upload do contrato (PDF) para Google Drive
- Alertas de contratos a vencer (30 dias)
- **Test:** Contrato criado vincula ao cliente. Alerta aparece para contrato com end_date em 25 dias.

### Step 6: Módulo Financeiro (sócios only)
- Lançamentos financeiros (CRUD)
- Resumo mensal: receita, despesas, lucro
- Cálculo de distribuição entre sócios (parametrizável)
- Projeção anual
- Tela de configuração dos parâmetros financeiros
- **Test:** Apenas usuários com role=partner acessam. Distribuição calcula corretamente com 30% por sócio e 10% caixa.

### Step 7: Pipeline de Leads
- Visualização kanban de leads por etapa
- Drag-and-drop entre etapas
- CRUD de leads e tags
- Link lead ↔ conversa CRM
- **Test:** Lead criado aparece na etapa correta. Mover entre etapas atualiza o banco.

### Step 8: CRM / WhatsApp
- Cadastro de números WhatsApp da GH
- Inbox real de conversas (polling 5s)
- Endpoint webhook para receber mensagens da Uazapi
- Envio de mensagens pelo CRM
- Tags e filtros por classificação
- **Test:** Webhook recebe mensagem mock da Uazapi. Mensagem aparece no inbox. Envio de resposta funciona.

### Step 9: Kanban de Tarefas
- Colunas padrão (To Do, In Progress, Done)
- CRUD de tarefas com assignment
- Filtros por responsável
- Tela ADM para sócios (visualização de todas as tarefas)
- **Test:** Tarefa criada, movida entre colunas, filtro por responsável funciona.

### Step 10: Cron Jobs (Kanban → WhatsApp)
- Cron diário: busca tarefas do dia, envia via Uazapi para cada responsável
- Cron semanal (segunda): busca tarefas da semana, envia resumo
- Cron de alertas de contratos
- **Test:** Cron trigger manual (`/__scheduled`) envia mensagem formatada via Uazapi.

### Step 11: Agente SDR
- Painel de visualização de métricas
- Endpoint webhook para receber snapshots de métricas do n8n
- Filtros por período
- **Test:** Webhook recebe payload mock. Métricas exibidas com filtros funcionando.

### Step 12: Blog Interno
- Listagem em grid com categorias hierárquicas (pastas)
- Categorias funcionam como pastas: uma categoria raiz (ex: "Tráfego Pago") pode conter subcategorias (ex: "Criativos", "Copies", "Segmentações")
- Navegação por breadcrumbs: Blog > Tráfego Pago > Criativos
- Categorias raiz são as que têm `parent_id = NULL`
- Subcategorias são as que têm `parent_id` apontando para outra categoria
- O grid exibe as categorias raiz como "pastas". Ao clicar, exibe subcategorias e/ou posts
- Editor markdown com preview
- Upload de imagem de capa
- Sistema de tags e busca full-text
- Permissões por categoria (herdadas: se não tem acesso à categoria raiz, não vê as subcategorias)
- **Test:** Categoria "Tráfego Pago" criada com subcategoria "Criativos". Artigo criado dentro de "Criativos" renderiza corretamente. Navegação por breadcrumbs funciona. Usuário sem permissão na categoria raiz não vê nada.

### Step 13: Dashboard
- Cards de KPIs: MRR, ARR, clientes ativos, contratos a vencer, receita/despesas/lucro
- Gráfico de crescimento YOY (recharts)
- Funil de prospecção (dados do pipeline)
- Alertas e notificações recentes
- Comparativos mensais
- **Test:** Dashboard carrega com dados reais dos módulos anteriores. Métricas batem com os dados inseridos.

### Step 14: Notificações
- Sistema de notificações in-app
- Centro de notificações (lista com mark as read)
- Badge counter no topbar
- Geração automática de notificações por: contrato a vencer, tarefa com due_date hoje, pagamento atrasado
- **Test:** Notificação criada aparece no centro. Badge incrementa. Mark as read funciona.

### Step 15: Admin
- Gestão de usuários (CRUD)
- Configuração de permissões por módulo
- Parâmetros do sistema (financeiro, distribuição)
- **Test:** Admin cria usuário com role operational, configura permissões, usuário acessa apenas módulos permitidos.

### Step 16: Deploy Cloudflare
- Configurar OpenNext + Cloudflare Workers
- Configurar Hyperdrive para Neon
- Configurar Cron Triggers
- Configurar secrets no Cloudflare dashboard
- Testar deploy em preview antes de produção
- **Test:** App funciona em `*.workers.dev`. Cron triggers executam. Webhook da Uazapi chega.

#### Como funciona o deploy com OpenNext:
1. Instalar dependências: `pnpm add @opennextjs/cloudflare` e `pnpm add -D wrangler`
2. Adicionar scripts ao package.json:
   ```json
   {
     "build": "next build",
     "build:cf": "opennextjs-cloudflare build",
     "preview": "opennextjs-cloudflare build && opennextjs-cloudflare preview",
     "deploy": "opennextjs-cloudflare build && opennextjs-cloudflare deploy"
   }
   ```
3. Configurar `wrangler.jsonc`:
   ```jsonc
   {
     "$schema": "node_modules/wrangler/config-schema.json",
     "name": "ams-growthhub",
     "compatibility_date": "2025-09-27",
     "compatibility_flags": ["nodejs_compat"],
     "assets": { "directory": ".open-next/assets" },
     "main": ".open-next/worker.js",
     "hyperdrive": [{
       "binding": "HYPERDRIVE",
       "id": "<hyperdrive-config-id>"
     }],
     "triggers": {
       "crons": [
         "0 10 * * 1",
         "0 10 * * *",
         "0 3 1 * *"
       ]
     }
   }
   ```
4. Deploy via CLI: `pnpm deploy` (sobe Worker + assets para Cloudflare)
5. Para CI/CD: conectar repo GitHub ao Workers Builds no dashboard Cloudflare. A cada push no branch main, o build é executado automaticamente.
6. Secrets (DATABASE_URL, BETTER_AUTH_SECRET, etc.) configurados via `wrangler secret put` ou no dashboard Cloudflare.
7. Assets estáticos (JS, CSS, imagens) são servidos diretamente pelo CDN Cloudflare, sem custo adicional e sem contar como Worker requests.

#### Nota sobre plano Free vs Paid:
- INICIAR no plano Free (100k requests/dia, 10ms CPU time por request)
- MONITORAR CPU time via dashboard Cloudflare (Metrics > Errors > Exceeded CPU Limits)
- Se CPU time exceder 10ms consistentemente (SSR com queries complexas), migrar para Workers Paid ($5/mês) que oferece 30s de CPU e 10M requests/mês
- Cron Triggers e Hyperdrive estão inclusos em AMBOS os planos (free e paid)

---

## 9. ANTI-PATTERNS TO AVOID

1. **DO NOT** use Prisma. USE Drizzle ORM. Não substitua sob nenhuma circunstância.
2. **DO NOT** use Express, Fastify, Hono, ou qualquer framework backend separado. USE Next.js API Routes (App Router).
3. **DO NOT** use NextAuth.js / Auth.js. USE better-auth.
4. **DO NOT** use Supabase, Firebase, ou qualquer BaaS. USE Neon PostgreSQL direto via Drizzle.
5. **DO NOT** use AWS S3 para storage. USE Google Drive API (primário) ou Cloudflare R2 (fallback configurado).
6. **DO NOT** use Vercel para deploy. USE Cloudflare Workers via OpenNext.
7. **DO NOT** use `localStorage` ou `sessionStorage` para estado de autenticação. USE cookies httpOnly via better-auth.
8. **DO NOT** crie WebSocket servers para o CRM. USE polling com intervalo de 5s.
9. **DO NOT** use tRPC. USE server actions do Next.js ou API routes simples.
10. **DO NOT** instale Moment.js ou Luxon. USE `date-fns` para manipulação de datas.
11. **DO NOT** crie endpoints sem autenticação, nem temporariamente.
12. **DO NOT** use `sql.raw()` com variáveis interpoladas. USE SEMPRE os prepared statements do Drizzle.
13. **DO NOT** logue dados sensíveis (tokens, senhas, CNPJs completos, valores financeiros detalhados).
14. **DO NOT** use CSS modules ou styled-components. USE Tailwind CSS 4.
15. **DO NOT** crie microserviços separados. O AMS é um monolito Next.js.
16. **DO NOT** use Evolution API, Z-API ou qualquer outro provider WhatsApp. USE Uazapi.

---

## 10. VISUAL IDENTITY AND DESIGN SYSTEM

### Color Palette
```
PRIMARY:    #6C5CE7  — [uso: botões principais, CTAs, sidebar ativa, links]
SECONDARY:  #A29BFE  — [uso: hovers, ícones, badges, elementos de suporte]
BACKGROUND: #0F0F14  — [uso: fundo geral da aplicação - dark mode]
SURFACE:    #1A1A24  — [uso: cards, modais, painéis, sidebar]
SURFACE_2:  #24243A  — [uso: hover em cards, inputs focados]
TEXT:       #F5F5F7  — [uso: texto principal]
TEXT_MUTED: #8B8B9E  — [uso: texto secundário, labels, timestamps]
BORDER:     #2E2E42  — [uso: bordas, divisores]
SUCCESS:    #00D68F
WARNING:    #FFB800
ERROR:      #FF4757
INFO:       #3B82F6
```

### Typography
```
FONT_FAMILY_PRIMARY: Inter — system-ui, sans-serif
FONT_FAMILY_MONO:    JetBrains Mono — monospace

H1: 28px / 700 / 1.2
H2: 22px / 600 / 1.3
H3: 18px / 600 / 1.4
BODY: 14px / 400 / 1.6
SMALL: 12px / 400 / 1.5
LABEL: 11px / 500 / uppercase, 0.05em
```

### Spacing and Grid
```
BASE_UNIT: 4px
SPACING: 4px | 8px | 12px | 16px | 24px | 32px | 48px | 64px
BORDER_RADIUS: 6px (default) / 12px (cards) / 8px (buttons)
MAX_WIDTH: 1440px
SIDEBAR_WIDTH: 260px
GRID_COLUMNS: 12
GUTTER: 24px
```

### Component Styles
- **Cards:** bg-surface, border border-border, rounded-xl, shadow-none, hover:bg-surface_2 transition
- **Buttons Primary:** bg-primary text-white rounded-lg px-4 py-2, hover:bg-primary/90
- **Buttons Secondary:** bg-transparent border-border text-text rounded-lg, hover:bg-surface_2
- **Buttons Ghost:** bg-transparent text-text-muted, hover:bg-surface_2
- **Inputs:** bg-surface border-border rounded-lg px-3 py-2, focus:ring-2 focus:ring-primary/50, error:border-error
- **Tables:** header bg-surface_2 text-text-muted uppercase text-xs, rows hover:bg-surface_2/50, alternating subtle
- **Badges/Tags:** rounded-full px-2 py-0.5 text-xs font-medium, variants por cor da tag

### Animations and Transitions
```
TRANSITION_DEFAULT: 200ms ease-out
TRANSITION_FAST:    100ms ease-out
HOVER_LIFT:        none (dark theme = sem lift)
PAGE_TRANSITION:   fade 150ms
CARD_ENTRANCE:     fadeIn + translateY(8px) 200ms ease-out
SIDEBAR_COLLAPSE:  width 200ms ease-in-out
```

### Visual References
- ClickUp — Layout de sidebar + workspace, density de informação
- Linear — Estilo dark minimalista, tipografia limpa, atalhos
- Notion — Blog/knowledge base grid layout, simplicidade do editor
- Monday — Cores vibrantes em tags/status, kanban colorido

### Mode
- [x] Dark only (conforme brand da Growth Hub)

### Screen Structure
| Screen | Purpose | Key Components | Nav From/To |
|---|---|---|---|
| Login | Autenticação | Form email+senha, logo | → Dashboard |
| Dashboard | Visão consolidada | KPI cards, gráficos, funil, alertas | Sidebar → todos |
| Pipeline | Gestão de leads | Kanban board, filtros, tags | Sidebar |
| Contratos | Gestão de contratos | Tabela, detail view, alertas | Sidebar, Dashboard |
| Financeiro | Gestão financeira | Lançamentos, resumo, projeção, config | Sidebar (sócios) |
| CRM | Inbox WhatsApp | Lista conversas, chat view, filtros | Sidebar |
| Clientes | Cadastro de clientes | Tabela, detail view, arquivos | Sidebar, Contratos |
| SDR | Métricas dos bots | Cards de métricas, filtros período | Sidebar |
| Kanban | Gestão de tarefas | Board, filtros, ADM view | Sidebar |
| Blog | Knowledge base | Grid de posts, editor, categorias | Sidebar |
| Admin | Configurações | Users CRUD, permissões, parâmetros | Sidebar (sócios) |
| Notificações | Centro de alertas | Lista de notificações, mark as read | Topbar bell |

---

## 11. SECURITY MANIFEST — READ BEFORE WRITING ANY CODE

### SYSTEM RISK LEVEL
**HIGH** — O sistema processa dados financeiros reais, informações de clientes (CNPJ, contratos), credenciais de WhatsApp e métricas de negócio da agência. Compromisso de segurança impacta diretamente a operação.

### IDENTIFIED ATTACK SURFACES
- Endpoints API (todas as rotas /api/*)
- Webhook Uazapi (entrada externa de dados)
- Webhook SDR/n8n (entrada externa de dados)
- Upload de arquivos (limite 50MB, tipos permitidos)
- Google Drive API (credenciais de service account)
- Tokens Uazapi armazenados no banco
- Sessões de autenticação
- Parâmetros financeiros editáveis

### IMPERATIVE RULES

#### Credentials
- NEVER hardcode credentials in source code
- USE .env for all sensitive configuration — .env is in .gitignore
- NEVER log environment variable values
- Tokens Uazapi armazenados no banco DEVEM ser encrypted at rest (use better-auth's built-in encryption ou crypto.subtle)

#### Database
- NEVER use string concatenation in SQL queries
- USE Drizzle ORM prepared statements in ALL queries
- NEVER expose direct database editing endpoints without authorization + audit
- Database access via inspection tools requires: SSL + IP whitelist + separate read-only user
- IMPLEMENT row-level security via middleware: operacionais NUNCA veem dados de clientes que não são seus

#### Inputs and Endpoints
- VALIDATE and SANITIZE all external input before processing (USE Zod)
- NEVER create an endpoint without authentication, not even temporarily
- IMPLEMENT rate limiting on public endpoints: max 60 req/min per IP
- RETURN generic error messages to the user, detailed log only internally
- Webhooks DEVEM validar token/secret antes de processar payload

#### Sensitive Data
- MASK sensitive data in logs: CNPJ (últimos 4 dígitos), phone (últimos 4), financial values (nunca logados), tokens (nunca logados)
- NEVER transmit sensitive data in query strings
- APPLY LGPD: dados de clientes (CNPJ, email, telefone) são dados pessoais de pessoa jurídica/responsável. Implementar: consentimento implícito (relação contratual), direito de exclusão, portabilidade sob demanda

#### File Upload
- VALIDATE file type (allowlist: pdf, doc, docx, xls, xlsx, png, jpg, jpeg, gif, txt, md, csv)
- VALIDATE file size (max 50MB) BEFORE upload
- GENERATE unique filename (UUID) — NEVER use original filename in storage path
- SCAN for file type mismatch (magic bytes vs extension)

#### WhatsApp Integration
- Uazapi tokens NEVER exposed to frontend
- All WhatsApp API calls go through backend only
- Webhook endpoint validates UAZAPI_WEBHOOK_SECRET before processing
- Rate limit outgoing messages to prevent WhatsApp ban

### PRE-DEPLOY CHECKLIST
- [ ] No hardcoded credentials in code
- [ ] .env not committed to repository
- [ ] All endpoints authenticated (including webhooks with secret validation)
- [ ] Rate limiting configured on all public endpoints
- [ ] Logs contain no PII or tokens
- [ ] Prepared statements in all queries (Drizzle ORM enforces this)
- [ ] Stack traces not exposed to end user
- [ ] File upload validation (type + size) on frontend AND backend
- [ ] Uazapi tokens encrypted in database
- [ ] CORS configured to allow only app domain
- [ ] CSP headers configured
- [ ] Google Drive service account has minimal permissions (only AMS folder)
- [ ] Cloudflare Workers secrets configured (not env vars in wrangler.jsonc)
- [ ] Financial module restricted to partner role at route AND API level
- [ ] Blog categories respect per-user permission at query level
