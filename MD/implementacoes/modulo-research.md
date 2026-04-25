# Modulo Research

## Objetivo

O modulo de `research` controla o que cada jogador sabe fazer com um item ou assunto do jogo.
Ter um item no inventario nao significa automaticamente saber usa-lo.

Exemplos iniciais:

- `APPLE` nivel 1 libera coletar macas.
- `APPLE` nivel 2 reduz o peso das macas.
- `APPLE` nivel 3 libera comer maca.
- `BASKET` nivel 1 libera o craft da cesta.
- `BASKET` nivel 2 aumenta a capacidade de todas as cestas.
- `BASKET` nivel 3 libera o craft da cesta reforcada `CRAFT_BASKET_T2`.
- `STONE` nivel 1 libera coletar pedra.
- `STONE` nivel 2 reduz o peso da pedra.
- `STONE` nivel 3 libera o craft da funda `WEAPON-STONE-SLING`.
- `TWIG` nivel 1 libera coletar graveto.
- `TWIG` nivel 2 reduz o peso do graveto.
- `TWIG` nivel 3 libera a construcao do abrigo primitivo.
- `FIBER` nivel 1 libera coletar fibra.
- `FIBER` nivel 2 reduz o peso da fibra.
- `FIBER` nivel 3 libera o craft da cesta.
- `HERBS` nivel 1 libera coletar ervas de `HERBS_PATCH`.
- `HERBS` nivel 2 reduz o peso carregado de cada erva.
- `HERBS` nivel 3 libera o uso medicinal de ervas.

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

- bloqueios de equipment por research
- fila, cancelamento ou bonus de velocidade
- novos estudos medicos alem de `HERBS`

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

Tambem existem grants de modificador, como:

```json
{
  "unlock": [
    "container.max_weight_delta:BASKET:2.5"
  ]
}
```

Esse formato aplica o bonus para a familia `BASKET`, incluindo `BASKET`, `BASKET_T2` e futuras variacoes da mesma linha.

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

Para os researches iniciais de item da Era 1, a progressao de tempo segue este padrao:

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

## Padrao de Nivel

Para os researches iniciais de item, o contrato atual do banco e:

- nivel 1: libera a coleta do item, sem custo adicional
- nivel 2: exige `20` unidades do proprio item
- nivel 3: exige `30` unidades do proprio item
- nivel 4: exige `40` unidades do proprio item
- nivel 5: exige `50` unidades do proprio item

Esse padrao vale hoje para:

- `APPLE`
- `STONE`
- `TWIG`
- `FIBER`
- `HERBS`

O contrato recomendado para novos itens segue a mesma leitura.
Itens antigos podem ter excecoes documentadas, mas o padrao atual do banco ja foi alinhado para os itens iniciais.

## Regra de Aparicao de Tecnologia

Quando uma tecnologia nova ainda nao existe para o jogador, o fluxo preferido e criar a tecnologia filha com os requisitos dela.

Ou seja:

- a pesquisa pai define a base do item
- a pesquisa filha nasce ja com os pre-requisitos de aparicao
- o desbloqueio real acontece quando a pesquisa filha fica disponivel e concluida

Isso evita obrigar a pesquisa pai a prever tudo que vai existir depois.
Em vez de colocar no item antigo uma lista de futuros desbloqueios, a gente cria o card novo ja amarrado ao que precisa ser concluido antes.

Exemplos práticos:

- `RESEARCH_STONE` no nivel 3 libera a tecnologia `WEAPON-STONE-SLING`
- `RESEARCH_BASKET` no nivel 2 exige `10 FIBER` + `10 GRAVETO`
- `RESEARCH_BASKET` no nivel 3 libera a tecnologia `CRAFT_BASKET_T2`
- quando surgir uma tecnologia nova, ela deve ser cadastrada com os requisitos de aparicao corretos, em vez de ser antecipada em toda a arvore pai

Regra mental:

- pesquisa pai organiza o item
- pesquisa filha organiza a nova tecnologia
- o contrato fica mais escalavel porque cada card novo explica o que precisa existir antes dele aparecer

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

## Estado de Padronizacao

A arvore legada de researches de itens foi reorganizada para seguir o mesmo contrato:

- nivel 1 sempre ancora coleta ou acesso inicial
- nivel 2 sempre fica para bonus passivo, normalmente peso ou capacidade
- nivel 3 sempre fica para a liberacao principal da tecnologia
- niveis 4 e 5 ficam para refinamento e maestria quando o item ainda usa arvore maior

Itens ja alinhados:

- `APPLE`
- `BASKET`
- `STONE`
- `TWIG`
- `FIBER`
- `HERBS`

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
5. Abrir research de insumos medicos, expandindo o modelo iniciado por `HERBS`.
