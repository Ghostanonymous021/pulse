# Iconografia — escala formal

**Status:** aplicado (24/07/2026).
**Motivo:** auditoria ao codigo encontrou `strokeWidth` a variar entre `1.5`/`1.75`/`2`/`2.5` e tamanhos arbitrarios em pixels (`h-[17px]`, `h-[18px]`, `h-[22px]`) misturados com classes Tailwind (`h-4`/`h-5`/`h-6`/`h-7`) sem nenhuma regra que explicasse a diferenca entre contextos equivalentes. Este e o tipo de deriva que faz um produto "com boa biblioteca de icones" ainda parecer feito a mao — cada plataforma seria (Instagram, Apple, Linear) usa exatamente o mesmo peso de traco dentro da mesma hierarquia, sem excecao visual perceptivel.

Biblioteca: **Lucide** (unica, ja decidido em `ENGINEERING_CONSTITUTION.md` §4 / `PULSE_VISAO_PRODUTO.md`). Este documento nao troca de biblioteca — formaliza como usa-la.

---

## 1. Escala de tamanho (4 niveis, nao 8)

| Nivel | Tamanho | Classe Tailwind | Uso |
|---|---|---|---|
| `xs` | 14px | `h-3.5 w-3.5` | Indicador dentro de linha de texto/metadado (tipo de media no preview de chat, icone de silenciado) |
| `sm` | 18px | `h-[18px] w-[18px]` (arbitrary — Tailwind nao tem passo nativo em 18; aceitavel porque e um **token de escala**, nao um valor solto) | Acao secundaria compacta (seguir dentro do post, X de fechar em sheet pequeno) |
| `md` | 20px | `h-5 w-5` | Acao primaria inline (like, comentar, menu de post, botao do header) — **default** para qualquer botao de acao no corpo do produto |
| `lg` | 24px | `h-6 w-6` | Navegacao principal (tab bar) — a maior hierarquia visual do chrome |

**Regra:** nenhum outro tamanho de icone entra no produto sem justificar em qual destes 4 niveis encaixa. Se nenhum nivel serve, o problema e provavelmente de layout, nao de icone.

### 1.2. Excecao deliberada e documentada: tile de Definicoes (Apple Settings)

`settings-row.tsx`, `sign-out-row.tsx`, `sign-out-all-row.tsx`, `sessions-panel.tsx` usam, de forma **consistente entre si**, um sub-sistema proprio: tile arredondado 29px (`rounded-[7px]`) com icone 17px centrado — a mesma proporcao icone/tile que a app Definicoes da Apple usa (ja documentado em `AGENTS.md` §6: "Definicoes estilo Apple Settings"). Isto **nao e inconsistencia** — e um padrao deliberado, aplicado sem excecao nos 4 ficheiros que o usam. Nao migrar para a escala de 4 niveis da secao 1; manter como sub-sistema proprio do ecra de Definicoes.

### 1.1. Mapeamento das inconsistencias encontradas

| Antes | Depois | Ficheiro |
|---|---|---|
| `h-[22px]` (sino de notificacao) | `md` (20px) | `notification-bell.tsx` |
| `h-[22px]` (like, comentar) | `md` (20px) | `post-actions.tsx` |
| `h-[18px]` (seguir, pendente) | `sm` (18px) — ja correto, mantido | `post-follow-icon.tsx` |
| `h-[17px]` (busca) | `sm` (18px) | `search-bar.tsx` |
| `h-5 w-5` no header (voltar, menu) | `md` (20px) — ja correto, mantido | `page-header.tsx`, `post-menu.tsx` |
| `h-6 w-6` na tab bar | `lg` (24px) — ja correto, mantido | `app-shell.tsx` |

---

## 2. Peso de traco (`strokeWidth`) — 2 niveis, nao 5

| Estado | `strokeWidth` | Uso |
|---|---|---|
| Padrao (repouso) | `1.5` | Todo icone, em todo lugar, por padrao |
| Ativo/preenchido/enfase | `2` | Apenas quando o icone representa um estado **ativo** (tab selecionada, checkbox marcado, confirmacao) — nunca por preferencia visual pontual |

