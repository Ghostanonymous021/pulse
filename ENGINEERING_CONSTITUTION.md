# Engineering Constitution — Pulse

**Status:** regras nao-negociaveis de engenharia  
**Par com:** `PULSE_VISAO_PRODUTO.md`, `AGENTS.md`, `docs/SCHEMA.md`  
**Ultima atualizacao:** 18/07/2026

---

## 1. Fonte da verdade

1. Produto e escopo: `PULSE_VISAO_PRODUTO.md`
2. Como trabalhar: `AGENTS.md`
3. Dados e RLS: `docs/SCHEMA.md` + `supabase/migrations/*`

Conflito entre codigo e estes documentos = o documento ganha ate Mallony decidir o contrario.

## 2. Stack

- Next.js + TypeScript + Tailwind, app como PWA
- Supabase: Postgres, Auth, Storage, Realtime
- Cliente: apenas `anon` key; `service_role` so em servidor controlado
- Migrations versionadas; nunca alterar producao a mao

## 3. Seguranca

- Toda tabela nova com RLS no mesmo commit
- Autorizacao critica no banco, nao so no React
- Rate limiting em signup, posts e follows
- Input sanitizado; validacao MIME real em uploads
- Sem emojis no produto, commits ou docs gerados
- Segredos fora do git (`.env.local`)

## 4. Produto no codigo

- Um feed, um formato de post (texto / foto / ambos)
- Sem categorias de post; destaque so para `organizacao`
- Metadado de curso/campus/ano so no perfil
- Conta publica/privada controlada pelo utilizador
- Copy minima e madura; icones de um unico set (Lucide)

## 5. Qualidade

- Debate antes de implementar decisoes de arquitetura
- Testar RLS com dono vs terceiro e publico vs privado
- Preferir componentes reutilizaveis centralizados
- Nao implementar marketplace, verificacao formal ou tipos de post na v1
