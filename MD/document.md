# Projeto Youtube - Documento Mestre

## Objetivo

Este arquivo funciona como o documento central da pasta `MD`.
Ele resume a arquitetura atual do projeto, explica o papel de cada grande sistema e aponta para os documentos mais especificos que detalham cadastro, estudos arquiteturais e planos de implementacao.

Ele deve responder, de forma rapida:

- como o projeto esta organizado
- quais sao as fontes da verdade do mundo
- como frontend e backend se dividem
- onde ficam os guias de cadastro
- onde ficam os planejamentos de implementacao

---

## Principios do Projeto

- o backend e a fonte autoritativa da verdade
- o cliente renderiza snapshot e envia intents
- movement, combat, coleta, inventario e respawn sao decididos no servidor
- replicacao usa runtime em memoria + `rev` monotono + baseline/resync
- banco guarda definicoes, configuracoes persistentes e estados que precisam sobreviver ao runtime

Em outras palavras:

- o cliente nao decide resultado final de gameplay
- o cliente nao escolhe quem esta visivel por interesse
- o servidor calcula e replica o estado confirmado

---

## Mapa da Pasta MD

Estrutura atual:

```text
 MD/
 |-- document.md
 |-- struct.md
 |-- CIDs/
 |   |-- guia-registro-documentacao.md
 |   |-- guia-cid-container-actors.md
 |   |-- guia-registro-actors.md
 |   `-- guia-registro-itens.md
 |-- seeds/
 |   |-- guia-registro-actors.md
 |   |-- guia-registro-itens.md
 |   `-- guia-registro-skills-craft.md
 `-- implementacoes/
     |-- estudo-arquitetural-actors-spawn.md
     |-- implementacao-ciclo-visual-dia-noite.md
     |-- implementacao-sistema-de-fome.md
     |-- modulo-skills-craft.md
     |-- modulo-research.md
     |-- plano-regeneracao-recursos.md
     `-- plano-tecnico-respawn-inimigos-por-instancia.md
```

Papel de cada area:

- `document.md`: documento mestre e ponto de entrada
- `struct.md`: consolidado estrutural resumido
- `MD/CIDs`: guias operacionais de cadastro e identificadores estaveis
- `MD/implementacoes`: estudos arquiteturais, modulos e planos tecnicos

---

## Leitura Recomendada

Para entender o projeto rapidamente:

1. ler `document.md`
2. ler `struct.md`
3. ler os guias em `MD/CIDs`
4. ler os planos em `MD/implementacoes` conforme o sistema em foco

Atalhos:

- actors: [guia-registro-actors.md](/D:/JS-Projects/Youtube/MD/CIDs/guia-registro-actors.md)
- itens: [guia-registro-itens.md](/D:/JS-Projects/Youtube/MD/CIDs/guia-registro-itens.md)
- research: [guia-registro-research.md](/D:/JS-Projects/Youtube/MD/CIDs/guia-registro-research.md)
- skills e craft: [guia-registro-skills-craft.md](/D:/JS-Projects/Youtube/MD/seeds/guia-registro-skills-craft.md)
- documentacao: [guia-registro-documentacao.md](/D:/JS-Projects/Youtube/MD/CIDs/guia-registro-documentacao.md)
- container CID: [guia-cid-container-actors.md](/D:/JS-Projects/Youtube/MD/CIDs/guia-cid-container-actors.md)
- actors e spawn: [estudo-arquitetural-actors-spawn.md](/D:/JS-Projects/Youtube/MD/implementacoes/estudo-arquitetural-actors-spawn.md)
- skills e craft: [modulo-skills-craft.md](/D:/JS-Projects/Youtube/MD/implementacoes/modulo-skills-craft.md)
- research: [modulo-research.md](/D:/JS-Projects/Youtube/MD/implementacoes/modulo-research.md)
- fome: [implementacao-sistema-de-fome.md](/D:/JS-Projects/Youtube/MD/implementacoes/implementacao-sistema-de-fome.md)
- ciclo visual: [implementacao-ciclo-visual-dia-noite.md](/D:/JS-Projects/Youtube/MD/implementacoes/implementacao-ciclo-visual-dia-noite.md)
- regeneracao de recursos: [plano-regeneracao-recursos.md](/D:/JS-Projects/Youtube/MD/implementacoes/plano-regeneracao-recursos.md)
- respawn por instancia: [plano-tecnico-respawn-inimigos-por-instancia.md](/D:/JS-Projects/Youtube/MD/implementacoes/plano-tecnico-respawn-inimigos-por-instancia.md)

---

## Estrutura Geral do Projeto

Partes principais:

