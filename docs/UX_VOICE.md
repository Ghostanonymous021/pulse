# Pulse — Guia de Voz e Escrita de Produto

**Fonte de produto:** `PULSE_VISAO_PRODUTO.md`, `AGENTS.md` (secao 6, decisao de posicionamento 24/07/2026)
**Substitui, para efeitos de tom/copy:** referencias antigas a "camada social das universidades" como fronteira rigida — ver nota de posicionamento abaixo.
**Ultima atualizacao:** 24/07/2026

---

## 0. Nota de posicionamento (ler antes do resto)

O Pulse nasceu descrito como "a camada social das universidades" (`PULSE_VISAO_PRODUTO.md` v1, 18/07/2026), com lancamento fechado na universidade-piloto (Xai-Xai, Maxixe, Massinga, Manhica). Essa continua a ser a realidade tecnica do produto agora: contas, campus, universidade-piloto, RLS por instituicao.

A decisao de 24/07/2026 (registada em `AGENTS.md` secao 6) e sobre **linguagem de marca, nao sobre escopo tecnico**: o Pulse deixa de se apresentar, na copy, como uma ferramenta "de universidade" e passa a falar como uma comunidade de pessoas — estudantes, sim, mas atraves de conexoes, ideias e conversas, nao atraves da instituicao. Na pratica:

- Continua a existir `university`/`campus`/`course` no perfil, porque isso ainda importa para o feed e para encontrar colegas.
- A copy deixa de usar a instituicao como moldura da experiencia. Fala-se de pessoas, nao de "estudantes desta universidade".
- Nao se introduz "Comunidades" como feature nova so por causa deste guia — isso e decisao de produto separada, fora de escopo aqui.

Sempre que este guia e a visao tecnica antiga parecerem discordar, e a **linguagem** que muda, nunca a arquitetura de dados/RLS/schema.

---

## 1. Quem fala

O Pulse fala como alguem de dentro da comunidade, nao como o dono da plataforma. Nunca fala como uma instituicao, nunca fala como um manual.

| Trace | Descricao |
|---|---|
| **Humana** | Fala com pessoas, nao com "usuarios". Primeira/segunda pessoa, nunca terceira impessoal. |
| **Confiante** | Diz o que e, sem qualificar tudo com "talvez", "tenta", "clica aqui para". |
| **Inteligente** | Trata quem le como alguem com ideias, nao como alguem que precisa de tudo explicado. |
| **Jovem** | Energia, ritmo curto — sem giria forcada, sem excesso de entusiasmo, sem exclamacao em cada frase. |
| **Inclusiva** | Nunca reduz a experiencia a "estudante de X universidade". Pessoas primeiro, contexto academico depois. |
| **Inspiradora** | Mostra o que e possivel fazer a seguir, nunca o que falta ou o que deu errado, sem essa ser a unica nota. |

---

## 2. Principio fundamental

**Nao escreve como plataforma. Escreve como comunidade.**

Isto tem consequencia pratica direta em cada string:

- Nunca "usuario" -> **pessoa**, **tu** (ou omitir sujeito: "Segue colegas...")
- Nunca "publique conteudo" -> **partilha uma ideia**, **compartilha algo**
- Nunca "acesse funcionalidades" -> nomeia a acao real ("Ve as tuas mensagens")
- Nunca "universidade" como moldura da frase -> deixa a universidade ser dado de perfil, nao personagem da copy
- Nunca marketing inflado ("a melhor forma de...", "revolucione...") -> uma frase directa, sem adjectivo a mais

---

## 3. Regras de escrita

