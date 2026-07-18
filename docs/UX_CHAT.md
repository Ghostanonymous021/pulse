# Chat — experiencia premium (1:1)

**Objectivo:** conversa familiar a WhatsApp, com superficie e tipografia Apple, sem copiar pixels de nenhuma app.

**Inspiracao:**
- **WhatsApp** — layout de thread, datas, reply, reacoes, anexos, composer fixo
- **iMessage / Apple** — bolhas azuis, raios suaves, glass no chrome, espacamento
- **Instagram / Facebook** — inbox com avatar + preview + hora relativa; header com perfil

---

## Layout

| Zona | Comportamento |
|------|----------------|
| Header | Voltar + avatar + nome (+ @username); toque abre perfil |
| Lista | Scroll vertical; novas em baixo; stick-to-bottom inteligente |
| Composer | Fixo no fundo, elevated + blur, safe area |
| Datas | Separadores pill: Hoje, Ontem, ou data (pt-PT) |
| Empty | Avatar do contacto + “Envia a primeira mensagem.” |

## Bolha

- **Tu:** direita, azul sistema (`#007AFF` / dark `#0A84FF`), texto branco
- **Eles:** esquerda, `card` + sombra minima + ring subtil
- **Agrupamento:** bolhas consecutivas do mesmo autor (mesmo dia) com espaco 2px e raios ajustados
- Hora discreta no canto da bolha
- Reply: barra lateral + preview
- Apagada: “Esta mensagem foi apagada”
- Imagens so: full-bleed na bolha (sem padding/moldura de cor); hora sobreposta no canto inferior com gradiente
- Imagens + texto: imagem no topo sem padding; texto com padding normal por baixo
- Multi-imagem: grelha gap 1px (1–4 thumbs, +N se mais); toque abre lightbox
- Documentos: cartao (icone + nome + tamanho) + botao **Descarregar** — **nunca** auto-download; signed URL so sob pedido
- Fotos: toque = lightbox; menu **Guardar foto** / botao guardar no lightbox (share sheet ou download)
- Sticker: emoji grande, sem fundo de bolha pesado
- Pending / falha: progresso circular + **X cancelar envio** (abort upload); “Falhou” se erro

## Composer

- Campo multilinha (cresce ate ~4 linhas)
- **+** a esquerda: menu Galeria / Camera / Ficheiro (max 10 anexos)
- Emoji embutido **dentro** do campo (abre painel sobre o teclado)
- Direita: **microfone** com campo vazio (nota de voz); morfa para **enviar** com texto/anexo
- Audio: toque no mic pede permissao do browser; UI a gravar com timer; parar envia; lixeira cancela
- Preview horizontal dos anexos pendentes; remover um a um ou Limpar
- Stickers acessiveis via painel de emoji
- Modo resposta: chip “A responder” com X

## Gestos / acoes

- Menu na bolha (hover / toque no icone, ou context menu): Responder, Reagir, Copiar, Apagar (so tuas)
- Reacoes: 1 por utilizador (troca se repetir); chips sob a bolha
- Envio **optimista**; peer via **Realtime** (INSERT/UPDATE)

## Inbox (`/mensagens`)

| Elemento | Padrao |
|----------|--------|
| Linha | Avatar 52 · nome · preview · hora relativa |
| Preview | Texto; ou Foto / Documento / Sticker / Mensagem apagada |
| Hora | HH:mm (hoje) · Ontem · dia da semana · data curta |
| Empty | CTA Explorar |

## Fora de v1

Grupos, video-chamada, status de “visto”, encriptacao E2E anunciada, indicadores de escrita.
