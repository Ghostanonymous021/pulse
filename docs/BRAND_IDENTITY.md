# Pulse — Identidade Visual e Sistema de Cor

**Status:** aprovado (24/07/2026) — implementado em `globals.css`. Ver secao 7 para o registo das 3 decisoes que desbloquearam a implementacao.
**Par com:** `PULSE_VISAO_PRODUTO.md`, `AGENTS.md`, `ENGINEERING_CONSTITUTION.md`
**Autor da direcao:** decisao de marca fornecida por Mallony (24/07/2026) — este documento formaliza e valida tecnicamente essa direcao, seguindo o protocolo `AGENTS.md` §3 ("debate antes de implementar").

---

## 1. Estrategia da identidade

### 1.1. Personalidade da marca

A Pulse deixa de comunicar "aplicativo universitario" e passa a comunicar **infraestrutura de reputacao e futuro profissional**. A visao do produto ja mudou a copy nesse sentido em 24/07/2026 (`docs/UX_VOICE.md`) — este sistema de cor e a consequencia visual da mesma decisao, nao uma mudanca isolada.

Tracos de personalidade, em ordem de prioridade:

1. **Confiavel** — cor que nao pisca, nao grita, nao exige atencao imediata.
2. **Competente** — paleta que parece projetada por gente que entende de produto, nao escolhida por gosto.
3. **Ambiciosa, mas contida** — energia existe (amber), mas e um acento, nunca o argumento principal.
4. **Pertencimento** — azul e a cor mais associada a confianca institucional (bancos, saude, tecnologia seria) sem ser fria como cinza puro.

### 1.2. Por que azul profundo, nao laranja

A identidade anterior (`--brand: #FF9F0A`, ver `AGENTS.md` §6.1/6.2 e `ENGINEERING_CONSTITUTION.md`) usava laranja/amber como cor dominante de marca — em `PulseLoader`, `ring-brand`, indicador de aba, sombra de CTA. Isso funcionava bem para "app vivo e caloroso", mas carrega associacao cultural forte com **entretenimento e urgencia** (delivery, notificacao, alerta). E o oposto do que "reputacao" e "futuro profissional" pedem.

Azul resolve isso porque:

- E a cor mais usada por produtos que vendem confianca institucional (LinkedIn, Stripe, Meta em contextos profissionais, a maioria dos bancos digitais).
- Nao compete com o vermelho/laranja usado universalmente para erro e alerta — reduz ambiguidade semantica na interface.
- Escala bem para dark mode sem perder legibilidade (comprovado na secao 6).

### 1.3. Direcoes descartadas

- **Manter laranja como dominante:** descartado — associa a marca a "app de campus" descartavel, nao a plataforma que carrega reputacao de longo prazo do usuario.
- **Verde como primaria:** descartado — verde already carrega semantica de "sucesso/dinheiro" (usado aqui em `status.success`); usa-lo como marca colidiria com o proprio sistema semantico.
- **Roxo/violeta (comum em "social" e "criador de conteudo", ex. Discord, Twitch):** descartado — aproxima da linguagem de entretenimento/comunidade casual, quando o posicionamento e profissional/institucional.
- **Preto e branco puro, sem cor de marca (estilo Linear minimalista extremo):** descartado por agora — Pulse ainda precisa de um ponto de cor reconhecivel para badges de conquista/verificacao/destaque; zero-cor funciona para ferramentas B2B, nao para uma rede onde identidade visual pessoal importa.

### 1.4. Papel de cada cor na narrativa

| Cor | Papel narrativo |
|---|---|
| Pulse Blue | "Isto e serio, isto e solido" — toda acao que o usuario confia (entrar, publicar, seguir, confirmar) |
| Midnight Navy / Elevated Dark | Profundidade sem ser preto puro — camada onde o conteudo do usuario (nao o chrome) e o protagonista |
| Sky Blue | Movimento dentro do que ja e confiavel — nunca introduz uma cor nova, so um azul mais vivo |
| Amber | O unico momento em que a interface "acende" — reservado para conquista/reconhecimento, nunca para chrome do dia a dia |

---

## 2. Sistema completo de cores

### 2.1. Brand

