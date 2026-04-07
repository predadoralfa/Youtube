# Plano de Implantacao - Regeneracao de Recursos por Worker

## Objetivo

Criar um worker de backend responsavel por repor recursos em actors, com foco inicial nas arvores de maca.

A primeira versao vai cobrir:

- uma arvore de maca
- um tipo de recurso
- uma regra de regeneracao simples

O desenho ja deve nascer preparado para evoluir depois para:

- varios tipos de recurso
- regras diferentes por mapa
- regras diferentes por spawn
- um gerente de workers para distribuir responsabilidade

## Problema que este plano resolve

Hoje o jogo consegue:

- criar actors com container
- coletar itens do container
- remover o item do slot quando ele e coletado

Mas ainda nao existe um mecanismo padrao para:

- repor o conteudo do container com o tempo
- variar a taxa de reposicao por actor ou por mapa
- auditar a regra de regeneracao no banco

## Modelo mental

### Fase 1

Um worker unico percorre as regras ativas de regeneracao e aplica refill em recursos elegiveis.

Exemplo:

- a arvore de maca repoe `1` maca a cada `5 minutos`
- o limite maximo do container e `15`
- o worker nunca ultrapassa o maximo

### Fase 2

O worker unico pode ser convertido em um gerente.

Esse gerente pode:

- separar as regras por tipo de recurso
- delegar por instancia
- delegar por grupo de mapa
- delegar por familia de actor

## Fonte da verdade

O banco de dados deve ser a fonte da verdade.

O codigo pode:

- interpretar
- aplicar
- validar
- agendar

Mas a regra precisa ficar salva, nao hardcoded.

## Proposta de schema

### `ga_actor_resource_rule_def`

Define a regra base do recurso.

Campos sugeridos:

- `id`
- `code`
- `name`
- `actor_def_id`
- `container_slot_role`
- `item_def_id`
- `refill_amount`
- `refill_interval_sec`
- `max_qty`
- `is_active`

Exemplo:

- `code = TREE_APPLE_REGEN`
- `refill_amount = 1`
- `refill_interval_sec = 300`
- `max_qty = 15`

### `ga_actor_resource_rule_spawn_override`

Define sobrescritas por spawn ou por contexto do mapa.

Campos sugeridos:

- `id`
- `actor_spawn_id`
- `rule_def_id`
- `refill_amount_override`
- `refill_interval_sec_override`
- `max_qty_override`
- `is_active`

Uso:

- mesma arvore, mapa diferente
- mesma arvore, instancia diferente
- mesma arvore, solo mais fertil

### `ga_actor_resource_state`

Guarda o estado runtime da regeneracao.

Campos sugeridos:

- `id`
- `actor_id`
- `rule_def_id`
- `current_qty`
- `last_refill_at`
- `next_refill_at`
- `state`
- `rev`

Interpretacao:

- `current_qty` e o quanto o container esta oferecendo no momento
- `last_refill_at` marca a ultima reposicao aplicada
- `next_refill_at` define quando pode repor de novo

## Regra inicial da arvore de maca

Primeira configuracao recomendada:

- actor: `TREE_APPLE`
- item: `FOOD-APPLE`
- container role: `LOOT`
- refill amount: `1`
- interval: `300s`
- max qty: `15`

Se o jogador coletar tudo:

- o container fica vazio
- o worker volta a preencher no proximo ciclo valido

## Fluxo do worker

### Passo 1

Buscar regras ativas de regeneracao.

### Passo 2

Encontrar actors/runtime containers que pertencem a cada regra.

### Passo 3

Calcular quanto tempo passou desde o ultimo refill.

### Passo 4

Aplicar a reposicao apenas ate o limite maximo.

### Passo 5

Atualizar:

- `ga_container_slot`
- `ga_container.rev`
- `ga_actor_resource_state`

### Passo 6

Publicar refresh para o client quando necessario.

## Primeiro worker

O primeiro worker pode ser simples:

- roda a cada `5 segundos` ou `10 segundos`
- verifica se alguma regra ficou madura para refill
- atualiza apenas o que estiver vencido

Nao e necessario criar um processo separado neste momento.

Melhor estrategia:

- usar o backend Node atual
- criar um loop interno agendado
- manter tudo dentro do mesmo dominio do servidor

## Evolucao para gerente

Quando o volume crescer, o worker pode virar um gerente com subworkers.

Exemplo de divisao:

- `resource-regen-manager`
- `resource-regen-worker-apple`
- `resource-regen-worker-rock`
- `resource-regen-worker-instance-6`

O gerente decide:

- qual worker roda
- qual regra cada worker trata
- qual instancias podem ser agrupadas

## Riscos

### Risco 1: hardcode de regra

Mitigacao:

- salvar tudo em tabela
- deixar o worker apenas aplicar

### Risco 2: duplicar refill

Mitigacao:

- usar `next_refill_at`
- travar a linha ou usar transacao

### Risco 3: conflito com coleta

Mitigacao:

- coleta e refill precisam usar transacao
- o refill nao pode sobrescrever slot ativo do jogador

### Risco 4: precisar de regras diferentes por mapa

Mitigacao:

- criar override por `spawn`
- nao embutir essa variacao no codigo

## Ordem de implementacao

### Etapa 1

Criar as tabelas de regra e estado.

### Etapa 2

Criar a regra inicial da arvore de maca.

### Etapa 3

Criar o worker simples no backend Node.

### Etapa 4

Ligar o worker ao `ga_container_slot` da arvore.

### Etapa 5

Atualizar o client para refletir o refill em tempo real.

### Etapa 6

Expandir para outras familias:

- pedra
- madeiras
- baus de teste
- recursos de outros mapas

## Regra de design

Comecar com um worker unico e simples.

Depois, se a complexidade crescer, transformar esse worker em gerente.

Esse caminho evita:

- superengenharia no inicio
- duplicacao de logica
- perda de controle da fonte de verdade

## Resumo

O plano recomendado e:

1. criar um worker de regeneracao simples
2. guardar as regras no banco
3. usar override por spawn quando necessario
4. manter o refill sincronizado com `ga_container_slot`
5. evoluir depois para um gerente de workers

Esse desenho atende a arvore de maca agora e nao fecha a porta para o futuro.
