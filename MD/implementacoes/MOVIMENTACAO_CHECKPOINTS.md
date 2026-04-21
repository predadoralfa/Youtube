# Checkpoints Da Nova Movimentacao

## Fase 0 - Congelar O Escopo

### Entrega

- definir o modelo final de input, simulacao e correcao
- listar o que sera removido do legado
- confirmar quais rooms e eventos continuam existindo

### Pronto Quando

- existe um contrato unico de movimentacao
- existe uma lista clara do que sera deletado depois da migracao

## Fase 1 - Contrato De Input

### Entrega

- criar a representacao canonica do estado de input no servidor
- definir payloads de press/release e estado de tecla
- definir payload de destino para `click-to-move`
- definir sequencia de input, se for necessaria

### Pronto Quando

- o servidor consegue saber que o jogador esta andando sem depender de spam por frame
- o servidor consegue continuar um deslocamento por clique sem retransmissao por tick

## Fase 2 - Store Autoritativa

### Entrega

- criar store de input por usuario em memoria
- ligar esse estado ao runtime existente
- registrar inicio e fim de movimento

### Pronto Quando

- o runtime consegue responder "o jogador esta andando ou parado" a qualquer momento

## Fase 3 - Simulacao No Servidor

### Entrega

- mover a logica de deslocamento para um tick fixo do servidor
- aplicar velocidade, stamina, limites e colisao
- atualizar chunk e rooms de interesse

### Pronto Quando

- a posicao real do jogador muda mesmo sem o cliente ficar reenviando movimento a cada frame

## Fase 4 - Reconciliacao

### Entrega

- enviar correcao autoritativa quando o cliente divergir
- manter rev por entidade
- evitar correcoes excessivas

### Pronto Quando

- o front consegue se alinhar ao servidor sem teleporte visual constante

## Fase 5 - Predicao E Interpolacao No Cliente

### Entrega

- prever movimento localmente
- suavizar transicoes entre snapshots
- separar render de decisao de gameplay

### Pronto Quando

- o movimento fica fluido mesmo com rede oscilando

## Fase 6 - Limpeza De Replicacao

### Entrega

- reduzir o uso de `move:state` como stream continuo
- manter apenas correcoes e eventos realmente necessarios
- revisar `entity:delta`, `entity:spawn` e `entity:despawn`
- proibir explicitamente qualquer retorno de `move:state` por tick, inclusive para o proprio jogador

### Pronto Quando

- a banda cai de forma clara
- o fluxo de replica fica previsivel

## Fase 7 - Remocao De Legado

### Entrega

- remover o caminho antigo de movimento por frame
- apagar handlers e helpers que ficarem obsoletos
- eliminar duplicidade de logica

### Pronto Quando

- nao existe mais dependencia do fluxo antigo
- nao sobra codigo morto de movimento continuo

## Fase 8 - Validacao

### Entrega

- testar um jogador
- testar varios jogadores no mesmo chunk
- medir banda, CPU e latencia
- validar reconexao, resync e chunk transition

### Pronto Quando

- o sistema fica estavel em carga realista
- os custos batem com a estimativa planejada

## Ordem Sugerida De Execucao

1. contrato de input
2. store autoritativa
3. simulacao no servidor
4. reconciliacao
5. predicao e interpolacao
6. limpeza de replicacao
7. remocao de legado
8. validacao final

## Criterio De Corte Do Legado

Nao considerar a migracao concluida enquanto existir qualquer um destes:

- envio continuo de movimento por frame como fluxo principal
- duas fontes de verdade para a posicao
- logica de movimento espalhada em mais de um caminho autoritativo
- cliente tomando decisao de simulacao
- `move:state` sendo usado por tick como fluxo principal, mesmo em unicast para o self
