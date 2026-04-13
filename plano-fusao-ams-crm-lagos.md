# Estratégia de Fusão: AMS + CRM SaaS Lagos

## Visão Geral

O AMS (Agency Management System) é o sistema interno da Growth Hub. O CRM Lagos é um produto SaaS multi-tenant para clientes da Lagos Assessoria. Ambos compartilham stack idêntica (Next.js 15, Drizzle, Neon, better-auth, shadcn/ui, Uazapi, Cloudflare Workers). A fusão transforma o projeto em uma **plataforma única** com dois modos de operação.

---

## Arquitetura Unificada

### O conceito: "Plataforma GH"

```
┌─────────────────────────────────────────┐
│           Plataforma Growth Hub          │
│                                          │
│  ┌──────────┐    ┌────────────────────┐  │
│  │   AMS    │    │   CRM SaaS Lagos   │  │
│  │ (interno)│    │  (multi-tenant)    │  │
│  │          │    │                    │  │
│  │ Dashboard│    │ Pipeline/Kanban    │  │
│  │ Pipeline │◄──►│ WhatsApp Chat      │  │
│  │ Contratos│    │ Automações         │  │
│  │ Financ.  │    │ Tarefas            │  │
│  │ CRM/WA   │    │ Calendário         │  │
│  │ Clientes │    │ Dashboard          │  │
│  │ SDR      │    │ Admin (tenants)    │  │
│  │ Kanban   │    │                    │  │
│  │ Blog     │    │                    │  │
│  └──────────┘    └────────────────────┘  │
│                                          │
│  ┌──────────────────────────────────────┐│
│  │        Camada Compartilhada          ││
│  │  Auth · DB · Uazapi · Queues · SSE  ││
│  └──────────────────────────────────────┘│
└─────────────────────────────────────────┘
```

### O que muda: tenant_id vira universal

O AMS original não tem multi-tenancy — foi feito para a GH usar sozinha. O CRM Lagos exige tenant_id em tudo. A fusão resolve isso assim:

- **A Growth Hub vira o "tenant 0"** — um tenant especial com flag `is_platform_owner = true`.
- **Todos os clientes da Lagos são tenants normais.**
- **Toda tabela que já existe no AMS ganha `tenant_id`** (migration incremental).
- **O middleware de tenant isolation passa a valer para tudo**, mas o superadmin (GH) pode operar em cross-tenant.

Isso significa que no futuro a GH pode vender o AMS como SaaS também, não só o CRM. A arquitetura já fica preparada.

---

## Plano de Fusão em 5 Fases

### Fase 1: Preparação do Terreno (1 semana)

**Objetivo:** Tornar o AMS existente multi-tenant-ready sem quebrar nada.

**Tarefas:**

1. **Adicionar `tenant_id` em todas as tabelas existentes do AMS.**
   - Migration que adiciona coluna `tenant_id UUID REFERENCES tenant(id)` com DEFAULT apontando para o tenant da GH.
   - Criar a tabela `tenant` se não existir, com o registro seed da GH (`is_platform_owner = true`).
   - Backfill: `UPDATE tabela SET tenant_id = '<gh-tenant-uuid>' WHERE tenant_id IS NULL`.
   - Tornar `tenant_id` NOT NULL após backfill.
   - Criar índices compostos `(tenant_id, ...)` nas tabelas mais consultadas.

2. **Criar middleware universal de tenant isolation.**
   - `lib/tenant.ts` → `getTenantId()` extrai tenant do session.
   - Toda API route e server action passa por esse middleware.
   - Para superadmin: header `X-Tenant-Override` permite operar em qualquer tenant.

3. **Adaptar better-auth para multi-tenant.**
   - Tabela `user_profile` com `tenant_id` + `role`.
   - Roles expandidos: `superadmin` (GH sócios), `admin` (admin do tenant Lagos), `operator` (operador do tenant), e os roles originais do AMS (`partner`, `manager`, `operational`) viram sub-roles dentro do tenant GH.

4. **Adaptar sidebar para contexto.**
   - Se usuário é do tenant GH → mostra módulos AMS (dashboard, pipeline, contratos, financeiro, CRM, clientes, SDR, kanban, blog).
   - Se usuário é de tenant Lagos → mostra módulos CRM (pipeline, chat, automações, tarefas, calendário, dashboard, configurações).
   - Se superadmin → mostra tudo + painel de tenants.

**Critério de avanço:** Todas as queries existentes do AMS continuam funcionando com o novo `tenant_id`. Nenhuma funcionalidade quebra. Testes passam.

