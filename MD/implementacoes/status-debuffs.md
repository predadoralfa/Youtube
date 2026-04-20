# Sistema de Status - Debuffs

## Objetivo

Transformar o nivel da doenca em penalidades progressivas sem travar o jogo.

---

## Principio

- o debuff precisa crescer com a doenca
- o debuff nao pode zerar a jogabilidade
- o impacto deve ser felt in gameplay antes de ser sentida como bloqueio

---

## Modelo Base

O efeito principal e multiplicador de tempo:

```cpp
CooldownFinal = Base * (1 + k * Level)
```

Em runtime, o contrato derivado exposto para o cliente e para os sistemas de gameplay usa:

```cpp
tempoMultiplier = 1 .. 2.25
staminaRegenMultiplier = 1 / tempoMultiplier
```

### Fever ativa

- `tier 1-5` -> +10% por nivel
- `tier 6-10` -> +15% por nivel
- quanto maior a severidade, maior o tempo de coleta, craft e combate
- regeneracao de estamina recebe o inverso do multiplicador de tempo

---

## Valores

### Febre `1-5`

- aumento de `10%` por nivel

### Inflamacao `6-10`

- aumento de `15%` por nivel

---

## Areas Afetadas

- coleta
- craft
- combate
- regeneracao de estamina

---

## Regras de Saude do Sistema

- evitar punicao extrema
- manter impacto crescente
- priorizar leitura clara do estado do jogador
