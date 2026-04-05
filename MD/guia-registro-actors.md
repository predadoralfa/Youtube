# Guia de Registro de Actors

## Objetivo

Este documento padroniza como novos actors devem ser registrados no projeto para evitar confusao entre:

- `ga_actor`: entidade persistente do mundo
- `ga_container`: inventario vinculado ao actor
- `ga_container_owner`: ligacao entre actor e container
- `ga_container_slot`: conteudo coletavel do actor
- `ga_item_instance`: item concreto colocado dentro do actor ou no chao

## Passo zero obrigatorio

Antes de criar qualquer actor novo, ler primeiro os pontos que definem o contrato atual:

- [ga_actor.js](/D:/JS-Projects/Youtube/server/models/ga_actor.js)
- [ga_container.js](/D:/JS-Projects/Youtube/server/models/ga_container.js)
- [ga_container_owner.js](/D:/JS-Projects/Youtube/server/models/ga_container_owner.js)
- [ga_container_slot.js](/D:/JS-Projects/Youtube/server/models/ga_container_slot.js)
- [actorLoader.js](/D:/JS-Projects/Youtube/server/service/actorLoader.js)
- [actorCollectService.js](/D:/JS-Projects/Youtube/server/service/actorCollectService.js)

Motivo:

- `actor_type` ainda e string livre, entao o contrato real vive no codigo
- a forma de um actor desaparecer ou permanecer depende do backend
- boa parte do comportamento esta na relacao actor + container, nao so em `ga_actor`

## Modelo mental

### 1. `ga_actor`

Representa a entidade persistente do mundo.

Campos principais:

- `actor_type`
- `instance_id`
- `pos_x`
- `pos_y`
- `state_json`
- `status`

Regra pratica:

- `ga_actor` responde "o que existe fisicamente no mapa?"
- ele nao guarda os itens em si
- ele pode existir mesmo com loot vazio

Exemplos:

- baú do mapa
- arvore frutifera
- npc estatico
- drop no chao

## 2. `ga_container`

Representa o inventario ligado ao actor.

Campos principais:

- `container_def_id`
- `slot_role`
- `state`
- `rev`

Regra pratica:

- se o actor precisa armazenar item, ele precisa de container
- o container define a estrutura
- os slots e os itens vivem fora do `ga_actor`

## 3. `ga_container_owner`

Faz a ligacao entre o actor e o container.

Campos principais:

- `container_id`
- `owner_kind`
- `owner_id`
- `slot_role`

Para actor:

- `owner_kind = ACTOR`
- `owner_id = ga_actor.id`

## 4. `ga_container_slot`

Representa o conteudo real do container.

Campos principais:

- `container_id`
- `slot_index`
- `item_instance_id`
- `qty`

Regra pratica:

- se o actor "tem fruta", "tem loot", "tem recurso", isso aparece aqui
- zerar o loot normalmente significa limpar ou zerar esses slots

## 5. `ga_item_instance`

Representa a instancia concreta do item que o actor oferece.

Exemplo:

- a macieira nao guarda "maca" dentro de `ga_actor`
- ela guarda uma `ga_item_instance` de `FOOD-APPLE`
- o slot do container aponta para essa instancia com `qty = 5`

## Actor persistente vs loot temporario

### Actor persistente

Deve continuar no mundo mesmo quando o loot acaba.

Exemplos:

- `TREE`
- baú cenografico que deve continuar existindo
- objeto fixo de mapa

Nesses casos:

- o actor permanece em `ga_actor`
- apenas o loot do container pode acabar

### Loot temporario

Deve desaparecer quando fica vazio.

Exemplo:

- `GROUND_LOOT`

Nesses casos:

- o actor pode ser removido quando o container ficar sem item

## Regras atuais do projeto

Hoje a regra de coleta esta assim:

- `TREE` permanece no mundo mesmo vazio
- `GROUND_LOOT` pode desaparecer quando o container fica vazio
- `GROUND_LOOT` vazio antigo tambem pode ser limpo no carregamento do mundo

Arquivos principais:

- [actorCollectService.js](/D:/JS-Projects/Youtube/server/service/actorCollectService.js)
- [inventoryDropService.js](/D:/JS-Projects/Youtube/server/service/inventoryDropService.js)
- [actorLoader.js](/D:/JS-Projects/Youtube/server/service/actorLoader.js)