---

### Fase 2: Schema Unificado (1 semana)

**Objetivo:** Fundir os schemas do AMS e do CRM Lagos em um único banco.

**O que já existe no AMS e pode ser reutilizado pelo CRM Lagos:**

| Tabela AMS | Reuso no CRM Lagos | Mudança necessária |
|------------|-------------------|--------------------|
| `pipeline_stage` | Direto → `stage` | Renomear para `stage`, adicionar `pipeline_id`, `welcome_message` |
| `lead` | Direto | Adicionar `entered_stage_at`, `is_converted`, `push_name` |
| `lead_tag` / `tag` | Direto | Separar tags do AMS e do CRM via `tenant_id` |
| `crm_conversation` | Parcial → vira `message` | Reestruturar: `message` fica flat (por lead), não por conversation |
| `crm_message` | Fundido em `message` | Mesmo |
| `kanban_task` | Parcial → `task` | AMS tem kanban de tarefas internas; CRM tem tasks vinculadas a lead. Manter ambos coexistindo via `type` field ou tabelas separadas |
| `user` / `user_profile` | Fundido | AMS `user` + CRM `user_profile` = tabela unificada |

**O que é novo (só CRM Lagos, não existia no AMS):**

| Tabela | Descrição |
|--------|-----------|
| `tenant` | Multi-tenancy core |
| `pipeline` | Múltiplos funis por tenant (AMS tinha stages fixas) |
| `automation` | Sequências de follow-up |
| `automation_log` | Registro de execuções |
| `calendar_event` | Sync Google Calendar |
| `email_template` (Fase 2) | Templates de email |
| `email_campaign` (Fase 2) | Campanhas |

**O que existe só no AMS e não é usado pelo CRM Lagos:**

| Tabela | Decisão |
|--------|---------|
| `contract` | Mantém. Módulo exclusivo AMS. |
| `financial_*` | Mantém. Módulo exclusivo AMS. |
| `sdr_*` | Mantém. Módulo exclusivo AMS. |
| `blog_*` | Mantém. Módulo exclusivo AMS. |
| `notification` | Unificar: sistema de notificações serve ambos. |

**Estratégia de migration:**
- Uma migration por tabela alterada.
- Ordem: `tenant` → `user_profile` (alter) → `pipeline` (new) → `stage` (alter de `pipeline_stage`) → `lead` (alter) → `message` (new, substituindo `crm_conversation` + `crm_message`) → `tag` (alter) → `automation` (new) → `task` (alter de `kanban_task` ou nova) → `calendar_event` (new).
- Cada migration é reversível.

**Critério de avanço:** Schema unificado rodando em staging. Drizzle push sem erros. Queries do AMS adaptadas ao novo schema.

---

### Fase 3: Funcionalidades Core do CRM (3 semanas)

**Objetivo:** Implementar os módulos do CRM Lagos dentro da estrutura unificada.

**Semana 1: Pipeline + WhatsApp**
- Kanban do CRM Lagos (componente novo, reutiliza `lead-card.tsx` do AMS)
- Webhook Uazapi com roteamento por tenant
- Chat integrado no card do lead
- SSE para real-time
- Auto-provisionamento de instância Uazapi no cadastro de tenant

**Semana 2: Automações**
- CRUD de sequências de follow-up
- Cloudflare Cron Trigger + Queues
- Template de mensagem com variáveis
- Logs de execução

**Semana 3: Tarefas + Calendário + Dashboard**
- Task CRUD vinculado ao lead
- Google Calendar push
- Componente de calendário
- Dashboard com KPIs do CRM

**Critério de avanço:** Um tenant de teste (simulando cliente da Lagos) completa o fluxo: conectar WhatsApp → receber lead → responder → criar automação → lead recebe follow-up → criar tarefa → ver no calendário → consultar dashboard.

---

### Fase 4: Admin + Onboarding (1 semana)

**Objetivo:** Painel superadmin funcional para gestão de tenants.

**Tarefas:**
- Tela de listagem de tenants com status da instância Uazapi
- Criação de tenant (nome, slug, auto-provisionar Uazapi)
- Gestão de usuários por tenant
- Monitoramento de automações ativas por tenant
- Fluxo de onboarding: Lagos cria tenant → convida admin do cliente → admin conecta WhatsApp via QR

**Critério de avanço:** Lagos consegue criar um novo cliente e o cliente fica operacional em < 10 minutos.

---

### Fase 5: Polish + Deploy (1 semana)

