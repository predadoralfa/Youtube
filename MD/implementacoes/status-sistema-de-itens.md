# Sistema de Itens - Estado Atual

## Objetivo

Registrar a verdade atual do backend sobre itens, sem depender de front-end ou suposicoes antigas.

---

## Fonte da verdade

- `server/models/ga_item_def.js`
- `server/models/ga_item_def_component.js`
- `server/models/ga_item_instance.js`
- `server/state/inventory/fullPayload/main.js`
- `server/state/inventory/loader/main.js`

---

## Contrato do schema

### `ga_item_def.category`

Enum atualmente aceito no servidor:

- `CONSUMABLE`
- `FOOD`
- `EQUIP`
- `AMMO`
- `MATERIAL`
- `QUEST`
- `CONTAINER`
- `MISC`
- `MEDICINE`

Leitura pratica:

- `FOOD` e a familia canonical de comida
- `MEDICINE` e a familia canonical de item medicinal
- `CONSUMABLE` ainda existe como categoria generica e de legado
- `CONTAINER` identifica itens que pertencem a essa familia de dominio, nao o comportamento de concessao de slots

### `ga_item_def_component.component_type`

Enum atualmente aceito no servidor:

- `EDIBLE`
- `CONSUMABLE`
- `EQUIPPABLE`
- `GRANTS_CONTAINER`
- `WEAPON`
- `ARMOR`
- `TOOL`

Leitura pratica:

- `EDIBLE` e o formato canonico atual para comida
- `CONSUMABLE` ainda e aceito pelo backend para efeitos de comida, medicina e itens utilitarios
- `EQUIPPABLE` descreve encaixe/equipamento
- `GRANTS_CONTAINER` descreve itens que criam container proprio

### `ga_item_instance.bind_state`

Enum atualmente aceito no servidor:

- `NONE`
- `ON_PICKUP`
- `SOULBOUND`

Leitura pratica:

- o estado continua sendo por instancia, nao por definicao
- o servidor preserva esse contrato no banco e no payload, mesmo quando o item e stackavel

---

## Regras do payload

O payload de inventario e montado em `server/state/inventory/fullPayload/main.js`.

### Item definition

`buildItemDefPayload()` expoe:

- `id`
- `code`
- `name`
- `assetKey`
- `category`
- `weight`
- `stackMax`
- `canEat`
- `canMedicate`
- `components`

Regras atuais:

- `components` sao ordenados por `id`
- `canEat` e calculado pelo backend, nao vem de front
- `canMedicate` depende de efeito medico e da research liberando `item.medicate:<CODE>`

### Regra de comida

`canEat` hoje e derivado assim:

- se a categoria for `FOOD`, o item e tratado como comestivel
- se a categoria for `CONSUMABLE`, o backend ainda aceita o item quando existir efeito de fome
- se a categoria nao for `FOOD` nem `CONSUMABLE`, o backend ainda reconhece o legado `FOOD-` no `code`
- os componentes lidos para isso sao `EDIBLE` e `CONSUMABLE`

### Regra de medicina

`canMedicate` hoje e derivado assim:

- o item precisa ter efeito medico em um componente
- o jogador precisa ter a capability `item.medicate:<CODE>`
- os componentes lidos para efeito medico sao `EDIBLE` e `CONSUMABLE`

---

## Loader e runtime

O loader de inventario em `server/state/inventory/loader/main.js` faz o reconstrutor autoritativo do estado.

Fluxo atual:

- garante inventario inicial
- carrega equipamento
- repara containers concedidos por item equipado quando necessario
- garante container de materiais do primitive shelter
- carrega owners, containers, slots, item instances, defs e componentes
- monta o runtime final antes de emitir payload

Ponto importante:

- o servidor e responsavel por reparar o estado legado antes de entregar snapshot
- a UI nao deve adivinhar conteudo perdido ou esconder estado que ainda existe no banco

---

## Familias hardcoded

### `FOOD-APPLE`

- `category = FOOD`
- `component_type = EDIBLE`
- `canEat = true`
- seed e migracoes posteriores normalizaram o registro para a forma atual

### `SMALL_STONE`

- `category = MATERIAL`
- item base de coleta
- usado em research e ajustes de peso/coleta

### `FIBER`

- `category = MATERIAL`
- usado como materia-prima para coleta e craft

### `GRAVETO`

- `category = MATERIAL`
- item base de coleta
- usado em research e ajustes de peso/coleta

### `BASKET`

- `category = CONTAINER`
- possui `EQUIPPABLE`
- possui `GRANTS_CONTAINER`
- concede container proprio ao ser equipado

### `BASKET_T2`

- `category = CONTAINER`
- possui `EQUIPPABLE`
- possui `GRANTS_CONTAINER`
- possui `ga_container_def` proprio
- possui `CRAFT_BASKET_T2`

### `HERBS`

- `category = MEDICINE`
- possui `CONSUMABLE`
- tem efeito medico em `RESTORE_HP`
- libera uso medico via research `item.medicate:HERBS`

---

## Observacoes operacionais

- o servidor ainda aceita padrao de legado para comida e medicina, mas a classificacao atual deve ser documentada pelo estado canonico
- o contrato real nao vive no front, vive no schema, nas migrations e no payload do servidor
- qualquer item novo precisa ser validado contra as enums acima antes de virar seed
- quando houver diferenca entre doc antigo e model atual, a modelagem do servidor ganha
