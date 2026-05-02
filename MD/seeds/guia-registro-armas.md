# Guia de Registro de Armas

## Objetivo

Este guia mostra como registrar armas no banco de dados do projeto sem espalhar hardcode no client.

Ele cobre:

- quais tabelas usar
- quais campos sao obrigatorios
- como montar o seed da arma
- como registrar os atributos de combate
- como manter o contrato temporario ate a migracao do `weaponClass` para `ENUM`

## Regra central

Hoje, uma arma e um item comum de equipamento com componentes adicionais.

Em termos tecnicos:

- a definicao base fica em `ga_item_def`
- o encaixe fica em `ga_item_def_component` com `component_type = EQUIPPABLE`
- os atributos de combate ficam em `ga_item_def_component` com `component_type = WEAPON`
- a durabilidade atual fica em `ga_item_instance.durability`
- metadados variaveis podem ficar em `ga_item_instance.props_json`
- se a arma vier de craft ou seed pronta, a instancia deve nascer com `durability = durabilityMax`

## O que o banco ja suporta

O schema atual ja suporta armas como dado:

- `ga_item_def.category` aceita `EQUIP`
- `ga_item_def_component.component_type` aceita `WEAPON`
- `ga_item_instance` possui `durability`
- `ga_item_instance` possui `props_json`
- `ga_item_def_component.data_json` guarda atributos flexiveis da arma

Observacao importante:

- `weaponClass` ainda fica temporariamente em `WEAPON.data_json`
- no futuro, `weaponClass` deve virar uma coluna `ENUM`
- o `data_json` deve continuar reservado para atributos variaveis, bonus extras e metadados complementares

## Estrutura minima de uma arma

Toda arma nova deve responder a estas perguntas:

- onde equipa?
- que tipo de arma e?
- qual o dano base?
- qual o alcance?
- quanto gasta de stamina?
- quanto dura?
- qual a chance de critico?
- qual o tipo de dano?
- usa municao ou desgaste por uso?

## Campos obrigatorios

### Em `ga_item_def`

Campos esperados:

- `code`
- `name`
- `asset_key`
- `category`
- `stack_max`
- `unit_weight`
- `era_min_id`
- `is_active`

Regras:

- `code` precisa ser unico
- `category` deve ser `EQUIP`
- `stack_max` normalmente deve ser `1`
- `unit_weight` precisa refletir o peso da arma
- `asset_key` deve apontar para o modelo visual do item

### Em `EQUIPPABLE.data_json`

Campos esperados:

- `allowedSlots`

Exemplo:

```json
{
  "allowedSlots": ["HAND_L", "HAND_R"]
}
```

Interpretacao:

- `allowedSlots` define em quais slots a arma pode ser equipada
- isso nao significa, por si so, que o sistema bloqueia automaticamente a outra mao
- o contrato atual do banco serve para validar encaixe

### Em `WEAPON.data_json`

Campos recomendados:

- `weaponClass`
- `attackPower`
- `attackSpeed`
- `attackRange`
- `durabilityMax`
- `criticalChance`
- `criticalMultiplier`
- `staminaCost`
- `damageType`
- `ammoType`
- `bonusExtras`

Exemplo base:

```json
{
  "weaponClass": "RANGED_THROWN",
  "attackPower": 3,
  "attackSpeed": 0.15,
  "attackRange": 3,
  "durabilityMax": 100,
  "criticalChance": 0.05,
  "criticalMultiplier": null,
  "staminaCost": 7,
  "damageType": "impacto",
  "ammoType": "THROW",
  "bonusExtras": {}
}
```

## Como registrar a arma

### Passo 1: criar a definicao base

Inserir ou atualizar `ga_item_def` com:

- `code`
- `name`
- `asset_key`
- `category = EQUIP`
- `stack_max = 1`
- `unit_weight`
- `era_min_id`
- `is_active = true`

### Passo 2: criar o componente de encaixe

Inserir `ga_item_def_component` com:

- `component_type = EQUIPPABLE`
- `data_json.allowedSlots`

### Passo 3: criar o componente de combate

Inserir `ga_item_def_component` com:

