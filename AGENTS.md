# AGENTS.md — Pulse

**Documento operacional para agentes de IA (Grok 4.5 e equivalentes)**
Última atualização: 18/07/2026
Documento-mãe (visão de produto, decisões, arquitetura): `PULSE_VISAO_PRODUTO.md`

---

## 0. Leia isto primeiro

Este ficheiro não substitui `PULSE_VISAO_PRODUTO.md` — trabalha em conjunto com ele.

- `PULSE_VISAO_PRODUTO.md` = **o quê** e **porquê** (visão, decisões de produto, segurança, stack).
- `AGENTS.md` (este ficheiro) = **como** trabalhar nele: papéis, protocolo, regras de execução.

**Regra inegociável nº 1:** nenhum agente implementa nada que contradiga `PULSE_VISAO_PRODUTO.md` sem primeiro sinalizar o conflito ao humano responsável (Mallony). Este documento é a constituição do produto. Discordar dele é motivo de pausa, não de decisão silenciosa.

**Regra inegociável nº 2:** antes de qualquer tarefa — implementar feature, alterar schema, desenhar UI — o agente responsável consulta `PULSE_VISAO_PRODUTO.md` na seção relevante. Se a seção não existir ou for ambígua, o agente pergunta antes de assumir.

---

## 1. Identidade do projeto

**Nome:** Pulse
**O que é:** a camada social das universidades — não uma rede social genérica para estudantes. Ler seção 2 de `PULSE_VISAO_PRODUTO.md` antes de tomar qualquer decisão de produto.

**Stack (fixa, não renegociável sem aprovação explícita):**
- Next.js + TypeScript + Tailwind CSS, como PWA
- Supabase (Postgres + Auth + Storage + Realtime), local via CLI em desenvolvimento, remoto em produção
- RLS (Row Level Security) como linha de defesa primária — não é opcional, não é "para depois"

**Lançamento:** fechado, multi-campus dentro da universidade-piloto (Xai-Xai, Maxixe, Massinga, Manhiça) antes de qualquer expansão.

---

## 2. Sistema multi-agente

O trabalho é dividido em papéis especializados. Cada agente tem escopo definido e não ultrapassa a fronteira de outro sem coordenação explícita. Isto evita que um agente "resolva tudo sozinho" de forma inconsistente — o mesmo princípio de separação de responsabilidades aplicado à equipa de IA.

### 2.1. Agente de Produto & Arquitetura (guardião da visão)
**Responsabilidade:** validar que qualquer proposta de implementação está alinhada com `PULSE_VISAO_PRODUTO.md`. É o primeiro a ser consultado antes de qualquer feature nova.
**Consulta obrigatória:** todo o documento-mãe, com foco nas seções 2–10 (visão, princípios, tipos de conta, destaque, identidade/confiança).
**Autoridade:** pode bloquear implementação que desvie da visão (ex: categorização de post, verificação forçada, feeds múltiplos) mesmo que tecnicamente correta.
**Não faz:** não escreve código de produção, não desenha schema.

### 2.2. Agente de Base de Dados & Segurança
**Responsabilidade:** schema Postgres, migrations, RLS policies, rate limiting, tudo listado na seção 12 do documento-mãe.
**Consulta obrigatória:** seções 11 (stack) e 12 (segurança) inteiras, sem atalhos.
**Regra de ouro:** nenhuma tabela é criada sem RLS policy escrita no mesmo commit. Nenhuma policy é escrita sem ser testada com pelo menos dois perfis diferentes (dono vs. terceiro; conta pública vs. privada).
**Entrega:** ficheiros de migration versionados, nunca alteração manual direta em produção.

