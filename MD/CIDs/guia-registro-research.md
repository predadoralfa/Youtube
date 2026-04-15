# Guia de Registro de Research

## Objetivo

Este documento padroniza como registrar novas researches no projeto para evitar hardcode espalhado entre banco, backend e front.

A regra principal e simples:

- `ga_research_def` define a research
- `ga_research_level_def` define os niveis e a progressao
- `ga_user_research` guarda o estado do jogador
- o front so renderiza a arvore que o backend entregar

## Passo zero obrigatorio

Antes de criar qualquer research nova, ler primeiro os modelos Sequelize que definem o contrato atual do banco:

- [ga_research_def.js](/D:/JS-Projects/Youtube/server/models/ga_research_def.js)
- [ga_research_level_def.js](/D:/JS-Projects/Youtube/server/models/ga_research_level_def.js)
- [ga_user_research](/D:/JS-Projects/Youtube/server/models/index.js)

Tambem e importante ler o modulo de runtime:

- [definitions.js](/D:/JS-Projects/Youtube/server/service/researchService/definitions.js)
- [payload.js](/D:/JS-Projects/Youtube/server/service/researchService/payload.js)
- [flow.js](/D:/JS-Projects/Youtube/server/service/researchService/flow.js)
- [costs.js](/D:/JS-Projects/Youtube/server/service/researchService/costs.js)

Motivo:

- a arvore ja vem do banco
- os unlocks ja saem de `grants_json`
- os bloqueios ja usam `prerequisite_research_def_id` e `prerequisite_level`
- isso evita criar regra nova no codigo para cada research

## Modelo mental

### 1. `ga_research_def`

Define a research em si.

Campos principais:

- `code`: identificador estavel da research
- `name`: nome humano
- `description`: resumo geral
- `item_def_id`: item associado, quando a research orbita um item especifico
- `prerequisite_research_def_id`: research pai que desbloqueia esta
- `prerequisite_level`: nivel minimo da research pai
- `era_min_id`: era minima de existencia
- `max_level`: limite final da research
- `is_active`: se a research entra no runtime

Regra pratica:

- `code` responde "qual e essa research?"
- `prerequisite_research_def_id` responde "qual research precisa vir antes?"
- `prerequisite_level` responde "em qual nivel do pai ela libera?"

### 2. `ga_research_level_def`

Define cada nivel da research.

Campos principais:

- `research_def_id`
- `level`
- `study_time_ms`
- `title`
- `description`
- `grants_json`
- `requirements_json`

Regra pratica:

- `study_time_ms` responde "quanto tempo este nivel leva?"
- `grants_json` responde "o que este nivel libera?"
- `requirements_json` responde "o que este nivel consome?"

### 3. `ga_user_research`

Guarda o progresso do jogador.

Campos principais:

- `user_id`
- `research_def_id`
- `current_level`
- `status`
- `active_level`
- `progress_ms`
- `started_at_ms`
- `completed_at_ms`

Estados:

- `IDLE`
- `RUNNING`
- `COMPLETED`

## Como o desbloqueio funciona

Hoje o desbloqueio de pesquisa nao depende de hardcode por item. Ele depende desta regra:

1. a research pai precisa estar concluida no nivel minimo
2. o `payload` do backend marca a research filha como visivel
3. o front so mostra o que o backend autorizou

Exemplo:

- `RESEARCH_FIBER` nivel 3 pode liberar `RESEARCH_PRIMITIVE_SHELTER`

Isso e controlado por:

- `prerequisite_research_def_id`
- `prerequisite_level`

## Como registrar uma nova research

### Caso A: research simples de item

Criar:

- `ga_research_def`

Adicionar:

- `ga_research_level_def` para os niveis

Exemplo de unlock:

```json
{
  "unlock": [
    "item.consume:FOOD-APPLE",
    "macro.auto_food:FOOD-APPLE"
  ]
}
```

### Caso B: research com arvore

Criar:

- `ga_research_def` do pai
- `ga_research_def` do filho

Ligar:

- `prerequisite_research_def_id`
- `prerequisite_level`

### Caso C: research com custo de item

Criar:

- `requirements_json` com `itemCosts`

Exemplo:

```json
{
  "itemCosts": [
    {
      "itemCode": "FIBER",
      "qty": 30
    }
  ]
}
```

## Como registrar uma research nova no banco

### Passo 1: criar ou atualizar a definicao

Fazer seed ou migration em `ga_research_def`.

Checklist:

- escolher `code`
- escolher `name`
- definir `description`
- decidir `item_def_id`, se existir
- decidir `era_min_id`
- definir `max_level`
- ativar com `is_active = true`

### Passo 2: criar os niveis

Para cada nivel:

- inserir `ga_research_level_def`
- definir `study_time_ms`
- definir `title`
- definir `description`
- definir `grants_json`
- definir `requirements_json`

### Passo 3: ligar ao pai, se houver arvore

Se a research depender de outra:

- preencher `prerequisite_research_def_id`
- preencher `prerequisite_level`

### Passo 4: garantir que o runtime leia a arvore

O modulo de research ja carrega:

- definicoes ativas
- niveis
- prerequisitos
- visibilidade por jogador

Entao, em geral, nao precisa criar if novo no codigo para uma research comum.

## Convencoes recomendadas

- research: `RESEARCH_APPLE`, `RESEARCH_FIBER`, `RESEARCH_PRIMITIVE_SHELTER`
- niveis: sempre iniciar em `1`
- unlocks: usar `grants_json.unlock`
- custos: usar `requirements_json.itemCosts`
- arvore: sempre preferir pai-filho no banco

## Observacoes importantes

- nao colocar a arvore de research hardcoded no client
- nao espalhar regra de unlock por item no codigo
- nao depender de posicao fixa da tela para definir a ordem da research
- se a arvore mudar, ajustar a seed ou migration, nao o renderer
- o front deve receber a estrutura pronta para montar a arvore dinamicamente

## Ordem de expansao

1. cadastrar a research no banco
2. cadastrar os niveis
3. ligar aos prerequisitos
4. seedar os unlocks e custos
5. deixar o front apenas renderizar o payload

