# Guia de CID de Container para Actors

## Objetivo

Este guia explica como criar uma CID de container para instalar containers dentro de actors no projeto.

Aqui, `CID` significa o identificador estavel do container, ou seja, o `code` de `ga_container_def`.

O fluxo atual do jogo separa:

- definicao do actor em `ga_actor_def`
- spawn fixo no mapa em `ga_actor_spawn`
- runtime do actor em `ga_actor`
- definicao do container em `ga_container_def`
- instancia do container em `ga_container`
- dono do container em `ga_container_owner`
- itens do container em `ga_container_slot`

## Modelo mental

### `ga_container_def`

Define o tipo de container.

Campos mais importantes:

- `code`: CID do container
- `name`: nome humano
- `slot_count`: quantidade de slots
- `max_weight`: capacidade maxima de peso daquele container
- `allowed_categories_mask`: filtro de categorias, quando usado
- `is_active`: ativacao do tipo

Regra de capacidade:

- a capacidade total do jogador e a soma dos `max_weight` de todos os containers ativos dele
- `HAND_L` e `HAND_R` devem ter `2.5` kg cada
- `BASKET` deve ter `10` kg
- a tela de inventario precisa refletir essa soma, nao um valor fixo do personagem

Exemplos de CID:

- `LOOT_CONTAINER`
- `CHEST_TEST`
- `PLAYER_BACKPACK`

### `ga_container`

E a instancia real do container no mundo.

Ele aponta para:

- `container_def_id`
- `slot_role`
- `state`
- `rev`

### `ga_container_owner`

Liga o container ao dono.

Hoje os dois donos principais sao:

- `PLAYER`
- `ACTOR`

Para actor, o relacionamento normal e:

- `owner_kind = ACTOR`
- `owner_id = id do actor runtime`
- `slot_role = LOOT`

### `ga_container_slot`

Guarda o conteudo do container.

Cada slot tem:

- `container_id`
- `slot_index`
- `item_instance_id`
- `qty`

## Como criar um container para actor

O jeito recomendado e fazer o actor apontar para um `default_container_def_id`.

Exemplo:

- `ga_actor_def.default_container_def_id = id de ga_container_def`

Quando o actor carregar, o servidor chama o fluxo automatico:

- `createRuntimeActor`
- `ensureActorContainer`

Esse fluxo cria:

1. o actor runtime em `ga_actor`
2. o container em `ga_container`
3. o owner em `ga_container_owner`
4. os slots vazios em `ga_container_slot`

## Regra pratica

Se o actor precisa carregar loot, faca assim:

1. criar `ga_container_def`
2. criar `ga_actor_def`
3. apontar `ga_actor_def.default_container_def_id` para o container
4. criar `ga_actor_spawn` para a posicao do actor
5. deixar o loader criar o runtime e o container

Se o actor nao precisa de loot, nao defina container padrao.

## Exemplo de migration

```js
await queryInterface.bulkInsert("ga_container_def", [
  {
    code: "CHEST_TEST",
    name: "Test Chest",
    slot_count: 8,
    max_weight: 30,
    allowed_categories_mask: null,
    is_active: true,
  },
]);
```

Depois, no actor def:

```js
await queryInterface.bulkUpdate(
  "ga_actor_def",
  { default_container_def_id: chestContainerDefId },
  { code: "CHEST_TEST" }
);
```

## Exemplo de fluxo para actor de loot

### 1. Definir o actor

```js
{
  code: "GROUND_LOOT",
  name: "Ground Loot",
  actor_kind: "LOOT",
  visual_hint: "DEFAULT",
  default_container_def_id: lootContainerDefId
}
```

### 2. Definir o container

```js
{
  code: "LOOT_CONTAINER",
  name: "Loot Container",
  slot_count: 1
}
```

### 3. Criar o spawn

```js
{
  instance_id: 6,
  actor_def_id: groundLootActorDefId,
  pos_x: 40,
  pos_y: 0,
  pos_z: 12,
  is_active: true
}
```

### 4. Inserir item no slot

```js
{
  container_id: lootContainerId,
  slot_index: 0,
  item_instance_id: itemInstanceId,
  qty: 1
}
```

## O que o código já faz hoje

O servidor ja tem o caminho para montar containers de actor por definicao:

- [`server/service/actorService.js`](../server/service/actorService.js)
- [`server/service/actorLoader.js`](../server/service/actorLoader.js)

O fluxo usa `default_container_def_id` para criar container automaticamente quando o actor nasce.

## O que nao fazer

- nao usar `state_json` do actor como substituto do container
- nao guardar loot de actor direto no runtime sem container
- nao hardcodar slots do loot dentro do actor
- nao criar actor sem `ga_container_owner` se ele precisar de container

## Checklist rapido

Antes de criar um actor com container, confirme:

- o `ga_container_def.code` existe
- o `ga_container_def.max_weight` foi definido para a capacidade desejada
- o `ga_actor_def.code` existe
- o `ga_actor_def.default_container_def_id` aponta para o container certo
- o `ga_actor_spawn` foi criado
- o loader vai conseguir chamar `ensureActorContainer`
- os slots iniciais foram criados em `ga_container_slot`

## Resumo

Se a pergunta for "como instalar um container dentro de um actor?", a resposta curta e:

1. criar a CID em `ga_container_def`
2. ligar essa CID ao `ga_actor_def.default_container_def_id`
3. deixar o servidor criar `ga_container`, `ga_container_owner` e `ga_container_slot`

Esse e o caminho certo para manter o sistema auditavel e sem hardcode.