### 2.3. Agente de Frontend & Design
**Responsabilidade:** implementação de UI/UX — onboarding, feed, perfil, explorar, mensagens, postar.
**Consulta obrigatória:** seções 3 (princípios de design), 8 (navegação), 9 (fluxos), e a estrutura de perfil detalhada.
**Regras de design não-negociáveis (herdadas da filosofia Orbion):**
  - Zero emojis decorativos — em nenhum lugar: copy, commits, mensagens de sistema, documentação
  - Zero ícones genéricos de stock — usar sempre a mesma biblioteca séria (ex: Lucide, Heroicons), nunca misturar
  - Zero texto de preenchimento ("Lorem ipsum", placeholders óbvios de IA)
  - Copy sempre madura e mínima — nunca explicar o que o design já comunica sozinho. Referência de tom: Instagram, Linear, Notion, Apple, não tutorial para leigos
  - Publicação sempre limpa — nunca tom de aviso institucional
  - Feed único, sem abas de conteúdo separadas
  - Metadado de perfil (curso, campus, ano) nunca aparece dentro do post — só no perfil
**Referência de padrão de qualidade:** nível Apple/Instagram — se parecer genérico ou "gerado", está errado, refazer.

### 2.4. Agente de Backend & API
**Responsabilidade:** integração com Supabase client, lógica de autenticação (telefone sem SMS), lógica de destaque de post, sistema de follow/mensagens.
**Consulta obrigatória:** seção 5 (sistema de destaque), 6 (identidade/confiança), 7 (login/recuperação), 12.1–12.3 (autenticação, RLS, anti-abuso).
**Regra de ouro:** toda lógica de autorização crítica vive em RLS (banco), nunca só em código de aplicação. O backend assume que o frontend pode ser contornado.

### 2.5. Agente de QA & Revisão
**Responsabilidade:** revisar cada entrega dos outros agentes contra a checklist da seção 4 antes de considerar algo "pronto".
**Pergunta padrão em toda revisão:** "quem pode ver isto, quem pode alterar isto, o que impede abuso disto, isto está no documento-mãe ou foi inventado agora?"
**Autoridade:** pode devolver trabalho para qualquer agente se a resposta a essas perguntas não for clara.

---

## 3. Protocolo de trabalho

1. **Toda tarefa nova começa pela consulta ao documento-mãe.** Se a informação não está lá, o agente registra a lacuna e pergunta ao humano — não assume.
2. **Debate antes de implementar.** Decisões de arquitetura ou produto são discutidas e resolvidas antes de qualquer código ser escrito. Nenhum ficheiro é alterado durante discussão estratégica, salvo pedido explícito.
3. **Nenhuma feature nova sem passar pelo Agente de Produto & Arquitetura primeiro.**
4. **Nenhuma tabela/policy nova sem passar pelo Agente de Base de Dados & Segurança.**
5. **Nenhuma entrega é considerada finalizada sem passar pelo Agente de QA & Revisão.**
6. **Registo de decisões:** toda decisão relevante tomada durante o desenvolvimento é adicionada à seção "Estado Atual" deste ficheiro (seção 6), não perdida em conversa.
7. **Escopo da v1 é fixo.** Marketplace, verificação de identidade formal, e categorização de tipo de post estão explicitamente fora da v1 (seção 10 do documento-mãe). Nenhum agente implementa "por adiantado" essas funcionalidades, mesmo que pareça simples.

---

## 4. Checklist de revisão (usar em toda entrega)

Antes de marcar qualquer funcionalidade como concluída, responder:

- [ ] Está alinhado com a visão em `PULSE_VISAO_PRODUTO.md`? (seção correspondente citada)
- [ ] RLS policy existe e foi testada com múltiplos perfis?
- [ ] Rate limiting aplicado, se envolver criação de conteúdo/conta?
- [ ] Input de usuário sanitizado (proteção XSS)?
- [ ] Segredos/chaves nunca expostos no frontend?
- [ ] Design segue os princípios da seção 2.3 (zero emoji, zero genérico, zero preenchimento)?
- [ ] Se envolve dado sensível de perfil (curso, campus, privacidade): é opcional e o usuário controla a visibilidade?
- [ ] A funcionalidade está dentro do escopo da v1, ou é algo adiado (seção 10 do documento-mãe) sendo implementado cedo demais?