1. **Simples.** Uma frase forte bate um paragrafo. Se a frase precisa de virgula a mais para caber tudo, corta ideia, nao virgula.
2. **Especifica.** "Algo correu mal" nunca e resposta final — diz o que aconteceu ou o que fazer a seguir, mesmo que generico ("Tenta outra vez.").
3. **Positiva.** Estados vazios mostram possibilidade, nao ausencia. "Ainda nao ha nada aqui" e pior que "Ainda nao ha nada aqui. Se calhar es a primeira pessoa a partilhar algo."
4. **Natural.** Le em voz alta. Se ninguem diria aquilo numa conversa normal, reescreve.
5. **Sem emoji, sem preenchimento, sem tom de aviso institucional.** Regra ja existente em `AGENTS.md` §2.3 e `ENGINEERING_CONSTITUTION.md` §4 — este guia nao a substitui, reforca-a.
6. **PT-MZ/PT europeu, nao PT-BR.** O codigo actual mistura ("Voce" nunca aparece, mas ha inconsistencia "cadastro" vs "conta" pontual) — este guia fixa PT-MZ/PT europeu como padrao (ja e o que domina no codigo: "Tu", "Palavra-passe", "Definicoes").
7. **Botoes = verbo de accao curto.** "Continuar", "Publicar", "Seguir" — nunca "OK", "Submit", "Enviar formulario".
8. **Erros nunca culpam a pessoa.** "Username invalido" e factual, nao "Preencheste mal o username".

---

## 4. Antes / Depois (strings reais do codigo actual)

Todas as strings abaixo existem hoje no repositorio (`src/...`). "Depois" e a proposta deste guia — nenhuma foi ainda aplicada ao codigo.

### Onboarding (`onboarding-flow.tsx`)

| Onde | Antes | Depois |
|---|---|---|
| Boas-vindas, titulo | `Bem-vindo ao Pulse` | `Bem-vindo ao Pulse` *(mantido — directo, ja bom)* |
| Boas-vindas, subtitulo | `A camada social da tua universidade. Feed unico, mensagens e perfil — sem ruido.` | `O teu espaco para pessoas, ideias e conversas que valem a pena. Sem ruido.` |
| Campus, titulo | `Onde estudas` | `Onde estudas` *(mantido)* |
| Campus, subtitulo | `Ajuda o feed a encontrar colegas. Podes alterar isto depois.` | `Ajuda-nos a mostrar-te pessoas com quem faz sentido cruzar. Podes mudar isto sempre que quiseres.` |
| Foto, subtitulo | `As pessoas reconhecem-te melhor. Opcional.` | `As pessoas conhecem-te melhor com uma cara. Totalmente opcional.` |
| Seguir, titulo | `Segue gente da tua rede` | `Comeca por seguir alguem` |
| Seguir, subtitulo | `O feed começa a fazer sentido com as pessoas certas.` | `O teu feed fica bom com as pessoas certas — comeca por estas.` |
| Seguir, vazio | `Ainda há poucas contas. Encontra pessoas em Explorar.` | `Ainda ha poucas pessoas por aqui. Sê de quem comeca — explora e encontra as primeiras.` |
| CTA final | `Entrar no Pulse` | `Entrar no Pulse` *(mantido — claro e confiante)* |
| Nota final | `Podes seguir mais gente em Explorar a qualquer altura.` | `Podes seguir mais gente quando quiseres, em Explorar.` |

### Auth (`login/page.tsx`, `signup/page.tsx`, `auth-form.tsx`)

| Onde | Antes | Depois |
|---|---|---|
| Login, subtitulo | `Telefone ou e-mail, com a tua palavra-passe.` | `Telefone ou e-mail, com a tua palavra-passe.` *(mantido — funcional, sem gordura)* |
| Signup, subtitulo | `Nome, username e telefone. O perfil podes completar depois.` | `Nome, username e telefone. O resto do perfil fica para depois — sem pressa.` |
| Erro generico signup | `Não foi possível criar a conta.` | `Não conseguimos criar a conta agora. Tenta outra vez.` |
| Erro credenciais | `Credenciais incorrectas.` | `Telefone/e-mail ou palavra-passe incorrectos.` |
| Erro rate limit | `Demasiadas tentativas. Tenta mais tarde.` | `Calma — demasiadas tentativas. Tenta de novo dentro de um pouco.` |

### Feed (`feed-list.tsx`, `compose-form.tsx`, `comment-thread.tsx`)

