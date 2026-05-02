# Painel De FPS / Desempenho

## Objetivo

Este documento registra a implementacao do painel de FPS e tempo de frame usado apenas para debug visual no frontend.

O painel serve para observabilidade local da renderizacao Three.js.
Ele nao altera snapshot, runtime, movimentacao, combate, inventario, socket ou persistencia.

## Escopo

O painel:

- aparece no cliente durante desenvolvimento
- mede FPS e ms por frame usando `Stats` do Three.js
- fica acoplado ao ciclo de vida do `GameCanvas`
- e removido no cleanup da cena

Fora de escopo:

- backend
- banco
- socket
- bootstrap
- estado global do jogo
- qualquer logica de gameplay

## Arquitetura

### Helper

Arquivo principal:

- [createStatsPanel.js](/D:/JS-Projects/Youtube/client/src/world/scene/debug/createStatsPanel.js)

Responsabilidades:

- criar `new Stats()`
- anexar o painel em um container confiavel
- aplicar estilo fixo no canto da tela
- evitar duplicacao quando a cena remonta
- expor `dispose()` para remover o DOM com seguranca

### Integracao No Renderer

Arquivos relacionados:

- [setup.js](/D:/JS-Projects/Youtube/client/src/world/scene/GameCanvas/sceneRuntime/setup.js)
- [tick.js](/D:/JS-Projects/Youtube/client/src/world/scene/GameCanvas/sceneRuntime/useSceneRuntime/tick.js)
- [cleanup.js](/D:/JS-Projects/Youtube/client/src/world/scene/GameCanvas/sceneRuntime/cleanup.js)
- [useSceneRuntime.js](/D:/JS-Projects/Youtube/client/src/world/scene/GameCanvas/sceneRuntime/useSceneRuntime.js)

Fluxo:

1. `setupSceneRuntime()` cria o renderer Three.js.
2. Nesse mesmo momento, o helper do Stats e criado e anexado ao container.
3. O loop de `requestAnimationFrame` chama `stats.update()` uma vez por frame.
4. No cleanup da cena, o painel e removido do DOM.

## Regra De Ativacao

O painel segue esta prioridade:

- em desenvolvimento, aparece por padrao
- `VITE_SHOW_STATS=false` desliga
- `VITE_SHOW_STATS=true` pode forcar exibicao
- em producao, nao aparece por padrao

Implementacao base:

- `import.meta.env.DEV`
- `import.meta.env.VITE_SHOW_STATS`

## Posicionamento

O painel e anexado fora do fluxo de React e nao participa do layout do HUD.

Caracteristicas visuais:

- `position: fixed`
- `top: 0`
- `left: 0`
- `z-index` alto
- `pointer-events: none`

Isso evita interferencia com o HUD e com a interacao do jogo.
O painel de `World Debug` fica ancorado do lado direito, entao o FPS foi movido para a esquerda para evitar sobreposicao.

## Invariantes

- o painel nunca e fonte de estado do jogo
- o painel nunca interfere no snapshot
- o painel nunca altera a camera, cena ou input
- o painel pode ser removido sem afetar a partida

## Validacao

Comportamento esperado:

- `npm run dev` mostra o painel
- `npm run build` nao exibe o painel por padrao
- hot reload nao deixa multiplos painéis acumulados

## Relacao Com A Arquitetura

Esse painel segue a mesma regra geral do cliente:

- o backend continua autoritativo
- o cliente apenas renderiza e envia intents
- o debug de performance nao altera a simulacao