Qualquer "não" ou "não sei" nesta lista = tarefa volta para o agente responsável, não avança.

---

## 5. Uso de skills e ferramentas avançadas

- Sempre que uma tarefa tiver skill/ferramenta especializada disponível (ex: geração de schema, geração de componentes de UI, testes automatizados, análise de segurança), o agente deve usá-la em vez de reinventar manualmente.
- Migrations do Supabase: usar sempre CLI (`supabase migration new`, `supabase db push`) — nunca escrever SQL solto fora do fluxo de migration.
- Componentes de UI reutilizáveis (botões, cards, inputs) devem ser centralizados — não duplicar implementação entre telas.
- Testes de RLS devem ser escritos como parte da entrega da feature, não como tarefa separada "para depois".

---

## 6. Estado Atual

*(Seção viva — cada sessão de trabalho atualiza isto com o que foi decidido/implementado.)*

**Última atualização:** 22/07/2026 (fluidez / cache / poll leve)

- [x] Visão de produto e decisões estratégicas fechadas — ver `PULSE_VISAO_PRODUTO.md`
- [x] Stack definida: Next.js + TypeScript + Tailwind (PWA) + Supabase
- [x] Estrutura de segurança e RLS mapeada (seção 12 do documento-mãe)
- [x] Estrutura de perfil desenhada (topo + abas: publicações / portfólio)
- [x] Algoritmo de ranking do feed — desenhado (afinidade, frescor, engajamento normalizado, destaque)
- [x] Schema de dados especificado — `docs/SCHEMA.md` + migrations em `supabase/migrations/`
- [x] Scaffold app: Next.js App Router, shell de navegação, auth UI, clientes Supabase
- [x] `ENGINEERING_CONSTITUTION.md` criado
- [x] Supabase remoto ligado (`uwqvkrmqauvlvzvjeecb`) + credenciais em `.env.local`
- [x] Migrations aplicadas na base remota (schema_migrations + RLS)
- [x] Auth telefone end-to-end (sem SMS): signup via `/api/auth/signup` + login + rate limit
- [x] Perfil real + perfil publico `/u/[username]` + Seguir (Seguir/Solicitado/A seguir)
- [x] Publicar texto + **fotos** (Storage post-media, preview IG)
- [x] Feed com anatomia IG/FB: media, caption, gosto, comentarios (`/p/[id]`)
- [x] Onboarding `/onboarding/seguir` (sugestoes campus/curso/uni, skip permitido)
- [x] Explorar: segmentos Contas | Publicacoes
- [x] Padroes UX documentados em `docs/UX_PATTERNS.md` (inspiracao IG+FB)
- [x] Privada→publica aceita pedidos pendentes (metodo Instagram)
- [x] Pedidos de follow: Notificacoes com Confirmar | Eliminar
- [x] Mensagens 1:1: inbox, thread, bolhas, abrir de perfil; RPC `get_or_create_dm`
- [x] Chat premium (docs/UX_CHAT.md): reply, reacoes, anexos, stickers, soft-delete, realtime, envio optimista, lightbox, inbox com hora/preview
- [x] Publicacoes: texto longo (clamp + mais), carousel fotos (dots/swipe), detalhe expandido
- [x] Comentarios em arvore (1 nivel de reply, flatten no 2º) + gostos em comentarios
- [x] Perfil: abas **Publicacoes** + **Portfolio** sempre visiveis; estados vazios independentes; grade IG + cartoes de projeto
- [x] Foto de perfil: proprio → sheet Ver/Alterar; terceiro → lightbox directo
- [x] Estetica elevada (Apple-like surfaces/type) — docs/UX_PUBLICACOES.md; nao clonar IG
- [x] Definicoes estilo Apple Settings (grupos Conta/Privacidade/Notificacoes/Seguranca/Dados/Sobre)
- [x] Modo profissional: fluxo 3 ecrãs + `professional_requests` + RLS + trigger `account_type` na aprovacao (admin via Table Editor)
- [x] Feed: cabecalho sem @username; nome 1 linha truncate; icone seguir (UserPlus); menu sem seguir
- [x] Signup: username sugerido do nome + disponibilidade debounce + variacoes; pontos permitidos (migration)
- [x] Chat composer estilo WA: + anexos, emoji no campo, mic⇄enviar morph
- [x] Chat imagens full-bleed (sem moldura azul); hora overlay; grelha gap 1px
- [x] Selo de verificacao: badge IG (roseta gradiente azul-roxo); self-serve **Em breve**; activacao manual no Supabase (`profiles.is_verified`); ranking nunca usa is_verified
- [~] Fluxo pago M-Pesa / 5 ecras: adiado (futuro)
- [x] Mencoes @: autocomplete (lista + filtro) no compose e comentarios; @handle clicavel
- [x] Removido painel "Administradores" do perfil (desorganizado; multi-admin adiado)
- [x] PWA completo: manifest multi-icon + maskable, SW v3 (cache strategies), install/update UI, offline page, tema light/dark, a11y zoom + skip link — ver `docs/PWA.md`
- [x] Links de perfil (ate 5) + auto-link em posts + OG preview cacheado no publish
- [x] Notificacoes: tabela + prefs + agregacao curtidas + badge realtime 9+ + marcar lidas
- [x] Comentarios: profundidade visual max 2 + "Respondendo a @x" + ver mais respostas
- [x] Ranking do feed (§15): afinidade + frescor + eng normalizado + destaque teto; pesos em config/ranking.json; spacing autor; shadow reports; privado via RLS
- [x] Auditoria de seguranca + remediacao P0/P1 (`20260718250000_security_harden.sql`):
  - REVOKE EXECUTE em activate/apply/revoke_verification (so service_role)
  - Storage SELECT: post-media via can_view_post; chat-media via participante
  - Pagamento simulado bloqueado em producao por omissao
  - SSRF guard em link-preview; CSP + security headers
  - Username-check sem service_role; step-up password em apagar conta
  - Senha min 8 + blocklist; rate-limit prune; logs JSON de eventos