| Token | Hex | Uso |
|---|---|---|
| `brand.primary` | `#2563EB` | Acoes primarias (CTA, links de acao, foco), icone de marca |
| `brand.secondary` | `#38BDF8` | Links inline, estados ativos secundarios, hover leve |
| `brand.accent` | `#F59E0B` | Badges de conquista, selo de verificacao (contexto de destaque), momentos especiais |

### 2.2. Backgrounds e surfaces

| Token | Hex | Uso |
|---|---|---|
| `background.default` | `#0B1220` | Fundo principal da app (dark-first) |
| `surface.card` | `#111827` | Cards, publicacoes, modais, sheets, componentes elevados |
| `surface.elevated` | `#1E293B` (mesmo valor do border, usado como surface quando precisa de +1 nivel sobre `surface.card`) | Popover, dropdown, tooltip |

### 2.3. Border

| Token | Hex | Uso |
|---|---|---|
| `border.default` | `#1E293B` | Divisor entre cards, borda de input, separador de lista |
| `border.subtle` | `#1E293B` a 40% opacidade | Separador decorativo (ex. entre secoes do feed) |

### 2.4. Texto

| Token | Hex | Uso |
|---|---|---|
| `text.primary` | `#F8FAFC` | Titulo, corpo principal, texto de post |
| `text.secondary` | `#CBD5E1` | Legenda, metadado (curso/campus), texto de suporte |
| `text.muted` | `#64748B` | Timestamp, placeholder, texto terciario — ver nota de contraste §6.4 |
| `text.on-brand` | `#F8FAFC` sobre `brand.primary`; `#0B1220` sobre `brand.accent` (nunca branco sobre amber — ver §6.3) | Texto/icone dentro de um elemento pintado com cor de marca |

### 2.5. Estados semanticos

| Token | Hex | Uso |
|---|---|---|
| `status.success` | `#22C55E` | Confirmacao, aprovado, online |
| `status.warning` | `#EAB308` | Aviso nao-destrutivo (ex. sessao a expirar) |
| `status.error` | `#EF4444` | Erro, acao destrutiva, campo invalido |

### 2.6. Interacao (derivados, nao cores novas)

| Estado | Regra |
|---|---|
| Hover (superficie) | `surface.card` + overlay branco a 4% |
| Hover (texto de link) | `brand.secondary` no lugar de `brand.primary` |
| Pressed/active | escala -1 na rampa (ex. `blue.600` → `blue.700` em vez de opacidade) |
| Disabled | `text.muted` sobre `surface.card`, sem mudanca de cor de marca |
| Focus ring | `brand.primary` a 100%, 2px, offset 2px sobre `background.default` |

---

## 3. Escalas de cores

Estes valores **sao a escala oficial do Tailwind CSS** (ja dependencia do projeto — `package.json`) — os hex fornecidos no brief correspondem exatamente aos passos abaixo. Nao ha necessidade de gerar uma rampa customizada; usar estas como fonte de verdade evita drift entre design e implementacao.

### 3.1. Pulse Blue (`brand.primary`) — base Tailwind `blue`

| Passo | Hex |
|---|---|
| 50 | `#eff6ff` |
| 100 | `#dbeafe` |
| 200 | `#bfdbfe` |
| 300 | `#93c5fd` |
| 400 | `#60a5fa` |
| 500 | `#3b82f6` |
| **600** | **`#2563eb`** ← base definida no brief |
| 700 | `#1d4ed8` |
| 800 | `#1e40af` |
| 900 | `#1e3a8a` |

### 3.2. Sky Blue (`brand.secondary`) — base Tailwind `sky`

| Passo | Hex |
|---|---|
| 50 | `#f0f9ff` |
| 100 | `#e0f2fe` |
| 200 | `#bae6fd` |
| 300 | `#7dd3fc` |
| **400** | **`#38bdf8`** ← base definida no brief |
| 500 | `#0ea5e9` |
| 600 | `#0284c7` |
| 700 | `#0369a1` |
| 800 | `#075985` |
| 900 | `#0c4a6e` |

### 3.3. Amber (`brand.accent`) — base Tailwind `amber`

| Passo | Hex |
|---|---|
| 50 | `#fffbeb` |
| 100 | `#fef3c7` |
| 200 | `#fde68a` |
| 300 | `#fcd34d` |
| 400 | `#fbbf24` |
| **500** | **`#f59e0b`** ← base definida no brief |
| 600 | `#d97706` |
| 700 | `#b45309` |
| 800 | `#92400e` |
| 900 | `#78350f` |

