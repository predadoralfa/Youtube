# Plano Tecnico - Respawn de Inimigos por Instancia

## Objetivo

Este documento define como o sistema de respawn de inimigos deve evoluir para suportar regras diferentes por instancia do mundo.

Exemplo do problema:

- uma instancia pode regenerar inimigos rapidamente
- outra instancia, do mesmo local, pode regenerar mais lentamente
- no estado atual, o sistema nao expressa bem essa diferenca

O objetivo e sair de um modelo parcialmente hardcoded para um modelo guiado por banco, com configuracao clara por instancia e reaproveitamento maximo do que ja existe.

## Resumo executivo

Decisao principal:

- manter `ga_spawn_point` como configuracao do ponto de spawn
- criar uma tabela filha de `ga_instance` para configuracao macro de spawn da instancia
- continuar usando `respawn_ms` em `ga_spawn_point` como base
- aplicar multiplicadores e flags da instancia por cima
- refatorar o loop para respeitar `dead_at` e `respawn_at`

Decisao importante:

- nao colocar essa configuracao em `ga_local`
- nao inflar `ga_instance` com varias colunas de spawn
- usar `ga_instance_spawn_config` como lugar proprio dessa regra

## Estado atual

### O que ja existe

Arquivos atuais:

- [spawnConfig.js](/D:/JS-Projects/Youtube/server/state/spawn/spawnConfig.js)
- [spawnLoop.js](/D:/JS-Projects/Youtube/server/state/spawn/spawnLoop.js)
- [spawnTick.js](/D:/JS-Projects/Youtube/server/state/spawn/spawnTick.js)
- [ga_spawn_point.js](/D:/JS-Projects/Youtube/server/models/ga_spawn_point.js)
- [ga_spawn_entry.js](/D:/JS-Projects/Youtube/server/models/ga_spawn_entry.js)
- [ga_enemy_instance.js](/D:/JS-Projects/Youtube/server/models/ga_enemy_instance.js)
- [ga_instance.js](/D:/JS-Projects/Youtube/server/models/ga_instance.js)
- [ga_local.js](/D:/JS-Projects/Youtube/server/models/ga_local.js)

Hoje ja existem no banco:

- `ga_spawn_point.instance_id`
- `ga_spawn_point.max_alive`
- `ga_spawn_point.respawn_ms`
- `ga_enemy_instance.dead_at`
- `ga_enemy_instance.respawn_at`

### O que funciona hoje

O sistema atual ja consegue:

- encontrar spawn points por instancia
- selecionar entries por peso
- gerar posicao de spawn
- criar `ga_enemy_instance`
- criar `ga_enemy_instance_stats`
- empurrar o inimigo para o runtime store

### O que esta faltando

O sistema atual ainda nao trata o respawn de forma completa.

Problemas observados:

1. o loop usa um tick global fixo

- `SPAWN_TICK_MS = 180000`
- isso significa um ciclo de 3 minutos para processar spawn

2. `respawn_ms` existe no banco, mas nao governa de verdade o nascimento

- o `spawnTick` usa `max_alive`, `shape`, `entries`
- mas nao valida `dead_at` e `respawn_at` como regra central de retorno

3. o inimigo morto e so marcado como morto

- em combate, o sistema faz `status = DEAD` e preenche `dead_at`
- nao ha uma rotina forte de reaproveitamento daquele inimigo morto

4. a configuracao ainda e muito dependente do codigo

- varios defaults estao presos em `spawnConfig.js`
- isso deveria ser fallback tecnico, nao regra principal de gameplay

## Leitura arquitetural

## Por que nao usar `ga_local`

`ga_local` representa o template geografico/logico do lugar.

Se colocarmos regra de respawn em `ga_local`, herdaremos este comportamento:

- todo mapa daquele local vai compartilhar o mesmo pacing

Isso conflita com a necessidade atual:

- instancias diferentes do mesmo local precisam poder ter comportamentos diferentes

Conclusao:

- `ga_local` nao deve ser o dono da regra de respawn por instancia

## Por que nao jogar tudo em `ga_instance`

`ga_instance` hoje e uma entidade curta e estrutural:

- liga o mundo ao local
- define tipo da instancia
- guarda era atual
- status

Se comecarmos a empilhar varias colunas de spawn em `ga_instance`, ela ficara misturada com regra de gameplay.

Isso piora em evolucoes futuras, por exemplo:

- respawn habilitado ou nao
- multiplicador de tempo
- multiplicador de quantidade
- limite global
- eventos especiais

Conclusao:

- `ga_instance` deve continuar como dono logico
- mas a configuracao deve ir para uma tabela filha especializada

## Solucao proposta

### Nova tabela: `ga_instance_spawn_config`

Essa tabela sera filha direta de `ga_instance`.

Ela concentrara regras macro de spawn para aquela instancia.

Campos propostos:

- `id`
- `instance_id`
- `enemy_spawn_enabled`
- `respawn_multiplier`
- `spawn_quantity_multiplier`
- `max_alive_multiplier`
- `spawn_tick_ms`
- `created_at`
- `updated_at`

### Significado dos campos

`instance_id`