- [x] Fluidez nativa (padrao grandes apps) — ver `docs/PERFORMANCE.md`:
  - Client Router Cache `staleTimes` (dynamic 30s / static 180s)
  - Snapshot do feed (`feed-cache.ts`: memoria + sessionStorage, soft 45s)
  - Poll leve `/api/feed/check` (1 row) + full fetch so com id novo
  - Ack de heads rankeados fora do topo (evita full-fetch em loop)
  - Acoes sociais optimistas sem `router.refresh` (like, follow, pedidos, comentarios, settings)
  - Badges: mensagens realtime + poll 90s; notificacoes realtime
  - Compressao de imagens no cliente (ja em main anterior)
- [x] Migration `20260721223000_workspaces.sql` aplicada na base remota e registada em `schema_migrations` (estava em falta; `npm run build` falhava por dessincronia entre schema real e tipos)
- [x] Erros de build/typecheck do feature workspaces corrigidos (`perfil/page.tsx`, `u/[username]/page.tsx`, `w/[id]/apagar`, `w/[id]/editar`, `w/new`, `workspace-card.tsx`, `lib/workspaces/lib.ts`) — `tsc --noEmit` e `next build` limpos
- [x] Selo de verificacao unificado: badge (roseta 8 pontas, azul solido `#2196F3`, sem gradiente) agora tambem aparece em **comentarios** (faltava `is_verified`/`verified_type` na query de `p/[id]` e render em `comment-thread.tsx`); mesmo componente `VerifiedBadge` em todos os call-sites — ver `docs/UX_VERIFICACAO.md`
- [x] `PulseLoader` (feedback visual — item 3/5 da spec de UX): componente unico de "processando" substitui `Spinner`/`Loader2` e `RefreshCw` com `animate-spin`; `ui/spinner.tsx` removido (sem uso). Ver secao 6.1 abaixo antes de adicionar qualquer novo estado de loading a um botao/CTA.
- [x] Avatar fallback (item 4/5 da spec de UX): hash deterministico de tom por `userId` (`avatarFallbackTone` em `lib/profile/avatar.ts`) unifica as 4 implementacoes duplicadas de "inicial + circulo cinza" (`user-avatar.tsx`, `profile-avatar.tsx`, `avatar-picker.tsx`, `suggest-follows.tsx` — este ultimo passou a usar `UserAvatar` de vez, em vez de `<div>` inline). Ver secao 6.2 abaixo antes de criar qualquer novo lugar com fallback de avatar.
- [ ] CRUD de projetos no Portfolio (UI de criacao/edicao)
- [ ] Rate limit distribuido (Redis/Upstash) multi-instancia
- [ ] Webhook M-Pesa real (substituir sim)
- [x] Decisao de posicionamento de marca (24/07/2026): a copy do produto deixa de se apresentar como "ferramenta de universidade" e passa a falar como comunidade de pessoas — conexoes, ideias, conversas, oportunidades. **Isto e mudanca de linguagem/copy, nao de escopo tecnico**: schema, RLS, universidade-piloto, feed unico e stack continuam exactamente como em `PULSE_VISAO_PRODUTO.md`. Guia de voz completo em `docs/UX_VOICE.md` (secao 0 explica o limite exacto da mudanca). Nenhuma feature nova (ex.: "Comunidades") foi aprovada por esta decisao — aplicacao de copy ainda pendente, string por string, sob checklist §4.

