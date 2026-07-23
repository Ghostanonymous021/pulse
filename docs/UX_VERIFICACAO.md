# UX — Selo de verificação

Entrada: **Definições → Conta → Selo de verificacao**.

## Estado actual (v1)

- Self-serve / pagamento / upload de documentos: **Em breve** (ecrã informativo apenas).
- Activação **manual** no Supabase pela equipa.
- Utilizadores sem selo veem "Em breve"; com selo veem "Activo".

### Activar manualmente (admin)

Table Editor → `profiles` da conta:

| Coluna | Valor |
|--------|--------|
| `is_verified` | `true` |
| `verified_type` | `pessoa` ou `organizacao` (opcional; badge fallback = `account_type`) |
| `verified_at` | `now()` (opcional) |
| `verification_expires_at` | data futura ou null (opcional) |

Triggers de protecção bloqueiam o cliente de se auto-verificar. Updates via service_role / Table Editor (bypass com role admin) ou RPC `activate_verification` (service_role only).

## Badge

Componente: `VerifiedBadge` (`src/components/social/verified-badge.tsx`).

- Disco azul sólido + check branco (sem gradiente, sem roseta/scalloped seal)
- Mesma forma para `pessoa` e `organizacao` — `accountType` fica na API
  para o label acessível e para uma futura variação institucional
  distinta, mas a marca visual em si não bifurca por tipo de conta hoje.

Referência visual do produto: check azul clássico usado por X/Twitter,
Facebook e o Instagram actual (não a roseta gradiente antiga da v1, não
o verde do WhatsApp).

**Fonte única de verdade**: qualquer superfície que mostra o nome de um
perfil verificado deve renderizar este componente — nunca reimplementar
o selo inline — para o badge permanecer visual e comportamentalmente
idêntico em toda a app.

## Onde aparece

- Perfil, posts (junto ao nome), Explorar (contas e publicações),
  listas de pessoas (seguidores / a seguir / sugestões), **e
  comentários** (comentários de primeiro nível e respostas, incluindo o
  comentário optimista mostrado logo após publicar).
- Padrão de implementação em cada superfície:
  1. A query busca `is_verified, verified_type, verification_expires_at, account_type`
     do autor.
  2. `isVerificationActive(profile)` decide se o selo aparece.
  3. `verificationBadgeType(profile)` decide o tipo do badge.
  4. `<VerifiedBadge accountType={...} size="sm|md|lg" />` é renderizado
     junto ao nome.
  Ver `src/lib/settings/verification.ts` para as duas funções
  auxiliares. Ao adicionar uma nova superfície com nomes de perfis,
  seguir este mesmo padrão em vez de inventar um caminho novo — foi a
  ausência dele em `comment-thread.tsx` que causou a inconsistência
  original do selo nos comentários.
- **Nunca** no cálculo de ranking do feed principal.

## Futuro (não agora)

1. Fluxo 5 ecrãs (valor → requisitos → documentos → M-Pesa → confirmação)
2. Pagamento real + revisão de documentos
3. Destaques 3→6, stats e multi-admin ligados ao selo pago
