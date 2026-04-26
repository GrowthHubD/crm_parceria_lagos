# Módulo CRM — Funcionalidades

> Documentação do estado atual do módulo CRM (`/crm` no app). Cobre tudo que está rodando: webhook Uazapi, inbox, conversa, mídia, automações vinculadas.

**Última atualização:** 2026-04-25
**Provider WhatsApp atual:** Uazapi v2 (override `WHATSAPP_PROVIDER=uazapi` em `.env.local`)
**Status:** Todas features listadas estão **funcionais** em produção local.

---

## 1. Visão geral

O CRM é a interface de atendimento via WhatsApp. Cada conversa é uma `crm_conversation` ligada a um `whatsapp_number` (instância Uazapi). Mensagens chegam via webhook, são persistidas em `crm_message`, e podem disparar automações (welcome, follow-up).

### Fluxo end-to-end típico

```
Contato manda msg no WhatsApp
  ↓
Uazapi recebe → POST /api/webhooks/uazapi/v2 (via tunnel/URL pública)
  ↓
Webhook handler:
  - Detecta mediaType (text/audio/image/video/sticker/document)
  - Se mídia → POST /message/download na Uazapi → URL HTTPS decriptada
  - Baixa + sobe pro Supabase Storage (URL pública)
  - Insere crm_message
  - Cria/atualiza conversation + lead (se primeiro contato)
  - Dispara welcome (triggerFirstMessage) se lead novo
  ↓
Inbox `/crm` mostra conversa atualizada
  ↓
Operador responde → POST /api/crm/[id]/send → Uazapi → contato recebe
  ↓
Conversation.lastOutgoingAt atualizada → ticker de follow-up entra em ação
```

---

## 2. Inbox (lista de conversas)

**Componente:** [`src/components/crm/inbox.tsx`](../src/components/crm/inbox.tsx)
**API:** `GET /api/crm` ([route](../src/app/api/crm/route.ts))

### Funcionalidades

- **Lista de conversas** ordenada por `lastMessageAt` desc
- **Avatar** do contato (foto perfil WhatsApp baixada via `chat.imagePreview`)
- **Preview da última mensagem** com prefixo "Você:" pra outgoing
  - Detecta mediaType: `🎤 Áudio` / `📷 Imagem` / `🎥 Vídeo` / `📄 Documento`
- **Badge de não lidas** (vermelho)
- **Filtros locais**: busca texto, número WhatsApp
- **Filtros compartilhados** com Pipeline (URL params): tag, stage, classificação
  - Componente: [`src/components/shared/lead-filters.tsx`](../src/components/shared/lead-filters.tsx)
  - Hook: `useLeadFiltersFromUrl()`
- **Tabs**: Tudo / Não lidas / Favoritas / Grupos
- **Polling 5s** (atualiza inbox sem refresh)
- **Realtime ready** (Supabase Realtime na tabela `crm_message` — habilitar via `scripts/enable-realtime.ts`)

---

## 3. Conversation View (chat aberto)

**Componente:** [`src/components/crm/conversation-view.tsx`](../src/components/crm/conversation-view.tsx)
**API:** `GET /api/crm/[id]` ([route](../src/app/api/crm/[id]/route.ts))

### Header
- Avatar + nome (alias > pushName > phone)
- Telefone ou "WhatsApp" (se contato é LID Business)
- **Badge de próximo follow-up** (`<NextFollowUpBadge>`) — mostra "Próximo: aaa em 2min"
- Vinculação a Lead: chip clicável que abre o lead OU botão "Criar Lead"
- Dropdown de classificação (Novo/Hot/Morno/Frio/Cliente Ativo)
- Botão **Reset Conversa** ([endpoint](../src/app/api/crm/[id]/reset/route.ts)) — apaga msg + lead + logs (útil pra teste)

### Mensagens
- **Agrupamento de imagens consecutivas** em galeria (`ImageGallery`)
- **Renderização por tipo**:
  - **Texto**: `<p>` whitespace-pre-wrap
  - **Áudio** (`mediaType="audio"`): `<AudioPlayer>` customizado
  - **Imagem** (`mediaType="image"`): `<img>` clicável → abre `<MediaLightbox>`
  - **Vídeo** (`mediaType="video"`): `<video controls>` clicável → `<MediaLightbox>`
  - **Sticker** (`mediaType="sticker"`): `<StickerView>` (webp ou webm/mp4)
  - **Documento** (`mediaType="document"`): `<a download>` com ícone FileText
