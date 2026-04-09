# Guia de Registro de Spawners

## Objetivo

Este documento padroniza como novos spawners devem ser registrados no projeto no modelo novo, sem redundancia e com reutilizacao entre instancias.

O fluxo correto agora e:

- `ga_spawn_def`: define o spawner reutilizavel
- `ga_spawn_def_enemy`: define quais inimigos existem dentro desse spawner
- `ga_spawn_instance`: coloca esse spawner em uma instancia do mapa
- `ga_spawn_instance_enemy`: representa os slots concretos persistidos daquele spawner colocado

## Passo zero obrigatorio

Antes de criar um spawner novo, ler primeiro os models reais do backend:

- [ga_spawn_def.js](/D:/JS-Projects/Youtube/server/models/ga_spawn_def.js)
- [ga_spawn_def_enemy.js](/D:/JS-Projects/Youtube/server/models/ga_spawn_def_enemy.js)
- [ga_spawn_instance.js](/D:/JS-Projects/Youtube/server/models/ga_spawn_instance.js)
- [ga_spawn_instance_enemy.js](/D:/JS-Projects/Youtube/server/models/ga_spawn_instance_enemy.js)
- [ga_enemy_def.js](/D:/JS-Projects/Youtube/server/models/ga_enemy_def.js)
- [ga_enemy_def_stats.js](/D:/JS-Projects/Youtube/server/models/ga_enemy_def_stats.js)

Motivo:

- os enums reais vivem nesses models
- a migration ou seed precisa respeitar exatamente o schema
- isso evita inventar coluna ou comportamento que o sistema nao persiste

## Modelo mental

### 1. `ga_spawn_def`

E o template reutilizavel do spawner.

Ele responde:

- qual e o tipo de area de spawn
- qual e o raio
- qual e o tempo base de respawn
- qual e a area de patrulha

Exemplos:

- `SPAWN_COELHOS_INICIAIS`
- `SPAWN_RAPOSAS_FLORESTA`
- `SPAWN_COELHO_RAPOSA_MISTO`

Campos principais:

- `code`
- `name`
- `status`
- `spawn_kind`
- `shape_kind`
- `radius`
- `max_alive`
- `respawn_ms`
- `patrol_radius`
- `patrol_wait_ms`
- `patrol_stop_radius`

Regra:

- aqui nao entra coordenada de mapa
- aqui nao entra estado de hp
- aqui nao entra estado vivo/morto

### 2. `ga_spawn_def_enemy`

E a filha do spawner.

Ela responde:

- quais inimigos existem dentro do spawner
- quantos de cada tipo existem
- em que ordem logica eles aparecem

Campos principais:

- `spawn_def_id`
- `enemy_def_id`
- `status`
- `quantity`
- `sort_order`

Exemplo:

Um spawner com 4 coelhos e 1 raposa:

- linha 1: `enemy_def = WILD_RABBIT`, `quantity = 4`
- linha 2: `enemy_def = FOX`, `quantity = 1`

Regra:

- se quiser adicionar mais bichos no mesmo spawner, altera esta tabela
- nao precisa criar novo schema

### 3. `ga_spawn_instance`

E a colocacao concreta do spawner em uma instancia de mapa.

Ela responde:

- qual spawner foi usado
- em qual instancia ele foi colocado
- em que posicao ele fica

Campos principais:

- `spawn_def_id`
- `instance_id`
- `pos_x`
- `pos_z`
- `yaw`
- `status`

Exemplo:

- o mesmo `SPAWN_COELHOS_INICIAIS` pode existir na instancia 7
- e tambem na instancia 8
- e tambem na instancia 9
- cada uma em coordenadas diferentes

Regra:

- `ga_spawn_instance` nao define quais inimigos existem
- ele so coloca no mapa um template ja definido

### 4. `ga_spawn_instance_enemy`

E a filha do spawner colocado no mapa.

Ela representa os slots concretos persistidos daquele spawner.

Campos principais:

- `spawn_instance_id`
- `spawn_def_enemy_id`
- `slot_index`
- `status`
- `hp_current`
- `dead_at`
- `respawn_at`

Esse e o estado minimo que precisa persistir.

Regra importante:

- nao duplicar `enemy_def_id` aqui
- ele ja vem de `spawn_def_enemy_id`

## O que nao deve ser cadastrado nessa parte

Nao persistir aqui:

- posicao atual momentanea do inimigo
- yaw atual do inimigo
- alvo atual
- cooldown momentaneo
- ponto aleatorio atual de patrulha

Essas informacoes ficam em memoria no servidor.

## Fluxo correto para registrar um spawner novo

### Passo 1: garantir que o inimigo pai ja existe

Antes de tudo, o inimigo precisa existir em:

- `ga_enemy_def`
- `ga_enemy_def_stats`

Sem isso, o spawner nao tem o que instanciar.

Checklist:

1. confirmar `code` do inimigo
2. confirmar `name`
3. confirmar stats base
4. confirmar `status = ACTIVE`

### Passo 2: criar o `ga_spawn_def`

Criar a definicao reutilizavel do spawner.

Checklist:

1. escolher um `code` estavel
2. escolher um `name` humano
3. definir `shape_kind`
4. definir `radius`
5. definir `respawn_ms`
6. definir `patrol_radius`
7. definir `patrol_wait_ms`
8. definir `patrol_stop_radius`

Exemplo conceitual:

```json
{
  "code": "SPAWN_COELHOS_INICIAIS",
  "name": "Coelhos Iniciais",
  "spawn_kind": "ENEMY",
  "shape_kind": "CIRCLE",
  "radius": 8,
  "max_alive": 4,
  "respawn_ms": 30000,
  "patrol_radius": 6,
  "patrol_wait_ms": 4000,
  "patrol_stop_radius": 0.5,
  "status": "ACTIVE"
}
```

### Passo 3: criar os filhos em `ga_spawn_def_enemy`

Aqui entra a composicao do spawner.

Exemplo 1: spawner so de coelho

```json
[
  {
    "spawn_def_id": 10,
    "enemy_def_id": 1,
    "quantity": 4,
    "sort_order": 0,
    "status": "ACTIVE"
  }
]
```

Exemplo 2: spawner misto

```json
[
  {
    "spawn_def_id": 11,
    "enemy_def_id": 1,
    "quantity": 4,
    "sort_order": 0,
    "status": "ACTIVE"
  },
  {
    "spawn_def_id": 11,
    "enemy_def_id": 2,
    "quantity": 1,
    "sort_order": 1,
    "status": "ACTIVE"
  }
]
```

Regra pratica:

- um tipo de inimigo por linha
- `quantity` define quantos slots daquele tipo o sistema deve materializar

### Passo 4: colocar o spawner no mapa em `ga_spawn_instance`

Agora sim ele vai para uma instancia concreta.

Exemplo:

```json
{
  "spawn_def_id": 10,
  "instance_id": 7,
  "pos_x": 18,
  "pos_z": 24,
  "yaw": 0,
  "status": "ACTIVE"
}
```

Se quiser usar o mesmo spawner em outro mapa:

- cria outra linha em `ga_spawn_instance`
- muda apenas `instance_id` e coordenadas

### Passo 5: nao criar manualmente `ga_spawn_instance_enemy` sem necessidade

Regra geral:

- essa tabela deve ser preenchida e sincronizada pelo sistema
- o `spawnTick` cria os slots faltantes
- o `spawnTick` remove slots excedentes
- o combate atualiza `hp_current`
- o respawn troca `status` e restaura hp

So criar manualmente se houver uma necessidade muito especifica de ajuste de dados.

## Como editar um spawner existente

### Caso A: aumentar a quantidade do mesmo inimigo

Exemplo:

- antes: `WILD_RABBIT quantity = 2`
- depois: `WILD_RABBIT quantity = 4`

Acao:

- alterar `ga_spawn_def_enemy.quantity`

Resultado esperado:

- o sistema criara mais slots em `ga_spawn_instance_enemy`

### Caso B: adicionar um novo inimigo ao mesmo spawner

Exemplo:

- spawner tinha apenas coelhos
- agora tambem tera 1 raposa

Acao:

- inserir nova linha em `ga_spawn_def_enemy`

Resultado esperado:

- os `spawn_instance` que usam esse `spawn_def` passarao a materializar o novo tipo

### Caso C: mover o spawner de lugar em um mapa especifico

Acao:

- alterar `ga_spawn_instance.pos_x` e `ga_spawn_instance.pos_z`

Resultado:

- o template continua o mesmo
- so muda a colocacao naquela instancia

## Checklist de cadastro

Antes de considerar um spawner pronto:

1. o `enemy_def` existe e esta `ACTIVE`
2. o `ga_spawn_def` foi criado com `code` e regras corretas
3. o `ga_spawn_def_enemy` tem a composicao correta
4. o `ga_spawn_instance` foi criado na instancia certa
5. o servidor materializou os slots em `ga_spawn_instance_enemy`
6. os inimigos aparecem na tela
7. ao morrer, o slot vai para `DEAD`
8. no respawn, o slot volta para `ALIVE` com `hp_current` cheio

## Regra de ouro

Se estiver em duvida sobre onde cadastrar algo, use esta pergunta:

- isso e definicao reutilizavel?
  - vai para `ga_spawn_def`
- isso e composicao do spawner?
  - vai para `ga_spawn_def_enemy`
- isso e colocacao no mapa?
  - vai para `ga_spawn_instance`
- isso e estado mutavel de um slot concreto?
  - vai para `ga_spawn_instance_enemy`

Se puder ser derivado por relacionamento, nao duplicar coluna.