### 3.4. Neutros (backgrounds/surfaces/texto/border) — base Tailwind `slate` + `gray`

| Passo | Hex | Corresponde a |
|---|---|---|
| 50 | `#f8fafc` | `text.primary` (slate-50) |
| 100 | `#f1f5f9` | — |
| 200 | `#e2e8f0` | — |
| **300** | **`#cbd5e1`** | `text.secondary` (slate-300) |
| 400 | `#94a3b8` | — |
| **500** | **`#64748b`** | `text.muted` (slate-500) |
| 600 | `#475569` | — |
| 700 | `#334155` | — |
| **800** | **`#1e293b`** | `border.default` (slate-800) |
| **900** | **`#111827`** | `surface.card` (gray-900, nao slate) |
| 950 | `#0B1220` (custom, mais escuro/mais azulado que `slate-950` `#020617`) | `background.default` |

Nota tecnica: `background.default` (`#0B1220`) e um passo **custom**, mais profundo e com mais tinta azul do que o `slate-950` padrao do Tailwind. Isso e deliberado — reforca "midnight navy" em vez de "preto neutro" — mas significa que a rampa de neutros tem 11 passos (50–900 + este 950 customizado), nao 10. Registar isto explicitamente evita que outro agente "corrija" para o slate-950 padrao pensando ser inconsistencia.

### 3.5. Semanticos

| Cor | Passo 500 (base) |
|---|---|
| Success (`green`) | `#22c55e` |
| Warning (`yellow`) | `#eab308` |
| Error (`red`) | `#ef4444` |

Usar as rampas padrao do Tailwind para `green`/`yellow`/`red` do mesmo modo — nao redefinir manualmente.

---

## 4. Design Tokens

Estrutura pronta para `globals.css` (`@theme inline`) e para qualquer consumo em TS (ex. `config/ranking.json` ja usa JSON para config versionada — mesmo padrao aqui).

```json
{
  "brand": {
    "primary": { "value": "#2563EB", "scale": { "50": "#eff6ff", "100": "#dbeafe", "200": "#bfdbfe", "300": "#93c5fd", "400": "#60a5fa", "500": "#3b82f6", "600": "#2563eb", "700": "#1d4ed8", "800": "#1e40af", "900": "#1e3a8a" } },
    "secondary": { "value": "#38BDF8", "scale": { "50": "#f0f9ff", "100": "#e0f2fe", "200": "#bae6fd", "300": "#7dd3fc", "400": "#38bdf8", "500": "#0ea5e9", "600": "#0284c7", "700": "#0369a1", "800": "#075985", "900": "#0c4a6e" } },
    "accent": { "value": "#F59E0B", "scale": { "50": "#fffbeb", "100": "#fef3c7", "200": "#fde68a", "300": "#fcd34d", "400": "#fbbf24", "500": "#f59e0b", "600": "#d97706", "700": "#b45309", "800": "#92400e", "900": "#78350f" } }
  },
  "background": {
    "default": { "value": "#0B1220" }
  },
  "surface": {
    "card": { "value": "#111827" },
    "elevated": { "value": "#1E293B" }
  },
  "text": {
    "primary": { "value": "#F8FAFC" },
    "secondary": { "value": "#CBD5E1" },
    "muted": { "value": "#64748B" },
    "onBrand": { "value": "#F8FAFC", "onAccent": "#0B1220" }
  },
  "border": {
    "default": { "value": "#1E293B" }
  },
  "status": {
    "success": { "value": "#22C55E" },
    "warning": { "value": "#EAB308" },
    "error": { "value": "#EF4444" }
  }
}
```

Mapeamento equivalente em `globals.css` (`@theme inline`), seguindo o padrao ja usado no ficheiro atual (ver `--color-brand`, `--color-background`, etc.) — proposto para quando a implementacao for aprovada:

```css
:root {
  --background: #0B1220;
  --foreground: #F8FAFC;
  --muted: #1E293B;
  --muted-foreground: #64748B;
  --border: #1E293B;
  --card: #111827;
  --brand: #2563EB;
  --brand-secondary: #38BDF8;
  --brand-foreground: #F8FAFC;
  --accent-brand: #F59E0B;
  --accent-brand-foreground: #0B1220;
  --success: #22C55E;
  --warning: #EAB308;
  --destructive: #EF4444;
}
```

---