- **Otimização**: `mediaUrl` direto da Supabase Storage URL (bypass do proxy `/api/crm/.../media`) — corta ~1s de latência
- **Quoted/reply**: mostra contexto da msg respondida
- **Star**: marcar/desmarcar favorita
- **Edited**: indicador "editada"
- **Status**: sent / delivered / read (✓/✓✓/✓✓ azul)

### Auto-scroll smart
- **Só desce se você já estava no fim da conversa**
- Se rolou pra cima pra ler msg antiga, NÃO força descida quando chega msg nova ou quando mídia carrega
- **Botão flutuante ↓** no canto inferior direito quando rolou pra cima (>80px do fim)
- Click do botão desce smooth

### Selection mode
- Long-press pra entrar em modo seleção
- Seleciona várias msgs → "Salvar como" / outras ações em batch

### Input area
- Textarea pra digitar
- **Botão "+" anexar** arquivo (imagem, vídeo, doc)
- **Botão mic 🎤** → `<AudioRecorder>` (gravação inline)
- **Botão Send ➤** envia texto
- Reply preview no topo do input quando respondendo msg
- Staged files preview (várias imagens antes de enviar)

---

## 4. Audio Recording (PTT)

**Componente:** [`src/components/crm/audio-recorder.tsx`](../src/components/crm/audio-recorder.tsx)
**Conversão:** [`src/lib/audio-convert.ts`](../src/lib/audio-convert.ts)
**Endpoint:** `POST /api/crm/[id]/send-media` com `isAudio: true`

### Estados
- `idle`: botão de mic compacto no input area
- `recording`: container expanded — `[🗑] [● pulse] 0:03 [waveform fino scrolling] [⏱ 1x] [⏸] [➤ branco circular]`
- `paused`: igual recording mas pulse parado + botão Play (alterna pra Pause ao continuar)
- `preview`: player inline (play/pause/seek/tempo) + descartar/regravar/enviar
- `sending`: spinner

### Tecnologia
- **MediaRecorder API** com `audio/webm;codecs=opus` (Chrome/Edge) ou `audio/ogg;codecs=opus` (Firefox)
- **AudioContext + AnalyserNode** (fftSize=512) pra waveform em tempo real
- **Canvas** com 60+ barras finas, scrolling da direita pra esquerda (mantém histórico)
- **Pause/Resume** via `MediaRecorder.pause()/resume()` (mic continua aberto)
- **Auto-stop** em 5min (`MAX_DURATION_SEC`)

### Conversão server-side webm → ogg
Necessária pra WhatsApp renderizar como balão de voz (não documento):
- `ffmpeg -i input.webm -c:a libopus -b:a 32k -ar 48000 -ac 1 -application voip -f ogg output.ogg`
- Pacote: `@ffmpeg-installer/ffmpeg` (binário multiplataforma)
- Marcado como `serverExternalPackages` em [`next.config.ts`](../next.config.ts) pra webpack não quebrar paths

### Envio pro Uazapi
- Sobe OGG pro Supabase Storage primeiro
- Manda URL pública pra `/send/media` com `{number, type: "ptt", file: <publicUrl>}`
- (Não data URI — Uazapi prefere URL pública pra renderizar como PTT)

### Cleanup
- Tracks do MediaStream parados ao desmontar/cancelar/enviar
- AudioContext fechado
- `URL.revokeObjectURL` no preview blob

---

## 5. Audio Playback

**Componente:** [`src/components/crm/audio-player.tsx`](../src/components/crm/audio-player.tsx)

### Funcionalidades
- Botão Play/Pause customizado (não usa `<audio controls>` nativo)
- **Drag-to-seek** com pointer events (precisão em áudios longos)
- **Click-to-seek** na barra
- **Tempo atual / total** com formato `0:42 / 2:15`
- **Velocidade** 1x / 1.5x / 2x (cycle button)
- **Download** integrado (botão ícone Download)
- **Estados**: loading (spinner) / ready / error (`AlertCircle` + texto)
- **Truque OGG/Opus duration** (seek-to-end pra forçar parse de header sem duration)

### Cores adaptativas
- Outgoing (bg-primary): brancas/transparentes
- Incoming (bg-surface-2): primary/foreground

### Acessibilidade
- `aria-label` em todos os botões
- `role="slider"` no track com `aria-valuemin/max/now/valuetext`
- Keyboard: ←/→ pulam 5s, Space/Enter alterna play/pause
- Focus visível com ring

