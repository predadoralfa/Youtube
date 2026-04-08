# Plano Tecnico - Spawner Escalavel Sem Redundancia

## Objetivo

Este documento define a arquitetura final desejada para o modulo de spawners e inimigos do jogo.

O objetivo agora nao e mais adaptar o modelo atual.

O objetivo e fechar um desenho:

- reutilizavel entre varias instancias
- facil de editar no futuro
- sem redundancia de colunas
- com persistencia apenas do estado que realmente precisa ser persistido
- alinhado com a hierarquia correta do dominio

---

## Regra Central do Dominio

O inimigo pertence ao spawner.

Nao e o spawner que pertence ao inimigo.

Entao a hierarquia correta e:

1. existe uma definicao reutilizavel do spawner
2. essa definicao e colocada em uma ou mais instancias do mapa
3. cada spawner colocado possui seus inimigos concretos
4. cada inimigo concreto guarda apenas estado variavel minimo

---

## Problemas do Modelo Atual

O modelo atual ficou parcialmente funcional, mas conceitualmente confuso.

Principais problemas:

- `ga_spawn_def_component` tem funcao util, mas nome ruim e pouco intuitivo
- `ga_enemy_runtime` ainda passa a sensacao errada de que o inimigo e a entidade principal e o spawn e apenas referencia auxiliar
- existe redundancia entre `spawn_def_component_id` e `enemy_def_id` dentro do runtime
- parte do runtime concreto do inimigo ficou persistida em excesso
- a leitura da hierarquia nao fica natural quando se olha o banco

Conclusao:

- o sistema atual funciona tecnicamente
- mas nao comunica o dominio com clareza
- e isso aumenta risco de erro em manutencao futura

---

## Decisao Arquitetural

O modulo deve ser reorganizado em quatro tabelas principais:

1. `ga_spawn_def`
2. `ga_spawn_def_enemy`
3. `ga_spawn_instance`
4. `ga_spawn_instance_enemy`

Complementos:

- `ga_enemy_def`
- `ga_enemy_def_stats`
- `ga_instance_spawn_config`

---

## Modelo Final

### 1. `ga_spawn_def`

Representa a definicao reutilizavel do spawner.

Exemplos:

- campinho com coelhos
- grupo de lobos
- ponto de goblins
- mistura de coelhos e raposas

Essa tabela guarda apenas a regra geral do spawner.

Campos recomendados:

- `id`
- `code`
- `name`
- `status`
- `spawn_kind`
- `shape_kind`
- `radius`
- `respawn_ms`
- `patrol_radius`
- `patrol_wait_ms`
- `patrol_stop_radius`
- `flags_json`

Observacoes:

- `max_alive` pode existir aqui se a regra for global do spawn inteiro
- se isso gerar conflito com o total derivado da composicao, o preferivel e remover esse campo e derivar do conjunto de filhos

---

### 2. `ga_spawn_def_enemy`

Tabela filha do spawner.

Papel:

- dizer quais inimigos fazem parte daquele spawner
- permitir editar a composicao do spawn sem dor

Essa e a tabela mais importante para escalabilidade.

Campos recomendados:

- `id`
- `spawn_def_id`
- `enemy_def_id`
- `slot_index`
- `quantity`
- `weight`
- `status`
- `flags_json`

Responsabilidade:

- ligar o spawner ao inimigo
- permitir adicionar mais inimigos no mesmo spawner apenas criando ou alterando linhas

Exemplos de uso:

- coelho x4
- coelho x3 + raposa x1
- goblin x6

Observacoes:

- `slot_index` ajuda organizacao e leitura
- `quantity` permite crescer sem recriar schema
- `weight` fica preparado para futuros spawns variados

---

### 3. `ga_spawn_instance`

Tabela de colocacao do spawn no mapa.

Papel:

- dizer onde uma definicao de spawner foi colocada

Esse e o ponto que permite reutilizar o mesmo spawn em varias racas e mapas.

Campos recomendados:

- `id`
- `spawn_def_id`
- `instance_id`
- `pos_x`
- `pos_z`
- `yaw`
- `status`
- `override_json`

Exemplo:

- `spawn_def = COELHOS_INICIAIS`
- colocado na `instance 7` em uma posicao
- colocado na `instance 8` em outra posicao
- colocado na `instance 9` em outra posicao diferente

Observacoes:

- a composicao do spawner nao fica aqui
- aqui existe apenas a colocacao concreta

---

### 4. `ga_spawn_instance_enemy`

Tabela filha do spawner colocado.

Essa tabela substitui a ideia atual de runtime completo persistido.

Ela representa os inimigos concretos daquele spawn colocado, mas persiste apenas o estado minimo e necessario.