| Onde | Antes | Depois |
|---|---|---|
| Feed vazio, titulo | `O teu feed ainda está quieto` | `O teu feed ainda está quieto` *(mantido — bom, humano, sem clichê)* |
| Feed vazio, descricao | `Segue colegas no Explorar ou publica a primeira coisa do dia.` | `Segue pessoas em Explorar ou sê a primeira pessoa a partilhar algo hoje.` |
| Compose, placeholder | `O que queres partilhar? Usa @ para mencionar` | `O que tens em mente? Usa @ para mencionar alguem.` |
| Comentario vazio | `Ainda sem comentarios.` | `Ainda sem comentarios. Diz a primeira coisa.` |
| Comentario, placeholder | `Adiciona um comentário...` | `Escreve um comentario...` |

### Perfil (`profile-tabs.tsx`, `edit-profile-form.tsx`, `profile-links-editor.tsx`)

| Onde | Antes | Depois |
|---|---|---|
| Publicacoes vazio | `Ainda sem publicacoes.` | `Ainda sem publicacoes. O que quiseres partilhar comeca aqui.` |
| Links vazio | `Nenhum link ainda.` | `Ainda sem links. Adiciona o teu portfolio, GitHub ou o que quiseres mostrar.` |
| Bio, placeholder | `Uma linha` | `Uma linha sobre ti` |

### Mensagens (`mensagens/page.tsx`, `chat-view.tsx`)

| Onde | Antes | Depois |
|---|---|---|
| Inbox vazio, titulo | `As tuas conversas` | `As tuas conversas` *(mantido)* |
| Inbox vazio, descricao | `Abre um perfil e toca em Mensagem.` | `Abre o perfil de alguem e toca em Mensagem para comecar.` |
| Chat vazio | `Envia a primeira mensagem.` | `Envia a primeira mensagem. Todas as conversas comecam por algum lado.` |

### Notificacoes (`notifications-list.tsx`)

| Onde | Antes | Depois |
|---|---|---|
| Vazio, titulo | `Sem actividade` | `Tudo tranquilo por aqui` |
| Vazio, descricao | `Curtidas, comentários e seguidores novos aparecem aqui.` | `Curtidas, comentarios e novas pessoas a seguir-te aparecem aqui.` |

### Pessoas (`people-list.tsx`, `suggest-follows.tsx`)

| Onde | Antes | Depois |
|---|---|---|
| Lista vazia | `Ninguém aqui ainda` | `Ninguem aqui ainda` *(mantido, so normalizar acentuacao)* |
| Sugestoes vazio | `Ainda ha poucas contas. Continua e encontra pessoas no Explorar.` | `Ainda ha poucas pessoas por aqui. Continua e explora para encontrar mais.` |

### Erros genericos de accao (`profile-menu.tsx`, `post-menu.tsx`)

| Onde | Antes | Depois |
|---|---|---|
| Erro de accao | `Algo correu mal.` | `Algo correu mal. Tenta outra vez.` |

### Definicoes / permissoes (`perfil/definicoes/*`)

| Onde | Antes | Depois |
|---|---|---|
| DM permission "none" | `Ninguém novo` | `Só quem já falo contigo` *(mais claro sobre o efeito real — bloqueia contactos novos, nao "estranhos" em abstracto)* |
| Conta bloqueada, vazio | `Nenhuma conta bloqueada.` | `Nenhuma conta bloqueada.` *(mantido — factual, correcto para um ecran de seguranca; nao precisa de tom "vivo" aqui, ver secao 6)* |

---

## 5. Exemplos de direccao (padrao geral, nao so casos ja existentes)

Evitar -> Usar:

- `Não existem publicações disponíveis.` -> `Ainda não há nada por aqui. Sê a primeira pessoa a partilhar uma ideia.`
- `Encontrar universidades.` -> `Descobre pessoas, projectos e oportunidades.`
- `Publique um post.` -> `Partilha uma ideia.`
- `Cadastre-se agora.` -> `Cria a tua conta.` / `Entra no Pulse.`
- `Acesse as funcionalidades de mensagens.` -> `Fala com quem quiseres, quando quiseres.`
- `O usuário não tem permissão.` -> `Isto e privado. So [pessoa] pode ver.`

