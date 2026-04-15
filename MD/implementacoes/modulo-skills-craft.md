# Modulo Skills e Craft

## Objetivo

Este documento descreve a primeira versao do sistema de skills e crafts do jogo.
A ideia e manter o desenho simples:

- skills controlam conhecimento e progressao
- crafts controlam producao de itens
- research continua sendo o desbloqueio de conhecimento bruto
- stamina continua sendo custo de execucao

O foco inicial e preparar a base para:

- uma skill principal de craft
- uma curva de XP simples e previsivel
- um craft assinado a um tipo de skill
- jobs de craft persistentes

---

## Principios

- o servidor continua sendo a fonte da verdade
- o cliente so exibe estado confirmado
- o nivel da skill deve ser persistido no banco
- o XP deve ser progressivo e auditavel
- o craft deve sobreviver a restart
- stamina do craft deve ser consumida aos poucos

---

## Modelos Propostos

### `ga_skill_def`

Definicao global da skill.

Campos esperados:

- `code`
- `name`
- `description`
- `max_level`
- `is_active`

### `ga_skill_level_def`

Definicao de cada nivel da skill.

Campos esperados:

- `skill_def_id`
- `level`
- `required_xp`
- `title`
- `description`
- `grants_json`
- `bonuses_json`

### `ga_user_skill`

Estado da skill para cada jogador.

Campos esperados:

- `user_id`
- `skill_def_id`
- `current_level`
- `current_xp`
- `total_xp`
- `status`

### `ga_craft_def`

Definicao do craft em si.

Campos esperados:

- `code`
- `name`
- `description`
- `skill_def_id`
- `required_skill_level`
- `required_research_def_id`
- `required_research_level`
- `output_item_def_id`
- `output_qty`
- `craft_time_ms`
- `stamina_cost_total`
- `xp_reward`
- `is_active`

### `ga_craft_recipe_item`

Ingredientes do craft.

Campos esperados:

- `craft_def_id`
- `item_def_id`
- `quantity`
- `role`
- `sort_order`

### `ga_user_craft_job`

Job de craft em andamento para o jogador.

Campos esperados:

- `user_id`
- `craft_def_id`
- `status`
- `current_progress_ms`
- `stamina_spent`
- `started_at_ms`
- `paused_at_ms`
- `completed_at_ms`

---

## Curva De XP

A curva escolhida para a primeira versao e exponencial com crescimento de 40% por nivel.

Formula sugerida:

```text
required_xp(level) = ceil(base_xp * 1.4^(level - 1))
```

Exemplo com `base_xp = 100`:

- nivel 1: `100`
- nivel 2: `140`
- nivel 3: `196`
- nivel 4: `275`
- nivel 5: `385`

Para o MVP, a melhor abordagem e:

- salvar `current_level`
- salvar `current_xp`
- opcionalmente salvar `total_xp`

Isso evita depender apenas de matematica reversa sobre XP total e deixa o runtime mais simples.

---

## Fluxo Basico De Craft

1. o jogador abre a aba de craft
2. o cliente exibe os crafts liberados
3. o jogador escolhe um craft
4. o servidor valida skill, research, itens e stamina
5. o job de craft e criado
6. o worker de craft consome stamina aos poucos
7. ao final, o item de saida e entregue
8. a skill recebe XP

Se faltar stamina no meio:

- pausar o job e nao cancelar e a opcao mais amigavel para a primeira versao

---

## Ordem Recomendada De Implementacao

1. criar as tabelas de skill e craft
2. seedar uma skill inicial
3. seedar a curva de XP por nivel
4. criar o model de job de craft
5. criar o worker de processamento
6. integrar a UI de craft
7. adicionar o primeiro craft real

---

## Observacoes

- research continua liberando o acesso conceitual
- skill passa a representar eficiencia e progresso profissional
- craft e a execucao concreta da acao
- stamina deve ser modular e ajustada por time slice, nao tudo de uma vez

