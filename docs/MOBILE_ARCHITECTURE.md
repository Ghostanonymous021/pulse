# Pulse Mobile (Flutter) — Architecture

**Status:** Phase 0 foundation  
**Client path:** `mobile/`  
**Backend of truth:** Supabase (Auth, Postgres+RLS, Storage, Realtime) + Next.js `/api/*` BFF for privileged logic.

## Principles

1. Flutter is a **client**, not the authority for ranking, signup limits, media pipeline, or SSRF-safe previews.
2. The web/PWA app remains in production until mobile reaches parity on auth + feed + compose.
3. Domain rules enforced by RLS stay in Postgres; do not re-implement security only in Dart.
4. Feed ranking stays on the server (`/api/feed`). The app consumes ranked pages and applies local cache only.

## Layering (`mobile/lib`)

```
presentation  →  features/*/presentation
data          →  features/*/data
core          →  config, theme, router
```

## Dependencies (Phase 0–1)

| Package | Role |
|---------|------|
| `supabase_flutter` | Auth, RLS queries, Realtime, Storage |
| `flutter_riverpod` | State / DI |
| `go_router` | Auth redirects, deep links |
| `http` | BFF (`/api/feed`, `/api/feed/check`, …) with user JWT |

## Server boundary

| Concern | Where |
|---------|--------|
| Ranked feed | `GET /api/feed` |
| Novelty probe | `GET /api/feed/check` |
| Signup hardening | `POST /api/auth/signup` |
| Media pipeline | `/api/posts/process-media` |
| Link previews | `/api/posts/link-previews` |
| CRUD under RLS | Supabase client in app |
| Ranking formula | `src/lib/ranking/*` on server only |

## Phases

0. Foundation — project, theme, router, feed DTOs, docs  
1. Auth end-to-end  
2. Feed read + local snapshot cache  
3. Social + compose  
4. Chat  
5. Settings / verification / workspaces  
6. Store hardening (push, crash reporting)

## Non-goals (Phase 0)

- Feature parity with web  
- Capacitor  
- Client-side ranking as sole authority  
