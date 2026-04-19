# Sistema de Status - Doenca

## Objetivo

Definir um sistema unico de doenca com nivel, severidade e progressao por tick.

---

## Estrutura

```cpp
Disease:
  Level (1 - 10)
  Severity (0 - 1)
  Config
```

---

## Faixas de Estado

- niveis `1-5`: Febre
- niveis `6-10`: Inflamacao

---

## Progressao por Tick

A cada intervalo autoritativo:

```cpp
if (roll < chance_up) -> piora
else if (roll < chance_down) -> melhora
else -> mantem
```

---

## Relacao com Imunidade

- imunidade alta reduz chance de piorar
- imunidade alta aumenta chance de melhorar
- imunidade baixa faz o oposto

---

## Severidade

- a severidade deve refletir o pico do evento
- o valor deve ficar entre `0` e `1`
- a severidade ajuda a decidir ganho de max imunidade ao curar

---

## Regras de Estado

- `Level > 5` significa estado de inflamacao
- o sistema precisa permitir evolucao e regressao
- o jogador nao deve ficar preso sem saida

