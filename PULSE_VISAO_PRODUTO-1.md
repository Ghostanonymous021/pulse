# Pulse — A camada social das universidades

**Documento de visão e decisões de produto — v1**
Última atualização: 18/07/2026

---

## 1. O problema

A universidade-piloto tem campi em Xai-Xai, Maxixe, Massinga e Manhiça. São a mesma instituição, mas funcionam como ilhas:

- Não há um canal único da universidade para todos os estudantes de uma vez.
- A informação depende de docentes reencaminharem em grupos de WhatsApp — lenta, incompleta, inconsistente.
- Estudantes de um campus não conhecem os de outro. Não há como ver fotos ou acompanhar eventos de campi diferentes.
- Oportunidades (bolsas, estágios, editais) não têm onde ser publicadas para todos verem de uma vez.
- Estudantes com pequenos negócios, serviços, ou que procuram quarto/material, não têm onde divulgar.
- Não existe lugar para mostrar talento — projetos, portfólio, iniciativa — fora do que a nota acadêmica mede.

Isto não é exclusivo desta universidade. É o padrão em praticamente qualquer universidade: a vida estudantil acontece fragmentada entre WhatsApp, Facebook, Instagram, Telegram e cartazes físicos.

---

## 2. A visão

**Pulse não é "uma rede social para estudantes". É a camada social das universidades.**

A diferença importa: uma rede social para estudantes compete com Instagram. Uma camada social universitária compete com a desorganização — um problema muito mais valioso de resolver, e muito mais difícil de copiar depois que o efeito de rede se instala.

Princípio central:

> A universidade não é o centro. Os estudantes são.
> A universidade entra na comunidade — não é dona dela.

O estudante não entra "na universidade". Entra na própria conta. O feed mostra o que faz sentido para ele: colegas, universidade, oportunidades, eventos, gente de outras universidades que ele decidiu seguir. Tudo misturado, como na vida real.

**Lançamento:** fechado, multi-campus dentro da universidade-piloto primeiro (Xai-Xai, Maxixe, Massinga, Manhiça). Provar o efeito de rede numa universidade antes de expandir para outras. É o "Harvard do Facebook original" aplicado a Moçambique.

---

## 3. Princípios de design

Inspiração: cruzamento de Facebook + Instagram, com padrão de qualidade Apple.

- **Feed único.** Sem múltiplas abas de conteúdo. Quem quiser ver só posts de uma universidade específica, pesquisa e entra no canal/página dela.
- **Publicação limpa.** Sem "avisos", sem tom institucional, sem blocos de texto tipo comunicado. Publicar deve parecer normal, como qualquer pessoa publicando.
- **Nada de metadado forçado no post.** Curso, ano, campus — isso é dado de perfil, configurado uma vez, nunca escrito manualmente em cada publicação.
- **Zero sensação de conteúdo institucional/burocrático.** Mesma régua já aplicada no Kamby e no Veil: sem emojis decorativos, sem enchimento, sem ícones genéricos.
- **Simplicidade > cobertura de casos.** Preferir um mecanismo simples e universal a múltiplas categorias que tentam prever todo uso possível.

---

## 4. Tipos de conta

Apenas duas distinções — nada além disso:

### Pessoa
- Perfil pessoal, posts sociais, segue e é seguido.
- Pode configurar: universidade, campus, curso, ano (tudo opcional, tudo no perfil, nunca no post).
- Pode transformar o perfil num portfólio leve: fotos de projetos, links de repositórios, participação em hackathons/clubes — sem virar LinkedIn.

### Organização (universidade, instituição, empresa)
- Página verificada por natureza da conta (não por selo de verificação pessoal — ver seção 6).
- Publica no mesmo feed, mesmo formato de post que qualquer pessoa.
- Diferença única: pode **destacar** um post.

Não há terceira categoria (nada de "tipo de post: oportunidade/evento/aviso"). Isso foi avaliado e descartado deliberadamente — categorizar conteúdo antecipadamente é over-engineering; a organização decide o que importa, não o sistema.

