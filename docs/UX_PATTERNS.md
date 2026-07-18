# Pulse — padroes UX (inspiracao Instagram + Facebook)

**Fonte de produto:** `PULSE_VISAO_PRODUTO.md` (sec. 3, 8, 9)  
**Principio:** copiar o *padrao de qualidade e hierarquia*, nao clonar features.  
**Ultima atualizacao:** 18/07/2026

---

## O que estudamos e o que adoptamos

### 1. Anatomia do post (Instagram feed, com tom Facebook)

**Instagram:** avatar + nome no topo → media full-bleed → fila de acoes (like, comment, share, save) → contagens → caption.  
**Facebook:** mais texto-first; reaccoes e comentario sob o texto; media integrada.

**Pulse v1:**
| Zona | Padrao | Motivo |
|------|--------|--------|
| Cabecalho | Avatar + nome (truncate 1 linha, sem @username) · tempo + icone seguir (person-plus) + menu | Nome so no feed; @ no perfil/busca; seguir directo no cabecalho |
| Media | Full width, ratio natural / max 4:5 | IG; fotos sao o peso visual |
| Corpo | Texto sob a media (ou so texto se sem foto) | FB quando e so texto; IG caption |
| Acoes | **Gosto** + **Comentar** (icones Lucide, outline) | IG enxuto; sem partilhar/guardar na v1 (escopo) |
| Contagens | `N gostos` · `N comentarios` sob as acoes | FB legivel; nao esconder atras de toque |
| Destaque | Badge discreto no cabecalho (so org) | Nao e "promovido" gritante |

Fora de v1 (como IG/FB tem e nos adiamos): partilhar, guardar, reaccoes multiplas, reels.

### 2. Compor publicacao (Instagram create, simplificado)

**Instagram:** `+` → escolher media → editar → caption → partilhar. Multi-step.

**Pulse v1 (um ecran, mobile-first):**
1. Zona de media opcional (galeria multipla, preview em fila horizontal — padrao IG carousel thumbs).
2. Campo de texto (caption), placeholder seco: "O que queres partilhar?"
3. Checkbox **Destacar** so se `account_type = organizacao`.
4. CTA primario **Publicar** (nao "Partilhar" — PT-MZ/PT mais natural no nosso contexto).

Sem filtros, sem stories, sem agendar. Validacao MIME no upload (sec. 12.3).

### 3. Seguir (Instagram)

Estados do botao (texto minimo, sem tutorial):

| Estado | Label | Estilo |
|--------|-------|--------|
| Nao segue | **Seguir** | preenchido (accent) |
| Pedido a conta privada | **Solicitado** | outline / muted |
| A seguir | **A seguir** | outline |
| Propria conta | **Editar perfil** | outline |

- Conta **publica:** follow → `accepted` imediato (ja no schema).  
- Conta **privada:** follow → `pending`; dono aceita/recusa.  
- **Privada → publica (metodo IG):** pedidos pendentes passam a `accepted` (nao ficam no limbo).  
- Perfil de terceiro: **Seguir** + **Mensagem** lado a lado (doc sec. 9.6).

### 4. Onboarding profissional (pos-signup)

**Pulse v1:** fluxo multi-ecra em `/onboarding` (chrome none):

1. **Bem-vindo** — valor do produto, CTA Comecar + Saltar  
2. **Campus** — universidade / campus / curso / ano (tudo opcional)  
3. **Foto** — upload opcional  
4. **Seguir** — sugestoes por campus/curso/uni + Entrar no Pulse  

- Signup → `/onboarding` (legado `/onboarding/seguir` redireciona).  
- Zero campos obrigatorios alem do cadastro.  
- Logout padrao = **so este dispositivo** (`scope: local`). “Todos os dispositivos” so em Seguranca.

### 5. Explorar (Instagram search + Facebook people search)

**Instagram:** um campo; tabs ou segmentos Contas / Tags / Audio / Lugares.  
**Pulse v1 (doc):** pesquisa **dupla** — contas e publicacoes.

- Um search field no topo (ja no header global; ecran Explorar foca o input).  
- Segmentos: **Contas** | **Publicacoes**.  
- Conta privada **aparece** na lista; conteudo so apos follow aceite (RLS).  
- Resultados com debounce client-side leve; query `ilike` no username/display_name e body do post.

### 6. O que deliberadamente NAO copiamos

- Stories, Reels, live  
- Marketplace no feed  
- Multiplos feeds / listas  
- Selo de verificacao **gratuito** em massa (selo pago opcional existe — ver Definicoes) 
- Emojis decorativos, copy tipo tutorial  
- Metadado de curso dentro do post  

---

## Ordem de implementacao

### Iteracao 1 (feita)
1. Anatomia do post + like  
2. Compose com fotos  
3. Perfil publico + Seguir  
4. Onboarding sugerir contas  
5. Explorar pesquisa  

### Iteracao 2 (feita)
6. **Pedidos de follow** (Notificacoes): Confirmar | Eliminar — padrao IG  
7. **DMs 1:1**: inbox + thread + bolhas; abrir de perfil via Mensagem — IG/FB simplificado  

### Iteracao 3 (feita)
8. Publicacoes: texto longo, carousel, comentarios em arvore + likes  
9. Estetica Apple-like (docs/UX_PUBLICACOES.md)  
10. Perfil: abas Publicacoes + Portfolio sempre on; foto com sheet/lightbox  

### Ainda nao
- Activity feed (gostos/comentarios nas notificacoes)  
- Ranking §15  
- CRUD de projetos no portfolio  

Tudo mapeia a sec. 9 do documento-mae.
