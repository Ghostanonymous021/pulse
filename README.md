# Pulse

A camada social das universidades.

## Documentos

| Ficheiro | Conteudo |
|----------|----------|
| `PULSE_VISAO_PRODUTO.md` | Visao, decisoes de produto, seguranca, stack |
| `AGENTS.md` | Protocolo multi-agente e estado atual |
| `ENGINEERING_CONSTITUTION.md` | Regras nao-negociaveis de engenharia |
| `docs/SCHEMA.md` | Schema de dados e politicas RLS |

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS — PWA
- Supabase (Postgres + Auth + Storage + Realtime)
- Capacitor (contentor nativo da origem web — `docs/NATIVE.md`)

## Arranque

```bash
cp .env.example .env.local
# Preencher NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY

npm install
npm run dev
```

### Ambiente com sdcard (sem symlink / noexec)

Se `npm install` falhar em symlinks ou o Next nao carregar o binario SWC (`failed to map segment from shared object`), correr a app a partir de um filesystem com exec (ex. `/tmp`):

```bash
rm -rf /tmp/pulse-dev
mkdir -p /tmp/pulse-dev
tar cf - --exclude=node_modules --exclude=.next --exclude=.git . \
  | (cd /tmp/pulse-dev && tar xf -)
cd /tmp/pulse-dev
# repor scripts com bins normais se necessario
npm install
npm run dev
```

Fonte de verdade do codigo: este repositorio. `/tmp/pulse-dev` e so runtime.

### Supabase local (Docker)

```bash
npx supabase start
npx supabase db reset   # aplica migrations em supabase/migrations
```

Se Docker nao estiver disponivel, usar projeto Supabase remoto gratuito e `supabase link` + `supabase db push`.

## Scripts

- `npm run dev` — desenvolvimento
- `npm run build` — build de producao
- `npm run start` — servir build
- `npm run lint` — ESLint

## Escopo v1

Feed unico, contas pessoa/organizacao, destaque limitado para organizacoes, DMs 1:1, perfil com publicacoes + portfolio. Fora: marketplace, verificacao formal, categorias de post.