---

## 5. Sistema de destaque (peso no feed)

Problema que resolve: uma bolsa da IBE ou um edital da universidade não pode se perder no scroll.

Mecanismo:
- Só contas de **organização** podem marcar um post como **destacado**.
- Post destacado recebe peso extra no ranking do feed para seguidores (e possivelmente para conexões de conexões, a definir).
- **Limite semanal de destaques** por organização — evita que a função vire spam ou canal de broadcast permanente.
- Posts normais da organização (foto de evento, bastidor) competem no ranking igual a qualquer pessoa.

Sem categorias de conteúdo. Sem regras sobre o que pode ou não ser destacado — só limite de frequência.

---

## 6. Identidade e confiança

Decisão explícita: **sem sistema de verificação na v1.**

Motivo: qualquer selo que a maioria das contas acaba ganhando deixa de significar algo — vira ruído, não sinal. E qualquer fricção de verificação no cadastro contradiz o objetivo central de login fácil.

Como se mantém a integridade da rede sem verificação:
- **Grafo social.** Quem segue quem, quem está conectado a quem, é o sinal de pertencimento — não um selo.
- **Auto-declaração de universidade/campus/curso** no perfil, sem validação forçada.
- **Denúncia** como rede de segurança para abuso, não como bloqueio de entrada.

Se abuso real aparecer com uso, resolve-se com dados reais depois — não com suposição antecipada.

---

## 7. Login e recuperação de conta

Prioridade: máxima facilidade de entrada, zero custo de SMS.

- **Cadastro:** número de telefone, sem confirmação por SMS.
- **Perfil incompleto no início** — sem obrigar preenchimento de curso/campus/ano no momento do cadastro (ver fluxo de onboarding, seção 9).
- **Recuperação de senha:** o usuário pode configurar um e-mail de recuperação depois, dentro do app — não é exigido no cadastro.
- **Login posterior:** por número de telefone OU e-mail (se configurado), sem código de confirmação.
- Sem exigência de e-mail institucional — a universidade não ser filtro de entrada é decisão estratégica, não descuido.

---

## 8. Estrutura de navegação

Inspirada em Instagram/Facebook, mas mais enxuta.

**Header (topo):**
- Explorar (pesquisa)
- Sino (notificações)

**Footer (rodapé) — presumido a partir da conversa, a confirmar:**
- Home (feed)
- Mensagens (conversas simples entre usuários)
- Postar
- Perfil

**Perfil:**
- Ícone de definições/configurações no header do próprio perfil (não no rodapé geral).

Racional: manter o rodapé com poucas ações centrais (navegação primária), e mover busca + notificações para o header, evitando "encher" o rodapé — mesma lógica que Instagram usa para separar ações de navegação de ações de descoberta.

---

## 9. Fluxos a desenhar em detalhe (próximo passo)

Ainda em aberto, a especificar com telas/wireframes:

1. **Onboarding**
   - Cadastro (telefone, sem SMS)
   - Login
   - Recuperação de senha (configuração de e-mail dentro do app)
   - Sugestão de contas para seguir (baseado em campus/curso/universidade declarados) — define o feed inicial, como o Instagram faz no primeiro acesso

2. **Feed (Home)**
   - Algoritmo de ranking: pessoal vs. campus vs. universidade vs. destacado
   - Critério de mistura (não separar em abas)

3. **Explorar**
   - Pesquisa dupla: **contas/usuários** (pessoas, organizações, universidades, campi) e **publicações**.
   - Resultado de conta privada aparece na busca (perfil existe), mas conteúdo só é acessível após aprovação de seguimento.

4. **Mensagens**
   - Conversas simples 1:1 entre usuários

5. **Postar**
   - Fluxo de criação de post — formatos definidos: texto, foto(s), ou texto + foto(s). Inspirado no Instagram.
   - Opção de destaque (só visível para contas de organização)

