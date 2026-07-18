# Pulse — Progressive Web App

Documento de conformidade e operacao PWA (v1 instalavel).

## Arquitectura

| Camada | Implementacao |
|--------|----------------|
| Manifest | `public/manifest.webmanifest` |
| Service Worker | `public/sw.js` (versionado `pulse-pwa-v*`) |
| Registo / UX | `src/components/pwa-register.tsx` |
| Offline | `src/app/offline/page.tsx` + fallback SW |
| Icones | `public/icons/*` via `scripts/generate-pwa-icons.mjs` |
| Meta / SEO | `src/app/layout.tsx` |
| Headers / CSP | `next.config.ts` |

## Estrategias de cache

| Recurso | Estrategia | Justificativa |
|---------|------------|---------------|
| `/_next/static/*` | Cache First | Hash imutavel no build |
| Icones / PNG / WOFF2 | Cache First | Assets de marca estaveis |
| Manifest / `sw.js` | Stale-While-Revalidate | Actualizacao rapida do shell |
| Navegacoes HTML | Network First (4s) → offline | Conteudo autenticado fresco |
| `/api/*`, Supabase | Network only (sem SW) | Auth, RLS, dados privados |
| Media Range | Network only | Streaming / audio |

**Nunca** cacheia corpos de API autenticados no SW.

## Criterios de instalacao (Chrome / Edge / Samsung)

- [x] Servido em HTTPS (ou localhost)
- [x] Manifest com `name`, `icons` 192+512, `start_url`, `display` standalone
- [x] Service worker controlando a origem
- [x] Icones `any` + `maskable` separados
- [x] `beforeinstallprompt` capturado (banner Instalar)

iOS Safari: adicionar a ecran inicial via partilha; meta `apple-mobile-web-app-*` + `apple-touch-icon`.

## Tema

- CSS: `prefers-color-scheme` light/dark em `globals.css`
- `viewport.themeColor` dual
- `color-scheme: light dark`

## Performance (Next.js)

- Code splitting por rota (App Router)
- `optimizePackageImports: ["lucide-react"]`
- Fontes Google com `display: swap`
- `images.formats: avif, webp`
- Compressao `compress: true`
- Prefetch de tabs em `AppShell`
- Lazy `loading="lazy"` em media do feed

## Acessibilidade (WCAG 2.2 base)

- Zoom do viewport permitido
- Skip link “Saltar para o conteudo”
- `:focus-visible` reforçado
- `prefers-reduced-motion`
- Labels em dialogs de install/update

## Background Sync

SW escuta `sync` tag `pulse-sync` e notifica clients (`PULSE_BACKGROUND_SYNC`).  
Fila de drafts offline e futura — nao bloqueia instalacao.

## Actualizacao de versao

1. Novo deploy → novo `sw.js` / assets hash
2. SW `install` + cliente detecta `waiting`
3. Toast “Nova versao pronta” → `SKIP_WAITING` → `controllerchange` → reload

Bump `VERSION` em `public/sw.js` quando mudares a logica de cache.

## Build e deploy

```bash
# Icones
node scripts/generate-pwa-icons.mjs

# Build (gera icones + Next)
npm run build

# Producao
npm start
# ou: node node_modules/next/dist/bin/next start -H 0.0.0.0 -p 3000
```

Requisitos: HTTPS em producao, headers do SW `Service-Worker-Allowed: /`.

### Variaveis

```env
NEXT_PUBLIC_SITE_URL=https://teu-dominio.com
```

Usado em `metadataBase` (Open Graph / SEO).

## Checklist Lighthouse (alvo)

| Categoria | Notas |
|-----------|--------|
| PWA | Installable, SW, icons, offline |
| Performance | LCP via shell cache; imagens AVIF/WebP |
| Accessibility | Zoom, focus, contrast system tokens |
| Best Practices | HTTPS, CSP, no mixed content |
| SEO | title/description, lang=pt, robots offline |

## Melhorias futuras

1. Workbox / Serwist integrado no build (precache automatico do HTML shell)
2. Fila IndexedDB para posts offline + Background Sync real
3. Push notifications (Web Push + VAPID)
4. Screenshots no manifest (store-like install UI)
5. Periodic Background Sync para badge de mensagens
6. CSP sem `unsafe-eval` apos auditoria Next
7. Lighthouse CI no pipeline

## Testes manuais

1. Chrome DevTools → Application → Manifest (sem erros)
2. Service Workers → status activated
3. Offline checkbox → `/home` cai em `/offline` ou pagina em cache
4. Application → Install (ou banner in-app)
5. Deploy novo → toast Actualizar
