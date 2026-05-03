# Guia Unificado: FPS, Terreno e Luz

## Objetivo

Este documento centraliza a orientacao tecnica dos tres blocos que estavam fragmentados:

- painel de FPS e desempenho
- terreno e mapas procedurais
- ciclo visual de luz, ceu e atmosfera

A ideia e servir como ponto unico de consulta para implementacao, manutencao e expansao futura.

---

## Como Ler Este Guia

Use esta ordem:

1. entender a camada de debug de FPS
2. entender a camada de terreno procedural
3. entender a camada de luz e ciclo visual
4. cruzar as tres camadas com o contrato do cliente e do servidor

---

## 1. Painel De FPS / Desempenho

### Papel

O painel de FPS existe apenas para observabilidade local no frontend.
Ele nao participa de gameplay, nao altera snapshot e nao afeta runtime.

### Responsabilidades

- medir FPS e ms por frame
- anexar o `Stats` no ciclo de vida da cena
- remover o painel corretamente no cleanup
- evitar duplicacao quando a cena remonta

### Arquivos Principais

- [createStatsPanel.js](/D:/JS-Projects/Youtube/client/src/world/scene/debug/createStatsPanel.js)
- [setup.js](/D:/JS-Projects/Youtube/client/src/world/scene/GameCanvas/sceneRuntime/setup.js)
- [tick.js](/D:/JS-Projects/Youtube/client/src/world/scene/GameCanvas/sceneRuntime/useSceneRuntime/tick.js)
- [cleanup.js](/D:/JS-Projects/Youtube/client/src/world/scene/GameCanvas/sceneRuntime/cleanup.js)
- [useSceneRuntime.js](/D:/JS-Projects/Youtube/client/src/world/scene/GameCanvas/sceneRuntime/useSceneRuntime.js)

### Regras

- o painel nao pode virar fonte de estado
- o painel nao pode interferir em input, camera ou snapshot
- o painel deve sumir sem deixar resquicios no DOM

---

## 2. Terreno E Mapas Procedurais

### Papel

O terreno procedural define como o mapa nasce e como ele deve ser reconstruido de forma deterministica.

Ele separa:

- o que e visual
- o que e logico
- o que e persistente
- o que depende de seed

### Responsabilidades Do Cliente

- reconstruir terreno visual
- espalhar decoracao estatica
- aplicar LOD e instancing
- montar variacao cosmetica por seed

### Responsabilidades Do Servidor

- manter autoridade sobre movimento
- validar bloqueios e spawn
- persistir overrides e objetos relevantes
- decidir o que e interativo ou alteravel

### Arquivos Principais

- [modulo-mapas-procedurais.md](/D:/JS-Projects/Youtube/MD/implementacoes/modulo-mapas-procedurais.md)
- [mapa-procedural-schema.md](/D:/JS-Projects/Youtube/MD/implementacoes/mapa-procedural-schema.md)
- [mapa-procedural-asset-families.md](/D:/JS-Projects/Youtube/MD/implementacoes/mapa-procedural-asset-families.md)
- [plano-tecnico-mapa-procedural-instancia-3.md](/D:/JS-Projects/Youtube/MD/implementacoes/plano-tecnico-mapa-procedural-instancia-3.md)

### Regras-Chave

- mapa deve ser reproduzivel por seed
- decoracao estavel nao deve ser persistida individualmente
- borda do mapa deve ser intransponivel por regra logica e visual
- objetos alteraveis deixam de ser decoracao pura

---

## 3. Luz E Ciclo Visual

### Papel

O ciclo visual traduz o relogio autoritativo do servidor em atmosfera, luz e exposicao no cliente.

Ele nao decide gameplay.

### O Que Controla

- cor do ceu
- neblina
- intensidade da luz hemisferica
- intensidade da luz direcional
- exposicao do renderer

### Regra Base

- 05:00 a 18:30: claro
- 18:30 a 20:00: transicao para escuro
- 20:00 a 04:00: escuro
- 04:00 a 05:00: transicao para claro

### Arquivos Principais

- [implementacao-ciclo-visual-dia-noite.md](/D:/JS-Projects/Youtube/MD/implementacoes/implementacao-ciclo-visual-dia-noite.md)
- [useWorldClock.js](/D:/JS-Projects/Youtube/client/src/world/hooks/useWorldClock.js)
- [dayNightCycle.js](/D:/JS-Projects/Youtube/client/src/world/scene/light/dayNightCycle.js)
- [light.js](/D:/JS-Projects/Youtube/client/src/world/scene/light/light.js)
- [WorldClockPanel.jsx](/D:/JS-Projects/Youtube/client/src/world/ui/WorldClockPanel.jsx)

### Regras

- o servidor e a fonte do horario
- o cliente apenas converte horario em visual
- o ciclo visual nao pode mover logica de jogo para o cliente

---

## 4. Relacao Entre As Tres Camadas

### FPS

Serve para enxergar performance do cliente enquanto o mundo e renderizado.

### Terreno

Define o que o cliente precisa montar e o que o servidor precisa validar.

### Luz

Diz como a cena deve ser apresentada conforme o relogio do mundo.

### Interacao Entre Elas

- terreno pesado demais afeta FPS
- luz e atmosfera precisam respeitar a cena montada
- o painel de FPS ajuda a detectar regressao visual ou de performance

---

## 5. Fluxo Recomendado De Implementacao

1. definir a base procedural do mapa
2. garantir que o cliente consiga montar terreno e assets sem divergir
3. adicionar ciclo de luz em cima do mundo ja montado
4. usar o painel de FPS para validar impacto visual e de performance
5. manter o servidor como autoridade em tudo que for logico

---

## 6. Invariantes

- o painel de FPS nunca altera o jogo
- o terreno procedural nunca depende de montagem manual completa
- o ciclo de luz nunca decide gameplay
- o servidor continua autoritativo para movimentacao, spawn e persistencia
- o cliente continua responsavel por renderizacao e apresentacao

---

## 7. Quando Atualizar Este Documento

Atualize este guia quando houver:

- mudanca no painel de FPS
- mudanca no pipeline de terreno procedural
- mudanca nas regras de luz ou atmosfera
- nova regra de integracao entre cliente e servidor nesses tres blocos

