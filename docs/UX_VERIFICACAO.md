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

- Roseta (scalloped seal) estilo Instagram
- Gradiente azul → violeta
- Check branco

Referência visual do produto: selo IG de qualidade / marca verificada (não WhatsApp verde).

## Onde aparece

- Perfil, posts (junto ao nome), Explorar.
- **Nunca** no cálculo de ranking do feed principal.

## Futuro (não agora)

1. Fluxo 5 ecrãs (valor → requisitos → documentos → M-Pesa → confirmação)
2. Pagamento real + revisão de documentos
3. Destaques 3→6, stats e multi-admin ligados ao selo pago
