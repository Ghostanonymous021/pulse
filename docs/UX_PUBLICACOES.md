# Publicacoes — comportamento e estetica

**Inspiracao:** qualidade Apple + clareza Facebook/Instagram — **sem copiar** nenhum.  
**Objectivo:** limpo, estavel, zero UI a saltar.

---

## 1. Enquadramento do post (feed)

- **Sem** cartao flutuante (sem sombra, sem borda arredondada a envolver o post).
- Fundo do feed = fundo da app; posts separados por **uma linha fina** (separator).
- Padding horizontal so no texto/header/acoes; media **full-bleed** (largura total do contentor).

Hierarquia vertical:
1. Autor (avatar + nome + meta)
2. Media (se houver)
3. Texto (se houver)
4. Acoes (gosto / comentarios)

---

## 2. Media — tamanho estavel (critico)

Problema: fotos portrait/landscape/square com alturas livres **partem o scroll e a UI**.

**Regra (Pulse):**
- Contentor de media no feed: **aspect-ratio fixo 4:5** (altura estavel, scroll nao salta).
- Imagem: **`object-contain`** + `object-center` — mostra a foto **inteira** (estilo Facebook/X).
  - Instagram usa `object-cover` e corta; o utilizador faz crop no compose. Pulse nao corta no feed.
- Fundo do contentor: `muted` (letterbox / pillarbox quando a ratio nao e 4:5).
- Multi-foto: carousel **dentro** do mesmo contentor 4:5; cada slide `object-contain`.
- Contador discreto `n / total` no canto; dots finos em baixo.

No **detalhe**: mesma moldura. No **lightbox**: `object-contain` em ecran cheio (foto completa).

Grelha do **perfil**: continua `object-cover` (thumbnails — crop e aceitavel).

---

## 3. Toque na foto

| Contexto | Accao |
|----------|--------|
| Feed | Abrir **detalhe da publicacao** `/p/[id]` |
| Detalhe (toque na media) | Abrir **lightbox** full-screen (fundo preto, swipe entre fotos, fechar) |
| Lightbox | Swipe / setas; fechar por X ou toque no fundo |

Nao abrir URL crua da imagem no browser.

---

## 4. Texto longo

- Feed: clamp ~4 linhas + `mais`
- Detalhe: texto completo
- Curso/campus nunca no post

---

## 5. Comentarios

Arvore rasa (1 nivel de reply) + gostos em comentarios — ver iteracao anterior.

---

## 6. Perfil

### Foto de perfil
| Contexto | Accao |
|----------|--------|
| Proprio perfil | Toque → action sheet: **Ver foto** \| **Alterar foto** |
| Terceiro (com foto) | Toque → lightbox ecran cheio |
| Terceiro (sem foto) | Sem interacao |

Lightbox: fundo escurecido, fechar por X ou toque no fundo. Sheet: mesma linguagem do menu de publicacao.

### Abas (sempre visiveis)
- **Publicacoes** — grade 3 colunas (foto ou preview de texto); vazio: "Ainda sem publicacoes."
- **Portfolio** — cartoes (titulo, descricao, link, repositorio); vazio: "Ainda sem projetos."

Estados vazios independentes por aba. Troca client-side, sem reload.