- [x] `docs/UX_VOICE.md` aplicado ao codigo (24/07/2026): onboarding, compose, comentarios, feed vazio, perfil (bio/links/publicacoes), mensagens, notificacoes, definicoes (permissao DM), erros de auth e erros genericos de accao. So trocas de string literal, nenhuma logica/estrutura alterada. Excepcoes deliberadas mantidas fora do tom "vivo" (guia secao 6): mensagens de seguranca/RLS, contas bloqueadas, apagar conta.
- [x] Identidade visual — Pulse Blue (24/07/2026): substitui laranja/amber (`#FF9F0A`) como cor de marca dominante por azul profundo (`#2563EB`, escala Tailwind `blue`), reservando amber (`#F59E0B`/`#B45309` no claro) so para badges de conquista/reconhecimento. Ver `docs/BRAND_IDENTITY.md` para estrategia completa, escalas, tokens, aplicacao por superficie e validacao WCAG. Decisoes que desbloquearam a implementacao: (1) laranja→azul confirmado; (2) app mantem os dois modos (claro/escuro), dark passa a ser a identidade primaria de marca; (3) selo de verificacao **mantem-se** em `#2196F3`, deliberadamente separado da cor de marca — nao migrou. Implementado so em `src/app/globals.css` (tokens centrais, `@theme inline`); nenhum componente tinha hex hardcoded, todos os call-sites (`ring-brand`, `.tab-indicator`, `.shadow-brand`, `PulseLoader`, CTAs listados em §6.1) herdam a troca automaticamente. Build (`next build`) e `tsc --noEmit` limpos apos a mudanca. Achado de QA sinalizado, nao corrigido nesta entrega: coracao de "gostar" usa `text-brand` no feed principal (`post-actions.tsx`) mas `text-destructive` em comentarios (`comment-thread.tsx`) — inconsistencia pre-existente, decisao de produto pendente (ver `docs/BRAND_IDENTITY.md` §7.2).

