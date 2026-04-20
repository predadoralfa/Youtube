# Sistema de Status - Sono e XP

## Objetivo

Aplicar modificador de XP por nivel de sono, como sistema de incentivo e nao de punicao pesada.

---

## Funcao

- alterar o ganho de XP por atividade
- permitir ajuste dinamico pelo servidor
- incentivar comportamento desejado sem travar progresso
- nao interferir diretamente na imunidade

---

## Regra Base

```cpp
XP_mult = funcao(SleepLevel)
```

---

## Faixa de Resultado

- maximo: `+20%`
- minimo: `-10%`
- acima de `30%` de sono o jogador recebe bonus
- abaixo de `30%` de sono o jogador recebe penalidade leve
- a barra de sono tem maximo fixo em `100`
- a barra recua com o tempo fora da cama e, no ritmo atual, esvazia em `24h` de jogo
- ao dormir, a barra recupera e volta a `100` em `3h` de jogo

### Formula de referencia

```cpp
if (sleep >= 30) {
  XP_mult = 1 + ((sleep - 30) / 70) * 0.20
} else {
  XP_mult = 1 - ((30 - sleep) / 30) * 0.10
}
```

---

## Intencao de Design

- sono deve ser um buff flexivel
- sono nao deve atuar como barreira central de sobrevivencia
- o servidor pode ajustar o peso para balanceamento
- sono e o sistema de XP, nao de resistencia a doenca

Nome de front-end:

- o front deve exibir sono como estado de XP, em ingles, sem usar o termo de doenca
