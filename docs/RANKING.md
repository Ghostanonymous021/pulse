# Feed ranking — doc §15 + adenda tipo de conta

## Princípio

Relevância de **conexão**, não viralidade.  
`is_verified` / selo pago de **pessoa** **nunca** entra no ranking.

## Pipeline (ordem obrigatória)

```
1. Candidatos (RLS)
2. filterEligibleCandidates  ← privado: só seguidores aprovados
3. computeBaseScore            ← A×wa + F×wf + E×we  (igual para todos)
4. applyScoreModifiers         ← M_destaque × M_shadow
5. sort by score
6. applyAuthorSpacing          ← sem 2 autores iguais consecutivos
7. paginação
```

## Fórmula

```
Base  = A×wa + F×wf + E×we
Score = Base × M_destaque × M_shadow
```

| Conta | No ranking |
|-------|------------|
| Pessoa | Base só |
| Pessoa verificada (paga) | Base só — **zero** bónus `verified` |
| Organização | Base + M_destaque se post destacado (teto 1.5) |
| Org verificada (paga) | **Mesmo** M_destaque; limite semanal 3→6 no **DB** (`highlight_weekly_limit_for`) |
| Privada | **Filtro** pré-score: só se follow aceite (ou self) |
| Shadow (reports) | Base × factor (default 0.3) se reports abertos ≥ limiar |

## Config

`config/ranking.json` + env opcional (`RANKING_*`).

## Código

| Módulo | Papel |
|--------|--------|
| `score.ts` | Base A/F/E puro |
| `modifiers.ts` | Elegibilidade + multiplicadores pós-score |
| `spacing.ts` | Intercalar autores |
| `load-signals.ts` | Queries |
| `rank-feed.ts` | Orquestração |

## Testes

```bash
npm test
```