6. **Perfil**
   - Dados configuráveis: universidade, campus, curso, ano, e-mail de recuperação
   - Toggle de conta pública/privada, dentro de definições (não como botão solto no topo)
   - Espaço para portfólio leve (projetos, links)
   - Ícone de definições no header do perfil
   - Estrutura visual (equilíbrio Instagram + Facebook, sem um dominar):
     - **Topo:** avatar, nome, username, badge discreto de tipo de conta (pessoa/organização — sem selo chamativo), bio curta de uma linha, universidade · campus · curso em linha única (só o que o usuário preencheu), contadores (publicações · seguidores · seguindo), botão seguir/mensagem (perfil de terceiro) ou editar perfil (próprio perfil)
     - **Abas no meio:**
       - **Publicações** — grade estilo Instagram (texto, foto(s), texto+foto misturados)
       - **Projetos/Portfólio** — formato cartão, mais informativo que a grade (nome do projeto, link, repositório); é o elemento que diferencia o perfil de um Instagram/Facebook comum
     - Sem terceira aba na v1, para não encher a interface

---

## 10. Adiado para versões futuras

Decisões conscientes de escopo, não esquecimento:

- **Marketplace** (venda de material, procura de quarto, serviços) — reconhecido como valioso, mas adiado. Cada categoria nova de conteúdo compete por atenção no mesmo feed; melhor validar o core social primeiro.
- **Verificação de identidade** — sem sistema formal na v1. Reavaliar apenas se abuso real justificar.
- **Categorização de tipo de post** — descartado deliberadamente, não só adiado. O mecanismo de destaque resolve o problema sem precisar de categorias.

---

## 11. Stack técnica

Decisão fechada:

- **Frontend/Framework:** Next.js + TypeScript + Tailwind CSS, como PWA (Progressive Web App).
  - Não é HTML/CSS/JS "cru" — é React compilado, mas com controle total de app shell, service worker, cache offline, splash screen e "add to home screen", para aproximar ao máximo a sensação de app nativo sem loja de aplicativos.
  - Caminho futuro (não decidido agora, só mapeado): se for necessário presença nas lojas (App Store/Play Store), embrulhar a mesma base com **Capacitor**, sem reescrever em React Native.

- **Backend/Dados:** Supabase (Postgres + Auth + Storage + API REST + Realtime).
  - **Ambiente de desenvolvimento:** Supabase local via CLI (`supabase start`, requer Docker). Postgres real, mesmo schema, mesmas RLS, mesmos tipos que produção — zero retrabalho de migração.
  - Alternativa se Docker não for viável no ambiente de dev (ex: Termux/Android sem suporte nativo): criar projeto Supabase remoto gratuito desde já e desenvolver direto nele.
  - **Produção:** projeto Supabase remoto (mesmo padrão já usado no Kamby-dev), com as migrations do ambiente local aplicadas via `supabase link` + `supabase db push`.
  - Schema, RLS e lógica de queries desenhados localmente são os mesmos que sobem para produção — só muda o destino da migration.

---

## 12. Segurança

Segurança tratada como requisito de arquitetura, não como camada adicional no fim. Considerada em múltiplas frentes, porque as decisões de produto (login sem confirmação, sem verificação de identidade) aumentam a superfície de risco em pontos específicos que precisam de compensação técnica.

### 12.1. Autenticação e identidade

A decisão de login por telefone **sem confirmação SMS** é uma escolha estratégica consciente (facilitar entrada), mas desloca o risco para outros lugares do sistema. Compensações necessárias:

- **Rate limiting agressivo no endpoint de cadastro/login** — sem isso, criação de contas em massa (bots, spam, ataques de enumeração de números) é trivial. Limitar por IP e por padrão de comportamento, não só por número de telefone.
- **Senhas com hashing forte** (bcrypt/argon2 via Supabase Auth — não implementar hashing manual).
- **Sessões com expiração e renovação via refresh token**, nunca token de vida infinita.
- **Sem SMS não significa sem qualquer verificação futura.** Deixar a arquitetura preparada para adicionar verificação leve mais tarde (ex: verificação por link/e-mail opcional) sem precisar de redesenho de schema.
- **Recuperação de senha por e-mail:** o link de recuperação deve expirar (ex: 15–30 min) e ser de uso único. Nunca reenviar a mesma senha, sempre gerar nova.

