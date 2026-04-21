# Nova Movimentacao - Arquitetura Alvo

## Objetivo

Reestruturar o sistema de movimentacao para um modelo autoritativo no servidor, com input por intencao, simulacao em tick proprio e renderizacao suavizada no cliente.

O alvo e:

- cliente envia apenas intencoes de input
- cliente envia intencoes tanto para `WASD` quanto para `click-to-move`
- servidor guarda o estado canonico dessas intencoes
- servidor simula o deslocamento em loop proprio
- cliente faz predicao/interpolacao visual
- servidor envia correcao apenas quando necessario

## Problema Atual

Hoje o fluxo mistura input, simulacao e streaming continuo de estado.

Principais sintomas:

- o cliente envia `move:intent` a cada frame
- o servidor processa movimento cedo demais no handler
- o servidor replica `move:state` e `entity:delta` com grande volume
- a rede cresce demais quando muitos jogadores estao no mesmo chunk

Isso faz o custo de upload subir muito mais do que o necessario.

## Modelo Desejado

### Cliente

- captura `keydown` e `keyup`
- atualiza um estado local de input
- envia somente mudancas relevantes de input
- envia um evento pontual quando o jogador clicar no chao para mover
- renderiza o personagem com interpolacao/predicao
- corrige a visualizacao quando chegar uma snapshot autoritativa

### Servidor

- recebe input como estado, nao como stream continuo de movimento
- recebe o destino de `click-to-move` como intencao pontual
- guarda flags de movimento por jogador
- roda simulacao em tick fixo
- aplica colisao, velocidade, stamina e limites
- publica posicao autoritativa somente quando houver mudanca relevante ou correcao

### Rede

- input sobe em baixa frequencia
- `click-to-move` sobe um evento por clique
- simulacao nao depende do frame do cliente
- deltas sao enviados por interesse, nao por streaming bruto
- correcoes sao menores e menos frequentes que o estado bruto atual
- `move:state` nao pode ser usado como stream por tick, nem para broadcast nem para o proprio jogador
- suavizacao visual do self nao pode ser resolvida aumentando trafego por tick

## Contrato Funcional

### Entrada do jogador

O jogador deve transmitir algo parecido com:

- direcao atual
- tecla pressionada ou solta
- alvo clicado quando o movimento for por clique
- yaw desejado
- pitch/distancia de camera, se ainda forem autoritativos
- sequencia/contador de input, se necessario para reconciliacao

### Saida do servidor

O servidor pode emitir:

- posicao autoritativa
- yaw autoritativo
- chunk atual
- rev do estado
- vitais, apenas quando mudarem
- spawn/despawn ao cruzar chunk
- delta de entidades proximas
- correcao final quando um deslocamento parar ou divergir

## Reuso Do Que Ja Existe

### Pode ser reaproveitado

- `server/state/presence/*`
- `server/state/runtimeStore.js`
- `server/state/movement/tickOnce/*` como base conceitual
- `server/state/movement/entityMotion/*`
- `server/state/movement/stamina/*`
- `server/socket/handlers/world/*`
- `client/src/world/scene/GameCanvas/*`
- `client/src/world/state/entitiesStore/*`
- `client/src/world/scene/GameCanvas/sceneRuntime/*` como base visual

### Precisa ser refeito

- envio continuo de `move:intent` por frame
- movimento imediato dentro do handler de `WASD`
- broadcast atual de `move:state` como fluxo principal
- contrato atual de movimentacao misturando input, simulacao e resposta
- qualquer dependencia visual que assuma telemetria continua do servidor

## Fluxo Proposto

### 1. Pressionar tecla

- cliente atualiza input local
- cliente envia evento de transicao para o servidor
- servidor marca o input como ativo no runtime

### 2. Clicar no chao

- cliente resolve o ponto clicado localmente
- cliente envia uma unica intencao com o destino
- servidor registra o alvo autoritativo
- simulacao continua no tick ate parada, troca de alvo ou cancelamento

### 3. Tick do servidor

- servidor calcula o delta de tempo
- servidor move o jogador no runtime
- servidor atualiza chunk e rooms quando necessario
- servidor gera deltas apenas quando houver mudanca real ou necessidade de correcao

### 4. Render do cliente

- cliente antecipa o deslocamento visual
- cliente suaviza a transicao entre snapshots
- cliente corrige a posicao quando vier a versao autoritativa

### 5. Soltar tecla ou encerrar alvo

- cliente envia parada ou novo estado
- servidor limpa o input ativo ou substitui o alvo
- simulacao cessa no tick seguinte
- cliente encerra a predicao continua

## Regras Para Nao Deixar Legado

- nao manter o fluxo antigo e o novo ao mesmo tempo por muito tempo
- nao deixar `move:intent` em loop por frame como caminho principal
- nao manter duas fontes de verdade para posicao
- nao espalhar logica de movimentacao em handlers soltos
- nao acoplar render com decisao de simulacao
- nao enviar `move:state` por tick, nem em broadcast nem em unicast para o proprio socket
- nao usar trafego por tick como muleta para compensar predicao, interpolacao ou reconciliacao ruins

## Resultado Esperado

Ao final, o sistema deve ter:

- menor banda de upload
- menor fanout de broadcast
- simulacao previsivel no servidor
- cliente mais leve para renderizacao
- correcoes pontuais em vez de streaming bruto