### MIME parser
- Endpoint `/api/crm/[id]/messages/[msgId]/media/route.ts` parseia data URI com codec params (`audio/ogg; codecs=opus` com espaço)
- Retorna `Accept-Ranges: bytes` + `Content-Length` pra suportar seek em áudios longos

---

## 6. Mídia incoming (decrypt + storage)

**Handler:** [`src/app/api/webhooks/uazapi/v2/route.ts`](../src/app/api/webhooks/uazapi/v2/route.ts)

### Detecção robusta de tipo
- Checa `mediaType`, `type`, `messageType` (case-insensitive)
- Normaliza Baileys naming: `imageMessage` → `image`, `audioMessage`/`ptt`/`voice` → `audio`, `stickerMessage` → `sticker`, etc.

### Extração de URL/base64 (cobertura ampla)
- URL_KEYS: `mediaUrl`, `media_url`, `fileURL`, `fileurl`, `file_url`, `url`, `downloadUrl`, `download_url`, `directPath`, `file`
- BASE64_KEYS: `base64`, `mediaBase64`, `media_base64`, `fileBase64`, `file_base64`
- Procura tanto no root da `message` quanto aninhado em `content`/`media`

### Decryption via Uazapi
- Pra QUALQUER mídia sem URL pública utilizável (`.enc`, `mmg.whatsapp.net`, `https://web.whatsapp.net` placeholder de sticker), chama:
  - `POST /message/download {id}` na Uazapi
  - Retorna `{fileURL, mimetype}` decriptado servido pela própria instância
- Função: `uazapiDownloadMedia(baseUrl, token, messageId)`

### Upload pro Storage
- Helper: [`src/lib/supabase-storage.ts`](../src/lib/supabase-storage.ts)
- Bucket `whatsapp-media` (público)
- Path: `{tenantId}/{conversationId}/{uuid}.{ext}`
- MIME normalizado pra allowlist do bucket (audio/opus → audio/ogg, audio/x-m4a → audio/mp4)

### Persistência
- Insere `crm_message` com `mediaType`, `mediaUrl` (Storage URL pública)
- `messageIdWa` pra dedup (idempotente via `onConflictDoNothing`)
- Atualiza `crm_conversation`: `lastMessageAt`, `lastIncomingAt`, `unreadCount`, `contactPushName`, `contactProfilePicUrl`

---

## 7. Sticker (figurinhas)

**Componente:** [`src/components/crm/sticker-view.tsx`](../src/components/crm/sticker-view.tsx)

### Suporte
- **Estática** (image/webp): `<img>` (browser handle webp anim nativamente)
- **Animada** (video/webm ou video/mp4): `<video autoplay loop muted playsInline>`
- **Detecção rápida**: heurística por extensão da URL (sem HEAD request — corta latência)

### Estilo
- Tamanho ~160×160px (estilo balão de figurinha)
- Fundo transparente
- Cantos arredondados

---

## 8. Media Lightbox

**Componente:** [`src/components/crm/media-lightbox.tsx`](../src/components/crm/media-lightbox.tsx)

### Funcionalidades
- Modal full-screen `fixed inset-0 bg-black/90 backdrop-blur-sm`
- Suporta imagem (`<img>`) e vídeo (`<video controls autoPlay>`)
- **Esc** fecha
- **Click fora** fecha
- **Botões topo direita**: Download (com filename) + Fechar (X)
- Bloqueia scroll do body enquanto aberto
- `role="dialog" aria-modal`

### Quando abre
- Click em imagem (single ou da galeria)
- Click em vídeo do chat (quando paused)

---

## 9. Conversation Popup (do Pipeline)

**Componente:** [`src/components/pipeline/conversation-popup.tsx`](../src/components/pipeline/conversation-popup.tsx)

Embute `<ConversationView>` num modal — acessado clicando na prévia da última msg de um lead no kanban. Permite ver/responder sem sair do `/pipeline`.

---

## 10. Filtros compartilhados CRM ↔ Pipeline

**Componente:** [`src/components/shared/lead-filters.tsx`](../src/components/shared/lead-filters.tsx)
**Hook:** `useLeadFiltersFromUrl()`
**Helper:** `buildLeadFiltersQuery()`

### Filtros sincronizados
| Filtro | Pipeline | CRM | Critério |
|---|---|---|---|
| **Tag** | ✓ chips | ✓ | Lead.tags inclui tagX |
| **Stage** | ✓ dropdown | ✓ | lead.stageId === X |
| **Classificação** (hot/warm/cold/active_client/new) | ✓ | ✓ | crm_conversation.classification |
| **Funil/Pipeline** | ✓ header | ✓ | leads cujo stage pertence a esse pipeline |