### 12.2. Autorização e acesso a dados (RLS)

Como o Supabase usa Postgres com Row Level Security, esta é a linha de defesa mais importante do sistema — não a validação no frontend.

- **Nunca confiar em validação apenas no cliente.** Toda regra de negócio crítica (quem pode ver o quê, quem pode postar como organização, quem pode destacar um post) deve estar em RLS policy no banco, não só em lógica React.
- **Política de post:** usuário só pode criar/editar/apagar os próprios posts. Organizações só podem marcar `destacado = true` se a conta for do tipo `organização` — validado via policy, não via checagem de UI.
- **Política de perfil:** dados de perfil (curso, campus, universidade) legíveis publicamente conforme decisão de produto, mas edição restrita ao dono da conta.
- **Mensagens (DMs):** RLS garantindo que só os dois participantes de uma conversa conseguem ler as mensagens — nunca expor tabela de mensagens sem filtro por participante.
- **Auditoria de policies:** toda nova tabela entra no schema já com RLS ativada por padrão (nunca criar tabela pública sem policy definida — erro comum e perigoso no Supabase).

### 12.3. Prevenção de abuso e spam (compensando a ausência de verificação)

Como a v1 não tem verificação de identidade, o sistema depende de mecanismos automáticos e sociais para conter abuso:

- **Rate limiting de criação de posts e follows** — impede bots de inundar o feed ou seguir em massa artificialmente.
- **Sistema de denúncia funcional desde o dia 1** — não pode ser um botão decorativo; precisa de fila de moderação real, mesmo que manual no início.
- **Shadow-limiting como ferramenta de moderação:** contas denunciadas repetidamente podem ter alcance reduzido automaticamente enquanto aguardam revisão, sem banimento imediato (evita decisões precipitadas, mas contém o dano).
- **Detecção básica de padrão de bot:** criação de várias contas do mesmo dispositivo/IP em curto intervalo deve gerar alerta, mesmo sem bloqueio automático.
- **Conteúdo de imagem:** validar tipo de arquivo e tamanho no upload (nunca confiar na extensão do arquivo — validar o conteúdo real/MIME type), evitando upload de arquivos maliciosos disfarçados de imagem.

### 12.4. Segurança de aplicação (frontend/API)

- **Sanitização de todo input de usuário** antes de renderizar (proteção contra XSS) — especialmente relevante porque posts têm texto livre.
- **Proteção CSRF** nas rotas que alteram estado, se houver alguma API própria fora do Supabase client.
- **Nunca expor a `service_role key`** do Supabase no frontend — só a `anon key`, que respeita RLS. A `service_role` só corre em ambiente server-side controlado (se necessário para alguma função administrativa).
- **Variáveis de ambiente e segredos** nunca commitados no repositório — usar `.env.local` (ignorado no git) e, em produção, variáveis de ambiente da plataforma de hospedagem.
- **HTTPS obrigatório** em produção (padrão em qualquer hospedagem moderna, mas deve ser verificado, não assumido).

### 12.5. Privacidade de dados

- **Minimização de dados:** só coletar o que é necessário para o produto funcionar (número de telefone, e-mail opcional, dados de perfil que o próprio usuário escolhe preencher). Nada de coleta especulativa "para o futuro".
- **Dados sensíveis de perfil (curso, campus) são opcionais e configuráveis pelo usuário** — reforça decisão de produto já tomada (seção 3), mas também é prática de privacidade: dado que o usuário não preenche, não existe para vazar.
- **Política clara sobre quem vê o quê:** conta pode ser **pública ou privada**, à escolha do usuário — inspirado no Instagram. Ativa/desativa quando quiser, sem fricção. Conta privada: posts só visíveis para seguidores aprovados; conta pública: visível a qualquer usuário da rede. Regra a refletir diretamente em RLS — a visibilidade de um post depende do estado `privado` do perfil do autor no momento da leitura, não de um campo fixo no post.