## Exemplo completo: macieira

Uma macieira correta precisa de:

1. `ga_actor`

- `actor_type = TREE`
- `instance_id = 6`
- `pos_x` e `pos_y`
- `state_json` com algo como:

```json
{
  "resourceType": "APPLE_TREE",
  "visualHint": "TREE"
}
```

2. `ga_container`

- `slot_role = LOOT`
- `container_def_id` apontando para um def reutilizavel

3. `ga_container_owner`

- liga o container ao actor

4. `ga_container_slot`

- slots vazios criados para esse container

5. `ga_item_instance`

- uma instancia de `FOOD-APPLE`

6. `ga_container_slot`

- slot 0 com:
  - `item_instance_id = id da maca`
  - `qty = 5`

## Como repor recurso sem recriar actor

Se a arvore ainda existe no mundo, nao se deve recriar o actor.

O correto e:

1. localizar o actor em `ga_actor`
2. localizar o container dele em `ga_container_owner`
3. criar ou reutilizar uma `ga_item_instance`
4. atualizar `ga_container_slot` com:
   - `item_instance_id`
   - `qty`

Regra pratica:

- recriar loot nao e a mesma coisa que recriar actor
- na maior parte dos casos de respawn de recurso, so o container precisa ser reabastecido

## Quando recriar o actor

So recrie o actor quando:

- ele realmente foi apagado de `ga_actor`
- o mapa precisa ganhar uma nova instancia fisica
- a migration anterior foi executada antes da regra correta e o actor foi perdido

Foi exatamente esse o caso da primeira macieira de teste.

## Exemplo completo: drop no chao

Um drop correto hoje segue este modelo:

1. criar actor com `actor_type = GROUND_LOOT`
2. posicionar no mapa
3. criar container `LOOT`
4. ligar via `ga_container_owner`
5. colocar item no slot
6. preencher `state_json` com:

```json
{
  "dropSource": "inventory",
  "itemInstanceId": 123,
  "itemDefId": 45,
  "itemCode": "FOOD-APPLE",
  "itemName": "Apple",
  "qty": 3,
  "visualHint": "APPLE",
  "sourceKind": "INVENTORY"
}
```

## Regra de visual

O `actor_type` define a familia do actor.

O `state_json.visualHint` ajuda a resolver a aparencia.

Exemplos:

- `TREE` usa asset de arvore
- `GROUND_LOOT` com `visualHint = APPLE` usa asset de maca
- `GROUND_LOOT` com `visualHint = ROCK` usa asset de pedra

## Checklist rapido antes de registrar actor

1. Esse actor deve continuar no mundo quando ficar vazio?
2. Ele precisa de container?
3. O container precisa de quantos slots?
4. O actor e persistente ou temporario?
5. O visual depende so de `actor_type` ou tambem de `state_json.visualHint`?
6. Quando o recurso acabar, devo zerar slot ou remover actor?

## Casos comuns

### Caso A: baú de mapa

Criar:

- `ga_actor`
- `ga_container`
- `ga_container_owner`
- `ga_container_slot`

Decidir:

- se o baú desaparece ou nao quando esvazia

### Caso B: arvore frutifera

Criar:

- `ga_actor` com `actor_type = TREE`
- `ga_container` com `slot_role = LOOT`
- `ga_container_owner`
- slots do container
- item instancia da fruta

Regra:

- a arvore permanece
- o loot pode zerar

### Caso C: drop no chao

Criar:

- `ga_actor` com `actor_type = GROUND_LOOT`
- `ga_container`
- `ga_container_owner`
- `ga_container_slot`

Regra:

- se esvaziar, o actor pode sumir

## Convencao recomendada daqui para frente

Para cada actor novo, decidir nesta ordem:

1. Ele e cenico, recurso, container ou loot temporario?
2. Ele precisa continuar no mundo vazio?
3. Ele precisa de container?
4. O visual e por `actor_type` ou por `visualHint`?
5. O que sera refeito no futuro: o actor ou so o conteudo do container?

## Regra de ouro

Se o objeto continua existindo fisicamente no mapa, o actor deve continuar em `ga_actor`.

Se apenas o conteudo interno acabou, reabasteca o container, nao recrie o actor.
