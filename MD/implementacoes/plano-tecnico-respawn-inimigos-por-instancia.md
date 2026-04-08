# Plano Tecnico - Reestruturacao Definitiva de Spawners e Runtime de Inimigos

## Objetivo

Este documento passa a ser o planejamento definitivo para a reformulacao do sistema de spawners e runtime de inimigos.

A decisao agora nao e mais "adaptar o sistema atual".

A decisao e:

- reconstruir a modelagem do modulo de spawn do zero
- alinhar nomenclatura com o padrao usado em outros modulos do jogo
- separar definicao, colocacao no mapa e runtime
- preparar o modulo para escalabilidade, reaproveitamento entre mapas e manutencao de longo prazo

---

## Inventario do Legado

As tabelas antigas existem e foram criadas por migration.

Migrations legadas encontradas:

- `20260306222528-create-ga-enemy-def.js`
- `20260306222627-create-ga-enemy-def-stats.js`
- `20260306222710-create-ga-spawn-point.js`
- `20260306222754-create-ga-spawn-entry.js`
- `20260306222827-create-ga-enemy-instance.js`
- `20260306222900-create-ga-enemy-instance-stats.js`
- `20260328134000-add-patrol-radius-to-ga-spawn-point.js`
- `20260328140000-add-patrol-wait-ms-to-ga-spawn-point.js`
- `20260328141000-add-patrol-stop-radius-to-ga-spawn-point.js`

Tambem ja existe uma primeira tentativa do modelo novo:

- `20260407213000-create-ga-spawn-def.js`
- `20260407213100-create-ga-spawn-def-entry.js`
- `20260407213200-add-spawn-def-id-to-ga-spawn-point.js`
- `20260407213300-create-ga-enemy-runtime.js`
- `20260407213400-create-ga-enemy-runtime-stats.js`

Conclusao importante:

- o legado existe em migration
- a primeira camada do modelo novo tambem ja existe
- porem o desenho ainda nao esta fechado do jeito mais intuitivo e escalavel

---

## Diagnostico Final

O sistema atual tem tres problemas estruturais.

### 1. Mistura de papeis

Hoje o modulo mistura:

- definicao reutilizavel de spawn
- colocacao desse spawn em uma instancia
- runtime do inimigo concreto

Isso espalha regra de negocio entre:

- `ga_spawn_point`
- `ga_spawn_entry`
- `ga_enemy_instance`

### 2. Nomenclatura ruim

O nome `ga_enemy_instance` sugere "instancia de configuracao".

Na pratica, ele guarda:

- posicao atual
- estado vivo ou morto
- temporizador de respawn
- dados de runtime

Entao ele nao e uma "instance" de configuracao.
Ele e runtime.

### 3. Reaproveitamento fraco

O jogo tera mapas equivalentes para racas diferentes e outros cenarios repetidos.

O mesmo pacote de spawn precisa ser reutilizado em varias instancias sem duplicar configuracao.

Hoje isso nao esta bem resolvido.

---

## Decisao Arquitetural

Vamos manter o mesmo padrao mental que ja existe em outros modulos do projeto:

- definicao principal
- tabelas filhas da definicao
- colocacao concreta quando necessario
- runtime separado

O modulo de spawn deve ficar assim:

1. `ga_spawn_def`
2. `ga_spawn_def_component`
3. `ga_spawn_instance`
4. `ga_enemy_runtime`
5. `ga_enemy_runtime_stats`
6. `ga_instance_spawn_config`

---

## Novo Modelo

### `ga_spawn_def`

Tabela principal do spawner.

Ela representa a definicao reutilizavel do spawn.

Exemplos:

- campo com coelhos
- campinho com coelhos e raposas
- grupo de lobos
- grupo de goblins

Campos esperados:

- `id`
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
- `flags_json`

Papel:

- responder "que spawner e este"
- guardar configuracao base reutilizavel

### `ga_spawn_def_component`

Tabela filha da definicao do spawner.

Ela substitui conceitualmente a ideia atual de `ga_spawn_entry`.

Papel:

- responder "quais inimigos fazem parte desse spawner"

Campos esperados:

- `id`
- `spawn_def_id`
- `enemy_def_id`
- `status`
- `weight`
- `quantity_min`
- `quantity_max`
- `alive_limit`
- `flags_json`

Exemplo:

- componente 1: `WILD_RABBIT`, quantidade `3..5`
- componente 2: `FOX`, quantidade `1..2`

### `ga_spawn_instance`

Tabela de colocacao do spawner no mundo.

Ela substitui o papel conceitual atual de `ga_spawn_point`.

Papel:

- responder "onde essa definicao de spawner foi colocada"

Campos esperados:

- `id`
- `instance_id`
- `spawn_def_id`
- `status`
- `pos_x`
- `pos_z`
- `yaw`
- `override_json`

Observacao:

- a receita continua em `ga_spawn_def`
- a colocacao concreta fica em `ga_spawn_instance`

### `ga_enemy_runtime`

Tabela de runtime concreto do inimigo.

Papel:

- responder "qual inimigo concreto existe ou existiu nesse spawner colocado"

Campos esperados:

- `id`
- `spawn_instance_id`
- `spawn_def_component_id`
- `enemy_def_id`
- `status`
- `pos_x`
- `pos_z`
- `yaw`
- `home_x`
- `home_z`
- `spawned_at`
- `dead_at`
- `respawn_at`

Observacao:

- esse nome e explicitamente runtime
- ele nao tenta fingir que e configuracao

### `ga_enemy_runtime_stats`

Tabela filha do runtime do inimigo.

Papel:

- guardar stats runtime persistidos daquele inimigo concreto

Campos esperados:

- `enemy_runtime_id`
- `hp_current`
- `hp_max`
- `move_speed`
- `attack_speed`

### `ga_instance_spawn_config`

Continua existindo.

Papel:

- governar regras macro de spawn por instancia

Campos atuais ja validos:

- `enemy_spawn_enabled`
- `respawn_multiplier`
- `spawn_quantity_multiplier`
- `max_alive_multiplier`
- `spawn_tick_ms`

---

## Relacoes Corretas

Leitura correta do modulo:

- `ga_spawn_def` tem muitos `ga_spawn_def_component`
- `ga_spawn_instance` pertence a `ga_spawn_def`
- `ga_spawn_instance` pertence a `ga_instance`
- `ga_enemy_runtime` pertence a `ga_spawn_instance`
- `ga_enemy_runtime` pertence a `ga_spawn_def_component`
- `ga_enemy_runtime` pertence a `ga_enemy_def`

Isso responde de forma direta perguntas como:

- quais inimigos existem neste spawner colocado
- quais inimigos uma definicao de spawner pode gerar
- em quais instancias esse spawner foi reutilizado
- quais runtimes mortos aguardam respawn em determinada instancia

---

## Por Que Esse Desenho E Melhor

### Coerencia com o resto do projeto

O desenho fica mais proximo do padrao de modulos como item:

- definicao principal
- componentes/filhas
- instancia concreta
- runtime separado

### Reutilizacao

O mesmo `spawn_def` pode ser colocado em:

- instancia 1
- instancia 2
- instancia 6
- mapas equivalentes de racas diferentes

Sem duplicar configuracao.

### Consultas mais diretas

Exemplo:

- "quais inimigos estao no spawner X"

vira:

- `ga_enemy_runtime where spawn_instance_id = X`

Sem ficar costurando varios conceitos mal nomeados.

### Menos ambiguidade no codigo

O codigo deixa de precisar interpretar:

- `instance` como runtime
- `point` como receita
- `entry` como composicao reutilizavel e tambem como spawn local

Cada coisa passa a ter um nome que bate com sua funcao.

---

## Formula de Spawn

### Maximo de vivos

`effective_max_alive = ga_spawn_def.max_alive * ga_instance_spawn_config.max_alive_multiplier`

### Quantidade por ciclo

`effective_spawn_quantity = roll(ga_spawn_def_component.quantity_min..quantity_max) * ga_instance_spawn_config.spawn_quantity_multiplier`

### Respawn

`effective_respawn_ms = ga_spawn_def.respawn_ms * ga_instance_spawn_config.respawn_multiplier`

### Scheduler

O loop tecnico pode ser curto.

A regra de gameplay por instancia continua vindo de:

- `ga_instance_spawn_config.spawn_tick_ms`

---

## Fluxo Correto

### Bootstrap

1. carregar `ga_spawn_instance` da instancia atual
2. carregar `ga_enemy_runtime` ligado a esses spawn instances
3. carregar nome e stats via `ga_enemy_def`
4. enviar somente os runtimes validos