### 12.6. Dependências e infraestrutura

- **Auditoria de dependências** (`npm audit` ou equivalente) como parte do fluxo de desenvolvimento, não só antes de lançar.
- **Backups automáticos do banco** configurados desde que o projeto Supabase de produção for criado — não deixar para depois de já ter usuários.
- **Logs de erro e monitoramento** (ex: Sentry ou equivalente leve) desde a v1, para detectar abuso e falhas cedo, não só depois de reclamação de usuário.

---

## 13. Regras e práticas de desenvolvimento

Alinhado ao padrão já usado no Kamby, Veil e Pulse anterior — a manter consistência entre todos os projetos da Orbion.

- **Documentação viva:** o projeto deve manter `AGENTS.md` (estado atual, decisões, próximos passos) e `ENGINEERING_CONSTITUTION.md` (regras não-negociáveis de arquitetura e design), seguindo o mesmo padrão dos outros projetos.
- **Migrations versionadas:** toda alteração de schema passa por ficheiro de migration no repositório — nunca alteração manual direta no banco de produção.
- **RLS por padrão:** nenhuma tabela nova entra em produção sem RLS policy revisada (ver 12.2).
- **Debate antes de implementar:** decisões estratégicas e de arquitetura são discutidas e registradas antes de qualquer código ser escrito — nenhum ficheiro é alterado durante discussão estratégica, salvo pedido explícito.
- **Copy e microtexto de nível maduro, nunca óbvio.** Onboarding, botões, mensagens de erro, estados vazios — tudo deve soar como escrito por uma equipa de produto experiente, não gerado. Evitar texto explicativo desnecessário (ex: não escrever "Bem-vindo! Aqui você pode criar sua conta" — se a tela já mostra um campo de telefone e um botão "Continuar", isso já comunica sozinho). Referência: como Linear, Notion, Instagram e Apple escrevem — direto, mínimo, sem explicar o óbvio.
- **Zero emojis em qualquer lugar do produto ou do código** — nem em copy, nem em commits, nem em documentação gerada, nem em mensagens de sistema/erro.
- **Ícones sempre de biblioteca séria e consistente** (ex: Lucide, Heroicons, ou equivalente de qualidade profissional) — nunca ícones genéricos, coloridos ou de aparência amadora. Um único set de ícones em todo o produto, nunca misturar estilos.
- **Antes de escrever qualquer copy ou desenhar qualquer tela, observar como apps maduros resolvem o mesmo problema** (Instagram, Linear, Notion, Apple) e replicar o nível de sobriedade — não o conteúdo, o padrão de qualidade.
- **Segurança revisada em cada decisão de produto, não só no fim:** qualquer nova funcionalidade (ex: destaque de post, mensagens, portfólio de perfil) deve responder "quem pode ver isto, quem pode alterar isto, o que impede abuso disto" antes de ser implementada.
- **Testar sempre contra o schema real (Postgres via Supabase local), nunca contra um substituto simplificado** — decisão já tomada na seção 11, reforçada aqui como prática permanente do projeto.

---

## 15. Algoritmo de ranking do feed

Decisão de arquitetura central do produto — é o que faz o feed parecer "vivo e relevante" sem virar caça de curtidas nem depender só de ordem cronológica.

### 15.1. Princípio orientador

O Pulse não otimiza para tempo de tela nem para viralidade. Otimiza para **relevância de conexão** — mostrar o que importa para a rede pessoal do usuário (colegas, campus, interesses), sem deixar contas grandes dominarem só por terem mais seguidores, e sem deixar posts polêmicos subirem só por gerarem reação forte.

### 15.2. As quatro forças do score

Cada post recebe um score no momento em que o feed é montado, combinando:

**1. Afinidade** (peso mais alto)
Relação entre o usuário e o autor do post:
- Segue diretamente > segue mútuo > mesmo campus > mesmo curso/universidade > sem relação
- Histórico de interação prévia (comentou, curtiu, visitou perfil, trocou mensagem) aumenta a afinidade ao longo do tempo — não é estático, é recalculado.