## 5. Aplicacao no produto

| Superficie | Aplicacao |
|---|---|
| **Feed** | Fundo `background.default`; cada post em `surface.card` com `border.default` 1px; gosto/curtida usa `status.error` (coracao) so no estado preenchido — nunca `brand.primary`, para nao confundir "curtir" com "acao de marca"; contador usa `text.secondary` |
| **Perfil** | Header com avatar + `text.primary` (nome) + `text.secondary` (metadado curso/campus/ano); selo de verificacao usa `brand.accent` com icone `text.on-brand.onAccent` (nunca branco puro sobre amber — ver §6.3); botao "Seguir" usa `brand.primary` preenchido, "A seguir" usa outline `border.default` + `text.secondary` |
| **Chat** | Bolha propria em `brand.primary` com texto `text.on-brand`; bolha de terceiro em `surface.elevated` com `text.primary`; hora/status de leitura em `text.muted`; reacao usa emoji nativo (fora do sistema de cor) |
| **Comunidades** *(fora do escopo v1 — nao implementar, so preparar token caso aprovado no futuro)* | Se/quando existir: badge de comunidade usa `brand.secondary`, nunca `brand.accent` (reservado a conquista pessoal) |
| **Portfolio** | Cards de projeto em `surface.card`; CTA "Adicionar projeto" usa `brand.primary` outline (nao preenchido — acao secundaria dentro do proprio perfil) |
| **Botoes** | Primario: `brand.primary` preenchido, texto `text.on-brand`. Secundario: outline `border.default`, texto `text.primary`. Destrutivo: `status.error` preenchido, texto `#F8FAFC` (contraste valido — ver §6) |
| **Navegacao** | Barra/tab bar em `surface.card` sobre `background.default`; icone ativo `brand.primary`; icone inativo `text.muted`; indicador de aba (`tab-indicator` ja existe no CSS) passa de `var(--brand)` laranja para `var(--brand)` azul — sem mudanca estrutural, so o valor da variavel |
| **Notificacoes** | Badge de contagem nao lida usa `status.error` (convencao universal — nunca `brand.primary`, que gerava confusao com "novo conteudo de marca"); linha de notificacao nao lida tem barra lateral `brand.primary` a 100%, lida sem barra |
| **Estados vazios** | Icone em `text.muted`, sem cor de marca — estado vazio nao e call-to-action de marca, e informativo |
| **Loading** | `PulseLoader` (`AGENTS.md` §6.1) muda de `tone="brand"` laranja para azul automaticamente ao trocar `--brand`; nenhuma mudanca de componente necessaria — e a prova de que centralizar tokens (em vez de hardcode) foi a decisao certa desde o inicio |

---

## 6. Validacao

### 6.1. Metodo

Contraste calculado pela formula WCAG 2.1 (luminancia relativa sRGB → razao `(L1+0.05)/(L2+0.05)`), nao estimado visualmente.

### 6.2. Pares criticos testados

