# Sistema de Status - Imunidade

## Objetivo

Definir a camada de imunidade como um sistema lento, progressivo e sensivel ao estado de sono.

---

## Responsabilidades

- resistir a doencas
- recuperar de doencas
- variar com clima, fome e HP
- manter limites minimo e maximo
- cair de forma mais rapida quando fome ou sede ficam baixas
- usar faixas de estado da fome e da sede para perda e recuperacao
- servir como resistencia central para fever sem mexer diretamente em HP ou stamina

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
- a recuperacao atual leva cerca de `8h` de jogo do zero ao cheio
- a perda base leva cerca de `8h` de jogo do cheio ao zero
- o pior caso de fome e sede zeradas dobra a perda e leva cerca de `4h` de jogo do cheio ao zero
- a perda deve ser causada principalmente por fome e sede baixos, com clima e HP como fatores secundarios
- sono nao deve ser a fonte primaria de imunidade, mas enquanto o jogador dorme ele adiciona recuperacao extra
- fever nao deve reduzir imunidade diretamente nesta fase

---

## Recuperacao

- recuperacao total estimada em aproximadamente `8h` de jogo
- o sistema deve ser continuo e nao instantaneo
- a recuperacao nao deve depender de acao manual constante
- a febre e a unica doenca considerada nesta fase

---

## Perda de Imunidade

Fatores:

- clima: influencia pequena
- fome abaixo de `30%`: influencia gradual na perda
- HP abaixo de `90%`: influencia leve
- sede abaixo de `30%`: influencia gradual na perda
- fome ou sede em `0%` ativam o multiplicador maximo de perda
- fome e sede abaixo de `30%` juntos geram agravo adicional
- fome e sede muito baixas representam o pior caso de perda de imunidade e servem como referencia de perda maxima
- a sede tambem pode ser recuperada por fonte ambiental de agua no mapa, como `RIVER_PATCH`
- a agua ambiental recupera a sede em pequenos ciclos com cooldown, nao em preenchimento instantaneo

Direcao:

- clima ruim aumenta perda de forma secundaria
- situacao fragil de sobrevivencia aumenta perda
- situacao normal permite recuperacao
- sono nao entra na formula de perda por fome/sede, mas entra como bonus de recuperacao quando ativo
- a febre nao reduz imunidade diretamente nesta fase
- a febre usa a imunidade como fonte de recuperacao ou piora na varredura periodica

Faixas praticas:

- acima de `30%`: sem perda por fome ou sede
- entre `15%` e `30%`: perda lenta
- entre `5%` e `15%`: perda media
- abaixo de `5%`: perda forte
- fome e sede zeradas aplicam o multiplicador maximo de `2x`
- fome e sede baixas ao mesmo tempo somam efeito e recebem agravo

---

## Chance de Doenca

Formula base:

```cpp
Chance = 1 - (Current / Max)
```

Onde `Chance` e sempre limitada entre `0` e `1`.

Na pratica atual:

- a chance de inicio da febre vem do risco residual da imunidade
- o jogador com `90%` de imunidade tem cerca de `10%` de chance de ganhar febre na varredura
- o mesmo raciocinio vale para a reducao quando a febre ja esta instalada

---

## Papel no Jogo

- criar resistencia dinamica
- tornar risco relevante
- permitir que risco gere progressao
