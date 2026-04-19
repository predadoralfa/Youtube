# Sistema de Status - Imunidade

## Objetivo

Definir a camada de imunidade como um sistema lento, progressivo e independente de fome e sono.

---

## Responsabilidades

- resistir a doencas
- recuperar de doencas
- variar com clima, fome e HP
- manter limites minimo e maximo

---

## Estrutura

```cpp
Immunity:
  Current
  Max (100 - 500)
```

---

## Regras

- `Current` nunca deve passar de `Max`
- `Max` nunca deve sair do intervalo `100..500`
- recuperacao deve ser lenta o bastante para sustentar gameplay
- a perda deve ser causada principalmente por clima
- fome e HP entram como fatores secundarios

---

## Recuperacao

- recuperacao total estimada em aproximadamente `24h` de jogo
- o sistema deve ser continuo e nao instantaneo
- a recuperacao nao deve depender de acao manual constante

---

## Perda de Imunidade

Fatores:

- clima: principal influencia
- fome abaixo de `10%`: influencia leve
- HP abaixo de `90%`: influencia leve

Direcao:

- clima ruim aumenta perda
- situacao fragil de sobrevivencia aumenta perda
- situacao normal reduz impacto negativo

---

## Chance de Doenca

Formula base:

```cpp
Chance = BaseChance * (1 - Current / Max)
```

Restricao:

```cpp
Chance >= MinChance
```

Onde `MinChance` fica na faixa de `2%` a `5%`.

---

## Papel no Jogo

- criar resistencia dinamica
- tornar risco relevante
- permitir que risco gere progressao