- `client/`: interface, cena 3D, HUD, bootstrap do mundo e renderizacao
- `server/`: API HTTP, Socket.IO, regras autoritativas, workers e persistencia
- `MD/`: documentacao funcional e arquitetural

Fluxo de alto nivel:

1. login via HTTP
2. bootstrap inicial via `GET /world/bootstrap`
3. abertura do socket autenticado
4. entrada do jogador na instancia
5. runtime em memoria passa a receber intents, processar ticks e emitir deltas

---

## Frontend

O frontend vive principalmente em `client/src`.

Blocos principais:

- `pages/`: telas de entrada, como autenticacao
- `components/models/`: modais de auth, build, inventory e research
- `components/overlays/`: overlays globais
- `services/`: HTTP, socket e bootstrap
- `world/`: jogo em si

Pecas centrais do front:

- `App.jsx`: root da aplicacao
- `pages/AuthPage.jsx`: fluxo de login/registro
- `services/Auth.js`: chamadas de auth
- `services/Socket.js`: cliente Socket.IO
- `services/World.js`: bootstrap inicial do mundo
- `world/WorldRoot.jsx`: gate entre autenticacao e mundo
- `world/GameShell.jsx`: orquestracao do bootstrap, socket e estado do jogo
- `world/state/entitiesStore.js`: store cliente para entidades replicadas
- `world/scene/GameCanvas.jsx`: cena principal

Camadas do mundo:

- `world/entities/character`: jogadores
- `world/entities/enemies`: inimigos
- `world/entities/actors`: actors de mundo
- `world/hooks`: sincronizacao com eventos do servidor
- `world/input`: intents e barramento de input
- `world/scene`: camera, ambiente, luz e HUD diegetico
- `world/ui`: paineis como o relogio do mundo

Regras do frontend:

- renderizar o que o backend autorizou
- nao inventar HP, loot, cooldown, fome ou respawn
- manter a cena sincronizada com snapshot, spawn, delta e despawn

---

## Backend

O backend vive em `server/` e concentra a regra autoritativa do jogo.

Camadas principais:

- `server.js`: bootstrap do servidor HTTP, socket e loops
- `router/`: rotas HTTP
- `middleware/`: auth e filtros
- `models/`: schema Sequelize
- `service/`: regras de negocio
- `socket/`: handlers e wiring dos eventos
- `state/`: runtime em memoria, loops e stores quentes
- `migrations/`: evolucao do schema e seeds de dados

Loops e managers relevantes:

- `state/movementTick.js`: inicia o loop de movimento
- `state/spawnManager.js`: inicia o spawn de inimigos
- `state/resourceRegen/resourceRegenLoop.js`: loop de regeneracao de recursos
- `state/persistenceManager.js`: flush de runtime e stats

Pecas muito importantes:

- `service/worldService.js`: monta o bootstrap autoritativo
- `socket/index.js`: registro dos sockets
- `state/runtimeStore.js`: runtime quente dos jogadores
- `state/presenceIndex.js`: interest management por chunks
- `state/movement/tickOnce.js`: coracao do tick de jogo

---

## Dominio do Mundo

### Local e Instancia

O mundo separa:

- `ga_local`: definicao geografica/logica do lugar
- `ga_instance`: instancia concreta daquele local
- `ga_local_geometry`: dados geometricos do mapa
- `ga_local_visual`: configuracao visual do local

Isso permite:

- varios mapas ou variantes de um mesmo local
- regras diferentes por instancia
- configuracoes futuras por shard, fase, evento ou ambiente

### Relogio do Mundo

O tempo do jogo e controlado por:

- `ga_world_clock`
- `ga_world_month_def`
- `service/worldClockService.js`

O servidor calcula o tempo autoritativo.
O cliente usa isso para render visual e paines de tempo.

---

## Sistema de Actors

O sistema de actors foi redesenhado para separar responsabilidades.

Modelo atual:

- `ga_actor_def`: definicao do tipo de actor
- `ga_actor_spawn`: colocacao fixa no mapa
- `ga_actor_runtime`: estado runtime da entidade

Conceito:

- `def` responde "o que isso e"
- `spawn` responde "onde isso nasce de forma fixa"
- `runtime` responde "qual o estado vivo agora"

Exemplos:

- uma cadeira de cenario pode ser `OBJECT`
- uma arvore pode ser `RESOURCE_NODE`
- um bau pode ser `CHEST`
- um loot no chao pode ser `LOOT`
- um NPC pode ser `NPC`

Observacoes importantes:

