# Modulo Research

## Objetivo

O modulo de `research` controla o que cada jogador sabe fazer com um item ou assunto do jogo.
Ter um item no inventario nao significa automaticamente saber usa-lo.

Exemplos iniciais:

- `APPLE` nivel 1 libera comer maca e configurar maca no macro de auto food.
- `STONE` nivel 1 libera o craft da arma `WEAPON-STONE-SLING`.

Regra central:

- research so progride enquanto o jogador estiver `CONNECTED`
- logout ou disconnect pausam o progresso
- o jogador nao perde progresso acumulado
- nao existe progresso offline

## Modelo Mental

Research nao e um "nivel do item". Ele e um desbloqueio de capacidades.

O fluxo fica assim:

1. O jogador coleta um item.
2. O item existe normalmente no inventario.
3. O jogador faz um estudo ligado a esse item.
4. Cada nivel completo libera capacidades novas.

Isso evita espalhar `if` hardcoded por item e permite expandir para craft, comida, macro, equipamento e outras acoes.

## Escopo MVP

O MVP deste modulo cobre:

- tela de research no front
- cadastro de estudos e niveis no banco
- progresso persistido por jogador
- tick online-only
- inicio de estudo pelo botao da UI
- bloqueio de uso da maca no auto food antes do estudo nivel 1

Fica preparado, mas nao implementado ainda:

- craft real da funda
- consumo manual fora do macro
- bloqueios de equipment por research

## Tabelas

### `ga_research_def`

Define o assunto estudado.

Campos principais:

- `id`
- `code`
- `name`
- `description`
- `item_def_id`
- `era_min_id`
- `max_level`
- `is_active`

### `ga_research_level_def`

Define cada nivel do estudo.

Campos principais:

- `id`
- `research_def_id`
- `level`
- `study_time_ms`
- `grants_json`
- `requirements_json`

`grants_json` usa codigos de capacidade, por exemplo:

```json
{
  "unlock": [
    "item.consume:FOOD-APPLE",
    "macro.auto_food:FOOD-APPLE"
  ]
}
```

### `ga_user_research`

Guarda o estado do jogador naquele estudo.

Campos principais:

- `id`
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

## Regra de Tempo

Para estudos simples da Era 1, o nivel 1 usa `5 minutos`.

Progressao inicial:

- nivel 1 = `5 min`
- nivel 2 = `15 min`
- nivel 3 = `45 min`
- nivel 4 = `135 min`
- nivel 5 = `405 min`

Formula base usada no seed inicial:

- `tempo_nivel = 5min * 3^(nivel-1)`

Mesmo assim, o banco salva o `study_time_ms` final por nivel.
Isso permite excecoes futuras sem depender da formula.

## Regras de Negocio

### Progresso online-only

- o tick de research roda apenas para `rt.connectionState === "CONNECTED"`
- se o jogador desconectar, o tick nao soma progresso
- ao reconectar, o estudo continua do mesmo ponto

### Apenas um estudo ativo por vez

- o jogador pode ter varios estudos cadastrados
- mas apenas um pode ficar em `RUNNING` por vez

### Item pode existir sem uso

- sem research, o item pode ser coletado e guardado
- a capacidade de consumir, craftar ou configurar macro depende do unlock

## Integracoes

### Backend

- `world/bootstrap` devolve snapshot inicial de research
- `world:join` e `world:resync` enviam `research:full`
- novo handler socket:
  - `research:request_full`
  - `research:start`
- tick principal chama `processResearchTick`

### Bloqueios iniciais

Primeiro bloqueio efetivo do MVP:

- `inv:auto_food:set` exige unlock `macro.auto_food:FOOD-APPLE`
- `processAutoFoodTick` exige unlock `item.consume:FOOD-APPLE`

### Frontend

A tela de research:

- abre com `R`
- consome payload real do backend
- mostra progresso por estudo
- mostra tempo do nivel atual
- expõe botao de iniciar estudo

## Estrutura do Payload

Formato sugerido para `research:full`:

```json
{
  "ok": true,
  "activeResearchCode": "RESEARCH_APPLE",
  "studies": [
    {
      "researchDefId": 1,
      "code": "RESEARCH_APPLE",
      "name": "Apples",
      "description": "Study edible fruit and its first practical uses.",
      "maxLevel": 5,
      "currentLevel": 0,
      "activeLevel": 1,
      "status": "IDLE",
      "progressMs": 0,
      "levelStudyTimeMs": 300000,
      "progressRatio": 0,
      "itemDef": {
        "id": 10,
        "code": "FOOD-APPLE",
        "name": "Apple",
        "category": "FOOD"
      }
    }
  ]
}
```

## Ordem de Expansao

1. Aplicar research em comida e macro.
2. Aplicar research em craft.
3. Aplicar research em equipment, se fizer sentido de design.
4. Adicionar fila, cancelamento ou bonus de velocidade, se necessario.
