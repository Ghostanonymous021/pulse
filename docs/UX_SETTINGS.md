# UX — Definições

Padrão **Apple Settings**: blocos com título discreto + lista inset, separadores finos, sem sombras.

## Blocos

| Grupo | Itens |
|-------|--------|
| Conta | Editar perfil, e-mail, telefone (só leitura), senha, modo profissional*, selo* |
| Privacidade | Conta privada (toggle), quem pode DM, bloqueados, seguidores/a seguir |
| Notificações | 5 toggles (nunca master) |
| Segurança | Sessões activas, terminar todas, denúncias |
| Conteúdo e dados | Descarregar, apagar conta |
| Sobre | Versão, termos, privacidade, ajuda |

\* Entradas de produto (fora da lista mínima original) — pontos de entrada obrigatórios.

## Segurança prioritária

- **Conta privada** → `profiles.is_private` (RLS update own).
- **Sessões** → lista `auth.sessions` + `signOut({ scope: "global" })`.
- **Apagar conta** → confirmação `apagar` + API service_role.

## Copy

Mínima. O label comunica sozinho. Zero emojis. Lucide only.