**Objetivo:** Sistema em produção.

**Tarefas:**
- Testes E2E do fluxo completo (ambos modos: AMS e CRM)
- Teste de isolamento multi-tenant (50 tenants)
- Deploy em Cloudflare Workers
- Configuração de Hyperdrive + Queues + Cron em produção
- Documentação de operação para Lagos
- CLAUDE.md atualizado com convenções finais

**Critério de avanço:** Sistema em produção, Lagos com pelo menos 1 cliente real conectado.

---

## Estrutura de Pastas Unificada

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── layout.tsx
│   ├── (platform)/                           # Layout unificado
│   │   ├── layout.tsx                        # Sidebar dinâmica por contexto
│   │   ├── page.tsx                          # Dashboard (adapta por tenant)
│   │   │
│   │   ├── # ── MÓDULOS AMS (tenant GH only) ──
│   │   ├── contratos/...
│   │   ├── financeiro/...
│   │   ├── clientes/...
│   │   ├── sdr/...
│   │   ├── kanban/...                        # Kanban de tarefas internas GH
│   │   ├── blog/...
│   │   │
│   │   ├── # ── MÓDULOS CRM LAGOS (todos os tenants) ──
│   │   ├── pipeline/...                      # Funil kanban de leads
│   │   ├── pipeline/[leadId]/...             # Lead detail + chat
│   │   ├── automations/...
│   │   ├── tasks/...                         # Tarefas vinculadas a lead
│   │   ├── calendar/...
│   │   │
│   │   ├── # ── MÓDULOS COMPARTILHADOS ──
│   │   ├── crm/...                           # Inbox WhatsApp (serve ambos)
│   │   ├── settings/...                      # Config do tenant
│   │   │
│   │   └── # ── SUPERADMIN ──
│   │       └── admin/...                     # Gestão de tenants
│   │
│   └── api/
│       ├── auth/[...all]/route.ts
│       ├── webhooks/uazapi/[instanceId]/route.ts
│       ├── sse/[tenantId]/route.ts
│       ├── uazapi/...
│       ├── calendar/...
│       └── cron/...
│
├── components/
│   ├── ui/                                   # shadcn/ui (compartilhado)
│   ├── layout/                               # Sidebar, topbar (compartilhado)
│   ├── pipeline/                             # Kanban de leads (CRM)
│   ├── automations/                          # Follow-ups (CRM)
│   ├── tasks/                                # Tarefas (CRM)
│   ├── calendar/                             # Calendário (CRM)
│   ├── dashboard/                            # KPIs (compartilhado, adapta por contexto)
│   ├── admin/                                # Tenant management (superadmin)
│   ├── contracts/                            # Contratos (AMS)
│   ├── financial/                            # Financeiro (AMS)
│   ├── clients/                              # Clientes (AMS)
│   ├── sdr/                                  # SDR (AMS)
│   ├── kanban/                               # Tarefas internas (AMS)
│   └── blog/                                 # Blog (AMS)
│
├── lib/
│   ├── auth.ts                               # better-auth config
│   ├── auth-client.ts
│   ├── db/
│   │   ├── index.ts                          # Drizzle client
│   │   ├── schema/                           # Schemas por domínio
│   │   │   ├── tenant.ts
│   │   │   ├── users.ts
│   │   │   ├── pipeline.ts                   # Stages, leads (compartilhado)
│   │   │   ├── messages.ts                   # WhatsApp messages
│   │   │   ├── automations.ts                # Follow-ups (CRM)
│   │   │   ├── tasks.ts                      # Tasks (compartilhado)
│   │   │   ├── calendar.ts
│   │   │   ├── contracts.ts                  # AMS only
│   │   │   ├── financial.ts                  # AMS only
│   │   │   ├── sdr.ts                        # AMS only
│   │   │   ├── blog.ts                       # AMS only
│   │   │   ├── tags.ts                       # Compartilhado
│   │   │   └── notifications.ts              # Compartilhado
│   │   └── migrations/
│   ├── tenant.ts                             # getTenantId(), middleware
│   ├── uazapi.ts                             # Uazapi API client
│   ├── google-calendar.ts
│   ├── queue.ts
│   ├── sse.ts
│   └── permissions.ts                        # Role-based access
│
├── types/
│   ├── database.ts
│   ├── uazapi.ts
│   ├── queue.ts
│   └── auth.ts
│
└── middleware.ts                              # Auth + tenant + route protection
```

---

## Decisão-Chave: Sidebar Dinâmica

A sidebar é o controle principal de "modo" do sistema. Lógica:

```typescript
// lib/permissions.ts