- fk para `ga_instance`
- idealmente com unique para manter 1 config por instancia

`enemy_spawn_enabled`

- liga/desliga spawn de inimigos naquela instancia
- bom para mapa especial, debug ou evento temporario

`respawn_multiplier`

- multiplica o `respawn_ms` de cada `ga_spawn_point`
- exemplo:
  - `1.0` = normal
  - `2.0` = respawn 2x mais lento
  - `0.5` = respawn 2x mais rapido

`spawn_quantity_multiplier`

- multiplica a quantidade final que um spawn point vai tentar gerar
- util para instancia mais “cheia” ou “leve”

`max_alive_multiplier`

- multiplica o teto de vivos permitido no spawn point

`spawn_tick_ms`

- intervalo tecnico de varredura daquela instancia
- opcional
- se quiser simplificar a primeira versao, esse campo pode ficar fora da fase 1

## Tabelas que continuam existindo

### `ga_spawn_point`

Continua sendo a configuracao local do ponto de spawn.

Campos atuais relevantes:

- `instance_id`
- `shape_kind`
- `radius`
- `max_alive`
- `respawn_ms`
- `patrol_radius`
- `patrol_wait_ms`
- `patrol_stop_radius`

Papel futuro:

- continuar como configuracao base do ponto
- receber o multiplicador da instancia na hora do calculo

### `ga_spawn_entry`

Continua definindo:

- qual inimigo pode nascer
- peso
- quantidade minima
- quantidade maxima
- limite por entry

Nao precisa mudar nesta fase.

### `ga_enemy_instance`

Continua sendo o runtime persistido do inimigo.

Campos importantes:

- `status`
- `dead_at`
- `respawn_at`
- `spawn_point_id`
- `spawn_entry_id`

Mas o uso dessa tabela vai mudar.

## Mudanca de estrategia recomendada

### Hoje

Hoje o sistema tende a criar novas linhas quando vai gerar inimigos.

Problema:

- a tabela pode crescer sem necessidade
- fica ruim de auditar
- o “slot” do inimigo no spawn point nao fica claro

### Proposta

Reaproveitar instancias mortas antes de criar novas.

Fluxo:

1. inimigo nasce em `ga_enemy_instance`
2. inimigo morre
3. `status = DEAD`
4. `dead_at = now`
5. `respawn_at = now + effective_respawn_ms`
6. quando chegar a hora:
   - resetar hp
   - resetar posicao
   - resetar home
   - `status = ALIVE`
   - limpar `dead_at`
   - limpar `respawn_at`

Vantagens:

- menos lixo historico
- cada spawn point reaproveita seu proprio conjunto de inimigos
- mais facil debugar e administrar

## Formula de respawn

O tempo final de respawn deve ser:

`effective_respawn_ms = ga_spawn_point.respawn_ms * ga_instance_spawn_config.respawn_multiplier`

Opcionalmente:

- arredondar para inteiro
- aplicar piso minimo tecnico

Exemplo:

- spawn point base = `30000`
- instancia lenta = `2.0`
- resultado = `60000`

Outro exemplo:

- spawn point base = `30000`
- instancia rapida = `0.5`
- resultado = `15000`

## Responsabilidades por camada

### Banco

Banco deve definir:

- quais spawn points existem
- em qual instancia eles vivem
- qual entry pode nascer
- qual e o respawn base do ponto
- qual e o multiplicador de respawn da instancia

### Loop

Loop deve:

- buscar configs e spawn points
- processar inimigos mortos prontos para voltar
- respeitar os limites de vivos
- criar novas instancias apenas se necessario

### Combate

Combate deve:

- ao matar, preencher `dead_at`
- calcular `respawn_at`
- nao decidir sozinho a politica de spawn global

## Refactor proposto dos arquivos atuais

## 1. `spawnConfig.js`

Hoje:

- guarda regra de gameplay e fallback ao mesmo tempo

Depois:

- guardar apenas defaults tecnicos

Exemplos:

- `DEFAULT_SPAWN_LOOP_INTERVAL_MS`
- `DEFAULT_RESPAWN_MULTIPLIER`
- `DEFAULT_MAX_ALIVE_MULTIPLIER`
- `DEFAULT_SPAWN_QUANTITY_MULTIPLIER`

Regra:

- o banco deve vencer
- o arquivo serve como fallback

## 2. `spawnLoop.js`

Hoje:

- loop unico global com intervalo fixo

Depois:

- primeira fase:
  - manter loop unico global
  - reduzir o tick para algo curto, ex. `1000 ms`
  - cada tick processa banco e decide por instancia

Fase futura opcional:

- loops particionados por instancia

Minha recomendacao para agora:

- nao complicar com um loop por instancia
- manter um loop global curto e stateless

## 3. `spawnTick.js`

Esse sera o principal refactor.

Ele deve passar a ter estas etapas:

1. carregar `ga_spawn_point` ativo com:

- `entries`
- `instance`
- `instanceSpawnConfig`

2. para cada spawn point:

- calcular config efetiva
- contar vivos
- localizar mortos elegiveis para respawn
- reaproveitar mortos se possivel
- criar novos apenas se faltar runtime reaproveitavel

