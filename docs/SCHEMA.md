# Pulse — Schema de dados (v1)

**Status:** especificação inicial para implementação  
**Alinhado a:** `PULSE_VISAO_PRODUTO.md` seções 4–7, 9, 12, 15  
**Última atualização:** 18/07/2026

---

## Princípios

1. **Uma forma de post** — texto, foto(s), ou ambos. Sem `tipo_post` / categorias.
2. **Metadado de perfil só no perfil** — universidade, campus, curso, ano nunca vivem no post.
3. **Duas contas** — `pessoa` | `organizacao`. Destaque só para organização (RLS + limite semanal).
4. **Privacidade no perfil** — `is_private` no perfil; visibilidade de posts/follows depende disso na leitura.
5. **RLS em toda tabela** desde o primeiro commit de migration.
6. **Auth via Supabase Auth** — identidade em `auth.users`; perfil de produto em `public.profiles` (1:1).

---

## Diagrama (relações)

```
auth.users 1──1 profiles
profiles 1──* posts
posts 1──* post_media
profiles 1──* follows (as follower)
profiles 1──* follows (as following)
profiles 1──* conversations (via conversation_participants)
conversations 1──* messages
profiles 1──* projects
profiles 1──* likes / comments (engagement)
profiles 1──* reports
profiles 1──* post_highlights (auditoria de uso semanal de destaque)
profiles 1──* profile_links
posts 1──* link_previews
profiles 1──* notifications (recipient)
```

---

## Tabelas

### `profiles`

Extensão de `auth.users`. Criado no signup (trigger).

| Coluna | Tipo | Notas |
|--------|------|--------|
| `id` | uuid PK | = `auth.users.id` |
| `phone` | text | espelho do telefone de auth; único quando preenchido |
| `email` | text nullable | recuperação; opcional |
| `username` | text unique | handle público |
| `display_name` | text | nome visível |
| `avatar_url` | text nullable | Storage |
| `bio` | text nullable | uma linha curta (limite app) |
| `account_type` | text | `pessoa` \| `organizacao` |
| `university` | text nullable | auto-declaração |
| `campus` | text nullable | |
| `course` | text nullable | |
| `year` | text nullable | |
| `is_private` | boolean default false | |
| `is_verified` | boolean default false | selo pago opcional — **nunca** no score do feed |
| `verified_type` | account_type nullable | `pessoa` \| `organizacao` no momento da activacao (badge) |
| `verified_at` | timestamptz | |
| `verification_expires_at` | timestamptz | periodo mensal |
| `priority_support` | boolean | denuncias/suporte prioritarios |
| `early_access` | boolean | feature flags futuras |
| `dm_permission` | text default `everyone` | `everyone` \| `following` \| `none` — quem pode iniciar DM |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**RLS:** leitura pública de campos de perfil (existência na rede); edição só dono. Conteúdo de posts privados continua protegido nas policies de `posts`.

### `posts`

| Coluna | Tipo | Notas |
|--------|------|--------|
| `id` | uuid PK | |
| `author_id` | uuid FK → profiles | |
| `body` | text nullable | texto livre; null se só mídia |
| `is_highlighted` | boolean default false | só org via RLS |
| `highlighted_at` | timestamptz nullable | início da janela de destaque |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

Check: `body` não vazio **ou** existe pelo menos um `post_media` (enforce na app + trigger opcional).

**RLS:**
- SELECT: autor; ou autor público; ou seguidor **aceito** se autor privado.
- INSERT/UPDATE/DELETE: só `author_id = auth.uid()`.
- `is_highlighted = true` só se `profiles.account_type = 'organizacao'` e dentro do limite semanal.

### `post_media`

| Coluna | Tipo | Notas |
|--------|------|--------|
| `id` | uuid PK | |
| `post_id` | uuid FK → posts ON DELETE CASCADE | |
| `storage_path` | text | path no bucket |
| `mime_type` | text | validado no upload |
| `width` / `height` | int nullable | |
| `position` | int default 0 | ordem na galeria |
| `created_at` | timestamptz | |

**RLS:** herda visibilidade do post pai.

### `follows`

| Coluna | Tipo | Notas |
|--------|------|--------|
| `follower_id` | uuid FK → profiles | |
| `following_id` | uuid FK → profiles | |
| `status` | text | `pending` \| `accepted` |
| `created_at` | timestamptz | |
| PK | (`follower_id`, `following_id`) | |

Conta pública: follow cria `accepted` direto. Conta privada: `pending` até aprovação.

**RLS:** participantes leem; follower cria; following atualiza status (aceitar/recusar); ambos podem apagar (deixar de seguir / remover seguidor).