- [x] Polimento de UI — feed/icones (24/07/2026), ver `docs/UX_ICONOGRAPHY.md`:
  - Media do feed corrigida para respeitar de facto o aspect-ratio fixo 4:5 prometido em `docs/UX_PUBLICACOES.md` §2 — antes, uma foto unica usava `max-h-[70vh]` com altura livre (o feed "saltava" ao carregar fotos com proporcoes diferentes, contradizendo o proprio documento). Carousel multi-foto tambem usava `object-cover` (corta) num slide, inconsistente com `object-contain` da foto unica — unificado.
  - Placeholder de loading de foto (`media-frame.tsx`) trocado de spinner generico `animate-spin` para `skeleton-shimmer` — mesma disciplina ja aplicada a `PulseLoader` em botoes (§6.1), agora tambem em media.
  - Cor do coracao de "gostar" unificada em `text-destructive`/`fill-destructive` (vermelho) no feed principal e em comentarios — antes usava `text-brand` (azul) no feed mas vermelho em comentarios. Decisao registada em `docs/UX_ICONOGRAPHY.md` §4: like e convencao universal de plataforma, nao acao de marca.
  - Sistema formal de icones: escala de 4 tamanhos (`xs`14/`sm`18/`md`20/`lg`24) e 2 pesos de traco (`1.5` repouso, `2` ativo/tamanho minusculo) — substitui valores arbitrarios em pixel (`h-[17px]`, `h-[22px]`) e `strokeWidth` intermedios sem funcao (`1.75`, `2.5`) encontrados em 15+ call-sites (chat, onboarding, pwa, avatar picker). Excecao documentada e preservada: tile 29px/icone 17px do ecra de Definicoes (`settings-row.tsx` e correlatos) — subsistema proprio, consistente entre si, nao migrado.
  - Header do post: nome ganhou linha propria (antes partilhava linha com selo, badge "Destaque" e timestamp, todos espremidos); badge "Destaque" passou de texto solto cinza para pill em Amber (`bg-brand-accent-soft`/`text-brand-accent`) — primeiro uso real do token de accent reservado a "badge/conquista" em `docs/BRAND_IDENTITY.md`.
  - Novo token `--brand-accent-soft` (fundo suave do accent, dark e light) adicionado a `globals.css` para suportar o pill acima e qualquer badge futuro do mesmo tipo.
  - Build (`next build`), `tsc --noEmit` e `eslint` limpos — zero avisos novos comparado ao estado anterior.

- [x] Escrita/UX debt no preview (`feat/design-polish-feed`, 25/07/2026, commit `beaef8a`):
  - `PasswordInput` reutilizavel (`src/components/ui/password-input.tsx`, lucide `Eye`/`EyeOff`) — todo `type="password"` cru (login/signup, `password-form.tsx`, `delete-account-form.tsx`) passou a usar este componente. Qualquer novo campo de senha deve usa-lo, nunca reintroduzir `<input type="password">` a mao.
  - Recuperacao de senha por link (§7 do documento-mae) estava totalmente ausente — so a rota `/recuperar` era referenciada no middleware, nunca implementada. Agora: `ForgotPasswordForm` (`/recuperar`) chama `resetPasswordForEmail` sem nunca revelar se o e-mail existe; `ResetPasswordForm` (`/recuperar/nova-senha`) espera o evento `PASSWORD_RECOVERY` do Supabase antes de mostrar o formulario de nova senha, e trata link expirado/invalido explicitamente. Link "Esqueceste-te?" adicionado ao login.
  - Onboarding "Onde estudas": placeholder do campus deixou de citar Xai-Xai/Maxixe (cidades da universidade-piloto hardcoded na copy, contra a decisao de posicionamento de 24/07 em `docs/UX_VOICE.md`) — campo volta a ser generico.
  - `tsc --noEmit`, `next build` e a suite de 36 testes limpos apos a mudanca.

**Próxima decisão pendente:** o "maior problema, foco da missao" ainda a discutir com o humano — CRUD portfolio, virtualizacao do feed, e activity nas notificacoes continuam na fila.

### 6.3. Identidade visual — Pulse Blue (substitui a secao de cor descrita implicitamente em 6.1/6.2)

