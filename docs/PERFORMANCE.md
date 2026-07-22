# Performance — fluidez nativa (padrao grandes apps)

Ultima actualizacao: 22/07/2026

## Principio

O utilizador nunca deve sentir "a pagina a recarregar" por uma acao local
(like, seguir, marcar notificacao, publicar comentario). O servidor e a
fonte de verdade em background; a UI e optimista e local-first.

Inspiracao: Instagram (optimistic social), WhatsApp (realtime + poll
fallback), Twitter/X (timeline soft-cache + "new posts" pill), Next.js
App Router Client Router Cache (`staleTimes`).

---

## Implementado

### Navegacao (sem re-fetch em cada tab)

| Mecanismo | Porque |
|-----------|--------|
| `experimental.staleTimes` (dynamic 30s / static 180s) | Tab home ↔ mensagens ↔ perfil reutiliza o RSC payload em vez de re-rankear o feed |
| Prefetch das rotas primarias no `AppShell` | Toque no tab bar parece nativo |
| Scroll restore do feed (`sessionStorage`) | Voltar do detalhe do post mantem a posicao |
| Snapshot do feed (`feed-cache.ts` + sessionStorage, soft 45s / hard 50m) | Primeiro paint instantaneo ao voltar ao home |

### Feed (sem "sempre a actualizar")

| Mecanismo | Porque |
|-----------|--------|
| First paint 15 posts + infinite scroll `/api/feed` | TTFB baixo |
| Poll **leve** `/api/feed/check` (1 row: latest id) | Nao re-rankea nem assina media so para ver se ha novidade |
| Full fetch so quando `latestId` e desconhecido | Economiza ranking + signed URLs + affinity |
| Backoff por scroll + tab hidden | Nao gasta radio em background / deep scroll |
| Pill "N novas publicacoes" | Igual IG: nao empurra conteudo se o user esta a ler |
| Loop de poll com deps estaveis (refs) | Like/comment nao reiniciam o timer |

### Accao social optimista (sem `router.refresh`)

| Accao | Comportamento |
|-------|----------------|
| Like / comment-like | UI imediata, rollback em erro |
| Seguir / deixar de seguir | Estado local; sem RSC refresh |
| Pedido de follow (Confirmar/Eliminar) | Row desaparece optimista |
| Notificacoes lidas | Estado local |
| Links de perfil | Estado local |
| Comentario novo | Append local apos insert+select |
| Senha / e-mail recuperacao / modo profissional | Msg local, sem refresh |

`router.refresh` permanece so onde a sessao muda de verdade (login, logout, apagar conta).

### Media e payload

| Area | Mudanca |
|------|---------|
| Feed media | `createSignedUrls` em batch + cache em memoria |
| Feed payload | `likes(count)` / `comments(count)` |
| Feed liked_by_me | Query unica do viewer |
| Upload | Compressao no cliente antes do storage |
| Imagens | `next/image` + AVIF/WebP + lazy |
| Chat | Ultimas 50 msgs; anexos assinados em batch |

### Badges

| Badge | Estrategia |
|-------|------------|
| Mensagens | Realtime INSERT primario; poll 90s so com tab visivel |
| Notificacoes | Realtime em `notifications` (sem poll) |

### PWA / HTTP

| Area | Politica |
|------|----------|
| SW | So assets estaticos + offline shell (nao intercepta HTML auth) |
| `/_next/static` | immutable 1 ano |
| Icons | 7 dias |
| `/api/feed` | `private, no-store` (personalizado) |
| `/api/feed/check` | `private, max-age=0, must-revalidate` |

---

## O que NAO fazer (anti-padroes)

1. **`router.refresh()` apos like/follow/comment** — re-executa ranking, signed URLs, badges. Sente-se como reload.
2. **Poll do feed completo a cada N segundos** — ranking e caro; usar probe leve.
3. **Cache CDN publico no feed** — dados por utilizador + RLS; so `private`.
4. **Revalidar RSC em cada troca de tab** — `staleTimes` existe exactamente para isto.
5. **Service worker a cachear HTML autenticado** — causa loops "offline" e sessoes fantasma.

---

## Proximos (se ainda houver jank)

- [ ] Virtualizar feed/chat (react-window / tanstack-virtual) apos ~50 itens
- [ ] Thumbnails no upload (dimensoes no storage path)
- [ ] Contadores materializados no Postgres (like_count em posts)
- [ ] Realtime `posts` INSERT para substituir o check periodico
- [ ] Rate limit distribuido (Upstash) multi-instancia

## Notas de implementacao (22/07/2026)

- Probe cronologico (`/api/feed/check`) != ordem do ranking. Depois de um
  pull page-0, o `latestId` e **acknowledged** mesmo se o post nao entrou
  no topo — evita full-fetch em loop.
- Comentario optimista: insert + `profiles` do autor em paralelo (sem
  join FK tipado). UI append local; zero `router.refresh`.

---

## Como medir

1. Chrome DevTools → Network: ao trocar tabs, **nao** deve haver novo document request do home durante 30s.
2. Feed em idle: so requests a `/api/feed/check` (~1 row), nao `/api/feed` completo.
3. Like: zero request a `/home` ou RSC flight; so insert/delete em `likes`.
4. Lighthouse / Web Vitals: LCP do feed com media < 2.5s em 4G.