| Par | Razao | Resultado |
|---|---|---|
| `text.primary` (#F8FAFC) sobre `background.default` (#0B1220) | **17.9:1** | AAA — muito acima do minimo (corpo de texto principal) |
| `text.on-brand` branco sobre `brand.primary` (#2563EB) | **4.94:1** | AA para texto normal (passa, sem margem para AAA — aceitavel em botao/CTA, nao usar para texto corrido pequeno dentro do botao) |
| `brand.primary` (#2563EB) como **texto** direto sobre `background.default` | **3.62:1** | Falha AA para texto normal (min. 4.5); passa para texto grande/UI (min. 3:1). **Regra:** nunca usar `brand.primary` puro como cor de texto de corpo em fundo escuro — usar `brand.secondary` (Sky Blue) para links/texto |
| `brand.secondary` (#38BDF8) como texto sobre `background.default` | **8.74:1** | AAA — confirma Sky Blue, nao Pulse Blue, como cor de link/texto sobre fundo escuro |
| `brand.accent` (#F59E0B) como texto/icone sobre `background.default` | **8.72:1** | AAA |
| Texto branco (#F8FAFC) sobre `brand.accent` (badge preenchido) | **2.05:1** | **Falha** — nunca usar branco sobre amber preenchido |
| Texto `#0B1220` sobre `brand.accent` (badge preenchido) | **8.72:1** | AAA — confirma a regra da secao 2.4: badge de amber usa texto/icone escuro, nunca branco |
| `text.muted` (#64748B) sobre `background.default` | **3.93:1** | Passa para texto grande/label (min. 3:1); **abaixo do minimo AA para texto pequeno de corpo (4.5)**. Uso correto: timestamp, metadado curto, placeholder — nunca paragrafo ou label critico pequeno |

### 6.3. Regras derivadas da validacao (nao negociaveis na implementacao)

1. `brand.primary` (#2563EB) e cor de **superficie** (botao, fundo de badge, borda de foco) — nunca cor de **texto direto** sobre fundo escuro.
2. Links e texto interativo sobre fundo escuro usam `brand.secondary` (#38BDF8), nao `brand.primary`.
3. Qualquer badge/superficie pintada com `brand.accent` usa texto/icone `#0B1220` (escuro), nunca branco — mesmo padrao que o `--brand-foreground: #000000` ja usado no laranja anterior, so que agora aplicado ao amber.
4. `text.muted` reservado a metadado curto (timestamp, contagem, placeholder) — nunca usar para texto de corpo, aviso ou label de acao.

### 6.4. Legibilidade e consistencia

- Toda a paleta de neutros e brand corresponde a escalas oficiais do Tailwind (secao 3) — zero deriva entre design e implementacao, zero "cor customizada que ninguem lembra a origem" dentro de 6 meses.
- Consistente com a regra de icones (`ENGINEERING_CONSTITUTION.md` §4: "icones de um unico set") — nenhuma cor nova introduzida fora da paleta acima, incluindo em icones.
- Mobile vs desktop: paleta e independente de densidade/tamanho de tela — validado apenas em termos de contraste de cor, que nao muda com viewport. Tamanho de toque/hit-area e preocupacao separada, ja tratada na UI existente.

### 6.5. Escalabilidade para milhoes de usuarios

- Paleta baseada em Tailwind = zero custo de manutencao de rampa customizada; qualquer novo componente pode consumir `blue-400`, `slate-300` etc. diretamente sem reinventar.
- Dark-first com uma unica fonte de verdade de tema reduz a superficie de bugs de "cor que so falha no dark mode" — ver secao 7.1 sobre a decisao de abandonar o tema claro atual.
- Amber como unico "ponto de energia" (badges/conquista) mantem a interface calma em escala — nao ha inflacao de cor conforme features novas (comunidades, portfolio, etc.) sao adicionadas, porque a regra e "uma cor de acento, sempre com o mesmo significado".

---

## 7. Decisoes registadas (24/07/2026)

Confirmadas por Mallony, desbloqueando a implementacao:

1. **Laranja → azul: confirmado.** `brand.primary` passa a ser Pulse Blue (`#2563EB`). Este documento substitui a decisao anterior registada em `AGENTS.md` §6.1/§6.2 — atualizado no mesmo commit desta implementacao.
2. **Dark-first, mas com os dois modos.** O app mantem tema claro **e** escuro (nao fica dark-only), mas o dark passa a ser a identidade primaria/de referencia — e o que a marca "e" por padrao; o claro e um modo alternativo com paridade total de tokens, nao um tema secundario esquecido. Rampa de modo claro definida na secao 7.1 abaixo (nao estava no brief original, que so especificava dark).
3. **Selo de verificacao mantem-se separado, de proposito.** `#2196F3` continua a ser a cor exclusiva do selo (`docs/UX_VERIFICACAO.md`) — nao migra para `brand.primary`. Fica registado como excecao deliberada: "confianca institucional" (selo) e uma cor propria, distinta de "acao de produto" (marca).

### 7.1. Modo claro — tokens equivalentes (novo, nao estava no brief)

O brief original especificava so a versao dark. Para dar paridade real (§7 ponto 2), a versao clara usa os mesmos passos de escala Tailwind (§3), mantendo o mesmo papel semantico de cada token, com contraste validado (formula WCAG, §6.1):

| Token | Dark | Light | Papel |
|---|---|---|---|
| `background.default` | `#0B1220` | `#F8FAFC` (slate-50) | Fundo principal |
| `surface.card` | `#111827` (gray-900) | `#FFFFFF` | Card/post/modal |
| `border.default` | `#1E293B` (slate-800) | `#E2E8F0` (slate-200) | Divisor/borda |
| `text.primary` | `#F8FAFC` | `#0F172A` (slate-900) | Titulo/corpo |
| `text.secondary` | `#CBD5E1` (slate-300) | `#475569` (slate-600) | Legenda/metadado — 7.24:1 |
| `text.muted` | `#64748B` (slate-500) | `#64748B` (slate-500) | Timestamp/placeholder — 4.55:1 no claro (passa AA corpo; no dark fica reservado a texto grande/label, §6.2) |
| `brand.primary` (superficie) | `#2563EB` | `#2563EB` | Mesmo hex nos dois modos — 5.17:1 sobre branco, 4.94:1 sobre slate-50: passa AA texto normal tambem no claro (diferente do dark, onde so serve como superficie — §7.2) |
| `brand.secondary` (link/texto) | `#38BDF8` (sky-400) | `#0369A1` (sky-700) | Link/texto interativo — sky-400 falha AA em fundo claro (2.14:1); sky-700 da 5.67–5.93:1 |
| `brand.accent` (badge) | `#F59E0B` (amber-500) | `#B45309` (amber-700) | Badge/conquista — amber-500 texto falha no claro (2.15:1); amber-700 da 4.80–5.02:1 |
| `status.success` (texto) | `#22C55E` (green-500) | `#15803D` (green-700) | green-500 falha texto no claro (2.28:1); green-700 da 4.79–5.02:1 |
| `status.warning` (texto) | `#EAB308` (yellow-500) | `#A16207` (yellow-700) | yellow-500 ilegivel como texto claro (~1.6:1); yellow-700 da 4.71–4.92:1 |
| `status.error` (texto) | `#EF4444` (red-500) | `#DC2626` (red-600) | red-500 fica 3.60–3.76:1 no claro (falha texto pequeno); red-600 da 4.62–4.83:1 |

**Regra derivada:** nos estados semanticos e em `brand.secondary`/`brand.accent`, o modo claro usa um passo mais escuro da mesma rampa (500→600/700) quando a cor e usada como *texto*; quando e usada so como *superficie preenchida* (badge cheio, botao cheio), o passo 500 original continua valido nos dois modos porque o contraste relevante e do conteudo por cima do preenchimento, nao do preenchimento contra o fundo da pagina.

### 7.2. Call-sites atualizados

Mapeamento de `--brand` (laranja) para os novos tokens, um a um, com o estado final de cada:

- `ring-brand` — `var(--brand)` passa a `#2563EB` (dark) / `#2563EB` (light, ja valida como superficie de anel de foco).
- `.tab-indicator` — mesma troca de variavel, sem mudanca estrutural.
- `.shadow-brand` — `rgba(255,159,10,*)` passa a `rgba(37,99,235,*)` (Pulse Blue em rgba).
- `PulseLoader` `tone="brand"` — herda `currentColor`/`var(--brand)` automaticamente, sem mudanca de componente.
- `heart-pop`/like — **achado de QA, nao corrigido nesta implementacao:** o coracao de gostar no feed principal (`post-actions.tsx`) usa `fill-brand`/`text-brand` (era laranja, passa a azul automaticamente pela troca de token — sem hardcode, sem risco). O mesmo gesto em comentarios (`comment-thread.tsx`) usa `fill-destructive`/`text-destructive` (vermelho) — **inconsistencia pre-existente, anterior a esta mudanca de marca**, nao introduzida por ela. Fora do escopo deste documento decidir qual e a cor correta de "gostar" (decisao de produto, nao de sistema de cor) — sinalizado ao Agente de QA/Mallony para decisao explicita: unificar os dois em `brand.primary` (like = acao de produto) ou em `status.error` (like = convencao universal tipo Instagram).
- Badge de verificacao — **sem alteracao** (§7 ponto 3): mantem `#2196F3` fixo, nao consome `--brand`.
- CTAs primarios (`AGENTS.md` §6.1: `follow-button.tsx`, `compose-form.tsx`, `comment-thread.tsx`, `auth-form.tsx`, `edit-profile-form.tsx`, `password-form.tsx`, `recovery-email-form.tsx`, `professional-flow.tsx`, `profile-avatar.tsx`, `onboarding-flow.tsx`, `offline/page.tsx`) — todos consomem `var(--brand)`/`var(--color-brand)` via token central, nao hex hardcoded; herdam a troca automaticamente pela mudanca em `globals.css`, sem edicao individual de componente.
