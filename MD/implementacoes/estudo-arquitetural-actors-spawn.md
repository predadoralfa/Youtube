# Estudo Arquitetural - Actors e Spawns

## Objetivo

Este documento registra a proposta de reorganizacao do sistema de actors do jogo para tirar o peso do hardcode do codigo e mover a fonte da verdade para o banco de dados.

O foco principal e separar claramente:

- definicao do tipo de actor
- localizacao do actor no mapa
- estado runtime do actor durante o jogo

## Problema atual

Hoje o sistema mistura tres coisas diferentes:

- definicao do actor no codigo
- posicao fixa do actor em migrations/seed
- estado dinamico do actor dentro de `ga_actor`

Isso ja gerou problemas praticos:

- tres arvores seedadas como posicoes fixas em uma migration
- baus e drops com comportamento misturado entre `state_json` e container
- dificuldade de auditar o que e tipo global e o que e instancia colocada no mapa
- dificuldade de criar variacoes por instancia sem mexer em codigo

## Estado atual do sistema

### `ga_actor`

Hoje `ga_actor` funciona como instancia runtime do mundo:

- `actor_type`
- `instance_id`
- `pos_x`
- `pos_y`
- `state_json`
- `status`

Isso e util para runtime, mas nao deveria carregar sozinho a responsabilidade de descrever o tipo do actor ou a regra do spawn.

### `ga_container`

O loot de actors usa a regra atual:

- `ga_container_owner` liga actor -> container
- `ga_container_slot` guarda os itens do loot

Essa parte e boa e deve continuar existindo.

### Exemplo atual de problema

A seed das arvores em `instance 6` ainda usa uma lista fixa de posicoes no codigo.

Isso torna o mapa menos dinamico do que o necessario para o sistema que estamos construindo.

## Proposta de arquitetura

### 1. `ga_actor_def`

Tabela de definicao do actor.

Ela responde:

- que tipo de actor e esse
- qual e o nome visual
- qual e o comportamento padrao
- qual e a configuracao base

Campos sugeridos:

- `id`
- `code`
- `name`
- `actor_kind`
- `visual_hint`
- `default_state_json`
- `default_container_def_id`
- `is_active`

Interpretacao:

- `code` e a chave estavel do tipo
- `actor_kind` separa dominios como `TREE`, `CHEST`, `DROP`, `NPC`, `NODE`
- `visual_hint` ajuda o client a saber como representar o actor
- `default_state_json` guarda metadados iniciais
- `default_container_def_id` aponta para o container padrao, quando existir

### 2. `ga_actor_spawn`

Tabela de colocacao no mapa.

Ela responde:

- onde o actor aparece
- em qual instancia do mundo
- se o spawn esta ativo
- qual definicao ele usa

Campos sugeridos:

- `id`
- `instance_id`
- `actor_def_id`
- `pos_x`
- `pos_y`
- `pos_z`
- `state_override_json`
- `is_active`
- `rev`

Interpretacao:

- esta tabela e a fonte da verdade da localizacao
- o actor runtime continua existindo em `ga_actor`
- o spawn descreve o que existe no mapa

### 3. `ga_actor`

Continua sendo a instancia runtime.

Ela deve guardar somente o que muda durante o jogo:

- posicao atual
- estado atual
- vida/status runtime
- estados temporarios

O ideal e que `ga_actor` seja derivado do spawn + definicao quando o mundo carrega, e nao o contrario.

## Fluxo proposto

### Carregamento do mapa

1. O servidor carrega `ga_actor_spawn`
2. Para cada spawn ativo, busca `ga_actor_def`
3. Se o actor runtime ainda nao existir, cria a instancia em `ga_actor`
4. Se existir, reaplica a definicao padrao com overrides apenas quando necessario

### Salvamento

- alteracoes de runtime continuam em `ga_actor`
- mudancas de mundo, localizacao e presenca visual continuam em `ga_actor_spawn`
- loot continua em `ga_container` e `ga_container_slot`

## Regra de ouro

### O codigo nao deve decidir sozinho onde o actor existe

O codigo pode:

- interpretar
- validar
- carregar
- aplicar regras

Mas a fonte da verdade de spawn precisa ser o banco.

### O codigo nao deve depender de listas fixas de posicao

Lista fixa de posicoes em migration so deve existir como seed inicial ou dado legado.

Depois que o sistema novo existir, essas posicoes devem virar linhas em `ga_actor_spawn`.

## Como isso afeta os casos atuais

### Arvore de maca

Hoje a arvore funciona como:

- actor runtime em `ga_actor`
- container LOOT ligado ao actor
- loot dentro de `ga_container_slot`

No sistema novo:

- `ga_actor_def` define a arvore
- `ga_actor_spawn` define as posicoes das arvores
- `ga_actor` continua runtime
- `ga_container` e `ga_container_slot` continuam guardando o loot

### Rocha/minerio

O mesmo padrao deve valer para nodes de pedra:

- definicao unica do tipo
- varios spawns no mapa
- loot/regeneracao por regra do actor ou do resource node

### Baus

Mesmo raciocinio:

- definicao do tipo de bau em `ga_actor_def`
- posicoes em `ga_actor_spawn`
- conteudo em `ga_container_slot`

## Regeneracao de recursos

O sistema de regeneracao nao deve ficar preso a um tipo especifico de actor.

Sugestao:

- a definicao do actor pode apontar para uma regra de recurso
- a instancia runtime pode guardar o estado atual da regeneracao
- o container pode continuar sendo apenas o depositario do loot

Campos possiveis para uma regra futura:

- `resource_rule_code`
- `regen_interval_ms`
- `regen_amount`
- `regen_cap`
- `deplete_despawn_mode`

## Ordem recomendada de migracao

### Fase 1

- criar `ga_actor_def`
- seedar definicoes basicas:
  - `TREE_APPLE`
  - `CHEST_TEST`
  - `ROCK_NODE_SMALL`
  - `GROUND_LOOT`

### Fase 2

- criar `ga_actor_spawn`
- migrar as posicoes hardcoded atuais para essa tabela
- manter o runtime funcionando com fallback para o modelo antigo durante a transicao

### Fase 3

- atualizar o loader do mundo para ler `spawn -> def -> runtime`
- remover dependencia de posicoes fixas do codigo

### Fase 4

- simplificar seeds antigas
- deixar migrations antigas somente como base historica

## Riscos

- migrar demais de uma vez pode quebrar o baseline do mundo
- apagar um actor antigo sem mover o container/loot antes pode perder referencia
- duplicar a responsabilidade entre `ga_actor` e `ga_actor_spawn` sem contrato claro pode aumentar a confusao

## Decisao pratica sugerida

Manter:

- `ga_actor` como runtime
- `ga_container` como loot/inventario de actor

Criar:

- `ga_actor_def` como definicao global
- `ga_actor_spawn` como localizacao no mapa

Nao criar:

- nova logica de loot paralela
- hardcode novo de posicoes em migration

## Resumo

O objetivo final e fazer o jogo ler o mundo assim:

- banco define o tipo
- banco define a posicao
- runtime registra o estado temporario
- loot continua no container

Isso deixa o sistema mais auditavel, mais facil de editar e mais pronto para crescer com novas rochas, arvores, baues, nodes e actors especiais.