type TenantContext = {
  tenantId: string;
  isPlatformOwner: boolean; // GH = true
  role: 'superadmin' | 'admin' | 'operator' | 'partner' | 'manager' | 'operational';
};

function getSidebarModules(ctx: TenantContext): Module[] {
  const modules: Module[] = [];

  // Módulos CRM (todos os tenants)
  modules.push('pipeline', 'crm', 'tasks', 'calendar', 'dashboard');

  // Automações (admin+ de qualquer tenant)
  if (['superadmin', 'admin', 'partner', 'manager'].includes(ctx.role)) {
    modules.push('automations');
  }

  // Módulos AMS (apenas tenant GH)
  if (ctx.isPlatformOwner) {
    modules.push('contratos', 'financeiro', 'clientes', 'sdr', 'kanban', 'blog');
  }

  // Admin panel (apenas superadmin)
  if (ctx.role === 'superadmin') {
    modules.push('admin');
  }

  // Settings (admin+ do tenant)
  if (['superadmin', 'admin', 'partner'].includes(ctx.role)) {
    modules.push('settings');
  }

  return modules;
}
```

---

## CLAUDE.md — Regras para o Claude Code

Após a fusão, o CLAUDE.md do projeto deve conter:

```markdown
# CLAUDE.md — Plataforma Growth Hub

## Stack
- Next.js 15 (App Router) + shadcn/ui + Tailwind CSS 4
- Drizzle ORM + Neon PostgreSQL
- better-auth (Google OAuth) + roles customizados
- Uazapi (WhatsApp SaaS)
- Cloudflare Workers (OpenNext) + Queues + Cron Triggers

## Regras Absolutas
1. TODA query ao banco DEVE incluir tenant_id no WHERE.
2. NUNCA retornar tokens Uazapi em responses de API.
3. NUNCA criar endpoint sem auth ou webhook validation.
4. NUNCA usar string concatenation em queries. Drizzle ORM always.
5. NUNCA usar BullMQ, Redis, WebSocket, Prisma, NextAuth, ou Vercel.

## Convenções
- Schemas em src/lib/db/schema/ (um arquivo por domínio)
- Componentes em src/components/{domínio}/
- API routes em src/app/api/
- getTenantId() de lib/tenant.ts em toda server action e API route
- Structured logging (nunca console.log em produção)
- Erros: mensagem genérica pro client, detalhes no log

## Multi-tenancy
- Modelo: shared database, tenant_id em todas as tabelas
- GH é tenant especial (is_platform_owner = true)
- Tenants Lagos são clientes normais
- Superadmin opera cross-tenant via X-Tenant-Override header
- Middleware valida tenant em toda request autenticada

## Módulos
- AMS (tenant GH only): contratos, financeiro, clientes, sdr, kanban, blog
- CRM (todos os tenants): pipeline, chat, automações, tarefas, calendário
- Compartilhado: dashboard, crm/whatsapp, settings, notifications
- Superadmin: admin panel (tenant CRUD)
```

---

## Timeline Resumida

| Fase | Semanas | O que entrega |
|------|---------|--------------|
| 1. Preparação (multi-tenant) | 1 | AMS rodando com tenant_id, middleware, sidebar dinâmica |
| 2. Schema unificado | 1 | Banco fundido, migrations rodando, queries adaptadas |
| 3. CRM core | 3 | Pipeline, WhatsApp, automações, tarefas, calendário, dashboard |
| 4. Admin + onboarding | 1 | Painel superadmin, fluxo de onboarding Lagos |
| 5. Polish + deploy | 1 | Produção, testes E2E, docs |
| **Total** | **7 semanas** | Plataforma unificada em produção |

---

## Riscos da Fusão

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Migration de tenant_id quebra queries existentes do AMS | Alto | Rodar migration em staging primeiro; backfill com DEFAULT; testes unitários de cada módulo AMS antes de mergear |
| Conflito de naming entre tabelas AMS e CRM (ex: ambos têm `lead`) | Médio | Unificar tabela `lead` com campos opcionais por contexto; não criar duplicatas |
| Sidebar dinâmica fica confusa com muitos módulos | Baixo | Separação visual clara: seção "CRM" e seção "Gestão" na sidebar; ícones diferenciados |
| Performance do banco com muitos tenants + dados AMS | Baixo | Índices compostos (tenant_id, ...) em todas as tabelas hot; Hyperdrive para connection pooling |
