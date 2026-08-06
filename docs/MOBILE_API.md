# Pulse Mobile — BFF API contract

Base URL: Next deployment origin.  
Auth: `Authorization: Bearer <supabase_access_token>`.

## `GET /api/feed`

| Param | Type | Default |
|-------|------|---------|
| `offset` | int ≥ 0 | 0 |
| `limit` | int 1–30 | 15 |
| `scope` | `all` \| `temporarias` | `all` |
| `authorId` | uuid optional | — |

**200:** `{ "posts": PostWithAuthor[], "nextOffset": number|null }`  
Personalized: `Cache-Control: private, no-store`. Client owns soft/hard TTL.

## `GET /api/feed/check`

| Param | Type |
|-------|------|
| `scope` | `all` \| `temporarias` |

**200:** `{ "latestId": "<uuid>|null" }`

## Auth for BFF

1. Sign in via `supabase_flutter`  
2. Use `session.accessToken` as Bearer  
3. On 401: refresh once; else force login  

Never ship the service role key in the app.
