# Guia de Registro de Itens

## Objetivo

Este documento padroniza como novos itens devem ser registrados no projeto para evitar ambiguidade entre:

- `ga_item_def`: o que o item e
- `ga_item_def_component`: o que o item faz
- `ga_item_instance`: uma instancia concreta do item no mundo/inventario

## Passo zero obrigatorio

Antes de criar qualquer item novo, ler primeiro os modelos Sequelize que definem o contrato atual do banco:

- [ga_item_def.js](/D:/JS-Projects/Youtube/server/models/ga_item_def.js)
- [ga_item_def_component.js](/D:/JS-Projects/Youtube/server/models/ga_item_def_component.js)
- [ga_item_instance.js](/D:/JS-Projects/Youtube/server/models/ga_item_instance.js)

Motivo:

- os enums reais vivem nesses models
- a migration precisa respeitar exatamente esses valores
- isso evita inventar categoria ou componente que o schema ainda nao aceita

Checklist rapido antes de registrar item:

1. Ler o enum de `ga_item_def.category`
2. Ler o enum de `ga_item_def_component.component_type`
3. Ler o enum de `ga_item_instance.bind_state`
4. So depois escrever seed, migration ou update de dados

## Modelo mental

### 1. `ga_item_def`

Define a identidade do item.

Campos principais:

- `code`: identificador estavel do item
- `name`: nome exibido
- `category`: classificacao ampla de dominio
- `stack_max`: tamanho maximo da pilha
- `unit_weight`: peso unitario
- `is_active`: se o item esta habilitado

Regra pratica:

- `category` responde "o item pertence a qual familia de negocio?"
- Nao use `category` para descrever comportamento tecnico fino.

Exemplos:

- maca: `FOOD`
- espada: `EQUIP`
- pedra bruta de coleta: `MATERIAL`
- remedio: `CONSUMABLE`
- mochila: `CONTAINER`

### 2. `ga_item_def_component`

Define capacidades/comportamentos do item.

Campos principais:

- `item_def_id`
- `component_type`
- `data_json`

Regra pratica:

- `component_type` responde "o item sabe fazer o que?"
- Um item pode ter mais de um componente.

Exemplos:

- item equipavel: componente `EQUIPPABLE`
- item que cura ou restaura recurso: componente `CONSUMABLE`
- item que concede slots: componente `GRANTS_CONTAINER`
- arma: componente `WEAPON`
- ferramenta: componente `TOOL`

Observacao importante:

- `FOOD` deve existir em `ga_item_def.category`
- comida consumivel continua podendo usar componente `CONSUMABLE`
- isso nao e contradicao: categoria e dominio; componente e comportamento

Exemplo para maca:

- `ga_item_def.category = FOOD`
- `ga_item_def_component.component_type = CONSUMABLE`
- `data_json` recomendado para a primeira versao:

```json
{
  "consumeTimeMs": 60000,
  "cooldownMs": 60000,
  "effects": [
    {
      "type": "RESTORE_HUNGER",
      "value": 10
    }
  ],
  "buffs": []
}
```

Interpretacao:

- `consumeTimeMs`: tempo real de consumo no servidor
- `cooldownMs`: tempo real minimo para novo consumo automatico
- `effects`: efeitos imediatos do item
- `buffs`: reservado para bonus futuros vindos da comida

## 3. `ga_item_instance`

Representa uma instancia concreta.

Campos principais:

- `item_def_id`
- `owner_user_id`
- `bind_state`
- `durability`
- `props_json`

Regra pratica:

- so existe `ga_item_instance` quando existe uma unidade concreta daquele item
- pilha no container nao significa varias instancias; pode ser uma instancia com `qty > 1` no slot

Exemplo:

- 5 macas em um slot podem ser:
  - 1 `ga_item_instance`
  - 1 `ga_container_slot`
  - `qty = 5`

## 4. Actors de recurso do mundo

Itens do mundo e actores do mundo sao conceitos diferentes.

### Arvore

- pertence a `ga_actor`
- `actor_type = TREE`
- `state_json` pode indicar `resourceType: "APPLE_TREE"`

### Loot da arvore

- pertence a `ga_container` e `ga_container_slot`
- a arvore pode ter um container `LOOT`
- o container guarda slots com itens coletaveis

### Maca da arvore

- pertence a `ga_item_def`
- pode existir uma `ga_item_instance`
- o slot do container referencia essa instancia e define `qty`

## 5. Como registrar um item novo

### Caso A: item puramente material

Criar:

- `ga_item_def`

Opcional:

- nenhum componente, se nao houver comportamento

### Caso B: comida

Criar:

- `ga_item_def` com `category = FOOD`

Adicionar:

- `ga_item_def_component` com `component_type = CONSUMABLE`

JSON base sugerido:

```json
{
  "consumeTimeMs": 60000,
  "cooldownMs": 60000,
  "effects": [
    {
      "type": "RESTORE_HUNGER",
      "value": 10
    }
  ],
  "buffs": []
}
```

### Caso C: equipamento

Criar:

- `ga_item_def` com `category = EQUIP`
- `ga_item_def_component` com `component_type = EQUIPPABLE`

Adicionar em `data_json`:

- `allowedSlots`

### Caso D: item usavel nao alimentar

Criar:

- `ga_item_def` com `category = CONSUMABLE`
- `ga_item_def_component` com `component_type = CONSUMABLE`

Exemplos:

- curativo
- remedio
- antidoto

## 6. Correcao conceitual importante

Hoje, usar `CONSUMABLE` como categoria para comida e amplo demais para a macro de autoalimentacao.

Por isso:

- comida deve ser `FOOD`
- itens como curativos e remedios devem continuar em `CONSUMABLE`

Assim a macro de fome pode filtrar apenas `FOOD`, sem misturar itens medicos ou outros consumiveis.

## 7. Sobre a seed da maca

O seed criado para a maca fez o seguinte:

- criou `ga_item_def` para `FOOD-APPLE`
- criou um actor `TREE`
- criou um container `LOOT` para a arvore
- criou slots vazios nesse container
- criou uma `ga_item_instance` de maca
- colocou essa instancia no slot 0 com `qty = 5`

Pontos de atencao:

- a categoria inicial `CONSUMABLE` foi apenas uma adaptacao ao enum existente e deve ser corrigida para `FOOD`
- `bind_state` foi preenchido como `NONE`
- `props_json` foi usado so como metadado de origem da maca, nao como regra de jogo
- se houver varios registros parecidos no banco, isso precisa ser validado no ambiente, porque a migration em si nao foi escrita para criar varias instancias iguais na mesma execucao

## 8. Convencao recomendada daqui para frente

Para cada item novo, decidir nesta ordem:

1. Qual e a categoria de dominio em `ga_item_def`?
2. Quais comportamentos esse item precisa em `ga_item_def_component`?
3. Esse item precisa de instancia propria ou pode viver apenas como stack em slot?
4. Esse item nasce em inventario, drop, actor de recurso ou crafting?

## 9. Pendencias abertas

- revisar a pedra, que hoje esta com semantica de municao e deve ser reclassificada quando a arma de arremesso existir