---

## 6. Onde o tom "vivo" NAO se aplica

Este guia nao pede para adocicar tudo. Zonas onde o registo deve ficar **neutro e directo**, sem tentativa de calor humano:

- **Accoes destrutivas/irreversiveis** (apagar conta, apagar publicacao, sair de todos os dispositivos): factual, sem "sonar" de marca — mesmo principio ja aplicado a `PulseLoader` em `delete-account-form.tsx` (`AGENTS.md` §6.1).
- **Erros de seguranca/permissao** (RLS, bloqueio, denuncia): claros, sem eufemismo. Nunca esconder um bloqueio detras de linguagem simpatica.
- **Termos de uso, privacidade, dados legais**: linguagem legal precisa manter precisao, nao "voz de marca".
- **Rate limit / anti-abuso**: pode ter um toque humano ("Calma —") mas nunca minimiza a razao real da restricao.

---

## 7. Biblioteca de frases reutilizaveis

### Convites a agir (CTAs)
- `Comecar`
- `Continuar`
- `Partilhar uma ideia`
- `Seguir`
- `Explorar pessoas`
- `Entrar no Pulse`

### Estados vazios (padrao: contexto + convite, nunca so ausencia)
- `Ainda nao ha nada aqui. Sê a primeira pessoa a partilhar algo.`
- `Ainda sem [X]. [Accao] para comecar.`
- `Tudo tranquilo por aqui.` (para notificacoes/estados neutros, nao negativos)

### Erros (padrao: o que aconteceu + o que fazer)
- `Nao foi possivel [accao]. Tenta outra vez.`
- `Algo correu mal. Tenta outra vez dentro de um pouco.`
- `Calma — demasiadas tentativas. Espera um pouco e tenta de novo.`

### Confirmacoes / sucesso
- `Feito.`
- `Guardado.`
- `Publicado.`

### Loading
- Nunca texto sozinho quando `PulseLoader` ja existe (ver `AGENTS.md` §6.1); quando precisar de texto, usar gerundio curto: `A guardar...`, `A enviar...`, `A publicar...`

---

## 8. Regras para manter consistencia

1. **Toda string nova passa por este guia antes do commit** — nao so pelas regras visuais da secao 2.3 do `AGENTS.md`.
2. **PT-MZ/PT europeu sempre.** Nunca "voce", "cadastro", "postagem" (PT-BR). Usar "tu", "conta", "publicacao".
3. **Nunca "usuario"** em nenhuma string visivel. Interno (variaveis, comentarios de codigo) pode manter termos tecnicos em ingles — isto e regra de copy visivel, nao de nomenclatura de codigo.
4. **Toda string vazia (empty state) segue o padrao contexto + convite** (secao 7), excepto nas zonas neutras da secao 6.
5. **Todo erro diz o que fazer a seguir**, mesmo generico. Nunca terminar em ponto seco sem proxima accao implicita.
6. **Revisao de copy faz parte da checklist de QA** (`AGENTS.md` §4) — adicionar pergunta: "esta string fala como pessoa ou como sistema?"
7. **Alteracoes a este guia** seguem o mesmo protocolo do `AGENTS.md` §3: debate antes de mudar tom, registo em `AGENTS.md` secao 6 quando aplicado ao codigo.

---

## 9. Aplicacao — proximos passos tecnicos (fora deste documento)

Este guia e a referencia de copy. A aplicacao ao codigo (troca de strings, um commit por area — onboarding, feed, perfil, mensagens) e trabalho de implementacao separado, sujeito a `AGENTS.md` §3 (agente de Frontend & Design) e a checklist §4. Nao aplicar em massa sem revisao — mudar tom de erro de seguranca por engano (secao 6) e o risco principal.