### `conversations` + `conversation_participants` + `messages`

DM 1:1 na v1.

- `conversations`: `id`, `created_at`
- `conversation_participants`: `conversation_id`, `user_id`, PK composta; exatamente 2 participantes (enforce app + partial unique em par ordenado se necessário); `last_read_at`, `last_delivered_at` (tick de entrega, nunca "visto"), `muted`, `pinned_at`, `archived_at` (ações de inbox, por participante)
- `messages`: `id`, `conversation_id`, `sender_id`, `body`, `message_type`, `reply_to_id`, `deleted_at`, `forwarded`, `created_at`
- `message_attachments`, `message_reactions`: anexos (imagem/documento/audio/sticker) e reações por mensagem
- `message_hides`: "apagar para mim" (por utilizador, não afeta a cópia do remetente/outro participante)
- `conversation_pinned_messages`: mensagem fixada na conversa (partilhada entre participantes, PK em `conversation_id`)
- `message_link_previews`: preview OG por mensagem de texto, gerado uma vez server-side após envio (nunca no render path), mesmo padrão de `link_previews` dos posts

**RLS:** só participantes leem/escrevem. Ações de inbox (mute/pin/archive) e delivery são sempre por linha do próprio utilizador em `conversation_participants` (não afetam a linha do outro participante).

**Fora do escopo v1 (decisão de produto, ver `docs/UX_CHAT.md`):** grupos, chamada de vídeo, "visto" (read receipts), encriptação E2E anunciada, indicador "a escrever...".


### `projects` (portfólio leve)

| Coluna | Tipo | Notas |
|--------|------|--------|
| `id` | uuid PK | |
| `user_id` | uuid FK → profiles | |
| `title` | text | |
| `description` | text nullable | |
| `link` | text nullable | |
| `repo_url` | text nullable | |
| `image_url` | text nullable | |
| `position` | int default 0 | |
| `created_at` / `updated_at` | timestamptz | |

**RLS:** SELECT com mesma regra de visibilidade de posts do dono; CUD só dono.

### `likes` / `comments` (engajamento do ranking)

- `likes`: (`user_id`, `post_id`) PK, `created_at`
- `comments`: `id`, `post_id`, `author_id`, `body`, `created_at`

**RLS:** like/comment só em posts que o usuário pode ver; delete próprio.

### `reports`

| Coluna | Tipo | Notas |
|--------|------|--------|
| `id` | uuid PK | |
| `reporter_id` | uuid | |
| `target_type` | text | `post` \| `profile` \| `message` |
| `target_id` | uuid | |
| `reason` | text | |
| `status` | text default `open` | `open` \| `reviewed` \| `actioned` |
| `created_at` | timestamptz | |

**RLS:** reporter insere; select restrito (v1: só reporter vê as próprias; moderação via service role depois).

### `notification_preferences`

Preferências por tipo (sem toggle mestre). Criado no insert de perfil.

| Coluna | Tipo | Notas |
|--------|------|--------|
| `user_id` | uuid PK → profiles | |
| `new_followers` | boolean default true | |
| `likes` | boolean default true | |
| `comments` | boolean default true | |
| `messages` | boolean default true | |
| `mentions` | boolean default true | |
| `updated_at` | timestamptz | |

**RLS:** só o dono lê/escreve.

### `blocks`

| Coluna | Tipo | Notas |
|--------|------|--------|
| `blocker_id` | uuid FK → profiles | |
| `blocked_id` | uuid FK → profiles | |
| `created_at` | timestamptz | |
| PK | (`blocker_id`, `blocked_id`) | |

**RLS:** só o blocker gere a lista. Enforço em feed/DM pode evoluir depois.

### `professional_requests`

Pedido de modo profissional (pessoa → organizacao). Aprovação manual no Table Editor.

| Coluna | Tipo | Notas |
|--------|------|--------|
| `id` | uuid PK | |
| `profile_id` | uuid FK → profiles | |
| `nome_organizacao` | text | 2–120 chars |
| `tipo_organizacao` | enum | `universidade` \| `instituicao` \| `empresa` \| `clube` \| `outro` |
| `descricao` | text | max 200 |
| `contacto` | text | email / site / pagina oficial |
| `status` | enum | `pending` \| `approved` \| `rejected` |
| `created_at` | timestamptz | |
| `reviewed_at` | timestamptz nullable | preenchido na decisao |

**RLS:** dono SELECT + INSERT (`status` deve ser `pending`); sem UPDATE/DELETE no cliente.