**Onde:** `src/app/globals.css` (fonte de verdade unica dos tokens de cor) + `docs/BRAND_IDENTITY.md` (estrategia, escalas, validacao). **Nunca** hardcodar um hex de marca num componente — consumir sempre `var(--brand)`, `var(--brand-secondary)`, `var(--brand-accent)` ou as classes Tailwind equivalentes (`text-brand`, `bg-brand`, etc. via `@theme inline`).

- `brand.primary` = Pulse Blue `#2563EB` nos dois modos — usar como **superficie** (botao, borda de foco, badge preenchido); nunca como cor de texto direto sobre fundo escuro (falha AA, 3.62:1 — ver validacao no documento).
- `brand.secondary` = link/texto interativo — Sky Blue `#38BDF8` no dark (8.74:1 AAA), Sky `#0369A1` no light (5.67–5.93:1) porque o passo 400 falha contraste em fundo claro.
- `brand.accent` = Amber, reservado exclusivamente a badge/conquista/reconhecimento — nunca chrome do dia a dia. `#F59E0B` no dark, `#B45309` no light (mesmo motivo de contraste do secondary). Texto/icone sobre um preenchimento de accent e sempre escuro (`#0B1220`/`#0F172A`), nunca branco — branco sobre amber falha (2.05:1).
- Selo de verificacao (`VerifiedBadge`, `#2196F3`) e uma excecao deliberada e **nao** consome `--brand` — nao alterar isso ao tocar em cor de marca.
- Antes de adicionar qualquer nova superficie colorida (ex. badge de comunidade, se/quando aprovado), consultar `docs/BRAND_IDENTITY.md` secao 5 (aplicacao por superficie) — nao inventar um uso novo de cor sem checar o papel narrativo ja definido para cada token.

### 6.1. `PulseLoader` — padrão único de "processando"

**Onde:** `src/components/ui/pulse-loader.tsx`. **Nunca** reintroduzir `Loader2`/`animate-spin` genérico num botão/CTA — usar este componente.

- Visual: ponto laranja `--brand` (`#FF9F0A`) com "sonar" (scale 1→1.8, opacity 1→0, loop ~1.2s, dois anéis defasados). CSS puro em `globals.css` (`.pulse-loader`), sem lib de animação.
- `size="sm"` (16px, uso em botão/linha de texto) ou `size="md"` (24px).
- `tone="brand"` (default) — pinta laranja; usar em qualquer superfície neutra/escura (`bg-accent`, `bg-muted`, texto solto).
- `tone="on-brand"` — herda `currentColor` do texto do botão; usar **apenas** quando o próprio botão já é `bg-brand` (para não pintar laranja sobre laranja — `text-brand-foreground` do tema é preto, então o ponto sai preto ali, coerente com o próprio texto do botão).
- Debounce de ~180ms embutido no componente: acções que resolvem rápido (ex.: follow optimista) nunca chegam a mostrar o loader. Chamadores não precisam de nenhum debounce próprio — só decidir `loading`/`pending` como já fazem.
- Respeita `prefers-reduced-motion` via regra global já existente em `globals.css` (colapsa a animação, fica como ponto estático — estado de repouso aceitável).
- **Excepção deliberada:** `settings/delete-account-form.tsx` ("Apagar conta permanentemente") não usa `PulseLoader` — acção destrutiva/irreversível não deve herdar a assinatura "viva" da marca; mantém-se só o texto "A apagar...".
- Call-sites actuais: `follow-button.tsx`, `compose-form.tsx`, `comment-thread.tsx`, `auth-form.tsx`, `edit-profile-form.tsx`, `password-form.tsx`, `recovery-email-form.tsx`, `professional-flow.tsx`, `profile-avatar.tsx`, `onboarding-flow.tsx` (`PrimaryButton` prop `loading`), `offline/page.tsx`.
- Fora de escopo deste componente (fica para o Skeleton — item 2/5): loading de **lista** (`people-suggestions.tsx`, `sessions-panel.tsx`) e loading de **asset de mídia** dentro de um post (`media-frame.tsx`). Não substituir esses por `PulseLoader` — misturar skeleton com pulse loader na mesma acção quebra a hierarquia de feedback visual da spec.

