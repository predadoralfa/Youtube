# Plano de Implementacao do Sistema de Status

## Objetivo

Este documento organiza a atualizacao do sistema de status em blocos pequenos, com ordem de implementacao, dependencias e criterios claros de conclusao.

A regra principal e simples:

- primeiro documentar
- depois implementar o nucleo de integracao
- em seguida aplicar imunidade, doenca, debuffs, sono e economia
- por fim revisar balanceamento e consolidar

---

## Sistemas Envolvidos

- `fome`: base de sobrevivencia e regeneracao
- `sono`: multiplicador de XP por atividade
- `imunidade`: resistencia, perda e recuperacao
- `fever`: progressao por barra unica e severidade
- `debuffs`: penalidades progressivas
- `economia_medica`: relevancia do medico e cura especializada

---

## Ordem Logica de Implementacao

### Fase 1 - Base documental e contrato de design

Objetivo:

- registrar o consolidado do sistema
- separar cada subsistema em documento proprio
- criar checklist temporario de execucao

Saida esperada:

- documentos criados
- ordem de execucao definida
- escopo fechado por modulo

### Fase 2 - Estrutura de dados e integracao base

Objetivo:

- definir modelos, campos e runtime necessario
- localizar onde cada stat vive no servidor
- manter compatibilidade com o que ja existe

Saida esperada:

- contrato tecnico entre estado atual e novo sistema
- pontos de integracao mapeados

### Fase 3 - Imunidade

Objetivo:

- implementar current/max
- aplicar recuperacao lenta
- aplicar perda por clima, fome e HP
- calcular chance de doenca com base na imunidade

Saida esperada:

- imunidade funcional em runtime e persistencia

### Fase 4 - Fever

Objetivo:

- implementar barra unica de `fever`
- aplicar progresso/regresso por tick
- ligar severidade e imunidade ao ciclo da febre

Saida esperada:

- fever evoluindo de forma autoritativa

### Fase 5 - Debuffs

Objetivo:

- transformar nivel da doenca em penalidade progressiva
- evitar travamento total de gameplay
- afetar coleta, craft, combate e estamina

Saida esperada:

- penalidade perceptivel, mas jogavel

### Fase 6 - Sono

Objetivo:

- aplicar bonus/penalidade de XP por nivel de sono
- bloquear o inicio do sleep acima de `50%`
- conceder bonus extra de recuperacao de imunidade enquanto estiver dormindo
- manter ajuste dinamico no servidor

Saida esperada:

- XP sensivel ao estado de sono e imunidade beneficiada durante o descanso

### Fase 7 - Economia e medico

Objetivo:

- reforcar a profissao de medico
- diferenciar auto-tratamento de cura especializada
- criar demanda economica natural

Saida esperada:

- medicina com papel funcional real

### Fase 8 - Balanceamento e consolidacao

Objetivo:

- revisar pesos, limites e formulas
- validar experiencia emergente
- fechar lacunas de documentacao

Saida esperada:

- sistema pronto para iteracao futura

---

## Dependencias Principais

- imunidade depende de clima, fome e HP
- fever depende de imunidade e tick autoritativo
- debuffs dependem do nivel da fever
- sono depende do sistema de XP por atividade
- economia depende da existencia de doenca e recuperacao

---

## Criterios de Aceite do Conjunto

- o sistema nao pode travar o jogador de forma absoluta
- o servidor precisa continuar sendo a fonte da verdade
- as formulas precisam ser configuraveis
- os efeitos precisam ser progressivos
- o desenho deve permitir balanceamento sem refatoracao grande

---

## Documentos Relacionados

- [Contrato tecnico](./status-contrato-tecnico.md)
- [Imunidade](./status-imunidade.md)
- [Doenca](./status-doenca.md)
- [Debuffs](./status-debuffs.md)
- [Sono](./status-sono-xp.md)
- [Economia medica](./status-economia-medica.md)
