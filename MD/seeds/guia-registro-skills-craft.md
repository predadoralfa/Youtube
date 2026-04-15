# Guia de Registro - Skills e Crafts

## Objetivo

Este guia explica como cadastrar uma nova skill ou um novo craft no banco de dados do jogo.

A regra principal e simples:

- skill define a progressao
- craft define a producao
- level define o que desbloqueia
- migration seed deve ser a fonte da verdade

---

## Onde Fica Cada Coisa

- `ga_skill_def`: definicao global da skill
- `ga_skill_level_def`: niveis e requisitos de XP da skill
- `ga_user_skill`: progresso individual por jogador
- `ga_craft_def`: definicao do craft
- `ga_craft_recipe_item`: ingredientes do craft
- `ga_user_craft_job`: job ativo de craft por jogador

---

## Como Registrar Uma Nova Skill

1. criar o registro em `ga_skill_def`
2. criar os niveis em `ga_skill_level_def`
3. definir a curva de XP por nivel
4. definir quais niveis vao liberar bonus ou unlocks
5. se for uma skill inicial, seedar isso via migration

Checklist minimo:

- `code` unico e estavel
- `name` amigavel
- `max_level` coerente com a curva
- `current_level` e `current_xp` serao usados no runtime

---

## Como Registrar Um Novo Craft

1. criar o craft em `ga_craft_def`
2. ligar o craft a uma skill, se necessario
3. ligar o craft a um research unlock, se necessario
4. registrar os ingredientes em `ga_craft_recipe_item`
5. seedar o craft via migration

Checklist minimo:

- `code` unico
- `output_item_def_id` valido
- `craft_time_ms` definido
- `stamina_cost_total` definido
- ingredientes registrados com quantidade correta

---

## Convencoes Recomendadas

- skill: `SKILL_CRAFTING`, `SKILL_GATHERING`, `SKILL_SURVIVAL`
- craft: `CRAFT_BASKET`, `CRAFT_STONE_THROW`, `CRAFT_PRIMITIVE_SHELTER`
- niveis: sempre numerados a partir de `1`
- XP: `required_xp` deve seguir a curva da skill

---

## Exemplo De Seed

### Skill

- inserir `ga_skill_def`
- inserir `ga_skill_level_def` para os niveis 1..N

### Craft

- inserir `ga_craft_def`
- inserir `ga_craft_recipe_item` para cada ingrediente
- criar o unlock no research, se o craft vier de pesquisa

---

## Observacoes Importantes

- nao guardar logica de progressao solta no `ga_user_stats`
- nao usar hardcode no client para definir desbloqueios de craft
- manter migrations pequenas e idempotentes
- se a curva mudar, ajustar o seed de nivel, nao o runtime manualmente

