# Performance — caminho para fluidez nativa

## Implementado

| Area | Mudanca |
|------|---------|
| Feed media | `createSignedUrls` em batch + cache em memoria |
| Feed payload | `likes(count)` / `comments(count)` em vez de todas as rows |
| Feed liked_by_me | Query unica `likes` do viewer |
| Feed first paint | 15 posts + infinite scroll `/api/feed` |
| Like / comment-like | Optimistic, **sem** `router.refresh` |
| Imagens | `loading=lazy` + `decoding=async` |
| Scroll | Restaura posicao ao voltar do detalhe do post |
| Tabs | Prefetch rotas primarias |
| Chat | Ultimas 50 msgs; anexos assinados em batch |
| PWA | Service worker so assets estaticos (shell) |
| CSS | overscroll + view transitions suaves |

## Nao tocado (de proposito)

- RLS e policies
- Ranking do feed / verified
- Auth middleware (getUser continua)
- Design system / copy

## Proximos (se ainda houver jank)

- Virtualizar feed/chat
- Thumbnails no upload
- Contadores materializados no Postgres
