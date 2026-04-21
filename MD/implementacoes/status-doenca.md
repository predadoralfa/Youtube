# Sistema de Status - Fever

## Objetivo

Definir a unica doenca hardcoded desta fase: `fever`.

---

## Estrutura

```cpp
Fever:
  Current (0 - infinito)
  Severity (0 - 1)
  Percent (0 - 100)
```

---

## Faixas de Estado

- `0`: sem fever
- acima de `0`: fever ativa

---

## Progressao por Tick

A fever e resolvida por varreduras autoritativas do servidor.

Regras atuais:

- a varredura acontece a cada `1` minuto de jogo
- a fever comeca em `0` e cresce em passos de `2`
- se o jogador nao estiver dormindo e a rolagem aleatoria ficar acima do risco residual da imunidade, a fever sobe `2`
- se o jogador nao estiver dormindo e a rolagem ficar dentro da imunidade atual, a fever desce `1`
- se o jogador estiver dormindo, a fever nao inicia e qualquer fever ativa recua `1` no tick
- a fever nao derruba imunidade diretamente nesta fase
- quando a febre muda, o servidor autoritativo atualiza o runtime e dispara persistencia do status

---

## Relacao com Imunidade

- a chance de adquirir fever e `1 - (imunidade atual / imunidade maxima)`
- imunidade alta reduz chance de piorar
- imunidade baixa aumenta chance de piorar
- quando a fever ja existe, a mesma rolagem decide entre subir `2` ou descer `1`

---

## Contrato de Front-End

- o front deve receber `fever` em ingles
- `fever.current` representa a carga acumulada da doenca, com `0` sendo saudavel
- a barra visual deve usar o percentual autoritativo do servidor
- o texto da UI deve mostrar apenas o valor atual, sem `current/max`
- `fever.percent` representa o preenchimento visual em `0` a `100`
- `fever.severity` representa a intensidade calculada em `0` a `1`
- enquanto houver apenas uma doenca, nao existe lista ou tipo dinamico

---

## Severidade

- a severidade deve refletir o pico do evento
- o valor deve ficar entre `0` e `1`
- a severidade deriva de `fever.current / 100` e e usada para debuffs e persistencia
- quando `fever.current` cai, a doenca apenas avanca ou regrede; HP e stamina nao sao drenados diretamente por fever
- o tratamento medico de base nao entra neste contrato

---

## Regras de Estado

- `0` significa sem febre
- o sistema precisa permitir evolucao e regressao
- o jogador nao deve ficar preso sem saida