### UX
- URL params (`?tag=ID&stage=ID&class=hot&pipeline=ID`) — preservam entre navegações
- Pipeline → CRM com mesmo filtro: `/pipeline?tag=X` → click em "/crm?tag=X"
- Botão "Limpar" quando há filtro ativo

---

## 11. Próximo Follow-up Badge

**Componente:** [`src/components/automations/next-followup-badge.tsx`](../src/components/automations/next-followup-badge.tsx)
**Lógica:** [`src/lib/automations/chain-preview.ts`](../src/lib/automations/chain-preview.ts) — `getNextFollowUp()` / `getNextFollowUpBatch()`

### O que faz
Mostra **qual** automação `lead_inactive` vai disparar a seguir pro lead E **quando** (ETA relativo).

### Onde aparece
- **Header da conversa no CRM** (variant `full`)
- **Card do kanban no Pipeline** (variant `compact`)

### Lógica
- Read-only — espelha semântica de `scheduleInactiveLeadFollowups` SEM inserir logs
- Cadeia sequencial: step N só conta como próximo se step N-1 está `sent` no ciclo atual
- Reset por ciclo: filtra logs com `createdAt > lastOutgoingAt` (operador re-respondeu = novo ciclo)
- Status: `pending` (já agendado) ou `upcoming` (vai agendar quando atingir threshold)

---

## 12. Endpoints API do CRM

| Endpoint | Método | Descrição |
|---|---|---|
| `/api/crm` | GET | Lista conversas do tenant + preview da última msg |
| `/api/crm/[id]` | GET | Conversation + messages + linkedLead + nextFollowUp |
| `/api/crm/[id]` | PATCH | Atualiza classification, contactName, contactAlias, unreadCount |
| `/api/crm/[id]/send` | POST | Envia msg de texto (suporta quoted) |
| `/api/crm/[id]/send-media` | POST | Envia mídia (file=dataUri, isAudio/isImage flags) |
| `/api/crm/[id]/messages/[msgId]/media` | GET | Proxy 302 pra mediaUrl (auth + DB lookup) |
| `/api/crm/[id]/messages/[msgId]` | PATCH | Atualiza msg (isStarred, etc) |
| `/api/crm/[id]/reset` | DELETE | Apaga conv + msgs + lead + logs (teste) |
| `/api/webhooks/uazapi/v2` | POST | Recebe eventos Uazapi (messages, messages_update, connection, qr) |

---

## 13. Schema relevante (Drizzle)

### `crm_conversation` ([schema](../src/lib/db/schema/crm.ts))
- `id`, `tenantId`, `whatsappNumberId`
- `contactPhone`, `contactJid` (incl. `@lid`), `contactName`, `contactPushName`, `contactAlias`
- `contactProfilePicUrl` (URL HTTPS ou string `"none"` quando webhook não achou)
- `classification`: hot/warm/cold/active_client/new
- `unreadCount`, `lastMessageAt`, `lastIncomingAt`, `lastOutgoingAt`, `isGroup`
- Timestamps

### `crm_message`
- `id`, `conversationId`, `messageIdWa` (pra dedup), `direction` (incoming/outgoing)
- `content`, `mediaType` (text/audio/image/video/sticker/document), `mediaUrl`
- `status`, `senderName`, `quotedMessageId`, `quotedContent`, `isStarred`
- `timestamp`

### `whatsapp_number`
- `id`, `tenantId`, `phoneNumber`, `label`
- `uazapiSession` (instance name na Uazapi), `uazapiToken`
- `isActive`

---

## 14. Variáveis de ambiente necessárias

```env
# Database (Supabase)
DATABASE_URL=postgresql://...:6543/postgres
DIRECT_URL=postgresql://...:5432/postgres

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# WhatsApp Provider
WHATSAPP_PROVIDER=uazapi  # override; default: evolution em dev, uazapi em prod
NEXT_PUBLIC_APP_URL=https://seu-tunnel.trycloudflare.com  # ou URL do deploy

# Uazapi (provider de prod)
UAZAPI_BASE_URL=https://williphone.uazapi.com  # subdomain DEDICADO da sua instância
UAZAPI_ADMIN_TOKEN=xxxxxxxx

# Evolution (provider de dev — opcional se WHATSAPP_PROVIDER=uazapi)
EVOLUTION_API_URL=https://evolution.example.com
EVOLUTION_API_KEY=xxxxxxxx

# Cron + automações
CRON_SECRET=xxxxxxxx
AUTOMATION_DRY_RUN=false  # true = apenas loga, não envia (testes)
AUTOMATION_TICK_DISABLED=false  # true em serverless (Vercel) onde setInterval não funciona

# Cloudflare (opcional)
CLOUDFLARE_ACCOUNT_ID=xxx
CLOUDFLARE_HYPERDRIVE_ID=xxx
```

