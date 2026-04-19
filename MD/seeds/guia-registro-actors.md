# Registro de Novo Actor

## Objetivo

Este guia descreve o fluxo atual para cadastrar um novo actor no projeto depois da refatoracao que separou:

- definicao global em `ga_actor_def`
- colocacao fixa no mapa em `ga_actor_spawn`
- estado runtime em `ga_actor`

Use este documento sempre que for criar:

- npc
- objeto de cenario
- bau
- recurso coletavel
- loot no chao

## Modelo mental

### `ga_actor_def`

Define o tipo base do actor.

Campos mais importantes:

- `code`: identificador estavel do actor
- `name`: nome humano
- `actor_kind`: familia ampla
- `visual_hint`: dica visual padrao
- `default_state_json`: estado base
- `default_container_def_id`: container padrao, quando existir

Exemplos:

- `TREE_APPLE`
- `GROUND_LOOT`
- `CHAIR_WOOD`
- `CHEST_TEST`

Atores de recurso ja usados no projeto:

- `TREE_APPLE` = arvore de maca
- `ROCK_NODE_SMALL` = nodo de pedra pequeno
- `FIBER_PATCH` = patch de grama/fibra

Regra pratica:

- quando voce quiser mais grama ou fibra, replique `FIBER_PATCH`
- nao crie um nome novo se a familia ja existe
- use `visual_hint = GRASS` para esse tipo de patch

### `ga_actor_spawn`

Define onde o actor existe no mapa de forma fixa.

Use quando:

- o actor faz parte do cenario
- o actor deve nascer sempre naquela instancia
- o actor nao e transitório

Nao use para:

- drop no chao
- loot momentaneo
- actor criado por acao runtime do jogador

### `ga_actor`

E a instancia runtime.

Ele guarda:

- qual definicao esta sendo usada
- qual spawn originou o actor, quando existir
- posicao atual
- estado atual
- status

Regra:

- actor fixo do mapa normalmente nasce de `spawn`
- actor transitório pode existir so em `ga_actor`

## Campo `actor_kind`

Por enquanto `actor_kind` e `string`, nao `enum`.

Isso e intencional para o projeto poder evoluir sem migration a cada tipo novo.

Valores recomendados hoje:

- `OBJECT`
- `NPC`
- `LOOT`
- `RESOURCE_NODE`

## Como decidir o tipo certo

### Caso 1: objeto decorativo

Exemplo:

- cadeira
- mesa
- estante

Use:

- `actor_kind = OBJECT`

Normalmente:

- tem spawn fixo
- nao precisa de container
- nao precisa de loot
- pode ter so `visual_hint`

### Caso 2: npc

Exemplo:

- vendedor
- aldeao
- personagem estatico

Use:

- `actor_kind = NPC`

Normalmente:

- tem spawn fixo
- pode ter ou nao container
- comportamento fica no codigo/state

### Caso 3: recurso

Exemplo:

- arvore
- rocha
- nodo de minerio

Use:

- `actor_kind = RESOURCE_NODE`

Normalmente:

- tem spawn fixo
- costuma ter `default_container_def_id`
- estado base em `default_state_json`

### Caso 4: loot no chao

Exemplo:

- item dropado do inventario
- saque deixado no mapa

Use:

- `code = GROUND_LOOT`
- `actor_kind = LOOT`

Regra:

- a definicao base existe em `ga_actor_def`
- o runtime nasce na hora do drop
- o actor pode desaparecer quando o loot acaba

## Fluxo para criar um actor novo

### Passo 1: criar a definicao

Adicione uma seed ou migration em `ga_actor_def`.

Checklist:

- escolher `code`
- escolher `actor_kind`
- escolher `visual_hint`
- decidir se precisa de `default_container_def_id`
- definir `default_state_json`

Exemplo conceitual:

```json
{
  "code": "CHAIR_WOOD",
  "name": "Wooden Chair",
  "actor_kind": "OBJECT",
  "visual_hint": "CHAIR",
  "default_state_json": {
    "visualHint": "CHAIR"
  }
}
```

### Passo 2: decidir se ele precisa de spawn

Se for fixo no mapa, criar entrada em `ga_actor_spawn`.

Campos importantes:

- `instance_id`
- `actor_def_id`
- `pos_x`
- `pos_y`
- `pos_z`
- `state_override_json`

Use `state_override_json` so para variacao por instancia.

Exemplos:

- nome customizado
- asset especifico
- orientacao/config extra

### Passo 3: decidir se ele precisa de container

Pergunta:

- esse actor guarda item?

Se sim:

- preencher `default_container_def_id` em `ga_actor_def`

Exemplos:

- arvore com fruta
- bau
- loot no chao

Se nao:

- deixar `default_container_def_id = null`

Exemplos:

- cadeira
- estatua
- npc so visual

### Passo 4: decidir se ele e fixo ou transitório

Fixo:

- tem `ga_actor_spawn`
- runtime pode ser recriado a partir do spawn

Transitório:

- nasce direto em `ga_actor`
- nao precisa de `ga_actor_spawn`

Exemplo transitório:

- `GROUND_LOOT`

## Como registrar um actor fixo novo

### Exemplo: cadeira

1. Criar `ga_actor_def`

- `code = CHAIR_WOOD`
- `actor_kind = OBJECT`
- `visual_hint = CHAIR`
- sem container

2. Criar `ga_actor_spawn`

- instancia
- posicao

3. Nao criar container

Resultado:

- o loader do mundo cria ou reaproveita o runtime em `ga_actor`
- o client renderiza pela definicao e pelo `visual_hint`

## Como registrar um resource node novo

### Exemplo: arvore de maca

1. Criar `ga_actor_def`

- `code = TREE_APPLE`
- `actor_kind = RESOURCE_NODE`
- `visual_hint = TREE`
- `default_container_def_id = container de loot`
- `default_state_json` com:
  - `resourceType`
  - `visualHint`

2. Criar `ga_actor_spawn`

- uma linha por arvore no mapa

3. Se precisar de loot inicial:

- criar runtime e popular container em migration

Observacao:

- o spawn define a existencia no mapa
- o container define o conteudo
- o runtime guarda o estado atual

## Como registrar um loot runtime novo

### Exemplo: drop no chao

Nao criar spawn.

O fluxo correto e:

1. garantir definicao `GROUND_LOOT` em `ga_actor_def`
2. quando o jogador dropar item, criar `ga_actor` runtime usando `GROUND_LOOT`
3. preencher `state_json` com dados do item naquele momento
4. criar container `LOOT`
5. colocar item no slot

Campos runtime comuns no `state_json`:

- `itemInstanceId`
- `itemDefId`
- `itemCode`
- `itemName`
- `qty`
- `visualHint`
- `dropSource`
- `sourceKind`

## Como o loader funciona hoje

Fluxo resumido:

1. carrega spawns ativos
2. garante runtime em `ga_actor` para cada spawn
3. garante container padrao quando a definicao exige
4. carrega actors runtime da instancia
5. anexa containers e resumo de loot

Arquivos principais:

- [actorLoader.js](/D:/JS-Projects/Youtube/server/service/actorLoader.js)
- [actorService.js](/D:/JS-Projects/Youtube/server/service/actorService.js)
- [ga_actor_def.js](/D:/JS-Projects/Youtube/server/models/ga_actor_def.js)
- [ga_actor_spawn.js](/D:/JS-Projects/Youtube/server/models/ga_actor_spawn.js)
- [ga_actor.js](/D:/JS-Projects/Youtube/server/models/ga_actor.js)

## Checklist antes de cadastrar um actor

1. Ele e `OBJECT`, `NPC`, `LOOT` ou `RESOURCE_NODE`?
2. Ele e fixo no mapa ou transitório?
3. Precisa de spawn?
4. Precisa de container?
5. O visual base vem de `visual_hint`?
6. O runtime vai precisar preencher informacoes dinamicas?

## Regra de ouro

Se o actor existe como parte do mapa, a fonte de verdade e `ga_actor_spawn`.

Se o actor existe so por um evento runtime, ele nasce direto em `ga_actor`.

Se o actor precisa armazenar item, isso continua sendo responsabilidade de:

- `ga_container`
- `ga_container_owner`
- `ga_container_slot`

Nao colocar regra de inventario dentro de `ga_actor`.