**2. Frescor** (decaimento exponencial, não corte abrupto)
- Posts sociais normais: força cai pela metade a cada ~36 horas.
- Posts destacados (organizações, seção 5): decaimento mais lento durante a janela do destaque, refletindo que o conteúdo (bolsa, edital) tem validade mais longa que um post social.
- Sem corte rígido tipo "desaparece às 24h" — o post só perde peso, nunca é removido do cálculo.

**3. Engajamento normalizado**
- Não usa número bruto de curtidas/comentários — usa **taxa de engajamento relativa ao alcance habitual do autor**.
- Isto evita que contas grandes dominem por padrão: um post de uma conta pequena com resposta forte proporcional compete de igual para igual com uma conta grande.
- Comentário pesa mais que curtida (sinal de conexão real é mais forte que reação passiva).

**4. Destaque** (multiplicador, com teto)
- Aplica o boost já definido na seção 5 (só organizações, limite semanal).
- É multiplicador do score, não substituto — um destaque não pode sozinho superar um post de altíssima afinidade e engajamento genuíno. Evita que a função vire "compra de topo de feed".

### 15.3. Fórmula (conceitual)

```
Score = (Afinidade × peso_afinidade)
      + (Frescor(t) × peso_frescor)
      + (Engajamento_normalizado × peso_engajamento)
      × Multiplicador_destaque (1.0 se não destacado, teto definido se destacado)
```

Pesos exatos (`peso_afinidade`, `peso_frescor`, `peso_engajamento`) são parâmetros a calibrar com dados reais após lançamento — não devem ser hardcoded como verdade absoluta desde o início. Guardar como configuração ajustável, não constante no código.

### 15.4. Casos de borda

- **Conta nova / post novo sem engajamento:** frescor tem peso proporcionalmente maior nas primeiras horas, garantindo janela justa de exposição antes do engajamento (que ainda não existe) decidir o resto.
- **Limite de repetição do mesmo autor:** o feed não deve mostrar múltiplos posts seguidos do mesmo autor de forma consecutiva, mesmo que o score justifique — aplicar espaçamento mínimo entre posts do mesmo autor na renderização final, depois do ranking calculado.
- **Conta silenciada/denunciada (seção 12.3):** score reduzido artificialmente (shadow-limiting) sem bloqueio total, conforme já decidido em segurança.
- **Conta privada:** só entra no cálculo do feed de quem já é seguidor aprovado — nunca aparece no feed de não-seguidores, independentemente do score.

### 15.5. Por que este modelo em vez das alternativas óbvias

- **Vs. cronológico puro:** cronológico trata um post de um amigo próximo igual a um de conhecido distante — perde exatamente a sensação de "a plataforma conhece minha rede", que é o valor central do produto.
- **Vs. engajamento máximo (modelo padrão de redes grandes):** esse modelo empurra para o topo o que gera reação forte (polêmica, humor viral), não o que é relevante para conexão real — para uma camada social universitária, isso é contraproducente, vira concurso de popularidade em vez de utilidade.
- **Normalização de engajamento é o que protege contas pequenas** de serem estruturalmente invisíveis — sem isso, o feed reforça só quem já é grande, contradizendo a ideia de que "conexão baseada em interesse" (seção 2) deve valer mais que audiência prévia.

---

## 16. Próximos passos sugeridos

- [ ] Desenhar wireframes do fluxo de onboarding completo
- [ ] Definir algoritmo de ranking do feed (pesos: pessoal, campus, universidade, destacado)
- [ ] Especificar schema de dados (perfil, post, follow, organização, destaque)
- [ ] Confirmar stack (provavelmente Next.js + Supabase, alinhado ao padrão já usado no Kamby/Veil/Pulse)
- [ ] Produzir AGENTS.md e documento de constituição de engenharia, seguindo o padrão já estabelecido nos outros projetos