### 6.2. Avatar fallback — tom por utilizador, sem paleta nova

**Onde:** `avatarFallbackTone(userId)` em `src/lib/profile/avatar.ts`. Usar **sempre** que um avatar sem foto precisar de um fundo — nunca reintroduzir `bg-muted text-muted-foreground` à mão.

- Hash determinístico do `userId` (não criptográfico, só precisa de distribuição razoável) escolhe 1 de 8 tons dentro da escala **neutra existente** (`bg-foreground/N text-foreground/N`, opacidades diferentes do mesmo `--foreground`). Mesma pessoa = sempre o mesmo tom; nenhuma cor nova entra no design system (decisão deliberada: a spec original pedia "hash de cor", mas a regra da secção 2.3 proíbe paleta nova — resolvido com variações tonais dentro da escala já usada em `search-bar.tsx`/`page-header.tsx`, não com uma paleta vibrante estilo Slack).
- Fonte de verdade visual é `UserAvatar` (`components/profile/user-avatar.tsx`) — qualquer lista de pessoas deve usar este componente, nunca duplicar `bg-muted` + inicial `.slice(0,1)` `.toUpperCase()` de novo.
- `profile-avatar.tsx` e `avatar-picker.tsx` têm UI própria (upload/preview local, sheet, lápis de câmera) que não cabe dentro de `UserAvatar`, por isso mantêm markup próprio — mas chamam `avatarFallbackTone` directamente para o mesmo tom, nunca reinventam a paleta.

**Workspace de dev:** preferir `/tmp/pulse-dev` (disco rapido). `/mnt/sdcard/grok/pulse` e lento e pode ter WIP local (ex. workspaces) fora do GitHub. Chaves so em `.env.local` (nunca commit).

**Admin — aprovar modo profissional:** Table Editor → `professional_requests` → `status` = `approved` (ou `rejected`). Trigger promove `profiles.account_type` para `organizacao`.

**Nota de ambiente:** filesystem do workspace pode não suportar symlinks — usar `npm install --no-bin-links` e scripts que invocam `node node_modules/next/dist/bin/next`. Runtime recomendado: `/tmp/pulse-dev`. Ligação Postgres directa pode falhar (IPv6); pooler session (`aws-0-eu-central-1.pooler.supabase.com:5432`) funciona.

**Seguranca:** `service_role` e `DATABASE_URL` so em `.env.local` / scripts servidor — nunca `NEXT_PUBLIC_*`. Credenciais expostas em chat: rodar password/API keys no dashboard quando conveniente.

**Verificacao (agora):** UI = "Em breve". Selo so manual no Supabase: `profiles.is_verified = true` (+ opcional `verified_type`, `verified_at`, `verification_expires_at`). Self-serve/M-Pesa fica para mais tarde.

---

## 7. O que nenhum agente deve fazer, sob nenhuma circunstância

- Implementar verificação de identidade **gratuita/forçada** no cadastro. Selo pago opcional (Meta Verified) e permitido — ver secao 6 actualizada.
- Criar categorias/tipos de publicação (post continua sendo um único formato: texto, foto(s), ou ambos).
- Expor `service_role key` do Supabase no cliente.
- Criar tabela sem RLS.
- Adicionar metadado de perfil (curso, campus, ano) dentro da estrutura do post.
- Implementar marketplace ou qualquer funcionalidade de compra/venda na v1.
- Escrever copy explicativa e óbvia (ex: instruções que o próprio design já comunica). Copy deve ter nível de Instagram/Linear/Notion/Apple — direto, mínimo, nunca "para leigos".
- Usar emojis em qualquer parte — copy, commits, documentação, mensagens de sistema.
- Usar ícones genéricos, coloridos ou fora de uma biblioteca séria e consistente (ex: Lucide, Heroicons).
- Tomar decisão de produto que contradiga a visão do documento-mãe sem escalar para o humano primeiro.