3. emitir spawn quando inimigo voltar

### Funcoes novas sugeridas

- `resolveInstanceSpawnConfig(instance)`
- `computeEffectiveRespawnMs(spawnPoint, instanceConfig)`
- `computeEffectiveMaxAlive(spawnPoint, instanceConfig)`
- `computeEffectiveSpawnQuantity(entry, instanceConfig, remainingCapacity)`
- `findRespawnableDeadEnemies(spawnPointId, nowMs)`
- `respawnDeadEnemy(enemyInstance, spawnPoint, enemyDef, selectedEntry, nowMs, io)`

## 4. `combatSystem.js`

Hoje:

- ao matar, marca `DEAD` e `dead_at`

Depois:

- ao matar, tambem calcular `respawn_at`

Importante:

- o combate nao precisa conhecer a config da instancia toda
- ele pode carregar o `spawn_point` do inimigo e a config da instancia
- ou chamar um helper dedicado do modulo de spawn

Minha recomendacao:

- criar helper no dominio de spawn
- o combate chama esse helper para resolver `respawn_at`

## 5. `enemyLoader.js`

Pode continuar quase igual.

Melhorias possiveis:

- incluir no payload runtime:
  - `deadAt`
  - `respawnAt`
- isso ja ajuda debug futuro

## Mudancas de banco

### Nova migration

Criar migration para `ga_instance_spawn_config`

Schema sugerido:

```sql
ga_instance_spawn_config
- id INT PK AI
- instance_id INT NOT NULL UNIQUE
- enemy_spawn_enabled BOOLEAN NOT NULL DEFAULT TRUE
- respawn_multiplier DECIMAL(10,3) NOT NULL DEFAULT 1.000
- spawn_quantity_multiplier DECIMAL(10,3) NOT NULL DEFAULT 1.000
- max_alive_multiplier DECIMAL(10,3) NOT NULL DEFAULT 1.000
- spawn_tick_ms INT NULL
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL
```

Associacao sugerida:

- `GaInstance.hasOne(GaInstanceSpawnConfig, { as: "spawnConfig" })`
- `GaInstanceSpawnConfig.belongsTo(GaInstance, { as: "instance" })`

## Seeds

Criar seed inicial para instancias existentes.

Padrao inicial:

- `enemy_spawn_enabled = true`
- `respawn_multiplier = 1.0`
- `spawn_quantity_multiplier = 1.0`
- `max_alive_multiplier = 1.0`

Assim o comportamento atual fica preservado antes de customizacoes.

## Fases de implementacao

## Fase 1 - Persistencia da configuracao por instancia

Entregas:

- model `ga_instance_spawn_config`
- migration
- associations
- seed default para instancias existentes

Risco:

- baixo

## Fase 2 - Cálculo efetivo de respawn

Entregas:

- helpers para config efetiva
- uso de `respawn_multiplier`
- uso de `enemy_spawn_enabled`
- uso de `max_alive_multiplier`
- uso de `spawn_quantity_multiplier`

Risco:

- medio

## Fase 3 - Reaproveitamento de runtime morto

Entregas:

- mortos passam a voltar
- `respawn_at` ganha papel real
- cria nova instancia apenas se nao houver runtime reaproveitavel

Risco:

- medio/alto

Essa fase precisa de cuidado porque toca:

- banco
- runtime store
- eventos de socket

## Fase 4 - Limpeza dos hardcodes

Entregas:

- reduzir dependencia de `spawnConfig.js`
- manter apenas defaults tecnicos

Risco:

- baixo

## Decisoes praticas recomendadas

### Decisao 1

Criar `ga_instance_spawn_config`

Resposta:

- sim

### Decisao 2

Mover tudo de `ga_spawn_point` para config da instancia

Resposta:

- nao

`ga_spawn_point` ainda deve continuar dono do detalhe local do ponto.

### Decisao 3

Guardar regra em `ga_local`

Resposta:

- nao

### Decisao 4

Loop por instancia

Resposta:

- nao nesta fase

Um loop global curto e suficiente para a primeira versao boa.

### Decisao 5

Criar nova linha de inimigo toda vez que respawnar

Resposta:

- nao, preferir reaproveitar mortos

## Riscos

1. manter tick global de 3 minutos inviabiliza qualquer respawn mais fino

2. nao calcular `respawn_at` no momento da morte mantem o sistema impreciso

3. criar nova linha a cada respawn pode inchar `ga_enemy_instance`

4. misturar regra de instancia com regra de spawn point aumenta confusao

## Conclusao

O melhor desenho para o problema atual e:

- `ga_spawn_point` continua como configuracao local do ponto
- `ga_instance_spawn_config` nasce como tabela filha de `ga_instance`
- `ga_enemy_instance` continua como runtime persistido
- `respawn_at` passa a ser usado de verdade
- o loop deixa de ser guiado por hardcode e passa a ser guiado por banco

Esse desenho preserva a arquitetura atual, reaproveita grande parte do que ja foi construido e cria um caminho limpo para expandir spawn por instancia sem sujar `ga_local` ou `ga_instance`.