Campos recomendados:

- `id`
- `spawn_instance_id`
- `spawn_def_enemy_id`
- `status`
- `hp_current`
- `dead_at`
- `respawn_at`

Campos opcionais:

- `last_spawn_at`
- `rev`

Importante:

- `enemy_def_id` nao deve existir aqui
- ele ja vem de `spawn_def_enemy_id -> enemy_def_id`

Entao esta tabela deve guardar apenas:

- estado vivo ou morto
- hp atual
- controle de respawn

---

## O Que Nao Deve Ficar Persistido

Os dados abaixo nao precisam ficar no banco, a menos que futuramente exista uma regra especial de persistencia:

- posicao atual do mob
- yaw atual do mob
- alvo atual
- estado de combate momentaneo
- cooldown em andamento
- patrulha momentanea
- ponto aleatorio atual dentro do raio

Esses dados podem ficar somente em memoria no servidor.

Quando a area for recarregada:

- o servidor le `ga_spawn_instance_enemy`
- ve quem esta vivo e quem esta morto
- recria em memoria os vivos
- sorteia posicao novamente dentro do raio do spawner
- mortos continuam mortos ate o `respawn_at`

---

## Por Que Esse Modelo Escala Bem

### Reutilizacao

O mesmo `spawn_def` pode ser usado em varias instancias.

Isso resolve o caso dos mapas iniciais de cada raca.

### Edicao Simples

Se quiser adicionar mais monstros ao mesmo spawn:

- cria nova linha em `ga_spawn_def_enemy`
- ou altera `quantity`

Nao precisa alterar schema.

### Sem Redundancia

Cada dado vive num unico lugar:

- regra do spawn em `ga_spawn_def`
- composicao do spawn em `ga_spawn_def_enemy`
- posicao do spawn no mapa em `ga_spawn_instance`
- estado minimo do inimigo concreto em `ga_spawn_instance_enemy`
- stats base do inimigo em `ga_enemy_def_stats`

### Leitura Organizada

Ao olhar o banco, a hierarquia fica clara:

- este spawner existe
- este spawner tem estes inimigos
- este spawner foi colocado nesta instancia
- estes sao os slots concretos de inimigo daquela colocacao

---

## Regras de Nao Redundancia

Estas regras devem ser tratadas como obrigatorias:

1. Se um valor pode ser derivado de forma estavel por FK, nao duplicar a coluna.
2. Estado momentaneo de memoria nao deve ser salvo no banco sem necessidade real.
3. Definicao de inimigo nao deve ser repetida em tabela de estado concreto.
4. Posicao do spawner pertence ao `spawn_instance`, nao ao `spawn_def`.
5. Composicao do spawn pertence ao filho do `spawn_def`, nao ao `spawn_instance`.

---

## Fluxo de Funcionamento

### Ao cadastrar um novo spawner

1. cria `ga_spawn_def`
2. cria filhos em `ga_spawn_def_enemy`
3. cria uma ou mais linhas em `ga_spawn_instance`
4. cria os slots concretos em `ga_spawn_instance_enemy`

### Ao subir o servidor ou carregar area

1. servidor carrega `spawn_instance`
2. servidor carrega os filhos `spawn_instance_enemy`
3. para cada inimigo vivo, cria runtime em memoria
4. sorteia posicao em memoria dentro do raio do spawner
5. para cada morto, aguarda `respawn_at`

### Quando um inimigo morre

Atualiza apenas:

- `status`
- `hp_current`
- `dead_at`
- `respawn_at`

### Quando o inimigo respawna

Atualiza apenas:

- `status = ALIVE`
- `hp_current = hp_max`
- limpa `dead_at`
- recalcula `respawn_at` quando morrer de novo

---

## Campos Que Devem Vir de `enemy_def`

Nao persistir no estado concreto:

- `attack_power`
- `defense`
- `move_speed`
- `attack_speed`
- `attack_range`
- comportamento base
- visual base

Tudo isso deve vir de:

- `ga_enemy_def`
- `ga_enemy_def_stats`

---

## Conclusao

O desenho final recomendado e:

- `ga_spawn_def`
- `ga_spawn_def_enemy`
- `ga_spawn_instance`
- `ga_spawn_instance_enemy`
- `ga_enemy_def`
- `ga_enemy_def_stats`
- `ga_instance_spawn_config`

Esse modelo:

- respeita a hierarquia correta do dominio
- permite reutilizacao em varias instancias
- facilita edicao futura
- evita redundancia
- persiste apenas o estado realmente necessario

Este deve ser tratado como o plano arquitetural definitivo para a proxima refatoracao do modulo de spawners.
