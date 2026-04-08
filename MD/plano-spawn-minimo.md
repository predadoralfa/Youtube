# Plano de Spawn Mínimo

## Objetivo

Reduzir o sistema de spawn para o modelo feijão com arroz:

- `spawn` define uma área fixa do mapa
- `spawn` define quais inimigos pertencem a essa área
- o worker só restaura `status` e `hp_current` dos inimigos mortos
- o frontend só precisa receber o evento de revive para mostrar o inimigo de novo

## Regra central

Cada spawn é uma área/spot do mapa.
Dentro dele há uma lista fixa de inimigos.
O inimigo não é recriado do zero.
Ele já existe na tabela e só alterna entre `ALIVE` e `DEAD`.

Quando o tempo de respawn chega:

- o worker procura os inimigos mortos daquele spawn
- restaura `hp_current = hp_max`
- muda `status = ALIVE`
- emite evento para o client

## Tabelas mínimas

### `ga_spawn_def`

Define o spawn como template.

Campos sugeridos:

- `id`
- `code`
- `name`
- `status`
- `respawn_ms`
- `created_at`
- `updated_at`

Responsabilidade:

- representar o tipo de spawn
- guardar o tempo de respawn do grupo

### `ga_spawn_def_entry`

Define quais inimigos pertencem a esse spawn.

Campos sugeridos:

- `id`
- `spawn_def_id`
- `enemy_def_id`
- `quantity`
- `sort_order`
- `status`
- `created_at`
- `updated_at`

Responsabilidade:

- dizer quais inimigos compõem o spawn
- dizer quantas cópias daquele inimigo existem no grupo

### `ga_spawn_instance`

Define a colocação do spawn no mapa.

Campos sugeridos:

- `id`
- `instance_id`
- `spawn_def_id`
- `pos_x`
- `pos_z`
- `yaw`
- `status`
- `override_json`
- `created_at`
- `updated_at`

Responsabilidade:

- representar o spawn real em uma instância do mapa
- permitir variações por mapa sem mexer no template

### `ga_enemy_runtime`

Guarda o estado de cada inimigo vivo/morto.

Campos sugeridos:

- `id`
- `spawn_instance_id`
- `spawn_def_entry_id`
- `enemy_def_id`
- `status`
- `pos_x`
- `pos_z`
- `yaw`
- `hp_current`
- `hp_max`
- `dead_at`
- `respawn_at`
- `created_at`
- `updated_at`

Responsabilidade:

- guardar o estado atual do inimigo
- alternar entre vivo e morto
- manter HP e posição persistidos

## O que o worker faz

O worker não cria a lógica do spawn.
Ele só executa a rotina de respawn:

1. localizar inimigos mortos
2. verificar se o tempo de respawn passou
3. restaurar `hp_current` e `status`
4. notificar o client

## O que sai do modelo antigo

Este desenho elimina a necessidade de:

- peso por componente
- quantidade variável por sorteio
- lógica probabilística desnecessária
- estrutura excessivamente genérica para o caso atual

## Ordem de implantação

1. ajustar schema para o modelo mínimo
2. migrar dados do legado para o novo formato
3. ligar o worker de respawn ao novo schema
4. validar no mapa com um spawn simples
5. repetir para os outros mapas e inimigos

## Observação

Se algum dia o jogo precisar de spawn probabilístico mais complexo, isso deve entrar como extensão opcional.
O MVP não precisa disso.