### Spawn

1. localizar `ga_spawn_instance`
2. resolver `ga_spawn_def`
3. escolher `ga_spawn_def_component`
4. gerar posicao com base na definicao e no centro do spawn instance
5. criar ou reciclar `ga_enemy_runtime`
6. criar ou resetar `ga_enemy_runtime_stats`

### Patrulha

1. o centro de patrulha sempre vem do `ga_spawn_instance`
2. o inimigo pode nascer deslocado dentro do raio
3. mas seu retorno e sua patrulha referenciam o centro do spawner

### Morte

1. `status = DEAD`
2. preencher `dead_at`
3. calcular `respawn_at`

### Respawn

1. procurar `ga_enemy_runtime` mortos elegiveis por `spawn_instance_id`
2. reaproveitar primeiro os mortos
3. so criar runtime novo quando necessario
4. resetar stats e posicao

---

## Estrategia de Implementacao

### Fase 1 - Congelar o legado

Nao fazer mais evolucao estrutural em:

- `ga_spawn_point`
- `ga_spawn_entry`
- `ga_enemy_instance`
- `ga_enemy_instance_stats`

Essas tabelas viram legado.

### Fase 2 - Criar schema final

Criar do zero:

- `ga_spawn_def`
- `ga_spawn_def_component`
- `ga_spawn_instance`
- `ga_enemy_runtime`
- `ga_enemy_runtime_stats`

Observacao:

- as tabelas `ga_spawn_def` e `ga_enemy_runtime` ja existem parcialmente
- ainda assim a recomendacao e alinhar tudo ao desenho final, inclusive nomes, antes de migrar o codigo inteiro

### Fase 3 - Migracao de dados

Transformar:

- `ga_spawn_point` antigo em `ga_spawn_instance`
- `ga_spawn_entry` antigo em `ga_spawn_def_component`
- `ga_enemy_instance` antigo em `ga_enemy_runtime`
- `ga_enemy_instance_stats` antigo em `ga_enemy_runtime_stats`

### Fase 4 - Refatorar o codigo

Atualizar:

- loaders
- bootstrap
- baseline
- spawn loop
- respawn
- patrulha
- combate

### Fase 5 - Desligar o legado

Depois de tudo validado:

- parar de ler as tabelas antigas
- remover models antigos
- criar migration de limpeza

### Fase 6 - Documentacao operacional

Criar um guia em `MD` ensinando:

- como criar um novo `spawn_def`
- como criar componentes
- como colocar um spawn em uma instancia
- como configurar respawn por instancia

---

## Decisoes de Nome

Nome recomendado para a reformulacao final:

- manter `ga_spawn_def`
- trocar `ga_spawn_def_entry` por `ga_spawn_def_component`
- trocar `ga_spawn_point` por `ga_spawn_instance`
- manter `ga_enemy_runtime`
- manter `ga_enemy_runtime_stats`

Motivo:

- `def` bate com padrao existente
- `component` comunica melhor "composicao do spawner"
- `instance` comunica melhor "colocacao concreta no mapa"
- `runtime` comunica melhor "estado vivo do inimigo"

---

## Riscos

### Risco 1

Migrar codigo sem primeiro fechar nomes definitivos.

Mitigacao:

- fechar o schema final antes da fase pesada de codigo

### Risco 2

Tentar reaproveitar demais o legado e acabar carregando incoerencias antigas.

Mitigacao:

- tratar legado como fonte temporaria de migracao, nao como base de arquitetura

### Risco 3

Criar relacoes ambiguidas entre runtime e configuracao.

Mitigacao:

- runtime sempre pertence a `spawn_instance`
- composicao sempre pertence a `spawn_def`

---

## Conclusao

A reformulacao final recomendada e esta:

1. `ga_spawn_def`
2. `ga_spawn_def_component`
3. `ga_spawn_instance`
4. `ga_enemy_runtime`
5. `ga_enemy_runtime_stats`
6. `ga_instance_spawn_config`

O legado existe e foi confirmado nas migrations, mas ele nao deve mais orientar a arquitetura.

O modulo precisa passar a seguir um desenho previsivel, intuitivo e escalavel, no mesmo espirito dos outros sistemas do jogo.

Esse documento passa a ser a base para a refatoracao final do sistema de spawners.