- `actor_kind` hoje e string, porque o projeto ainda esta em prototipo
- `code` identifica o actor de forma estavel
- `default_state_json` deve guardar estado base da definicao
- estado mutavel runtime deve ficar no `state_json` do runtime

Documentos de apoio:

- [guia-registro-actors.md](/D:/JS-Projects/Youtube/MD/CIDs/guia-registro-actors.md)
- [estudo-arquitetural-actors-spawn.md](/D:/JS-Projects/Youtube/MD/implementacoes/estudo-arquitetural-actors-spawn.md)

---

## Containers e Loot

O sistema de container foi separado do actor.

Pecas principais:

- `ga_container_def`: definicao do container
- `ga_container`: instancia concreta do container
- `ga_container_owner`: dono logico do container
- `ga_container_slot`: slots e conteudo

Regras de capacidade:

- `ga_container_def.max_weight` representa a capacidade maxima do container
- a capacidade total do jogador e a soma dos containers ativos que ele possui
- `HAND_L` e `HAND_R` devem ficar com `2.5` kg cada
- `BASKET` deve ficar com `10` kg
- a interface de inventario deve refletir a soma dos containers carregados, nao um valor hardcoded do personagem

No contexto de actors:

- um actor pode apontar para um container
- um bau fixo pode nascer com container proprio
- um recurso pode usar container para armazenar o que sera coletado
- loot de chao pode ter representacao actor + dados de item em runtime

Documento principal:

- [guia-cid-container-actors.md](/D:/JS-Projects/Youtube/MD/CIDs/guia-cid-container-actors.md)

---

## Itens, Equipamentos e Inventario

Modelo base de item:

- `ga_item_def`: identidade e categoria do item
- `ga_item_def_component`: capacidades do item
- `ga_item_instance`: instancia concreta do item

Camadas relacionadas:

- `ga_equipment_slot_def`: slots de equipamento
- `ga_equipped_item`: item equipado
- `state/inventory/*`: runtime e operacoes de inventario
- `state/equipment/*`: runtime e payload de equipamento

Uso pratico:

- um item nasce como definicao
- uma instancia concreta vai para inventario, container ou mundo
- componentes definem comportamento como consumo, arma, material etc.

Documento principal:

- [guia-registro-itens.md](/D:/JS-Projects/Youtube/MD/CIDs/guia-registro-itens.md)

---

## Inimigos, Spawn e Respawn

O sistema de inimigos agora deve ser lido em quatro camadas:

- definicao: `ga_enemy_def` e `ga_enemy_def_stats`
- receita reutilizavel: `ga_spawn_def` e `ga_spawn_def_entry`
- colocacao no mapa: `ga_spawn_point`
- runtime: `ga_enemy_runtime` e `ga_enemy_runtime_stats`

Arquivos chave:

- `service/enemyLoader.js`
- `service/combatSystem.js`
- `service/enemyRespawnService.js`
- `state/enemies/*`
- `state/spawn/spawnConfig.js`
- `state/spawn/spawnLoop.js`
- `state/spawn/spawnTick.js`

Evolucao atual:

- o mesmo spawner precisa poder ser reutilizado em varias instancias
- `spawn_point` deve ser apenas a colocacao de um spawner no mapa
- o runtime do inimigo deve ser separado da receita do spawner
- a configuracao macro por instancia continua em `ga_instance_spawn_config`

Documento principal:

- [plano-tecnico-respawn-inimigos-por-instancia.md](/D:/JS-Projects/Youtube/MD/implementacoes/plano-tecnico-respawn-inimigos-por-instancia.md)

---

## Coleta e Regeneracao de Recursos

O projeto ja possui uma base funcional de coleta de actors e esta evoluindo a regeneracao.

Pecas principais:

- `service/actorCollectService.js`
- `service/actorResourceRegenService.js`
- `state/actorsRuntimeStore.js`
- `state/resourceRegen/resourceRegenLoop.js`
- `models/ga_actor_resource_rule_def.js`
- `models/ga_actor_resource_state.js`

Objetivo dessa linha:

- permitir recurso coletavel persistente
- esvaziar o recurso no momento da coleta
- repor conteudo com regra automatizada
- variar a regra por actor, spawn ou mapa no futuro

Documento principal:

- [plano-regeneracao-recursos.md](/D:/JS-Projects/Youtube/MD/implementacoes/plano-regeneracao-recursos.md)

---

## Fome e Auto Food

O sistema de fome ja tem desenho fechado e parte relevante implementada.

Ideias centrais:

- a fome e drenada por tempo real
- o servidor calcula a perda
- os valores ficam em `ga_user_stats`
- auto food depende de configuracao de macro do jogador

Arquivos relacionados:

