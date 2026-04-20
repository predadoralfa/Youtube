# Sistema de Status - Economia Medica

## Objetivo

Manter o medico relevante dentro da economia do jogo, reforcando recuperacao e combate sem eliminar a necessidade de cooperacao.

---

## Funcoes do Medico

- acelerar recuperacao
- reduzir progressao da doenca
- curar em combate com skill ativa
- tratar itens consumiveis com efeito medico

---

## Diferenciacao

- auto-tratamento: menos eficiente
- medico: mais eficiente
- a infraestrutura server-side de tratamento medico e baseada em item

## Base Implementada

- evento de uso medico no inventario: `inv:medicate`
- `HERBS` cura `5%` de HP
- `HERBS` tem cooldown de `1` hora de jogo entre usos
- payload de item agora exibe `canMedicate`
- `HERBS` existe como item medicinal em ingles com research propria
- `HERBS_PATCH` existe como fonte coletavel no mapa para abastecer esse item
- `HERBS` pesa 50g, coleta em 1 unidade e libera uso medicinal no nivel 3 de research
- a profissao de medico e os bonus de especializacao ainda ficam para uma fase futura

---

## Resultado Esperado

- o jogador continua jogando com penalidade
- o medico reduz perda de eficiencia
- a economia passa a ter demanda natural por suporte
