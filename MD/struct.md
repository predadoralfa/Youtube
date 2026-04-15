# Estrutura Consolidada do Projeto

## Objetivo

Este arquivo e um resumo estrutural rapido do projeto.
Ele existe para orientar leitura, onboarding e manutencao sem repetir em detalhe tudo que ja esta no [document.md](/D:/JS-Projects/Youtube/MD/document.md).

Use este arquivo quando a pergunta for:

- como o projeto esta dividido
- onde fica cada responsabilidade
- quais sao os modulos centrais
- quais documentos aprofundam cada tema

---

## Visao Geral

Regra central do projeto:

- backend e a fonte da verdade
- frontend renderiza estado confirmado e envia intents
- runtime vivo acontece principalmente no servidor
- banco guarda modelos, configuracoes e estados persistentes

Fluxo macro:

1. autenticacao HTTP
2. bootstrap inicial do mundo
3. conexao Socket.IO autenticada
4. entrada em instancia
5. processamento autoritativo de movimento, combate, interacao e loops
6. replicacao incremental para o cliente

---

## Estrutura de Pastas

```text
Youtube/
|-- MD/
|   |-- document.md
|   |-- struct.md
|   |-- CIDs/
|   `-- implementacoes/
|
|-- client/
|   `-- src/
|       |-- components/
|       |-- pages/
|       |-- services/
|       |-- style/
|       `-- world/
|
`-- server/
    |-- config/
    |-- migrations/
    |-- models/
    |-- router/
    |-- service/
    |-- socket/
    |-- state/
    `-- server.js