- `component_type = WEAPON`
- `data_json.weaponClass`
- `data_json.attackPower`
- `data_json.attackSpeed`
- `data_json.attackRange`
- `data_json.durabilityMax`
- `data_json.criticalChance`
- `data_json.criticalMultiplier`
- `data_json.staminaCost`
- `data_json.damageType`
- `data_json.ammoType`
- `data_json.bonusExtras`

### Passo 4: se a arma nascer pronta no inventario

Criar `ga_item_instance` com:

- `item_def_id`
- `durability = durabilityMax`
- `props_json` com metadados da instancia, se houver

Regra:

- se a arma nao foi usada ainda, a durabilidade deve nascer cheia
- se a arma nascer usada, a instancia pode iniciar abaixo do maximo

## Exemplos recomendados

### Stone Throw

Contrato sugerido:

- `code`: `STONE_THROW`
- `name`: `Stone Throw`
- `asset_key`: `Stone.glb`
- `category`: `EQUIP`
- `stack_max`: `1`
- `unit_weight`: `5`
- `allowedSlots`: `["HAND_L", "HAND_R"]`
- `weaponClass`: `RANGED_THROWN`
- `attackPower`: `3`
- `attackSpeed`: `0.15`
- `attackRange`: `3`
- `durabilityMax`: `100`
- `criticalChance`: `0.05`
- `criticalMultiplier`: `null`
- `staminaCost`: `7`
- `damageType`: `impacto`
- `ammoType`: `THROW`
- `bonusExtras`: `{}`
- desbloqueio: `RESEARCH_STONE_THROW` -> `CRAFT_STONE_THROW`

### Stone Punch

Contrato sugerido:

- `code`: `STONE_PUNCH`
- `name`: `Stone Punch`
- `asset_key`: `Stone.glb`
- `category`: `EQUIP`
- `stack_max`: `1`
- `unit_weight`: `1`
- `allowedSlots`: `["HAND_L"]`
- `weaponClass`: `MELEE`
- `attackPower`: `5`
- `attackSpeed`: `0.1`
- `attackRange`: `1`
- `durabilityMax`: `100`
- `criticalChance`: `0.07`
- `criticalMultiplier`: `null`
- `staminaCost`: `10`
- `damageType`: `impacto`
- `bonusExtras`: `{}`
- desbloqueio: `RESEARCH_STONE_PUNCH` -> `CRAFT_STONE_PUNCH`

## Contratos importantes

### `allowedSlots`

Define onde a arma pode ser equipada.

Exemplos:

- `HAND_L`
- `HAND_R`
- ambas as maos

### `weaponClass`

Define a familia de comportamento da arma.

Exemplos temporarios:

- `MELEE`
- `RANGED_THROWN`
- `RANGED_BOW`
- `MAGIC`

Observacao:

- essa classificacao ainda e temporaria em JSON
- o objetivo e migrar para uma coluna `ENUM` quando o sistema amadurecer

### `criticalChance`

Usar valor decimal no banco.

Exemplos:

- `5%` -> `0.05`
- `7%` -> `0.07`

### `criticalMultiplier`

Se a arma nao tiver multiplicador definido, usar `null`.

### `bonusExtras`

Reservado para bonus adicionais futuros.

Exemplos:

- empurrao
- sangramento
- bonus contra tipo de inimigo
- ajuste de alcance

Quando nao houver bonus livre, usar `{}`.

## Cuidados de implementacao

- nao usar `category = WEAPON`, porque o contrato atual do banco usa `EQUIP`
- nao colocar stats de combate no `ga_item_def`
- nao duplicar o mesmo `code` em duas armas
- nao esquecer de criar os dois componentes, `EQUIPPABLE` e `WEAPON`
- nao usar `ammoType` em armas corpo a corpo sem necessidade real
- nao confiar no client para decidir dano, alcance ou consumo

## Estado atual do sistema

Hoje o cadastro de armas ja existe como dados, mas o combate ainda nao consome o `WEAPON.data_json` diretamente.

Isso significa:

- o banco aceita a definicao
- o inventario aceita o item
- o equipamento aceita o encaixe
- o combate ainda pode depender de contrato legado enquanto a integracao nao for concluida

## Quando atualizar este documento

Atualize este guia quando:

- surgir uma nova classe de arma
- o contrato de `weaponClass` sair do JSON e virar coluna
- o sistema de combate passar a ler os atributos da arma equipada
- o comportamento de dois slots ou duas maos mudar
- novos bonus extras forem padronizados
