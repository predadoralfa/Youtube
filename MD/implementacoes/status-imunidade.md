# Sistema de Status - Imunidade

## Objetivo

Definir a camada de imunidade como um sistema lento, progressivo e independente de sono.

---

## Responsabilidades

- resistir a doencas
- recuperar de doencas
- variar com clima, fome e HP
- manter limites minimo e maximo
- cair rapidamente quando fome ou sede zeram

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
- sono nao deve afetar imunidade diretamente

---

## Recuperacao

- recuperacao total estimada em aproximadamente `24h` de jogo
- o sistema deve ser continuo e nao instantaneo
- a recuperacao nao deve depender de acao manual constante
- a febre e a unica doenca considerada nesta fase

---

## Perda de Imunidade

Fatores:

- clima: principal influencia
- fome abaixo de `10%`: influencia leve
- HP abaixo de `90%`: influencia leve
- sede abaixo de `10%`: influencia leve
- fome ou sede em `0%` aceleram fortemente a perda de imunidade

Direcao:

- clima ruim aumenta perda
- situacao fragil de sobrevivencia aumenta perda
- situacao normal reduz impacto negativo
- sono nao entra neste calculo
- a febre nao reduz imunidade diretamente nesta fase
- a febre usa a imunidade como fonte de recuperacao ou piora na varredura periodica

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

Na pratica atual:

- a chance de inicio da febre vem do risco residual da imunidade
- o jogador com `90%` de imunidade tem cerca de `10%` de chance de ganhar febre na varredura
- o mesmo raciocinio vale para a recuperacao quando a febre ja esta instalada

---

## Papel no Jogo

- criar resistencia dinamica
- tornar risco relevante
- permitir que risco gere progressao