```

Leitura rapida:

- `MD/`: documentacao funcional e arquitetural
- `client/src/`: interface, cena, input e estado cliente
- `server/`: regras autoritativas, runtime, persistencia e schema

---

## Pasta MD

Organizacao atual:

- `document.md`: documento mestre
- `struct.md`: resumo estrutural
- `MD/CIDs`: guias de cadastro e identificadores estaveis
- `MD/implementacoes`: estudos arquiteturais e planos tecnicos

Documentos principais:

- [document.md](/D:/JS-Projects/Youtube/MD/document.md)
- [guia-registro-documentacao.md](/D:/JS-Projects/Youtube/MD/CIDs/guia-registro-documentacao.md)
- [guia-registro-actors.md](/D:/JS-Projects/Youtube/MD/CIDs/guia-registro-actors.md)
- [guia-registro-itens.md](/D:/JS-Projects/Youtube/MD/CIDs/guia-registro-itens.md)
- [guia-registro-research.md](/D:/JS-Projects/Youtube/MD/CIDs/guia-registro-research.md)
- [guia-cid-container-actors.md](/D:/JS-Projects/Youtube/MD/CIDs/guia-cid-container-actors.md)
- [guia-registro-skills-craft.md](/D:/JS-Projects/Youtube/MD/seeds/guia-registro-skills-craft.md)
- [estudo-arquitetural-actors-spawn.md](/D:/JS-Projects/Youtube/MD/implementacoes/estudo-arquitetural-actors-spawn.md)
- [modulo-skills-craft.md](/D:/JS-Projects/Youtube/MD/implementacoes/modulo-skills-craft.md)
- [plano-tecnico-respawn-inimigos-por-instancia.md](/D:/JS-Projects/Youtube/MD/implementacoes/plano-tecnico-respawn-inimigos-por-instancia.md)

---

## Frontend

O frontend vive em `client/src` e se divide em cinco blocos principais:

- `pages/`: entrada da aplicacao
- `components/`: modais e overlays
- `services/`: HTTP e socket
- `style/`: CSS
- `world/`: jogo em si

Centro do front:

- `App.jsx`
- `pages/AuthPage.jsx`
- `services/Auth.js`
- `services/Socket.js`
- `services/World.js`
- `world/WorldRoot.jsx`
- `world/GameShell.jsx`

Subestrutura de `world/`:

- `entities/character`: jogadores
- `entities/enemies`: inimigos
- `entities/actors`: actors do mundo
- `hooks/`: sincronizacao com eventos do servidor
- `input/`: intents e barramento de input
- `scene/`: camera, luz, ambiente e HUD de cena
- `state/`: store cliente
- `ui/`: paineis auxiliares

Regra do front:

- cliente nao resolve gameplay
- cliente nao calcula visibilidade por conta propria
- cliente reflete bootstrap, delta, spawn e despawn enviados pelo servidor

---

## Backend

O backend vive em `server/` e concentra a logica autoritativa.

Estrutura funcional:

- `config/`: constantes e parametros globais
- `migrations/`: schema e seeds
- `models/`: models Sequelize
- `router/`: rotas HTTP
- `service/`: regra de negocio
- `socket/`: eventos do multiplayer
- `state/`: runtime em memoria e loops

Capacidade de containers:

- `ga_container_def.max_weight` e a capacidade maxima de cada container
- o total da UI de inventario vem da soma dos containers ativos
- `HAND_L` e `HAND_R` devem ficar com `2.5` kg cada
- `BASKET` deve ficar com `10` kg

Arquivo de entrada:

- `server.js`

Loops e managers principais:

- `state/movementTick.js`
- `state/spawnManager.js`
- `state/resourceRegen/resourceRegenLoop.js`
- `state/persistenceManager.js`

Regra do backend:

- calcula estado final
- valida interacao
- processa combate
- decide spawn, respawn, coleta e persistencia

---

## Modelos Centrais do Banco

### Mundo

- `ga_local`
- `ga_instance`
- `ga_local_geometry`
- `ga_local_visual`
- `ga_world_clock`
- `ga_world_month_def`

### Jogador

- `ga_user`
- `ga_user_profile`
- `ga_user_runtime`
- `ga_user_stats`
- `ga_user_macro_config`

### Actors

- `ga_actor_def`
- `ga_actor_spawn`
- `ga_actor_runtime`
- `ga_actor_resource_rule_def`
- `ga_actor_resource_state`

### Containers e Itens

- `ga_container_def`
- `ga_container`
- `ga_container_owner`
- `ga_container_slot`
- `ga_item_def`
- `ga_item_def_component`
- `ga_item_instance`

### Inimigos e Spawn

- `ga_enemy_def`
- `ga_enemy_def_stats`
- `ga_spawn_def`
- `ga_spawn_def_entry`
- `ga_spawn_point`
- `ga_enemy_runtime`
- `ga_enemy_runtime_stats`
- `ga_instance_spawn_config`

### Research e Equipamento

- `ga_research_def`
- `ga_research_level_def`
- `ga_user_research`
- `ga_equipment_slot_def`
- `ga_equipped_item`

### Skills e Crafts

- `ga_skill_def`
- `ga_skill_level_def`
- `ga_user_skill`
- `ga_craft_def`
- `ga_craft_recipe_item`
- `ga_user_craft_job`

---

## Sistemas Principais

### Bootstrap do mundo

- rota HTTP entrega snapshot inicial
- `worldService.js` monta payload autoritativo
- cliente usa isso para entrar no mundo antes dos deltas

### Runtime e presenca

- runtime de jogador em memoria
- interest management por chunks
- deltas emitidos por instancia/interesse

### Movimento

- intents do cliente entram pelo socket
- `state/movement/tickOnce.js` processa o tick
- servidor atualiza posicao, stamina, fome, combate automatico e interacao

### Actors e coleta

- actors usam definicao, spawn e runtime separados
- coleta e validada no servidor
- containers sustentam recursos, loot e baus

### Inimigos e respawn

- inimigos possuem definicao, receita de spawn, ponto de colocacao e runtime
- o mesmo spawner deve poder ser reutilizado em varias instancias
- respawn respeita `dead_at` e `respawn_at`
- instancia pode aplicar configuracao propria via `ga_instance_spawn_config`

### Regeneracao de recursos

- rules de recurso caminham para um modelo guiado por banco
- loop proprio repoe conteudo ou estado de actors elegiveis

### Fome

- dreno por tempo real
- calculo autoritativo no servidor
- suporte a auto food por macro

### Research

- progresso persistente por jogador
- desbloqueio de capacidades por nivel
- progresso somente enquanto o jogador esta online

### Ciclo visual

- cliente interpreta relogio do mundo
- efeito visual sem autoridade de gameplay

---

## Contratos de Comunicacao

### HTTP

- `POST /auth/register`
- `POST /auth/login`
- `GET /world/bootstrap`

### Socket

- `world:*`
- `entity:*`
- `move:*`
- `interact:*`
- `combat:*`
- `inventory:*`
- `research:*`
- `session:*`

Regra:

- cliente envia intencao
- servidor devolve estado confirmado ou evento autoritativo

---

## Invariantes

- backend sempre vence em caso de divergencia
- frontend nunca deve inventar estado final
- toda entidade importante precisa de contrato claro de persistencia e runtime
- `rev` e baseline servem para cura de inconsistencias
- configuracao por instancia deve viver no banco quando a regra variar por mapa

---

## Documentos de Aprofundamento

- documento mestre: [document.md](/D:/JS-Projects/Youtube/MD/document.md)
- actors: [guia-registro-actors.md](/D:/JS-Projects/Youtube/MD/CIDs/guia-registro-actors.md)
- itens: [guia-registro-itens.md](/D:/JS-Projects/Youtube/MD/CIDs/guia-registro-itens.md)
- CID de container: [guia-cid-container-actors.md](/D:/JS-Projects/Youtube/MD/CIDs/guia-cid-container-actors.md)
- actors e spawns: [estudo-arquitetural-actors-spawn.md](/D:/JS-Projects/Youtube/MD/implementacoes/estudo-arquitetural-actors-spawn.md)
- fome: [implementacao-sistema-de-fome.md](/D:/JS-Projects/Youtube/MD/implementacoes/implementacao-sistema-de-fome.md)
- research: [modulo-research.md](/D:/JS-Projects/Youtube/MD/implementacoes/modulo-research.md)
- ciclo visual: [implementacao-ciclo-visual-dia-noite.md](/D:/JS-Projects/Youtube/MD/implementacoes/implementacao-ciclo-visual-dia-noite.md)
- regeneracao de recursos: [plano-regeneracao-recursos.md](/D:/JS-Projects/Youtube/MD/implementacoes/plano-regeneracao-recursos.md)
- respawn por instancia: [plano-tecnico-respawn-inimigos-por-instancia.md](/D:/JS-Projects/Youtube/MD/implementacoes/plano-tecnico-respawn-inimigos-por-instancia.md)
