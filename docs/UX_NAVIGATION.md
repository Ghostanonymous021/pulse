# Navegacao e chrome

**Regra Apple:** um ecrã = **um** navigation bar no topo. Nunca empilhar header global + header da pagina.

---

## Shell global

| Elemento | Quando |
|----------|--------|
| **Footer (tabs)** | So rotas primarias (`full`) |
| **Header global** | **Nunca.** Cada pagina define o seu top bar. |

---

## Rotas primarias (`full` — so tab bar)

| Rota | Top bar da pagina |
|------|-------------------|
| `/home` | “Pulse” + Explorar + Notificacoes |
| `/explorar` | Campo pesquisar + segmentos Contas/Publicacoes |
| `/mensagens` | Titulo “Mensagens” |
| `/postar` | Titulo “Nova publicacao” |
| `/perfil` | Conteudo do perfil (definicoes no icone do perfil) |
| `/notificacoes` | Titulo + voltar ao home |

## Subpaginas (`bare` — sem tabs)

| Rota | Top bar |
|------|---------|
| `/p/[id]` | Voltar + “Publicacao” |
| `/mensagens/[id]` | Voltar + nome do contacto |
| `/perfil/editar` | Cancelar/Voltar + “Editar perfil” |
| `/perfil/definicoes` | Voltar + “Definicoes” (hub Apple Settings) |
| `/perfil/definicoes/*` | Subtelas (email, senha, mensagens, bloqueados, conexoes, sessoes, denuncias, dados, apagar, legal) |
| `/u/[username]` | Voltar + nome |

## Onboarding (`none`)

Sem tabs, sem top bar de app. So o conteudo do fluxo.

---

## Implementacao

- `getChromeMode()` → `full` | `bare` | `none`
- `AppShell` → apenas footer se `full`
- `PageHeader` → barra unica reutilizavel (titulo / voltar / acoes)