**Triggers:**
- `approved` → `profiles.account_type = organizacao` (security definer)
- `profiles.account_type` bloqueado para cliente (self-service proibido)
- Signup cria sempre `pessoa`

### `highlight_usage` (limite semanal)

| Coluna | Tipo | Notas |
|--------|------|--------|
| `id` | uuid PK | |
| `org_id` | uuid FK → profiles | |
| `post_id` | uuid FK → posts | |
| `week_start` | date | segunda-feira UTC da semana |
| `created_at` | timestamptz | |

Unique (`org_id`, `post_id`) e contagem por (`org_id`, `week_start`) ≤ N.
`highlight_weekly_limit_for(org_id)` → **3** default, **6** se org com selo verificado activo.

### `verification_requests` / `verification_payments`
Pedido de selo pago (pessoa ou org). Fluxo 5 ecrãs (Valor → Requisitos → Documentos → Pagamento → Confirmação).

| Coluna (request) | Notas |
|------------------|--------|
| `account_type` | tipo no momento do pedido |
| `id_document_path` / `selfie_path` | pessoa (bucket `verification-docs`) |
| `org_document_path` / `org_email_domain` | organização |
| `status` | `draft` \| `pending_payment` \| `pending_review` \| `active` \| `rejected` \| `expired` \| `cancelled` |

**RLS:** utilizador só vê/cria o próprio pedido; insert só `draft`; update só `draft`/`pending_payment` (sem auto-activar). Pagamentos só via `service_role` (API `/api/verification/pay`). Activação: RPC `activate_verification` ou Table Editor (`status = active`).

**Preço:** 60 MZN 1.º mês, 150 MZN/mês a seguir (M-Pesa — simulado em dev, TODO no route).

**Regra:** selo **nunca** entra no score do feed. Boost só em Explorar/Descobre.

### `profile_admins` (alias view `account_admins`)
Multi-admin para contas org verificadas (`owner` | `admin`). Owner gere lista; admins listados leem.

### `profile_stats`
Contadores simples (views, alcance) para org verificada — nao e dashboard. `increment_profile_view` em visitas a `/u/[username]`.

### `profile_links`
Ate 5 links no perfil (rotulo + url + ordem). RLS: leitura autenticada; escrita so dono. UI mostra so o rotulo.

### `link_previews`
Cache OG (titulo, imagem, dominio) por URL de post. Preenchido **uma vez** no publish (`/api/posts/link-previews`) — **nunca** scraping no render do feed.

### `notifications`
Actividade (seguidor, curtida, comentario, mensagem, mencao, aprovacoes). RLS: so o destinatario le/actualiza `is_read`. Criacao via `emit_notification` (security definer) com check de `notification_preferences`. Curtidas agregam por (destinatario, tipo, referencia) em janela de 6h.

### `comments.reply_to_username`
Arvore real (qualquer profundidade). UI achata visualmente apos nivel 1 com prefixo "Respondendo a @x".

### `profile_interactions` (afinidade do feed — opcional v1.1)

Registo leve para ranking (comentar, curtir, visitar perfil, DM). Pode começar calculado a partir de likes/comments/messages e só depois materializar. **Não bloqueia schema v1 mínimo.**

---

## Storage buckets

| Bucket | Uso | Policy |
|--------|-----|--------|
| `avatars` | fotos de perfil | leitura pública; write só dono no path `{user_id}/...` |
| `post-media` | imagens de posts | leitura conforme post visível (via signed URL ou path + RLS storage); write só autor |
| `project-images` | capas de projeto | semelhante a avatars |
| `verification-docs` | docs do selo pago | privado; path `{user_id}/{request_id}/...` — só dono |

Validação MIME/tamanho no upload (app + edge se necessário). Nunca confiar só na extensão.

---

## Auth (produto)

- Cadastro/login: telefone **sem** confirmação SMS (config Supabase Auth + compensações da seção 12.1).
- E-mail opcional no perfil para recuperação.
- Trigger `on_auth_user_created` → insert em `profiles` com `account_type` default `pessoa`, username provisório se necessário.

---

## Fora do schema v1

- Marketplace / listings
- Verificação de identidade **gratuita/forçada** (selo **pago** opcional está in-scope)
- `post_type` / categorias
- Grupos, stories, lives
- Multi-participante em DMs

---

## Ordem de migrations

1. `profiles` + trigger auth + enums/checks
2. `posts` + `post_media` + highlight helpers
3. `follows`
4. `likes` + `comments`
5. `conversations` + participants + `messages`
6. `projects`
7. `reports` + `highlight_usage`
8. Storage buckets + policies

Cada migration: `ENABLE ROW LEVEL SECURITY` + policies no mesmo ficheiro.