**Removido do produto:** `1.75` e `2.5` como valores intermedios sem funcao clara. Auditoria encontrou 15+ call-sites em `1.75` (chat, onboarding, avatar picker, pwa) sem nenhuma diferenca de estado que justificasse nao ser `1.5`. Estes foram migrados para `1.5`. `2.5` sobrevive apenas onde o icone e literalmente um selo/confirmacao de alto contraste a tamanho minusculo (`xs`, ex. check de disponibilidade de username) — mesmo padrao usado por apps serios para "ticks" pequenos que precisam de legibilidade extra a 14px.

**Nunca** usar `strokeWidth={0}` (fill-only) fora de um icone que e deliberadamente um preenchimento solido (ex. estrela cheia) — nao usar como atalho para "parece mais ousado".

### 2.1. Excecao valida: legibilidade a tamanho `xs`

A `2` (em vez de `1.5`) tambem e aceitavel em icones a `xs` (14px) quando o traco fino se torna dificil de ler a esse tamanho — padrao comum em qualquer sistema de icones serio (ex. X de remover anexo, check de mensagem entregue, pin fixado, chevron dentro de botao pequeno). Isto **nao e excecao ad-hoc**: auditado e confirmado consistente em `compose-form.tsx`, `chat-composer.tsx`, `chat-view.tsx`, `inbox-list.tsx`, `search-bar.tsx`, `onboarding-flow.tsx` — todos os usos de `strokeWidth={2}` no produto sao `xs` (14px) ou representam estado ativo/confirmado (`dm-permission-form.tsx` check selecionado, `professional-flow.tsx` check de conclusao). Nenhuma migracao necessaria nestes; a regra de 2 niveis (§2) continua valida, com esta nuance documentada em vez de forcar inconsistencia visual em icones pequenos.

---

## 3. Cor

Icones consomem sempre os tokens de `globals.css`/`docs/BRAND_IDENTITY.md` — nunca hex. Estados:

- **Neutro (repouso):** `text-foreground` ou `text-muted-foreground`, conforme hierarquia (primario vs. secundario).
- **Ativo/marca:** `text-brand` — reservado a navegacao ativa e acoes que sao literalmente "acao de marca" (ver `docs/BRAND_IDENTITY.md` §5). Nao usar em like (ver §4 abaixo).
- **Semantico:** `text-destructive` (like, apagar, sair), `text-success` (confirmado) — nunca herdam `--brand`.

---

## 4. Achado de produto: cor do "gostar"

Auditoria encontrou o coracao de "gostar" com cor diferente em dois lugares do mesmo produto:

- Feed principal (`post-actions.tsx`): `fill-brand text-brand` (azul, apos a mudanca de marca).
- Comentarios (`comment-thread.tsx`): `fill-destructive text-destructive` (vermelho).

**Decisao (24/07/2026):** unificar em `text-destructive`/`fill-destructive` (vermelho) nos dois lugares. Motivo: "gostar" e uma convencao universal de plataforma (Instagram, Facebook, X, TikTok — todos usam vermelho no coracao preenchido), nao uma acao de marca do Pulse. Usar `--brand` no like colide com o principio de `docs/BRAND_IDENTITY.md` §2.4 ("azul e superficie de confianca/acao", nao "reacao emocional pontual") e criava a inconsistencia que este documento corrige. Aplicado em `post-actions.tsx`.

---

## 5. Checklist para qualquer icone novo

- [ ] Tamanho e um dos 4 niveis da secao 1 — nao um valor em pixel inventado na hora
- [ ] `strokeWidth` e `1.5` (repouso) ou `2` (ativo) — nunca outro valor sem justificar estado
- [ ] Cor vem de um token (`text-foreground`, `text-brand`, `text-destructive`, etc.), nunca hex solto
- [ ] Vem de Lucide — nunca outra biblioteca, nunca emoji como substituto de icone
