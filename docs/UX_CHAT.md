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

- Menu na bolha (hover / toque no icone, ou context menu): Responder, Reagir, Copiar, Reencaminhar, Fixar/Desafixar, Apagar para mim, Apagar para todos (so tuas)
- Reacoes: 1 por utilizador (troca se repetir); chips sob a bolha
- Envio **optimista**; peer via **Realtime** (INSERT/UPDATE)
- **Apagar para mim:** esconde a mensagem so na minha vista (`message_hides`); nao toca na copia do remetente nem do outro participante
- **Apagar para todos:** so o remetente, mantem `deleted_at`/"Esta mensagem foi apagada" (comportamento pre-existente)
- **Reencaminhar:** copia corpo + anexos para outra conversa existente, sem atribuicao ao chat de origem (mesma logica do WhatsApp); mostra etiqueta discreta "Reencaminhada"
- **Fixar mensagem:** partilhado entre os 2 participantes (nao e por utilizador); barra fixa no topo da thread, toque salta para a mensagem
- **Ticks de entrega:** ✓ enviado / ✓✓ entregue na ultima mensagem minha; **nunca** azul, **nunca** "visto"/read receipt (fora de v1, ver abaixo)
- **Link preview em bolha:** OG fetch server-side apos envio (nunca no render), mesmo guard-rail SSRF dos posts
- **Busca na conversa:** campo no header alterna um painel de resultados; toque salta e realca a mensagem

## Inbox (`/mensagens`)

| Elemento | Padrao |
|----------|--------|
| Linha | Avatar 52 · nome · icone de tipo de media · preview · hora relativa |
| Preview | Texto; ou Foto / Documento / Sticker / Mensagem apagada |
| Hora | HH:mm (hoje) · Ontem · dia da semana · data curta |
| Empty | CTA Explorar |
| Busca | Campo no topo filtra por nome, @username ou texto da ultima mensagem |
| Long-press / context menu | Fixar, Silenciar, Arquivar (por participante — nao afeta o outro lado) |
| Arquivadas | Seccao colapsavel no fim da lista, fora do badge de nao lidas |
| Silenciada | Nao acende o badge/ponto laranja; continua a aparecer em negrito na lista |

## Fora de v1

Grupos, video-chamada, status de “visto” (read receipt), encriptacao E2E anunciada, indicador “a escrever...”.

Ticks de entrega (✓/✓✓) sao um sinal mais fraco que "visto" — dizem apenas que a mensagem chegou ao cliente do outro participante enquanto online, nunca que foi lida/vista. Isto ficou fora da decisao original desta doc por nao existir na v1; foi adicionado depois com aprovacao explicita do utilizador, sem contradizer a exclusao de read receipts (visto)/typing indicator, que permanecem fora do escopo.
