# Estrutura Consolidada do Projeto

Este documento consolida a arquitetura atual descrita nos arquivos da pasta `MD`, com foco em:

- frontend como camada de renderizacao e input por intencao
- backend como fonte autoritativa do estado
- fluxo de actors baseado em definicao, spawn e runtime
- sistemas de coleta, fome, ciclo visual e research

---

## Visao Geral

Regra central do projeto:

- backend decide estado real do mundo
- cliente renderiza snapshot e envia intents
- replicacao usa `rev` monotono e baseline para cura de divergencia

Fluxo de alto nivel:

1. login via HTTP
2. bootstrap inicial via `GET /world/bootstrap`
3. conexao Socket.IO apos snapshot
4. atualizacoes incrementais por eventos de mundo/movimento/interacao

---

## Estrutura de Pastas (Resumo)

```text
Youtube/
|-- MD/
|   |-- document.md
|   |-- estudo-arquitetural-actors-spawn.md
|   |-- guia-registro-actors.md
|   |-- guia-registro-itens.md
|   |-- implementacao-ciclo-visual-dia-noite.md
|   |-- implementacao-sistema-de-fome.md
|   |-- modulo-research.md
|   `-- struct.md
|
|-- client/
|   |-- src/
|   |   |-- pages/
|   |   |   `-- AuthPage.jsx
|   |   |-- components/
|   |   |   |-- modals/
|   |   |   `-- overlays/
|   |   |-- services/
|   |   |   |-- Auth.js
|   |   |   |-- Socket.js
|   |   |   `-- WorldBootstrap.js
|   |   |-- World/
|   |   |   |-- WorldRoot.jsx
|   |   |   |-- GameShell.jsx
|   |   |   |-- hooks/
|   |   |   |   `-- useActorCollection.js
|   |   |   |-- components/
|   |   |   |   `-- CooldownBar.jsx
|   |   |   |-- state/
|   |   |   |   `-- entitiesStore.js
|   |   |   `-- entities/
|   |   `-- input/
|   |       |-- inputBus.js
|   |       |-- inputs.js
|   |       `-- intents.js
|   `-- ...
|
`-- server/
    |-- server.js
    |-- config/
    |-- middlewares/
    |-- models/
    |   |-- ga_actor_def.js
    |   |-- ga_actor_spawn.js
    |   |-- ga_actor.js
    |   |-- ga_item_def.js
    |   |-- ga_item_def_component.js
    |   |-- ga_item_instance.js
    |   |-- ga_user_stats.js
    |   `-- ...
    |-- service/
    |   |-- worldService.js
    |   |-- actorLoader.js
    |   |-- actorService.js
    |   |-- actorCollectService.js
    |   `-- inventoryService.js
    |-- socket/
    |   |-- index.js
    |   |-- sessionIndex.js
    |   |-- wiring/
    |   `-- handlers/
    `-- state/
        |-- runtime/
        |-- movement/
        |-- presence/
        |-- persistence/
        |-- actorsRuntimeStore.js
        `-- ...
```

---

## Frontend (Client)

Principios:

- nao simular gameplay autoritativo
- nao calcular estado final de movimento/coleta
- aplicar apenas estado confirmado do servidor

Pecas principais:

- `WorldRoot.jsx`: gate entre autenticacao e mundo
- `GameShell.jsx`: orquestra bootstrap, socket e atualizacao de snapshot
- `useActorCollection.js`: escuta `actor:collected` e aplica atualizacao local
- `CooldownBar.jsx` (opcional): feedback visual de cooldown
- `entitiesStore.js`: store replicado com protecao por `rev`
- `input/*`: somente intents (`MOVE_DIRECTION`, `INTERACT_PRESS`, `INTERACT_RELEASE`, etc.)

---

## Backend (Server)

Principios:

- estado vivo em runtime memory + persistencia em batch
- movimento/coleta executados no servidor
- cliente nao escolhe visibilidade por interesse

Pecas principais:

- `worldService.js`: monta snapshot HTTP autoritativo
- `socket/handlers/*`: eventos de mundo, movimento, interacao e inventario
- `state/movement/tickOnce.js`: loop de movimento e hold-to-collect
- `actorCollectService.js`: coleta transacional por actor
- `inventoryService.js`: busca stack incompleto ou slot vazio
- `actorsRuntimeStore.js`: cache quente de actors com containers
- `state/presence/*`: interest management por chunks
- `state/persistence/*`: flush de runtime/stats/inventario/actor

---

## Modelo de Actors

Separacao atual recomendada:

1. `ga_actor_def`: definicao global do tipo de actor
2. `ga_actor_spawn`: colocacao fixa no mapa
3. `ga_actor`: estado runtime da instancia

Regras:

- actor fixo de cenario nasce de spawn
- actor transitorio pode nascer direto no runtime (`ga_actor`)
- inventario/loot de actor continua em container (`ga_container*`)

---

## Sistemas Funcionais Consolidadores

### Coleta

- evento de interacao inicia/paralisa hold (`interact:start/stop`)
- tick autoritativo tenta coleta respeitando cooldown server-side
- coleta atualiza slot, instancia, actor e inventario final
- client recebe `actor:collected` para refletir UI/cena

### Fome

- dreno continuo ao longo de tempo real (meta: zerar em 8h reais)
- progresso e calculo feitos no servidor
- stats com valor fracionario e persistencia dirty/batch

### Dia e Noite (visual)

- cliente usa `worldClock` como entrada
- somente efeito visual (luz, fog, ceu, exposicao)
- sem mover regra de gameplay para o front

### Research

- desbloqueio de capacidades por estudo e nivel
- progresso apenas quando jogador conectado
- item no inventario nao implica saber usar
- integra bootstrap + eventos socket de research

---

## Eventos e Contratos Principais

HTTP:

- `POST /auth/register`
- `POST /auth/login`
- `GET /world/bootstrap`

Socket:

- `world:join`, `world:resync`, `world:baseline`
- `entity:spawn`, `entity:delta`, `entity:despawn`
- `move:intent`, `move:click`, `move:state`
- `interact:start`, `interact:stop`
- `actor:collected`
- `research:request_full`, `research:start`, `research:full`
- `session:replaced`

---

## Invariantes do Projeto

- backend e a fonte da verdade do mundo
- cliente envia intents e renderiza confirmacao
- `rev` monotono governa consistencia de replicacao
- baseline substitui e corrige divergencia
- presence/interest e calculado no servidor
- persistencia e desacoplada por dirty + loop

Invariantes de coleta:

- slot vazio: `item_instance_id = NULL` e `qty = 0`
- slot preenchido: `item_instance_id != NULL` e `qty > 0`
- stacking por `item_def` (nao por mesma instancia)
- actor de recurso pode migrar de `ACTIVE` para `DISABLED` quando depletado

---

## Fontes de Referencia

Este `struct.md` foi consolidado a partir de:

- `MD/document.md`
- `MD/estudo-arquitetural-actors-spawn.md`
- `MD/guia-registro-actors.md`
- `MD/guia-registro-itens.md`
- `MD/implementacao-ciclo-visual-dia-noite.md`
- `MD/implementacao-sistema-de-fome.md`
- `MD/modulo-research.md`