---

## 15. Setup mínimo pra rodar do zero

1. **Clone + install**
   ```bash
   git clone <repo>
   pnpm install
   ```

2. **Configurar `.env.local`** com as variáveis acima

3. **Migrations**
   ```bash
   pnpm db:push  # cria/atualiza schema no Supabase
   npx tsx scripts/apply-dry-run-flag.ts  # adiciona dry_run columns
   npx tsx scripts/apply-welcome-dedup-index.ts  # partial unique index pro welcome
   npx tsx scripts/seed-supabase-auth.ts  # cria user superadmin
   ```

4. **Setup Storage**
   ```bash
   npx tsx scripts/setup-storage.ts  # cria bucket whatsapp-media
   ```

5. **Conectar instância Uazapi** (você precisa de uma já provisionada na Uazapi):
   - Pega `instance name` + `instance token` no painel Uazapi
   - Insere em `whatsapp_number` (ou usa `scripts/register-uazapi-instance.ts` adaptado)
   - Configura webhook no painel Uazapi: `<URL_APP>/api/webhooks/uazapi/v2` com eventos `messages, messages_update, connection, qr`

6. **Subir tunnel pra dev** (se localhost):
   ```bash
   cloudflared tunnel --url http://localhost:3000
   # Pega URL gerada, atualiza NEXT_PUBLIC_APP_URL e webhook na Uazapi
   ```

7. **Run**
   ```bash
   pnpm dev
   ```

8. **Verificar**: ticker iniciado, pode mandar msg de teste

---

## 16. Testes automatizados

Todos com `AUTOMATION_DRY_RUN=true` (não enviam mensagens reais):

| Script | Coverage |
|---|---|
| `scripts/test-chain-window.ts` | 20 checks — cadeia, janela horário, loop-proof |
| `scripts/test-chain-preview.ts` | 13 checks — getNextFollowUp / batch |
| `scripts/test-followup-uazapi.ts` | 15 checks — welcome + follow-up + retry + backoff |
| `scripts/test-audio-flow.ts` | 15 checks — áudio incoming + parser MIME |
| `scripts/test-uazapi-end-to-end.ts` | 12 checks — webhook → conv → lead → welcome |

```bash
npx tsx scripts/test-chain-window.ts        # ✅ 20/20
npx tsx scripts/test-chain-preview.ts       # ✅ 13/13
npx tsx scripts/test-followup-uazapi.ts     # ✅ 15/15
npx tsx scripts/test-audio-flow.ts          # ✅ 15/15
npx tsx scripts/test-uazapi-end-to-end.ts   # ✅ 12/12
```

---

## 17. Bugs conhecidos / limitações

- **Cloudflare Workers / Vercel serverless**: `setInterval` do ticker não persiste. Workaround: `AUTOMATION_TICK_DISABLED=true` + Vercel Cron / CF Cron Trigger chamando `/api/cron/follow-up`
- **ffmpeg em serverless**: `@ffmpeg-installer/ffmpeg` não funciona em edge runtime. Pra Cloudflare Pages/Workers, áudio gravado precisa ser convertido client-side (ex: `opus-recorder`)
- **Realtime do inbox**: implementação via polling 5s. Pra usar Supabase Realtime, precisa habilitar via `scripts/enable-realtime.ts` e adicionar subscription no `inbox.tsx`
- **N8N coexistência**: Uazapi parece suportar **1 webhook por instância**. Se já tem N8N usando webhook, configurar o nosso vai sobrescrever
- **Polling no kanban removido**: Pipeline não polla mais (era source de race com drag). Pra ver mudanças de outros users, F5

---

## 18. Roadmap sugerido (não implementado)

- [ ] Send sticker do CRM (atualmente só recebemos)
- [ ] Templates de resposta rápida
- [ ] Encaminhar mensagens
- [ ] Status do operador (online/offline) visível ao contato
- [ ] Encriptação client-side de mídia em Storage (mediaKey custom)
- [ ] Bulk operations (marcar várias como lidas, atribuir tags em massa)
- [ ] Search global em todas as msgs (não só por nome de conversa)
- [ ] Export de conversa (PDF/JSON)
- [ ] WhatsApp Business API oficial (alternativa pro Uazapi)
