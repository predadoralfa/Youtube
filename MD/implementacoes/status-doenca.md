# Sistema de Status - Fever

## Objetivo

Definir a unica doenca hardcoded desta fase: `fever`.

---

## Estrutura

```cpp
Fever:
  Current (0 - 100)
  Severity (0 - 1)
  Config
```

---

## Faixas de Estado

- `100`: sem fever
- abaixo de `100`: fever ativa

---

## Progressao por Tick

A cada varredura autoritativa do servidor:

```cpp
if (roll < chance_up) -> piora
else if (roll < chance_down) -> melhora
else -> mantem
```

Regra atual:

- a varredura acontece a cada `30` minutos de jogo
- isso equivale a `10` minutos reais com o clock atual
- se nao houver fever, o servidor pode iniciar a doenca em um valor baixo
- se houver fever, o servidor pode melhorar ou piorar a barra
- a fever nao derruba imunidade diretamente nesta fase

---

## Relacao com Imunidade

- imunidade alta reduz chance de piorar
- imunidade alta aumenta chance de melhorar
- imunidade baixa faz o oposto
- a chance de inicio da fever segue o mesmo principio de risco da imunidade

## Contrato De Front-End

- o front deve receber `fever` em ingles
- `fever.current` representa a barra de `0` a `100`
- `fever.severity` representa a intensidade calculada em `0` a `1`
- enquanto houver apenas uma doenca, nao existe lista ou tipo dinamico

---

## Severidade

- a severidade deve refletir o pico do evento
- o valor deve ficar entre `0` e `1`
- a severidade ajuda a decidir ganho de max imunidade ao curar
- quando `fever.current` cai, HP e stamina caem proporcionalmente na mesma taxa
- o tratamento medico de base ainda e limitado ao item `HERBS`

---

## Regras de Estado

- `100` significa sem febre
- o sistema precisa permitir evolucao e regressao
- o jogador nao deve ficar preso sem saida