- `service/autoFoodService.js`
- `models/ga_user_macro_config.js`
- `models/ga_user_stats.js`
- `state/runtime/*`
- `state/movement/tickOnce.js`

Documento principal:

- [implementacao-sistema-de-fome.md](/D:/JS-Projects/Youtube/MD/implementacoes/implementacao-sistema-de-fome.md)

---

## Research

Research e um modulo de desbloqueio de conhecimento do jogador.

Ideia principal:

- ter item nao implica saber usar
- progresso e persistido por jogador
- progresso so avanca online
- cada nivel desbloqueia capacidade concreta

Pecas principais:

- `ga_research_def`
- `ga_research_level_def`
- `ga_user_research`
- `service/researchService.js`
- `socket/handlers/researchHandler.js`
- `components/models/research/ResearchModal.jsx`

Documento principal:

- [modulo-research.md](/D:/JS-Projects/Youtube/MD/implementacoes/modulo-research.md)

---

## Ciclo Visual de Dia e Noite

Esse sistema e visual e vive do lado do cliente.

Regra:

- o servidor envia o relogio autoritativo
- o cliente converte isso em luz, atmosfera e transicao visual
- nenhuma regra de gameplay sai do servidor

Arquivos importantes:

- `world/hooks/useWorldClock.js`
- `world/scene/light/dayNightCycle.js`
- `world/scene/light/light.js`
- `world/ui/WorldClockPanel.jsx`

Documento principal:

- [implementacao-ciclo-visual-dia-noite.md](/D:/JS-Projects/Youtube/MD/implementacoes/implementacao-ciclo-visual-dia-noite.md)

---

## Movimento, Presenca e Replicacao

O jogo multiplayer depende fortemente desta espinha dorsal:

- `state/runtimeStore.js`: runtime dos jogadores
- `state/presenceIndex.js`: chunks e interesse
- `state/movement/*`: simulacao autoritativa de movimento
- `socket/handlers/world/*`: join, baseline, resync e rooms
- `world/state/entitiesStore.js`: store cliente com `rev`

Regras chave:

- cliente envia input
- servidor processa
- servidor replica somente o necessario
- `baseline` corrige divergencia

Esse e o nucleo que sustenta:

- players
- enemies
- actors
- combate
- interacao

---

## Persistencia

O projeto usa a combinacao:

- runtime quente em memoria
- dirty flags
- flush por loop
- persistencia final em shutdown quando necessario

Arquivos chave:

- `state/persistenceManager.js`
- `state/persistence/*`
- `socket/wiring/persistenceHooks.js`

Essa escolha reduz escrita constante e mantem o jogo responsivo.

---

## Eventos e Contratos Mais Importantes

### HTTP

- `POST /auth/register`
- `POST /auth/login`
- `GET /world/bootstrap`

### Socket

- `world:join`
- `world:baseline`
- `world:resync`
- `entity:spawn`
- `entity:delta`
- `entity:despawn`
- `move:intent`
- `move:click`
- `interact:start`
- `interact:stop`
- `research:request_full`
- `research:start`
- `combat:*`
- `inventory:*`

Observacao:

- nomes e payloads podem evoluir, mas a regra central continua sendo "cliente envia intencao, servidor responde com estado confirmado"

---

## Invariantes Arquiteturais

- backend e a unica fonte de verdade do mundo
- frontend nao toma decisoes autoritativas
- toda entidade de mundo importante precisa de modelo claro entre definicao, colocacao e runtime
- regras de longa duracao precisam sair de hardcode e ir para banco sempre que fizer sentido
- qualquer sistema novo deve nascer preparado para ser observado, persistido e expandido por instancia

---

## Quando Atualizar Este Documento

Atualizar `document.md` quando acontecer pelo menos uma destas mudancas:

- nova subpasta relevante em `MD`
- mudanca estrutural grande no frontend
- mudanca estrutural grande no backend
- criacao de novo modulo persistente de gameplay
- troca de modelo arquitetural de actors, spawn, inventario ou research

Quando a mudanca for local de um sistema especifico, atualizar tambem o documento especialista correspondente.

---

## Estado Atual da Documentacao

Hoje a pasta `MD` cobre principalmente:

- cadastro de actors, itens e CIDs
- arquitetura nova de actors
- modulo de research
- sistema de fome
- ciclo visual de dia e noite
- regeneracao de recursos
- respawn de inimigos por instancia

Lacunas que ainda podem virar documentos proprios no futuro:

- combate completo
- inventario/equipment em profundidade
- fluxo de bootstrap e sincronizacao multiplayer
- arquitetura de persistencia e dirty flags
- convencoes de migrations e seeds
