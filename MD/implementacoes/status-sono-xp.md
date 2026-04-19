# Sistema de Status - Sono e XP

## Objetivo

Aplicar modificador de XP por nivel de sono, como sistema de incentivo e nao de punicao pesada.

---

## Funcao

- alterar o ganho de XP por atividade
- permitir ajuste dinamico pelo servidor
- incentivar comportamento desejado sem travar progresso

---

## Regra Base

```cpp
XP_mult = funcao(SleepLevel)
```

---

## Faixa de Resultado

- maximo: `+20%`
- minimo: `-10%`

---

## Intencao de Design

- sono deve ser um buff flexivel
- sono nao deve atuar como barreira central de sobrevivencia
- o servidor pode ajustar o peso para balanceamento

